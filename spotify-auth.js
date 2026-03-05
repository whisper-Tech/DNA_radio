/**
 * SPOTIFY PKCE AUTH + WEB PLAYBACK SDK
 * Primary audio player for Spotify Premium users.
 * Falls through to YouTube if auth fails or user isn't Premium.
 */

const CLIENT_ID = '75340ca33f934b3d999cf8dccc0233ef';
const REDIRECT_URI = window.location.origin + '/callback';
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
const TOKEN_KEY = 'sp_token';
const REFRESH_KEY = 'sp_refresh';
const EXPIRY_KEY = 'sp_expiry';
const VERIFIER_KEY = 'sp_verifier';

// --- PKCE Helpers ---
function generateRandomString(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').slice(0, len);
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Token Management ---
export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) || '0');
  if (token && Date.now() < expiry) return token;
  return null;
}

function storeTokens(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(VERIFIER_KEY);
}

// --- Auth Flow ---
export async function startSpotifyAuth() {
  const verifier = generateRandomString(64);
  localStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = base64url(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!verifier) return false;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  storeTokens(data);

  // Clean URL
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

export async function refreshToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) { clearTokens(); return null; }
  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

async function getValidToken() {
  let token = getStoredToken();
  if (token) return token;
  return refreshToken();
}

// --- Web Playback SDK ---
let _player = null;
let _deviceId = null;
let _onStateChange = null;
let _sdkLoaded = false;

function loadSDK() {
  if (_sdkLoaded) return Promise.resolve();
  return new Promise(resolve => {
    if (window.Spotify) { _sdkLoaded = true; resolve(); return; }
    window.onSpotifyWebPlaybackSDKReady = () => { _sdkLoaded = true; resolve(); };
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(s);
  });
}

export async function initSpotifyPlayer(onState) {
  _onStateChange = onState;
  const token = await getValidToken();
  if (!token) return null;

  await loadSDK();

  return new Promise((resolve) => {
    _player = new window.Spotify.Player({
      name: 'Whisper College Radio',
      getOAuthToken: async cb => { cb(await getValidToken()); },
      volume: 0.65,
    });

    _player.addListener('ready', ({ device_id }) => {
      _deviceId = device_id;
      console.log('[Spotify] Ready, device:', device_id);
      resolve(_player);
    });

    _player.addListener('not_ready', () => {
      console.warn('[Spotify] Device not ready');
      _deviceId = null;
    });

    _player.addListener('player_state_changed', state => {
      if (_onStateChange && state) _onStateChange(state);
    });

    _player.addListener('initialization_error', ({ message }) => {
      console.error('[Spotify] Init error:', message);
      resolve(null);
    });

    _player.addListener('authentication_error', ({ message }) => {
      console.error('[Spotify] Auth error:', message);
      clearTokens();
      resolve(null);
    });

    _player.addListener('account_error', ({ message }) => {
      console.error('[Spotify] Account error (Premium required?):', message);
      resolve(null);
    });

    _player.connect();

    // Timeout — if SDK doesn't connect in 8s, fall through
    setTimeout(() => resolve(null), 8000);
  });
}

// Play a specific track at a position
export async function spotifyPlay(spotifyUri, positionMs = 0) {
  const token = await getValidToken();
  if (!token || !_deviceId) return false;

  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${_deviceId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [spotifyUri], position_ms: Math.floor(positionMs) }),
  });
  return res.ok || res.status === 204;
}

export async function spotifyPause() {
  if (_player) await _player.pause();
}

export async function spotifyResume() {
  if (_player) await _player.resume();
}

export async function spotifySeek(ms) {
  if (_player) await _player.seek(ms);
}

export async function spotifySetVolume(fraction) {
  if (_player) await _player.setVolume(fraction);
}

export function getSpotifyPlayer() { return _player; }
export function getDeviceId() { return _deviceId; }
export function isSpotifyReady() { return !!_deviceId; }
