import { EventEmitter } from 'events';
import { getPlaylistTracks, getYoutubeId } from './spotify.js';
import { getAISuggestions } from './ai.js';
import * as db from './db.js';
import { randomBytes } from 'crypto';

class RadioState extends EventEmitter {
  playlist: any[];
  currentIndex: number;
  songStartTime: number;
  isPlaying: boolean;
  playlistUrl: string;
  crossFadeDuration: number;
  isTransitioning: boolean;
  pendingSuggestions: any;
  suggestionTimer: any;
  currentPlayId: any;
  listenerCount_: number;
  dbAvailable: boolean;

  constructor() {
    super();
    this.playlist = [];
    this.currentIndex = 0;
    this.songStartTime = Date.now();
    this.isPlaying = true;
    this.playlistUrl = process.env.SPOTIFY_PLAYLIST_URL || 'https://open.spotify.com/playlist/0nSlEQcziMFkng9hbdYIG2?si=_BGq6YxQR0SaTdnAP4-iWw';
    this.crossFadeDuration = 300;
    this.isTransitioning = false;
    this.pendingSuggestions = null;
    this.suggestionTimer = null;
    this.currentPlayId = null;
    this.listenerCount_ = 0;
    this.dbAvailable = db.isDbEnabled();
    
    this.init();
  }

  async init() {
    console.log(`[RADIO] Initializing (${this.dbAvailable ? 'db' : 'no-db'} mode)...`);

    try {
      // Try to load existing songs from database only if configured.
      const existingSongs = this.dbAvailable ? await db.getActiveSongs() : [];
      
      if (existingSongs.length > 0) {
        console.log(`[RADIO] Loaded ${existingSongs.length} songs from database`);
        this.dbAvailable = true;
        this.playlist = existingSongs;
        
        // Find the last played song to resume
        const recentPlays = this.dbAvailable ? await db.getRecentPlays(1) : [];
        if (recentPlays.length > 0) {
          const lastSong = this.playlist.find(s => s.id === recentPlays[0].songId);
          if (lastSong) {
            this.currentIndex = this.playlist.indexOf(lastSong);
            this.songStartTime = recentPlays[0].playedAt.getTime();
            console.log(`[RADIO] Resuming from: "${lastSong.title}"`);
          }
        }
      } else {
        const tracks = await getPlaylistTracks(this.playlistUrl);
        this.playlist = tracks;
        console.log(`[RADIO] Seeded ${tracks.length} tracks from playlist.`);
      }

      if (!this.playlist || this.playlist.length === 0) {
        // Hard fallback so the UI can still run and audio plumbing can be tested.
        console.warn('[RADIO] Playlist is empty; falling back to a small demo set.');
        this.playlist = [
          { id: 'demo-1', title: 'Resonance', artist: 'HOME', uri: 'demo:1', duration: 180000, youtubeId: '8GW6sLrK40k', health: 0, status: 'active' },
          { id: 'demo-2', title: 'Nightcall', artist: 'Kavinsky', uri: 'demo:2', duration: 180000, youtubeId: 'MV_3Dpw-BRY', health: 0, status: 'active' },
          { id: 'demo-3', title: 'A Real Hero', artist: 'College', uri: 'demo:3', duration: 180000, youtubeId: '-DSVDcw6iW8', health: 0, status: 'active' },
        ];
        this.currentIndex = 0;
        this.songStartTime = Date.now();
      }
      
      // Pre-resolve YouTube ID for current song
      const currentSong = this.playlist[this.currentIndex];
      if (currentSong && !currentSong.youtubeId) {
        currentSong.youtubeId = await getYoutubeId(currentSong.title, currentSong.artist, currentSong.duration);
        if (this.dbAvailable) {
          await db.updateSong(currentSong.id, { youtubeId: currentSong.youtubeId });
        }
      }
      
      // Pre-fetch next song's YouTube ID
      this.prefetchNextSong();
      
      // Create play history entry for current song
      if (this.dbAvailable) {
        const playHistory = await db.createPlayHistory({
          songId: currentSong.id,
          playNumber: (currentSong.totalPlays || 0) + 1,
          netScoreAfter: currentSong.health || 0,
          listenerCount: 0
        });
        this.currentPlayId = playHistory.id;
        await db.incrementSongStats(currentSong.id, playHistory.playNumber);
      }
      
      console.log(`[RADIO] Starting broadcast with ${this.playlist.length} songs`);
      this.emit('update', this.state);
    } catch (err) {
      console.error('[RADIO] Initialization error:', err);
      this.dbAvailable = false;
      const tracks = await getPlaylistTracks(this.playlistUrl);
      if (tracks.length > 0) {
        this.playlist = tracks;
        const firstSong = this.playlist[0];
        firstSong.youtubeId = await getYoutubeId(firstSong.title, firstSong.artist, firstSong.duration);
        this.prefetchNextSong();
        this.emit('update', this.state);
      } else {
        // Final fallback: demo playlist
        this.playlist = [
          { id: 'demo-1', title: 'Resonance', artist: 'HOME', uri: 'demo:1', duration: 180000, youtubeId: '8GW6sLrK40k', health: 0, status: 'active' },
          { id: 'demo-2', title: 'Nightcall', artist: 'Kavinsky', uri: 'demo:2', duration: 180000, youtubeId: 'MV_3Dpw-BRY', health: 0, status: 'active' },
          { id: 'demo-3', title: 'A Real Hero', artist: 'College', uri: 'demo:3', duration: 180000, youtubeId: '-DSVDcw6iW8', health: 0, status: 'active' },
        ];
        this.currentIndex = 0;
        this.songStartTime = Date.now();
        this.emit('update', this.state);
      }
    }
    
    this.checkSongEnd();
  }

