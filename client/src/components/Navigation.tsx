import { Search, Trophy, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Navigation({ activeSport, setActiveSport, activeLeague, setActiveLeague, activeFilter, setActiveFilter }: { 
  activeSport: string | null, 
  setActiveSport: (s: string) => void,
  activeLeague: string | null,
  setActiveLeague: (l: string | null) => void,
  activeFilter?: string | null,
  setActiveFilter?: (f: string) => void
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col h-full bg-card text-[10px]">
      <div className="p-3 border-b border-border/50">
        <button 
          onClick={() => setActiveSport("virtual")}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
            activeSport === "virtual" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          VIRTUAL MATCHES
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-7 h-8 bg-secondary/30 border-transparent focus:border-primary/50 text-[9px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                // Toggle the Live filter without forcing the active sport.
                if (setActiveFilter) setActiveFilter(activeFilter === 'Live' ? 'All' : 'Live');
                setActiveLeague(null);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeFilter === 'Live' ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <img src="https://i.giphy.com/McsDYx2ihXzztTFMap.webp" alt="Live" className="w-4 h-4 object-contain" />
              LIVE
            </button>
            <button
              onClick={() => {
                setActiveSport("football");
                setActiveLeague(null);
                if (setActiveFilter) setActiveFilter('All');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeSport === "football" && !activeLeague ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center p-0.5 shrink-0">
                <img src="https://www.svgrepo.com/show/404149/soccer-ball.svg" className="w-3.5 h-3.5 object-contain" alt="Football" />
              </div>
              UPCOMING SOCCER
            </button>

            <button
              onClick={() => {
                setActiveSport("all-soccer");
                setActiveLeague(null);
                if (setActiveFilter) setActiveFilter('All');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeSport === "all-soccer" && !activeLeague ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 rounded bg-green-600 flex items-center justify-center p-0.5 shrink-0">
                <img src="https://www.svgrepo.com/show/404149/soccer-ball.svg" className="w-3.5 h-3.5 object-contain" alt="All Soccer" />
              </div>
              ALL SOCCER
            </button>

            <button
              onClick={() => {
                setActiveSport("basketball");
                setActiveLeague(null);
                if (setActiveFilter) setActiveFilter('All');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeSport === "basketball" && !activeLeague ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center p-0.5 shrink-0">
                <img src="https://www.svgrepo.com/show/513115/basketball.svg" className="w-3.5 h-3.5 object-contain" alt="Basketball" />
              </div>
              BASKETBALL
            </button>

            <button
              onClick={() => {
                setActiveSport("tennis");
                setActiveLeague(null);
                if (setActiveFilter) setActiveFilter('All');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeSport === "tennis" && !activeLeague ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center p-0.5 shrink-0">
                <img src="https://www.svgrepo.com/show/512962/tenis-786.svg" className="w-3.5 h-3.5 object-contain" alt="Tennis" />
              </div>
              TENNIS
            </button>

            <button
              onClick={() => {
                setActiveSport("cricket");
                setActiveLeague(null);
                if (setActiveFilter) setActiveFilter('All');
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-[10px] transition-all",
                activeSport === "cricket" && !activeLeague ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center p-0.5 shrink-0">
                <img src="https://www.svgrepo.com/show/203639/cricket.svg" className="w-3.5 h-3.5 object-contain" alt="Cricket" />
              </div>
              CRICKET
            </button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
