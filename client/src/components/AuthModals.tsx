import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";
import { auth, database } from "@/lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set, get, query, orderByChild, equalTo, onValue, off, update as updateDb } from "firebase/database";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Wallet, History, Zap, Gift, Settings as SettingsIcon, Bell } from "lucide-react";

export function AuthModals() {
  const { user, setUser, setLoading, setNotifications, notifications } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = ref(database, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setUser({ 
            ...userData, 
            uid: firebaseUser.uid,
            balance: typeof userData.balance === 'number' ? userData.balance : 1000
          });

          // Listen for notifications
          const notifRef = ref(database, `users/${firebaseUser.uid}/notifications`);
          onValue(notifRef, (notifSnapshot) => {
            if (notifSnapshot.exists()) {
              const data = notifSnapshot.val();
              const notifList = Object.entries(data).map(([id, val]: [string, any]) => ({ id, ...val }));
              setNotifications(notifList.sort((a, b) => b.timestamp - a.timestamp));
              
              // Show toast for new unread notifications
              const unread = notifList.filter(n => !n.read);
              if (unread.length > 0) {
                const latest = unread[0];
                if (Date.now() - latest.timestamp < 5000) {
                  toast({
                    title: latest.title,
                    description: latest.message,
                  });
                }
              }
            }
          });
        }
      } else {
        setUser(null);
        setNotifications([]);
      }
    });
    return () => {
      unsubscribe();
      if (user) off(ref(database, `users/${user.uid}/notifications`));
    };
  }, [setUser, setNotifications]);

  const handlePhoneChange = async (val: string) => {
    setPhoneNumber(val);
    if (val.length >= 9) {
      setIsVerifying(true);
      setIsVerified(false);
      
      // Strict phone check for registration
      if (!isLogin) {
        try {
          const usersRef = ref(database, 'users');
          const phoneQuery = query(usersRef, orderByChild('phone'), equalTo(val));
          const snapshot = await get(phoneQuery);
          
          if (snapshot.exists()) {
            toast({ 
              title: "Error", 
              description: "This phone number is already linked to an account", 
              variant: "destructive" 
            });
            setIsVerified(false);
            setIsVerifying(false);
            return;
          }
        } catch (err) {
          console.error("Phone check error:", err);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsVerified(true);
      setIsVerifying(false);
    } else {
      setIsVerified(false);
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (isLogin) {
      if (!phoneNumber || !password) {
        toast({ title: "Error", description: "Please enter phone and password", variant: "destructive" });
        return;
      }
    } else {
      if (!isVerified || !email || !phoneNumber || !password) {
        toast({ title: "Error", description: "Please fill all fields correctly", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);
    setLoading(true);
    try {
      if (isLogin) {
        const usersRef = ref(database, 'users');
        const phoneQuery = query(usersRef, orderByChild('phone'), equalTo(phoneNumber));
        const snapshot = await get(phoneQuery);
        
        if (!snapshot.exists()) {
          throw new Error("Phone number not registered");
        }
        
        // Correctly extract the first matching user's email
        const users = snapshot.val();
        const userUid = Object.keys(users)[0];
        const userData = users[userUid];
        
        if (!userData.email) {
          throw new Error("Account data corruption: missing email");
        }

        await signInWithEmailAndPassword(auth, userData.email, password);
      } else {
        // Referral check
        const urlParams = new URLSearchParams(window.location.search);
        const referrerId = urlParams.get('ref');

        // Double check phone uniqueness right before creation
        const usersRef = ref(database, 'users');
        const phoneQuery = query(usersRef, orderByChild('phone'), equalTo(phoneNumber));
        const phoneSnapshot = await get(phoneQuery);
        
        if (phoneSnapshot.exists()) {
          throw new Error("This phone number is already registered with another account");
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;
        
        const userData = {
          email,
          phone: phoneNumber,
          balance: 1000,
          createdAt: new Date().toISOString(),
          referredBy: referrerId || null
        };

        await set(ref(database, `users/${firebaseUser.uid}`), userData);

        // If referred, reward the referrer
        if (referrerId) {
          const referrerRef = ref(database, `users/${referrerId}`);
          const referrerSnapshot = await get(referrerRef);
          if (referrerSnapshot.exists()) {
            const rData = referrerSnapshot.val();
            const currentBalance = rData.balance || 0;
            const currentLocked = rData.lockedReferral || 0;
            const bonusAmount = 500;
            const newReferrerBalance = currentBalance + bonusAmount;
            const newLocked = currentLocked + bonusAmount;

            // Update balance, mark the referral amount as locked (non-withdrawable), and add notification
            await updateDb(ref(database), {
              [`users/${referrerId}/balance`]: newReferrerBalance,
              [`users/${referrerId}/lockedReferral`]: newLocked,
              [`users/${referrerId}/notifications/${Date.now()}`]: {
                title: "Referral Bonus!",
                message: `You earned ${bonusAmount} UGX for referring ${email}. The bonus is locked until you place a bet and win.`,
                timestamp: Date.now(),
                read: false
              }
            });
          }
        }
      }
      setIsOpen(false);
      toast({ title: isLogin ? "Welcome back!" : "Account created successfully!" });
    } catch (error: any) {
      console.error("Auth error:", error);
      // Map common Firebase auth error codes to friendlier messages
      const code = error?.code || '';
      const badLoginCodes = new Set(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email']);
      const description = badLoginCodes.has(code) ? 'Wrong information' : (error?.message || 'Authentication error');
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all state immediately before signing out
      setUser(null);
      setNotifications([]);
      localStorage.clear();
      sessionStorage.clear();
      
      await signOut(auth);
      
      // Force a full page reload and clear browser history state
      window.location.replace('/');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const updates: Record<string, any> = {};
    notifications.forEach(n => {
      if (!n.read) updates[`users/${user.uid}/notifications/${n.id}/read`] = true;
    });
    if (Object.keys(updates).length > 0) {
      await updateDb(ref(database), updates);
    }
  };

  const [, navigate] = useLocation();
  const unreadCount = notifications.filter(n => !n.read).length;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu onOpenChange={(open) => open && markAllAsRead()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative p-2">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-auto">
            <div className="p-2 border-b border-border/50 font-bold text-[10px] uppercase tracking-wider text-muted-foreground flex justify-between items-center">
              Notifications
              {unreadCount > 0 && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[8px]">{unreadCount} New</span>}
            </div>
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground uppercase italic">No notifications</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <DropdownMenuItem key={n.id} className={cn("flex flex-col items-start gap-0.5 p-3 border-b border-border/30 last:border-0", !n.read && "bg-primary/5")}>
                  <div className="font-bold text-[10px] text-primary">{n.title}</div>
                  <div className="text-[9px] text-foreground/80 leading-tight">{n.message}</div>
                  <div className="text-[8px] text-muted-foreground mt-1">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs">
              <Wallet className="w-3 h-3" />
              <span className="font-bold">{user.phone || user.email}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/my-bets')} className="cursor-pointer">
              <History className="w-4 h-4 mr-2" />
              My Bets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/virtual-bets')} className="cursor-pointer">
              <Zap className="w-4 h-4 mr-2" />
              Virtual Bets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/my-offers')} className="cursor-pointer">
              <Gift className="w-4 h-4 mr-2" />
              My Offers
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <SettingsIcon className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500">
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-primary hover:text-primary/80 font-bold text-xs" data-auth-trigger>
          LOGIN / REGISTER
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] bg-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold text-primary">
            {isLogin ? "Welcome Back" : "Create Account"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <div className="relative">
              <Input
                id="phoneNumber"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={cn(
                  "bg-secondary/20 pr-10",
                  isVerified && "border-green-500 ring-green-500/20"
                )}
              />
              {isVerifying && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {isVerified && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold text-xs animate-in zoom-in duration-300">
                  ✓
                </div>
              )}
            </div>
            {isVerified && (
              <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">
                ACTIVE
              </p>
            )}
          </div>
          
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary/20"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/20" 
            />
          </div>
          <Button type="submit" disabled={(isLogin ? !phoneNumber : !isVerified) || isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
            {isSubmitting ? "Processing..." : isLogin ? "LOGIN" : "REGISTER"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setIsVerified(false);
                setPhoneNumber("");
                setEmail("");
              }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
