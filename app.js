/**
 * DNA RADIO // WHISPER COLLEGE — v16
 * Shared family station + Spotify primary + YouTube fallback
 */

import {
  getStoredToken, handleCallback, initSpotifyPlayer,
  spotifyPlay, spotifyPause, spotifySeek, spotifySetVolume,
  clearTokens, markAutoPlayHandled,
} from './spotify-auth.js';
import { youtubePlayer } from './youtube.js';
import { PLAYLIST } from './playlist-data.js';

const META_API_BASE = document.querySelector('meta[name="dna-radio-api-base"]')?.getAttribute('content')?.trim() || '';
const WINDOW_API_BASE = typeof window !== 'undefined' && typeof window.DNA_RADIO_API_BASE === 'string'
  ? window.DNA_RADIO_API_BASE.trim()
  : '';
const PLACEHOLDER_API_BASE = new URL('__PORT_3001__/', window.location.href).toString().replace(/\/$/, '');
const SAME_ORIGIN_API_BASE = window.location.origin;
const API_BASE = (WINDOW_API_BASE || META_API_BASE || PLACEHOLDER_API_BASE || SAME_ORIGIN_API_BASE).replace(/\/$/, '');
const HAS_SHARED_BACKEND = Boolean(WINDOW_API_BASE || META_API_BASE || !PLACEHOLDER_API_BASE.includes('__PORT_3001__'));

const sharedSync = {
  socket: null,
  pollTimer: null,
  reconnectTimer: null,
  lastQueueSignature: '',
};

// ====================================================
// PLAYLIST DATA
// ====================================================
// ====================================================
// APP STATE
// ====================================================
const state = {
  phase: 'void',
  currentIndex: -1,
  queue: [...PLAYLIST],
  isPlaying: false,
  votes: {},
  healthScores: {},
  progress: 0,
  duration: 0,
  audioSource: 'none',
  spotifyAvailable: false,
  stationReady: false,
  serverTimeOffset: 0,
  currentSongStartTime: 0,
  listenerCount: 0,
  playbackMode: HAS_SHARED_BACKEND ? 'shared' : 'local',
};

let _playRequestToken = 0;

// ====================================================
// STATUS BAR CLOCK
// ====================================================
function updateStatusTime() {
  const el = document.getElementById('status-time');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateStatusTime, 1000);
updateStatusTime();

// ====================================================
// PHASE 1: THE VOID
// ====================================================
const voidCanvas = document.getElementById('void-canvas');
const voidCtx = voidCanvas.getContext('2d');
let stars = [], beaconStar = null;
let holdStart = null, holdProgress = 0, holdActive = false;
const HOLD_DURATION = 2000;

function resizeVoidCanvas() {
  voidCanvas.width = window.innerWidth;
  voidCanvas.height = window.innerHeight;
}

function createStars() {
  stars = [];
  const count = Math.floor((window.innerWidth * window.innerHeight) / 4000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * voidCanvas.width,
      y: Math.random() * voidCanvas.height,
      r: Math.random() * 0.8 + 0.1,
      alpha: Math.random() * 0.3 + 0.02,
      twinkleSpeed: Math.random() * 0.015 + 0.003,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
  beaconStar = {
    x: voidCanvas.width * 0.5 + (Math.random() - 0.5) * 120,
    y: voidCanvas.height * 0.45 + (Math.random() - 0.5) * 120,
    r: 1.5,
    alpha: 0.5,
  };
}

let voidAnimFrame = null;
function animateVoid() {
  voidCtx.clearRect(0, 0, voidCanvas.width, voidCanvas.height);
  const t = Date.now() * 0.001;
  for (const s of stars) {
    s.twinklePhase += s.twinkleSpeed;
    const a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinklePhase));
    voidCtx.beginPath();
    voidCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(255,255,255,${a})`;
    voidCtx.fill();
  }
  if (beaconStar) {
    const pulse = 0.3 + 0.2 * Math.sin(t * 1.5);
    voidCtx.beginPath();
    voidCtx.arc(beaconStar.x, beaconStar.y, beaconStar.r + pulse * 0.5, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(200,220,255,${pulse})`;
    voidCtx.fill();
    if (holdActive && holdProgress > 0) {
      const angle = -Math.PI / 2 + holdProgress * Math.PI * 2;
      voidCtx.beginPath();
      voidCtx.arc(beaconStar.x, beaconStar.y, 18, -Math.PI / 2, angle);
      voidCtx.strokeStyle = `rgba(0,229,255,${0.3 + holdProgress * 0.7})`;
      voidCtx.lineWidth = 1.5;
      voidCtx.stroke();
    }
  }
  voidAnimFrame = requestAnimationFrame(animateVoid);
}

function isOnBeacon(x, y) {
  if (!beaconStar) return false;
  const dx = x - beaconStar.x, dy = y - beaconStar.y;
  return Math.sqrt(dx * dx + dy * dy) < 30;
}

let holdRAF = null;
function startHold(x, y) {
  if (!isOnBeacon(x, y)) return;
  holdActive = true;
  holdStart = Date.now();
  animateHold();
}

