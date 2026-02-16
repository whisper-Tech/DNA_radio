import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores anonymous users identified by device fingerprint
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  deviceFingerprint: text("device_fingerprint").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

// Songs table - stores all songs in the playlist
export const songs = pgTable("songs", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  uri: text("uri").notNull(),
  youtubeId: text("youtube_id"),
  duration: integer("duration"), // in milliseconds
  health: integer("health").notNull().default(0), // -10 to +10
  status: text("status").notNull().default("active"), // 'active' | 'immortal' | 'removed'
  totalPlays: integer("total_plays").notNull().default(0),
  totalAccepts: integer("total_accepts").notNull().default(0),
  totalRejects: integer("total_rejects").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastPlayedAt: timestamp("last_played_at"),
}, (table) => ({
  statusIdx: index("songs_status_idx").on(table.status),
  healthIdx: index("songs_health_idx").on(table.health),
}));

// Play history table - tracks each play instance
export const playHistory = pgTable("play_history", {
  id: varchar("id").primaryKey(),
  songId: varchar("song_id").notNull().references(() => songs.id, { onDelete: 'cascade' }),
  playNumber: integer("play_number").notNull(),
  playedAt: timestamp("played_at").notNull(),
  acceptsThisPlay: integer("accepts_this_play").notNull().default(0),
  rejectsThisPlay: integer("rejects_this_play").notNull().default(0),
  netScoreAfter: integer("net_score_after").notNull(),
  listenerCount: integer("listener_count").notNull().default(0),
}, (table) => ({
  songIdIdx: index("play_history_song_id_idx").on(table.songId),
  playedAtIdx: index("play_history_played_at_idx").on(table.playedAt),
}));

// Votes table - tracks individual user votes
export const votes = pgTable("votes", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  songId: varchar("song_id").notNull().references(() => songs.id),
  playId: varchar("play_id").notNull().references(() => playHistory.id),
  voteType: text("vote_type").notNull(), // 'accept' | 'reject'
  votedAt: timestamp("voted_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("votes_user_id_idx").on(table.userId),
  songIdIdx: index("votes_song_id_idx").on(table.songId),
  playIdIdx: index("votes_play_id_idx").on(table.playId),
  uniqueVote: index("votes_unique_idx").on(table.userId, table.playId),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  deviceFingerprint: true,
});

export const insertSongSchema = createInsertSchema(songs).pick({
  id: true,
  title: true,
  artist: true,
  uri: true,
  youtubeId: true,
  duration: true,
});

export const insertVoteSchema = createInsertSchema(votes).pick({
  userId: true,
  songId: true,
  playId: true,
  voteType: true,
});

// Type exports
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type PlayHistory = typeof playHistory.$inferSelect;
export type Vote = typeof votes.$inferSelect;
