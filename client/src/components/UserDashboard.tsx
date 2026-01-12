import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { Wallet, History, Settings, TrendingUp, ShoppingBag, User as UserIcon, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { auth, database } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { ref, get, set, update as updateDb } from "firebase/database";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

function TicketItem({ ticket, currency, onCashout }: {
  ticket: any,
  currency: string,
  onCashout?: (id: string, value: number) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ticketStatus, setTicketStatus] = useState(ticket.status);
  const [items, setItems] = useState(ticket.items);

  const wonCount = items.filter((i: any) => i.status === 'won').length;
  const lostCount = items.filter((i: any) => i.status === 'lost').length;
  const totalCount = items.length;
  const progress = wonCount / totalCount;
  
  let cashoutValue = 0;
  let canCashout = lostCount === 0 && ticketStatus === 'pending';
  
  if (canCashout) {
    if (progress >= 0.9) cashoutValue = Math.floor(ticket.potentialReturn * 0.5);
    else if (wonCount > 0) cashoutValue = Math.floor(ticket.stake * 1.01);
    else canCashout = false;
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      if (ticketStatus !== 'pending') {
        clearInterval(interval);
        return;
      }

      try {
        const updatedItems = [...items];
        let hasChanged = false;
        let hasLost = false;

        for (let i = 0; i < updatedItems.length; i++) {
          if (updatedItems[i].status === 'pending') {
            const res = await fetch(`/api/matches/${updatedItems[i].matchId}`);
            if (res.ok) {
              const match = await res.json();
              if (match.status === 'finished') {
                const isWin = Math.random() > 0.5; 
                updatedItems[i].status = isWin ? 'won' : 'lost';
                hasChanged = true;
                if (!isWin) hasLost = true;
              }
            }
          }
        }

        if (hasChanged) {
          setItems(updatedItems);
          if (hasLost) setTicketStatus('lost');
          else if (updatedItems.every((i: any) => i.status === 'won')) setTicketStatus('won');
        }
      } catch (e) {
        console.error("Status check failed", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [items, ticketStatus]);

  return (
    <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-secondary/5 transition-colors group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold group-hover:text-primary transition-colors">{ticket.id}</span>
            <span className="text-[8px] text-muted-foreground">{new Date(ticket.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-2 py-0.5 rounded text-[8px] font-bold",
              ticketStatus === 'pending' ? "bg-yellow-500/10 text-yellow-500" : 
              ticketStatus === 'won' ? "bg-green-500/10 text-green-500" : 
              ticketStatus === 'cashed_out' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
            )}>
              {ticketStatus.toUpperCase()}
            </span>
            {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-secondary/5">
          <div className="space-y-2">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[9px] py-1 border-b border-border/30 last:border-0">
                <div className="flex flex-col">
                  <span className="font-bold">{item.homeTeam} vs {item.awayTeam}</span>
                  <span className="text-muted-foreground">{(function formatSelection(it:any){
                    const sel = String(it.selection || '');
                    const odds = Number(it.odds || 0);
                    if (/^(HT:|FT:|U\/O|BTTS|CS:)/i.test(sel)) return `${sel} @ ${odds.toFixed(2)}`;
                    return `FT: ${sel} @ ${odds.toFixed(2)}`;
                  })(item)}</span>
                </div>
                <span className={cn(
                  "px-1.5 py-0.5 rounded font-bold text-[8px]",
                  item.status === 'pending' ? "bg-yellow-500/10 text-yellow-500" : 
                  item.status === 'won' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                )}>
                  {item.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          
          <div className="pt-2 border-t border-border/30 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[8px] text-muted-foreground uppercase font-bold">Stake</span>
              <span className="text-[10px] font-bold">{formatCurrency(ticket.stake, currency)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-muted-foreground uppercase font-bold">Est. Return</span>
              <span className="text-primary font-black text-[11px]">{formatCurrency(ticket.potentialReturn, currency)}</span>
            </div>
          </div>

          {canCashout && onCashout && (
            <div className="pt-3 mt-1 border-t border-primary/20 space-y-2">
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCashout(ticket.id, cashoutValue);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-[10px] uppercase"
              >
                CASHOUT {formatCurrency(cashoutValue, currency)}
              </Button>
              {/* Allow users to delete a pending ticket before settlement */}
              <Button
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  // Dispatch a custom event so parent can handle deletion (keeps component decoupled)
                  const evt = new CustomEvent('delete-ticket', { detail: { ticketId: ticket.id } });
                  window.dispatchEvent(evt);
                }}
                className="w-full text-destructive border border-destructive/20 hover:bg-destructive/5 h-8 text-[10px] font-bold"
              >
                DELETE TICKET
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UserDashboard() {
  const { user, addToBalance, currency } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("wallet");
  const [betFilter, setBetFilter] = useState<'ACTIVE' | 'COMPLETED' | 'CASHED OUT'>('ACTIVE');
  const [tickets, setTickets] = useState<any[]>([]);
  const [virtualTickets, setVirtualTickets] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Derived withdraw validity for button disabling
  const withdrawAmountNum = parseFloat(withdrawAmount || '0');
  const withdrawFee = withdrawAmountNum * 0.10;
  const withdrawFinalDeduction = withdrawAmountNum > 0 ? withdrawAmountNum + withdrawFee : 0;
  const lockedReferralAmount = (user?.lockedReferral as number) || 0;
  const withdrawableBalance = (user?.balance || 0) - lockedReferralAmount;
  const isWithdrawAmountValid = !isNaN(withdrawAmountNum) && withdrawAmountNum >= 1000;
  const isWithdrawDisabled = loading || !isWithdrawAmountValid || withdrawFinalDeduction > withdrawableBalance;

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const ticketsRef = ref(database, `users/${user.uid}/tickets`);
        const snapshot = await get(ticketsRef);
        if (snapshot.exists()) {
          const vals = Object.values(snapshot.val() || {});
          vals.sort((a: any, b: any) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
          setTickets(vals as any[]);
        }

        const vTicketsRef = ref(database, `users/${user.uid}/virtualTickets`);
        const vSnapshot = await get(vTicketsRef);
        if (vSnapshot.exists()) {
          const vvals = Object.values(vSnapshot.val() || {});
          vvals.sort((a: any, b: any) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
          setVirtualTickets(vvals as any[]);
        }

        const offersRef = ref(database, `users/${user.uid}/offers`);
        const offersSnapshot = await get(offersRef);
        
        let existingOffers: any[] = [];
        if (offersSnapshot.exists()) {
          existingOffers = Object.values(offersSnapshot.val() || {});
        }

        // Always ensure referral offer exists in the list
        const defaultReferral = { 
          id: "OFFER-REFER", 
          title: "Refer & Earn", 
          description: "Invite friends and get 500 UGX for each successful referral", 
          value: 500, 
          claimed: false, 
          progress: 0, 
          isReferral: true 
        };

        const hasReferral = existingOffers.some((o: any) => o.id === "OFFER-REFER" || o.isReferral);
        
        if (!hasReferral) {
          setOffers([defaultReferral, ...existingOffers.filter((o: any) => o.id !== "OFFER-1" && o.id !== "OFFER-2")]);
        } else {
          setOffers(existingOffers.filter((o: any) => o.id !== "OFFER-1" && o.id !== "OFFER-2"));
        }
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Listen for new-ticket events so newly placed tickets appear on top immediately
  useEffect(() => {
    const handler = (e: any) => {
      if (!user) return;
      const ticket = e?.detail?.ticket;
      if (!ticket) return;
      if (ticket.type === 'virtual' || String(ticket.id || '').startsWith('V-')) {
        setVirtualTickets(prev => [ticket, ...prev.filter(t => t.id !== ticket.id)]);
      } else {
        setTickets(prev => [ticket, ...prev.filter(t => t.id !== ticket.id)]);
      }
    };
    window.addEventListener('new-ticket', handler as EventListener);
    return () => window.removeEventListener('new-ticket', handler as EventListener);
  }, [user]);

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/');
    } catch (e) {
      console.error("Logout failed", e);
      window.location.replace('/');
    }
  };

  // Handle delete-ticket custom events emitted from TicketItem
  useEffect(() => {
    const handler = async (e: any) => {
      if (!user) return;
      const ticketId = e?.detail?.ticketId;
      if (!ticketId) return;
      const confirmDelete = window.confirm('Are you sure you want to delete this pending ticket? This cannot be undone.');
      if (!confirmDelete) return;
      try {
        // Remove ticket from user's tickets in RTDB
        await updateDb(ref(database), { [`users/${user.uid}/tickets/${ticketId}`]: null });
        setTickets(prev => prev.filter(t => t.id !== ticketId));
        toast({ title: 'Ticket deleted', description: 'Your pending ticket was removed.' });
      } catch (err) {
        console.error('Delete ticket failed', err);
        toast({ title: 'Delete failed', description: 'Could not delete ticket. Please try again.', variant: 'destructive' });
      }
    };
    window.addEventListener('delete-ticket', handler as EventListener);
    return () => window.removeEventListener('delete-ticket', handler as EventListener);
  }, [user]);

  const handleCashout = async (ticketId: string, value: number) => {
    if (!user) return;
    try {
      const ticketRef = ref(database, `users/${user.uid}/tickets/${ticketId}`);
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        await set(ticketRef, { ...ticket, status: 'cashed_out' });
        const newBalance = user.balance + value;
        await set(ref(database, `users/${user.uid}/balance`), newBalance);
        addToBalance(value);
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'cashed_out' } : t));
      }
    } catch (e) {
      console.error("Cashout failed", e);
    }
  };

  const handleClaimOffer = async (offerId: string) => {
    if (!user) return;
    const offer = offers.find(o => o.id === offerId);
    if (!offer || offer.claimed) return;
    const newBalance = user.balance + offer.value;
    await set(ref(database, `users/${user.uid}/balance`), newBalance);
    addToBalance(offer.value);
    setOffers(prev => prev.map(o => o.id === offerId ? { ...o, claimed: true } : o));
    await set(ref(database, `users/${user.uid}/offers/${offerId}/claimed`), true);
  };

  const handleDeposit = async () => {
    if (!user) return;
    if (!phoneNumber || phoneNumber.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please enter a phone number",
        variant: "destructive"
      });
      return;
    }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    try {
      // Ensure phone number starts with +256
      let formattedPhone = phoneNumber.trim().replace(/\s+/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+256' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
      
      console.log("Starting deposit for:", formattedPhone, "amount:", amount);
      // Step 1: Validate Phone
      const valRes = await fetch("/api/livra/validate-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: formattedPhone })
      });
      
      const valData = await valRes.json();
      if (!valRes.ok || valData.error) {
        throw new Error(valData.message || valData.error || "Phone validation failed");
      }

      // Step 2: Request Deposit
      const depRes = await fetch("/api/livra/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: formattedPhone,
          amount: amount,
          description: `Deposit for ${user.email}`
        })
      });

      const depData = await depRes.json();
      console.log("Deposit response:", depData);
      if (!depRes.ok || !depData.internal_reference) {
        throw new Error(depData.message || depData.error || "Deposit request failed");
      }

      toast({
        title: "Deposit Initiated",
        description: "Please check your phone to confirm the mobile money payment.",
      });

      // Step 3: Poll for status
      const pollStatus = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/livra/request-status?internal_reference=${depData.internal_reference}`);
          const statusData = await statusRes.json();
          console.log("Poll status:", statusData);
          
          // Check for success: The user provided logs show status: 'success' and success: true
          if (statusData.status === 'success' || statusData.status === 'SUCCESSFUL' || statusData.status === 'COMPLETED') {
            clearInterval(pollStatus);
            const newBalance = user.balance + amount;
            await set(ref(database, `users/${user.uid}/balance`), newBalance);
            
            // Referral Deposit Commission (2%)
            const userDataSnapshot = await get(ref(database, `users/${user.uid}`));
            const userData = userDataSnapshot.val();
            if (userData && userData.referredBy) {
              const referrerId = userData.referredBy;
              const referrerRef = ref(database, `users/${referrerId}`);
              const referrerSnapshot = await get(referrerRef);
              if (referrerSnapshot.exists()) {
                const rData = referrerSnapshot.val();
                const commission = Math.floor(amount * 0.02);
                const newReferrerBalance = (rData.balance || 0) + commission;
                
                await updateDb(ref(database), {
                  [`users/${referrerId}/balance`]: newReferrerBalance,
                  [`users/${referrerId}/notifications/${Date.now()}`]: {
                    title: "Deposit Commission!",
                    message: `You earned ${commission} UGX (2%) from your referral's deposit`,
                    timestamp: Date.now(),
                    read: false
                  }
                });
              }
            }

            addToBalance(amount);
            setDepositAmount("");
            setLoading(false);
            toast({
              title: "Deposit Successful",
              description: `Successfully deposited ${formatCurrency(amount, currency)}!`,
            });
          } else if (statusData.status === 'FAILED' || statusData.success === false) {
            clearInterval(pollStatus);
            setLoading(false);
            
            let errorMsg = "Deposit failed";
            if (statusData.message) {
              if (statusData.message.toLowerCase().includes("low balance") || statusData.message.toLowerCase().includes("insufficient")) {
                errorMsg = "Your account balance is low. Please top up your mobile money.";
              } else {
                errorMsg = statusData.message;
              }
            }
            toast({
              title: "Deposit Failed",
              description: errorMsg,
              variant: "destructive"
            });
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 5000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        if (pollStatus) {
          clearInterval(pollStatus);
          if (loading) {
            setLoading(false);
            toast({
              title: "Deposit Timeout",
              description: "Deposit timed out. Please check your mobile money and try again if the payment was not made.",
              variant: "destructive"
            });
          }
        }
      }, 120000);

    } catch (e: any) {
      console.error("Deposit process failed", e);
      toast({
        title: "Deposit Failed",
        description: e.message || "Deposit failed. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const handleWithdrawAll = async () => {
    if (!user) return;
    const amount = parseFloat(withdrawAmount);
    const minWithdraw = 1000;
    const feePercent = 0.10;
    
    if (isNaN(amount) || amount < minWithdraw) {
      toast({
        title: "Invalid Amount",
        description: `Minimum withdrawal is ${formatCurrency(minWithdraw, currency)}`,
        variant: "destructive"
      });
      return;
    }

    const lockedReferral = (user.lockedReferral as number) || 0;
    const availableForWithdrawal = user.balance - lockedReferral;

    if (amount > availableForWithdrawal) {
      toast({
        title: "Insufficient Withdrawable Balance",
        description: lockedReferral > 0 ? `You have ${formatCurrency(lockedReferral, currency)} locked (referral bonus). Withdrawable: ${formatCurrency(availableForWithdrawal, currency)}` : "You cannot withdraw more than your current balance",
        variant: "destructive"
      });
      return;
    }

    if (!phoneNumber || phoneNumber.trim() === "") {
      toast({
        title: "Missing Information",
        description: "Please enter a phone number",
        variant: "destructive"
      });
      return;
    }

    // Validate amounts & available funds before any network call
    const fee = amount * feePercent;
    const finalDeduction = amount + fee;

    if (finalDeduction > availableForWithdrawal) {
      toast({
        title: "Insufficient Withdrawable Balance",
        description: lockedReferral > 0 ? `You have ${formatCurrency(lockedReferral, currency)} locked (referral bonus). Withdrawable: ${formatCurrency(availableForWithdrawal, currency)}` : "You cannot withdraw more than your current balance",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Format phone
      let formattedPhone = phoneNumber.trim().replace(/\s+/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+256' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      // Get ID token for authenticated server-side validation
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not authenticated');

      // Call server endpoint which will validate auth, check balance and locked funds,
      // reserve the amount and forward to payment backend if valid.
      const res = await fetch('/api/livra/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ msisdn: formattedPhone, amount })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Withdrawal failed');
      }

      // Server performed reservation and completed withdrawal. Server returns updated balance.
      if (typeof data.newBalance === 'number') {
        await set(ref(database, `users/${user.uid}/balance`), data.newBalance);
        addToBalance(data.newBalance - user.balance);
      } else {
        // Fallback: deduct locally (should be consistent with server)
        const newBalance = user.balance - finalDeduction;
        await set(ref(database, `users/${user.uid}/balance`), newBalance);
        addToBalance(-finalDeduction);
      }

      setWithdrawAmount('');
      setLoading(false);
      toast({ title: 'Withdrawal Successful', description: `Successfully withdrawn ${formatCurrency(amount, currency)}. Fee: ${formatCurrency(fee, currency)}` });
    } catch (e: any) {
      console.error('Withdrawal failed', e);
      toast({ title: 'Withdrawal Failed', description: e.message || 'Something went wrong', variant: 'destructive' });
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (betFilter === 'ACTIVE') return t.status === 'pending';
    if (betFilter === 'COMPLETED') return t.status === 'won' || t.status === 'lost';
    if (betFilter === 'CASHED OUT') return t.status === 'cashed_out';
    return true;
  });

  const tabs = [
    { id: "wallet", label: "Wallet", icon: Wallet },
    { id: "bets", label: "My Bets", icon: History },
    { id: "virtual", label: "Virtual Bet", icon: TrendingUp },
    { id: "orders", label: "My Offer", icon: ShoppingBag },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  if (!user) return null;

  return (
    <Sheet>
      <div className="flex items-center gap-1">
        <SheetTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 text-primary hover:bg-primary/5 pr-1 sm:pr-4" data-dashboard-trigger>
            <UserIcon className="w-4 h-4" />
            <span className="hidden sm:inline font-bold text-xs">{user.email?.split('@')[0]}</span>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
              {formatCurrency(user.balance, currency)}
            </span>
          </Button>
        </SheetTrigger>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="sm:hidden w-6 h-6 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center p-0"
            onClick={() => setActiveTab("wallet")}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </SheetTrigger>
      </div>
      <SheetContent className="w-[400px] sm:w-[540px] bg-card border-l-primary/20">
        <SheetHeader className="border-b border-border/50 pb-4 mb-4">
          <SheetTitle className="flex items-center gap-2 text-primary">
            <UserIcon className="w-5 h-5" />
            User Dashboard
          </SheetTitle>
        </SheetHeader>

        <div className="flex gap-4 h-[calc(100vh-120px)]">
          <div className="w-20 sm:w-32 flex flex-col gap-1 border-r border-border/50 pr-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'settings') {
                    navigate('/settings');
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg text-[10px] font-medium transition-colors ${
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
            <div className="mt-auto pt-4">
              <Button variant="outline" size="sm" onClick={logout} className="w-full text-[10px] border-destructive/50 text-destructive hover:bg-destructive/10">
                Logout
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto pr-2">
            {activeTab === "wallet" && (
              <div className="space-y-4">
                <div className="bg-secondary/10 p-3 rounded-lg border border-primary/10">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Balance</h3>
                  <div className="text-xl font-black text-primary">{formatCurrency(user.balance, currency)}</div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-primary uppercase tracking-widest px-1">Deposit Funds</h4>
                    <div className="bg-card border border-border/50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between py-1.5 px-2 bg-secondary/20 rounded border border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center font-black text-white text-[8px] border border-black/10 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <span className="relative z-10 text-[#004F71]">M</span>
                            <span className="relative z-10 text-[#ED1C24] -ml-0.5">M</span>
                          </div>
                          <span className="text-[9px] font-bold">Mobile Money</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Amount</label>
                          <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="h-7 text-[10px]" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Phone</label>
                          <Input placeholder="256 XXX XXX XXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-7 text-[10px]" />
                        </div>
                        <Button 
                          onClick={handleDeposit} 
                          disabled={loading}
                          size="sm" 
                          className="w-full h-8 text-[10px] font-black uppercase"
                        >
                          {loading ? "Processing..." : "Deposit Now"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-destructive uppercase tracking-widest px-1">Cash Out</h4>
                    <div className="bg-card border border-border/50 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between py-1.5 px-2 bg-secondary/20 rounded border border-border/30">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#FFCC00] flex items-center justify-center font-black text-white text-[8px] border border-black/10 shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                            <span className="relative z-10 text-[#004F71]">M</span>
                            <span className="relative z-10 text-[#ED1C24] -ml-0.5">M</span>
                          </div>
                          <span className="text-[9px] font-bold">Mobile Money</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Amount</label>
                          <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="h-7 text-[10px]" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Phone Number</label>
                          <Input placeholder="256 XXX XXX XXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-7 text-[10px]" />
                        </div>
                        <Button 
                          onClick={handleWithdrawAll} 
                          disabled={isWithdrawDisabled}
                          variant="outline" 
                          size="sm" 
                          className="w-full h-8 text-[10px] font-black uppercase border-destructive/50 text-destructive hover:bg-destructive/10"
                          title={isWithdrawDisabled ? (withdrawFinalDeduction > withdrawableBalance ? `Insufficient withdrawable funds. Locked: ${formatCurrency(lockedReferralAmount, currency)}` : 'Enter a valid amount (min UGX 1,000)') : undefined}
                        >
                          {loading ? "Processing..." : "Withdraw Funds"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "bets" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-secondary/20 p-1 rounded-lg">
                  {['ACTIVE', 'COMPLETED', 'CASHED OUT'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBetFilter(filter as any)}
                      className={`flex-1 py-1.5 text-[9px] font-bold rounded-md transition-colors ${
                        betFilter === filter ? 'bg-background shadow-sm' : 'hover:bg-background/50 text-muted-foreground'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {filteredTickets.length === 0 ? (
                    <div className="text-[9px] text-center py-8 text-muted-foreground/40 italic bg-secondary/5 rounded-lg border border-dashed border-border/50">No {betFilter.toLowerCase()} tickets found</div>
                  ) : (
                    filteredTickets.map(ticket => <TicketItem key={ticket.id} ticket={ticket} currency={currency} onCashout={handleCashout} />)
                  )}
                </div>
              </div>
            )}

            {activeTab === "virtual" && (
              <div className="space-y-4">
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Virtual Betting</h3>
                </div>
                <div className="space-y-2">
                  {virtualTickets.length === 0 ? (
                    <div className="text-[9px] text-center py-6 text-muted-foreground/40 italic bg-secondary/5 rounded-lg border border-dashed border-border/50">No virtual tickets found</div>
                  ) : (
                    virtualTickets.map((ticket) => <TicketItem key={ticket.id} ticket={ticket} currency={currency} />)
                  )}
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className="space-y-4">
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 flex items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-black text-primary uppercase">Offers Center</h4>
                    <p className="text-[8px] text-muted-foreground">Boost your balance</p>
                  </div>
                  <ShoppingBag className="w-5 h-5 text-primary opacity-50" />
                </div>
                <div className="space-y-3">
                  {offers.map((offer: any) => (
                    <div key={offer.id} className="bg-card border border-border/50 p-3 rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="text-[10px] font-bold">{offer.title}</h5>
                          <p className="text-[8px] text-muted-foreground">{offer.description}</p>
                        </div>
                        <span className="text-primary font-bold text-[10px]">{formatCurrency(offer.value, currency)}</span>
                      </div>
                      {offer.isReferral ? (
                        <div className="space-y-2">
                          <div className="bg-secondary/20 p-2 rounded text-[8px] font-mono break-all border border-border/30">
                            {window.location.origin}/?ref={user.uid}
                          </div>
                          <Button 
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/?ref=${user.uid}`);
                              toast({ title: "Referral link copied!" });
                            }} 
                            size="sm" 
                            className="w-full h-7 text-[9px] font-bold uppercase"
                          >
                            Copy Link
                          </Button>
                        </div>
                      ) : (
                        <Button onClick={() => handleClaimOffer(offer.id)} disabled={offer.claimed} size="sm" className="w-full h-7 text-[9px] font-bold uppercase">{offer.claimed ? "Claimed" : "Claim Now"}</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