  get state() {
    return {
      playlist: this.playlist.filter(s => s.status !== 'removed'),
      currentSong: this.playlist[this.currentIndex],
      currentIndex: this.currentIndex,
      songStartTime: this.songStartTime,
      isPlaying: this.isPlaying,
      serverTime: Date.now(),
      pendingSuggestions: this.pendingSuggestions,
      listenerCount: this.listenerCount_
    };
  }

  async prefetchNextSong() {
    try {
      const nextIndex = this.getNextValidIndex(this.currentIndex);
      const nextSong = this.playlist[nextIndex];
      
      if (nextSong && !nextSong.youtubeId) {
        console.log(`[PREFETCH] Loading YouTube ID for: "${nextSong.title}"`);
        const youtubeId = await getYoutubeId(nextSong.title, nextSong.artist, nextSong.duration);
        nextSong.youtubeId = youtubeId;
        if (this.dbAvailable) {
          await db.updateSong(nextSong.id, { youtubeId });
        }
      }
    } catch (err) {
      console.error('[PREFETCH] Error prefetching next song:', err);
      // Don't hard-disable everything; prefetch is optional.
    }
  }

  getNextValidIndex(fromIndex: number) {
    let nextIndex = (fromIndex + 1) % this.playlist.length;
    let attempts = 0;
    const maxAttempts = this.playlist.length;
    
    while (this.playlist[nextIndex]?.status === 'removed' && attempts < maxAttempts) {
      nextIndex = (nextIndex + 1) % this.playlist.length;
      attempts++;
    }
    
    return nextIndex;
  }

  async nextSong(immediate = false) {
    if (!this.dbAvailable && (!this.playlist || this.playlist.length === 0)) {
      console.error('[RADIO] No playlist available and DB disabled');
      return;
    }
    try {
      if (this.isTransitioning && !immediate) {
        console.log('[RADIO] Already transitioning, skipping duplicate call');
        return;
      }
      
      this.isTransitioning = true;
      
      const previousIndex = this.currentIndex;
      this.currentIndex = this.getNextValidIndex(this.currentIndex);

      const nextSong = this.playlist[this.currentIndex];
      if (!nextSong) {
        console.error('[RADIO] No valid song found');
        this.isTransitioning = false;
        return;
      }

      // Resolve YouTube ID if needed
      if (!nextSong.youtubeId) {
        nextSong.youtubeId = await getYoutubeId(nextSong.title, nextSong.artist, nextSong.duration);
        if (this.dbAvailable) {
          await db.updateSong(nextSong.id, { youtubeId: nextSong.youtubeId });
        }
      }

      this.songStartTime = Date.now();
      
      if (this.dbAvailable) {
        // Create play history entry
        const playHistory = await db.createPlayHistory({
          songId: nextSong.id,
          playNumber: (nextSong.totalPlays || 0) + 1,
          netScoreAfter: nextSong.health || 0,
          listenerCount: this.listenerCount_
        });
        this.currentPlayId = playHistory.id;
        
        // Increment play count
        await db.incrementSongStats(nextSong.id, playHistory.playNumber);
      }
      
      console.log(`[RADIO] Now Playing: "${nextSong.title}" by ${nextSong.artist} (YT: ${nextSong.youtubeId})`);
      console.log(`[RADIO] Transition: ${previousIndex} -> ${this.currentIndex} (immediate: ${immediate})`);
      
      this.emit('update', this.state);
      
      this.prefetchNextSong();
      
      setTimeout(() => {
        this.isTransitioning = false;
      }, this.crossFadeDuration);
    } catch (err) {
      console.error('[RADIO] Error in nextSong:', err);
      this.isTransitioning = false;
      this.emit('error', { type: 'nextSong', error: err });
    }
  }

