import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

function formatMatchMinute(raw: any, eventStatus?: any, currentScore?: any) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // If the provider uses a '90+3' style, show as "90+3'" (added time)
  if (/^\d+\+\d+$/.test(s)) return `${s}'`;

  // If it's a mm:ss string like '51:23' or '14:38', take the minutes part and add apostrophe
  if (/^\d+:\d{1,2}$/.test(s)) {
    const [mins, secs] = s.split(":");
    const m = parseInt(mins, 10);
    // If minute is zero but there are seconds and the eventStatus indicates a half/set/inning,
    // prefer a textual label instead of showing `0'`.
    if (m === 0) {
      const status = String(eventStatus || '').toLowerCase();
      if (/\b(1st|first|1st half|first half|1st set|first set)\b/.test(status)) return `1st`;
      if (/\b(2nd|second|2nd half|second half|2nd set|second set)\b/.test(status)) return `2nd`;
      if (/\b(ht|half-time|half time|half)\b/.test(status)) return `HT`;
      if (/\b(set|sets)\b/.test(status)) {
        const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*set/) || [])[1];
        if (num) return `${num}st`;
      }
      if (/\b(inning|innings)\b/.test(status)) {
        const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*(inning|innings)/) || [])[1];
        if (num) return `${num}th`;
      }
      // fallback to Live when seconds > 0 but minute is 0 and we know the match has a score
      const cs = String(currentScore || '').trim();
      if (cs && cs !== '-:-' && cs !== 'null') return 'Live';
      return `0'`;
    }

    return `${m}'`;
  }

  // If it's a plain number string, append apostrophe (but treat 0 specially)
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n === 0) {
      const status = String(eventStatus || '').toLowerCase();
      if (status.includes('1st') || status.includes('first') || status.includes('1st half') || status.includes('first half')) return `1st`;
      if (status.includes('2nd') || status.includes('second') || status.includes('2nd half') || status.includes('second half')) return `2nd`;
      if (status.includes('set')) {
        const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*set/) || [])[1];
        if (num) return `${num}st`;
      }
      if (status.includes('inning') || status.includes('innings')) {
        const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*(inning|innings)/) || [])[1];
        if (num) return `${num}th`;
      }
      const cs = String(currentScore || '').trim();
      if (cs && cs !== '-:-' && cs !== 'null') return 'Live';
      return `0'`;
    }
    return `${n}'`;
  }

  // If it contains a leading number, return that with apostrophe
  const m = s.match(/(\d+)/);
  if (m) return `${m[1]}'`;

  // Special-case: sometimes providers return '0' for match_time even when
  // the match is live (goals present, eventStatus indicates first/second half)
  // In those cases, infer a textual state from eventStatus and currentScore.
  const status = String(eventStatus || '').toLowerCase();
  const cs = String(currentScore || '').trim();
  if ((s === '0' || s === "0:0" || s === "0:00") && cs && cs !== '-:-' && cs !== 'null') {
    if (status.includes('ht') || status.includes('half-time') || status.includes('half time')) return `HT`;
    if (status.includes('1st') || status.includes('first')) return `1st`;
    if (status.includes('2nd') || status.includes('second')) return `2nd`;
    if (status.includes('set')) {
      const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*set/) || [])[1];
      if (num) return `${num}st`;
      return `Set`;
    }
    if (status.includes('inning') || status.includes('innings')) {
      const num = (status.match(/(\d+)(?:st|nd|rd|th)?\s*(inning|innings)/) || [])[1];
      if (num) return `${num}th`;
      return `Inning`;
    }
    if (status.includes('break') || status.includes('intermission') || status.includes('interval')) return `Break`;
    // fallback label when we know the score but no minute: mark as 'Live'
    return `Live`;
  }

  // Fallback: return the raw string
  return s;
}
type MatchesInput = z.infer<typeof api.matches.list.input>;

