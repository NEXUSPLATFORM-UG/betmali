import { type Database } from "firebase-admin/lib/database/database";
import { storage } from "./storage";

export async function runBackgroundSettlement(db: Database) {
  try {
    const response = await fetch("https://www.fortebet.ug/api/web/v1/virtual-soccer/offer");
    if (!response.ok) {
      console.warn("Settlement fetch failed with status", response.status);
      return 0;
    }

    const json: any = await response.json();
    const results = json.data?.results || [];

    const resultsRef = db.ref("virtual_results_history");
    // Persist results history for fallback
    for (const res of results) {
      await resultsRef.child(String(res.id)).set({ ...res, processedAt: Date.now() });
    }

    const usersRef = db.ref("users");
    const usersSnapshot = await usersRef.get();
    if (!usersSnapshot.exists()) return 0;

    const users = usersSnapshot.val();
    let processedCount = 0;

    // Normalize results lookup by id for quick access
    const resultsById: Record<string, any> = {};
    for (const r of results) {
      resultsById[String(r.id)] = r;
    }
    const MAX_RETURN = 1000000000; // 1 billion UGX cap for payouts

    // Process each user and their virtual tickets
    for (const [uid, userData] of Object.entries(users) as [string, any][]) {
      if (!userData.virtualTickets) continue;

      for (const [ticketId, ticket] of Object.entries(userData.virtualTickets) as [string, any][]) {
        try {
          // We only process tickets still marked as `pending` to avoid double-processing
          if (ticket.status && ticket.status !== "pending") continue;

          let ticketWon = true;
          let anyLost = false;
          const updatedItems: any[] = [];

          for (const item of ticket.items || []) {
            // Lookup by match id (string/number tolerant)
            const matchIdKey = String(item.matchId);
            let matchResult = resultsById[matchIdKey];

            // fallback to history
            if (!matchResult) {
              const histSnapshot = await resultsRef.child(matchIdKey).get();
              if (histSnapshot.exists()) matchResult = histSnapshot.val();
            }

            if (!matchResult) {
              // result not available yet => item remains pending
              updatedItems.push({ ...item, status: "pending" });
              // mark that not all items are won (leave ticketWon as-is)
              continue;
            }

            const { result_ft, result_ht } = matchResult;
            let itemWon = false;

            const sel = String(item.selection || "");
            if (sel.startsWith("FT: ")) {
              const pick = sel.replace("FT: ", "");
              if (pick === "1") itemWon = result_ft.home > result_ft.away;
              else if (pick === "X") itemWon = result_ft.home === result_ft.away;
              else if (pick === "2") itemWon = result_ft.home < result_ft.away;
            } else if (sel.startsWith("HT: ")) {
              const pick = sel.replace("HT: ", "");
              if (pick === "1") itemWon = result_ht.home > result_ht.away;
              else if (pick === "X") itemWon = result_ht.home === result_ht.away;
              else if (pick === "2") itemWon = result_ht.home < result_ht.away;
            } else if (sel.startsWith("U/O 2.5: ")) {
              const pick = sel.replace("U/O 2.5: ", "");
              const total = result_ft.home + result_ft.away;
              if (pick === "Under 2.5") itemWon = total < 2.5;
              else if (pick === "Over 2.5") itemWon = total > 2.5;
            } else if (sel.startsWith("BTTS FT: ")) {
              const pick = sel.replace("BTTS FT: ", "");
              const bothScored = result_ft.home > 0 && result_ft.away > 0;
              itemWon = pick === "Goal-Goal" ? bothScored : !bothScored;
            } else if (sel.startsWith("BTTS HT: ")) {
              const pick = sel.replace("BTTS HT: ", "");
              const bothScored = result_ht.home > 0 && result_ht.away > 0;
              itemWon = pick === "Goal-Goal" ? bothScored : !bothScored;
            } else if (sel.startsWith("CS: ")) {
              const pick = sel.replace("CS: ", "");
              itemWon = pick === `${result_ft.home}:${result_ft.away}`;
            }

            if (!itemWon) {
              ticketWon = false;
              anyLost = true;
            }

            updatedItems.push({ ...item, status: itemWon ? "won" : "lost", result: `${result_ft.home}:${result_ft.away} (${result_ht.home}:${result_ht.away})` });
          }

          // Determine new ticket status immediately based on item results we could evaluate
          const newStatus = anyLost ? "lost" : (ticket.items && ticket.items.length > 0 && updatedItems.every((it) => it.status === "won") ? "won" : "pending");

          // Transactionally update the ticket to avoid double processing
          const ticketRef = db.ref(`users/${uid}/virtualTickets/${ticketId}`);
          const ticketTxResult = await ticketRef.transaction((current) => {
            if (!current) return null; // nothing to do
            if (current.status && current.status !== "pending") return; // already processed
            return {
              ...current,
              status: newStatus,
              items: updatedItems,
              settledAt: newStatus === "pending" ? current.settledAt : Date.now(),
            } as any;
          });

          if (ticketTxResult.committed) {
            processedCount++;

            if (newStatus === "won") {
              // compute capped payout and credit the user's balance transactionally
              const payout = Math.min(Number(ticket.potentialReturn || 0), MAX_RETURN);
              const balanceRef = db.ref(`users/${uid}/balance`);
              await balanceRef.transaction((curr) => {
                const currentBal = typeof curr === "number" ? curr : Number(curr) || 0;
                return currentBal + payout;
              });

              // Add notification
              const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              await db.ref(`users/${uid}/notifications/${notifId}`).set({
                title: "Ticket Won! 🎉",
                message: `Your virtual ticket ${ticketId} has won! ${payout} UGX added to your balance.`,
                timestamp: Date.now(),
                read: false,
                type: "win",
              });

              // If the user had any locked referral bonus, unlock it now (user won a bet)
              try {
                const prevLocked = userData.lockedReferral || 0;
                if (prevLocked && Number(prevLocked) > 0) {
                  const lockedRef = db.ref(`users/${uid}/lockedReferral`);
                  await lockedRef.transaction((curr) => {
                    const cur = typeof curr === 'number' ? curr : Number(curr) || 0;
                    if (cur > 0) return 0;
                    return curr;
                  });

                  const unlockNotifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                  await db.ref(`users/${uid}/notifications/${unlockNotifId}`).set({
                    title: "Referral Bonus Unlocked",
                    message: `Your referral bonus has been unlocked and is now withdrawable.`,
                    timestamp: Date.now(),
                    read: false,
                    type: "info",
                  });
                }
              } catch (e) {
                console.warn('Failed to unlock referral bonus for user', uid, e);
              }
            }
          }
        } catch (e) {
          console.error("Error processing ticket", uid, ticketId, e);
        }
      }
    }

    // Process sportsbook tickets (regular `tickets`) for non-virtual bets
    for (const [uid, userData] of Object.entries(users) as [string, any][]) {
      if (!userData.tickets) continue;

      for (const [ticketId, ticket] of Object.entries(userData.tickets) as [string, any][]) {
        try {
          if (ticket.status && ticket.status !== "pending") continue;

          let ticketWon = true;
          let anyLost = false;
          const updatedItems: any[] = [];

          for (const item of ticket.items || []) {
            // try Betika live match first
            let matchResult: any = null;

            try {
              const bRes = await fetch(`https://live-ug.betika.com/v1/uo/match?id=${item.matchId}`);
              if (bRes.ok) {
                const bJson = await bRes.json();
                // Betika structures vary; try common fields
                if (bJson.result_ft || bJson.result_ft === 0) {
                  matchResult = bJson;
                } else if (bJson.match && (bJson.match.result_ft || bJson.match.score)) {
                  matchResult = bJson.match;
                } else if (bJson.data && bJson.data.result_ft) {
                  matchResult = bJson.data;
                }
              }
            } catch (e) {
              // ignore Betika fetch errors and fallback
            }

            // fallback to storage (betmaster) for a best-effort score
            if (!matchResult) {
              try {
                const stored = await storage.getMatch(String(item.matchId));
                if (stored) {
                  matchResult = {
                    result_ft: { home: stored.homeScore || 0, away: stored.awayScore || 0 },
                    // storage doesn't provide HT; leave HT as zeros
                    result_ht: { home: 0, away: 0 },
                    status: stored.status || 'upcoming'
                  };
                }
              } catch (e) {
                // ignore storage errors
              }
            }

            if (!matchResult) {
              // result not available -> mark item pending
              updatedItems.push({ ...item, status: 'pending' });
              continue;
            }

            // determine if match is finished. Betika may set status 'finished' or similar.
            const maybeFinished = (matchResult.status && (String(matchResult.status).toLowerCase() === 'finished' || String(matchResult.status).toLowerCase() === 'ended' || String(matchResult.status).toLowerCase() === 'ft')) || (typeof matchResult.result_ft?.home === 'number' && typeof matchResult.result_ft?.away === 'number' && (matchResult.result_ft.home !== null));

            if (!maybeFinished) {
              // match isn't finished yet -> mark this item pending and continue
              updatedItems.push({ ...item, status: 'pending' });
              continue;
            }

            const result_ft = matchResult.result_ft || { home: 0, away: 0 };
            const result_ht = matchResult.result_ht || { home: 0, away: 0 };

            let itemWon = false;
            const sel = String(item.selection || "");

            // Normalize common client-side selection formats.
            // The client often stores 1X2 selections as "1: 1" or "X: X" (market: selection).
            // Normalize those to the canonical "FT: <pick>" format so settlement logic matches both.
            let normSel = sel;
            try {
              if (sel.includes(':')) {
                const parts = sel.split(':').map(s => s.trim());
                if (parts.length >= 2) {
                  const left = parts[0];
                  const right = parts.slice(1).join(':');
                  // If either side looks like a 1X2 pick, treat as full-time 1X2
                  if (['1', 'X', '2'].includes(left) || ['1', 'X', '2'].includes(right)) {
                    normSel = `FT: ${right}`;
                  }
                }
              }
            } catch (e) {
              normSel = sel;
            }

            const evalSel = normSel;

            if (evalSel.startsWith("FT: ")) {
              const pick = evalSel.replace("FT: ", "");
              if (pick === "1") itemWon = result_ft.home > result_ft.away;
              else if (pick === "X") itemWon = result_ft.home === result_ft.away;
              else if (pick === "2") itemWon = result_ft.home < result_ft.away;
            } else if (sel.startsWith("HT: ")) {
              const pick = sel.replace("HT: ", "");
              if (pick === "1") itemWon = result_ht.home > result_ht.away;
              else if (pick === "X") itemWon = result_ht.home === result_ht.away;
              else if (pick === "2") itemWon = result_ht.home < result_ht.away;
            } else if (sel.includes("U/O") || sel.includes("Over") || sel.includes("Under")) {
              // Handle Over/Under (e.g., "U/O 2.5: Over 2.5")
              const m = sel.match(/([0-9]+\.?[0-9]*)/);
              const total = (result_ft.home || 0) + (result_ft.away || 0);
              if (m) {
                const threshold = parseFloat(m[1]);
                if (sel.toLowerCase().includes('over')) itemWon = total > threshold;
                else if (sel.toLowerCase().includes('under')) itemWon = total < threshold;
              }
            } else if (sel.startsWith("BTTS") || sel.toLowerCase().includes('btts')) {
              const bothScored = (result_ft.home || 0) > 0 && (result_ft.away || 0) > 0;
              if (sel.toLowerCase().includes('goal-goal') || sel.toLowerCase().includes('yes')) itemWon = bothScored;
              else if (sel.toLowerCase().includes('no')) itemWon = !bothScored;
            } else if (sel.startsWith("CS: ")) {
              const pick = sel.replace("CS: ", "");
              itemWon = pick === `${result_ft.home}:${result_ft.away}`;
            }

            if (!itemWon) {
              ticketWon = false;
              anyLost = anyLost || !itemWon;
            }

            updatedItems.push({ ...item, status: itemWon ? 'won' : 'lost', result: `${result_ft.home}:${result_ft.away} (${result_ht.home}:${result_ht.away})` });
          }

          // Decide ticket status right away
          const newStatus = anyLost ? 'lost' : (ticket.items && ticket.items.length > 0 && updatedItems.every((it) => it.status === 'won') ? 'won' : 'pending');

          // Transactionally update the ticket to avoid double processing
          const ticketRef = db.ref(`users/${uid}/tickets/${ticketId}`);
          const ticketTxResult = await ticketRef.transaction((current) => {
            if (!current) return null;
            if (current.status && current.status !== 'pending') return;
            return {
              ...current,
              status: newStatus,
              items: updatedItems,
              settledAt: newStatus === 'pending' ? current.settledAt : Date.now(),
            } as any;
          });

          if (ticketTxResult.committed) {
            processedCount++;

            if (newStatus === 'won') {
              const payout = Math.min(Number(ticket.potentialReturn || 0), MAX_RETURN);
              // Credit user's balance transactionally (capped)
              const balanceRef = db.ref(`users/${uid}/balance`);
              await balanceRef.transaction((curr) => {
                const currentBal = typeof curr === 'number' ? curr : Number(curr) || 0;
                return currentBal + payout;
              });

              const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              await db.ref(`users/${uid}/notifications/${notifId}`).set({
                title: "Ticket Won! 🎉",
                message: `Your ticket ${ticketId} has won! ${payout} UGX added to your balance.`,
                timestamp: Date.now(),
                read: false,
                type: 'win',
              });

              // Unlock any locked referral bonus now that the user has won a bet
              try {
                const prevLocked = userData.lockedReferral || 0;
                if (prevLocked && Number(prevLocked) > 0) {
                  const lockedRef = db.ref(`users/${uid}/lockedReferral`);
                  await lockedRef.transaction((curr) => {
                    const cur = typeof curr === 'number' ? curr : Number(curr) || 0;
                    if (cur > 0) return 0;
                    return curr;
                  });

                  const unlockNotifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                  await db.ref(`users/${uid}/notifications/${unlockNotifId}`).set({
                    title: "Referral Bonus Unlocked",
                    message: `Your referral bonus has been unlocked and is now withdrawable.`,
                    timestamp: Date.now(),
                    read: false,
                    type: 'info',
                  });
                }
              } catch (e) {
                console.warn('Failed to unlock referral bonus for user', uid, e);
              }
            }
          }
        } catch (e) {
          console.error('Error processing sportsbook ticket', uid, ticketId, e);
        }
      }
    }

    if (processedCount > 0) {
      console.log(`Background settlement: Processed ${processedCount} tickets.`);
    }

    return processedCount;
  } catch (err) {
    console.error("Background settlement error:", err);
    return 0;
  }
}

export default runBackgroundSettlement;

