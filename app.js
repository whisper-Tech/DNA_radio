/**
 * DNA RADIO // WHISPER COLLEGE — v15
 * 24/7 Clockwork Radio + Spotify Primary + YouTube Fallback
 * No backend required. No auth gate.
 */

import { ClockworkRadio } from './radio.js';
import {
  getStoredToken, handleCallback, startSpotifyAuth, initSpotifyPlayer,
  spotifyPlay, spotifyPause, spotifyResume, spotifySeek, spotifySetVolume,
  isSpotifyReady, clearTokens, markAutoPlayHandled,
} from './spotify-auth.js';
import { youtubePlayer } from './youtube.js';

// ====================================================
// PLAYLIST DATA
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
  { id:"s11", title:"kill the girl",                         artist:"L\u00d8L\u00d8",                                        health:0, youtubeId:"zmH7PJiR2yk", duration:190 },
  { id:"s12", title:"5,6,7,8",                               artist:"L\u00d8L\u00d8, girlfriends",                           health:0, youtubeId:"NVOhlLfcQ7U", duration:185 },
  { id:"s13", title:"It Wasn't Easy To Be Happy For You",    artist:"The Lumineers",                               health:0, youtubeId:"eGReASgVM1Q", spotifyUri:"spotify:track:3l2NQJS9LK87ChVVMVSxD7", duration:222 },
  { id:"s14", title:"What's Stopping You",                   artist:"P!X!E",                                       health:0, youtubeId:"o1wxgIps1e4", duration:195 },
  { id:"s15", title:"WATCH THIS",                            artist:"TAELA",                                       health:0, youtubeId:"iycrMFBrnsg", duration:180 },
  { id:"s16", title:"If I Died Last Night",                  artist:"Jessie Murph",                                health:0, youtubeId:"pRtO5vlJnWw", spotifyUri:"spotify:track:7G5M0duiNDVuHDKmFqjlqf", duration:200 },
  { id:"s17", title:"People That I Love Leave",              artist:"Cassadee Pope",                               health:0, youtubeId:"eEF8T2F92AE", duration:210 },
  { id:"s18", title:"Starduhst",                             artist:"honestav",                                    health:0, youtubeId:"3O-2kCcI-hg", duration:185 },
  { id:"s19", title:"Bullet",                                artist:"Hollywood Undead",                            health:0, youtubeId:"lP077RitNAc", spotifyUri:"spotify:track:0tJ9xhZIAICAjJuNal9hAK", duration:216 },
  { id:"s20", title:"Such Small Hands",                      artist:"La Dispute",                                  health:0, youtubeId:"XlppZKMYNys", spotifyUri:"spotify:track:1K3lbDfFMPB6pQDQbMHJPe", duration:135 },
  { id:"s21", title:"Sara",                                  artist:"We Three",                                    health:0, youtubeId:"IlvELjeisqE", duration:245 },
  { id:"s22", title:"HELLO L\u00d8NELINESS",                      artist:"Ekoh, L\u00f8 Spirit",                             health:0, youtubeId:"wAtFJAqTVhA", duration:200 },
  { id:"s23", title:"Lilith",                                artist:"Halsey",                                      health:0, youtubeId:"9PdH-zavwO4", spotifyUri:"spotify:track:4OF29bVGvMgEKsBqvYCGhb", duration:195 },
  { id:"s24", title:"007",                                   artist:"L\u00d8L\u00d8",                                        health:0, youtubeId:"4okJouEbZ_s", duration:180 },
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
  { id:"s41", title:"BLOSSOM",                               artist:"R\u00d8RY",                                        health:0, youtubeId:"Ya8dZyiD2gE", duration:190 },
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
  audioSource: 'none',
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
// PHASE 1: THE VOID
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
  if (beaconStar) {
    const pulse = 0.3 + 0.2 * Math.sin(t * 1.5);
    voidCtx.beginPath();
    voidCtx.arc(beaconStar.x, beaconStar.y, beaconStar.r + pulse * 0.5, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(200,220,255,${pulse})`;
    voidCtx.fill();
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
// PHASE 1.5: REVEAL
// ====================================================
async function triggerReveal() {
  holdActive = false;
  state.phase = 'reveal';
  cancelAnimationFrame(voidAnimFrame);

  const voidEl = document.getElementById('phase-void');
  voidEl.style.transition = 'opacity 1.5s ease';
  voidEl.style.opacity = '0.3';

  const revealEl = document.getElementById('phase-reveal');
  revealEl.classList.remove('hidden');

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

  await new Promise(r => setTimeout(r, 1800));

  revealEl.style.transition = 'opacity 1.2s ease';
  revealEl.style.opacity = '0';
  voidEl.style.opacity = '0';

  await new Promise(r => setTimeout(r, 1200));
  voidEl.classList.add('hidden');
  revealEl.classList.add('hidden');

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
  setupHUD();
  setupSidebarDrag();

  // Show main UI immediately so it's visible even if audio init takes time
  setTimeout(() => { mainEl.style.opacity = '1'; }, 50);

  // Init audio (may take time for Spotify SDK)
  await initAudio();

  // Sync to clockwork radio
  syncToRadio();

  // Now init helix AFTER currentIndex is set by syncToRadio
  if (window.innerWidth > 768) {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    initHelix();
  }

  // Toast container
  if (!document.getElementById('inject-toast')) {
    const toast = document.createElement('div');
    toast.id = 'inject-toast';
    document.body.appendChild(toast);
  }
}

// ====================================================
// AUDIO INIT
// ====================================================
async function initAudio() {
  const token = getStoredToken();
  if (token) {
    updateSourceIndicator('Connecting to Spotify...');
    try {
      const player = await Promise.race([
        initSpotifyPlayer(handleSpotifyState),
        new Promise(resolve => setTimeout(() => resolve(null), 8000)),
      ]);
      if (player) {
        state.spotifyAvailable = true;
        state.audioSource = 'spotify';
        updateSourceIndicator('SPOTIFY');
        console.log('[Radio] Spotify connected');
        youtubePlayer.init();
        youtubePlayer.onStateChange(handleYouTubeState);
        youtubePlayer.onTrackEnd(handleTrackEnd);
        return;
      }
    } catch (e) {
      console.warn('[Radio] Spotify init failed:', e.message);
    }
  }
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
  console.log('[Radio] Track ended, advancing to next');
  const next = (state.currentIndex + 1) % state.queue.length;
  playTrackAtIndex(next, 0);
}

// ====================================================
// CLOCKWORK SYNC
// ====================================================
function syncToRadio() {
  const now = radio.getNow();
  const song = now.track;
  const seekSec = now.positionSeconds;
  console.log(`[Radio] Initial sync: "${song.title}" at ${Math.floor(seekSec)}s`);
  playTrackAtIndex(now.trackIndex, seekSec);
}

function playTrackAtIndex(index, seekSeconds) {
  state.currentIndex = index;
  const song = state.queue[index];
  updateHUDForTrack(song);
  updateSidebarActiveState(song.id);
  updateMobileActiveState(song.id);
  if (window.helixSetCurrentTrack) window.helixSetCurrentTrack(index);

  markAutoPlayHandled();

  // Start audio analysis for visualizer
  startVisualizerForTrack(song);

  if (state.spotifyAvailable && song.spotifyUri) {
    youtubePlayer.pause();
    spotifyPlay(song.spotifyUri, (seekSeconds || 0) * 1000);
    if (state.audioSource !== 'spotify') {
      state.audioSource = 'spotify';
      updateSourceIndicator('SPOTIFY');
    }
  } else {
    if (state.spotifyAvailable) {
      spotifyPause();
    }
    youtubePlayer.play(song.youtubeId, seekSeconds || 0);
    if (state.audioSource !== 'youtube') {
      state.audioSource = 'youtube';
      updateSourceIndicator('YOUTUBE (fallback)');
    }
  }
  state.isPlaying = true;
}

function playNext() {
  const next = (state.currentIndex + 1) % state.queue.length;
  playTrackAtIndex(next, 0);
}

function playPrev() {
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  playTrackAtIndex(prev, 0);
}

function playTrackManual(index) {
  playTrackAtIndex(index, 0);
}

// ====================================================
// HUD SETUP
// ====================================================
function setupHUD() {
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-prev').addEventListener('click', playPrev);
  document.getElementById('btn-next').addEventListener('click', playNext);
  document.getElementById('volume-slider').addEventListener('input', () => {
    const val = parseInt(document.getElementById('volume-slider').value);
    document.getElementById('vol-val').textContent = val;
    if (state.audioSource === 'spotify') spotifySetVolume(val / 100);
    else youtubePlayer.setVolume(val);
  });
  document.getElementById('hud-progress-bar').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    if (state.audioSource === 'spotify') spotifySeek(frac * state.duration * 1000);
    else youtubePlayer.seek(frac * state.duration);
  });

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('collapsed');
      sidebarToggle.classList.toggle('sidebar-open');
    });
  }
}

function updateHUDForTrack(song) {
  document.getElementById('hud-title').textContent = song.title;
  document.getElementById('hud-artist').textContent = song.artist;
  document.getElementById('hud-time-cur').textContent = '0:00';
  document.getElementById('hud-time-total').textContent = '0:00';
  const ss = document.getElementById('source-status');
  if (ss) {
    ss.textContent = state.audioSource === 'spotify' ? '\u266b SPOTIFY' : '\u25b6 YOUTUBE';
    ss.className = state.audioSource === 'spotify' ? 'source-spotify' : 'source-youtube';
  }
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
  const ss = document.getElementById('source-status');
  if (ss) {
    ss.textContent = text === 'SPOTIFY' ? '\u266b SPOTIFY' : text === 'YOUTUBE' ? '\u25b6 YOUTUBE' : text;
    ss.className = text === 'SPOTIFY' ? 'source-spotify' : 'source-youtube';
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
      <div class="track-health ${score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero'}">${score !== 0 ? (score > 0 ? '+' : '') + score : '\u00b7'}</div>
    `;
    item.addEventListener('click', () => {
      // Only fire click if sidebar drag is NOT active
      if (!sidebarDragState.active) playTrackManual(idx);
    });
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
  h.textContent = score !== 0 ? (score > 0 ? '+' : '') + score : '\u00b7';
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
// AUDIO VISUALIZER DATA FEED
// ====================================================
// Generates frequency-like data for the helix visualizer.
// When Spotify is playing and we have an auth token, we fetch
// the Spotify Audio Analysis API for segment loudness data.
// Otherwise, we generate procedural data synced to playback progress.

let _vizAnalysis = null;  // Spotify audio analysis segments
let _vizAnimFrame = null;
const VIZ_BINS = 24;     // must match CFG.activeWaveformBars

async function startVisualizerForTrack(song) {
  // Cancel any previous visualizer loop
  if (_vizAnimFrame) { cancelAnimationFrame(_vizAnimFrame); _vizAnimFrame = null; }
  _vizAnalysis = null;

  // Try to fetch Spotify audio analysis if we have a token and track ID
  if (song.spotifyUri && getStoredToken()) {
    const trackId = song.spotifyUri.split(':').pop();
    try {
      const token = getStoredToken();
      const resp = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        _vizAnalysis = data;
        console.log(`[Viz] Loaded audio analysis for "${song.title}" — ${data.segments?.length || 0} segments`);
      }
    } catch (e) {
      console.warn('[Viz] Audio analysis fetch failed:', e.message);
    }
  }

  // Start the visualizer pump
  pumpVisualizerData();
}

function pumpVisualizerData() {
  if (!window.helixSetAudioData) {
    _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
    return;
  }

  const progress = state.progress || 0;
  const bins = new Float32Array(VIZ_BINS);

  if (_vizAnalysis && _vizAnalysis.segments && _vizAnalysis.segments.length > 0) {
    // ── REAL DATA: Map Spotify segments to frequency bins ──
    const segs = _vizAnalysis.segments;

    // Find the segment at current playback position
    let segIdx = 0;
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= progress) segIdx = i;
      else break;
    }

    const seg = segs[segIdx];
    const nextSeg = segs[Math.min(segIdx + 1, segs.length - 1)];

    // Spotify segments have loudness_max (-60 to 0 dB) and pitches (12 values 0-1)
    // Map pitches to bins for the "frequency" look
    const pitches = seg.pitches || new Array(12).fill(0.5);
    const loudnessNorm = Math.max(0, Math.min(1, (seg.loudness_max + 60) / 60));

    // Interpolation factor within the current segment
    const segProgress = Math.max(0, Math.min(1, (progress - seg.start) / (seg.duration || 1)));

    // Spread 12 pitches across VIZ_BINS with loudness scaling
    for (let b = 0; b < VIZ_BINS; b++) {
      const pitchIdx = (b / VIZ_BINS) * 12;
      const p0 = Math.floor(pitchIdx);
      const p1 = Math.min(p0 + 1, 11);
      const frac = pitchIdx - p0;
      const pitchVal = pitches[p0] * (1 - frac) + pitches[p1] * frac;

      // Scale by loudness and add some temporal variation
      const temporal = 0.7 + 0.3 * Math.sin(progress * 4.5 + b * 0.6);
      bins[b] = pitchVal * loudnessNorm * temporal;

      // Smooth transition toward next segment
      if (nextSeg && nextSeg.pitches && segProgress > 0.7) {
        const blendFactor = (segProgress - 0.7) / 0.3;
        const nextPitch = nextSeg.pitches[p0] * (1 - frac) + nextSeg.pitches[p1] * frac;
        const nextLoudness = Math.max(0, Math.min(1, (nextSeg.loudness_max + 60) / 60));
        bins[b] = bins[b] * (1 - blendFactor) + nextPitch * nextLoudness * temporal * blendFactor;
      }
    }
  } else {
    // ── PROCEDURAL FALLBACK ──
    // Let helix.js handle its own procedural animation (pass null)
    window.helixSetAudioData(null);
    _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
    return;
  }

  window.helixSetAudioData(bins);
  _vizAnimFrame = requestAnimationFrame(pumpVisualizerData);
}