export function useMatches(filters?: MatchesInput & { league?: string | number | null }) {
  // Serialize filters to use as query key dependency
  const filterKey = JSON.stringify(filters);

  return useInfiniteQuery({
    queryKey: [api.matches.list.path, filterKey],
    queryFn: async ({ pageParam = 1 }) => {
      // If we're on the home page and looking for sports matches, use the Betika API
      const betikaSports = ["football", "basketball", "tennis", "cricket"];
      // Allow our special 'all-soccer' view to enter the Betika-fetch path
      if (!filters?.sport || betikaSports.includes(filters.sport) || filters?.sport === 'all-soccer') {
        let sportId = 3; // Default Football
        if (filters?.sport === "basketball") sportId = 6;
        else if (filters?.sport === "tennis") sportId = 1;
        else if (filters?.sport === "cricket") sportId = 21;

        // If the caller requested live matches, use Betika's live endpoint.
        // This ensures we get real-time live matches (status=live) instead
        // of the "upcoming" tab which would show 0 live items.
        let betikaData: any = null;
        if (filters?.isLive) {
          // Use server proxy to avoid CORS and ensure reliable responses from the browser
          const params = new URLSearchParams({
            page: String(pageParam),
            limit: '50',
            tab: 'live',
            sub_type_id: '1,186,340',
            sport_id: String(sportId),
            sort_id: '2',
            period_id: '9',
            esports: 'false'
          });
          if (filters?.league) params.set('competition_id', String(filters.league));
          const res = await fetch(`/api/proxy/betika-live?${params.toString()}`);
          if (!res.ok) throw new Error('Failed to fetch Betika live matches (proxy)');
          betikaData = await res.json();
        } else {
          // Support a special 'all-soccer' view which uses Betika's UO API
          // with the user's requested query parameters and paginates by page.
          if (filters?.sport === 'all-soccer') {
            let betikaUrl = `https://api-ug.betika.com/v1/uo/matches?page=${pageParam}&limit=10&tab=&sub_type_id=1,186,340&sport_id=3&sort_id=1&period_id=-1&esports=false`;
            if (filters?.league) {
              betikaUrl = `https://api-ug.betika.com/v1/uo/matches?page=${pageParam}&limit=10&tab=&sub_type_id=1,186,340&sport_id=3&competition_id=${filters.league}&sort_id=1&period_id=-1&esports=false`;
            }
            const res = await fetch(betikaUrl);
            if (!res.ok) throw new Error('Failed to fetch Betika matches for all-soccer');
            betikaData = await res.json();
          } else {
            let betikaUrl = `https://api-ug.betika.com/v1/uo/matches?page=${pageParam}&limit=10&tab=upcoming&sub_type_id=1,186,340&sport_id=${sportId}&sort_id=2&period_id=9&esports=false`;
            if (filters?.league) {
              betikaUrl = `https://api-ug.betika.com/v1/uo/matches?page=${pageParam}&limit=10&tab=upcoming&sub_type_id=1,186,340&sport_id=${sportId}&competition_id=${filters.league}&sort_id=2&period_id=9&esports=false`;
            }
            const res = await fetch(betikaUrl);
            if (!res.ok) throw new Error('Failed to fetch Betika matches');
            betikaData = await res.json();
          }
        }
        
      // Map Betika data format to our app's Match format
      // Betika responses may come in several shapes:
      // - top-level array
      // - { data: [...] }
      // - { data: { matches: [...] } }
      // - { matches: [...] }
      let rawList: any[] = [];
      if (betikaData) {
        if (Array.isArray(betikaData)) rawList = betikaData;
        else if (Array.isArray(betikaData.data)) rawList = betikaData.data;
        else if (Array.isArray(betikaData.data?.matches)) rawList = betikaData.data.matches;
        else if (Array.isArray(betikaData.matches)) rawList = betikaData.matches;
        else rawList = [];
      }

      const matches = (rawList || []).map((m: any) => ({
        id: parseInt(m.match_id || m.id || m.item_id),
        parentMatchId: m.parent_match_id,
        homeTeam: m.home_team || m.home_team_name || m.home_team_name_en,
        awayTeam: m.away_team || m.away_team_name || m.away_team_name_en,
        startTime: m.start_time || m.start,
        sportId: parseInt(m.sport_id || m.sport || '0'),
        leagueId: parseInt(m.competition_id || m.competition || '0'),
        // Normalize 1X2 odds from multiple possible provider shapes
        homeOdd: (function(){
          return m.home_odd || m.homeOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['1']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['1']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['1']?.o || '';
        })(),
        drawOdd: (function(){
          return m.neutral_odd || m.drawOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['2']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['2']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['2']?.o || '';
        })(),
        awayOdd: (function(){
          return m.away_odd || m.awayOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['3']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['3']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['3']?.o || '';
        })(),
        odds1: (function(){
          return m.home_odd || m.homeOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['1']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['1']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['1']?.o || '';
        })(),
        oddsX: (function(){
          return m.neutral_odd || m.drawOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['2']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['2']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['2']?.o || '';
        })(),
        odds2: (function(){
          return m.away_odd || m.awayOdd ||
            m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['3']?.o ||
            m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['3']?.o ||
            m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['3']?.o || '';
        })(),
        // Map various Betika live indicators to our app's 'live' status.
        status: (
          (m.status && String(m.status).toLowerCase() === 'live') ||
          String(m.match_status || '').toUpperCase() === 'ACTIVE' ||
          m.live_match_status === 1 ||
          String(m.event_status || '') === '1'
        ) ? 'live' : 'upcoming',
        // Many Betika responses include a `match_time` or `event_status` field
        // representing the current minute or state. Normalize to both raw and
        // a display string suitable for the UI (e.g. "51*" for stoppage).
        currentMinuteRaw: (m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? ''),
        currentMinuteDisplay: formatMatchMinute(
          (m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? ''),
          (m.event_status || m.match_status),
          m.current_score
        ),
        // Compute a display string for the score depending on sport and available fields
        scoreDisplay: (function() {
          const cs = String(m.current_score ?? '').trim();
          // Prefer a simple current_score when available
          if (cs && cs !== '-:-' && cs !== 'null' && cs !== 'null:null') {
            return cs.replace(':', '-');
          }
          // If set_score exists, join set scores (e.g. "7-5, 0-1")
          if (Array.isArray(m.set_score) && m.set_score.length) {
            try {
              return m.set_score.map((s: any) => String(s.score || '').replace(':', '-')).filter((x: string) => x).join(', ');
            } catch (e) {}
          }
          return '';
        })(),
        // Compute a human-friendly time / state label per sport
        timeLabel: (function() {
          const sportId = parseInt(m.sport_id || m.sport || '0');
          const ev = String(m.event_status || m.match_status || '').trim();
          // For Soccer (3) prefer minute display
          if (sportId === 3) return formatMatchMinute(m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? '', ev, m.current_score);
          // For ball sports like Basketball (6), Ice Hockey (14), Futsal (23), Baseball (15) prefer event_status if present
          if ([6,14,23,15].includes(sportId)) {
            if (ev) return ev;
            return formatMatchMinute(m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? '', ev, m.current_score);
          }
          // For racket/sets sports (Tennis 1, Volleyball 16, Table Tennis 4, Squash 22, Badminton 2) prefer event_status
          if ([1,16,4,22,2].includes(sportId)) {
            if (ev) return ev;
            return formatMatchMinute(m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? '', ev, m.current_score);
          }
          // Default fallback
          return formatMatchMinute(m.match_time ?? m.match_time_display ?? m.current_minute ?? m.event_time ?? '', ev, m.current_score);
        })(),
        isHighlight: false,
        country: m.category,
        league: {
          id: parseInt(m.competition_id || m.competition || '0'),
          name: m.competition_name || m.competition_name_en || m.competition_name || '',
          sportId: parseInt(m.sport_id || m.sport || '0')
        }
      }));

      return {
        matches: matches || [],
        // If API returns exactly the page size, assume there's a next page.
        nextPage: (matches?.length || 0) === 10 ? pageParam + 1 : undefined
      };
      }

      // Build query string from filters for other cases
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) params.append(key, String(value));
        });
      }
      params.append('page', String(pageParam));
      
      const url = `${api.matches.list.path}?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      const parsedMatches = api.matches.list.responses[200].parse(data);

      return {
        matches: parsedMatches,
        nextPage: parsedMatches.length === 10 ? pageParam + 1 : undefined
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    // Refresh more frequently for live matches (every 5s), less frequently for others (30s)
    refetchInterval: filters?.isLive ? 5000 : 30000,
  });
}

export function useMatch(id: number, parentMatchId?: string) {
  return useQuery({
    queryKey: [api.matches.get.path, id, parentMatchId],
    queryFn: async () => {
      // If we have a parentMatchId, fetch from Betika
      if (parentMatchId) {
        const betikaMatchUrl = `https://api-ug.betika.com/v1/uo/match?parent_match_id=${parentMatchId}`;
        const res = await fetch(betikaMatchUrl);
        if (!res.ok) throw new Error("Failed to fetch Betika match details");
        const matchJson = await res.json();

        // Return the odds data structure from Betika
        return {
          id,
          odds: matchJson.data || []
        };
      }

      const url = buildUrl(api.matches.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch match");
      return api.matches.get.responses[200].parse(await res.json());
    },
    enabled: !!id || !!parentMatchId
  });
}
