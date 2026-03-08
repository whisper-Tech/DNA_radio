import express from 'express';
import { radio } from './state.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = '0.0.0.0';

app.use(express.json());

const sseClients = new Set();

function broadcastState() {
  const payload = `event: state_update\ndata: ${JSON.stringify(radio.getFullSyncState())}\n\n`;
  for (const client of [...sseClients]) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

function sendState(res) {
  return res.json(radio.getFullSyncState());
}

app.get('/', (_req, res) => {
  res.send('DNA Radio shared station server is running.');
});

app.get('/api/status', (_req, res) => {
  sendState(res);
});

app.get('/api/sync', (_req, res) => {
  sendState(res);
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  sseClients.add(res);
  radio.updateListenerCount(sseClients.size);
  res.write(`event: state_update\ndata: ${JSON.stringify(radio.getFullSyncState())}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    radio.updateListenerCount(sseClients.size);
  });
});

app.post('/api/play', (req, res) => {
  const index = Number(req.body?.index || 0);
  const state = radio.playIndex(index);
  res.json(state);
});

app.post('/api/next', (req, res) => {
  const expectedStartTime = typeof req.body?.expectedStartTime === 'number'
    ? req.body.expectedStartTime
    : null;
  const state = radio.nextSong({ expectedStartTime });
  res.json(state);
});

app.post('/api/seek', (req, res) => {
  const seconds = Number(req.body?.seconds || 0);
  const state = radio.seek(seconds);
  res.json(state);
});

app.post('/api/reorder', (req, res) => {
  const fromIndex = Number(req.body?.fromIndex);
  const toIndex = Number(req.body?.toIndex);
  const state = radio.reorder(fromIndex, toIndex);
  res.json(state);
});

app.post('/api/add-song', async (req, res) => {
  try {
    const { title, artist, duration } = req.body || {};
    const song = await radio.manualAdd(title, artist, duration || 210);
    res.json({ ...radio.getFullSyncState(), addedSong: song });
  } catch (err) {
    res.status(400).json({ error: err?.message || 'Failed to add song' });
  }
});

radio.on('update', () => {
  broadcastState();
});

app.listen(PORT, HOST, () => {
  console.log(`[SERVER] DNA Radio shared station running at http://${HOST}:${PORT}`);
});
