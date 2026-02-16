# DNA Radio Player - Windsurf Workflow & Operationalization Guide

> **Generated:** Feb 15, 2026 | **Status:** Audit Complete - Implementation Pending

---

## Executive Summary

The DNA Radio Player project has substantial foundation code but suffers from **runtime fragmentation** that causes inconsistent behavior. The AI testing/automation failures stem from architectural drift between legacy (`server/index.js`) and current (`server/index.ts`) entrypoints, not from isolated bugs.

**Primary Goal:** Unify to a single authoritative backend (`server/index.ts` + `state-persisted.ts` + `db.ts`) with deterministic AI service and full test coverage.

---

## 1. Critical Findings

### A. Runtime Fragmentation (HIGH RISK)

| Issue | Legacy Path | Current Path | Impact |
|-------|-------------|--------------|--------|
| Server entrypoint | `server/index.js` | `server/index.ts` | Inconsistent behavior depending on startup command |
| Radio state | `state.js` (in-memory) | `state-persisted.ts` (DB-backed) | Data persistence unpredictable |
| Socket handlers | Inline in `index.js` | Missing in `index.ts` | Automation targets wrong endpoint |
| API endpoints | `/api/status`, `/api/sync`, `/api/add-song` | None registered | Client requests 404 |

**Root Cause:** `server/index.ts` calls `registerRoutes()` which is an empty stub (`server/routes.ts#9-15`).

### B. Frontend Control Gaps

- **Play/Pause:** Visual button exists but no `onClick` handler (`src/pages/RadioPage.tsx#635-642`)
- **Stale closure bug:** Socket `state_update` handler compares stale `currentIndex` due to empty dependency array
- **No error feedback:** Drag/drop failures only log, no user-facing state

### C. AI Service Issues

| Issue | Location | Severity |
|-------|----------|----------|
| Hardcoded API key | `server/ai.js#6` | Critical |
| No timeout/retry | `server/ai.js#15-33` | High |
| No schema validation | `server/ai.js` | Medium |
| No health endpoint | Missing | Medium |

### D. Data/Security Concerns

- `drizzle.config.ts` throws if `DATABASE_URL` missing (blocks CI)
- Legacy server allows `*` CORS
- No payload validation middleware

---

## 2. Architecture Decision Record

```
┌─────────────────────────────────────────────────────────────────┐
│                    DNA Radio Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │   Client    │────▶│  Socket.io   │────▶│  RadioState     │  │
│  │  (React)    │◀────│  (ws)        │◀────│  (DB-backed)    │  │
│  └─────────────┘     └──────────────┘     └─────────────────┘  │
│        │                                          │            │
│        │                                          ▼            │
│  ┌─────────────┐                         ┌─────────────────┐  │
│  │  REST API   │                         │   Database      │  │
│  │  (Express) │                         │   (PostgreSQL)   │  │
│  └─────────────┘                         └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

DECISION: Single authoritative backend = server/index.ts + state-persisted.ts + db.ts
```

---

## 3. Implementation Phases

### Phase 0 — Lock Architecture

**Goal:** One startup mode, one expected contract.

**Actions:**
- [ ] Remove or explicitly mark `server/index.js` + `server/state.js` as legacy
- [ ] Update `package.json` scripts to only reference TS entrypoint
- [ ] Document startup procedure in `README.md`

**Acceptance:** `npm run dev` consistently exposes socket + API endpoints.

---

### Phase 1 — Rebuild Backend API + Realtime Contract

**File:** `server/index.ts`

