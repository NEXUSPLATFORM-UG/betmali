
import type { Match, League, Sport, Bet } from "@shared/schema";

export interface IStorage {
  // Sports & Leagues
  getSports(): Promise<Sport[]>;
  getLeagues(): Promise<League[]>;
  
  // Matches
  getMatches(filters?: { isLive?: boolean, isHighlight?: boolean, leagueId?: string }): Promise<(Match & { league: League })[]>;
  getMatch(id: string): Promise<Match | undefined>;
  
  // Bets
  createBet(bet: any): Promise<Bet>;
  getBets(): Promise<(Bet & { match: Match })[]>;
}

export class DatabaseStorage implements IStorage {
  private apiUrl = 'https://betmaster.com/api/feed/sr/matches/main/upcoming?sport_id=sr%3Asport%3A1&markets_set=main_extended&market=other';
  private liveMatchesUrl = 'https://betmaster.com/api/feed/sr/matches/sport/live?sport_id=sr%3Asport%3A1&markets_set=main_extended&market=other';
  
  // Tournament IDs organized by country
  private tournaments = {
    england: [
      { id: '663', name: 'Premier League' },
      { id: '113', name: 'Championship' },
      { id: '3102', name: 'EFL Cup' },
      { id: '2232', name: 'FA Cup' },
      { id: '26', name: 'League One' },
      { id: '116', name: 'League Two' },
      { id: '2458', name: 'National League' },
    ],
    spain: [
      { id: '626', name: 'LaLiga' },
      { id: '627', name: 'LaLiga 2' },
      { id: '3293', name: 'Super Copa' },
      { id: '14337', name: 'U19 Division de Honor Juvenil' },
    ],
    germany: [
      { id: '599', name: 'Bundesliga' },
      { id: '437', name: 'Bundesliga 2' },
      { id: '2496', name: 'DFB-Pokal' },
    ],
    italy: [
      { id: '576', name: 'Serie A' },
      { id: '574', name: 'Coppa Italia' },
    ],
    france: [
      { id: '424', name: 'Ligue 1' },
      { id: '2325', name: 'Ligue 2' },
    ],
    champions: [
      { id: '2244', name: 'Champions League' },
      { id: '2246', name: 'Europa League' },
    ]
  };

  async getSports(): Promise<Sport[]> {
    return [{ id: '1', name: 'Soccer', slug: 'soccer' }];
  }

  async getLeagues(): Promise<League[]> {
    const leaguesMap = new Map<string, League>();
    
    // Country mapping with flags
    const countryMap: Record<string, { name: string; flag: string; isPopular: boolean }> = {
      england: { name: 'England', flag: 'GB', isPopular: true },
      spain: { name: 'Spain', flag: 'ES', isPopular: true },
      germany: { name: 'Germany', flag: 'DE', isPopular: true },
      italy: { name: 'Italy', flag: 'IT', isPopular: true },
      france: { name: 'France', flag: 'FR', isPopular: true },
      champions: { name: 'International', flag: 'UN', isPopular: true },
    };

    // Add all tournaments from local config (these have verified endpoints)
    Object.entries(this.tournaments).forEach(([countryKey, tournamentList]) => {
      const countryInfo = countryMap[countryKey];
      if (countryInfo) {
        tournamentList.forEach((tournament) => {
          leaguesMap.set(tournament.id, {
            id: tournament.id,
            sportId: '1',
            name: tournament.name,
            country: countryInfo.name,
            isPopular: countryInfo.isPopular,
            flag: countryInfo.flag
          });
        });
      }
    });

    return Array.from(leaguesMap.values());
  }

  async getMatches(filters?: { isLive?: boolean, isHighlight?: boolean, leagueId?: string, league?: string }): Promise<(Match & { league: League })[]> {
    let apiUrl = this.apiUrl;
    if (filters?.isLive) apiUrl = this.liveMatchesUrl;
    
    // If a specific league/tournament ID is requested, fetch from that tournament
    if (filters?.league) {
      const tournamentId = filters.league;
      apiUrl = `https://betmaster.com/api/feed/sr/matches/sport/in-tournament?markets_set=main_extended&tournament_id=${tournamentId}&market=other`;
    }

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`API responded with status: ${response.status}`);
      const data = await response.json();
      
      if (!data.matches) return [];

