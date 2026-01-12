import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { formatCurrency } from "@/lib/utils";

interface VirtualBetRecord {
  id: string;
  matchId: number;
  selection: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
  settledAt?: string;
}

export default function VirtualBets() {
  const [, navigate] = useLocation();
  const { user, currency } = useAuth();
  const [bets, setBets] = useState<VirtualBetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchBets = async () => {
      try {
        const betsRef = ref(database, `users/${user.uid}/virtualBets`);
        const snapshot = await get(betsRef);
        if (snapshot.exists()) {
          setBets(Object.values(snapshot.val()) as VirtualBetRecord[]);
        }
      } catch (error) {
        console.error('Error fetching virtual bets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, [user, navigate]);

  const won = bets.filter(b => b.status === 'won').length;
  const lost = bets.filter(b => b.status === 'lost').length;
  const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalWinnings = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + b.potentialReturn, 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bets.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{won}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{lost}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Winnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalWinnings, currency)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Virtual Bets History</CardTitle>
            <CardDescription>Track your virtual sports betting</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : bets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No virtual bets yet</div>
            ) : (
              <div className="space-y-2">
                {bets.map(bet => (
                  <div key={bet.id} className="border rounded-lg p-3 flex justify-between items-center hover:bg-secondary/30">
                    <div>
                      <p className="font-semibold text-sm">Virtual Match</p>
                      <p className="text-xs text-muted-foreground">{bet.selection} @ {bet.odds.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{formatCurrency(bet.stake, currency)}</p>
                      <p className={`text-xs ${bet.status === 'won' ? 'text-green-500' : 'text-red-500'}`}>
                        {bet.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
