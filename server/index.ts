import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Server } from "socket.io";
import { radio } from "./state-persisted";
import * as db from "./db";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket', 'polling']
});

const connectedClients = new Map();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

io.on('connection', async (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  const userAgent = socket.handshake.headers['user-agent'] || '';
  const language = socket.handshake.headers['accept-language'] || '';
  const deviceFingerprint = Buffer.from(`${userAgent}-${language}-${socket.id}`).toString('base64').substring(0, 32);

  let user;
  if (db.isDbEnabled()) {
    try {
      user = await db.getOrCreateUser(deviceFingerprint);
      console.log(`[USER] Device fingerprint: ${deviceFingerprint.substring(0, 8)}... -> User ID: ${user.id}`);
    } catch (err) {
      console.error('[USER] Error creating user:', err);
      user = { id: socket.id };
    }
  } else {
    user = { id: socket.id };
  }

  connectedClients.set(socket.id, { userId: user.id, deviceFingerprint });
  radio.updateListenerCount(connectedClients.size);

  socket.emit('state_update', radio.getFullSyncState());

  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', { clientTime, serverTime: Date.now() });
  });

  socket.on('vote', async ({ songId, type }) => {
    try {
      const clientInfo = connectedClients.get(socket.id);
      const userId = clientInfo?.userId || socket.id;
      console.log(`[VOTE] ${type.toUpperCase()} on ${songId} by ${userId}`);
      await radio.vote(songId, type, userId, socket.id ? socket.id : null);
    } catch (err) {
      console.error('[SOCKET] Error handling vote:', err);
      socket.emit('error', { type: 'vote', message: 'Failed to process vote' });
    }
  });

  socket.on('select_suggestion', async ({ index }) => {
    try {
      console.log(`[SYNC] Suggestion ${index} selected by ${socket.id}`);
      await radio.selectAISuggestion(index, socket.id);
    } catch (err) {
      console.error('[SOCKET] Error handling select_suggestion:', err);
      socket.emit('error', { type: 'select_suggestion', message: 'Failed to select suggestion' });
    }
  });

  socket.on('skip', async () => {
    try {
      const clientInfo = connectedClients.get(socket.id);
      if (!clientInfo) return;
      console.log(`[SKIP] Skip requested by ${clientInfo.userId}`);
      await radio.nextSong(true);
    } catch (err) {
      console.error('[SOCKET] Error handling skip:', err);
    }
  });

  socket.on('toggle_playback', () => {
    try {
      console.log(`[PLAYBACK] Toggle requested by ${socket.id}`);
      radio.togglePlayback();
    } catch (err) {
      console.error('[SOCKET] Error handling toggle_playback:', err);
    }
  });

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

radio.on('update', (state) => {
  io.emit('state_update', { ...state, serverTime: Date.now() });
});

radio.on('song_removed', ({ songId, nextIndex }) => {
  console.log(`[BROADCAST] Song removed event: ${songId}`);
  io.emit('song_removed', { songId, nextIndex });
});

radio.on('song_immortal', ({ songId, title }) => {
  console.log(`[BROADCAST] Song immortal event: ${title}`);
  io.emit('song_immortal', { songId, title });
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3001", 10);
  const host = process.env.HOST || "127.0.0.1";

  async function listenWithPortFallback(startPort: number) {
    for (let p = startPort; p < startPort + 25; p++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (err: any) => {
            httpServer.off("listening", onListening);
            reject(err);
          };
          const onListening = () => {
            httpServer.off("error", onError);
            resolve();
          };

          httpServer.once("error", onError);
          httpServer.once("listening", onListening);
          httpServer.listen({ port: p, host });
        });
        return p;
      } catch (err: any) {
        if (err?.code === "EADDRINUSE") {
          continue;
        }
        throw err;
      }
    }
    throw new Error(`No free port found in range ${startPort}-${startPort + 24}`);
  }

  const boundPort = await listenWithPortFallback(port);
  log(`serving on http://${host}:${boundPort}`);
})();
