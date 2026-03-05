/**
 * DNA RADIO // WHISPER COLLEGE — v12
 * 24/7 Clockwork Radio + Spotify Primary + YouTube Fallback
 * No backend required. No auth gate.
 */

import { ClockworkRadio } from './radio.js';
import {
  getStoredToken, handleCallback, startSpotifyAuth, initSpotifyPlayer,
  spotifyPlay, spotifyPause, spotifyResume, spotifySeek, spotifySetVolume,
  isSpotifyReady, clearTokens,
} from './spotify-auth.js';
import { youtubePlayer } from './youtube.js';

// ====================================================
// PLAYLIST DATA — each track needs youtubeId, optional spotifyUri
// duration: seconds (defaults to 210 if unknown, refined at runtime)
// ====================================================
const PLAYLIST = [
  { id:"s1",  title:"All Your Exes",                         artist:"Julia Michaels",                              health:0, youtubeId:"REKWd0u7YgU", spotifyUri:"spotify:track:4kMgpLBKVRmQE0MRRQDKNA", duration:189 },
  { id:"s2",  title:"Find Me",                               artist:"Nate Mitchell",                               health:0, youtubeId:"Adgm-MlnB3Y", duration:210 },
  { id:"s3",  title:"ANGELS LIKE ME",                        artist:"Ryan Oakes, SkyDxddy",                        health:0, youtubeId:"kTrPxxOp4Gw", duration:195 },
  { id:"s4",  title:"Apathy Anthem",                         artist:"MaeThePirate",                                health:0, youtubeId:"5jARpPOVrCY", duration:200 },
  { id:"s5",  title:"Alien (Sped Up)",                       artist:"Nico & Chelsea",                              health:0, youtubeId:"1iL3mZLazt0", duration:165 },
  { id:"s6",  title:"I HOPE YOUR CAR BREAKS DOWN",           artist:"MaeThePirate",                                health:0, youtubeId:"a5p5ZSTHinw", duration:180 },
  { id:"s7",  title:"Talking To A Ghost",                    artist:"YOUTHYEAR",                                   health:0, youtubeId:"kZHKdeqTuug", duration:210 },
  { id:"s8",  title:"Best Part Of The Story",                artist:"SkyDxddy",                                    health:0, youtubeId:"4Av1L5Rmoj0", duration:200 },
  { id:"s9",  title:"God Of War",                            artist:"SkyDxddy",                                    health:0, youtubeId:"isvwPvc6Dqk", duration:195 },
  { id:"s10", title:"SNAP",                                  artist:"Rosa Linn",                                   health:0, youtubeId:"Lo4_K4relMg", spotifyUri:"spotify:track:4CsGPRKLjR2VHXFE6gHIQp", duration:178 },
  { id:"s11", title:"kill the girl",                         artist:"LØLØ",                                        health:0, youtubeId:"zmH7PJiR2yk", duration:190 },
  { id:"s12", title:"5,6,7,8",                               artist:"LØLØ, girlfriends",                           health:0, youtubeId:"NVOhlLfcQ7U", duration:185 },
  { id:"s13", title:"It Wasn't Easy To Be Happy For You",    artist:"The Lumineers",                               health:0, youtubeId:"eGReASgVM1Q", spotifyUri:"spotify:track:3l2NQJS9LK87ChVVMVSxD7", duration:222 },
  { id:"s14", title:"What's Stopping You",                   artist:"P!X!E",                                       health:0, youtubeId:"o1wxgIps1e4", duration:195 },
  { id:"s15", title:"WATCH THIS",                            artist:"TAELA",                                       health:0, youtubeId:"iycrMFBrnsg", duration:180 },
  { id:"s16", title:"If I Died Last Night",                  artist:"Jessie Murph",                                health:0, youtubeId:"pRtO5vlJnWw", spotifyUri:"spotify:track:7G5M0duiNDVuHDKmFqjlqf", duration:200 },
  { id:"s17", title:"People That I Love Leave",              artist:"Cassadee Pope",                               health:0, youtubeId:"eEF8T2F92AE", duration:210 },
  { id:"s18", title:"Starduhst",                             artist:"honestav",                                    health:0, youtubeId:"3O-2kCcI-hg", duration:185 },
  { id:"s19", title:"Bullet",                                artist:"Hollywood Undead",                            health:0, youtubeId:"lP077RitNAc", spotifyUri:"spotify:track:0tJ9xhZIAICAjJuNal9hAK", duration:216 },
  { id:"s20", title:"Such Small Hands",                      artist:"La Dispute",                                  health:0, youtubeId:"XlppZKMYNys", spotifyUri:"spotify:track:1K3lbDfFMPB6pQDQbMHJPe", duration:135 },
  { id:"s21", title:"Sara",                                  artist:"We Three",                                    health:0, youtubeId:"IlvELjeisqE", duration:245 },
  { id:"s22", title:"HELLO LØNELINESS",                      artist:"Ekoh, Lø Spirit",                             health:0, youtubeId:"wAtFJAqTVhA", duration:200 },
  { id:"s23", title:"Lilith",                                artist:"Halsey",                                      health:0, youtubeId:"9PdH-zavwO4", spotifyUri:"spotify:track:4OF29bVGvMgEKsBqvYCGhb", duration:195 },
  { id:"s24", title:"007",                                   artist:"LØLØ",                                        health:0, youtubeId:"4okJouEbZ_s", duration:180 },
  { id:"s25", title:"GrokBlocked",                           artist:"Pie For Billy",                               health:0, youtubeId:"gGcKxx0yvfE", duration:210 },
  { id:"s26", title:"Mud",                                   artist:"CARR",                                        health:0, youtubeId:"g9X2aSt15jQ", duration:200 },
  { id:"s27", title:"Enemy",                                 artist:"Arrested Youth",                              health:0, youtubeId:"z3PXjKxEkjo", duration:190 },
  { id:"s28", title:"Panic Room",                            artist:"Au/Ra",                                       health:0, youtubeId:"Ro51SuLyh8A", spotifyUri:"spotify:track:3SBqFkXIaKv10AAj8bJUGP", duration:189 },
  { id:"s29", title:"Dominoes",                              artist:"Ren",                                         health:0, youtubeId:"bbbjWEnC3Gc", duration:240 },
  { id:"s30", title:"Full Circle",                           artist:"Movements",                                   health:0, youtubeId:"nVKzdqvfjO8", duration:210 },
  { id:"s31", title:"All Around Me",                         artist:"Flyleaf",                                     health:0, youtubeId:"xN0FFK8JSYE", spotifyUri:"spotify:track:5KR1fUFJJPMQ60XPoLr2tN", duration:215 },
  { id:"s32", title:"Medusa",                                artist:"Cameron Whitcomb",                            health:0, youtubeId:"KNE8o4gK_y0", duration:200 },
  { id:"s33", title:"Dopamine",                              artist:"Sum 41",                                      health:0, youtubeId:"yYk2BTwuQnM", duration:195 },
  { id:"s34", title:"Anxiety",                               artist:"Bmike",                                       health:0, youtubeId:"KhnEUbbMWUM", duration:210 },
  { id:"s35", title:"Teenage Dirtbag",                       artist:"Postmodern Jukebox, Jax",                     health:0, youtubeId:"Snh-ufvXWIk", duration:230 },
  { id:"s36", title:"I Dare You",                            artist:"Shinedown",                                   health:0, youtubeId:"R5kaDyq41qw", spotifyUri:"spotify:track:3lSOmfRVVP6fRImEaZkJBi", duration:215 },
  { id:"s37", title:"Baby Don't Cut (Acoustic)",             artist:"Bmike",                                       health:0, youtubeId:"0Dr0ibhVs0I", duration:240 },
  { id:"s38", title:"Freckles",                              artist:"honestav",                                    health:0, youtubeId:"BM8y6sVVH2E", duration:185 },
  { id:"s39", title:"The Other Side",                        artist:"Michael Marcagi",                             health:0, youtubeId:"TuQ4im63cMY", duration:195 },
  { id:"s40", title:"HORROR SHOW",                           artist:"Hot Milk",                                    health:0, youtubeId:"OBZ84gQlBtc", duration:200 },
  { id:"s41", title:"BLOSSOM",                               artist:"RØRY",                                        health:0, youtubeId:"Ya8dZyiD2gE", duration:190 },
  { id:"s42", title:"For the Misfits",                       artist:"SkyDxddy",                                    health:0, youtubeId:"WurYAHXEMXQ", duration:200 },
  { id:"s43", title:"Dear Diary",                            artist:"KidShazam, SkyDxddy, PONS",                   health:0, youtubeId:"IGgxRH7B86M", duration:210 },
  { id:"s44", title:"Angel of Death",                        artist:"SkyDxddy",                                    health:0, youtubeId:"-_GBaVjCsOc", duration:195 },
  { id:"s45", title:"i like the way you kiss me",            artist:"Artemas",                                     health:0, youtubeId:"evJ6gX1lp2o", spotifyUri:"spotify:track:5W1XY5ucNATjTVLMDpGGig", duration:138 },
  { id:"s46", title:"You Are Enough",                        artist:"Citizen Soldier",                             health:0, youtubeId:"rZLVIVByZn8", duration:225 },
  { id:"s47", title:"Psycho",                                artist:"Taylor Acorn",                                health:0, youtubeId:"iOVGmrypaAE", duration:190 },
  { id:"s48", title:"cinderella's dead",                     artist:"EMELINE",                                     health:0, youtubeId:"Tf7qp1CwanI", spotifyUri:"spotify:track:6IQBJpLSJBHGKKkSladarQ", duration:180 },
  { id:"s49", title:"For a Pessimist, I'm Pretty Optimistic",artist:"Paramore",                                   health:0, youtubeId:"B1o2UCLvD38", spotifyUri:"spotify:track:3qhlB30KknSejmIvZFLlEi", duration:229 },
  { id:"s50", title:"Weightless",                            artist:"All Time Low",                                health:0, youtubeId:"TpG3BxRctQ4", spotifyUri:"spotify:track:2uFaJJtFpPDc5Pa95XzTvg", duration:195 },
];