function animateHold() {
  if (!holdActive) return;
  holdProgress = Math.min((Date.now() - holdStart) / HOLD_DURATION, 1);
  if (holdProgress >= 1) { triggerReveal(); return; }
  holdRAF = requestAnimationFrame(animateHold);
}

function cancelHold() {
  holdActive = false; holdProgress = 0; holdStart = null;
}

voidCanvas.addEventListener('mousedown', e => startHold(e.offsetX, e.offsetY));
voidCanvas.addEventListener('mouseup', cancelHold);
voidCanvas.addEventListener('mouseleave', cancelHold);
voidCanvas.addEventListener('touchstart', e => {
  const r = voidCanvas.getBoundingClientRect();
  startHold(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
  e.preventDefault();
}, { passive: false });
voidCanvas.addEventListener('touchend', cancelHold);
voidCanvas.addEventListener('touchcancel', cancelHold);

window.addEventListener('resize', () => { resizeVoidCanvas(); createStars(); });

// ====================================================
// PHASE 1.5: REVEAL
// ====================================================
async function triggerReveal() {
  holdActive = false;
  state.phase = 'reveal';
  cancelAnimationFrame(voidAnimFrame);

  const voidEl = document.getElementById('phase-void');
  voidEl.style.transition = 'opacity 1.5s ease';
  voidEl.style.opacity = '0.3';

  const revealEl = document.getElementById('phase-reveal');
  revealEl.classList.remove('hidden');

  const textEl = document.getElementById('reveal-text');
  const fullText = 'Whisper ~ College';
  let i = 0;
  await new Promise(resolve => {
    const typeTimer = setInterval(() => {
      i++;
      textEl.textContent = fullText.slice(0, i);
      if (i >= fullText.length) { clearInterval(typeTimer); resolve(); }
    }, 90);
  });

  await new Promise(r => setTimeout(r, 1800));

  revealEl.style.transition = 'opacity 1.2s ease';
  revealEl.style.opacity = '0';
  voidEl.style.opacity = '0';

  await new Promise(r => setTimeout(r, 1200));
  voidEl.classList.add('hidden');
  revealEl.classList.add('hidden');

  initMainInterface();
}

// ====================================================
// PHASE 2: MAIN INTERFACE
// ====================================================
async function initMainInterface() {
  state.phase = 'main';
  const mainEl = document.getElementById('phase-main');
  mainEl.classList.remove('hidden');
  mainEl.style.opacity = '0';
  mainEl.style.transition = 'opacity 1.2s ease';

  buildSidebar();
  buildMobileList();
  setupHUD();
  setupSidebarDrag();
  setupAddSongForms();
  updateStationMeta();

  setTimeout(() => { mainEl.style.opacity = '1'; }, 50);

  await initAudio();
  await initStationSync();

  if (window.innerWidth > 768) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    initHelix();
  }

  if (!document.getElementById('inject-toast')) {
    const toast = document.createElement('div');
    toast.id = 'inject-toast';
    document.body.appendChild(toast);
  }
}

// ====================================================
// AUDIO INIT
// ====================================================
async function initAudio() {
  const token = getStoredToken();
  if (token) {
    updateSourceIndicator('Connecting to Spotify...');
    try {
      const player = await Promise.race([
        initSpotifyPlayer(handleSpotifyState),
        new Promise(resolve => setTimeout(() => resolve(null), 8000)),
      ]);
      if (player) {
        state.spotifyAvailable = true;
        state.audioSource = 'spotify';
        updateSourceIndicator('SPOTIFY');
        console.log('[Radio] Spotify connected');
        youtubePlayer.init();
        youtubePlayer.onStateChange(handleYouTubeState);
        youtubePlayer.onTrackEnd(handleTrackEnd);
        return;
      }
    } catch (e) {
      console.warn('[Radio] Spotify init failed:', e.message);
    }
  }
  state.audioSource = 'youtube';
  youtubePlayer.init();
  youtubePlayer.onStateChange(handleYouTubeState);
  youtubePlayer.onTrackEnd(handleTrackEnd);
  updateSourceIndicator('YOUTUBE');
  console.log('[Radio] Using YouTube fallback');
}

function handleSpotifyState(spotifyState) {
  if (!spotifyState) return;
  const pos = spotifyState.position / 1000;
  const dur = spotifyState.duration / 1000;
  state.isPlaying = !spotifyState.paused;
  state.progress = pos;
  state.duration = dur;
  updateProgressUI();

  if (spotifyState.paused && pos === 0 && spotifyState.track_window?.previous_tracks?.length > 0) {
    handleTrackEnd();
  }
}

function handleYouTubeState(ytState) {
  state.isPlaying = ytState.isPlaying;
  state.progress = ytState.progress;
  state.duration = ytState.duration || state.duration;
  updateProgressUI();
}

function handleTrackEnd() {
  console.log('[Radio] Track ended');
  if (HAS_SHARED_BACKEND) {
    requestStationAction('/api/next', { expectedStartTime: state.currentSongStartTime }).catch(err => {
      console.warn('[Radio] Shared next-track request failed:', err.message);
    });
    return;
  }
  const next = (state.currentIndex + 1) % state.queue.length;
  playTrackAtIndex(next, 0);
}

