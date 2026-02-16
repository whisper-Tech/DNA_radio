import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { radio } from './state.js';
import * as db from './db.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all for dev
    methods: ["GET", "POST"]
  },
  // Optimize for low latency
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Root Route (Health Check)
app.get('/', (req, res) => {
  res.send('DNA Radio Server is Running. Connect via Socket.io or use /api/status');
});

// Basic API
app.get('/api/status', (req, res) => {
  res.json(radio.state);
});

// Full sync endpoint for debugging
app.get('/api/sync', (req, res) => {
  res.json(radio.getFullSyncState());
});

// Admin API endpoints
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = await db.getSongStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/songs', async (req, res) => {
  try {
    const songs = await db.getAllSongs();
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/plays', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const plays = await db.getRecentPlays(limit);
    res.json(plays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/songs/:id', async (req, res) => {
  try {
    await db.updateSong(req.params.id, { status: 'removed' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/songs/:id', async (req, res) => {
  try {
    const song = await db.updateSong(req.params.id, req.body);
    res.json({ success: true, song });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/add-song', async (req, res) => {
  try {
    const { title, artist, youtubeId, duration } = req.body;
    if (!title || !artist || !youtubeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const song = await radio.manualAdd(title, artist, youtubeId, duration);
    res.json({ success: true, song });
  } catch (err) {
    console.error('[API] Error in add-song:', err);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

// Socket.io
const connectedClients = new Map();

io.on('connection', async (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  
  // Generate device fingerprint from connection info
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const language = socket.handshake.headers['accept-language'] || '';
  const deviceFingerprint = Buffer.from(`${userAgent}-${language}-${socket.id}`).toString('base64').substring(0, 32);
  
  // Get or create user
  let user;
  try {
    user = await db.getOrCreateUser(deviceFingerprint);
    console.log(`[USER] Device fingerprint: ${deviceFingerprint.substring(0, 8)}... -> User ID: ${user.id}`);
  } catch (err) {
    console.error('[USER] Error creating user:', err);
    user = { id: socket.id }; // Fallback to socket ID
  }

  // Store user info with socket
  connectedClients.set(socket.id, { userId: user.id, deviceFingerprint });
  
  // Update listener count
  radio.updateListenerCount(connectedClients.size);

  // Send initial state with full sync info
  socket.emit('state_update', radio.getFullSyncState());

  // Handle ping for time synchronization (NTP-style)
  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', {
      clientTime: clientTime,
      serverTime: Date.now()
    });
  });

  // Handle Voting with user tracking
  socket.on('vote', async ({ songId, type }) => {
    try {
      const clientInfo = connectedClients.get(socket.id);
      const userId = clientInfo?.userId || socket.id;
      
      console.log(`[VOTE] ${type.toUpperCase()} on ${songId} by ${userId}`);
      await radio.vote(songId, type, userId, socket.id);
    } catch (err) {
      console.error('[SOCKET] Error handling vote:', err);
      socket.emit('error', { type: 'vote', message: 'Failed to process vote' });
    }
  });

  // Handle AI Suggestion Selection
  socket.on('select_suggestion', async ({ index }) => {
    try {
      console.log(`[SYNC] Suggestion ${index} selected by ${socket.id}`);
      await radio.selectAISuggestion(index, socket.id);
    } catch (err) {
      console.error('[SOCKET] Error handling select_suggestion:', err);
      socket.emit('error', { type: 'select_suggestion', message: 'Failed to select suggestion' });
    }
  });

  // Handle skip request
  socket.on('skip', async () => {
    try {
      const clientInfo = connectedClients.get(socket.id);
      if (!clientInfo) return;
      
      console.log(`[SKIP] Skip requested by ${clientInfo.userId}`);
      // Skip functionality - could be rate-limited or require multiple votes
      // For now, just log it
    } catch (err) {
      console.error('[SOCKET] Error handling skip:', err);
    }
  });

  // Handle explicit sync request
  socket.on('request_sync', () => {
    try {
      console.log(`[SYNC] Sync requested by ${socket.id}`);
      socket.emit('state_update', radio.getFullSyncState());
    } catch (err) {
      console.error('[SOCKET] Error handling request_sync:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    connectedClients.delete(socket.id);
    radio.updateListenerCount(connectedClients.size);
  });

  socket.on('error', (error) => {
    console.error(`[SOCKET] Error from ${socket.id}:`, error);
  });
});

// Broadcast updates when radio state changes
radio.on('update', (state) => {
  io.emit('state_update', {
    ...state,
    serverTime: Date.now()
  });
});

// Broadcast song removal events for cross-fade effect
radio.on('song_removed', ({ songId, nextIndex }) => {
  console.log(`[BROADCAST] Song removed event: ${songId}`);
  io.emit('song_removed', { songId, nextIndex });
});

// Broadcast immortal status events
radio.on('song_immortal', ({ songId, title }) => {
  console.log(`[BROADCAST] Song immortal event: ${title}`);
  io.emit('song_immortal', { songId, title });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[SERVER] DNA Radio running on http://localhost:${PORT}`);
  console.log(`[SERVER] WebSocket enabled with low-latency configuration`);
});