// ====================================================
// CLOCKWORK RADIO
// ====================================================
const radio = new ClockworkRadio(PLAYLIST);

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
  audioSource: 'none', // 'spotify' | 'youtube' | 'none'
  spotifyAvailable: false,
};

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
// PHASE 1: THE VOID — black space + hidden star + hold
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
  // The ONE secret star — slightly brighter, pulsing subtly
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
  // Beacon — barely visible, slightly warmer
  if (beaconStar) {
    const pulse = 0.3 + 0.2 * Math.sin(t * 1.5);
    voidCtx.beginPath();
    voidCtx.arc(beaconStar.x, beaconStar.y, beaconStar.r + pulse * 0.5, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(200,220,255,${pulse})`;
    voidCtx.fill();
    // Hold ring
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
// PHASE 1.5: REVEAL — "Whisper ~ College" text, then transition
// ====================================================
async function triggerReveal() {
  holdActive = false;
  state.phase = 'reveal';
  cancelAnimationFrame(voidAnimFrame);

  const voidEl = document.getElementById('phase-void');
  // Fade the star field slightly
  voidEl.style.transition = 'opacity 1.5s ease';
  voidEl.style.opacity = '0.3';

  // Show the text overlay
  const revealEl = document.getElementById('phase-reveal');
  revealEl.classList.remove('hidden');

  // Type out "Whisper ~ College"
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

  // Hold for a moment
  await new Promise(r => setTimeout(r, 1800));

  // Fade everything out
  revealEl.style.transition = 'opacity 1.2s ease';
  revealEl.style.opacity = '0';
  voidEl.style.opacity = '0';

  await new Promise(r => setTimeout(r, 1200));
  voidEl.classList.add('hidden');
  revealEl.classList.add('hidden');

  // Enter main
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

  // Init helix
  if (window.innerWidth > 768) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    initHelix();
  }

  setupHUD();
  setupDragDrop();

  // Init audio — try Spotify first, fall back to YouTube
  await initAudio();

  // Sync to clockwork radio
  syncToRadio();

  setTimeout(() => { mainEl.style.opacity = '1'; }, 50);

  // Toast container
  if (!document.getElementById('inject-toast')) {
    const toast = document.createElement('div');
    toast.id = 'inject-toast';
    document.body.appendChild(toast);
  }
}

// ====================================================
// AUDIO INIT — Spotify primary, YouTube fallback
// ====================================================
async function initAudio() {
  const token = getStoredToken();
  if (token) {
    updateSourceIndicator('Connecting to Spotify...');
    const player = await initSpotifyPlayer(handleSpotifyState);
    if (player) {
      state.spotifyAvailable = true;
      state.audioSource = 'spotify';
      updateSourceIndicator('SPOTIFY');
      console.log('[Radio] Spotify connected');
      return;
    }
  }
  // Fallback to YouTube
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

  // Track ended in Spotify
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
  // Re-sync to clockwork radio — it knows what should play next
  setTimeout(() => syncToRadio(), 500);
}

// ====================================================
// CLOCKWORK SYNC — join the 24/7 broadcast
// ====================================================
let _syncTimer = null;

function syncToRadio() {
  const now = radio.getNow();
  const song = now.track;
  const seekSec = now.positionSeconds;

  console.log(`[Radio] Sync: "${song.title}" at ${Math.floor(seekSec)}s`);

  state.currentIndex = now.trackIndex;
  updateHUDForTrack(song);
  updateSidebarActiveState(song.id);
  updateMobileActiveState(song.id);
  if (window.helixSetCurrentTrack) window.helixSetCurrentTrack(now.trackIndex);

  // Update real duration if we have it
  if (state.duration > 10) radio.setRealDuration(now.trackIndex, state.duration);

  // Play at the right position
  if (state.audioSource === 'spotify' && song.spotifyUri) {
    spotifyPlay(song.spotifyUri, seekSec * 1000);
  } else {
    state.audioSource = 'youtube';
    youtubePlayer.play(song.youtubeId, seekSec);
    updateSourceIndicator('YOUTUBE');
  }

  state.isPlaying = true;

  // Schedule next sync when this track should end
  clearTimeout(_syncTimer);
  const remaining = radio.getSecondsUntilNextTrack();
  _syncTimer = setTimeout(() => syncToRadio(), (remaining + 0.5) * 1000);
}

// Manual next/prev (overrides clockwork temporarily — re-syncs on end)
function playNext() {
  const next = (state.currentIndex + 1) % state.queue.length;
  playTrackManual(next);
}

function playPrev() {
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  playTrackManual(prev);
}

function playTrackManual(index) {
  clearTimeout(_syncTimer);
  state.currentIndex = index;
  const song = state.queue[index];
  updateHUDForTrack(song);
  updateSidebarActiveState(song.id);
  updateMobileActiveState(song.id);
  if (window.helixSetCurrentTrack) window.helixSetCurrentTrack(index);

  if (state.audioSource === 'spotify' && song.spotifyUri) {
    spotifyPlay(song.spotifyUri, 0);
  } else {
    youtubePlayer.play(song.youtubeId, 0);
  }
  state.isPlaying = true;

  // Schedule re-sync after this track ends (estimate)
  const dur = song.duration || 210;
  _syncTimer = setTimeout(() => syncToRadio(), (dur + 1) * 1000);
}

// ====================================================
// HUD SETUP
// ====================================================
function setupHUD() {
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-prev').addEventListener('click', playPrev);
  document.getElementById('btn-next').addEventListener('click', playNext);
  document.getElementById('btn-accept').addEventListener('click', () => voteOnCurrent('accept'));
  document.getElementById('btn-reject').addEventListener('click', () => voteOnCurrent('reject'));
  document.getElementById('volume-slider').addEventListener('input', () => {
    const val = parseInt(document.getElementById('volume-slider').value);
    document.getElementById('vol-val').textContent = val;
    if (state.audioSource === 'spotify') spotifySetVolume(val / 100);
    else youtubePlayer.setVolume(val);
  });
  document.getElementById('btn-spotify-toggle').addEventListener('click', handleSourceToggle);
  document.getElementById('hud-progress-bar').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    if (state.audioSource === 'spotify') spotifySeek(frac * state.duration * 1000);
    else youtubePlayer.seek(frac * state.duration);
  });
}

function handleSourceToggle() {
  if (state.spotifyAvailable) {
    showToast('SPOTIFY CONNECTED');
  } else {
    startSpotifyAuth();
  }
}

function updateHUDForTrack(song) {
  document.getElementById('hud-title').textContent = song.title;
  document.getElementById('hud-artist').textContent = song.artist;
  document.getElementById('hud-time-cur').textContent = '0:00';
  document.getElementById('hud-time-total').textContent = '0:00';
  updateHealthDisplay(song);
  updateVoteButtonStates(song.id);
  const score = song.health || 0;
  const vs = document.getElementById('vote-status');
  if (score >= 10) { vs.textContent = '★ IMMORTAL TRACK ★'; vs.style.color = '#ffd700'; }
  else if (score <= -10) { vs.textContent = '✕ TRACK CONDEMNED'; vs.style.color = '#ff0040'; }
  else { vs.textContent = `HEALTH: ${score >= 0 ? '+' : ''}${score} / 10`; vs.style.color = ''; }
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
  let el = document.getElementById('audio-source-indicator');
  if (!el) {
    el = document.createElement('span');
    el.id = 'audio-source-indicator';
    document.getElementById('vote-status')?.parentNode?.appendChild(el);
  }
  el.textContent = text === 'SPOTIFY' ? '♫ SPOTIFY' : text === 'YOUTUBE' ? '▶ YOUTUBE' : text;
  el.className = text === 'SPOTIFY' ? 'source-spotify' : 'source-youtube';
  const btn = document.getElementById('btn-spotify-toggle');
  if (btn) {
    btn.textContent = state.spotifyAvailable ? '♫ SPOTIFY' : '▶ YOUTUBE → CONNECT SPOTIFY';
    btn.title = state.spotifyAvailable ? 'Spotify Premium connected' : 'Click to connect Spotify';
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
// VOTING
// ====================================================
function voteOnCurrent(voteType) {
  const song = state.queue[state.currentIndex];
  if (!song) return;
  if (state.votes[song.id]) { showToast('ALREADY VOTED'); return; }
  state.votes[song.id] = voteType;
  song.health = voteType === 'accept'
    ? Math.min((song.health || 0) + 1, 10)
    : Math.max((song.health || 0) - 1, -10);
  state.healthScores[song.id] = song.health;
  flashHUD(voteType);
  updateHealthDisplay(song);
  updateVoteButtonStates(song.id);
  updateSidebarTrackHealth(song.id, song.health);
  if (window.helixUpdateHealth) window.helixUpdateHealth(song.id, song.health);
  showToast(voteType === 'accept' ? `♥ HEALTH: +${song.health}` : `✕ HEALTH: ${song.health}`);
}

function flashHUD(type) {
  const hud = document.getElementById('now-playing-hud');
  hud.classList.remove('flash-accept', 'flash-reject');
  void hud.offsetWidth;
  hud.classList.add(type === 'accept' ? 'flash-accept' : 'flash-reject');
}

function updateHealthDisplay(song) {
  const score = song.health || 0;
  document.getElementById('health-val').textContent = (score >= 0 ? '+' : '') + score;
  const bar = document.getElementById('health-bar');
  bar.style.width = ((score + 10) / 20 * 100) + '%';
  if (score >= 10) { bar.style.background = '#ffd700'; bar.style.boxShadow = '0 0 10px rgba(255,215,0,0.8)'; }
  else if (score <= -5) { bar.style.background = '#ff0040'; }
  else if (score > 0) { bar.style.background = '#00ff88'; }
  else { bar.style.background = '#00e5ff'; }
}

function updateVoteButtonStates(songId) {
  const v = state.votes[songId];
  document.getElementById('btn-accept').classList.toggle('voted', v === 'accept');
  document.getElementById('btn-reject').classList.toggle('voted', v === 'reject');
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
    item.draggable = true;
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
      <div class="track-health ${score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero'}">${score !== 0 ? (score > 0 ? '+' : '') + score : '·'}</div>
    `;
    item.addEventListener('click', () => playTrackManual(idx));
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ songId: song.id, songIdx: idx }));
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => { item.style.opacity = '1'; });
    list.appendChild(item);
  });
  document.getElementById('sidebar-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.sidebar-track').forEach(el => {
      const t = el.querySelector('.track-title').textContent.toLowerCase();
      const a = el.querySelector('.track-artist').textContent.toLowerCase();
      el.style.display = (t.includes(q) || a.includes(q)) ? 'flex' : 'none';
    });
  });
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
  h.textContent = score !== 0 ? (score > 0 ? '+' : '') + score : '·';
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
  document.getElementById('mobile-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.mobile-track').forEach(el => {
      const t = el.querySelector('.mobile-track-title').textContent.toLowerCase();
      const a = el.querySelector('.mobile-track-artist').textContent.toLowerCase();
      el.style.display = (t.includes(q) || a.includes(q)) ? 'flex' : 'none';
    });
  });
}