// ====================================================
// SHARED STATION SYNC
// ====================================================
async function initStationSync() {
  if (HAS_SHARED_BACKEND) {
    await fetchStationSync(true);
    connectSharedStream();
    if (!sharedSync.pollTimer) {
      sharedSync.pollTimer = setInterval(() => {
        fetchStationSync(false).catch(() => {});
      }, 15000);
    }
    return;
  }

  state.stationReady = true;
  state.currentSongStartTime = Date.now();
  await playTrackAtIndex(0, 0, { localOnly: true, forceRestart: true });
}

async function fetchStationSync(forcePlay = false) {
  const res = await fetch(`${API_BASE}/api/sync`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  const syncState = await res.json();
  await applySharedState(syncState, { forcePlay });
}

function connectSharedStream() {
  if (!HAS_SHARED_BACKEND || sharedSync.stream) return;
  const stream = new EventSource(`${API_BASE}/api/events`);
  sharedSync.stream = stream;

  stream.addEventListener('state_update', async (event) => {
    try {
      const payload = JSON.parse(event.data);
      await applySharedState(payload, { forcePlay: false });
    } catch (err) {
      console.warn('[Radio] Shared update parse failed:', err.message);
    }
  });

  stream.onerror = () => {
    updateStationMeta('Reconnecting');
  };

  stream.onopen = () => {
    updateStationMeta();
  };
}

function normalizeDurationSeconds(rawDuration) {
  const value = Number(rawDuration || 0);
  if (!value) return 210;
  return value > 1000 ? Math.round(value / 1000) : Math.round(value);
}

function normalizeTrack(song, idx = 0) {
  const fallback = PLAYLIST.find(item => item.id === song.id)
    || PLAYLIST.find(item => item.title === song.title && item.artist === song.artist)
    || {};

  return {
    ...fallback,
    ...song,
    id: song.id || fallback.id || `shared_${idx}`,
    title: song.title || fallback.title || 'Unknown Track',
    artist: song.artist || fallback.artist || 'Unknown Artist',
    spotifyUri: song.spotifyUri || song.uri || fallback.spotifyUri || null,
    youtubeId: song.youtubeId || fallback.youtubeId || null,
    duration: normalizeDurationSeconds(song.duration || fallback.duration),
    health: Number(song.health || fallback.health || 0),
  };
}

function queueSignature(queue) {
  return queue.map(song => `${song.id}|${song.title}|${song.artist}`).join('||');
}

function getTargetSeekSeconds(syncState) {
  const serverNow = Date.now() + state.serverTimeOffset;
  if (syncState.isPlaying === false) {
    return Math.max(0, (syncState.currentPosition || 0) / 1000);
  }
  return Math.max(0, (serverNow - (syncState.songStartTime || serverNow)) / 1000);
}

async function applySharedState(syncState, { forcePlay = false } = {}) {
  if (!syncState) return;

  if (typeof syncState.serverTime === 'number') {
    state.serverTimeOffset = syncState.serverTime - Date.now();
  }

  const nextQueue = (syncState.playlist || syncState.queue || state.queue).map(normalizeTrack);
  const nextSignature = queueSignature(nextQueue);
  const queueChanged = nextSignature !== sharedSync.lastQueueSignature;
  state.queue = nextQueue;
  sharedSync.lastQueueSignature = nextSignature;

  if (queueChanged) {
    buildSidebar();
    buildMobileList();
    setupAddSongForms();
    if (window.helixRebuild) window.helixRebuild();
  }

  state.listenerCount = Number(syncState.listenerCount || 0);
  state.isPlaying = syncState.isPlaying !== false;
  state.currentSongStartTime = syncState.songStartTime || Date.now();

  const nextIndex = Math.max(0, Math.min(Number(syncState.currentIndex || 0), Math.max(state.queue.length - 1, 0)));
  const nextSong = state.queue[nextIndex];
  if (!nextSong) return;

  const targetSeek = Math.min(getTargetSeekSeconds(syncState), nextSong.duration || 210);
  const indexChanged = state.currentIndex !== nextIndex;
  const drift = Math.abs((state.progress || 0) - targetSeek);

  state.currentIndex = nextIndex;
  updateHUDForTrack(nextSong);
  updateSidebarActiveState(nextSong.id);
  updateMobileActiveState(nextSong.id);
  updateStationMeta();

  if (window.helixSetCurrentTrack && (indexChanged || forcePlay || !state.stationReady)) {
    window.helixSetCurrentTrack(nextIndex);
  }

  if (!state.stationReady || indexChanged || forcePlay || drift > 2.5) {
    await playTrackAtIndex(nextIndex, targetSeek, { localOnly: true, forceRestart: true });
  } else if (drift > 1.2) {
    if (state.audioSource === 'spotify') spotifySeek(targetSeek * 1000);
    else youtubePlayer.seek(targetSeek);
    state.progress = targetSeek;
    updateProgressUI();
  }

  if (!state.isPlaying) {
    if (state.audioSource === 'spotify') spotifyPause();
    else youtubePlayer.pause();
  }

  state.stationReady = true;
}

async function requestStationAction(path, body = {}) {
  if (!HAS_SHARED_BACKEND) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  const payload = await res.json().catch(() => null);
  if (payload) {
    await applySharedState(payload, { forcePlay: true });
  }
  return payload;
}

async function resolveSpotifyUri(song) {
  if (!song) return null;
  if (song.spotifyUri) {
    song._spotifyUriResolved = true;
    return song.spotifyUri;
  }
  if (song._spotifyUriResolved) return null;

  const token = getStoredToken();
  if (!token) return null;

  try {
    const query = `track:${song.title} artist:${song.artist}`;
    const url = `https://api.spotify.com/v1/search?${new URLSearchParams({
      q: query,
      type: 'track',
      limit: '3',
    }).toString()}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!resp.ok) {
      if (resp.status === 401) clearTokens();
      return null;
    }

    const data = await resp.json();
    const items = data?.tracks?.items || [];
    const exactish = items.find(item => {
      const itemTitle = (item.name || '').toLowerCase().trim();
      const itemArtists = (item.artists || []).map(a => (a.name || '').toLowerCase());
      return itemTitle === song.title.toLowerCase().trim()
        && itemArtists.some(name => name.includes(song.artist.toLowerCase().split(',')[0].trim()));
    });
    const winner = exactish || items[0] || null;
    if (winner?.uri) {
      song.spotifyUri = winner.uri;
      song._spotifyUriResolved = true;
      return winner.uri;
    }
  } catch (e) {
    console.warn(`[Radio] Spotify URI lookup failed for "${song.title}":`, e.message);
  }

  song._spotifyUriResolved = true;
  return null;
}

async function playTrackAtIndex(index, seekSeconds, options = {}) {
  const { localOnly = false, forceRestart = false } = options;
  const playToken = ++_playRequestToken;
  const normalizedIndex = Math.max(0, Math.min(index, state.queue.length - 1));
  const song = state.queue[normalizedIndex];
  if (!song) return;

  const sameTrack = state.currentIndex === normalizedIndex;
  state.currentIndex = normalizedIndex;
  state.progress = seekSeconds || 0;
  state.duration = song.duration || state.duration;

  updateHUDForTrack(song);
  updateSidebarActiveState(song.id);
  updateMobileActiveState(song.id);
  if (window.helixSetCurrentTrack && (!sameTrack || forceRestart || !state.stationReady)) {
    window.helixSetCurrentTrack(normalizedIndex);
  }

  markAutoPlayHandled();

  if (state.spotifyAvailable) {
    await resolveSpotifyUri(song);
    if (playToken !== _playRequestToken) return;
  }

  if (!sameTrack || forceRestart || !state.stationReady) {
    startVisualizerForTrack(song);

    if (state.spotifyAvailable && song.spotifyUri) {
      youtubePlayer.pause();
      await spotifyPlay(song.spotifyUri, (seekSeconds || 0) * 1000);
      if (state.audioSource !== 'spotify') {
        state.audioSource = 'spotify';
        updateSourceIndicator('SPOTIFY');
      }
    } else {
      if (state.spotifyAvailable) {
        spotifyPause();
      }
      youtubePlayer.play(song.youtubeId, seekSeconds || 0);
      if (state.audioSource !== 'youtube') {
        state.audioSource = 'youtube';
        updateSourceIndicator('YOUTUBE (fallback)');
      }
    }
  } else if ((seekSeconds || 0) >= 0) {
    if (state.audioSource === 'spotify') spotifySeek((seekSeconds || 0) * 1000);
    else youtubePlayer.seek(seekSeconds || 0);
  }

  state.isPlaying = true;
  updateProgressUI();

  if (!localOnly && HAS_SHARED_BACKEND) {
    state.currentSongStartTime = Date.now() + state.serverTimeOffset - ((seekSeconds || 0) * 1000);
  }
  state.stationReady = true;
}

async function playNext() {
  if (HAS_SHARED_BACKEND) {
    await requestStationAction('/api/next', { expectedStartTime: state.currentSongStartTime });
    return;
  }
  const next = (state.currentIndex + 1) % state.queue.length;
  playTrackAtIndex(next, 0);
}

async function playPrev() {
  if (HAS_SHARED_BACKEND) {
    const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
    await requestStationAction('/api/play', { index: prev });
    return;
  }
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  playTrackAtIndex(prev, 0);
}

async function playTrackManual(index) {
  if (HAS_SHARED_BACKEND) {
    await requestStationAction('/api/play', { index });
    return;
  }
  playTrackAtIndex(index, 0);
}

// ====================================================
// HUD SETUP
// ====================================================
function setupHUD() {
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-prev').addEventListener('click', () => { playPrev().catch(err => console.warn(err)); });
  document.getElementById('btn-next').addEventListener('click', () => { playNext().catch(err => console.warn(err)); });
  document.getElementById('volume-slider').addEventListener('input', () => {
    const val = parseInt(document.getElementById('volume-slider').value);
    document.getElementById('vol-val').textContent = val;
    if (state.audioSource === 'spotify') spotifySetVolume(val / 100);
    else youtubePlayer.setVolume(val);
  });
  document.getElementById('hud-progress-bar').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const targetSeconds = frac * state.duration;
    if (HAS_SHARED_BACKEND) {
      requestStationAction('/api/seek', { seconds: targetSeconds }).catch(err => {
        console.warn('[Radio] Shared seek failed:', err.message);
      });
      return;
    }
    if (state.audioSource === 'spotify') spotifySeek(targetSeconds * 1000);
    else youtubePlayer.seek(targetSeconds);
  });

  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      sidebarToggle.classList.toggle('sidebar-open');
    });
  }
}

function updateHUDForTrack(song) {
  document.getElementById('hud-title').textContent = song.title;
  document.getElementById('hud-artist').textContent = song.artist;
  document.getElementById('hud-time-cur').textContent = '0:00';
  document.getElementById('hud-time-total').textContent = formatTime(song.duration || state.duration || 0);
  const ss = document.getElementById('source-status');
  if (ss) {
    ss.textContent = state.audioSource === 'spotify' ? '\u266b SPOTIFY' : '\u25b6 YOUTUBE';
    ss.className = state.audioSource === 'spotify' ? 'source-spotify' : 'source-youtube';
  }
}

function updateProgressUI() {
  const dur = state.duration || 1;
  const frac = Math.min(state.progress / dur, 1);
  document.getElementById('hud-progress-fill').style.width = (frac * 100) + '%';
  document.getElementById('hud-progress-thumb').style.left = (frac * 100) + '%';
  document.getElementById('hud-time-cur').textContent = formatTime(state.progress);
  document.getElementById('hud-time-total').textContent = formatTime(dur);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function updateSourceIndicator(text) {
  const ss = document.getElementById('source-status');
  if (ss) {
    ss.textContent = text === 'SPOTIFY' ? '\u266b SPOTIFY' : text === 'YOUTUBE' ? '\u25b6 YOUTUBE' : text;
    ss.className = text === 'SPOTIFY' ? 'source-spotify' : 'source-youtube';
  }
}

function updateStationMeta(statusLabel = null) {
  const modeText = HAS_SHARED_BACKEND ? 'Shared family station' : 'Local preview mode';
  const statusText = statusLabel || (state.stationReady ? 'Live sync ready' : 'Tuning');
  const listenersText = HAS_SHARED_BACKEND ? ` · listeners ${Math.max(state.listenerCount, 1)}` : '';
  const fullText = `${modeText} · ${statusText}${listenersText}`;

  const modeEl = document.getElementById('station-mode');
  if (modeEl) {
    modeEl.textContent = fullText;
  }

  const mobileEl = document.getElementById('mobile-station-mode');
  if (mobileEl) {
    mobileEl.textContent = fullText;
  }
}

// ====================================================
// MUTE
// ====================================================
let isMuted = false;
function toggleMute() {
  isMuted = !isMuted;
  const vol = isMuted ? 0 : parseInt(document.getElementById('volume-slider').value);
  if (state.audioSource === 'spotify') spotifySetVolume(vol / 100);
  else youtubePlayer.setVolume(vol);
  document.getElementById('unmuted-icon').classList.toggle('hidden', isMuted);
  document.getElementById('muted-icon').classList.toggle('hidden', !isMuted);
  document.getElementById('btn-mute').classList.toggle('is-muted', isMuted);
}

// ====================================================
// SIDEBAR
// ====================================================
function buildSidebar() {
  const list = document.getElementById('sidebar-list');
  list.innerHTML = '';
  document.getElementById('song-count').textContent = state.queue.length;
  state.queue.forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'sidebar-track';
    item.dataset.id = song.id;
    item.dataset.idx = idx;
    const score = song.health || 0;
    item.innerHTML = `
      <svg class="track-icon" viewBox="0 0 16 16" fill="none">
        <path d="M11.5 3.5a2.5 2.5 0 010 5H9V3.5h2.5z" fill="currentColor" opacity="0.7"/>
        <rect x="4" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.5"/>
      </svg>
      <div class="track-info">
        <div class="track-title">${esc(song.title)}</div>
        <div class="track-artist">${esc(song.artist)}</div>
      </div>
      <div class="track-health ${score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero'}">${score !== 0 ? (score > 0 ? '+' : '') + score : '\u00b7'}</div>
    `;
    item.addEventListener('click', () => {
      if (!sidebarDragState.active) playTrackManual(idx);
    });
    list.appendChild(item);
  });

  const addPanel = document.createElement('div');
  addPanel.className = 'queue-add-panel';
  addPanel.innerHTML = `
    <div class="queue-add-title">FAMILY QUEUE</div>
    <form id="sidebar-add-form" class="queue-add-form">
      <input type="text" name="title" placeholder="Song title" autocomplete="off" required />
      <input type="text" name="artist" placeholder="Artist" autocomplete="off" required />
      <button type="submit">Add to station</button>
    </form>
  `;
  list.appendChild(addPanel);

  const search = document.getElementById('sidebar-search');
  search.oninput = e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.sidebar-track').forEach(el => {
      const t = el.querySelector('.track-title').textContent.toLowerCase();
      const a = el.querySelector('.track-artist').textContent.toLowerCase();
      el.style.display = (t.includes(q) || a.includes(q)) ? 'flex' : 'none';
    });
  };
}

function updateSidebarActiveState(songId) {
  document.querySelectorAll('.sidebar-track').forEach(el => {
    el.classList.toggle('active-track', el.dataset.id === songId);
  });
}

function updateSidebarTrackHealth(songId, score) {
  const item = document.querySelector(`.sidebar-track[data-id="${songId}"]`);
  if (!item) return;
  const h = item.querySelector('.track-health');
  h.textContent = score !== 0 ? (score > 0 ? '+' : '') + score : '\u00b7';
  h.className = 'track-health ' + (score >= 10 ? 'gold' : score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero');
}

// ====================================================
// MOBILE LIST
// ====================================================
function buildMobileList() {
  const list = document.getElementById('mobile-track-list');
  list.innerHTML = '';
  state.queue.forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'mobile-track';
    item.dataset.id = song.id;
    item.innerHTML = `
      <div class="mobile-track-num">${idx + 1}</div>
      <div class="mobile-track-info">
        <div class="mobile-track-title">${esc(song.title)}</div>
        <div class="mobile-track-artist">${esc(song.artist)}</div>
      </div>
    `;
    item.addEventListener('click', () => playTrackManual(idx));
    list.appendChild(item);
  });

  const addPanel = document.createElement('div');
  addPanel.className = 'mobile-add-panel';
  addPanel.innerHTML = `
    <div class="queue-add-title">Add a song for everyone</div>
    <form id="mobile-add-form" class="queue-add-form mobile">
      <input type="text" name="title" placeholder="Song title" autocomplete="off" required />
      <input type="text" name="artist" placeholder="Artist" autocomplete="off" required />
      <button type="submit">Add</button>
    </form>
  `;
  list.appendChild(addPanel);

  const search = document.getElementById('mobile-search');
  search.oninput = e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.mobile-track').forEach(el => {
      const t = el.querySelector('.mobile-track-title').textContent.toLowerCase();
      const a = el.querySelector('.mobile-track-artist').textContent.toLowerCase();
      el.style.display = (t.includes(q) || a.includes(q)) ? 'flex' : 'none';
    });
  };
}

function updateMobileActiveState(songId) {
  document.querySelectorAll('.mobile-track').forEach(el => {
    el.classList.toggle('active-track', el.dataset.id === songId);
  });
}

// ====================================================
// AUDIO VISUALIZER DATA FEED
// ====================================================
// Generates frequency-like data for the helix visualizer.
// When Spotify is playing and we have an auth token, we fetch
// the Spotify Audio Analysis API for segment loudness data.
// Otherwise, we generate procedural data synced to playback progress.

let _vizAnalysis = null;  // Spotify audio analysis segments
let _vizAnimFrame = null;
const VIZ_BINS = 24;     // must match CFG.activeWaveformBars

async function startVisualizerForTrack(song) {
  if (_vizAnimFrame) { cancelAnimationFrame(_vizAnimFrame); _vizAnimFrame = null; }
  _vizAnalysis = null;
  updateStationMeta();

  if (song.spotifyUri && getStoredToken()) {
    const trackId = song.spotifyUri.split(':').pop();
    try {
      const token = getStoredToken();
      const resp = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        _vizAnalysis = data;
        console.log(`[Viz] Loaded audio analysis for "${song.title}" — ${data.segments?.length || 0} segments`);
      }
    } catch (e) {
      console.warn('[Viz] Audio analysis fetch failed:', e.message);
    }
  }

  // Start the visualizer pump
  pumpVisualizerData();
}

function pumpVisualizerData() {
  if (!window.helixSetAudioData) {
    _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
    return;
  }

  const progress = state.progress || 0;
  const bins = new Float32Array(VIZ_BINS);

  if (_vizAnalysis && _vizAnalysis.segments && _vizAnalysis.segments.length > 0) {
    // ── REAL DATA: Map Spotify segments to frequency bins ──
    const segs = _vizAnalysis.segments;

    // Find the segment at current playback position
    let segIdx = 0;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= progress) segIdx = i;
      else break;
    }

    const seg = segs[segIdx];
    const nextSeg = segs[Math.min(segIdx + 1, segs.length - 1)];

    // Spotify segments have loudness_max (-60 to 0 dB) and pitches (12 values 0-1)
    // Map pitches to bins for the "frequency" look
    const pitches = seg.pitches || new Array(12).fill(0.5);
    const loudnessNorm = Math.max(0, Math.min(1, (seg.loudness_max + 60) / 60));

    // Interpolation factor within the current segment
    const segProgress = Math.max(0, Math.min(1, (progress - seg.start) / (seg.duration || 1)));

    // Spread 12 pitches across VIZ_BINS with loudness scaling
    for (let b = 0; b < VIZ_BINS; b++) {
      const pitchIdx = (b / VIZ_BINS) * 12;
      const p0 = Math.floor(pitchIdx);
      const p1 = Math.min(p0 + 1, 11);
      const frac = pitchIdx - p0;
      const pitchVal = pitches[p0] * (1 - frac) + pitches[p1] * frac;

      // Scale by loudness and add some temporal variation
      const temporal = 0.7 + 0.3 * Math.sin(progress * 4.5 + b * 0.6);
      bins[b] = pitchVal * loudnessNorm * temporal;

      // Smooth transition toward next segment
      if (nextSeg && nextSeg.pitches && segProgress > 0.7) {
        const blendFactor = (segProgress - 0.7) / 0.3;
        const nextPitch = nextSeg.pitches[p0] * (1 - frac) + nextSeg.pitches[p1] * frac;
        const nextLoudness = Math.max(0, Math.min(1, (nextSeg.loudness_max + 60) / 60));
        bins[b] = bins[b] * (1 - blendFactor) + nextPitch * nextLoudness * temporal * blendFactor;
      }
    }
  } else {
    // ── PROCEDURAL FALLBACK ──
    // Let helix.js handle its own procedural animation (pass null)
    window.helixSetAudioData(null);
    _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
    return;
  }

  window.helixSetAudioData(bins);
  _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
}

// ====================================================
// QUEUE REORDER (used by helix drag-drop & sidebar drag)
// ====================================================
function reorderQueue(fromQueueIdx, toQueueIdx) {
  if (HAS_SHARED_BACKEND) {
    requestStationAction('/api/reorder', { fromIndex: fromQueueIdx, toIndex: toQueueIdx }).catch(err => {
      console.warn('[Radio] Shared reorder failed:', err.message);
      showToast('Queue move failed');
    });
    return;
  }

  if (fromQueueIdx === state.currentIndex) return;

  const qLen = state.queue.length;
  if (fromQueueIdx < 0 || fromQueueIdx >= qLen) return;
  if (toQueueIdx < 0 || toQueueIdx >= qLen) return;
  if (fromQueueIdx === toQueueIdx) return;

  if (toQueueIdx === state.currentIndex) return;

  const song = state.queue[fromQueueIdx];

  state.queue.splice(fromQueueIdx, 1);

  let newCurrent = state.currentIndex;
  if (fromQueueIdx < newCurrent) {
    newCurrent--;
  }

  let insertAt = toQueueIdx;
  if (fromQueueIdx < toQueueIdx) {
    insertAt--;
  }

  state.queue.splice(insertAt, 0, song);

  if (insertAt <= newCurrent) {
    newCurrent++;
  }
  state.currentIndex = newCurrent;

  if (window.helixRebuild) window.helixRebuild();
  buildSidebar();
  buildMobileList();
  updateSidebarActiveState(state.queue[state.currentIndex].id);
  updateMobileActiveState(state.queue[state.currentIndex].id);
  showToast(`MOVED: ${song.title}`);
  console.log(`[Radio] Reordered: "${song.title}" from ${fromQueueIdx} to ${insertAt}`);
}

function setupAddSongForms() {
  const bind = (selector) => {
    const form = document.querySelector(selector);
    if (!form || form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const title = String(fd.get('title') || '').trim();
      const artist = String(fd.get('artist') || '').trim();
      if (!title || !artist) return;

      const button = form.querySelector('button');
      if (button) button.disabled = true;
      try {
        if (HAS_SHARED_BACKEND) {
          await requestStationAction('/api/add-song', { title, artist });
          showToast(`Added: ${title}`);
        } else {
          const newSong = normalizeTrack({
            id: `manual_${Date.now()}`,
            title,
            artist,
            duration: 210,
            youtubeId: '',
            health: 0,
          }, state.queue.length);
          state.queue.push(newSong);
          buildSidebar();
          buildMobileList();
          if (window.helixRebuild) window.helixRebuild();
          showToast(`Queued locally: ${title}`);
        }
        form.reset();
      } catch (err) {
        showToast('Could not add that song');
        console.warn('[Radio] Add-song failed:', err.message);
      } finally {
        if (button) button.disabled = false;
        setupAddSongForms();
      }
    });
  };

  bind('#sidebar-add-form');
  bind('#mobile-add-form');
}

// ====================================================
// SIDEBAR DRAG-TO-REORDER
// ====================================================
let sidebarDragState = {
  active: false,
  sourceEl: null,
  sourceIdx: -1,
  ghostEl: null,
  placeholderEl: null,
  startY: 0,
};

function setupSidebarDrag() {
  const list = document.getElementById('sidebar-list');
  if (!list) return;

  list.addEventListener('pointerdown', onSidebarPointerDown);
  list.addEventListener('pointermove', onSidebarPointerMove);
  list.addEventListener('pointerup', onSidebarPointerUp);
  list.addEventListener('pointercancel', cleanupSidebarDrag);
}

function onSidebarPointerDown(e) {
  const track = e.target.closest('.sidebar-track');
  if (!track) return;
  const idx = parseInt(track.dataset.idx, 10);
  // Don't allow reordering the active song
  if (idx === state.currentIndex) return;

  sidebarDragState.startY = e.clientY;
  sidebarDragState.sourceEl = track;
  sidebarDragState.sourceIdx = idx;
}

function onSidebarPointerMove(e) {
  if (!sidebarDragState.sourceEl) return;

  // Activate after 8px of movement
  if (!sidebarDragState.active) {
    if (Math.abs(e.clientY - sidebarDragState.startY) < 8) return;
    sidebarDragState.active = true;

    // Create ghost
    const ghost = sidebarDragState.sourceEl.cloneNode(true);
    ghost.className = 'sidebar-track sidebar-drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.width = sidebarDragState.sourceEl.offsetWidth + 'px';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    sidebarDragState.ghostEl = ghost;

    // Dim source
    sidebarDragState.sourceEl.style.opacity = '0.3';
  }

  if (!sidebarDragState.active) return;

  // Position ghost
  sidebarDragState.ghostEl.style.left = sidebarDragState.sourceEl.getBoundingClientRect().left + 'px';
  sidebarDragState.ghostEl.style.top = (e.clientY - 20) + 'px';

  // Find drop target by scanning sidebar tracks
  const list = document.getElementById('sidebar-list');
  const tracks = Array.from(list.querySelectorAll('.sidebar-track'));

  // Remove old indicators
  tracks.forEach(t => {
    t.classList.remove('drag-above', 'drag-below');
  });

  for (const t of tracks) {
    const rect = t.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      t.classList.add('drag-above');
      break;
    } else if (e.clientY >= midY && e.clientY <= rect.bottom) {
      t.classList.add('drag-below');
      break;
    }
  }
}

function onSidebarPointerUp(e) {
  if (!sidebarDragState.active) {
    cleanupSidebarDrag();
    return;
  }

  // Determine target index
  const list = document.getElementById('sidebar-list');
  const tracks = Array.from(list.querySelectorAll('.sidebar-track'));
  let targetIdx = sidebarDragState.sourceIdx;

  for (let i = 0; i < tracks.length; i++) {
    const rect = tracks[i].getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const tIdx = parseInt(tracks[i].dataset.idx, 10);
    if (e.clientY < midY) {
      targetIdx = tIdx;
      break;
    }
    // If we passed all tracks, drop at end
    if (i === tracks.length - 1) {
      targetIdx = tIdx + 1;
      if (targetIdx >= state.queue.length) targetIdx = state.queue.length - 1;
    }
  }

  // Don't drop onto the currently playing track
  if (targetIdx === state.currentIndex) {
    cleanupSidebarDrag();
    return;
  }

  if (targetIdx !== sidebarDragState.sourceIdx) {
    reorderQueue(sidebarDragState.sourceIdx, targetIdx);
  }

  cleanupSidebarDrag();
}

function cleanupSidebarDrag() {
  if (sidebarDragState.ghostEl) {
    sidebarDragState.ghostEl.remove();
  }
  if (sidebarDragState.sourceEl) {
    sidebarDragState.sourceEl.style.opacity = '';
  }
  // Remove indicators
  document.querySelectorAll('.sidebar-track').forEach(t => {
    t.classList.remove('drag-above', 'drag-below');
  });
  sidebarDragState = { active: false, sourceEl: null, sourceIdx: -1, ghostEl: null, placeholderEl: null, startY: 0 };
}

// ====================================================
// TOAST
// ====================================================
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('inject-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ====================================================
// HELPERS
// ====================================================
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ====================================================
// AMBIENT PARTICLES
// ====================================================
function createAmbientParticles() {
  const container = document.getElementById('ambient-particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    const r = Math.random();
    p.className = 'ambient-particle ' + (r < 0.4 ? 'particle-dot' : r < 0.75 ? 'particle-star4' : 'particle-bethlehem') + ' ' + (Math.random() < 0.82 ? 'particle-white' : Math.random() < 0.5 ? 'particle-cyan' : 'particle-yellow');
    const size = 1 + Math.random() * 4;
    p.style.width = size + 'px'; p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = '-10px';
    p.style.animationDuration = (15 + Math.random() * 25) + 's';
    p.style.animationDelay = (Math.random() * 20) + 's';
    container.appendChild(p);
  }
}
createAmbientParticles();

// ====================================================
// INIT HELIX
// ====================================================
async function initHelix() {
  try {
    const { initDNAHelix } = await import('./helix.js');
    initDNAHelix(state, {
      onTrackSelect: (idx) => playTrackManual(idx),
      onTrackReorder: (fromIdx, toIdx) => reorderQueue(fromIdx, toIdx),
    });
    window.helixInitialized = true;
  } catch(e) {
    console.warn('[Radio] Helix init failed:', e.message);
  }
}

// ====================================================
// HANDLE SPOTIFY CALLBACK (on page load)
// ====================================================
(async function boot() {
  if (window.location.search.includes('code=')) {
    const ok = await handleCallback();
    if (ok) console.log('[Radio] Spotify auth successful');
  }

  if (location.search.includes('skip')) {
    document.getElementById('phase-void').classList.add('hidden');
    initMainInterface();
    return;
  }

  resizeVoidCanvas();
  createStars();
  animateVoid();
})();

window.addEventListener('beforeunload', () => {
  if (sharedSync.pollTimer) clearInterval(sharedSync.pollTimer);
  if (sharedSync.stream) sharedSync.stream.close();
});

// ====================================================
// RESIZE
// ====================================================
window.addEventListener('resize', () => {
  if (state.phase === 'main' && window.innerWidth > 768 && !window.helixInitialized) {
    initHelix();
  }
});
