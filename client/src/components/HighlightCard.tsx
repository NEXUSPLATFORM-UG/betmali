import { Card } from "@/components/ui/card";
import { OddsButton } from "./OddsButton";
import { Match, League } from "@shared/schema";

interface HighlightCardProps {
  match: Match & { league: League };
}

export function HighlightCard({ match }: HighlightCardProps) {
  const isLive = match.status === 'live';
  
  return (
    <Card className="min-w-[240px] bg-secondary/20 border-border/50 overflow-hidden flex flex-col hover:bg-secondary/30 transition-colors text-[9px]">
      {/* Header */}
      <div className="bg-secondary/40 px-2.5 py-1.5 border-b border-border/30">
        <div className="flex justify-between items-center text-[8px]">
          <span className="text-muted-foreground font-medium">{new Date(match.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - Today</span>
          <span className="text-muted-foreground font-medium">9 - Today</span>
        </div>
      </div>

      {/* Teams & Score */}
      <div className="p-3 flex-1 space-y-2">
        {/* Home */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-secondary/50 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
              H
            </div>
            <span className="text-[9px] font-bold text-foreground truncate">{match.homeTeam}</span>
          </div>
          {isLive && <span className="font-mono text-sm font-bold text-accent flex-shrink-0">{match.homeScore}</span>}
        </div>
        
        {/* Away */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-secondary/50 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
              A
            </div>
            <span className="text-[9px] font-bold text-foreground truncate">{match.awayTeam}</span>
          </div>
          {isLive && <span className="font-mono text-sm font-bold text-accent flex-shrink-0">{match.awayScore}</span>}
        </div>
      </div>

      {/* Odds */}
      <div className="p-2 bg-secondary/10 grid grid-cols-3 gap-1.5 border-t border-border/30">
        <OddsButton match={match} market="1" selection="1" odds={match.odds1} />
        <OddsButton match={match} market="X" selection="X" odds={match.oddsX} />
        <OddsButton match={match} market="2" selection="2" odds={match.odds2} />
      </div>
    </Card>
  );
}
