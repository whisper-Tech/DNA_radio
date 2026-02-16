import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';

describe('DNA Radio Socket Events', () => {
  let socket: Socket;
  const TEST_URL = 'http://localhost:3001';

  beforeEach(() => {
    socket = io(TEST_URL);
  });

  afterEach(() => {
    if (socket.connected) {
      socket.disconnect();
    }
  });

  it('should connect to socket server', (done) => {
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      done();
    });
  });

  it('should receive state updates', (done) => {
    socket.on('state_update', (state) => {
      expect(state).toHaveProperty('playlist');
      expect(state).toHaveProperty('currentSong');
      expect(state).toHaveProperty('serverTime');
      done();
    });

    // Trigger a state change
    socket.emit('ping');
  });

  it('should handle voting correctly', (done) => {
    socket.on('vote_result', (result) => {
      expect(result).toHaveProperty('songId');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('count');
      done();
    });

    socket.emit('vote', { songId: 'test-song-1', type: 'upvote' });
  });

  it('should handle song suggestions', (done) => {
    socket.on('suggestion_result', (result) => {
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('song');
      done();
    });

    socket.emit('select_suggestion', { 
      title: 'Test Song',
      artist: 'Test Artist',
      youtubeId: 'dQw4w9WgXcQ'
    });
  });

  it('should ping-pong for connection health', (done) => {
    const startTime = Date.now();
    
    socket.on('pong', () => {
      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(1000); // Should be fast
      done();
    });

    socket.emit('ping');
  });
});

describe('DNA Radio API Endpoints', () => {
  const BASE_URL = 'http://localhost:3001';

  it('GET /api/status should return server status', async () => {
    const response = await fetch(`${BASE_URL}/api/status`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('playlistSize');
    expect(data).toHaveProperty('listeners');
  });

  it('GET /api/sync should return full state', async () => {
    const response = await fetch(`${BASE_URL}/api/sync`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('playlist');
    expect(data).toHaveProperty('currentSong');
    expect(data).toHaveProperty('votes');
    expect(data).toHaveProperty('suggestions');
  });

  it('POST /api/add-song should add a new song', async () => {
    const newSong = {
      title: 'Test Song',
      artist: 'Test Artist',
      youtubeId: 'dQw4w9WgXcQ',
      duration: 213
    };

    const response = await fetch(`${BASE_URL}/api/add-song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSong)
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('id');
    expect(data.title).toBe(newSong.title);
  });

  it('POST /api/add-song should reject invalid data', async () => {
    const invalidSong = { title: 'Test' }; // Missing youtubeId

    const response = await fetch(`${BASE_URL}/api/add-song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidSong)
    });
    
    expect(response.status).toBe(400);
  });
});