  async immediateTransition(removedSongId: string, voterId: string | null = null) {
    try {
      console.log(`[RADIO] Immediate transition triggered for removed song: ${removedSongId}`);
      
      const currentSong = this.playlist[this.currentIndex];
      
      const suggestions = await getAISuggestions(currentSong);
      
      this.pendingSuggestions = {
        suggestions,
        voterId,
        expiresAt: Date.now() + 10000
      };

      this.emit('song_removed', {
        songId: removedSongId,
        nextIndex: this.getNextValidIndex(this.currentIndex),
        pendingSuggestions: this.pendingSuggestions
      });
      
      this.emit('update', this.state);

      if (this.suggestionTimer) clearTimeout(this.suggestionTimer);
      this.suggestionTimer = setTimeout(() => {
        if (this.pendingSuggestions) {
          console.log('[RADIO] Suggestion time expired, picking default next song');
          this.pendingSuggestions = null;
          this.nextSong(true);
        }
      }, 10000);
    } catch (err) {
      console.error('[RADIO] Error in immediateTransition:', err);
      this.emit('error', { type: 'immediateTransition', error: err });
    }
  }

  async selectAISuggestion(suggestionIndex: number, voterId: string) {
    try {
      if (!this.pendingSuggestions || this.pendingSuggestions.voterId !== voterId) {
        console.log('[RADIO] Suggestion pick ignored - invalid voter or no pending suggestions');
        return;
      }

      const pick = this.pendingSuggestions.suggestions[suggestionIndex];
      if (!pick) return;

      console.log(`[RADIO] AI Suggestion picked: "${pick.title}" by ${pick.artist}`);

      const youtubeId = await getYoutubeId(pick.title, pick.artist, 180000);
      const newSongData = {
        id: `ai_${Date.now()}_${randomBytes(4).toString('hex')}`,
        title: pick.title,
        artist: pick.artist,
        uri: `spotify:track:${randomBytes(22).toString('base64url')}`,
        youtubeId,
        duration: 180000,
        health: 0,
        status: 'active'
      };

      const newSong = this.dbAvailable ? await db.createSong(newSongData) : newSongData;
      
      this.playlist.splice(this.currentIndex + 1, 0, newSong);
      
      if (this.suggestionTimer) clearTimeout(this.suggestionTimer);
      this.pendingSuggestions = null;
      this.nextSong(true);
    } catch (err) {
      console.error('[RADIO] Error in selectAISuggestion:', err);
      this.emit('error', { type: 'selectAISuggestion', error: err });
    }
  }

  checkSongEnd() {
    setInterval(() => {
      if (this.playlist.length === 0 || this.isTransitioning || this.pendingSuggestions) return;
      
      const now = Date.now();
      const currentSong = this.playlist[this.currentIndex];
      
      if (!currentSong || currentSong.status === 'removed') {
        this.nextSong();
        return;
      }
      
      const elapsed = now - this.songStartTime;
      const duration = currentSong.duration || 180000;

      if (this.isPlaying && elapsed > duration) { 
        this.nextSong();
      }
    }, 1000);
  }

