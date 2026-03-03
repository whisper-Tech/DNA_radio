/**
 * DNA RADIO // THE SECRET
 * Audio System: YouTube IFrame Player (standalone, no backend required)
 * 
 * All YouTube video IDs are hardcoded in the playlist data.
 * No server-side search, no Spotify, no CGI-bin dependency.
 */

// ====================================================
// YOUTUBE IFRAME PLAYER
// ====================================================
let _ytPlayer = null;
let _ytReady = false;
let _ytReadyResolve = null;
const _ytReadyPromise = new Promise(r => { _ytReadyResolve = r; });
let _ytProgressTimer = null;
let _errorSkipCount = 0;  // Track consecutive errors to prevent infinite skip loops

// Load YouTube IFrame API
(function loadYTAPI() {
  if (window.YT && window.YT.Player) {
    _initYTPlayer();
    return;
  }
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) {
    first.parentNode.insertBefore(tag, first);
  } else {
    document.head.appendChild(tag);
  }
  window.onYouTubeIframeAPIReady = _initYTPlayer;
})();

function _initYTPlayer() {
  const container = document.getElementById('yt-player-container');
  if (!container) return;
  let el = document.getElementById('yt-api-player');
  if (!el) {
    el = document.createElement('div');
    el.id = 'yt-api-player';
    container.appendChild(el);
  }
  _ytPlayer = new YT.Player('yt-api-player', {
    height: '180',
    width: '320',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      playsinline: 1,
      rel: 0,
      origin: window.location.origin,
    },
    events: {
      onReady: () => {
        _ytReady = true;
        _ytPlayer.setVolume(_state.volume);
        if (_ytReadyResolve) _ytReadyResolve();
        console.log('[DNA Radio] YouTube IFrame Player ready');
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED) {
          _stopYTProgress();
          audioController._onTrackEnded();
        } else if (event.data === YT.PlayerState.PLAYING) {
          _state.isPlaying = true;
          _state.duration = _ytPlayer.getDuration() || 0;
          _startYTProgress();
          _emit();
        } else if (event.data === YT.PlayerState.PAUSED) {
          _state.isPlaying = false;
          _stopYTProgress();
          _emit();
        } else if (event.data === YT.PlayerState.UNSTARTED) {
          // Video cued but not started — may need user gesture
          console.log('[DNA Radio] YouTube video cued (unstarted)');
        }
      },
      onError: (event) => {
        console.warn('[DNA Radio] YouTube player error:', event.data, 'for track:', _state.currentSong?.title);
        _stopYTProgress();
        _state.isPlaying = false;
        _emit();
        // Error 150/101 = embedding disabled — skip after a delay to avoid rapid cycling
        if (event.data === 150 || event.data === 101) {
          _errorSkipCount++;
          if (_errorSkipCount <= 5) {
            console.log('[DNA Radio] Unplayable track, skipping... (skip #' + _errorSkipCount + ')');
            setTimeout(() => { if (_nextCb) _nextCb(); }, 2000);
          } else {
            console.warn('[DNA Radio] Too many consecutive errors — stopping auto-skip');
            _errorSkipCount = 0;
          }
        }
      },
    },
  });
}

function _startYTProgress() {
  _stopYTProgress();
  _ytProgressTimer = setInterval(() => {
    if (_ytPlayer && _state.source === 'youtube' && _state.isPlaying) {
      _state.progress = _ytPlayer.getCurrentTime() || 0;
      _state.duration = _ytPlayer.getDuration() || 0;
      _emit();
    }
  }, 500);
}

function _stopYTProgress() {
  if (_ytProgressTimer) {
    clearInterval(_ytProgressTimer);
    _ytProgressTimer = null;
  }
}

async function youtubePlay(videoId) {
  if (!videoId) {
    console.warn('[DNA Radio] No YouTube ID for this track');
    return false;
  }

  // Wait for player to be ready
  if (!_ytReady) {
    try {
      await Promise.race([_ytReadyPromise, new Promise((_, rej) => setTimeout(() => rej('timeout'), 8000))]);
    } catch (e) {
      console.warn('[DNA Radio] YouTube player not ready');
      return false;
    }
  }

  if (_ytPlayer && _ytPlayer.loadVideoById) {
    try {
      _ytPlayer.loadVideoById(videoId);
      _ytPlayer.setVolume(_state.volume);
    } catch (e) {
      console.warn('[DNA Radio] loadVideoById error:', e);
      return false;
    }
    return true;
  }
  return false;
}

function youtubeStop() {
  _stopYTProgress();
  if (_ytPlayer && _ytPlayer.stopVideo) {
    try { _ytPlayer.stopVideo(); } catch (e) {}
  }
}

function youtubePause() {
  _stopYTProgress();
  if (_ytPlayer && _ytPlayer.pauseVideo) {
    try { _ytPlayer.pauseVideo(); } catch (e) {}
  }
}

function youtubeResume() {
  if (_ytPlayer && _ytPlayer.playVideo) {
    try { _ytPlayer.playVideo(); } catch (e) {}
  }
}

function youtubeSeek(seconds) {
  if (_ytPlayer && _ytPlayer.seekTo) {
    try { _ytPlayer.seekTo(seconds, true); } catch (e) {}
  }
}

function youtubeSetVolume(vol) {
  if (_ytPlayer && _ytPlayer.setVolume) {
    try { _ytPlayer.setVolume(vol); } catch (e) {}
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
    console.log('[DNA Radio] YouTube-only audio mode');
    _state.source = 'youtube';
    _state.youtubeReady = _ytReady;
    _emit();
    return 'youtube';
  },

  async play(song) {
    _state.currentSong = song;
    youtubeStop();

    _state.source = 'youtube';
    _state.isPlaying = true;
    _state.progress = 0;
    _state.duration = 0;

    // Reset error skip count on successful play request
    _errorSkipCount = 0;

    // Use the hardcoded youtubeId from the song object
    const ok = await youtubePlay(song.youtubeId);
    if (ok) {
      console.log('[DNA Radio] Playing:', song.title, '-', song.artist, '(', song.youtubeId, ')');
    } else {
      console.warn('[DNA Radio] Failed to play:', song.title, '— YouTube player not ready');
      _state.isPlaying = false;
      // Do NOT auto-skip — let user click play or next manually
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
