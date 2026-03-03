/**
 * DNA RADIO // THE SECRET
 * Audio System: YouTube postMessage Player (no external scripts needed)
 * 
 * Controls a YouTube embed iframe via window.postMessage instead of
 * loading youtube.com/iframe_api (which gets blocked by ad blockers).
 * All YouTube video IDs are hardcoded in the playlist data.
 * 
 * Strategy:
 * 1. Create iframe with a real video ID (not blank) so YouTube initializes the player
 * 2. Send "listening" handshake to establish two-way postMessage channel
 * 3. Once connected, use postMessage commands for subsequent track changes
 * 4. If handshake never connects, fall back to swapping iframe src directly
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
let _postMessageConnected = false; // true once we get initialDelivery/onReady

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
  if (_debugLog.length > 30) _debugLog.shift();
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

// Build the YouTube embed URL for a given video ID
function _buildEmbedUrl(videoId) {
  const params = new URLSearchParams({
    enablejsapi: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    autoplay: '1',
    origin: window.location.origin,
    widget_referrer: window.location.href,
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
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
  try {
    _ytIframe.contentWindow.postMessage(msg, 'https://www.youtube.com');
  } catch (e) {
    // Fallback to wildcard origin
    try {
      _ytIframe.contentWindow.postMessage(msg, '*');
    } catch (e2) {}
  }
}

// Create or get the iframe container
function _getContainer() {
  return document.getElementById('yt-player-container');
}

// Initialize: create the iframe container and message listener
(function initPostMessagePlayer() {
  const container = _getContainer();
  if (!container) {
    _updateDebug('ERROR: yt-player-container not found — will retry on DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', initPostMessagePlayer);
    return;
  }

  _updateDebug('postMessage player initialized, waiting for first track...');

  // Listen for messages from the YouTube iframe
  window.addEventListener('message', _handleYTMessage);
})();

// Create (or recreate) the iframe with a specific video ID
function _createIframeWithVideo(videoId) {
  const container = _getContainer();
  if (!container) {
    _updateDebug('ERROR: no yt-player-container');
    return;
  }

  const embedUrl = _buildEmbedUrl(videoId);
  console.log('[DNA Radio] Creating iframe:', embedUrl);
  _updateDebug('Creating iframe for: ' + videoId);
  
  // Remove old iframe if exists
  if (_ytIframe) {
    try { _ytIframe.remove(); } catch (e) {}
  }
  
  // Reset state
  _postMessageConnected = false;
  _ytReady = false;
  // Create a new promise for this connection
  const oldResolve = _ytReadyResolve;
  // We need a fresh promise each time
  
  _ytIframe = document.createElement('iframe');
  _ytIframe.id = 'yt-pm-player';
  _ytIframe.width = '320';
  _ytIframe.height = '180';
  _ytIframe.allow = 'autoplay; encrypted-media';
  _ytIframe.setAttribute('allowfullscreen', '');
  _ytIframe.style.border = 'none';
  _ytIframe.src = embedUrl;
  
  container.innerHTML = '';
  container.appendChild(_ytIframe);
  _currentVideoId = videoId;

  // Once loaded, try to establish postMessage channel
  _ytIframe.addEventListener('load', () => {
    _updateDebug('iframe loaded for ' + videoId + ', sending handshake...');
    _startListeningHandshake();
  });
}

function _startListeningHandshake() {
  let attempts = 0;
  if (_listeningInterval) clearInterval(_listeningInterval);
  
  _listeningInterval = setInterval(() => {
    attempts++;
    if (!_ytIframe || !_ytIframe.contentWindow) return;
    
    try {
      _ytIframe.contentWindow.postMessage(JSON.stringify({
        event: 'listening',
        id: 1,
        channel: 'widget',
      }), 'https://www.youtube.com');
    } catch (e) {
      try {
        _ytIframe.contentWindow.postMessage(JSON.stringify({
          event: 'listening',
          id: 1,
          channel: 'widget',
        }), '*');
      } catch (e2) {}
    }
    
    if (_postMessageConnected || attempts >= 40) {
      clearInterval(_listeningInterval);
      _listeningInterval = null;
      if (!_postMessageConnected && attempts >= 40) {
        _updateDebug('Handshake timeout — postMessage not responding, using src-swap mode');
      }
    }
  }, 250);
}

function _handleYTMessage(event) {
  // Accept messages from YouTube origins
  if (!event.origin || (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com'))) return;
  
  let data;
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch (e) {
    return;
  }

  if (!data || !data.event) return;

  switch (data.event) {
    case 'initialDelivery':
      _postMessageConnected = true;
      if (!_ytReady) {
        _ytReady = true;
        _state.youtubeReady = true;
        _updateDebug('postMessage CONNECTED — full control available');
        if (_ytReadyResolve) {
          _ytReadyResolve();
          _ytReadyResolve = null;
        }
        _ytCommand('setVolume', [_state.volume]);
        _emit();
      }
      if (data.info) {
        if (typeof data.info.duration === 'number' && data.info.duration > 0) {
          _state.duration = data.info.duration;
        }
        if (typeof data.info.currentTime === 'number') {
          _state.progress = data.info.currentTime;
        }
      }
      break;

    case 'onReady':
      _postMessageConnected = true;
      if (!_ytReady) {
        _ytReady = true;
        _state.youtubeReady = true;
        _updateDebug('onReady via postMessage');
        if (_ytReadyResolve) {
          _ytReadyResolve();
          _ytReadyResolve = null;
        }
        _ytCommand('setVolume', [_state.volume]);
        _emit();
      }
      break;

    case 'onStateChange': {
      _postMessageConnected = true;
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
        if (!_ytReady) {
          _ytReady = true;
          _state.youtubeReady = true;
          if (_ytReadyResolve) { _ytReadyResolve(); _ytReadyResolve = null; }
        }
        _startYTProgress();
        _emit();
      } else if (stateVal === YTState.PAUSED) {
        _state.isPlaying = false;
        _stopYTProgress();
        _emit();
      } else if (stateVal === YTState.BUFFERING) {
        _updateDebug('Buffering...');
      }
      break;
    }

    case 'infoDelivery': {
      _postMessageConnected = true;
      if (data.info) {
        if (typeof data.info.currentTime === 'number') {
          _state.progress = data.info.currentTime;
        }
        if (typeof data.info.duration === 'number' && data.info.duration > 0) {
          _state.duration = data.info.duration;
        }
        if (typeof data.info.playerState === 'number') {
          const ps = data.info.playerState;
          if (ps === YTState.PLAYING && !_state.isPlaying) {
            _state.isPlaying = true;
            _startYTProgress();
          } else if ((ps === YTState.PAUSED || ps === YTState.ENDED) && _state.isPlaying) {
            if (ps === YTState.ENDED) {
              _state.isPlaying = false;
              _stopYTProgress();
              _emit();
              audioController._onTrackEnded();
              return;
            }
            _state.isPlaying = false;
            _stopYTProgress();
          }
        }
        _emit();
      }
      break;
    }

    case 'onError': {
      const errCode = data.info;
      console.warn('[DNA Radio] YouTube error:', errCode, 'track:', _state.currentSong?.title);
      _updateDebug('ERROR code=' + errCode + ' track=' + (_state.currentSong?.title || '?'));
      _stopYTProgress();
      _state.isPlaying = false;
      _emit();
      
      if (errCode === 150 || errCode === 101) {
        _errorSkipCount++;
        if (_errorSkipCount <= 5) {
          _updateDebug('Embed blocked, skip #' + _errorSkipCount);
          setTimeout(() => { if (_nextCb) _nextCb(); }, 2000);
        } else {
          _updateDebug('Too many errors, stopping');
          _errorSkipCount = 0;
        }
      }
      break;
    }
  }
}

function _startYTProgress() {
  _stopYTProgress();
  _ytProgressTimer = setInterval(() => {
    if (_state.isPlaying) {
      _emit();
    }
  }, 1000);
}

function _stopYTProgress() {
  if (_ytProgressTimer) {
    clearInterval(_ytProgressTimer);
    _ytProgressTimer = null;
  }
}

// ====================================================
// PLAY LOGIC — hybrid: postMessage if connected, src-swap as fallback
// ====================================================
async function youtubePlay(videoId) {
  if (!videoId) {
    _updateDebug('No YouTube ID for this track');
    return false;
  }

  console.log('[DNA Radio] youtubePlay():', videoId, 'postMessageConnected:', _postMessageConnected, 'hasIframe:', !!_ytIframe);

  // If postMessage is connected AND we already have an iframe, use loadVideoById
  if (_postMessageConnected && _ytIframe) {
    _updateDebug('loadVideoById (postMessage): ' + videoId);
    _currentVideoId = videoId;
    _ytCommand('loadVideoById', [videoId]);
    _ytCommand('setVolume', [_state.volume]);
    return true;
  }

  // Otherwise, create/swap the iframe with the new video
  // This always works — it's just loading a YouTube embed URL
  _updateDebug('src-swap mode: creating iframe for ' + videoId);
  _createIframeWithVideo(videoId);
  
  // The video will autoplay because we set autoplay=1 in the URL
  // We consider this a success
  return true;
}

function youtubeStop() {
  _stopYTProgress();
  if (_postMessageConnected) {
    _ytCommand('stopVideo');
  }
}

function youtubePause() {
  _stopYTProgress();
  if (_postMessageConnected) {
    _ytCommand('pauseVideo');
  }
}

function youtubeResume() {
  if (_postMessageConnected) {
    _ytCommand('playVideo');
  } else if (_ytIframe && _currentVideoId) {
    // Can't resume via src-swap, reload the video
    _createIframeWithVideo(_currentVideoId);
  }
}

function youtubeSeek(seconds) {
  if (_postMessageConnected) {
    _ytCommand('seekTo', [seconds, true]);
  }
}

function youtubeSetVolume(vol) {
  if (_postMessageConnected) {
    _ytCommand('setVolume', [vol]);
  }
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

  _onSpotifyState() {},

  _onTrackEnded() {
    console.log('[DNA Radio] Track ended, advancing...');
    _state.isPlaying = false;
    _emit();
    if (_nextCb) _nextCb();
  },

  async init() {
    console.log('[DNA Radio] YouTube postMessage + src-swap audio mode');
    _updateDebug('audioController.init() — postMessage + src-swap fallback');
    _state.source = 'youtube';
    _state.youtubeReady = true; // Always "ready" since src-swap always works
    _emit();
    return 'youtube';
  },

  async play(song) {
    _state.currentSong = song;
    console.log('[DNA Radio] play() called:', song.title, 'youtubeId:', song.youtubeId);
    _updateDebug('play(): ' + song.title + ' id=' + song.youtubeId);
    
    if (!song.youtubeId) {
      console.error('[DNA Radio] No youtubeId for track:', song.title);
      _updateDebug('ERROR: no youtubeId for ' + song.title);
      return;
    }

    // Stop current playback
    youtubeStop();

    _state.source = 'youtube';
    _state.isPlaying = true;
    _state.progress = 0;
    _state.duration = 0;
    _errorSkipCount = 0;

    const ok = await youtubePlay(song.youtubeId);
    if (ok) {
      _updateDebug('Playing: ' + song.title);
      // Start a progress timer even in src-swap mode
      // (infoDelivery will override if postMessage connects)
      _startYTProgress();
    } else {
      _updateDebug('FAILED: ' + song.title);
      _state.isPlaying = false;
    }
    _emit();
  },

  async pause() {
    youtubePause();
    _state.isPlaying = false;
    _stopYTProgress();
    _emit();
  },

  async resume() {
    youtubeResume();
    _state.isPlaying = true;
    _startYTProgress();
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
