import type { Express } from "express";
import { createServer, type Server } from "http";
import { radio } from './state-persisted.js';
import * as db from './db.js';

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get('/api/status', (_req, res) => {
    res.json({
      status: 'ok',
      playlistSize: radio.state.playlist.length,
      listeners: radio.state.listenerCount
    });
  });

  app.get('/api/sync', (_req, res) => {
    res.json(radio.getFullSyncState());
  });

  app.post('/api/add-song', async (req, res) => {
    const { title, artist, youtubeId, duration } = req.body;
    if (!title || !youtubeId) {
      return res.status(400).json({ error: 'title and youtubeId required' });
    }
    const song = await radio.manualAdd(title, artist, youtubeId, duration);
    res.json(song);
  });

  app.get('/api/admin/stats', async (_req, res) => {
    try {
      const stats = await db.getSongStatistics();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/songs', async (_req, res) => {
    try {
      const songs = await db.getAllSongs();
      res.json(songs);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/plays', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const plays = await db.getRecentPlays(limit);
      res.json(plays);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/songs/:id', async (req, res) => {
    try {
      await db.updateSong(req.params.id, { status: 'removed' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/songs/:id', async (req, res) => {
    try {
      const song = await db.updateSong(req.params.id, req.body);
      res.json({ success: true, song });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return httpServer;
}
