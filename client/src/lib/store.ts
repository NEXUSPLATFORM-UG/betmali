import { create } from 'zustand';

export interface BetslipItem {
  matchId: number;
  selection: string; // '1', 'X', '2', 'Over', 'Under', etc.
  odds: number;
  matchInfo: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    startTime: string;
  };
}

interface BetslipState {
  items: BetslipItem[];
  virtualItems: BetslipItem[];
  recentItems: BetslipItem[];
  liveItems: BetslipItem[];
  stake: number;
  virtualStake: number;
  addItem: (item: BetslipItem, isLive?: boolean) => void;
  addVirtualItem: (item: BetslipItem) => void;
  addRecentItem: (item: BetslipItem) => void;
  removeItem: (matchId: number, selection: string, type?: 'regular' | 'live' | 'recent') => void;
  removeVirtualItem: (matchId: number, selection: string) => void;
  clear: (type?: 'regular' | 'live' | 'recent') => void;
  clearVirtual: () => void;
  setStake: (stake: number) => void;
  setVirtualStake: (stake: number) => void;
  isOpen: boolean;
  toggleOpen: () => void;
}

export const useBetslip = create<BetslipState>((set) => ({
  items: [],
  virtualItems: [],
  recentItems: JSON.parse(localStorage.getItem('recentBets') || '[]'),
  liveItems: [],
  stake: 1000,
  virtualStake: 1000,
  isOpen: true,
  addItem: (item, isLive) => set((state) => {
    const listKey = isLive ? 'liveItems' : 'items';
    const exists = state[listKey].find((i) => i.matchId === item.matchId && i.selection === item.selection);
    if (exists) return state;
    const filteredItems = state[listKey].filter((i) => i.matchId !== item.matchId);
    
    // Also add to recent if not already there
    const recentExists = state.recentItems.find(i => i.matchId === item.matchId && i.selection === item.selection);
    let newRecent = state.recentItems;
    if (!recentExists) {
      newRecent = [item, ...state.recentItems.filter(i => i.matchId !== item.matchId)].slice(0, 10);
      localStorage.setItem('recentBets', JSON.stringify(newRecent));
    }

    return { 
      [listKey]: [...filteredItems, item], 
      recentItems: newRecent,
      isOpen: true 
    };
  }),
  addVirtualItem: (item) => set((state) => {
    const exists = state.virtualItems.find((i) => i.matchId === item.matchId && i.selection === item.selection);
    if (exists) return state;
    const filteredItems = state.virtualItems.filter((i) => i.matchId !== item.matchId);
    return { virtualItems: [...filteredItems, item] };
  }),
  addRecentItem: (item) => set((state) => {
    const exists = state.recentItems.find((i) => i.matchId === item.matchId && i.selection === item.selection);
    if (exists) return state;
    const newRecent = [item, ...state.recentItems.filter(i => i.matchId !== item.matchId)].slice(0, 10);
    localStorage.setItem('recentBets', JSON.stringify(newRecent));
    return { recentItems: newRecent };
  }),
  removeItem: (matchId, selection, type = 'regular') => set((state) => {
    const listKey = type === 'live' ? 'liveItems' : type === 'recent' ? 'recentItems' : 'items';
    const newItems = state[listKey].filter((i) => !(i.matchId === matchId && i.selection === selection));
    if (type === 'recent') {
      localStorage.setItem('recentBets', JSON.stringify(newItems));
    }
    return { [listKey]: newItems };
  }),
  removeVirtualItem: (matchId, selection) => set((state) => ({
    virtualItems: state.virtualItems.filter((i) => !(i.matchId === matchId && i.selection === selection)),
  })),
  clear: (type = 'regular') => set((state) => {
    const listKey = type === 'live' ? 'liveItems' : type === 'recent' ? 'recentItems' : 'items';
    if (type === 'recent') localStorage.removeItem('recentBets');
    return { [listKey]: [] };
  }),
  clearVirtual: () => set({ virtualItems: [] }),
  setStake: (stake) => set({ stake }),
  setVirtualStake: (stake) => set({ virtualStake: stake }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
}));

export interface AuthUser {
  uid: string;
  email: string;
  phone: string;
  balance: number;
  lockedReferral?: number;
}

interface AuthState {
  user: AuthUser | null;
  currency: string;
  loading: boolean;
  notifications: any[];
  setUser: (user: AuthUser | null) => void;
  setCurrency: (currency: string) => void;
  setLoading: (loading: boolean) => void;
  setNotifications: (notifications: any[]) => void;
  updateBalance: (amount: number) => void;
  addToBalance: (amount: number) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  currency: 'UGX',
  loading: false,
  notifications: [],
  setUser: (user) => {
    if (!user) {
      localStorage.clear();
      sessionStorage.clear();
    }
    set({ user });
  },
  setCurrency: (currency) => set({ currency }),
  setLoading: (loading) => set({ loading }),
  setNotifications: (notifications) => set({ notifications }),
  updateBalance: (amount) => set((state) => {
    if (state.user) {
      // We'll handle the Firebase update in the component where this is called
      // or we can refactor this to be async, but for now let's keep it simple
      return { user: { ...state.user, balance: amount } };
    }
    return state;
  }),
  addToBalance: (amount) => set((state) => {
    if (state.user) {
      return { user: { ...state.user, balance: state.user.balance + amount } };
    }
    return state;
  }),
}));
