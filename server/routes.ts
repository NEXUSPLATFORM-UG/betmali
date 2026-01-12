import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import admin from 'firebase-admin';

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Local helper to retry transient network errors for proxy endpoints
  // Improved retry with exponential backoff + jitter and longer default timeouts.
  async function fetchWithRetry(url: string, attempts = 5, baseDelayMs = 500, timeoutMs = 20000) {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
          if (res.status < 500) throw lastErr;
          throw lastErr;
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (i < attempts - 1) {
          // exponential backoff with small random jitter
          const backoff = baseDelayMs * Math.pow(2, i);
          const jitter = Math.floor(Math.random() * 200);
          await new Promise((r) => setTimeout(r, backoff + jitter));
        }
      }
    }
    throw lastErr;
  }

  // Simple in-memory cache of the last successful Betika snapshot so the API can
  // return a recent snapshot when the upstream is temporarily unreachable.
  // Note: this is intentionally minimal — it's a fallback for developer UX.
  let lastSuccessfulBetikaSnapshot: any = null;
  
  // Virtual Soccer Proxy
  app.get("/api/proxy/virtual-offer", async (_req, res) => {
    try {
      const response = await fetch("https://www.fortebet.ug/api/web/v1/virtual-soccer/offer");
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch virtual offer" });
    }
  });

  // Proxy for Betika live matches to avoid CORS from the browser
  app.get('/api/proxy/betika-live', async (req, res) => {
    try {
      // Support client hints: includeAllCategories=true to request all sub_type
      // categories, and filter=real to remove SR/ESPORT matches from the response.
      const params = new URLSearchParams(req.query as Record<string, string>);
      const includeAll = params.get('includeAllCategories') === 'true';
      const filterReal = params.get('filter') === 'real';
      // Remove our internal hints from the forwarded query
      params.delete('includeAllCategories');
      params.delete('filter');

      // If client didn't request all categories, ensure a reasonable default
      if (!includeAll && !params.has('sub_type_id')) {
        params.set('sub_type_id', '1,186,340');
      }

      const target = `https://live-ug.betika.com/v1/uo/matches?${params.toString()}`;
      let data: any;
      try {
        data = await fetchWithRetry(target);
        // cache the last successful snapshot for fallback
        lastSuccessfulBetikaSnapshot = { fetchedAt: Date.now(), payload: data };
      } catch (e) {
        console.error('Error fetching betika-live (upstream):', e);
        // If we have a last successful snapshot, return it as a graceful fallback.
        if (lastSuccessfulBetikaSnapshot) {
          console.warn('Returning last successful Betika snapshot due to upstream error');
          let payload = lastSuccessfulBetikaSnapshot.payload;
          if (filterReal) payload = filterSnapshotToReal(payload);
          return res.json({ _fallback: true, fetchedAt: lastSuccessfulBetikaSnapshot.fetchedAt, data: payload });
        }
        throw e;
      }

      // Apply server-side filtering for `filter=real` if requested
      if (filterReal) data = filterSnapshotToReal(data);

      res.json(data);
    } catch (err) {
      console.error('Error proxying betika-live:', err);
      res.status(500).json({ message: 'Failed to fetch betika live matches' });
    }
  });

  // Debug endpoint to retrieve last successful Betika snapshot cached in memory
  app.get('/api/debug/live-snapshot', async (_req, res) => {
    try {
      if (lastSuccessfulBetikaSnapshot) return res.json(lastSuccessfulBetikaSnapshot);
      return res.status(404).json({ message: 'No snapshot cached yet' });
    } catch (err) {
      console.error('debug live-snapshot error:', err);
      res.status(500).json({ message: 'Failed to read debug snapshot' });
    }
  });

  // Helper used above to strip out SR/Esport matches from the Betika payload
  function filterSnapshotToReal(raw: any) {
    try {
      let matches: any[] = [];
      if (Array.isArray(raw.matches)) matches = raw.matches.slice();
      else if (raw.data && Array.isArray(raw.data.matches)) matches = raw.data.matches.slice();
      else if (Array.isArray(raw.data)) matches = raw.data.slice();

      const filtered = matches.filter((m: any) => {
        // Many payloads use numeric 0/1 flags for is_srl/is_esport
        return !(m.is_srl === 1 || m.is_esport === 1);
      });

      // Reconstruct same shape as upstream where possible
      if (Array.isArray(raw.matches)) return { ...raw, matches: filtered };
      if (raw.data && Array.isArray(raw.data.matches)) return { ...raw, data: { ...raw.data, matches: filtered } };
      if (Array.isArray(raw.data)) return { ...raw, data: filtered };
      return { ...raw };
    } catch (e) {
      console.warn('filterSnapshotToReal failed:', e);
      return raw;
    }
  }

  app.get("/api/proxy/virtual-timing", async (_req, res) => {
    try {
      const response = await fetch("https://zweb4ug.com/forteugvideo/api.php/timing");
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch virtual timing" });
    }
  });

  // Sports
  app.get(api.sports.list.path, async (_req, res) => {
    const data = await storage.getSports();
    res.json(data);
  });

  // Leagues
  app.get(api.leagues.list.path, async (_req, res) => {
    const data = await storage.getLeagues();
    res.json(data);
  });

  // Matches
  app.get(api.matches.list.path, async (req, res) => {
    const isLive = req.query.isLive === 'true';
    const isHighlight = req.query.isHighlight === 'true';
    const league = req.query.league as string;
    const data = await storage.getMatches({ isLive, isHighlight, league });
    res.json(data);
  });

  app.get(api.matches.get.path, async (req, res) => {
    const match = await storage.getMatch(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  });

  app.get("/api/counters", async (_req, res) => {
    try {
      const response = await fetch('https://betmaster.com/api/feed/sr/matches/counters?market=other');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching counters:', error);
      res.status(500).json({ error: 'Failed to fetch counters' });
    }
  });

  app.get("/api/proxy/location", async (_req, res) => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch location' });
    }
  });

  // Livra Uganda Payment Integration
  app.post("/api/livra/deposit", async (req, res) => {
    try {
      const response = await fetch("https://api.livrauganda.workers.dev/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Deposit request failed" });
    }
  });

  app.post("/api/livra/validate-phone", async (req, res) => {
    try {
      const response = await fetch("https://api.livrauganda.workers.dev/api/validate-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Phone validation failed" });
    }
  });

  app.get("/api/livra/request-status", async (req, res) => {
    try {
      const { internal_reference } = req.query;
      const response = await fetch(`https://api.livrauganda.workers.dev/api/request-status?internal_reference=${internal_reference}`);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Status check failed" });
    }
  });

  app.post("/api/livra/withdraw", async (req, res) => {
    // Server-side: authenticate, validate fund availability (respect lockedReferral), reserve funds,
    // forward to external payment provider, then finalize or revert reservation depending on result.
    try {
      // Expect Authorization: Bearer <idToken>
      const authHeader = String(req.headers.authorization || '');
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match) return res.status(401).json({ message: 'Missing Authorization token' });
      const idToken = match[1];

      let decoded: any;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (e) {
        return res.status(401).json({ message: 'Invalid auth token' });
      }

      const uid = decoded.uid;
      const { msisdn, amount } = req.body as { msisdn?: string; amount?: number };
      if (!msisdn || !amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid request body' });
      }

      // Read user snapshot (atomic reservation will use transaction)
      const userRef = admin.database().ref(`users/${uid}`);
      const userSnap = await userRef.get();
      if (!userSnap.exists()) return res.status(404).json({ message: 'User not found' });
      const userData = userSnap.val();
      const balance = Number(userData.balance || 0);
      const lockedReferral = Number(userData.lockedReferral || 0);
      const feePercent = 0.10;
      const fee = Math.floor(amount * feePercent);
      const finalDeduction = amount + fee;

      if ((balance - lockedReferral) < finalDeduction) {
        return res.status(400).json({ message: 'Insufficient withdrawable balance', lockedReferral, withdrawable: balance - lockedReferral });
      }

      // Reserve funds atomically: deduct from balance and mark pendingWithdrawal
      const txResult = await userRef.transaction((current) => {
        if (!current) return current;
        const curBal = Number(current.balance || 0);
        const curLocked = Number(current.lockedReferral || 0);
        if ((curBal - curLocked) < finalDeduction) return; // abort transaction
        const newPending = (Number(current.pendingWithdrawal || 0) || 0) + finalDeduction;
        return { ...current, balance: curBal - finalDeduction, pendingWithdrawal: newPending } as any;
      });

      if (!txResult.committed) {
        return res.status(409).json({ message: 'Could not reserve funds for withdrawal' });
      }

      // Forward to external payment provider
      let externalResp: any;
      try {
        const response = await fetch("https://api.livrauganda.workers.dev/api/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ msisdn, amount })
        });
        externalResp = await response.json();
        if (!response.ok || externalResp.status === 'error' || externalResp.success === false) {
          throw new Error(externalResp.message || 'External withdrawal failed');
        }
      } catch (e: any) {
        // Revert reservation
        try {
          await userRef.transaction((current) => {
            if (!current) return current;
            const curPending = Number(current.pendingWithdrawal || 0);
            const restore = curPending >= finalDeduction ? finalDeduction : finalDeduction;
            const newPending = Math.max(0, curPending - finalDeduction);
            const newBal = Number(current.balance || 0) + finalDeduction;
            return { ...current, balance: newBal, pendingWithdrawal: newPending } as any;
          });
        } catch (revertErr) {
          console.error('Failed to revert reservation after external failure', revertErr);
        }
        return res.status(502).json({ message: e.message || 'External withdrawal failed' });
      }

      // Finalize: subtract pendingWithdrawal and optionally record transaction
      try {
        await userRef.transaction((current) => {
          if (!current) return current;
          const curPending = Number(current.pendingWithdrawal || 0);
          const newPending = Math.max(0, curPending - finalDeduction);
          const updated = { ...current } as any;
          if (newPending === 0) delete updated.pendingWithdrawal;
          else updated.pendingWithdrawal = newPending;
          // keep balance as already deducted during reservation
          return updated;
        });
      } catch (e) {
        console.warn('Could not finalize pendingWithdrawal cleanup', e);
      }

      // Optionally add a notification
      try {
        const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await admin.database().ref(`users/${uid}/notifications/${notifId}`).set({
          title: 'Withdrawal Initiated',
          message: `Your withdrawal of ${amount} UGX has been processed. Fee: ${fee} UGX`,
          timestamp: Date.now(),
          read: false,
          type: 'withdrawal'
        });
      } catch (_) { /* ignore */ }

      // Return external provider response plus new balance
      const latestUserSnap = await userRef.get();
      const latest = latestUserSnap.val();
      return res.json({ ...(externalResp || {}), newBalance: Number(latest.balance || 0) });
    } catch (err) {
      console.error('Withdrawal request failed', err);
      res.status(500).json({ message: 'Withdrawal request failed' });
    }
  });

  // Bets
  app.post(api.bets.create.path, async (req, res) => {
    try {
      console.log('Received bet data:', req.body);
      const input = api.bets.create.input.parse(req.body);
      const bet = await storage.createBet(input);
      res.status(201).json(bet);
    } catch (err) {
      console.error('Bet creation error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.bets.list.path, async (_req, res) => {
    const bets = await storage.getBets();
    res.json(bets);
  });

  return httpServer;
}