// ====================================================
// QUEUE REORDER (used by helix drag-drop & sidebar drag)
// ====================================================
function reorderQueue(fromQueueIdx, toQueueIdx) {
  // Protect the currently playing song
  if (fromQueueIdx === state.currentIndex) return;

  const qLen = state.queue.length;
  if (fromQueueIdx < 0 || fromQueueIdx >= qLen) return;
  if (toQueueIdx < 0 || toQueueIdx >= qLen) return;
  if (fromQueueIdx === toQueueIdx) return;

  // Don't allow dropping onto the currently playing slot
  if (toQueueIdx === state.currentIndex) return;

  const song = state.queue[fromQueueIdx];

  // Remove from old position
  state.queue.splice(fromQueueIdx, 1);

  // Adjust currentIndex if needed after removal
  let newCurrent = state.currentIndex;
  if (fromQueueIdx < newCurrent) {
    newCurrent--;
  }

  // Adjust toQueueIdx after removal
  let insertAt = toQueueIdx;
  if (fromQueueIdx < toQueueIdx) {
    insertAt--;
  }

  // Insert at new position
  state.queue.splice(insertAt, 0, song);

  // Adjust currentIndex if needed after insertion
  if (insertAt <= newCurrent) {
    newCurrent++;
  }
  state.currentIndex = newCurrent;

  // Rebuild everything
  if (window.helixRebuild) window.helixRebuild();
  buildSidebar();
  updateSidebarActiveState(state.queue[state.currentIndex].id);
  showToast(`MOVED: ${song.title}`);
  console.log(`[Radio] Reordered: "${song.title}" from ${fromQueueIdx} to ${insertAt}`);
}

