import { EventEmitter } from 'events';
import { getPlaylistTracks, getYoutubeId } from './spotify.js';
import { getAISuggestions } from './ai.js';

class RadioState extends EventEmitter {
  constructor() {
    super();
    this.playlist = [];
    this.currentIndex = 0;
    this.songStartTime = Date.now();
    this.isPlaying = true;
    this.playlistUrl = 'https://open.spotify.com/playlist/7clEOXvB7CyiUy1X0vmCus';
    this.crossFadeDuration = 300; // ms for cross-fade transition
    this.isTransitioning = false;
    this.pendingSuggestions = null;
    this.suggestionTimer = null;
    
    this.init();
  }

  async init() {
    console.log(`[RADIO] Initializing with public playlist...`);
    const tracks = await getPlaylistTracks(this.playlistUrl);
    
    if (tracks.length > 0) {
      this.playlist = tracks;
      // Pre-resolve the first song's YouTube ID
      const firstSong = this.playlist[0];
      firstSong.youtubeId = await getYoutubeId(firstSong.title, firstSong.artist);
      
      // Pre-fetch next song's YouTube ID in background
      this.prefetchNextSong();
      
      console.log(`[RADIO] Loaded ${this.playlist.length} songs. Starting broadcast.`);
      this.emit('update', this.state);
    } else {
      console.error('[RADIO] Failed to load any tracks.');
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
      serverTime: Date.now(), // Include server time for sync
      pendingSuggestions: this.pendingSuggestions
    };
  }

  // Pre-fetch YouTube ID for the next song to reduce transition latency
  async prefetchNextSong() {
    const nextIndex = this.getNextValidIndex(this.currentIndex);
    const nextSong = this.playlist[nextIndex];
    
    if (nextSong && !nextSong.youtubeId) {
      console.log(`[PREFETCH] Loading YouTube ID for: "${nextSong.title}"`);
      nextSong.youtubeId = await getYoutubeId(nextSong.title, nextSong.artist);
    }
  }

  // Get the next valid (non-removed) song index
  getNextValidIndex(fromIndex) {
    let nextIndex = (fromIndex + 1) % this.playlist.length;
    let attempts = 0;
    const maxAttempts = this.playlist.length;
    
    while (this.playlist[nextIndex].status === 'removed' && attempts < maxAttempts) {
      nextIndex = (nextIndex + 1) % this.playlist.length;
      attempts++;
    }
    
    return nextIndex;
  }

  async nextSong(immediate = false) {
    if (this.isTransitioning && !immediate) {
      console.log('[RADIO] Already transitioning, skipping duplicate call');
      return;
    }
    
    this.isTransitioning = true;
    
    const previousIndex = this.currentIndex;
    this.currentIndex = this.getNextValidIndex(this.currentIndex);

    // Resolve YouTube ID for the next song if not already done
    const nextSong = this.playlist[this.currentIndex];
    if (!nextSong.youtubeId) {
      nextSong.youtubeId = await getYoutubeId(nextSong.title, nextSong.artist);
    }

    this.songStartTime = Date.now();
    
    console.log(`[RADIO] Now Playing: "${nextSong.title}" by ${nextSong.artist} (YT: ${nextSong.youtubeId})`);
    console.log(`[RADIO] Transition: ${previousIndex} -> ${this.currentIndex} (immediate: ${immediate})`);
    
    this.emit('update', this.state);
    
    // Pre-fetch the next song in background
    this.prefetchNextSong();
    
    // Reset transition flag after cross-fade duration
    setTimeout(() => {
      this.isTransitioning = false;
    }, this.crossFadeDuration);
  }

  // Immediate transition for removed songs (cross-fade effect)
  async immediateTransition(removedSongId, voterId = null) {
    console.log(`[RADIO] Immediate transition triggered for removed song: ${removedSongId}`);
    
    const currentSong = this.playlist[this.currentIndex];
    
    // Get AI suggestions for the next song
    const suggestions = await getAISuggestions(currentSong);
    
    this.pendingSuggestions = {
      suggestions,
      voterId,
      expiresAt: Date.now() + 10000 // 10 seconds to pick
    };

    // Emit removal event for client-side glitch effect
    this.emit('song_removed', {
      songId: removedSongId,
      nextIndex: this.getNextValidIndex(this.currentIndex),
      pendingSuggestions: this.pendingSuggestions
    });
    
    this.emit('update', this.state);

    // Set a timer to automatically pick the next song if no one chooses
    // Using 5 seconds for the fade out as per LOGIC.md
    if (this.suggestionTimer) clearTimeout(this.suggestionTimer);
    this.suggestionTimer = setTimeout(() => {
      if (this.pendingSuggestions) {
        console.log('[RADIO] Suggestion time expired, picking default next song');
        this.pendingSuggestions = null;
        this.nextSong(true);
      }
    }, 10000);
  }

