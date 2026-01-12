import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  phoneNumber: text("phone_number"),
  email: text("email"),
  balance: decimal("balance", { precision: 20, scale: 2 }).default("1000.00").notNull(),
});

export const sports = pgTable("sports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // e.g., Football, Basketball
  slug: text("slug").notNull().unique(),
});

export const leagues = pgTable("leagues", {
  id: text("id").primaryKey(),
  sportId: text("sport_id").notNull(),
  name: text("name").notNull(), // e.g., Premier League
  country: text("country").notNull(), // e.g., England
  flag: text("flag"), // Emoji or url
  isPopular: boolean("is_popular").default(false),
});

// Matches
export const matches = pgTable("matches", {
  id: text("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeLogo: text("home_logo"),
  awayLogo: text("away_logo"),
  startTime: timestamp("start_time").notNull(),
  status: text("status").notNull(), // 'live', 'upcoming', 'finished'
  
  // Live score info
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  currentMinute: text("current_minute"), // e.g. "33'" or "HT"

  // Main Odds (1X2)
  odds1: decimal("odds_1", { precision: 10, scale: 3 }),
  oddsX: decimal("odds_x", { precision: 10, scale: 3 }),
  odds2: decimal("odds_2", { precision: 10, scale: 3 }),

  // Handicap (A/1, A/2)
  handicapValue: text("handicap_value"), // e.g. "-1.5"
  oddsHandicap1: decimal("odds_handicap_1", { precision: 10, scale: 3 }),
  oddsHandicap2: decimal("odds_handicap_2", { precision: 10, scale: 3 }),

  // Over/Under (O/U)
  totalValue: text("total_value"), // e.g. "2.5"
  oddsOver: decimal("odds_over", { precision: 10, scale: 3 }),
  oddsUnder: decimal("odds_under", { precision: 10, scale: 3 }),
  
  // Extended Odds
  allOdds: jsonb("all_odds"), // Store full Betmaster API odds response

  isHighlight: boolean("is_highlight").default(false),
});

// Betslip
export const bets = pgTable("bets", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  selection: text("selection").notNull(), // '1', 'X', '2', etc.
  odds: decimal("odds", { precision: 10, scale: 3 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default('pending'), // pending, won, lost
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true });
export const insertBetSchema = createInsertSchema(bets).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type Bet = typeof bets.$inferSelect;
