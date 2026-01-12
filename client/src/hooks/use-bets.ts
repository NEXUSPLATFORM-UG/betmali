import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type insertBetSchema } from "@shared/routes";
import { z } from "zod";

type InsertBet = z.infer<typeof insertBetSchema>;

export function useBets() {
  return useQuery({
    queryKey: [api.bets.list.path],
    queryFn: async () => {
      const res = await fetch(api.bets.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bets");
      return api.bets.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateBet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.bets.create.path, {
        method: api.bets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = await res.json();
          throw new Error(error.message);
        }
        throw new Error("Failed to place bet");
      }
      return api.bets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.bets.list.path] });
    },
  });
}