  async selectAISuggestion(suggestionIndex, voterId) {
    if (!this.pendingSuggestions || this.pendingSuggestions.voterId !== voterId) {
      console.log('[RADIO] Suggestion pick ignored - invalid voter or no pending suggestions');
      return;
    }

    const pick = this.pendingSuggestions.suggestions[suggestionIndex];
    if (!pick) return;

    console.log(`[RADIO] AI Suggestion picked: "${pick.title}" by ${pick.artist}`);
    
    // Create a temporary song object
    const newSong = {
      id: `ai_${Math.random().toString(36).substr(2, 9)}`,
      title: pick.title,
      artist: pick.artist,
      health: 0,
      status: 'active',
      isAISuggested: true
    };

    // Get YouTube ID
    newSong.youtubeId = await getYoutubeId(newSong.title, newSong.artist);
    
    // Insert into playlist at next position and move to it
    this.playlist.splice(this.currentIndex + 1, 0, newSong);
    
    if (this.suggestionTimer) clearTimeout(this.suggestionTimer);
    this.pendingSuggestions = null;
    this.nextSong(true);
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

  vote(songId, type, voterId = null) {
    const song = this.playlist.find(s => s.id === songId);
    if (!song || song.status === 'removed') {
      console.log(`[VOTE] Ignored - song ${songId} not found or already removed`);
      return;
    }

    const previousHealth = song.health;

    if (type === 'accept') {
      if (song.health < 10) {
        song.health++;
        console.log(`[VOTE] ACCEPT on "${song.title}": ${previousHealth} -> ${song.health}`);
      }
      
      // Check for immortal status
      if (song.health >= 10 && song.status !== 'immortal') {
        song.status = 'immortal';
        console.log(`[IMMORTAL] "${song.title}" has achieved IMMORTAL status!`);
        this.emit('song_immortal', { songId: song.id, title: song.title });
      }
    } else if (type === 'reject') {
      if (song.health > -10) {
        song.health--;
        console.log(`[VOTE] REJECT on "${song.title}": ${previousHealth} -> ${song.health}`);
      }
      
      // IMMEDIATE REMOVAL when health hits -10
      if (song.health <= -10 && song.status !== 'removed') {
        song.status = 'removed';
        console.log(`[REMOVED] "${song.title}" has been REMOVED from the sequence!`);
        
        // If this is the current song, trigger immediate transition with cross-fade and AI suggestions
        if (song.id === this.playlist[this.currentIndex].id) {
          console.log(`[REMOVED] Current song removed - initiating immediate cross-fade transition`);
          this.immediateTransition(song.id, voterId);
          return; // Don't emit update here, immediateTransition will handle it
        }
        
        this.emit('song_removed', { songId: song.id });
      }
    }

    // Emit update for health changes
    this.emit('update', this.state);
  }

  manualAdd(title, artist, youtubeId, duration = 180000) {
    const newSong = {
      id: `manual_${Math.random().toString(36).substr(2, 9)}`,
      title,
      artist,
      youtubeId,
      duration,
      health: 0,
      status: 'active'
    };
    this.playlist.push(newSong);
    console.log(`[RADIO] Manually added: "${title}" by ${artist}`);
    this.emit('update', this.state);
    return newSong;
  }

  // Get current playback position for sync
  getCurrentPosition() {
    if (!this.isPlaying) return 0;
    return Date.now() - this.songStartTime;
  }

  // Force sync state (for reconnecting clients)
  getFullSyncState() {
    return {
      ...this.state,
      serverTime: Date.now(),
      currentPosition: this.getCurrentPosition()
    };
  }
}

export const radio = new RadioState();
