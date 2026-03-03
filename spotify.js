/**
 * DNA RADIO // THE SECRET
 * Audio System: YouTube postMessage Player (no external scripts needed)
 * 
 * Controls a YouTube embed iframe via window.postMessage instead of
 * loading youtube.com/iframe_api (which gets blocked by ad blockers).
 * All YouTube video IDs are hardcoded in the playlist data.
 */

// ====================================================
// YOUTUBE postMessage PLAYER
// ====================================================
let _ytIframe = null;
let _ytReady = false;
let _ytReadyResolve = null;
const _ytReadyPromise = new Promise(r => { _ytReadyResolve = r; });
let _ytProgressTimer = null;
let _errorSkipCount = 0;
let _debugLog = [];
let _listeningInterval = null;
let _currentVideoId = null;

// Player state constants (same as YT.PlayerState)
const YTState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

// Debug overlay for troubleshooting (selectable + copy button)
function _updateDebug(msg) {
  _debugLog.push(new Date().toLocaleTimeString() + ' ' + msg);
  if (_debugLog.length > 20) _debugLog.shift();
  console.log('[DNA Radio Debug]', msg);

  let wrap = document.getElementById('yt-debug-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'yt-debug-wrap';
    wrap.style.cssText = 'position:fixed;bottom:4px;right:4px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:2px;';
    
    const btn = document.createElement('button');
    btn.textContent = 'Copy Log';
    btn.style.cssText = 'background:#222;color:#0f0;border:1px solid #0f0;font:9px monospace;padding:2px 6px;cursor:pointer;border-radius:2px;';
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(_debugLog.join('\n')).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy Log'; }, 1500);
      });
    });

    const d = document.createElement('div');
    d.id = 'yt-debug';
    d.style.cssText = 'background:rgba(0,0,0,0.9);color:#0f0;font:10px monospace;padding:4px 8px;max-width:400px;border-radius:3px;user-select:text;-webkit-user-select:text;word-break:break-all;';
    
    wrap.appendChild(btn);
    wrap.appendChild(d);
    document.body.appendChild(wrap);
  }
  const d = document.getElementById('yt-debug');
  if (d) d.textContent = '[YT] ' + msg;
}

// Send a postMessage command to the YouTube iframe
function _ytCommand(func, args) {
  if (!_ytIframe || !_ytIframe.contentWindow) return;
  const msg = JSON.stringify({
    event: 'command',
    func: func,
    args: args || [],
    id: 1,
    channel: 'widget',
  });
  _ytIframe.contentWindow.postMessage(msg, '*');
}

// Initialize: create the iframe and set up two-way postMessage communication
(function initPostMessagePlayer() {
  const container = document.getElementById('yt-player-container');
  if (!container) {
    _updateDebug('ERROR: yt-player-container not found — will retry');
    // Retry after DOM is ready
    document.addEventListener('DOMContentLoaded', initPostMessagePlayer);
    return;
  }

  _updateDebug('Creating YouTube iframe (postMessage mode)...');

  // Clear any existing content
  container.innerHTML = '';

  // Create the iframe directly — no external script needed
  _ytIframe = document.createElement('iframe');
  _ytIframe.id = 'yt-pm-player';
  _ytIframe.width = '320';
  _ytIframe.height = '180';
  _ytIframe.allow = 'autoplay; encrypted-media';
  _ytIframe.setAttribute('allowfullscreen', '');
  _ytIframe.style.border = 'none';
  // Start with a blank video; we'll load videos via postMessage
  _ytIframe.src = 'https://www.youtube.com/embed/?enablejsapi=1&controls=0&disablekb=1&fs=0&modestbranding=1&playsinline=1&rel=0&origin=' + encodeURIComponent(window.location.origin);
  
  container.appendChild(_ytIframe);

  // Listen for messages from the YouTube iframe
  window.addEventListener('message', _handleYTMessage);

  // Once the iframe loads, start sending the "listening" handshake
  _ytIframe.addEventListener('load', () => {
    _updateDebug('iframe loaded, sending listening handshake...');
    _startListeningHandshake();
  });
})();

function _startListeningHandshake() {
  // Send "listening" event to tell YouTube to start sending us events
  // YouTube needs this to establish the postMessage channel
  let attempts = 0;
  if (_listeningInterval) clearInterval(_listeningInterval);
  
  _listeningInterval = setInterval(() => {
    attempts++;
    if (!_ytIframe || !_ytIframe.contentWindow) return;
    
    _ytIframe.contentWindow.postMessage(JSON.stringify({
      event: 'listening',
      id: 1,
      channel: 'widget',
    }), '*');
    
    if (_ytReady || attempts >= 60) {
      clearInterval(_listeningInterval);
      _listeningInterval = null;
      if (!_ytReady && attempts >= 60) {
        _updateDebug('Handshake timeout after 60 attempts');
      }
    }
  }, 250);
}

