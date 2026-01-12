import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { database } from "@/lib/firebase";
import { ref, get, set } from "firebase/database";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: string;
  title: string;
  description: string;
  amount: number;
  expiresAt: string;
  claimed: boolean;
}

export default function MyOffers() {
  const [, navigate] = useLocation();
  const { user, currency, addToBalance } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultOffers: Offer[] = [
    {
      id: "1",
      title: "Welcome Bonus",
      description: "Get 100% bonus on your first deposit up to 100,000 UGX",
      amount: 100000,
      expiresAt: "2025-12-31",
      claimed: false
    },
    {
      id: "2",
      title: "Live Betting Boost",
      description: "Extra 20% odds boost on all live matches today",
      amount: 0,
      expiresAt: "2025-12-29",
      claimed: false
    },
    {
      id: "3",
      title: "Accumulator Bonus",
      description: "Place 5+ leg combo and win extra 50% on returns",
      amount: 0,
      expiresAt: "2026-01-31",
      claimed: false
    },
    {
      id: "4",
      title: "Referral Reward",
      description: "Refer a friend and get 50,000 UGX bonus",
      amount: 50000,
      expiresAt: "2026-06-30",
      claimed: false
    }
  ];

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const fetchOffers = async () => {
      try {
        const offersRef = ref(database, `users/${user.uid}/offers`);
        const snapshot = await get(offersRef);
        
        if (snapshot.exists()) {
          setOffers(Object.values(snapshot.val()));
        } else {
          // Initialize with default offers if none exist
          await set(offersRef, defaultOffers);
          setOffers(defaultOffers);
        }
      } catch (error) {
        console.error('Error fetching offers:', error);
        setOffers(defaultOffers);
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, [user, navigate]);

  const handleClaimOffer = async (offerId: string) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer || offer.claimed) return;

    try {
      // Add to balance
      if (offer.amount > 0) {
        addToBalance(offer.amount);
      }

      // Update in Firebase
      const updatedOffers = offers.map(o => 
        o.id === offerId ? { ...o, claimed: true } : o
      );
      setOffers(updatedOffers);

      const offersRef = ref(database, `users/${user?.uid}/offers`);
      await set(offersRef, updatedOffers);

      toast({
        title: "Offer Claimed!",
        description: offer.amount > 0 ? `${formatCurrency(offer.amount, currency)} added to your wallet` : "Offer successfully claimed",
        className: "bg-green-600 border-none text-white",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to claim offer",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold mb-2">My Offers</h1>
        <p className="text-muted-foreground mb-6">Claim amazing bonuses and promotions</p>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading offers...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {offers.map(offer => (
              <Card key={offer.id} className={offer.claimed ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{offer.title}</CardTitle>
                      <CardDescription>{offer.description}</CardDescription>
                    </div>
                    {offer.claimed && (
                      <span className="text-xs font-bold bg-green-500/20 text-green-500 px-2 py-1 rounded">
                        CLAIMED
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {offer.amount > 0 && (
                    <div className="text-2xl font-bold text-primary">{formatCurrency(offer.amount, currency)}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Expires: {new Date(offer.expiresAt).toLocaleDateString()}
                  </div>
                  {!offer.claimed && (
                    <Button 
                      className="w-full"
                      size="sm"
                      onClick={() => handleClaimOffer(offer.id)}
                    >
                      Claim Offer
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
