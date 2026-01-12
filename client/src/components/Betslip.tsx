import { useBetslip, useAuth } from "@/lib/store";
import { useCreateBet } from "@/hooks/use-bets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { database } from "@/lib/firebase";
import { ref, set, get } from "firebase/database";

export function Betslip({ initialTab }: { initialTab?: 'betslip' | 'recent' | 'live' | 'virtual' }) {
  const { items, virtualItems, liveItems, recentItems, stake, virtualStake, setStake, setVirtualStake, removeItem, removeVirtualItem, addItem, clear, clearVirtual } = useBetslip();
  const [activeTab, setActiveTab] = useState<'betslip' | 'recent' | 'live' | 'virtual'>(initialTab || 'betslip');
  const createBet = useCreateBet();
  const { toast } = useToast();
  const { user, currency, addToBalance } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentItems = activeTab === 'betslip' ? items : 
                      activeTab === 'live' ? liveItems : 
                      activeTab === 'recent' ? recentItems : 
                      virtualItems;

  const currentStake = activeTab === 'virtual' ? virtualStake : stake;
  const totalOdds = currentItems.reduce((acc, item) => acc * item.odds, 1);
  const potentialReturn = currentStake * totalOdds;
  const MAX_RETURN = 1000000000; // 1 billion UGX cap for display and submission
  const cappedPotentialReturn = Math.min(potentialReturn, MAX_RETURN);

  const handlePlaceBet = async () => {
    if (currentItems.length === 0 || !user) {
      toast({ title: "Error", description: "Please log in first", variant: "destructive" });
      return;
    }

    if (currentStake < 100) {
      toast({ title: "Error", description: "Minimum stake is 100 UGX", variant: "destructive" });
      return;
    }

    if (currentStake > 10000000) {
      toast({ title: "Error", description: "Maximum stake is 10,000,000 UGX", variant: "destructive" });
      return;
    }

    if (currentStake > user.balance) {
      toast({ title: "Error", description: "Insufficient balance", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const ticketId = "TICKET-" + Date.now().toString().slice(-6);
      const now = Date.now();
      const ticketData = {
        id: ticketId,
        type: activeTab === 'virtual' ? 'virtual' : 'sportsbook',
        stake: currentStake,
        totalOdds: totalOdds,
        potentialReturn: cappedPotentialReturn,
        status: 'pending',
        createdAt: now,
        items: currentItems.map(item => ({
          matchId: item.matchId,
          selection: item.selection,
          odds: item.odds,
          homeTeam: item.matchInfo?.homeTeam || (activeTab === 'virtual' ? "Virtual Team A" : "Unknown"),
          awayTeam: item.matchInfo?.awayTeam || (activeTab === 'virtual' ? "Virtual Team B" : "Unknown"),
          status: 'pending'
        }))
      };

      const path = activeTab === 'virtual' ? `users/${user.uid}/virtualTickets` : `users/${user.uid}/tickets`;
      const ticketRef = ref(database, `${path}/${ticketId}`);
      await set(ticketRef, ticketData);
      
      const newBalance = user.balance - currentStake;
      await set(ref(database, `users/${user.uid}/balance`), newBalance);
      addToBalance(-currentStake);
      
      toast({
        title: "Ticket Placed!",
        description: `Ticket ID: ${ticketId}`,
        className: activeTab === 'virtual' ? "bg-blue-600 text-white" : "bg-green-600 text-white",
      });

      // Emit a local UI event so dashboards can immediately show the new ticket on top
      try {
        window.dispatchEvent(new CustomEvent('new-ticket', { detail: { ticket: ticketData } }));
      } catch (e) {
        /* ignore */
      }

      if (activeTab === 'virtual') clearVirtual();
      else clear(activeTab === 'betslip' ? 'regular' : activeTab === 'live' ? 'live' : 'recent');
    } catch (error) {
      console.error('Final placement error:', error);
      toast({
        title: "Error",
        description: "There was a problem placing your bet. Please check your dashboard history.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Local string state for stake input to avoid leading-zero UX issues
  const [inputStakeStr, setInputStakeStr] = useState(String(currentStake ?? ''));

  useEffect(() => {
    setInputStakeStr(String(currentStake ?? ''));
  }, [currentStake]);

  const formatSelection = (it: any) => {
    const sel = String(it.selection || '');
    const odds = Number(it.odds || 0);
    if (/^(HT:|FT:|U\/O|BTTS|CS:)/i.test(sel)) {
      return `${sel} @ ${odds.toFixed(2)}`;
    }
    return `FT: ${sel} @ ${odds.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Tabs */}
      <div className="flex border-b border-border/50 shrink-0">
        {[
          { id: 'betslip', label: 'BETSLIP', count: items.length },
          { id: 'virtual', label: 'VIRTUAL', count: virtualItems.length },
          { id: 'recent', label: 'RECENT', count: recentItems.length },
          { id: 'live', label: 'LIVE', count: liveItems.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 text-[10px] font-bold transition-all relative ${
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1 bg-primary/20 text-primary rounded-sm text-[8px]">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {currentItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-[9px] p-4">
          <span className="text-2xl mb-2">🎫</span>
          <p className="font-medium">Your {activeTab} is empty</p>
          <p className="text-[8px] opacity-60 mt-0.5">Select odds to start</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="p-2 border-b border-border/50 bg-secondary/20 flex justify-between items-center shrink-0 text-[9px]">
            <div className="flex items-center gap-1.5">
              <div className="bg-primary/20 text-primary w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold">
                {currentItems.length}
              </div>
              <span className="font-bold">
                {activeTab === 'recent' ? 'Previous Selections' : activeTab === 'virtual' ? 'Virtual Bet' : 'Combo Bet'}
              </span>
            </div>
            <button 
              onClick={() => {
                if (activeTab === 'virtual') clearVirtual();
                else clear(activeTab === 'betslip' ? 'regular' : activeTab === 'live' ? 'live' : 'recent');
              }}
              className="text-muted-foreground hover:text-destructive flex items-center gap-0.5 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>

          {/* Bet Items */}
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-2 space-y-2">
                {currentItems.map((item) => {
                  const display = formatSelection(item);

                  return (
                    <div key={`${item.matchId}-${item.selection}`} className="relative bg-secondary/30 rounded-lg p-2 border border-border/50 hover:border-primary/30 transition-colors group text-[9px]">
                      <button
                        onClick={() => {
                          if (activeTab === 'virtual') removeVirtualItem(item.matchId, item.selection);
                          else removeItem(item.matchId, item.selection, activeTab === 'betslip' ? 'regular' : activeTab === 'live' ? 'live' : 'recent');
                        }}
                        className="absolute top-1 right-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="pr-5">
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="text-primary font-bold text-[9px]">{display}</span>
                        </div>
                        <div className="text-[8px] text-foreground/90 font-medium truncate">
                          {item.matchInfo.homeTeam} vs {item.matchInfo.awayTeam}
                        </div>
                        {activeTab === 'recent' && (
                          <button 
                            onClick={() => addItem(item, false)}
                            className="mt-1 text-primary hover:text-primary/80 font-bold uppercase text-[7px] tracking-wider"
                          >
                            REUSE SELECTION
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-3 bg-secondary/10 border-t border-border/50 space-y-3 shrink-0 text-[9px]">
            <div className="space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Total odds</span>
                <span className="font-mono font-bold text-foreground">{totalOdds.toFixed(3)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stake</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[8px]">{currency === 'UGX' ? 'Sh' : '$'}</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={inputStakeStr}
                      onFocus={() => {
                        if (inputStakeStr === '0') setInputStakeStr('');
                      }}
                      onChange={(e) => {
                        // Keep only digits, strip leading zeros while typing
                        let v = String(e.target.value || '');
                        v = v.replace(/[^0-9]/g, '');
                        v = v.replace(/^0+(?=\d)/, '');
                        setInputStakeStr(v);
                        if (v !== '') {
                          const n = Number(v);
                          if (activeTab === 'virtual') setVirtualStake(n);
                          else setStake(n);
                        }
                      }}
                      onBlur={() => {
                        if (inputStakeStr === '') {
                          setInputStakeStr('0');
                          if (activeTab === 'virtual') setVirtualStake(0);
                          else setStake(0);
                        }
                      }}
                      className="h-7 pl-8 text-left font-mono text-[8px] bg-background border-border"
                      min={100}
                      max={10000000}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between text-accent font-bold pt-1 text-[9px]">
                <span>Poss. return</span>
                <span>{formatCurrency(cappedPotentialReturn, currency)}</span>
              </div>
            </div>

            <Button
              onClick={handlePlaceBet}
              disabled={isSubmitting}
              className={`w-full font-bold h-10 text-[10px] uppercase tracking-wider shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                activeTab === 'virtual' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'
              }`}
            >
              {isSubmitting ? "PLACING..." : activeTab === 'recent' ? "PLACE AGAIN" : "PLACE BET"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
