import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Timer, Trophy, BarChart2, Trash2, X, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useBetslip, useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { database } from "@/lib/firebase";
import { ref, set, get, update } from "firebase/database";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OddsDetail {
  id: number;
  odds_name: string;
  odds_val: number;
}

interface Market {
  id: number;
  type: string;
  odds: Record<string, OddsDetail>;
}

interface MatchResult {
  id: number;
  daily_id: number;
  status: number;
  event_time: string;
  home: string;
  away: string;
  league: string;
  result_ft: { home: number; away: number };
  result_ht: { home: number; away: number };
}

interface Match {
  item_id: number;
  item_daily_id: number;
  item_status: number;
  item_time: string;
  home: string;
  away: string;
  item_name: string;
  item_league: string;
  odds: Record<string, Market>;
}

interface ApiResponse {
  status: string;
  data: {
    matches: Match[];
    results: MatchResult[];
  };
}

export const settleVirtualBets = async (user: any, latestResults: MatchResult[], currency: string, addToBalance: (amount: number) => void) => {
  if (!user || !latestResults.length) return;

  try {
    const userTicketsRef = ref(database, `users/${user.uid}/virtualTickets`);
    const snapshot = await get(userTicketsRef);
    if (!snapshot.exists()) return;

    const tickets = snapshot.val();
    const updates: Record<string, any> = {};
    let totalWinnings = 0;

    for (const [ticketId, ticket] of Object.entries(tickets) as [string, any][]) {
      if (ticket.status !== 'pending') continue;

      let allSettled = true;
      let ticketWon = true;

      const updatedItems = ticket.items.map((item: any) => {
        const matchResult = latestResults.find(r => r.id === item.matchId);
        if (!matchResult) {
          allSettled = false;
          return item;
        }

        let itemWon = false;
        const { result_ft, result_ht } = matchResult;

        if (item.selection.startsWith("FT: ")) {
          const pick = item.selection.replace("FT: ", "");
          if (pick === "1") itemWon = result_ft.home > result_ft.away;
          else if (pick === "X") itemWon = result_ft.home === result_ft.away;
          else if (pick === "2") itemWon = result_ft.home < result_ft.away;
        } else if (item.selection.startsWith("HT: ")) {
          const pick = item.selection.replace("HT: ", "");
          if (pick === "1") itemWon = result_ht.home > result_ht.away;
          else if (pick === "X") itemWon = result_ht.home === result_ht.away;
          else if (pick === "2") itemWon = result_ht.home < result_ht.away;
        } else if (item.selection.startsWith("U/O 2.5: ")) {
          const pick = item.selection.replace("U/O 2.5: ", "");
          const total = result_ft.home + result_ft.away;
          if (pick === "Under 2.5") itemWon = total < 2.5;
          else if (pick === "Over 2.5") itemWon = total > 2.5;
        } else if (item.selection.startsWith("BTTS FT: ")) {
          const pick = item.selection.replace("BTTS FT: ", "");
          const bothScored = result_ft.home > 0 && result_ft.away > 0;
          itemWon = pick === "Goal-Goal" ? bothScored : !bothScored;
        } else if (item.selection.startsWith("BTTS HT: ")) {
          const pick = item.selection.replace("BTTS HT: ", "");
          const bothScored = result_ht.home > 0 && result_ht.away > 0;
          itemWon = pick === "Goal-Goal" ? bothScored : !bothScored;
        } else if (item.selection.startsWith("CS: ")) {
          const pick = item.selection.replace("CS: ", "");
          itemWon = pick === `${result_ft.home}:${result_ft.away}`;
        }

        if (!itemWon) ticketWon = false;
        return { ...item, status: itemWon ? 'won' : 'lost', result: `${result_ft.home}:${result_ft.away} (${result_ht.home}:${result_ht.away})` };
      });

      if (allSettled) {
        updates[`users/${user.uid}/virtualTickets/${ticketId}/status`] = ticketWon ? 'won' : 'lost';
        updates[`users/${user.uid}/virtualTickets/${ticketId}/items`] = updatedItems;
        if (ticketWon) {
          totalWinnings += ticket.potentialReturn;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
      if (totalWinnings > 0) {
        const newBalance = user.balance + totalWinnings;
        await set(ref(database, `users/${user.uid}/balance`), newBalance);
        addToBalance(totalWinnings);
      }
    }
  } catch (err) {
    console.error("Settlement error:", err);
  }
};

export function VirtualMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [activeView, setActiveView] = useState<"stream" | "tracker">("stream");
  const { virtualItems, virtualStake, setVirtualStake, addVirtualItem, removeVirtualItem, clearVirtual } = useBetslip();
  const { currency, user, addToBalance } = useAuth();
  const { toast } = useToast();

  // Local controlled string for virtual stake to avoid leading-zero typing issues
  const [inputVirtualStakeStr, setInputVirtualStakeStr] = useState(String(virtualStake ?? ''));
  useEffect(() => {
    setInputVirtualStakeStr(String(virtualStake ?? ''));
  }, [virtualStake]);

  const totalOdds = virtualItems.reduce((acc, item) => acc * item.odds, 1);
  const potentialReturn = virtualStake * totalOdds;
  const MAX_RETURN = 1000000000; // 1 billion UGX cap
  const cappedPotentialReturn = Math.min(potentialReturn, MAX_RETURN);

  const settleBets = async (latestResults: MatchResult[]) => {
    if (!user || !latestResults.length) return;
    await settleVirtualBets(user, latestResults, currency, addToBalance);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/proxy/virtual-offer");
        if (!response.ok) throw new Error("Failed to fetch offer");
        const json: ApiResponse = await response.json();
        
        const newResults = json.data.results || [];
        setMatches(json.data.matches || []);
        setResults(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newResults)) {
            settleBets(newResults);
            return newResults;
          }
          return prev;
        });
        
        if (json.data.matches && json.data.matches.length > 0) {
          const firstMatchTime = new Date(json.data.matches[0].item_time).getTime();
          const now = new Date().getTime();
          const diff = firstMatchTime - now;
          if (diff > 0) {
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          } else {
            setTimeLeft("00:00");
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const refreshInterval = setInterval(fetchData, 1000); // Poll every second as requested
    return () => clearInterval(refreshInterval);
  }, [user]);

  const handlePlaceVirtualBet = async () => {
    if (virtualItems.length === 0 || !user) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

    if (virtualStake < 100) {
      toast({ title: "Error", description: "Minimum stake is 100 UGX", variant: "destructive" });
      return;
    }

    if (virtualStake > user.balance) {
      toast({ title: "Error", description: "Insufficient balance", variant: "destructive" });
      return;
    }

    try {
      const ticketId = "V-TICKET-" + Date.now().toString().slice(-6);
      const now = Date.now();
      const ticketData = {
        id: ticketId,
        type: 'virtual',
        stake: virtualStake,
        totalOdds: totalOdds,
        potentialReturn: cappedPotentialReturn,
        status: 'pending',
        createdAt: now,
        items: virtualItems.map(item => ({
          matchId: item.matchId,
          selection: item.selection,
          odds: item.odds,
          homeTeam: item.matchInfo.homeTeam,
          awayTeam: item.matchInfo.awayTeam,
          status: 'pending'
        }))
      };

      await set(ref(database, `users/${user.uid}/virtualTickets/${ticketId}`), ticketData);
      const newBalance = user.balance - virtualStake;
      await set(ref(database, `users/${user.uid}/balance`), newBalance);
      addToBalance(-virtualStake);

      toast({
        title: "Virtual Bet Placed!",
        description: `Ticket ID: ${ticketId}`,
        className: "bg-primary border-none text-primary-foreground font-bold",
      });
      try {
        window.dispatchEvent(new CustomEvent('new-ticket', { detail: { ticket: ticketData } }));
      } catch (e) { /* ignore */ }
      clearVirtual();
    } catch (error) {
      console.error('Virtual placement error:', error);
      toast({ title: "Error", description: "Failed to place virtual bet.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full p-8 text-muted-foreground font-bold">LOADING VIRTUAL MATCHES...</div>;
  if (error) return <Alert variant="destructive" className="m-4"><AlertCircle className="h-4 h-4"/><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-card border-b border-border/50 px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time to kickoff:</span>
            <span className="text-sm font-black text-primary italic">{timeLeft}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black text-primary uppercase italic tracking-tighter">VIRTUAL SOCCER</span>
          </div>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground">
          New match <span className="text-primary font-black">every few minutes!</span>
        </div>
      </div>

      <div className="p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {matches.map((match) => (
            <div key={match.item_id} className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-lg shadow-black/20 hover:border-primary/30 transition-all">
              <div className="bg-primary px-3 py-2 flex items-center justify-between">
                <span className="text-[9px] font-black text-primary-foreground/70">{match.item_daily_id}</span>
                <div className="flex-1 flex justify-center items-center gap-2 text-[10px] font-black text-primary-foreground italic">
                  <span>{match.home}</span>
                  <span className="text-[8px] opacity-60">VS</span>
                  <span>{match.away}</span>
                </div>
              </div>

              <div className="p-2 space-y-3 bg-gradient-to-b from-card to-background">
                {/* 1X2 - Full Time Result (Market ID 1) - Filter for 1, X, 2 only */}
                {match.odds["1"] && (
                  <Section title="Full Time Result">
                    <div className="grid grid-cols-3 gap-1">
                      {Object.values(match.odds["1"].odds)
                        .filter(odd => ["1", "X", "2"].includes(odd.odds_name))
                        .map((odd) => (
                        <VirtualOdds 
                          key={odd.id} 
                          selection={odd.odds_name} 
                          odds={odd.odds_val.toString()} 
                          isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `FT: ${odd.odds_name}`)}
                          onClick={() => addVirtualItem({
                            matchId: match.item_id,
                            selection: `FT: ${odd.odds_name}`,
                            odds: odd.odds_val,
                            matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                          })}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* 1X2 HT - 1st Half Result (Market ID 2) - Filter for 1, X, 2 only */}
                {match.odds["2"] && (
                  <Section title="1st Half Result">
                    <div className="grid grid-cols-3 gap-1">
                      {Object.values(match.odds["2"].odds)
                        .filter(odd => ["1", "X", "2"].includes(odd.odds_name))
                        .map((odd) => (
                        <VirtualOdds 
                          key={odd.id} 
                          selection={odd.odds_name} 
                          odds={odd.odds_val.toString()} 
                          isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `HT: ${odd.odds_name}`)}
                          onClick={() => addVirtualItem({
                            matchId: match.item_id,
                            selection: `HT: ${odd.odds_name}`,
                            odds: odd.odds_val,
                            matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                          })}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* U/O 2.5 - Total Goals (Market ID 4) */}
                {match.odds["4"] && (
                  <Section title="Total Goals (2.5)">
                    <div className="grid grid-cols-2 gap-1">
                      {Object.values(match.odds["4"].odds).map((odd) => (
                        <VirtualOdds 
                          key={odd.id} 
                          selection={odd.odds_name} 
                          odds={odd.odds_val.toString()} 
                          isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `U/O 2.5: ${odd.odds_name}`)}
                          onClick={() => addVirtualItem({
                            matchId: match.item_id,
                            selection: `U/O 2.5: ${odd.odds_name}`,
                            odds: odd.odds_val,
                            matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                          })}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* Correct Score (Market ID 7, 8, 9, 10) */}
                <Section title="Correct Score">
                  <div className="grid grid-cols-3 gap-1">
                    {[7, 8, 9].map(id => match.odds[id.toString()] && Object.values(match.odds[id.toString()].odds).map((odd) => (
                      <VirtualOdds 
                        key={odd.id} 
                        selection={odd.odds_name} 
                        odds={odd.odds_val.toString()} 
                        isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `CS: ${odd.odds_name}`)}
                        onClick={() => addVirtualItem({
                          matchId: match.item_id,
                          selection: `CS: ${odd.odds_name}`,
                          odds: odd.odds_val,
                          matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                        })}
                      />
                    )))}
                  </div>
                </Section>

                {/* BTTS - Full Time (Market ID 11) */}
                {match.odds["11"] && (
                  <Section title="BTTS: Full Time">
                    <div className="grid grid-cols-2 gap-1">
                      {Object.values(match.odds["11"].odds).map((odd) => (
                        <VirtualOdds 
                          key={odd.id} 
                          selection={odd.odds_name === "Goal-Goal" ? "YES" : "NO"} 
                          odds={odd.odds_val.toString()} 
                          isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `BTTS FT: ${odd.odds_name}`)}
                          onClick={() => addVirtualItem({
                            matchId: match.item_id,
                            selection: `BTTS FT: ${odd.odds_name}`,
                            odds: odd.odds_val,
                            matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                          })}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* BTTS - 1st Half (Market ID 12) */}
                {match.odds["12"] && (
                  <Section title="BTTS: 1st Half">
                    <div className="grid grid-cols-2 gap-1">
                      {Object.values(match.odds["12"].odds).map((odd) => (
                        <VirtualOdds 
                          key={odd.id} 
                          selection={odd.odds_name === "Goal-Goal" ? "YES" : "NO"} 
                          odds={odd.odds_val.toString()} 
                          isActive={virtualItems.some(i => i.matchId === match.item_id && i.selection === `BTTS HT: ${odd.odds_name}`)}
                          onClick={() => addVirtualItem({
                            matchId: match.item_id,
                            selection: `BTTS HT: ${odd.odds_name}`,
                            odds: odd.odds_val,
                            matchInfo: { homeTeam: match.home, awayTeam: match.away, league: match.item_league, startTime: match.item_time }
                          })}
                        />
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 flex flex-col h-full overflow-hidden">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-lg shrink-0">
            <div className="grid grid-cols-2 p-1 gap-1">
              <Button size="sm" onClick={() => setActiveView("stream")} className={cn("font-black text-[9px] h-7 rounded-lg transition-all", activeView === "stream" ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:bg-secondary/50")}>STREAM</Button>
              <Button size="sm" onClick={() => setActiveView("tracker")} className={cn("font-black text-[9px] h-7 rounded-lg transition-all", activeView === "tracker" ? "bg-primary text-primary-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:bg-secondary/50")}>TRACKER</Button>
            </div>
            <div className="relative group border-y border-border/30 bg-black overflow-hidden flex flex-col" style={{ width: "100%", height: "240px" }}>
              {activeView === "stream" ? (
                <iframe src="https://zweb4ug.com/forteugvideo/index.php" className="absolute inset-0 border-0 w-full h-full" title="Virtual Livestream" scrolling="no" />
              ) : (
                <iframe src="https://zweb4ug.com/forteug/index.php" className="w-full h-full border-0" title="Tracker" />
              )}
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-lg p-3 space-y-3 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">BET SLIP • VIRTUAL</h3>
              {virtualItems.length > 0 && (
                <button onClick={clearVirtual} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>

            {virtualItems.length === 0 ? (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
                <span className="text-2xl opacity-40">🎫</span>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Your Ticket is empty</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 gap-3">
                <div className="flex-1 overflow-auto space-y-2 pr-1">
                  {virtualItems.map((item) => (
                    <div key={`${item.matchId}-${item.selection}`} className="bg-secondary/20 border border-border/50 rounded-lg p-2 relative group animate-in slide-in-from-right-2">
                      <button onClick={() => removeVirtualItem(item.matchId, item.selection)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><X className="w-2.5 h-2.5" /></button>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-primary font-black text-[9px] uppercase leading-none">{item.selection}</span>
                        <span className="text-foreground font-mono font-bold text-[9px]">@{item.odds.toFixed(2)}</span>
                      </div>
                      <div className="text-[8px] font-bold text-muted-foreground uppercase truncate">{item.matchInfo.homeTeam} vs {item.matchInfo.awayTeam}</div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border/50 space-y-2 shrink-0">
                  <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground uppercase">
                    <span>Total Odds</span>
                    <span className="text-foreground font-mono">{totalOdds.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-muted-foreground uppercase">Stake</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground">{currency === 'UGX' ? 'Sh' : '$'}</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={inputVirtualStakeStr}
                        onFocus={() => {
                          if (inputVirtualStakeStr === '0') setInputVirtualStakeStr('');
                        }}
                        onChange={(e) => {
                          let v = String(e.target.value || '');
                          v = v.replace(/[^0-9]/g, '');
                          v = v.replace(/^0+(?=\d)/, '');
                          setInputVirtualStakeStr(v);
                          if (v !== '') setVirtualStake(Number(v));
                        }}
                        onBlur={() => {
                          if (inputVirtualStakeStr === '') {
                            setInputVirtualStakeStr('0');
                            setVirtualStake(0);
                          }
                        }}
                        className="h-8 pl-6 text-[10px] font-black bg-secondary/10 border-border/50"
                        min={100}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-primary/5 rounded px-2 border border-primary/10">
                    <span className="text-[9px] font-black text-primary uppercase">Est. Return</span>
                    <span className="text-[11px] font-black text-primary">{formatCurrency(cappedPotentialReturn, currency)}</span>
                  </div>
                  <Button onClick={handlePlaceVirtualBet} className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">PLACE VIRTUAL BET</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Ticker */}
      <div className="mt-auto bg-card border-t border-border/50 px-4 py-2 flex items-center gap-4 shrink-0 overflow-hidden">
        <div className="bg-primary px-3 py-1 rounded text-[9px] font-black text-primary-foreground italic shrink-0">RESULTS</div>
        <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
          {results.length > 0 ? results.map((res) => (
            <div key={res.id} className="flex items-center gap-2 text-[9px] font-bold">
              <span className="text-primary font-black">{res.daily_id}</span>
              <span className="text-muted-foreground uppercase">{res.home} vs {res.away}</span>
              <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-foreground font-mono">
                FT {res.result_ft.home}:{res.result_ft.away} (HT {res.result_ht.home}:{res.result_ht.away})
              </span>
            </div>
          )) : <span className="text-[9px] font-bold text-muted-foreground uppercase">Loading results...</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h5 className="text-[8px] font-black text-muted-foreground uppercase tracking-widest text-center">{title}</h5>
      {children}
    </div>
  );
}

function VirtualOdds({ selection, odds, isActive, onClick }: { selection: string, odds: string, isActive?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all group",
        isActive 
          ? "bg-primary border-primary shadow-lg shadow-primary/20 scale-[0.98]" 
          : "bg-secondary/30 border-border/20 hover:border-primary/50 hover:bg-primary/5"
      )}
    >
      <span className={cn("text-[8px] font-bold uppercase transition-colors", isActive ? "text-primary-foreground/80" : "text-muted-foreground group-hover:text-primary")}>{selection}</span>
      <span className={cn("text-[10px] font-black transition-colors", isActive ? "text-primary-foreground" : "text-foreground group-hover:text-primary")}>{odds}</span>
    </button>
  );
}
