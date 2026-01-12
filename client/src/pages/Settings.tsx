import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Copy, Eye, EyeOff, Settings as SettingsIcon, Bell, Shield, Wallet, Phone, Mail, Lock, Key } from "lucide-react";
import { auth, database } from "@/lib/firebase";
import { signOut, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, get, onValue, update } from "firebase/database";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(false);
  const [copied, setCopied] = useState(false);
  const [firebaseData, setFirebaseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    const userRef = ref(database, `users/${user.uid}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setFirebaseData(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    navigate('/');
    return null;
  }

  const userData = firebaseData || user;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updatePreference = async (key: string, value: any) => {
    if (!user) return;
    try {
      await update(ref(database, `users/${user.uid}/settings`), { [key]: value });
      toast({ title: "Preference Updated" });
    } catch (error) {
      toast({ title: "Error updating preference", variant: "destructive" });
    }
  };

  const handleForgotPassword = async () => {
    if (!user.email) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast({
        title: "Reset Email Sent",
        description: `A password reset link has been sent to ${user.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast({
        title: "Validation Error",
        description: "Please enter your current password",
        variant: "destructive",
      });
      return;
    }
    if (!newPassword || newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match or are empty",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (auth.currentUser && auth.currentUser.email) {
        // Re-authenticate user first
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        
        // Update password
        await updatePassword(auth.currentUser, newPassword);
        toast({
          title: "Success",
          description: "Password updated successfully",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: "Error",
        description: error.code === 'auth/wrong-password' ? "Incorrect current password" : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20 lg:pb-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>

        {/* Account Profile */}
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription className="text-[10px]">Your personal details on BetMali</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone Number</Label>
              <div className="flex items-center gap-2 bg-secondary/20 p-2.5 rounded-lg border border-border/50">
                <Phone className="w-3.5 h-3.5 text-primary/70" />
                <span className="text-sm font-bold">{userData.phone}</span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Email Address</Label>
              <div className="flex items-center gap-2 bg-secondary/20 p-2.5 rounded-lg border border-border/50">
                <Mail className="w-3.5 h-3.5 text-primary/70" />
                <span className="text-sm font-bold">{userData.email}</span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Account ID</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-secondary/20 p-2.5 rounded-lg border border-border/50 overflow-hidden">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">{userData.uid || user.uid}</span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => copyToClipboard(userData.uid || user.uid)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              {copied && <p className="text-[9px] text-green-500 font-bold uppercase tracking-widest mt-1">Copied to clipboard!</p>}
            </div>
          </CardContent>
        </Card>

        {/* Password Management */}
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Security & Password
            </CardTitle>
            <CardDescription className="text-[10px]">Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Password</Label>
                <Input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">New Password</Label>
                <Input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Enter new password"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                <Input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="Confirm new password"
                />
              </div>
              <Button 
                onClick={handleChangePassword} 
                disabled={loading}
                className="w-full h-9 text-[10px] font-black uppercase tracking-widest"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold">Forgot Password?</h4>
                  <p className="text-[9px] text-muted-foreground">Receive a reset link via email</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="h-8 text-[9px] font-bold uppercase tracking-tight"
                >
                  <Key className="w-3 h-3 mr-1" /> Reset via Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Wallet & Balance
            </CardTitle>
            <CardDescription className="text-[10px]">Manage your betting funds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Available Balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-primary italic">
                    {showBalance ? `UGX ${userData.balance?.toLocaleString() || '0'}` : '••••••'}
                  </span>
                  <button onClick={() => setShowBalance(!showBalance)} className="text-muted-foreground hover:text-primary transition-colors">
                    {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[9px] uppercase px-4 h-8" onClick={() => navigate('/')}>DEPOSIT</Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Notification Settings
            </CardTitle>
            <CardDescription className="text-[10px]">Control how we notify you about your bets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Win Notifications</Label>
                <p className="text-[10px] text-muted-foreground">Get alerted immediately when your ticket wins</p>
              </div>
              <Switch 
                defaultChecked={userData.settings?.notifications !== false}
                onCheckedChange={(val) => updatePreference('notifications', val)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Odds Movement Alerts</Label>
                <p className="text-[10px] text-muted-foreground">Notify when odds for your selected matches change</p>
              </div>
              <Switch 
                defaultChecked={userData.settings?.oddsAlerts}
                onCheckedChange={(val) => updatePreference('oddsAlerts', val)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security & Logout */}
        <div className="pt-4">
          <Button
            variant="destructive"
            className="w-full h-12 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-destructive/20"
            onClick={handleLogout}
          >
            LOGOUT ACCOUNT
          </Button>
          <p className="text-center text-[9px] text-muted-foreground mt-4 uppercase font-bold tracking-widest">
            BetMali v1.2.0 • Secure Session
          </p>
        </div>
      </div>
    </div>
  );
}
