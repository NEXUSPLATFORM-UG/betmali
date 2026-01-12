import { type Database } from "firebase-admin/lib/database/database";

const LIVE_URL = "https://live-ug.betika.com/v1/uo/matches?page=1&limit=1000&sub_type_id=1,186,340&sport=3&sort=1";

export async function fetchAndStoreLiveMatches(db: Database) {
  // Small helper to retry transient network errors when calling Betika
  async function fetchWithRetry(url: string, attempts = 3, delayMs = 1000) {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
          // Do not retry on non-5xx errors
          if (res.status < 500) throw lastErr;
          throw lastErr;
        }
        const body = await res.json();
        return body;
      } catch (e) {
        lastErr = e;
        // Wait a bit before retrying
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw lastErr;
  }

  try {
    const json: any = await fetchWithRetry(LIVE_URL, 3, 800);

    // Persist full payload into a timestamped history node.
    // Use push() and store the raw JSON as a string to avoid Realtime DB key validation
    // errors when the payload contains object keys that are empty or contain forbidden chars.
    const ts = Date.now();
    try {
      await db.ref('live_matches_history').push({ payloadString: JSON.stringify(json), fetchedAt: ts });
    } catch (e) {
      console.warn('Failed to push live_matches_history as string, falling back to object set:', e);
      await db.ref(`live_matches_history/${ts}`).set({ payload: json, fetchedAt: ts });
    }

    // Normalize matches array location (many APIs use `matches` or `data.matches`)
    let matches: any[] = [];
    if (Array.isArray(json.matches)) matches = json.matches;
    else if (json.data && Array.isArray(json.data.matches)) matches = json.data.matches;
    else if (Array.isArray(json.data)) matches = json.data;

    if (matches.length === 0) {
      console.log(`fetchAndStoreLiveMatches: no matches found (fetchedAt=${ts})`);
      return 0;
    }

    // Instead of writing each match under a key derived from the payload
    // (which can contain invalid characters and cause RTDB failures), push
    // the entire matches array as a single timestamped snapshot. This avoids
    // invalid-key errors and preserves the raw payload for consumers.
    // To avoid Realtime DB key validation errors (payloads may contain
    // keys like '' or characters disallowed by RTDB), store the raw JSON
    // payload as a string. This guarantees writes succeed while preserving
    // the original data for later processing.
    try {
      await db.ref('live_matches_snapshots').push({ payloadString: JSON.stringify(json), fetchedAt: ts });
      console.log(`fetchAndStoreLiveMatches: pushed snapshot string (matches=${matches.length}) fetchedAt=${ts}`);
    } catch (e) {
      console.warn('Failed to push live matches snapshot as string, falling back to history set:', e);
      try {
        await db.ref(`live_matches_history/${ts}`).set({ payloadString: JSON.stringify(json), fetchedAt: ts });
      } catch (e2) {
        console.error('Failed to write live matches history fallback:', e2);
      }
    }

    return matches.length;
  } catch (err) {
    console.error("fetchAndStoreLiveMatches error:", err);
    return 0;
  }
}

export default fetchAndStoreLiveMatches;
