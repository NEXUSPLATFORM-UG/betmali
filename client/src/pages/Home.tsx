import { Navigation } from "@/components/Navigation";
import { Betslip } from "@/components/Betslip";
import { AuthModals } from "@/components/AuthModals";
import { UserDashboard } from "@/components/UserDashboard";
import { useMatches, useMatch } from "@/hooks/use-matches";
import { useBetslip, useAuth } from "@/lib/store";
import { Match, League } from "@shared/schema";
import { Loader2, Menu, User, Bell, Search, Plus, Trophy, TrendingUp, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { OddsButton } from "@/components/OddsButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HighlightCard } from "@/components/HighlightCard";
import { VirtualMatches, settleVirtualBets } from "@/components/VirtualMatches";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function Home() {
  const [activeSport, setActiveSport] = useState<string>("football");
  const [activeLeague, setActiveLeague] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [infoTab, setInfoTab] = useState<string>("contact");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [leagueMatchLimits, setLeagueMatchLimits] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const { user, currency, setCurrency, addToBalance } = useAuth();

  const { items, virtualItems } = useBetslip();

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.country_code === 'UG') {
          setCurrency('UGX');
        }
      })
      .catch(() => {});
  }, [setCurrency]);
  const [selectedNotification, setSelectedNotification] = useState<{title: string, content: string} | null>(null);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Welcome to betmali!",
      content: "Start your betting journey today with the best odds in Uganda. We're excited to have you on board. Explore our wide range of sports and virtual matches!",
      summary: "Start your betting journey today with the best odds in Uganda.",
      time: "Just now",
      read: false
    },
    {
      id: 2,
      title: "Account Verified",
      content: "Your phone number has been successfully verified. You can now make deposits and start placing bets on your favorite teams.",
      summary: "Your phone number has been successfully verified.",
      time: "2 hours ago",
      read: true
    }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const banners = [
    {
      image: "https://img.freepik.com/premium-vector/arsenal-premier-league-club-arsenal-kingdom-typography-graphic-design-arsenal-fan-art-print_731129-2193.jpg?w=740",
      title: "Premier League Highlights",
      description: "Bet on the biggest matches of the weekend"
    },
    {
      image: "https://img.freepik.com/premium-photo/watch-live-sports-event-your-mobile-device-betting-football-matches_926199-3835645.jpg?w=740",
      title: "Virtual Sports 24/7",
      description: "Non-stop action every 3 minutes"
    },
    {
      image: "https://img.freepik.com/free-vector/flat-football-twitch-banner-template_23-2149886706.jpg?t=st=1766992796~exp=1766996396~hmac=ae0f19e963aef14dd0f64a420689fd417f38c160bce4f1a3f1cf8da9825b93ab&w=740",
      title: "Live Betting",
      description: "Get the best live odds in real-time"
    }
  ];

  const { 
    data: matchesData, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useMatches({ 
    sport: activeSport, 
    league: activeLeague || undefined,
    isLive: activeFilter === "Live" ? "true" : undefined
  });

  const matches = matchesData?.pages.flatMap(page => page.matches) || [];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const highlightMatches = matches?.filter((m: any) => m.isHighlight) || [];
  
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedParentMatchId, setExpandedParentMatchId] = useState<string | undefined>(undefined);
  const { data: selectedMatch, isLoading: isLoadingMatch } = useMatch(
    expandedMatchId ? parseInt(expandedMatchId) : 0,
    expandedParentMatchId
  );

  const filteredMatches = matches?.filter((match: any) => {
    const matchesSearch = !searchQuery || 
      match.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) || 
      match.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.league?.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (searchQuery) return true;
    
    // Check if live status from API matches activeFilter
    if (activeFilter === "Live") return match.status === 'live';
    
    const matchDate = new Date(match.startTime);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (activeFilter === "Today") {
      return matchDate.toDateString() === today.toDateString();
    }
    if (activeFilter === "Tomorrow") {
      return matchDate.toDateString() === tomorrow.toDateString();
    }
    return true;
  }) || [];

  const groupedMatches = filteredMatches.reduce((acc: Record<string, any[]>, match: any) => {
    const leagueName = match.league?.name || "Other";
    const countryName = match.country || "";
    const groupKey = countryName ? `${countryName} ${leagueName}` : leagueName;
    
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(match);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const liveCount = matches?.filter((m: any) => m.status === 'live').length || 0;
  const todayCount = matches?.filter((m: any) => {
    const d = new Date(m.startTime);
    return d.toDateString() === new Date().toDateString();
  }).length || 0;
  const tomorrowCount = matches?.filter((m: any) => {
    const d = new Date(m.startTime);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  }).length || 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card px-4 flex items-center justify-between shrink-0 z-20 gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-card">
                <Navigation 
                  activeSport={activeSport} 
                  setActiveSport={setActiveSport} 
                  activeLeague={activeLeague} 
                  setActiveLeague={setActiveLeague} 
                    activeFilter={activeFilter}
                    setActiveFilter={setActiveFilter}
                />
            </SheetContent>
          </Sheet>
          
          <div className="font-display font-black text-lg italic tracking-tight text-primary">
            betmali
          </div>
          
          <nav className="hidden sm:flex items-center gap-4 ml-4">
            <button
              onClick={() => {
                setActiveSport('football');
                setActiveLeague(null);
                setActiveFilter('All');
              }}
              className={`text-[10px] font-bold tracking-wide transition-colors uppercase ${
                activeSport === 'football' && activeFilter !== 'Live' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              SPORTBOOK
            </button>

            <button
              onClick={() => {
                setActiveSport('all-soccer');
                setActiveLeague(null);
                setActiveFilter('All');
              }}
              className={`text-[10px] font-bold tracking-wide transition-colors uppercase ${
                activeSport === 'all-soccer' && activeFilter !== 'Live' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ALL SOCCER
            </button>

            <button
              onClick={() => {
                // Toggle the Live filter; don't force the sport selection.
                setActiveLeague(null);
                setActiveFilter(activeFilter === 'Live' ? 'All' : 'Live');
              }}
              className={`text-[10px] font-bold tracking-wide transition-colors uppercase ${
                activeFilter === 'Live' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <img src="https://i.giphy.com/McsDYx2ihXzztTFMap.webp" alt="Live" className="w-4 h-4 inline-block mr-1 object-contain" />
              LIVE
            </button>

            <button
              onClick={() => {
                setActiveSport('virtual');
                setActiveLeague(null);
                setActiveFilter('All');
              }}
              className={`text-[10px] font-bold tracking-wide transition-colors uppercase ${
                activeSport === 'virtual' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              VIRTUAL
            </button>

            <button
              onClick={() => {
                setActiveSport('contact');
                setActiveLeague(null);
                setActiveFilter('All');
              }}
              className={`text-[10px] font-bold tracking-wide transition-colors uppercase ${
                activeSport === 'contact' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              CONTACT US
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {activeSport !== 'virtual' && (
            <div className="relative w-40 hidden lg:block">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-7 pr-2 bg-secondary/30 border border-border rounded text-[10px] focus:outline-none focus:bg-secondary"
              />
            </div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <UserDashboard />
              <Button 
                size="sm" 
                className="h-8 bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-[10px] px-3 gap-1 hidden sm:flex"
                onClick={() => {
                  const depositTab = document.querySelector('[data-tab-id="wallet"]');
                  if (depositTab) (depositTab as HTMLElement).click();
                  const dashboardTrigger = document.querySelector('[data-dashboard-trigger]');
                  if (dashboardTrigger) (dashboardTrigger as HTMLElement).click();
                }}
              >
                <Plus className="w-3 h-3" /> DEPOSIT
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AuthModals />
              <Button 
                size="sm" 
                className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] px-4 rounded-md shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                onClick={() => {
                  const trigger = document.querySelector('[data-auth-trigger]');
                  if (trigger) (trigger as HTMLElement).click();
                  setTimeout(() => {
                    const registerBtn = document.querySelector('[data-auth-register]');
                    if (registerBtn) (registerBtn as HTMLElement).click();
                  }, 50);
                }}
              >
                JOIN NOW
              </Button>
            </div>
          )}

          {user && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-accent text-accent-foreground text-[8px] font-black rounded-full flex items-center justify-center border-2 border-card shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[300px] sm:w-[400px] bg-card border-l-primary/20">
                <SheetHeader className="border-b border-border/50 pb-4 mb-4">
                  <SheetTitle className="flex items-center gap-2 text-primary">
                    <Bell className="w-5 h-5" />
                    Notifications
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => {
                        setSelectedNotification(n);
                        markAsRead(n.id);
                      }}
                      className={`p-4 rounded-lg border transition-all cursor-pointer group hover:scale-[1.02] ${
                        n.read 
                          ? 'bg-secondary/10 border-border/50 opacity-70' 
                          : 'bg-primary/5 border-primary/20 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className={`text-sm font-bold ${n.read ? 'text-foreground' : 'text-primary'}`}>
                          {n.title}
                        </h3>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-accent mt-1 animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {n.summary}
                      </p>
                      <p className={`text-[8px] mt-2 font-bold ${n.read ? 'text-muted-foreground' : 'text-primary/60'}`}>
                        {n.time}
                      </p>
                    </div>
                  ))}
                  
                  {notifications.length === 0 ? (
                    <div className="text-[9px] text-center py-6 text-muted-foreground/40 italic">
                      No notifications
                    </div>
                  ) : (
                    <div className="text-[9px] text-center py-6 text-muted-foreground/40 italic">
                      No more notifications
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}

          {selectedNotification && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/30 pb-4">
                    <h2 className="text-xl font-black text-primary italic uppercase tracking-tighter">
                      {selectedNotification.title}
                    </h2>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-secondary"
                      onClick={() => setSelectedNotification(null)}
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="py-2">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedNotification.content}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-border/30">
                    <Button 
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-10"
                      onClick={() => setSelectedNotification(null)}
                    >
                      GOT IT
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        <aside className={cn(
          "hidden lg:block w-48 shrink-0 border-r border-border bg-card overflow-hidden text-[11px]",
          activeSport === 'virtual' && "lg:hidden"
        )}>
          <Navigation 
            activeSport={activeSport} 
            setActiveSport={setActiveSport} 
            activeLeague={activeLeague} 
            setActiveLeague={setActiveLeague} 
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
        </aside>

        <main className="flex-1 overflow-auto bg-background relative pb-16 lg:pb-0 flex flex-col">
          {activeSport === 'virtual' ? (
            <VirtualMatches />
          ) : activeSport === 'contact' ? (
            <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <h1 className="text-2xl sm:text-3xl font-black text-primary italic uppercase tracking-tighter">Information Center</h1>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'contact', label: 'Contact' },
                    { id: 'about', label: 'About Us' },
                    { id: 'terms', label: 'Terms' },
                    { id: 'privacy', label: 'Privacy' },
                    { id: 'gaming', label: 'Responsible Gaming' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setInfoTab(tab.id)}
                      className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-colors ${
                        infoTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {infoTab === 'contact' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 shadow-sm">
                      <h2 className="text-lg font-bold">Get in Touch</h2>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">📧</div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p>
                            <p className="text-sm font-medium">support@betmali.com</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">📞</div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Phone (Uganda)</p>
                            <p className="text-sm font-medium">+256 700 000 000</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">📍</div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Office</p>
                            <p className="text-sm font-medium">Kampala, Uganda</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 shadow-sm">
                      <h2 className="text-lg font-bold">Live Support</h2>
                      <p className="text-sm text-muted-foreground">Our team is available 24/7 to help you with any betting or account questions.</p>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest gap-2 h-10">
                        START LIVE CHAT
                      </Button>
                    </div>
                  </div>
                )}

                {infoTab === 'about' && (
                  <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 prose prose-invert max-w-none">
                    <h2 className="text-lg font-bold m-0">About betmali</h2>
                    <p>Welcome to betmali, Uganda's premier sports betting destination. We are a modern, secure, and user-focused betting platform designed specifically for the East African market.</p>
                    <p>We provide the most competitive odds across a wide range of sports, including football, basketball, and our popular virtual soccer leagues.</p>
                    <h3 className="text-primary font-bold m-0">Our Mission</h3>
                    <p>Our mission is to provide a transparent, fair, and exciting betting environment where players can enjoy their passion for sports with the highest level of security and customer service.</p>
                  </div>
                )}

                {infoTab === 'terms' && (
                  <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 prose prose-invert max-w-none">
                    <h2 className="text-lg font-bold m-0">Terms & Conditions</h2>
                    <h3 className="text-primary font-bold m-0 text-sm">1. Acceptance of Terms</h3>
                    <p>By accessing and using betmali, you agree to be bound by these Terms and Conditions. You must be at least 18 years old to use our services.</p>
                    <h3 className="text-primary font-bold m-0 text-sm">2. Account Registration</h3>
                    <p>Users must provide accurate information during registration. One account per person is permitted.</p>
                    <h3 className="text-primary font-bold m-0 text-sm">3. Betting Rules</h3>
                    <p>All bets are subject to our specific sport rules. Once a bet is placed and confirmed, it cannot be cancelled.</p>
                  </div>
                )}

                {infoTab === 'privacy' && (
                  <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 prose prose-invert max-w-none">
                    <h2 className="text-lg font-bold m-0">Privacy Policy</h2>
                    <p>Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.</p>
                    <h3 className="text-primary font-bold m-0 text-sm">Information We Collect</h3>
                    <p>We collect information necessary for account verification, transaction processing, and improving our services, including your phone number and transaction history.</p>
                  </div>
                )}

                {infoTab === 'gaming' && (
                  <div className="bg-card border border-border/50 rounded-lg p-6 space-y-4 prose prose-invert max-w-none">
                    <h2 className="text-lg font-bold m-0">Responsible Gaming</h2>
                    <p className="text-base font-bold text-foreground">Gaming should always be about fun and entertainment.</p>
                    <p>At betmali, we take responsible gaming seriously. We provide tools and resources to help you stay in control of your betting activities.</p>
                    <h3 className="text-primary font-bold m-0 text-sm">Staying in Control</h3>
                    <ul className="text-sm">
                      <li>Set daily, weekly, or monthly deposit limits</li>
                      <li>Never bet with money you cannot afford to lose</li>
                      <li>Don't chase losses</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 max-w-6xl space-y-4">
                <div className="relative h-24 sm:h-32 rounded-lg overflow-hidden border border-border/50 group">
                  {banners.map((banner, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                        index === currentBanner ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <img 
                        src={banner.image} 
                        className="w-full h-full object-cover" 
                        alt={banner.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center px-6">
                        <h2 className="text-sm sm:text-base font-black text-primary italic uppercase tracking-tighter">
                          {banner.title}
                        </h2>
                        <p className="text-[10px] text-white/80 max-w-[200px]">
                          {banner.description}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="absolute bottom-2 right-4 flex gap-1">
                    {banners.map((_, index) => (
                      <div 
                        key={index}
                        className={`h-0.5 w-3 rounded-full transition-colors ${
                          index === currentBanner ? "bg-primary" : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {!isLoading && highlightMatches.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-sm font-bold">Highlights</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                      {highlightMatches.map((match: any) => (
                        <HighlightCard key={match.id} match={match} />
                      ))}
                    </div>
                  </section>
                )}

                <div>
                  <h1 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">⚽</span> Football
                  </h1>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-96">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-primary uppercase italic tracking-tighter">TOP GAMES</h2>
                      <div className="flex items-center gap-1.5 text-[9px] overflow-x-auto pb-1">
                        {[
                          { id: 'All', label: 'All', count: null },
                          { id: 'Live', label: 'Live', count: liveCount },
                          { id: 'Today', label: 'Today', count: todayCount },
                          { id: 'Tomorrow', label: 'Tomorrow', count: tomorrowCount }
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            onClick={() => setActiveFilter(filter.id)}
                            className={`px-3 py-1.5 rounded font-bold whitespace-nowrap transition-colors ${
                              activeFilter === filter.id 
                                ? 'bg-primary text-primary-foreground shadow-sm' 
                                : 'bg-secondary/50 text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {filter.label} {filter.count !== null && filter.count}
                          </button>
                        ))}
                      </div>
                    </div>

                    {Object.entries(groupedMatches).map(([leagueName, leagueMatches]) => (
                      <div key={leagueName} className="bg-card rounded-lg border border-border/50 overflow-hidden text-[10px]">
                        <div 
                          className="bg-secondary/30 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/50"
                          onClick={() => {
                            setLeagueMatchLimits(prev => ({
                              ...prev,
                              ...Object.fromEntries(
                                Object.keys(groupedMatches).map(name => [
                                  name, 
                                  prev[leagueName] === 5 ? groupedMatches[name].length : 5
                                ])
                              )
                            }));
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center p-1 shadow-sm">
                              {leagueMatches[0]?.sportId === 3 ? (
                                <img src="https://www.svgrepo.com/show/404149/soccer-ball.svg" className="w-4 h-4 object-contain" alt="Football" />
                              ) : leagueMatches[0]?.sportId === 6 ? (
                                <img src="https://www.svgrepo.com/show/513115/basketball.svg" className="w-4 h-4 object-contain" alt="Basketball" />
                              ) : leagueMatches[0]?.sportId === 1 ? (
                                <img src="https://www.svgrepo.com/show/512962/tenis-786.svg" className="w-4 h-4 object-contain" alt="Tennis" />
                              ) : leagueMatches[0]?.sportId === 21 ? (
                                <img src="https://www.svgrepo.com/show/203639/cricket.svg" className="w-4 h-4 object-contain" alt="Cricket" />
                              ) : (
                                <span className="text-[10px]">⚽</span>
                              )}
                            </div>
                            <span className="font-bold tracking-tight uppercase">{leagueName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground font-bold text-[8px]">
                            {(leagueMatches as any[]).length} MATCHES
                            {(leagueMatches as any[]).length > 5 && (
                              <span className="bg-secondary/50 px-1 rounded text-[7px]">
                                {leagueMatchLimits[leagueName] === 5 ? 'SHOW ALL' : 'HIDE'}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="divide-y divide-border/30">
                          {(leagueMatches as any[]).slice(0, leagueMatchLimits[leagueName] || 5).map((match: any) => (
                            <div key={match.id} className="p-2 sm:p-3 hover:bg-secondary/10 transition-colors group relative">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0 sm:min-w-[200px] lg:min-w-[250px]">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest bg-secondary/30 px-1.5 py-0.5 rounded flex flex-col items-center leading-tight">
                                      {match.status === 'live' ? (
                                        <span className="flex items-center gap-1 text-accent animate-pulse">
                                          <img src="https://i.giphy.com/McsDYx2ihXzztTFMap.webp" alt="live" className="w-3.5 h-3.5 object-contain rounded" />
                                          <span className="font-black">LIVE</span>
                                          {match.timeLabel ? (
                                            <span className="ml-1 text-[9px] font-bold">{String(match.timeLabel)}</span>
                                          ) : null}
                                        </span>
                                      ) : (
                                        <>
                                          <span>{new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                          <span className="text-[6px] opacity-70">{new Date(match.startTime).getDate().toString().padStart(2, '0')}/{ (new Date(match.startTime).getMonth() + 1).toString().padStart(2, '0')}</span>
                                        </>
                                      )}
                                    </span>
                                    <span className="text-[8px] text-muted-foreground font-bold">ID: {match.id}</span>
                                  </div>
                                  <div className="space-y-1 sm:hidden">
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <div className="grid grid-cols-3 gap-1.5 flex-1 justify-items-center">
                                        <div className="w-full">
                                          <div className="text-[7px] font-bold text-foreground text-center mb-0.5 truncate h-3 leading-3">{match.homeTeam}</div>
                                          <div className="text-[7px] font-black text-muted-foreground uppercase text-center mb-0.5">1</div>
                                          <OddsButton 
                                            match={match} 
                                            market="1"
                                            selection="1" 
                                            odds={match.homeOdd}
                                            className="h-8 text-[9px] w-full"
                                          />
                                        </div>
                                        <div className="w-full flex flex-col justify-end">
                                          <div className="text-[7px] font-black text-muted-foreground italic text-center mb-0.5 h-3 leading-3">VS</div>
                                          <div className="text-[7px] font-black text-muted-foreground uppercase text-center mb-0.5">X</div>
                                          <OddsButton 
                                            match={match} 
                                            market="X"
                                            selection="X" 
                                            odds={match.drawOdd}
                                            className="h-8 text-[9px] w-full"
                                          />
                                        </div>
                                        <div className="w-full">
                                          <div className="text-[7px] font-bold text-foreground text-center mb-0.5 truncate h-3 leading-3">{match.awayTeam}</div>
                                          <div className="text-[7px] font-black text-muted-foreground uppercase text-center mb-0.5">2</div>
                                          <OddsButton 
                                            match={match} 
                                            market="2"
                                            selection="2" 
                                            odds={match.awayOdd}
                                            className="h-8 text-[9px] w-full"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-center justify-end h-full pt-[14px]">
                                        <div className="text-[7px] font-black text-transparent uppercase mb-0.5">.</div>
                                        <button 
                                      onClick={() => {
                                        const newId = match.id.toString();
                                        setExpandedMatchId(expandedMatchId === newId ? null : newId);
                                        setExpandedParentMatchId(expandedMatchId === newId ? undefined : match.parentMatchId);
                                      }}
                                      className="h-8 w-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-black uppercase transition-colors shrink-0"
                                    >
                                      ALL
                                    </button>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="hidden sm:flex items-center gap-2">
                                    <span className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">{match.homeTeam}</span>
                                    <span className="text-muted-foreground font-black text-[10px] px-1">-</span>
                                    <span className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">{match.awayTeam}</span>
                                    {match.status === 'live' && <span className="font-black text-accent text-[10px] ml-2">{match.scoreDisplay || ''}</span>}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1 w-full sm:w-auto sm:block hidden">
                                  <div className="flex items-center justify-center sm:justify-start mb-1">
                                    <div className="flex gap-4 sm:ml-[4px] lg:ml-[4px] sm:w-48 lg:w-56 justify-center">
                                      <span className="text-[9px] font-black text-muted-foreground w-12 text-center">1</span>
                                      <span className="text-[9px] font-black text-muted-foreground w-12 text-center">X</span>
                                      <span className="text-[9px] font-black text-muted-foreground w-12 text-center">2</span>
                                    </div>
                                    <div className="w-10 sm:flex hidden"></div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="grid grid-cols-3 gap-1.5 shrink-0 sm:w-48 lg:w-56">
                                      <OddsButton 
                                        match={match} 
                                        market="1"
                                        selection="1" 
                                        odds={match.homeOdd}
                                      />
                                      <OddsButton 
                                        match={match} 
                                        market="X"
                                        selection="X" 
                                        odds={match.drawOdd}
                                      />
                                      <OddsButton 
                                        match={match} 
                                        market="2"
                                        selection="2" 
                                        odds={match.awayOdd}
                                      />
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const newId = match.id.toString();
                                        setExpandedMatchId(expandedMatchId === newId ? null : newId);
                                        setExpandedParentMatchId(expandedMatchId === newId ? undefined : match.parentMatchId);
                                      }}
                                      className="hidden sm:flex h-8 w-10 items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-black uppercase transition-colors shrink-0 self-end mb-[1px]"
                                      title="All Markets"
                                    >
                                      ALL
                                    </button>
                                  </div>
                                </div>
                              </div>
                              
                              {expandedMatchId === match.id.toString() && (
                                <div className="mt-3 border-t border-border/30 pt-3 animate-in slide-in-from-top-2 duration-200">
                                  {isLoadingMatch ? (
                                    <div className="flex justify-center py-4">
                                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    </div>
                                  ) : (selectedMatch as any)?.odds ? (
                                    <div className="space-y-4">
                                      {(selectedMatch as any).odds.map((market: any) => (
                                        <div key={market.sub_type_id} className="space-y-1.5">
                                          <div className="text-[9px] font-black uppercase text-primary/80 bg-primary/5 px-2 py-1 rounded flex flex-col gap-1.5">
                                            <span>{market.name}</span>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 px-1">
                                            {market.odds.map((outcome: any, idx: number) => (
                                        <div key={idx} className="flex flex-col gap-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground truncate px-1">
                                                  {(() => {
                                                    const display = outcome.display;
                                                    // Mapping "1 OR X" or "1X" to "Home or Draw"
                                                    if (display === '1' || display === '1 OR X' || display === '1X') return `${match.homeTeam} or Draw`;
                                                    // Mapping "X OR 2" or "X2" to "Draw or Away"
                                                    if (display === '2' || display === 'X OR 2' || display === 'X2') return `Draw or ${match.awayTeam}`;
                                                    // Mapping "1 OR 2" or "12" to "Home or Away"
                                                    if (display === '1 OR 2' || display === '12') return `${match.homeTeam} or ${match.awayTeam}`;
                                                    // Basic mappings for 1, X, 2
                                                    if (display === '1') return match.homeTeam;
                                                    if (display === 'X') return 'Draw';
                                                    if (display === '2') return match.awayTeam;
                                                    
                                                    // Handicap patterns like "1 (1:0)"
                                                    if (display.startsWith('1 (')) return `${match.homeTeam} ${display.substring(1)}`;
                                                    if (display.startsWith('X (')) return `Draw ${display.substring(1)}`;
                                                    if (display.startsWith('2 (')) return `${match.awayTeam} ${display.substring(1)}`;
                                                    
                                                    return display;
                                                  })()}
                                                </span>
                                                <OddsButton
                                                  match={match}
                                                  market={market.name}
                                                  selection={outcome.display}
                                                  odds={outcome.odd_value}
                                                  className="h-8 text-[9px]"
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (selectedMatch as any)?.allOdds && selectedMatch ? (
                                    <div className="space-y-4">
                                      {Object.entries(((selectedMatch as any).allOdds as any).sr1?.['3'] || {}).map(([marketId, marketData]: [string, any]) => {
                                        const marketNames: Record<string, string> = {
                                          '1': 'Winner',
                                          '10': 'Double Chance',
                                          '11': 'Draw No Bet',
                                          '12': 'Both Teams Score',
                                          '13': 'Total Goals',
                                          '14': 'Handicap',
                                          '15': 'Winning Margin',
                                          '16': 'Handicap',
                                          '18': 'Total Goals',
                                          '21': 'Exact Goals',
                                          '23': 'Total Goals (Home)',
                                          '24': 'Total Goals (Away)',
                                          '25': 'Point Range',
                                          '26': '1st Half - Winner',
                                          '27': '2nd Half - Winner',
                                          '28': '1st Half - Total',
                                          '29': 'Both Teams Score (1st Half)',
                                          '30': 'Correct Score',
                                          '31': 'Over/Under',
                                          '32': 'Over/Under',
                                          '33': 'Over/Under',
                                          '34': 'Over/Under',
                                          '35': 'Winning Margin',
                                          '36': 'Total Goals',
                                          '37': 'Total Goals',
                                          '46': 'Correct Score',
                                          '48': 'Anytime Goalscorer',
                                          '8': 'First Goal',
                                          '9': 'Next Goal',
                                          '38': 'First Goal',
                                          '39': 'Next Goal',
                                          '100': 'Multi Goals',
                                          '47': 'Multi Goals',
                                          '17': 'Half Time / Full Time',
                                          '113': 'Match Events'
                                        };
                                        const marketName = marketNames[marketId] || `Market ${marketId}`;
                                        
                                        const cleanLabel = (label: string) => {
                                          if (!label || label === '_') return '';
                                          
                                          // Handle specific known outcome names/types first
                                          let cleaned = label
                                            .replace(/type=prematch\s+/g, '')
                                            .replace(/sr:player:(\d+)/g, (match, id) => `Player ${id}`)
                                            .replace(/sr:exact_goals:(\d+)\+/g, (m, g) => `${g} or more goals`)
                                            .replace(/sr:exact_goals:(\d+)/g, (m, g) => `Exactly ${g} Goals`)
                                            .replace(/hcp=/g, 'Hcp: ')
                                            .replace(/total=/g, 'Total: ')
                                            .replace(/\\u002e/g, '.')
                                            .replace(/variant=sr:[a-z_:]+/gi, '')
                                            .replace(/variant=[a-z\s0-9+:]+/gi, '')
                                            .replace(/goalnr=/g, 'Goal #')
                                            .replace(/type=prematch\s+/g, '')
                                            .replace(/type=\s+/g, '')
                                            .replace(/Goal #\d+ type=\s*/gi, (m) => m.split(' ')[0] + ' ' + m.split(' ')[1] + ' ')
                                            .replace(/\|/g, ' ')
                                            .replace(/from=(\d+) to=(\d+)/g, '$1-$2 min')
                                            .replace(/\d{3,}/g, '') // Remove large numeric strings like 800
                                            .replace(/:91/g, '')
                                            .replace(/:\d+/g, '') // Remove remaining colon-prefixed IDs
                                            .trim();

                                          // Map of common labels
                                          const labelMap: Record<string, string> = {
                                            'goal no 1': 'Goal #1',
                                            'goal no 2': 'Goal #2',
                                            'goal no 3': 'Goal #3',
                                            'prematch': '',
                                          };

                                          Object.entries(labelMap).forEach(([key, val]) => {
                                            const regex = new RegExp(key, 'gi');
                                            cleaned = cleaned.replace(regex, val);
                                          });

                                          return cleaned;
                                        };

                                        return (
                                          <div key={marketId} className="space-y-1.5">
                                            <div className="text-[9px] font-black uppercase text-primary/80 bg-primary/5 px-2 py-1 rounded flex flex-col gap-1.5">
                                              <span>{marketName}</span>
                                              {(marketId === '1' || marketId === '10' || marketId === '11' || marketId === '14' || marketId === '16' || marketId === '26' || marketId === '27') && (
                                                <div className="grid grid-cols-3 gap-1.5 px-1">
                                                  <span className="text-center text-[7px] truncate font-bold text-muted-foreground">{(selectedMatch as any).homeTeam}</span>
                                                  <span className="text-center text-[7px] font-bold text-muted-foreground">Draw</span>
                                                  <span className="text-center text-[7px] truncate font-bold text-muted-foreground">{(selectedMatch as any).awayTeam}</span>
                                                </div>
                                              )}
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5 px-1">
                                              {marketData.sp && Object.entries(marketData.sp).map(([variantKey, variantData]: [string, any]) => (
                                                variantData.out && Object.entries(variantData.out).map(([outcomeId, outcome]: [string, any]) => {
                                                  let outcomeLabel = outcomeId;
                                                  if (marketId === '1' && selectedMatch) {
                                                    if (outcomeId === '1') outcomeLabel = '1';
                                                    else if (outcomeId === '2') outcomeLabel = 'X';
                                                    else if (outcomeId === '3') outcomeLabel = '2';
                                                  } else if (marketId === '10') {
                                                    if (outcomeId === '9') outcomeLabel = '1X';
                                                    else if (outcomeId === '10') outcomeLabel = '12';
                                                    else if (outcomeId === '11') outcomeLabel = 'X2';
                                                  } else if (marketId === '12') {
                                                    // Outcome 4 is Yes, Outcome 5 is No
                                                    if (outcomeId === '4') outcomeLabel = 'Yes';
                                                    else if (outcomeId === '5') outcomeLabel = 'No';
                                                    else outcomeLabel = outcomeId;
                                                  } else if (marketId === '11') {
                                                    if (outcomeId === '4') outcomeLabel = (selectedMatch as any).homeTeam;
                                                    else if (outcomeId === '5') outcomeLabel = (selectedMatch as any).awayTeam;
                                                  } else {
                                                    // Map common outcome IDs to readable names
                                                    const outcomeMap: Record<string, string> = {
                                                      '6': (selectedMatch as any).homeTeam,
                                                      '7': 'No Goal',
                                                      '8': (selectedMatch as any).awayTeam,
                                                      '74': 'Over',
                                                      '76': 'Under',
                                                      '12': 'Over',
                                                      '13': 'Under',
                                                      '776': 'Yes',
                                                      '778': 'No',
                                                      '1714': (selectedMatch as any).homeTeam,
                                                      '1715': (selectedMatch as any).awayTeam,
                                                      '1711': (selectedMatch as any).homeTeam,
                                                      '1712': 'Draw',
                                                      '1713': (selectedMatch as any).awayTeam,
                                                      '70': 'Over',
                                                      '72': 'Under',
                                                      '784': '1-0',
                                                      '788': '2-0',
                                                      '790': '2-1',
                                                      '792': '3-0',
                                                      '794': '0 Goals',
                                                      '796': '1 Goal',
                                                      '798': '2 Goals',
                                                      '800': '3 Goals',
                                                      '802': '4 Goals',
                                                      '804': '5+ Goals',
                                                      '1121': '0-10',
                                                      '1122': '11-20',
                                                      '1123': '21-30',
                                                      '1124': '31+',
                                                      '68': '0-1',
                                                      '69': '2-3',
                                                      '71': '4-5',
                                                      '73': '6+',
                                                      '88': '0-1',
                                                      '89': '2-3',
                                                      '90': '4-5',
                                                      '91': '6+',
                                                    };
                                                    outcomeLabel = outcomeMap[outcomeId] || outcomeId;
                                                  }
                                                  
                                                  const marketVariant = cleanLabel(variantKey);
                                                  
                                                  let displayLabel = "";
                                                  switch(marketId) {
                                                    case '1': // Winner
                                                    case '26': // 1st Half Winner
                                                    case '27': // 2nd Half Winner
                                                      displayLabel = outcomeLabel; // 1, X, 2 or Team Name
                                                      break;
                                                    case '10': // Double Chance
                                                      displayLabel = outcomeLabel; // 1X, 12, X2
                                                      break;
                                                    case '11': // Draw No Bet
                                                      displayLabel = outcomeLabel; // Team Name
                                                      break;
                                                    case '12': // Both Teams Score
                                                    case '29': // Both Teams Score
                                                      if (outcomeId === '776') displayLabel = 'Yes';
                                                      else if (outcomeId === '778') displayLabel = 'No';
                                                      else displayLabel = outcomeLabel; // Yes/No
                                                      break;
                                                    case '13': // Total Goals
                                                    case '28': // 1st Half Total
                                                    case '31': // Over/Under
                                                    case '32': // Over/Under
                                                    case '33': // Over/Under
                                                    case '34': // Over/Under
                                                    case '36': // Total Goals
                                                    case '37': // Total Goals
                                                      // marketVariant is usually "Total: 2.5"
                                                      // outcomeLabel is "Over" or "Under"
                                                      const totalVal = marketVariant.replace('Total: ', '').replace('Total ', '').trim();
                                                      displayLabel = totalVal ? `${totalVal} ${outcomeLabel}` : outcomeLabel;
                                                      break;
                                                    case '14': // Handicap
                                                    case '16': // Handicap
                                                      const hcpVal = marketVariant.replace('Hcp: ', '').replace('Hcp ', '').trim();
                                                      displayLabel = hcpVal ? `${hcpVal} ${outcomeLabel}` : outcomeLabel;
                                                      break;
                                                    case '8': // First Goal
                                                    case '9': // Next Goal
                                                    case '38': // First Goal
                                                    case '39': // Next Goal
                                                      displayLabel = outcomeLabel; // Team Name or No Goal
                                                      break;
                                                    case '30': // Correct Score
                                                    case '46': // Correct Score
                                                      displayLabel = outcomeLabel; // e.g. 1-0
                                                      break;
                                                    default:
                                                      displayLabel = marketVariant ? `${marketVariant} ${outcomeLabel}` : outcomeLabel;
                                                  }

                                                  // Final safety cleanup for any leftover technical IDs in displayLabel
                                                  displayLabel = displayLabel
                                                    .replace(/variant=sr:[a-z_]+:\d+/gi, '')
                                                    .replace(/sr:[a-z_:]+\d+/gi, '')
                                                    .replace(/\d{4,}/g, '') // Remove long numeric strings (4+ digits)
                                                    .trim();

                                                  return (
                                                    <div key={`${variantKey}-${outcomeId}`} className="flex flex-col gap-0.5">
                                                      <span className="text-[8px] font-bold text-muted-foreground truncate px-1">
                                                        {displayLabel}
                                                      </span>
                                                      <OddsButton 
                                                        match={selectedMatch as any} 
                                                        market={marketNames[marketId] || marketId}
                                                        selection={outcomeId} 
                                                        odds={outcome.o}
                                                        className="h-8 text-[9px]"
                                                      />
                                                    </div>
                                                  );
                                                })
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-4 text-muted-foreground italic text-[10px]">
                                      No additional markets available.
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Bottom labels hidden since odds are moved up/side */}
                              <div className="mt-2 hidden">
                                <div className="flex gap-3 text-[7px] font-bold text-muted-foreground">
                                  <span className="hover:text-primary cursor-pointer">GG/NG</span>
                                  <span className="hover:text-primary cursor-pointer">O/U 2.5</span>
                                  <span className="hover:text-primary cursor-pointer">DC</span>
                                </div>
                                <div 
                                  className="text-[8px] font-black text-primary cursor-pointer hover:underline"
                                  onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
                                >
                                  ALL MARKETS
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {/* Load More Button */}
                {hasNextPage && (
                  <div className="flex justify-center py-8">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-8 text-[11px] font-bold uppercase tracking-wider border-primary/20 hover:bg-primary/5 hover:text-primary transition-all rounded-full group"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                      )}
                      {isFetchingNextPage ? 'LOADING...' : 'LOAD MORE MATCHES'}
                    </Button>
                  </div>
                )}
              </div>
              <footer className="bg-card border-t border-border mt-auto pt-8 pb-24 lg:pb-12 shrink-0">
                <div className="max-w-6xl mx-auto px-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
                    <div className="space-y-4">
                      <div className="font-display font-black text-xl italic tracking-tight text-primary">betmali</div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Uganda's leading sports betting platform. Experience the best odds and instant payouts.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground">Quick Links</h4>
                      <nav className="flex flex-col gap-2 text-[10px] text-muted-foreground">
                        <button onClick={() => { setActiveSport('football'); setActiveLeague(null); }} className="hover:text-primary transition-colors text-left text-[10px]">Sportsbook</button>
                        <button onClick={() => setActiveSport('virtual')} className="hover:text-primary transition-colors text-left text-[10px]">Virtual Sports</button>
                        <button onClick={() => { setActiveSport('contact'); setInfoTab('about'); }} className="hover:text-primary transition-colors text-left text-[10px]">About Us</button>
                      </nav>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <img 
                        src="https://lgrb.go.ug/wp-content/uploads/2025/03/NLGRB-web-Logo.png" 
                        className="w-32 md:w-40 h-auto object-contain shrink-0" 
                        alt="NLGRB Logo" 
                      />
                      <p className="text-[10px] font-bold text-muted-foreground leading-tight max-w-[200px] uppercase tracking-tighter">
                        betmali is regulated by uganda lottery and gaming regulatory board
                      </p>
                    </div>
                    
                    <div className="text-[8px] text-muted-foreground/50 text-center md:text-right font-medium">
                      &copy; {new Date().getFullYear()} Betmali. All rights reserved. <br/>
                      Gambling can be addictive. Please gamble responsibly.
                    </div>
                  </div>
                </div>
              </footer>
            </>
          )}
        </main>

        <aside className={cn(
          "hidden xl:block w-72 shrink-0 border-l border-border bg-card overflow-hidden",
          activeSport === 'virtual' && "xl:hidden"
        )}>
          <Betslip />
        </aside>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-50">
          <button 
            onClick={() => { setActiveSport('football'); setActiveLeague(null); }}
            className={cn("flex flex-col items-center gap-1 p-2", activeSport === 'football' && !activeLeague ? "text-primary" : "text-muted-foreground")}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] font-bold">SPORTS</span>
          </button>
          <button 
            onClick={() => { setActiveSport('virtual'); setActiveLeague(null); }}
            className={cn("flex flex-col items-center gap-1 p-2", activeSport === 'virtual' ? "text-primary" : "text-muted-foreground")}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-bold">VIRTUAL</span>
          </button>
          
          {activeSport !== 'virtual' && (
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground relative">
                  <div className="bg-primary text-primary-foreground rounded-full p-2 -mt-8 shadow-lg shadow-primary/30 border-4 border-background">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-primary">BETSLIP</span>
                  {items.length > 0 && (
                    <span className="absolute -top-6 right-2 bg-accent text-accent-foreground text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">
                      {items.length}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] p-0 bg-card rounded-t-xl overflow-hidden">
                <Betslip />
              </SheetContent>
            </Sheet>
          )}

          {activeSport === 'virtual' && (
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center gap-1 p-2 text-muted-foreground relative">
                  <div className="bg-emerald-800 text-white rounded-full p-2 -mt-8 shadow-lg shadow-emerald-900/30 border-4 border-background">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800">VIRTUAL</span>
                  {virtualItems.length > 0 && (
                    <span className="absolute -top-6 right-2 bg-emerald-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-background">
                      {virtualItems.length}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh] p-0 bg-card rounded-t-xl overflow-hidden">
                <Betslip initialTab="virtual" />
              </SheetContent>
            </Sheet>
          )}

          <button 
            onClick={() => {
              const trigger = document.querySelector('[data-dashboard-trigger]');
              if (trigger) (trigger as HTMLElement).click();
            }}
            className="flex flex-col items-center gap-1 p-2 text-muted-foreground"
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-bold">ACCOUNT</span>
          </button>
          <button 
            onClick={() => setActiveSport('contact')}
            className={cn("flex flex-col items-center gap-1 p-2", activeSport === 'contact' ? "text-primary" : "text-muted-foreground")}
          >
            <Globe className="w-5 h-5" />
            <span className="text-[10px] font-bold">MORE</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