// ====================================================
// SIDEBAR DRAG-TO-REORDER
// ====================================================
let sidebarDragState = {
  active: false,
  sourceEl: null,
  sourceIdx: -1,
  ghostEl: null,
  placeholderEl: null,
  startY: 0,
};

function setupSidebarDrag() {
  const list = document.getElementById('sidebar-list');
  if (!list) return;

  list.addEventListener('pointerdown', onSidebarPointerDown);
  list.addEventListener('pointermove', onSidebarPointerMove);
  list.addEventListener('pointerup', onSidebarPointerUp);
  list.addEventListener('pointercancel', cleanupSidebarDrag);
}

function onSidebarPointerDown(e) {
  const track = e.target.closest('.sidebar-track');
  if (!track) return;
  const idx = parseInt(track.dataset.idx, 10);
  // Don't allow reordering the active song
  if (idx === state.currentIndex) return;

  sidebarDragState.startY = e.clientY;
  sidebarDragState.sourceEl = track;
  sidebarDragState.sourceIdx = idx;
}

function onSidebarPointerMove(e) {
  if (!sidebarDragState.sourceEl) return;

  // Activate after 8px of movement
  if (!sidebarDragState.active) {
    if (Math.abs(e.clientY - sidebarDragState.startY) < 8) return;
    sidebarDragState.active = true;

    // Create ghost
    const ghost = sidebarDragState.sourceEl.cloneNode(true);
    ghost.className = 'sidebar-track sidebar-drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.width = sidebarDragState.sourceEl.offsetWidth + 'px';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    sidebarDragState.ghostEl = ghost;

    // Dim source
    sidebarDragState.sourceEl.style.opacity = '0.3';
  }

  if (!sidebarDragState.active) return;

  // Position ghost
  sidebarDragState.ghostEl.style.left = sidebarDragState.sourceEl.getBoundingClientRect().left + 'px';
  sidebarDragState.ghostEl.style.top = (e.clientY - 20) + 'px';

  // Find drop target by scanning sidebar tracks
  const list = document.getElementById('sidebar-list');
  const tracks = Array.from(list.querySelectorAll('.sidebar-track'));

  // Remove old indicators
  tracks.forEach(t => {
    t.classList.remove('drag-above', 'drag-below');
  });

  for (const t of tracks) {
    const rect = t.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) {
      t.classList.add('drag-above');
      break;
    } else if (e.clientY >= midY && e.clientY <= rect.bottom) {
      t.classList.add('drag-below');
      break;
    }
  }
}

