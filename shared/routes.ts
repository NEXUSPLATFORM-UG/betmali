import { z } from 'zod';
import { insertBetSchema, matches, leagues, sports, bets } from './schema';

export { insertBetSchema };

export const api = {
  sports: {
    list: {
      method: 'GET' as const,
      path: '/api/sports',
      responses: {
        200: z.array(z.custom<typeof sports.$inferSelect>()),
      },
    },
  },
  leagues: {
    list: {
      method: 'GET' as const,
      path: '/api/leagues',
      responses: {
        200: z.array(z.custom<typeof leagues.$inferSelect>()),
      },
    },
  },
  matches: {
    list: {
      method: 'GET' as const,
      path: '/api/matches',
      input: z.object({
        sport: z.string().optional(),
        league: z.string().optional(),
        isLive: z.string().optional(), // "true" or "false"
        isHighlight: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof matches.$inferSelect & { league: typeof leagues.$inferSelect }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/matches/:id',
      responses: {
        200: z.custom<typeof matches.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  bets: {
    create: {
      method: 'POST' as const,
      path: '/api/bets',
      input: insertBetSchema,
      responses: {
        201: z.custom<typeof bets.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/bets',
      responses: {
        200: z.array(z.custom<typeof bets.$inferSelect & { match: typeof matches.$inferSelect }>()),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