function _handleYTMessage(event) {
  // Only process messages from YouTube
  if (!event.origin || !event.origin.includes('youtube.com')) return;
  
  let data;
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch (e) {
    return; // Not JSON, ignore
  }

  if (!data || !data.event) return;

  switch (data.event) {
    case 'initialDelivery':
      // YouTube is talking to us — we're connected!
      if (!_ytReady) {
        _ytReady = true;
        _state.youtubeReady = true;
        _updateDebug('postMessage READY — connected to YT');
        if (_ytReadyResolve) {
          _ytReadyResolve();
          _ytReadyResolve = null;
        }
        // Set initial volume
        _ytCommand('setVolume', [_state.volume]);
        _emit();
      }
      // Extract duration if available
      if (data.info && data.info.duration) {
        _state.duration = data.info.duration;
      }
      break;

    case 'onReady':
      if (!_ytReady) {
        _ytReady = true;
        _state.youtubeReady = true;
        _updateDebug('onReady received via postMessage');
        if (_ytReadyResolve) {
          _ytReadyResolve();
          _ytReadyResolve = null;
        }
        _ytCommand('setVolume', [_state.volume]);
        _emit();
      }
      break;

    case 'onStateChange': {
      const stateVal = data.info;
      const stateNames = {[-1]:'UNSTARTED', 0:'ENDED', 1:'PLAYING', 2:'PAUSED', 3:'BUFFERING', 5:'CUED'};
      _updateDebug('state=' + (stateNames[stateVal] || stateVal) + ' track=' + (_state.currentSong?.title || 'none'));
      
      if (stateVal === YTState.ENDED) {
        _stopYTProgress();
        _state.isPlaying = false;
        _emit();
        audioController._onTrackEnded();
      } else if (stateVal === YTState.PLAYING) {
        _state.isPlaying = true;
        _startYTProgress();
        _emit();
      } else if (stateVal === YTState.PAUSED) {
        _state.isPlaying = false;
        _stopYTProgress();
        _emit();
      }
      break;
    }

    case 'infoDelivery': {
      // This is sent frequently while playing — contains currentTime, duration, playerState
      if (data.info) {
        if (typeof data.info.currentTime === 'number') {
          _state.progress = data.info.currentTime;
        }
        if (typeof data.info.duration === 'number' && data.info.duration > 0) {
          _state.duration = data.info.duration;
        }
        if (typeof data.info.playerState === 'number') {
          // Use playerState from infoDelivery to stay in sync
          const ps = data.info.playerState;
          if (ps === YTState.PLAYING && !_state.isPlaying) {
            _state.isPlaying = true;
            _startYTProgress();
          } else if (ps === YTState.PAUSED && _state.isPlaying) {
            _state.isPlaying = false;
            _stopYTProgress();
          }
        }
        if (typeof data.info.volume === 'number') {
          // Keep volume in sync (don't override user intent though)
        }
        // Emit to update the UI with new time/duration
        _emit();
      }
      break;
    }

    case 'onError': {
      const errCode = data.info;
      console.warn('[DNA Radio] YouTube player error:', errCode, 'for track:', _state.currentSong?.title);
      _updateDebug('ERROR code=' + errCode + ' track=' + (_state.currentSong?.title || '?'));
      _stopYTProgress();
      _state.isPlaying = false;
      _emit();
      
      // Error 150/101 = embed restricted
      if (errCode === 150 || errCode === 101) {
        _errorSkipCount++;
        if (_errorSkipCount <= 5) {
          _updateDebug('Unplayable (embed blocked), skip #' + _errorSkipCount);
          setTimeout(() => { if (_nextCb) _nextCb(); }, 2000);
        } else {
          _updateDebug('Too many errors, stopping auto-skip');
          _errorSkipCount = 0;
        }
      }
      break;
    }
  }
}

function _startYTProgress() {
  // infoDelivery gives us currentTime updates, but as a backup we also poll via emit
  _stopYTProgress();
  _ytProgressTimer = setInterval(() => {
    if (_state.isPlaying) {
      _emit(); // Just re-emit so UI stays updated from infoDelivery data
    }
  }, 1000);
}

function _stopYTProgress() {
  if (_ytProgressTimer) {
    clearInterval(_ytProgressTimer);
    _ytProgressTimer = null;
  }
}

