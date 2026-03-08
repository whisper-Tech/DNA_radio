import { EventEmitter } from 'events';
import { PLAYLIST } from '../playlist-data.js';
import { getYoutubeId } from './spotify.js';

function cloneSong(song, idx = 0) {
  const rawDuration = Number(song?.duration || 210);
  const durationSeconds = rawDuration > 1000 ? Math.round(rawDuration / 1000) : rawDuration;
  return {
    id: song?.id || `seed_${idx}`,
    title: song?.title || 'Unknown Track',
    artist: song?.artist || 'Unknown Artist',
    spotifyUri: song?.spotifyUri || song?.uri || null,
    youtubeId: song?.youtubeId || '',
    duration: durationSeconds || 210,
    health: Number(song?.health || 0),
    status: song?.status || 'active',
  };
}

function durationMs(song) {
  const value = Number(song?.duration || 210);
  return value > 1000 ? value : value * 1000;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class RadioState extends EventEmitter {
  constructor() {
    super();
    this.playlist = PLAYLIST.map(cloneSong);
    this.currentIndex = 0;
    this.songStartTime = Date.now();
    this.isPlaying = true;
    this.pausedPositionMs = 0;
    this.listenerCount_ = 0;
    this.lastAdvanceAt = 0;
    this.lastAdvanceSourceStart = 0;
    this.endTimer = null;

    this.startSongEndLoop();
  }

  get currentSong() {
    return this.playlist[this.currentIndex] || null;
  }

  getCurrentPosition() {
    if (!this.currentSong) return 0;
    if (!this.isPlaying) return this.pausedPositionMs;
    return Math.max(0, Date.now() - this.songStartTime);
  }

  get state() {
    return {
      playlist: this.playlist.filter(song => song.status !== 'removed'),
      currentSong: this.currentSong,
      currentIndex: this.currentIndex,
      songStartTime: this.songStartTime,
      isPlaying: this.isPlaying,
      serverTime: Date.now(),
      currentPosition: this.getCurrentPosition(),
      listenerCount: this.listenerCount_,
    };
  }

  getFullSyncState() {
    return this.state;
  }

  emitUpdate() {
    this.emit('update', this.getFullSyncState());
  }

  updateListenerCount(count) {
    const nextCount = Math.max(0, Number(count || 0));
    if (nextCount === this.listenerCount_) return;
    this.listenerCount_ = nextCount;
    this.emitUpdate();
  }

  playIndex(index) {
    if (!this.playlist.length) return this.getFullSyncState();
    const nextIndex = clamp(Number(index || 0), 0, this.playlist.length - 1);
    this.currentIndex = nextIndex;
    this.songStartTime = Date.now();
    this.pausedPositionMs = 0;
    this.isPlaying = true;
    this.emitUpdate();
    return this.getFullSyncState();
  }

  nextSong({ expectedStartTime = null } = {}) {
    if (!this.playlist.length) return this.getFullSyncState();

    if (
      typeof expectedStartTime === 'number'
      && this.lastAdvanceSourceStart === expectedStartTime
      && Date.now() - this.lastAdvanceAt < 2500
    ) {
      return this.getFullSyncState();
    }

    if (
      typeof expectedStartTime === 'number'
      && Math.abs(expectedStartTime - this.songStartTime) > 2500
      && Date.now() - this.lastAdvanceAt < 2500
    ) {
      return this.getFullSyncState();
    }

    this.lastAdvanceSourceStart = this.songStartTime;
    this.lastAdvanceAt = Date.now();
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.songStartTime = Date.now();
    this.pausedPositionMs = 0;
    this.isPlaying = true;
    this.emitUpdate();
    return this.getFullSyncState();
  }

  seek(seconds) {
    if (!this.currentSong) return this.getFullSyncState();
    const songDurationSeconds = durationMs(this.currentSong) / 1000;
    const nextSeconds = clamp(Number(seconds || 0), 0, songDurationSeconds);
    this.pausedPositionMs = nextSeconds * 1000;
    this.songStartTime = Date.now() - this.pausedPositionMs;
    this.isPlaying = true;
    this.emitUpdate();
    return this.getFullSyncState();
  }

  reorder(fromIndex, toIndex) {
    if (!this.playlist.length) return this.getFullSyncState();

    const qLen = this.playlist.length;
    const from = clamp(Number(fromIndex), 0, qLen - 1);
    const to = clamp(Number(toIndex), 0, qLen - 1);

    if (Number.isNaN(from) || Number.isNaN(to) || from === to) {
      return this.getFullSyncState();
    }

    if (from === this.currentIndex || to === this.currentIndex) {
      return this.getFullSyncState();
    }

    const song = this.playlist[from];
    this.playlist.splice(from, 1);

    let newCurrent = this.currentIndex;
    if (from < newCurrent) newCurrent -= 1;

    let insertAt = to;
    if (from < to) insertAt -= 1;

    this.playlist.splice(insertAt, 0, song);

    if (insertAt <= newCurrent) newCurrent += 1;
    this.currentIndex = clamp(newCurrent, 0, this.playlist.length - 1);

    this.emitUpdate();
    return this.getFullSyncState();
  }

  async manualAdd(title, artist, duration = 210) {
    const cleanTitle = String(title || '').trim();
    const cleanArtist = String(artist || '').trim();
    if (!cleanTitle || !cleanArtist) {
      throw new Error('Missing title or artist');
    }

    const durationSeconds = Number(duration || 210) > 1000 ? Math.round(Number(duration) / 1000) : Number(duration || 210);
    let youtubeId = '';

    try {
      youtubeId = await getYoutubeId(cleanTitle, cleanArtist, durationSeconds * 1000);
    } catch (err) {
      console.warn('[RADIO] YouTube lookup failed for manual add:', err?.message || err);
    }

    const newSong = cloneSong({
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: cleanTitle,
      artist: cleanArtist,
      youtubeId,
      duration: durationSeconds,
      health: 0,
      status: 'active',
    }, this.playlist.length);

    this.playlist.push(newSong);
    this.emitUpdate();
    return newSong;
  }

  startSongEndLoop() {
    if (this.endTimer) clearInterval(this.endTimer);
    this.endTimer = setInterval(() => {
      if (!this.isPlaying || !this.currentSong) return;
      const elapsed = this.getCurrentPosition();
      const currentDuration = durationMs(this.currentSong);
      if (elapsed >= currentDuration - 500) {
        this.nextSong({ expectedStartTime: this.songStartTime });
      }
    }, 1000);
  }
}

export const radio = new RadioState();
