import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useSports() {
  return useQuery({
    queryKey: [api.sports.list.path],
    queryFn: async () => {
      const res = await fetch(api.sports.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sports");
      return api.sports.list.responses[200].parse(await res.json());
    },
  });
}

export function useLeagues() {
  return useQuery({
    queryKey: ['betika-leagues'],
    queryFn: async () => {
      const res = await fetch('https://api-ug.betika.com/v1/sports');
      if (!res.ok) throw new Error("Failed to fetch leagues from Betika");
      const json = await res.json();
      
      // Map Betika sports/categories/competitions to our league structure
      const leagues: any[] = [];
      json.data.forEach((sport: any) => {
        sport.categories.forEach((category: any) => {
          category.competitions.forEach((comp: any) => {
            leagues.push({
              id: parseInt(comp.competition_id),
              name: comp.competition_name,
              sportId: parseInt(sport.sport_id),
              categoryName: category.category_name,
              categoryId: parseInt(category.category_id)
            });
          });
        });
      });
      return leagues;
    },
  });
}
