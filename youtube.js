/**
 * YouTube fallback player — postMessage + src-swap hybrid.
 * Used when Spotify auth fails or user isn't Premium.
 */

let _iframe = null;
let _connected = false;
let _currentVideoId = null;
let _progressTimer = null;
let _handshakeInterval = null;

const _state = { isPlaying: false, progress: 0, duration: 0, volume: 65 };
const _listeners = [];

function _emit() { _listeners.forEach(cb => { try { cb({ ..._state }); } catch(e){} }); }

function _buildUrl(videoId) {
  const p = new URLSearchParams({
    enablejsapi: '1', controls: '0', disablekb: '1', fs: '0',
    modestbranding: '1', playsinline: '1', rel: '0', autoplay: '1',
    origin: location.origin, widget_referrer: location.href,
  });
  return `https://www.youtube.com/embed/${videoId}?${p}`;
}

function _cmd(func, args) {
  if (!_iframe?.contentWindow) return;
  try {
    _iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command', func, args: args || [], id: 1, channel: 'widget',
    }), 'https://www.youtube.com');
  } catch(e) {}
}

function _startProgress() {
  _stopProgress();
  _progressTimer = setInterval(() => { if (_state.isPlaying) _emit(); }, 1000);
}

function _stopProgress() {
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
}

let _onEnd = null;

function _handleMsg(event) {
  if (!event.origin?.includes('youtube.com')) return;
  let data;
  try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch(e) { return; }
  if (!data?.event) return;

  if (data.event === 'initialDelivery' || data.event === 'onReady') {
    _connected = true;
    _cmd('setVolume', [_state.volume]);
    if (data.info?.duration > 0) _state.duration = data.info.duration;
    if (typeof data.info?.currentTime === 'number') _state.progress = data.info.currentTime;
  }

  if (data.event === 'onStateChange') {
    const s = data.info;
    if (s === 0) { _state.isPlaying = false; _stopProgress(); _emit(); if (_onEnd) _onEnd(); }
    else if (s === 1) { _state.isPlaying = true; _startProgress(); _emit(); }
    else if (s === 2) { _state.isPlaying = false; _stopProgress(); _emit(); }
  }

  if (data.event === 'infoDelivery' && data.info) {
    if (typeof data.info.currentTime === 'number') _state.progress = data.info.currentTime;
    if (data.info.duration > 0) _state.duration = data.info.duration;
    if (data.info.playerState === 0) {
      _state.isPlaying = false; _stopProgress(); _emit(); if (_onEnd) _onEnd(); return;
    }
    if (data.info.playerState === 1 && !_state.isPlaying) { _state.isPlaying = true; _startProgress(); }
    _emit();
  }

  if (data.event === 'onError') {
    const code = data.info;
    console.warn('[YT] Error:', code);
    if (code === 150 || code === 101) {
      setTimeout(() => { if (_onEnd) _onEnd(); }, 2000);
    }
  }
}

window.addEventListener('message', _handleMsg);

function _createIframe(videoId) {
  const container = document.getElementById('yt-player-container');
  if (!container) return;
  if (_iframe) try { _iframe.remove(); } catch(e) {}
  _connected = false;
  _iframe = document.createElement('iframe');
  _iframe.id = 'yt-pm-player';
  _iframe.width = '320'; _iframe.height = '180';
  _iframe.allow = 'autoplay; encrypted-media';
  _iframe.style.border = 'none';
  _iframe.src = _buildUrl(videoId);
  container.innerHTML = '';
  container.appendChild(_iframe);
  _currentVideoId = videoId;
  _iframe.addEventListener('load', () => {
    let attempts = 0;
    if (_handshakeInterval) clearInterval(_handshakeInterval);
    _handshakeInterval = setInterval(() => {
      attempts++;
      try {
        _iframe.contentWindow.postMessage(JSON.stringify({
          event: 'listening', id: 1, channel: 'widget',
        }), 'https://www.youtube.com');
      } catch(e) {}
      if (_connected || attempts >= 40) clearInterval(_handshakeInterval);
    }, 250);
  });
}

export const youtubePlayer = {
  init() { return true; },

  async play(videoId, seekSeconds = 0) {
    if (!videoId) return false;
    _state.isPlaying = true; _state.progress = 0; _state.duration = 0;
    if (_connected && _iframe && _currentVideoId) {
      _cmd('loadVideoById', [{ videoId, startSeconds: seekSeconds }]);
      _cmd('setVolume', [_state.volume]);
    } else {
      _createIframe(videoId);
      // For src-swap, append &start= param
      if (seekSeconds > 0 && _iframe) {
        _iframe.src = _buildUrl(videoId) + '&start=' + Math.floor(seekSeconds);
      }
    }
    _startProgress();
    return true;
  },

  pause() { if (_connected) _cmd('pauseVideo'); _state.isPlaying = false; _stopProgress(); _emit(); },
  resume() { if (_connected) _cmd('playVideo'); else if (_currentVideoId) _createIframe(_currentVideoId); },
  seek(seconds) { if (_connected) _cmd('seekTo', [seconds, true]); },
  setVolume(vol) { _state.volume = vol; if (_connected) _cmd('setVolume', [vol]); },
  getState() { return { ..._state }; },
  onStateChange(cb) { _listeners.push(cb); },
  onTrackEnd(cb) { _onEnd = cb; },
};