function onSidebarPointerUp(e) {
  if (!sidebarDragState.active) {
    cleanupSidebarDrag();
    return;
  }

  // Determine target index
  const list = document.getElementById('sidebar-list');
  const tracks = Array.from(list.querySelectorAll('.sidebar-track'));
  let targetIdx = sidebarDragState.sourceIdx;

  for (let i = 0; i < tracks.length; i++) {
    const rect = tracks[i].getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const tIdx = parseInt(tracks[i].dataset.idx, 10);
    if (e.clientY < midY) {
      targetIdx = tIdx;
      break;
    }
    // If we passed all tracks, drop at end
    if (i === tracks.length - 1) {
      targetIdx = tIdx + 1;
      if (targetIdx >= state.queue.length) targetIdx = state.queue.length - 1;
    }
  }

  // Don't drop onto the currently playing track
  if (targetIdx === state.currentIndex) {
    cleanupSidebarDrag();
    return;
  }

  if (targetIdx !== sidebarDragState.sourceIdx) {
    reorderQueue(sidebarDragState.sourceIdx, targetIdx);
  }

  cleanupSidebarDrag();
}

function cleanupSidebarDrag() {
  if (sidebarDragState.ghostEl) {
    sidebarDragState.ghostEl.remove();
  }
  if (sidebarDragState.sourceEl) {
    sidebarDragState.sourceEl.style.opacity = '';
  }
  // Remove indicators
  document.querySelectorAll('.sidebar-track').forEach(t => {
    t.classList.remove('drag-above', 'drag-below');
  });
  sidebarDragState = { active: false, sourceEl: null, sourceIdx: -1, ghostEl: null, placeholderEl: null, startY: 0 };
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
    initDNAHelix(state, {
      onTrackSelect: (idx) => playTrackManual(idx),
      onTrackReorder: (fromIdx, toIdx) => reorderQueue(fromIdx, toIdx),
    });
    window.helixInitialized = true;
  } catch(e) {
    console.warn('[Radio] Helix init failed:', e.message);
  }
}

// ====================================================
// HANDLE SPOTIFY CALLBACK (on page load)
// ====================================================
(async function boot() {
  if (window.location.search.includes('code=')) {
    const ok = await handleCallback();
    if (ok) console.log('[Radio] Spotify auth successful');
  }

  if (location.search.includes('skip')) {
    document.getElementById('phase-void').classList.add('hidden');
    initMainInterface();
    return;
  }

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