function updateMobileActiveState(songId) {
  document.querySelectorAll('.mobile-track').forEach(el => {
    el.classList.toggle('active-track', el.dataset.id === songId);
  });
}

// ====================================================
// DRAG & DROP
// ====================================================
function setupDragDrop() {
  const hc = document.getElementById('helix-container');
  if (!hc) return;
  hc.addEventListener('dragover', e => { e.preventDefault(); hc.classList.add('drag-over'); });
  hc.addEventListener('dragleave', () => hc.classList.remove('drag-over'));
  hc.addEventListener('drop', e => {
    e.preventDefault(); hc.classList.remove('drag-over');
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const song = state.queue.find(s => s.id === data.songId);
      if (!song) return;
      const insertAt = state.currentIndex + 1;
      const existing = state.queue.findIndex(s => s.id === data.songId);
      if (existing !== -1) state.queue.splice(existing, 1);
      state.queue.splice(insertAt, 0, song);
      if (window.helixRebuild) window.helixRebuild();
      buildSidebar();
      showToast(`INJECTED: ${song.title}`);
    } catch(e) {}
  });
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
    initDNAHelix(state, { onTrackSelect: (idx) => playTrackManual(idx) });
    window.helixInitialized = true;
  } catch(e) {
    console.warn('[Radio] Helix init failed:', e.message);
  }
}

// ====================================================
// HANDLE SPOTIFY CALLBACK (on page load)
// ====================================================
(async function boot() {
  // Check if returning from Spotify auth
  if (window.location.search.includes('code=')) {
    const ok = await handleCallback();
    if (ok) console.log('[Radio] Spotify auth successful');
  }

  // Dev bypass
  if (location.search.includes('skip')) {
    document.getElementById('phase-void').classList.add('hidden');
    initMainInterface();
    return;
  }

  // Normal boot — show the void
  resizeVoidCanvas();
  createStars();
  animateVoid();
})();

// ====================================================
// RESIZE
// ====================================================
window.addEventListener('resize', () => {
  if (state.phase === 'main' && window.innerWidth > 768 && !window.helixInitialized) {
    initHelix();
  }
});