      let matches = data.matches.filter((m: any) => {
        // Only include matches with valid tournament data
        return m?.info_static?.tournament?.id;
      }).map((m: any) => {
        const tournament = m.info_static.tournament;
        const league: League = {
          id: tournament.id.toString(),
          sportId: '1',
          name: tournament.name?.en || tournament.name || 'Unknown',
          country: m.info_static?.category?.name?.en || 'International',
          isPopular: tournament.tags?.includes('top') || false,
          flag: ''
        };
        
        const match: Match = {
          id: m.id.toString(),
          leagueId: league.id,
          homeTeam: m.info_static?.competitor_home?.name?.en || 'Home Team',
          awayTeam: m.info_static?.competitor_away?.name?.en || 'Away Team',
          homeLogo: m.info_static?.competitor_home?.logo_url || '',
          awayLogo: m.info_static?.competitor_away?.logo_url || '',
          startTime: new Date(m.info_static.start_time),
          status: m.info_dynamic?.event_status === 0 ? 'upcoming' : 'live',
          homeScore: m.info_dynamic?.score?.home || 0,
          awayScore: m.info_dynamic?.score?.away || 0,
          currentMinute: m.info_dynamic?.clock?.match_time || '',
          odds1: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['1']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['1']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['1']?.o || '',
          oddsX: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['2']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['2']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['2']?.o || '',
          odds2: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['3']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['3']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['3']?.o || '',
          handicapValue: m.odds?.sr1?.['3']?.['16']?.sp ? Object.keys(m.odds.sr1['3']['16'].sp)[0].replace('hcp=', '') : '',
          oddsHandicap1: m.odds?.sr1?.['3']?.['16']?.sp ? (Object.values(m.odds.sr1['3']['16'].sp)[0] as any).out['1714']?.o : '',
          oddsHandicap2: m.odds?.sr1?.['3']?.['16']?.sp ? (Object.values(m.odds.sr1['3']['16'].sp)[0] as any).out['1715']?.o : '',
          totalValue: m.odds?.sr1?.['3']?.['18']?.sp ? Object.keys(m.odds.sr1['3']['18'].sp)[0].replace('total=', '') : '',
          oddsOver: m.odds?.sr1?.['3']?.['18']?.sp ? (Object.values(m.odds.sr1['3']['18'].sp)[0] as any).out['12']?.o : '',
          oddsUnder: m.odds?.sr1?.['3']?.['18']?.sp ? (Object.values(m.odds.sr1['3']['18'].sp)[0] as any).out['13']?.o : '',
          allOdds: m.odds,
          isHighlight: false
        };
        return { ...match, league };
      });

      if (filters?.isLive) {
        matches = matches.filter((m: any) => m.status === 'live');
      }

      return matches;
    } catch (err) {
      console.error('Error in getMatches:', err);
      return [];
    }
  }

  async getMatch(id: string): Promise<Match | undefined> {
    try {
      const response = await fetch(`https://betmaster.com/api/feed/sr/matches/${id}`);
      const data = await response.json();
      if (!data.match) return undefined;
      
      const m = data.match;
      const match: Match = {
        id: m.id.toString(),
        leagueId: m.info_static.tournament.id.toString(),
        homeTeam: m.info_static.competitor_home.name.en,
        awayTeam: m.info_static.competitor_away.name.en,
        homeLogo: m.info_static.competitor_home.logo_url || '',
        awayLogo: m.info_static.competitor_away.logo_url || '',
        startTime: new Date(m.info_static.start_time),
        status: m.info_dynamic.event_status === 0 ? 'upcoming' : 'live',
        homeScore: m.info_dynamic.score?.home || 0,
        awayScore: m.info_dynamic.score?.away || 0,
        currentMinute: m.info_dynamic.clock?.match_time || '',
        odds1: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['1']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['1']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['1']?.o || '',
        oddsX: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['2']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['2']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['2']?.o || '',
        odds2: m.odds?.sr1?.['1']?.['1']?.sp?._?.out?.['3']?.o || m.odds?.sr1?.['3']?.['1']?.sp?._?.out?.['3']?.o || m.odds?.sr1?.['2']?.['1']?.sp?._?.out?.['3']?.o || '',
        handicapValue: m.odds?.sr1?.['3']?.['16']?.sp ? Object.keys(m.odds.sr1['3']['16'].sp)[0].replace('hcp=', '') : '',
        oddsHandicap1: m.odds?.sr1?.['3']?.['16']?.sp ? (Object.values(m.odds.sr1['3']['16'].sp)[0] as any).out['1714']?.o : '',
        oddsHandicap2: m.odds?.sr1?.['3']?.['16']?.sp ? (Object.values(m.odds.sr1['3']['16'].sp)[0] as any).out['1715']?.o : '',
        totalValue: m.odds?.sr1?.['3']?.['18']?.sp ? Object.keys(m.odds.sr1['3']['18'].sp)[0].replace('total=', '') : '',
        oddsOver: m.odds?.sr1?.['3']?.['18']?.sp ? (Object.values(m.odds.sr1['3']['18'].sp)[0] as any).out['12']?.o : '',
        oddsUnder: m.odds?.sr1?.['3']?.['18']?.sp ? (Object.values(m.odds.sr1['3']['18'].sp)[0] as any).out['13']?.o : '',
        allOdds: m.odds,
        isHighlight: false
      };
      return match;
    } catch (err) {
      console.error(`Error fetching match ${id}:`, err);
      return undefined;
    }
  }

  async createBet(insertBet: any): Promise<Bet> {
    const betId = `bet-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const MAX_RETURN = 1000000000; // 1 billion UGX cap
    const stakeNum = parseFloat(insertBet.stake) || 0;
    const oddsNum = parseFloat(insertBet.odds) || 0;
    const calculated = stakeNum * oddsNum;
    const capped = Math.min(calculated, MAX_RETURN);

    const bet = { 
      ...insertBet, 
      id: betId, 
      createdAt: new Date().toISOString(),
      status: 'pending',
      potentialReturn: capped
    } as any;
    
    // In-memory mock storage for demo
    if (!(global as any).tempBets) (global as any).tempBets = [];
    (global as any).tempBets.push(bet);
    
    return bet;
  }

  async getBets(): Promise<(Bet & { match: Match })[]> {
    return (global as any).tempBets || [];
  }
}

export const storage = new DatabaseStorage();