```typescript
// Required additions to server/index.ts
import { radio } from './state-persisted.js';
import { Server } from 'socket.io';

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*' }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  radio.updateListenerCount(io.engine.clientsCount);
  
  // Send initial state
  socket.emit('state_update', radio.state);
  
  socket.on('ping', async (data) => {
    socket.emit('pong', { 
      clientTime: data.clientTime, 
      serverTime: Date.now() 
    });
  });
  
  socket.on('vote', async (data) => {
    await radio.vote(data.songId, data.type, data.userId, socket.id);
    io.emit('state_update', radio.state);
  });
  
  socket.on('select_suggestion', async (data) => {
    await radio.selectAISuggestion(data.index, data.voterId);
    io.emit('state_update', radio.state);
  });
  
  socket.on('disconnect', () => {
    radio.updateListenerCount(io.engine.clientsCount);
  });
});

// Broadcast state changes
radio.on('update', () => io.emit('state_update', radio.state));
radio.on('song_removed', (data) => io.emit('song_removed', data));
radio.on('song_immortal', (data) => io.emit('song_immortal', data));
```

**File:** `server/routes.ts`

```typescript
import type { Express } from "express";
import { createServer, type Server } from "http";
import { radio } from './state-persisted.js';

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

  return httpServer;
}
```

**Acceptance:** Client connects → receives full state → ping/pong works.

---

### Phase 2 — AI Service Hardening

**File:** `server/ai.ts` (refactor)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function getAISuggestions(currentSong: Song): Promise<AISuggestion[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] No API key configured, using fallback');
    return getFallbackSuggestions(currentSong);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Suggest 4 songs similar to "${currentSong.title}" by ${currentSong.artist}. Return JSON array with fields: title, artist, reason.`;
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }, {
      timeout: 10000, // 10s timeout
    });

    const text = result.response.text();
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[AI] Generation failed:', err);
    return getFallbackSuggestions(currentSong);
  }
}

function getFallbackSuggestions(currentSong: Song): AISuggestion[] {
  return [
    { title: 'Similar Track A', artist: 'Related Artist', reason: 'Matching energy' },
    { title: 'Similar Track B', artist: 'Related Artist', reason: 'Similar tempo' },
    { title: 'Similar Track C', artist: 'Related Artist', reason: 'Same era' },
    { title: 'Similar Track D', artist: 'Related Artist', reason: 'Popular in playlist' },
  ];
}
```

**Add health endpoint:**

```typescript
// In routes.ts
app.get('/api/ai/health', (_req, res) => {
  const healthy = !!process.env.GEMINI_API_KEY;
  res.json({ 
    status: healthy ? 'ok' : 'degraded',
    provider: healthy ? 'gemini' : 'fallback',
    lastCheck: Date.now()
  });
});
```

**Acceptance:** No unhandled parse failure; explicit error states when AI disabled.

---

### Phase 3 — Frontend Control Fixes

**File:** `src/pages/RadioPage.tsx`

```typescript
// Fix 1: Play/Pause handler
const handlePlayPause = useCallback(() => {
  if (!socket || !isConnected) return;
  socket.emit('control', { type: isPlaying ? 'pause' : 'play' });
}, [socket, isConnected, isPlaying]);

// Fix 2: Stale closure - use ref for current index
const currentIndexRef = useRef(currentIndex);
useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

useEffect(() => {
  newSocket.on('state_update', (state: any) => {
    // Use ref instead of stale closure value
    if (state.currentIndex !== currentIndexRef.current) {
      // Handle transition
    }
    setCurrentIndex(state.currentIndex);
    setPlaylist(state.playlist);
  });
}, []);

// Fix 3: Add error feedback for drag/drop
try {
  const response = await fetch('http://localhost:3001/api/add-song', {...});
  if (!response.ok) throw new Error('Failed to add song');
} catch (err) {
  console.error('[DROP] Failed:', err);
  setGlitchIntensity(0.8);
  setTimeout(() => setGlitchIntensity(0), 500);
  // Could add toast notification here
}
```

**Acceptance:** Controls functional, transitions deterministic.

---

### Phase 4 — UI Polish

**Suggested additions to `src/pages/RadioPage.tsx`:**

