import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const { Pool } = pg;

// Database connection
let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function isDbEnabled() {
  // Default: disabled unless a DATABASE_URL is explicitly provided.
  // This avoids noisy startup errors when Postgres isn't running locally.
  if (process.env.DB_DISABLED === "1") return false;
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.trim().length > 0;
}

export function getDatabase() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/dna_radio';
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  }
  return db;
}

// Song operations
export async function getAllSongs() {
  try {
    const database = getDatabase();
    return await database.select().from(schema.songs).orderBy(schema.songs.createdAt);
  } catch (err) {
    console.error('[DB] Error in getAllSongs:', err);
    return [];
  }
}

export async function getActiveSongs() {
  try {
    const database = getDatabase();
    return await database.select().from(schema.songs)
      .where(eq(schema.songs.status, 'active'))
      .orderBy(schema.songs.createdAt);
  } catch (err) {
    console.error('[DB] Error in getActiveSongs:', err);
    return [];
  }
}

export async function getSongById(id: string) {
  try {
    const database = getDatabase();
    const songs = await database.select().from(schema.songs).where(eq(schema.songs.id, id));
    return songs[0] || null;
  } catch (err) {
    console.error('[DB] Error in getSongById:', err);
    return null;
  }
}

export async function createSong(data: Omit<typeof schema.songs.$inferInsert, 'createdAt' | 'totalPlays' | 'totalAccepts' | 'totalRejects' | 'health' | 'status'>) {
  try {
    const database = getDatabase();
    const [song] = await database.insert(schema.songs).values({
      ...data,
      createdAt: new Date(),
      totalPlays: 0,
      totalAccepts: 0,
      totalRejects: 0,
      health: 0,
      status: 'active'
    }).returning();
    return song;
  } catch (err) {
    console.error('[DB] Error in createSong:', err);
    throw err;
  }
}

export async function updateSong(id: string, updates: Partial<typeof schema.songs.$inferInsert>) {
  try {
    const database = getDatabase();
    const [song] = await database.update(schema.songs)
      .set(updates)
      .where(eq(schema.songs.id, id))
      .returning();
    return song;
  } catch (err) {
    console.error('[DB] Error in updateSong:', err);
    throw err;
  }
}

export async function incrementSongStats(id: string, playNumber: number) {
  try {
    const database = getDatabase();
    const [song] = await database.update(schema.songs)
      .set({
        totalPlays: sql`${schema.songs.totalPlays} + 1`,
        lastPlayedAt: new Date()
      })
      .where(eq(schema.songs.id, id))
      .returning();
    return song;
  } catch (err) {
    console.error('[DB] Error in incrementSongStats:', err);
    return null;
  }
}

// Play history operations
export async function createPlayHistory(data: Omit<typeof schema.playHistory.$inferInsert, 'id' | 'playedAt' | 'acceptsThisPlay' | 'rejectsThisPlay'>) {
  try {
    const database = getDatabase();
    const [play] = await database.insert(schema.playHistory).values({
      ...data,
      id: `play_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playedAt: new Date(),
      acceptsThisPlay: 0,
      rejectsThisPlay: 0
    }).returning();
    return play;
  } catch (err) {
    console.error('[DB] Error in createPlayHistory:', err);
    throw err;
  }
}

export async function updatePlayHistory(id: string, updates: Partial<typeof schema.playHistory.$inferInsert>) {
  try {
    const database = getDatabase();
    const [play] = await database.update(schema.playHistory)
      .set(updates)
      .where(eq(schema.playHistory.id, id))
      .returning();
    return play;
  } catch (err) {
    console.error('[DB] Error in updatePlayHistory:', err);
    throw err;
  }
}

export async function getCurrentPlayHistory(songId: string) {
  try {
    const database = getDatabase();
    const plays = await database.select().from(schema.playHistory)
      .where(eq(schema.playHistory.songId, songId))
      .orderBy(desc(schema.playHistory.playedAt))
      .limit(1);
    return plays[0] || null;
  } catch (err) {
    console.error('[DB] Error in getCurrentPlayHistory:', err);
    return null;
  }
}

// Vote operations
export async function createVote(data: Omit<typeof schema.votes.$inferInsert, 'id' | 'votedAt'>) {
  try {
    const database = getDatabase();
    const [vote] = await database.insert(schema.votes).values({
      ...data,
      id: `vote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      votedAt: new Date()
    }).returning();
    return vote;
  } catch (err) {
    console.error('[DB] Error in createVote:', err);
    throw err;
  }
}

export async function hasUserVoted(userId: string, playId: string) {
  try {
    const database = getDatabase();
    const votes = await database.select().from(schema.votes)
      .where(and(
        eq(schema.votes.userId, userId),
        eq(schema.votes.playId, playId)
      ))
      .limit(1);
    return votes.length > 0;
  } catch (err) {
    console.error('[DB] Error in hasUserVoted:', err);
    return false;
  }
}

export async function getVotesForPlay(playId: string) {
  try {
    const database = getDatabase();
    return await database.select().from(schema.votes)
      .where(eq(schema.votes.playId, playId));
  } catch (err) {
    console.error('[DB] Error in getVotesForPlay:', err);
    return [];
  }
}

// User operations
export async function getOrCreateUser(deviceFingerprint: string) {
  try {
    const database = getDatabase();
    let users = await database.select().from(schema.users)
      .where(eq(schema.users.deviceFingerprint, deviceFingerprint))
      .limit(1);
    
    if (users.length > 0) {
      // Update last seen
      await database.update(schema.users)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.users.id, users[0].id));
      return users[0];
    }
    
    // Create new user
    const [user] = await database.insert(schema.users).values({
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deviceFingerprint,
      createdAt: new Date(),
      lastSeenAt: new Date()
    }).returning();
    return user;
  } catch (err) {
    console.error('[DB] Error in getOrCreateUser:', err);
    throw err;
  }
}

// Statistics operations
export async function getSongStatistics() {
  try {
    const database = getDatabase();
    const songs = await database.select().from(schema.songs);
    
    return {
      total: songs.length,
      active: songs.filter(s => s.status === 'active').length,
      immortal: songs.filter(s => s.status === 'immortal').length,
      removed: songs.filter(s => s.status === 'removed').length,
      topRated: songs
        .filter(s => s.status !== 'removed')
        .sort((a, b) => b.health - a.health)
        .slice(0, 10),
      atRisk: songs
        .filter(s => s.status === 'active' && s.health <= -8 && s.health >= -10),
      recentRemovals: songs
        .filter(s => s.status === 'removed')
        .sort((a, b) => (b.lastPlayedAt?.getTime() || 0) - (a.lastPlayedAt?.getTime() || 0))
        .slice(0, 10)
    };
  } catch (err) {
    console.error('[DB] Error in getSongStatistics:', err);
    return {
      total: 0,
      active: 0,
      immortal: 0,
      removed: 0,
      topRated: [],
      atRisk: [],
      recentRemovals: []
    };
  }
}

export async function getRecentPlays(limit = 20) {
  try {
    const database = getDatabase();
    return await database.select().from(schema.playHistory)
      .orderBy(desc(schema.playHistory.playedAt))
      .limit(limit);
  } catch (err) {
    console.error('[DB] Error in getRecentPlays:', err);
    return [];
  }
}

// Cleanup
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
