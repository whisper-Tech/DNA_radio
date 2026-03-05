/**
 * CLOCKWORK RADIO ENGINE
 * Deterministic 24/7 radio — everyone hears the same track at the same position.
 * Uses UTC time + fixed track durations to calculate current playback state.
 * No backend needed.
 */

// Each track's assumed duration in seconds (YouTube avg ~3.5min)
// These get refined once YouTube/Spotify reports actual duration
const DEFAULT_DURATION = 210; // 3:30

const RADIO_EPOCH = 1709683200; // 2024-03-06T00:00:00Z — arbitrary fixed start

export class ClockworkRadio {
  constructor(playlist) {
    this.playlist = playlist;
    this.durations = playlist.map(t => t.duration || DEFAULT_DURATION);
    this.totalCycleDuration = this.durations.reduce((a, b) => a + b, 0);
  }

  // Update a track's real duration once known
  setRealDuration(index, seconds) {
    if (index >= 0 && index < this.durations.length && seconds > 0) {
      this.durations[index] = seconds;
      this.totalCycleDuration = this.durations.reduce((a, b) => a + b, 0);
    }
  }

  // Core: what should be playing RIGHT NOW?
  getNow() {
    const nowSec = Date.now() / 1000;
    const elapsed = nowSec - RADIO_EPOCH;
    // Position within the current cycle
    let pos = ((elapsed % this.totalCycleDuration) + this.totalCycleDuration) % this.totalCycleDuration;

    let trackIndex = 0;
    for (let i = 0; i < this.durations.length; i++) {
      if (pos < this.durations[i]) {
        trackIndex = i;
        break;
      }
      pos -= this.durations[i];
      if (i === this.durations.length - 1) {
        trackIndex = 0;
        pos = 0;
      }
    }

    return {
      trackIndex,
      positionSeconds: pos,
      track: this.playlist[trackIndex],
      totalCycleDuration: this.totalCycleDuration,
    };
  }

  // When does the current track end? (for scheduling next)
  getSecondsUntilNextTrack() {
    const { trackIndex, positionSeconds } = this.getNow();
    return this.durations[trackIndex] - positionSeconds;
  }
}