  async vote(songId: string, type: string, userId: string | null = null, socketId: string | null = null) {
    try {
      const song = this.playlist.find(s => s.id === songId);
      if (!song || song.status === 'removed') {
        console.log(`[VOTE] Ignored - song ${songId} not found or already removed`);
        return;
      }

      // Check if user has already voted on this play
      if (this.dbAvailable && userId && this.currentPlayId) {
        const hasVoted = await db.hasUserVoted(userId, this.currentPlayId);
        if (hasVoted) {
          console.log(`[VOTE] User ${userId} already voted on this play`);
          return;
        }
      }

      const previousHealth = song.health;

      if (type === 'accept') {
        if (song.health < 10) {
          song.health++;
          song.totalAccepts = (song.totalAccepts || 0) + 1;
          console.log(`[VOTE] ACCEPT on "${song.title}": ${previousHealth} -> ${song.health}`);
          if (this.dbAvailable) {
            await db.updateSong(songId, { 
              health: song.health,
              totalAccepts: song.totalAccepts
            });
          }
        }
        
        if (song.health >= 10 && song.status !== 'immortal') {
          song.status = 'immortal';
          if (this.dbAvailable) {
            await db.updateSong(songId, { status: 'immortal' });
          }
          console.log(`[IMMORTAL] "${song.title}" has achieved IMMORTAL status!`);
          this.emit('song_immortal', { songId: song.id, title: song.title });
        }
      } else if (type === 'reject') {
        if (song.health > -10) {
          song.health--;
          song.totalRejects = (song.totalRejects || 0) + 1;
          console.log(`[VOTE] REJECT on "${song.title}": ${previousHealth} -> ${song.health}`);
          if (this.dbAvailable) {
            await db.updateSong(songId, { 
              health: song.health,
              totalRejects: song.totalRejects
            });
          }
        }
        
        if (song.health <= -10 && song.status !== 'removed') {
          song.status = 'removed';
          if (this.dbAvailable) {
            await db.updateSong(songId, { status: 'removed' });
          }
          console.log(`[REMOVED] "${song.title}" has been REMOVED from the sequence!`);
          
          if (song.id === this.playlist[this.currentIndex].id) {
            console.log(`[REMOVED] Current song removed - initiating immediate cross-fade transition`);
            this.immediateTransition(song.id, socketId ? socketId : null);
            return;
          }
          
          this.emit('song_removed', { songId: song.id });
        }
      }

      // Record vote in database
      if (this.dbAvailable && userId && this.currentPlayId) {
        await db.createVote({
          userId,
          songId,
          playId: this.currentPlayId,
          voteType: type
        });
        
        // Update play history counts
        const votes = await db.getVotesForPlay(this.currentPlayId);
        const accepts = votes.filter(v => v.voteType === 'accept').length;
        const rejects = votes.filter(v => v.voteType === 'reject').length;
        await db.updatePlayHistory(this.currentPlayId, {
          acceptsThisPlay: accepts,
          rejectsThisPlay: rejects,
          netScoreAfter: song.health
        });
      }

      this.emit('update', this.state);
    } catch (err) {
      console.error('[VOTE] Error processing vote:', err);
      this.emit('error', { type: 'vote', error: err });
    }
  }

  async manualAdd(title: string, artist: string, youtubeId: string, duration = 180000) {
    try {
      const newSong = await db.createSong({
        id: `manual_${Date.now()}_${randomBytes(4).toString('hex')}`,
        title,
        artist,
        uri: `spotify:track:${randomBytes(22).toString('base64url')}`,
        youtubeId,
        duration
      });
      this.playlist.push(newSong);
      console.log(`[RADIO] Manually added: "${title}" by ${artist}`);
      this.emit('update', this.state);
      return newSong;
    } catch (err) {
      console.error('[RADIO] Error in manualAdd:', err);
      this.emit('error', { type: 'manualAdd', error: err });
      throw err;
    }
  }

  getCurrentPosition() {
    if (!this.isPlaying) return 0;
    return Date.now() - this.songStartTime;
  }

  getFullSyncState() {
    return {
      ...this.state,
      serverTime: Date.now(),
      currentPosition: this.getCurrentPosition()
    };
  }

  updateListenerCount(count: number) {
    this.listenerCount_ = count;
  }

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    console.log(`[RADIO] Playback ${this.isPlaying ? 'RESUMED' : 'PAUSED'}`);
    this.emit('update', this.state);
  }
}

export const radio = new RadioState();