```typescript
// Compact control panel component
const ControlPanel = ({ drift, quality }) => (
  <div className="fixed bottom-4 left-4 bg-black/80 backdrop-blur p-4 rounded-lg border border-cyan-500/30">
    <div className="flex items-center gap-4">
      <button onClick={handlePlayPause} className="p-2 hover:bg-cyan-500/20 rounded">
        {isPlaying ? <Pause /> : <Play />}
      </button>
      <div className="text-xs font-mono">
        <div>Drift: {drift.toFixed(0)}ms</div>
        <div>Quality: {quality}</div>
      </div>
    </div>
  </div>
);

// Performance mode for mobile
const isLowPerf = useMemo(() => {
  if (typeof window === 'undefined') return false;
  return navigator.hardwareConcurrency <= 4;
}, []);
```

**Acceptance:** Stable FPS on target devices, visible controls.

---

### Phase 5 — Error Handling & Observability

**File:** `server/middleware/error.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const id = crypto.randomUUID();
  console.error(`[ERROR:${id}]`, err);
  
  // Don't leak stack in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
    
  res.status(err.status || 500).json({ error: message, id });
};

// Rate limiting example
import rateLimit from 'express-rate-limit';
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
```

**Acceptance:** Errors visible, recoverable, diagnosable.

---

### Phase 6 — Testing & CI

**File:** `package.json` additions

```json
{
  "scripts": {
    "test": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:ai": "vitest run --config vitest.ai.config.ts",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

**Test file:** `tests/smoke.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test('server starts and socket connects', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Wait for connection
  await expect(page.locator('[class*="text-cyan"]')).toContainText('DNA RADIO', { timeout: 10000 });
  
  // Verify socket state
  const state = await page.evaluate(() => window.__RADIO_STATE__);
  expect(state).toHaveProperty('playlist');
});
```

**Acceptance:** AI/automation starts reliably with explicit status.

---

## 4. Quick Wins (Day 1)

| Priority | Action | Files | Time |
|----------|--------|-------|------|
| 🔴 Critical | Remove legacy `server/index.js` or mark deprecated | Delete or rename | 5m |
| 🔴 Critical | Add API endpoints to `routes.ts` | `server/routes.ts` | 30m |
| 🟡 High | Fix play/pause `onClick` | `src/pages/RadioPage.tsx` | 15m |
| 🟡 High | Fix stale closure in socket handler | `src/pages/RadioPage.tsx` | 20m |
| 🟠 Medium | Add AI health endpoint | `server/routes.ts` | 15m |
| 🟠 Medium | Add error feedback for drag/drop | `src/pages/RadioPage.tsx` | 10m |

---

## 5. File Reference Map

```
c:/Coding/DNA_webapp_player/
├── server/
│   ├── index.ts          ← Main entry (needs socket + routes)
│   ├── index.js          ← Legacy (to be deprecated)
│   ├── routes.ts         ← Empty stub (needs implementation)
│   ├── state-persisted.ts ← DB-backed radio state
│   ├── state.js          ← Legacy (to be deprecated)
│   ├── db.ts             ← Database layer
│   ├── ai.js             ← AI service (needs hardening)
│   └── vite.ts           ← Vite middleware
├── client/src/
│   ├── pages/RadioPage.tsx ← Main UI (needs control fixes)
│   ├── components/DNAHelix/ ← 3D visualization
│   └── hooks/              ← Custom hooks
├── shared/schema.ts       ← DB schema
├── package.json           ← Scripts & deps
└── WINDSURF_WORKFLOW.md   ← This file
```

---

## 6. Next Steps

1. **Immediate:** Run `npm run dev` and verify current behavior
2. **Day 1:** Complete Quick Wins table above
3. **Week 1:** Complete Phases 1-3
4. **Week 2:** Complete Phases 4-6

---

## 7. Success Criteria

- [ ] Single `npm run dev` starts full stack
- [ ] Socket connects within 2s, receives state within 5s
- [ ] AI suggestions work (with fallback)
- [ ] All controls functional (play/pause/vote/skip)
- [ ] Tests pass in CI before merge
- [ ] No runtime fragmentation warnings in logs

---

*Document generated for Windsurf workflow optimization. Update as implementation progresses.*