async function youtubePlay(videoId) {
  if (!videoId) {
    _updateDebug('No YouTube ID for this track');
    return false;
  }

  // Wait for postMessage connection to be ready
  if (!_ytReady) {
    _updateDebug('Waiting for postMessage ready (up to 15s)...');
    try {
      await Promise.race([
        _ytReadyPromise,
        new Promise((_, rej) => setTimeout(() => rej('timeout'), 15000))
      ]);
    } catch (e) {
      _updateDebug('TIMEOUT waiting for postMessage — ytReady=' + _ytReady);
      return false;
    }
  }

  // Load and play via postMessage
  _currentVideoId = videoId;
  _ytCommand('loadVideoById', [videoId]);
  _ytCommand('setVolume', [_state.volume]);
  _updateDebug('loadVideoById via postMessage: ' + videoId);
  return true;
}

function youtubeStop() {
  _stopYTProgress();
  _ytCommand('stopVideo');
}

function youtubePause() {
  _stopYTProgress();
  _ytCommand('pauseVideo');
}

function youtubeResume() {
  _ytCommand('playVideo');
}

function youtubeSeek(seconds) {
  _ytCommand('seekTo', [seconds, true]);
}

function youtubeSetVolume(vol) {
  _ytCommand('setVolume', [vol]);
}

// ====================================================
// UNIFIED AUDIO CONTROLLER (YouTube-only)
// ====================================================
const _callbacks = [];
let _nextCb = null;
let _prevCb = null;

const _state = {
  isPlaying: false,
  progress: 0,
  duration: 0,
  source: 'youtube',
  spotifyReady: false,
  youtubeReady: false,
  currentSong: null,
  volume: 65,
};

function _emit() {
  const s = audioController.getState();
  _callbacks.forEach(cb => { try { cb(s); } catch (e) {} });
}

export const audioController = {
  _lastSpotifyPos: 0,

  _onSpotifyState() {
    // No-op — Spotify disabled
  },

  _onTrackEnded() {
    console.log('[DNA Radio] Track ended, advancing...');
    _state.isPlaying = false;
    _emit();
    if (_nextCb) _nextCb();
  },

  async init() {
    console.log('[DNA Radio] YouTube postMessage audio mode (no external scripts)');
    _updateDebug('audioController.init() — postMessage mode (no iframe_api.js)');
    _state.source = 'youtube';
    _state.youtubeReady = _ytReady;
    _emit();
    return 'youtube';
  },

  async play(song) {
    _state.currentSong = song;
    _updateDebug('play(): ' + song.title + ' id=' + song.youtubeId);
    youtubeStop();

    _state.source = 'youtube';
    _state.isPlaying = true;
    _state.progress = 0;
    _state.duration = 0;
    _errorSkipCount = 0;

    const ok = await youtubePlay(song.youtubeId);
    if (ok) {
      _updateDebug('loadVideoById OK: ' + song.youtubeId);
    } else {
      _updateDebug('FAILED: ' + song.title + ' (player not ready)');
      _state.isPlaying = false;
    }
    _emit();
  },

  async pause() {
    youtubePause();
    _state.isPlaying = false;
    _emit();
  },

  async resume() {
    youtubeResume();
    _state.isPlaying = true;
    _emit();
  },

  async togglePlay() {
    if (_state.isPlaying) {
      await this.pause();
    } else if (_state.currentSong) {
      await this.resume();
    }
  },

  async seek(fraction) {
    if (_state.duration > 0) {
      youtubeSeek(fraction * _state.duration);
      _state.progress = fraction * _state.duration;
      _emit();
    }
  },

  next() { if (_nextCb) _nextCb(); },
  prev() { if (_prevCb) _prevCb(); },
  setNextCallback(cb) { _nextCb = cb; },
  setPrevCallback(cb) { _prevCb = cb; },

  getState() {
    return {
      isPlaying: _state.isPlaying,
      progress: _state.progress,
      duration: _state.duration,
      source: _state.source,
      spotifyReady: false,
      youtubeReady: _state.youtubeReady,
      currentSong: _state.currentSong,
    };
  },

  onStateChange(cb) { _callbacks.push(cb); },

  setVolume(vol) {
    _state.volume = vol;
    youtubeSetVolume(vol);
  },
};

// Stubs so app.js imports don't break
export function spotifyLogin() {
  console.log('[DNA Radio] Spotify is disabled — using YouTube playback');
}

export function spotifyLogout() {}

export function isSpotifyLoggedIn() {
  return false;
}
