import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { radio } from './state.js';

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

// Socket.io
io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Send initial state with full sync info
  socket.emit('state_update', radio.getFullSyncState());

  // Handle ping for time synchronization (NTP-style)
  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', {
      clientTime: clientTime,
      serverTime: Date.now()
    });
  });

  // Handle Voting
  socket.on('vote', ({ songId, type }) => {
    console.log(`[VOTE] ${type.toUpperCase()} on ${songId} by ${socket.id}`);
    radio.vote(songId, type);
  });

  // Handle explicit sync request
  socket.on('request_sync', () => {
    console.log(`[SYNC] Sync requested by ${socket.id}`);
    socket.emit('state_update', radio.getFullSyncState());
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SOCKET] Client disconnected: ${socket.id} (${reason})`);
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
