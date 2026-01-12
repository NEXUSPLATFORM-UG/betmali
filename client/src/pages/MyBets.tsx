import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trophy, TrendingUp, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { formatCurrency } from "@/lib/utils";

interface BetRecord {
  id: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  selection: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: 'pending' | 'won' | 'lost' | 'voided';
  createdAt: string;
  settledAt?: string;
}

export default function MyBets() {
  const [, navigate] = useLocation();
  const { user, currency } = useAuth();
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchBets = async () => {
      try {
        const betsRef = ref(database, `users/${user.uid}/bets`);
        const snapshot = await get(betsRef);
        if (snapshot.exists()) {
          setBets(Object.values(snapshot.val()) as BetRecord[]);
        }
      } catch (error) {
        console.error('Error fetching bets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, [user, navigate]);

  const filteredBets = bets.filter(bet => activeTab === 'all' ? true : bet.status === activeTab);
  const totalStake = filteredBets.reduce((sum, b) => sum + b.stake, 0);
  const totalReturn = filteredBets.filter(b => b.status === 'won').reduce((sum, b) => sum + b.potentialReturn, 0);
  const totalWon = totalReturn - totalStake;

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'won': return 'text-green-500';
      case 'lost': return 'text-red-500';
      case 'pending': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Stake</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalStake, currency)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Return</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalReturn, currency)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalWon >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(totalWon, currency)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Bets</CardTitle>
            <CardDescription>View all your placed bets</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All ({bets.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="won">Won</TabsTrigger>
                <TabsTrigger value="lost">Lost</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-3">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading bets...</div>
                ) : filteredBets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No bets found</div>
                ) : (
                  filteredBets.map(bet => (
                    <div key={bet.id} className="border rounded-lg p-3 space-y-2 hover:bg-secondary/30 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-sm">{bet.homeTeam} vs {bet.awayTeam}</p>
                          <p className="text-xs text-muted-foreground">{bet.selection} @ {bet.odds.toFixed(3)}</p>
                        </div>
                        <span className={`text-xs font-bold ${getStatusColor(bet.status)} uppercase`}>
                          {bet.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Stake: {formatCurrency(bet.stake, currency)}</span>
                        <span>Return: {formatCurrency(bet.potentialReturn, currency)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{new Date(bet.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
