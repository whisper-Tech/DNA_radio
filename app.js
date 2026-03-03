/**
 * DNA RADIO // THE SECRET
 * Main Application Logic
 * Phases: Void → Vortex Transition → Main Interface
 */

// Dynamic imports with fallbacks — so auth gate ALWAYS renders even if spotify fails
let audioController, spotifyLogin, spotifyLogout, isSpotifyLoggedIn;
let initAuth, isLoggedIn, getCurrentUser, isAdmin;

try {
  const authMod = await import('./auth.js');
  initAuth = authMod.initAuth;
  isLoggedIn = authMod.isLoggedIn;
  getCurrentUser = authMod.getCurrentUser;
  isAdmin = authMod.isAdmin;
} catch (e) {
  console.error('[DNA Radio] CRITICAL: auth.js failed to load:', e);
  // Absolute fallback — show the page anyway
  initAuth = (cb) => { cb && cb(); };
  isLoggedIn = () => false;
  getCurrentUser = () => null;
  isAdmin = () => false;
}

try {
  const spotMod = await import('./spotify.js?v=5');
  audioController = spotMod.audioController;
  spotifyLogin = spotMod.spotifyLogin;
  spotifyLogout = spotMod.spotifyLogout;
  isSpotifyLoggedIn = spotMod.isSpotifyLoggedIn;
} catch (e) {
  console.warn('[DNA Radio] spotify.js failed to load — audio disabled:', e);
  // Stub out the audio controller so the rest of the app still works
  audioController = {
    init: async () => 'none',
    play: async () => {},
    pause: async () => {},
    resume: async () => {},
    togglePlay: async () => {},
    seek: async () => {},
    next: () => {},
    prev: () => {},
    setNextCallback: () => {},
    setPrevCallback: () => {},
    getState: () => ({ isPlaying: false, progress: 0, duration: 0, source: 'none', spotifyReady: false, youtubeReady: false, currentSong: null }),
    onStateChange: () => {},
    setVolume: () => {},
    _lastSpotifyPos: 0,
    _onSpotifyState: () => {},
    _onTrackEnded: () => {},
  };
  spotifyLogin = () => {};
  spotifyLogout = () => {};
  isSpotifyLoggedIn = () => false;
}

// ====================================================
// CONSOLE EASTER EGG
// ====================================================
const _consoleProxy = new Proxy(console, {});
(() => {
  const style1 = 'color:#00e5ff;font-size:14px;font-weight:bold;text-shadow:0 0 10px #00e5ff;font-family:monospace;';
  const style2 = 'color:#ffd700;font-size:11px;font-family:monospace;';
  const style3 = 'color:rgba(0,229,255,0.6);font-size:10px;font-family:monospace;';
  console.log('%c' + `
██████╗ ███╗   ██╗ █████╗     ██████╗  █████╗ ██████╗ ██╗ ██████╗ 
██╔══██╗████╗  ██║██╔══██╗    ██╔══██╗██╔══██╗██╔══██╗██║██╔═══██╗
██║  ██║██╔██╗ ██║███████║    ██████╔╝███████║██║  ██║██║██║   ██║
██║  ██║██║╚██╗██║██╔══██║    ██╔══██╗██╔══██║██║  ██║██║██║   ██║
██████╔╝██║ ╚████║██║  ██║    ██║  ██║██║  ██║██████╔╝██║╚██████╔╝
╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝ 
`, style1);
  console.log('%c⚡ REWARD FOR THE CURIOUS ⚡', style2);
  console.log('%c\nYou have breached the perimeter of The Secret.\nThe system sees you.\nThe system... approves.\n\nEXECUTING: CURIOSITY_PROTOCOL.exe\nACCESS LEVEL: ELEVATED\nSTATUS: WELCOME, GHOST\n\n> Frequency locked. You were always meant to find this.\n', style3);
})();

// ====================================================
// PLAYLIST DATA
// ====================================================
const PLAYLIST = [
  { id: "s1",  title: "All Your Exes",                         artist: "Julia Michaels",                              health: 0, status: "active", youtubeId: "REKWd0u7YgU" },
  { id: "s2",  title: "Find Me",                               artist: "Nate Mitchell",                               health: 0, status: "active", youtubeId: "Adgm-MlnB3Y" },
  { id: "s3",  title: "ANGELS LIKE ME",                        artist: "Ryan Oakes, SkyDxddy",                        health: 0, status: "active", youtubeId: "kTrPxxOp4Gw" },
  { id: "s4",  title: "Apathy Anthem",                         artist: "MaeThePirate",                                health: 0, status: "active", youtubeId: "5jARpPOVrCY" },
  { id: "s5",  title: "Alien (Sped Up)",                       artist: "Nico & Chelsea",                              health: 0, status: "active", youtubeId: "1iL3mZLazt0" },
  { id: "s6",  title: "I HOPE YOUR CAR BREAKS DOWN",           artist: "MaeThePirate",                                health: 0, status: "active", youtubeId: "a5p5ZSTHinw" },
  { id: "s7",  title: "Talking To A Ghost",                    artist: "YOUTHYEAR",                                   health: 0, status: "active", youtubeId: "kZHKdeqTuug" },
  { id: "s8",  title: "Best Part Of The Story",                artist: "SkyDxddy",                                    health: 0, status: "active", youtubeId: "4Av1L5Rmoj0" },
  { id: "s9",  title: "God Of War",                            artist: "SkyDxddy",                                    health: 0, status: "active", youtubeId: "isvwPvc6Dqk" },
  { id: "s10", title: "SNAP",                                  artist: "Rosa Linn",                                   health: 0, status: "active", youtubeId: "Lo4_K4relMg" },
  { id: "s11", title: "kill the girl",                         artist: "LØLØ",                                        health: 0, status: "active", youtubeId: "zmH7PJiR2yk" },
  { id: "s12", title: "5,6,7,8",                               artist: "LØLØ, girlfriends",                           health: 0, status: "active", youtubeId: "NVOhlLfcQ7U" },
  { id: "s13", title: "It Wasn't Easy To Be Happy For You",    artist: "The Lumineers",                               health: 0, status: "active", youtubeId: "eGReASgVM1Q" },
  { id: "s14", title: "What's Stopping You",                   artist: "P!X!E",                                       health: 0, status: "active", youtubeId: "o1wxgIps1e4" },
  { id: "s15", title: "WATCH THIS",                            artist: "TAELA",                                       health: 0, status: "active", youtubeId: "iycrMFBrnsg" },
  { id: "s16", title: "If I Died Last Night",                  artist: "Jessie Murph",                                health: 0, status: "active", youtubeId: "pRtO5vlJnWw" },
  { id: "s17", title: "People That I Love Leave",              artist: "Cassadee Pope",                               health: 0, status: "active", youtubeId: "eEF8T2F92AE" },
  { id: "s18", title: "Starduhst",                             artist: "honestav",                                    health: 0, status: "active", youtubeId: "3O-2kCcI-hg" },
  { id: "s19", title: "Bullet",                                artist: "Hollywood Undead",                            health: 0, status: "active", youtubeId: "lP077RitNAc" },
  { id: "s20", title: "Such Small Hands",                      artist: "La Dispute",                                  health: 0, status: "active", youtubeId: "XlppZKMYNys" },
  { id: "s21", title: "Sara",                                  artist: "We Three",                                    health: 0, status: "active", youtubeId: "IlvELjeisqE" },
  { id: "s22", title: "HELLO LØNELINESS",                      artist: "Ekoh, Lø Spirit",                             health: 0, status: "active", youtubeId: "wAtFJAqTVhA" },
  { id: "s23", title: "Lilith",                                artist: "Halsey",                                      health: 0, status: "active", youtubeId: "9PdH-zavwO4" },
  { id: "s24", title: "007",                                   artist: "LØLØ",                                        health: 0, status: "active", youtubeId: "4okJouEbZ_s" },
  { id: "s25", title: "GrokBlocked",                           artist: "Pie For Billy",                               health: 0, status: "active", youtubeId: "gGcKxx0yvfE" },
  { id: "s26", title: "Mud",                                   artist: "CARR",                                        health: 0, status: "active", youtubeId: "g9X2aSt15jQ" },
  { id: "s27", title: "Enemy",                                 artist: "Arrested Youth",                              health: 0, status: "active", youtubeId: "z3PXjKxEkjo" },
  { id: "s28", title: "Panic Room",                            artist: "Au/Ra",                                       health: 0, status: "active", youtubeId: "Ro51SuLyh8A" },
  { id: "s29", title: "Dominoes",                              artist: "Ren",                                         health: 0, status: "active", youtubeId: "bbbjWEnC3Gc" },
  { id: "s30", title: "Full Circle",                           artist: "Movements",                                   health: 0, status: "active", youtubeId: "nVKzdqvfjO8" },
  { id: "s31", title: "All Around Me",                         artist: "Flyleaf",                                     health: 0, status: "active", youtubeId: "xN0FFK8JSYE" },
  { id: "s32", title: "Medusa",                                artist: "Cameron Whitcomb",                            health: 0, status: "active", youtubeId: "KNE8o4gK_y0" },
  { id: "s33", title: "Dopamine",                              artist: "Sum 41",                                      health: 0, status: "active", youtubeId: "yYk2BTwuQnM" },
  { id: "s34", title: "Anxiety",                               artist: "Bmike",                                       health: 0, status: "active", youtubeId: "KhnEUbbMWUM" },
  { id: "s35", title: "Teenage Dirtbag",                       artist: "Scott Bradlee's Postmodern Jukebox, Jax",     health: 0, status: "active", youtubeId: "Snh-ufvXWIk" },
  { id: "s36", title: "I Dare You",                            artist: "Shinedown",                                   health: 0, status: "active", youtubeId: "R5kaDyq41qw" },
  { id: "s37", title: "Baby Don't Cut (Acoustic)",             artist: "Bmike",                                       health: 0, status: "active", youtubeId: "0Dr0ibhVs0I" },
  { id: "s38", title: "Freckles",                              artist: "honestav",                                    health: 0, status: "active", youtubeId: "BM8y6sVVH2E" },
  { id: "s39", title: "The Other Side",                        artist: "Michael Marcagi",                             health: 0, status: "active", youtubeId: "TuQ4im63cMY" },
  { id: "s40", title: "HORROR SHOW",                           artist: "Hot Milk",                                    health: 0, status: "active", youtubeId: "OBZ84gQlBtc" },
  { id: "s41", title: "BLOSSOM",                               artist: "RØRY",                                        health: 0, status: "active", youtubeId: "Ya8dZyiD2gE" },
  { id: "s42", title: "For the Misfits",                       artist: "SkyDxddy",                                    health: 0, status: "active", youtubeId: "WurYAHXEMXQ" },
  { id: "s43", title: "Dear Diary",                            artist: "KidShazam, SkyDxddy, PONS",                   health: 0, status: "active", youtubeId: "IGgxRH7B86M" },
  { id: "s44", title: "Angel of Death",                        artist: "SkyDxddy",                                    health: 0, status: "active", youtubeId: "-_GBaVjCsOc" },
  { id: "s45", title: "i like the way you kiss me",            artist: "Artemas",                                     health: 0, status: "active", youtubeId: "evJ6gX1lp2o" },
  { id: "s46", title: "You Are Enough",                        artist: "Citizen Soldier",                             health: 0, status: "active", youtubeId: "rZLVIVByZn8" },
  { id: "s47", title: "Psycho",                                artist: "Taylor Acorn",                                health: 0, status: "active", youtubeId: "iOVGmrypaAE" },
  { id: "s48", title: "cinderella's dead",                     artist: "EMELINE",                                     health: 0, status: "active", youtubeId: "Tf7qp1CwanI" },
  { id: "s49", title: "For a Pessimist, I'm Pretty Optimistic",artist: "Paramore",                                    health: 0, status: "active", youtubeId: "B1o2UCLvD38" },
  { id: "s50", title: "Weightless",                            artist: "All Time Low",                                health: 0, status: "active", youtubeId: "TpG3BxRctQ4" },
];

// ====================================================
// APP STATE (in-memory only)
// ====================================================
const state = {
  phase: 'void',           // void | vortex | main
  currentIndex: 0,
  queue: [...PLAYLIST],    // working copy
  isPlaying: false,
  votes: {},               // songId → 'accept' | 'reject'
  healthScores: {},        // songId → number
  visitorId: generateVisitorId(),
  progress: 0,
  duration: 0,
  progressTimer: null,
};

// Ephemeral fingerprint
function generateVisitorId() {
  const nav = navigator.userAgent + navigator.language + screen.width + screen.height;
  let hash = 0;
  for (let i = 0; i < nav.length; i++) {
    hash = ((hash << 5) - hash) + nav.charCodeAt(i);
    hash |= 0;
  }
  return 'v_' + Math.abs(hash) + '_' + Date.now().toString(36);
}

// ====================================================
// STATUS BAR CLOCK
// ====================================================
function updateStatusTime() {
  const el = document.getElementById('status-time');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
  }
}
setInterval(updateStatusTime, 1000);
updateStatusTime();

// ====================================================
// PHASE 1: THE VOID - Starfield + Beacon
// ====================================================
const voidCanvas = document.getElementById('void-canvas');
const voidCtx = voidCanvas.getContext('2d');

let stars = [];
let beaconStar = null;
let holdStart = null;
let holdProgress = 0;
let holdActive = false;
let holdRAF = null;
const HOLD_DURATION = 2000; // 2 seconds

function resizeVoidCanvas() {
  voidCanvas.width = window.innerWidth;
  voidCanvas.height = window.innerHeight;
}

function createStars() {
  stars = [];
  const count = Math.floor((window.innerWidth * window.innerHeight) / 3000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * voidCanvas.width,
      y: Math.random() * voidCanvas.height,
      r: Math.random() * 1.2 + 0.2,
      alpha: Math.random() * 0.8 + 0.1,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
  // Beacon: center-ish but slightly off
  beaconStar = {
    x: voidCanvas.width * 0.5 + (Math.random() - 0.5) * 80,
    y: voidCanvas.height * 0.45 + (Math.random() - 0.5) * 80,
    r: 4,
    alpha: 1,
    pulse: 0,
    isBeacon: true,
  };
}

let voidAnimFrame = null;
function animateVoid() {
  voidCtx.clearRect(0, 0, voidCanvas.width, voidCanvas.height);
  const t = Date.now() * 0.001;

  // Draw regular stars
  for (const s of stars) {
    s.twinklePhase += s.twinkleSpeed;
    const a = s.alpha * (0.5 + 0.5 * Math.sin(s.twinklePhase));
    voidCtx.beginPath();
    voidCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(0,229,255,${a})`;
    voidCtx.fill();
  }

  // Draw Beacon
  if (beaconStar) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
    const glowR = 8 + pulse * 6;

    // Outer glow rings
    for (let i = 3; i > 0; i--) {
      const grad = voidCtx.createRadialGradient(beaconStar.x, beaconStar.y, 0, beaconStar.x, beaconStar.y, glowR * i);
      grad.addColorStop(0, `rgba(0,229,255,${0.15 / i})`);
      grad.addColorStop(1, 'rgba(0,229,255,0)');
      voidCtx.beginPath();
      voidCtx.arc(beaconStar.x, beaconStar.y, glowR * i, 0, Math.PI * 2);
      voidCtx.fillStyle = grad;
      voidCtx.fill();
    }

    // Core star
    voidCtx.beginPath();
    voidCtx.arc(beaconStar.x, beaconStar.y, beaconStar.r + pulse * 2, 0, Math.PI * 2);
    voidCtx.fillStyle = `rgba(0,229,255,${0.8 + pulse * 0.2})`;
    voidCtx.fill();

    // Hold progress ring
    if (holdActive && holdProgress > 0) {
      const angle = -Math.PI / 2 + holdProgress * Math.PI * 2;
      voidCtx.beginPath();
      voidCtx.arc(beaconStar.x, beaconStar.y, 22, -Math.PI / 2, angle);
      voidCtx.strokeStyle = `rgba(0,229,255,${0.6 + holdProgress * 0.4})`;
      voidCtx.lineWidth = 2;
      voidCtx.stroke();

      // Background ring
      voidCtx.beginPath();
      voidCtx.arc(beaconStar.x, beaconStar.y, 22, 0, Math.PI * 2);
      voidCtx.strokeStyle = 'rgba(0,229,255,0.1)';
      voidCtx.lineWidth = 1;
      voidCtx.stroke();
    }
  }

  voidAnimFrame = requestAnimationFrame(animateVoid);
}

function isOnBeacon(x, y) {
  if (!beaconStar) return false;
  const dx = x - beaconStar.x;
  const dy = y - beaconStar.y;
  return Math.sqrt(dx * dx + dy * dy) < 26;
}

function startHold(x, y) {
  if (!isOnBeacon(x, y)) return;
  holdActive = true;
  holdStart = Date.now();
  document.getElementById('void-hint').textContent = 'HOLD...';
  animateHold();
}

function animateHold() {
  if (!holdActive) return;
  const elapsed = Date.now() - holdStart;
  holdProgress = Math.min(elapsed / HOLD_DURATION, 1);
  if (holdProgress >= 1) {
    triggerVortex();
    return;
  }
  holdRAF = requestAnimationFrame(animateHold);
}

function cancelHold() {
  holdActive = false;
  holdProgress = 0;
  holdStart = null;
  document.getElementById('void-hint').textContent = 'LOCATE THE BEACON // HOLD TO ENTER';
}

// Mouse events
voidCanvas.addEventListener('mousedown', e => startHold(e.offsetX, e.offsetY));
voidCanvas.addEventListener('mouseup', cancelHold);
voidCanvas.addEventListener('mouseleave', cancelHold);

// Touch events
voidCanvas.addEventListener('touchstart', e => {
  const r = voidCanvas.getBoundingClientRect();
  const t = e.touches[0];
  startHold(t.clientX - r.left, t.clientY - r.top);
  e.preventDefault();
}, { passive: false });
voidCanvas.addEventListener('touchend', cancelHold);
voidCanvas.addEventListener('touchcancel', cancelHold);

window.addEventListener('resize', () => {
  resizeVoidCanvas();
  createStars();
});

// Initialize void phase — deferred until auth gate is passed
// (called via startVoidPhase() once the user passes the auth gate)
function startVoidPhase() {
  resizeVoidCanvas();
  createStars();
  animateVoid();
}

// ====================================================
// PHASE 2: VORTEX TRANSITION
// ====================================================
const vortexCanvas = document.getElementById('vortex-canvas');
const vortexCtx = vortexCanvas.getContext('2d');

function resizeVortexCanvas() {
  vortexCanvas.width = window.innerWidth;
  vortexCanvas.height = window.innerHeight;
}

// Vortex particles
let vortexParticles = [];

function createVortexParticles() {
  vortexParticles = [];
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * Math.max(window.innerWidth, window.innerHeight) * 0.7;
    vortexParticles.push({
      x: window.innerWidth / 2 + Math.cos(angle) * radius,
      y: window.innerHeight / 2 + Math.sin(angle) * radius,
      tx: window.innerWidth / 2,  // target x
      ty: window.innerHeight / 2,  // target y
      vx: 0, vy: 0,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.015 + 0.005,
      angle,
      radius,
      spin: (Math.random() - 0.5) * 0.05,
      phase: 0,  // 0=converging, 1=helix
    });
  }
}

let vortexRAF = null;
let vortexT = 0;

function animateVortex(startTime) {
  return new Promise((resolve) => {
    resizeVortexCanvas();
    createVortexParticles();

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    function frame() {
      const elapsed = (Date.now() - startTime) / 1000;
      vortexCtx.clearRect(0, 0, vortexCanvas.width, vortexCanvas.height);

      // phase 0-8s: converge
      // phase 8-12s: form helix bars
      const progress = Math.min(elapsed / 12, 1);

      for (const p of vortexParticles) {
        if (elapsed < 8) {
          // Converge toward center in spiral
          const t = elapsed / 8;
          const targetAngle = p.angle + p.spin * elapsed * 60;
          const targetRadius = p.radius * (1 - t * 0.85);
          const tx = cx + Math.cos(targetAngle) * targetRadius;
          const ty = cy + Math.sin(targetAngle) * targetRadius;
          p.x += (tx - p.x) * 0.08;
          p.y += (ty - p.y) * 0.08;
        } else {
          // Helix formation
          const helixT = (elapsed - 8) / 4;
          const helixPhase = (vortexParticles.indexOf(p) / vortexParticles.length);
          const angle = helixPhase * Math.PI * 4 + helixT * Math.PI;
          const helixRadius = 80 * (1 - helixT * 0.8);
          const helixY = cy - 200 + helixPhase * 400;
          const tx = cx + Math.cos(angle) * helixRadius;
          p.x += (tx - p.x) * 0.12;
          p.y += (helixY - p.y) * 0.12;
        }

        const alpha = elapsed < 9 ? p.alpha : p.alpha * (1 - (elapsed - 9) / 3);
        vortexCtx.beginPath();
        vortexCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        vortexCtx.fillStyle = `rgba(0,229,255,${Math.max(0, alpha)})`;
        vortexCtx.fill();
      }

      if (elapsed < 12) {
        vortexRAF = requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

// ====================================================
// TRIGGER VORTEX
// ====================================================
async function triggerVortex() {
  holdActive = false;
  state.phase = 'vortex';

  // Fade out void
  const voidEl = document.getElementById('phase-void');
  voidEl.style.transition = 'opacity 0.8s ease';
  voidEl.style.opacity = '0';

  cancelAnimationFrame(voidAnimFrame);

  setTimeout(async () => {
    voidEl.classList.add('hidden');

    // Show vortex phase
    const vortexEl = document.getElementById('phase-vortex');
    vortexEl.classList.remove('hidden');
    resizeVortexCanvas();

    const startTime = Date.now();

    // 0-4s: WELCOME fades in
    setTimeout(() => {
      document.getElementById('vortex-welcome').classList.add('visible');
    }, 200);

    // 4-8s: TO THE SECRET fades in
    setTimeout(() => {
      document.getElementById('vortex-secret').classList.add('visible');
    }, 4000);

    // 8-12s: Text dissolves
    setTimeout(() => {
      const welcome = document.getElementById('vortex-welcome');
      const secret = document.getElementById('vortex-secret');
      welcome.style.transition = 'opacity 1.5s ease, transform 1.5s ease';
      secret.style.transition = 'opacity 1.5s ease, transform 1.5s ease';
      welcome.style.opacity = '0';
      welcome.style.transform = 'scale(1.2)';
      secret.style.opacity = '0';
      secret.style.transform = 'scale(1.1)';
    }, 8000);

    // Start vortex particle animation
    await animateVortex(startTime);

    // Transition to main
    vortexEl.style.transition = 'opacity 1s ease';
    vortexEl.style.opacity = '0';
    setTimeout(() => {
      vortexEl.classList.add('hidden');
      initMainInterface();
    }, 1000);

  }, 800);
}

// ====================================================
// PHASE 3: MAIN INTERFACE
// ====================================================
async function initMainInterface() {
  state.phase = 'main';

  const mainEl = document.getElementById('phase-main');
  mainEl.classList.remove('hidden');
  mainEl.style.opacity = '0';
  mainEl.style.transition = 'opacity 1.2s ease';

  // Load votes from backend
  await loadVotesFromBackend();

  // Build sidebar
  buildSidebar();

  // Build mobile list
  buildMobileList();

  // Init Three.js helix (after layout is computed)
  if (window.innerWidth > 768) {
    // Delay init to ensure container has computed dimensions
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    initHelix();
  }

  // Setup HUD controls
  setupHUD();

  // Setup drag & drop
  setupDragDrop();

  // Initialize real audio system
  await audioController.init();

  // Register audio state change callback
  audioController.onStateChange((audioState) => {
    state.isPlaying = audioState.isPlaying;
    state.progress = audioState.progress;
    state.duration = audioState.duration || 1;
    updateProgressUI();
    updateAudioSourceIndicator();
  });

  // Wire next/prev callbacks to audioController
  audioController.setNextCallback(playNext);
  audioController.setPrevCallback(playPrev);

  // Update Spotify button state
  updateSpotifyButtonState();

  // Set initial volume to 65%
  audioController.setVolume(65);

  // Cue first track but do NOT auto-play (browser blocks autoplay before user gesture)
  setCurrentTrack(0, false);

  // Fade in
  setTimeout(() => { mainEl.style.opacity = '1'; }, 50);

  // Toast container
  const toast = document.createElement('div');
  toast.id = 'inject-toast';
  document.body.appendChild(toast);
}

// ====================================================
// VOTE SYSTEM (in-memory only — no backend required)
// ====================================================
async function loadVotesFromBackend() {
  // No backend — votes are in-memory only for this session
  console.log('[DNA Radio] Running in static mode — votes are session-only');
}

async function submitVote(songId, voteType) {
  // No backend — vote recorded in state.votes / state.healthScores only
  console.log(`[DNA Radio] Vote: ${songId} → ${voteType}`);
}

// ====================================================
// HUD SETUP
// ====================================================
function setupHUD() {
  const btnMute = document.getElementById('btn-mute');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnAccept = document.getElementById('btn-accept');
  const btnReject = document.getElementById('btn-reject');
  const volumeSlider = document.getElementById('volume-slider');
  const btnSpotify = document.getElementById('btn-spotify-toggle');
  const progressBar = document.getElementById('hud-progress-bar');

  btnMute.addEventListener('click', toggleMute);
  btnPrev.addEventListener('click', playPrev);
  btnNext.addEventListener('click', playNext);
  btnAccept.addEventListener('click', () => voteOnCurrent('accept'));
  btnReject.addEventListener('click', () => voteOnCurrent('reject'));

  volumeSlider.addEventListener('input', () => {
    const val = parseInt(volumeSlider.value);
    document.getElementById('vol-val').textContent = val;
    audioController.setVolume(val);
  });

  btnSpotify.addEventListener('click', handleSpotifyButtonClick);

  // Progress bar click
  progressBar.addEventListener('click', e => {
    const rect = progressBar.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    audioController.seek(fraction);
  });
}

// ====================================================
// TRACK MANAGEMENT
// ====================================================
function setCurrentTrack(index, autoPlay = false) {
  if (index < 0 || index >= state.queue.length) return;
  state.currentIndex = index;
  const song = state.queue[index];

  // Update HUD
  document.getElementById('hud-title').textContent = song.title;
  document.getElementById('hud-artist').textContent = song.artist;
  document.getElementById('hud-time-cur').textContent = '0:00';
  document.getElementById('hud-time-total').textContent = '0:00';
  updateProgressUI(0);

  // Update health display
  updateHealthDisplay(song);

  // Update vote button states
  updateVoteButtonStates(song.id);

  // Update helix if available
  if (window.helixSetCurrentTrack) {
    window.helixSetCurrentTrack(index);
  }

  // Update sidebar active state
  updateSidebarActiveState(song.id);
  updateMobileActiveState(song.id);

  // Update vote status display
  const score = song.health || 0;
  const voteStatusEl = document.getElementById('vote-status');
  if (score >= 10) {
    voteStatusEl.textContent = '★ IMMORTAL TRACK ★';
    voteStatusEl.style.color = '#ffd700';
  } else if (score <= -10) {
    voteStatusEl.textContent = '✕ TRACK CONDEMNED';
    voteStatusEl.style.color = '#ff0040';
  } else {
    voteStatusEl.textContent = `HEALTH SCORE: ${score >= 0 ? '+' : ''}${score} / 10`;
    voteStatusEl.style.color = '';
  }

  // Play via real audio controller if autoPlay requested
  if (autoPlay) {
    state.isPlaying = true;
    audioController.play(song);
  }
}

// startProgressSimulation is replaced by real audioController state updates
// Kept as no-op to avoid reference errors from any existing calls
function startProgressSimulation() {
  // No-op: real audio playback is handled by audioController
}

function updateProgressUI(override) {
  const progress = override !== undefined ? override : state.progress;
  const duration = state.duration || 1;
  const fraction = Math.min(progress / duration, 1);

  document.getElementById('hud-progress-fill').style.width = (fraction * 100) + '%';
  document.getElementById('hud-progress-thumb').style.left = (fraction * 100) + '%';
  document.getElementById('hud-time-cur').textContent = formatTime(progress);
  document.getElementById('hud-time-total').textContent = formatTime(duration);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ====================================================
// MUTE / UNMUTE (radio-style: always playing, user controls mute)
// ====================================================
let isMuted = false;

function toggleMute() {
  isMuted = !isMuted;
  audioController.setVolume(isMuted ? 0 : parseInt(document.getElementById('volume-slider').value));
  updateMuteButton();
}

function updateMuteButton() {
  const unmutedIcon = document.getElementById('unmuted-icon');
  const mutedIcon = document.getElementById('muted-icon');
  const btn = document.getElementById('btn-mute');
  if (isMuted) {
    unmutedIcon.classList.add('hidden');
    mutedIcon.classList.remove('hidden');
    btn.classList.add('is-muted');
  } else {
    unmutedIcon.classList.remove('hidden');
    mutedIcon.classList.add('hidden');
    btn.classList.remove('is-muted');
  }
}

function playNext() {
  const next = (state.currentIndex + 1) % state.queue.length;
  setCurrentTrack(next, state.isPlaying);
}

function playPrev() {
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  setCurrentTrack(prev, state.isPlaying);
}

// ====================================================
// VOTING
// ====================================================
function voteOnCurrent(voteType) {
  const song = state.queue[state.currentIndex];
  if (!song) return;

  // Check if already voted
  if (state.votes[song.id]) {
    showToast('ALREADY VOTED ON THIS TRACK');
    return;
  }

  state.votes[song.id] = voteType;

  if (voteType === 'accept') {
    song.health = Math.min((song.health || 0) + 1, 10);
    flashHUD('accept');
  } else {
    song.health = Math.max((song.health || 0) - 1, -10);
    flashHUD('reject');
  }

  state.healthScores[song.id] = song.health;

  // Update UI
  updateHealthDisplay(song);
  updateVoteButtonStates(song.id);
  updateSidebarTrackHealth(song.id, song.health);
  updateMobileTrackHealth(song.id, song.health);

  // Update helix
  if (window.helixUpdateHealth) {
    window.helixUpdateHealth(song.id, song.health);
  }

  // Update vote status
  const score = song.health;
  const voteStatusEl = document.getElementById('vote-status');
  if (score >= 10) {
    voteStatusEl.textContent = '★ IMMORTAL TRACK ★';
    voteStatusEl.style.color = '#ffd700';
    showToast('★ TRACK ACHIEVED IMMORTAL STATUS ★');
  } else if (score <= -10) {
    voteStatusEl.textContent = '✕ TRACK CONDEMNED';
    voteStatusEl.style.color = '#ff0040';
    showToast('✕ TRACK HAS BEEN CONDEMNED');
  } else {
    voteStatusEl.textContent = `HEALTH SCORE: ${score >= 0 ? '+' : ''}${score} / 10`;
    voteStatusEl.style.color = '';
    showToast(voteType === 'accept' ? `ACCEPTED // HEALTH: +${score}` : `REJECTED // HEALTH: ${score}`);
  }

  // Persist to backend
  submitVote(song.id, voteType);
}

function flashHUD(type) {
  const hud = document.getElementById('now-playing-hud');
  hud.classList.remove('flash-accept', 'flash-reject');
  void hud.offsetWidth; // reflow
  hud.classList.add(type === 'accept' ? 'flash-accept' : 'flash-reject');
}

function updateHealthDisplay(song) {
  const score = song.health || 0;
  const el = document.getElementById('health-val');
  const bar = document.getElementById('health-bar');
  el.textContent = (score >= 0 ? '+' : '') + score;

  // Bar: 0% = -10, 50% = 0, 100% = +10
  const pct = ((score + 10) / 20) * 100;
  bar.style.width = pct + '%';

  if (score >= 10) {
    bar.style.background = '#ffd700';
    bar.style.boxShadow = '0 0 10px rgba(255,215,0,0.8)';
    el.style.color = '#ffd700';
  } else if (score <= -5) {
    bar.style.background = '#ff0040';
    bar.style.boxShadow = '0 0 10px rgba(255,0,64,0.6)';
    el.style.color = '#ff0040';
  } else if (score > 0) {
    bar.style.background = '#00ff88';
    bar.style.boxShadow = '0 0 8px rgba(0,255,136,0.6)';
    el.style.color = '#00ff88';
  } else {
    bar.style.background = '#00e5ff';
    bar.style.boxShadow = '0 0 6px rgba(0,229,255,0.6)';
    el.style.color = '#00e5ff';
  }
}

function updateVoteButtonStates(songId) {
  const voted = state.votes[songId];
  const btnAccept = document.getElementById('btn-accept');
  const btnReject = document.getElementById('btn-reject');

  btnAccept.classList.toggle('voted', voted === 'accept');
  btnReject.classList.toggle('voted', voted === 'reject');
}

// ====================================================
// SIDEBAR
// ====================================================
function buildSidebar() {
  const list = document.getElementById('sidebar-list');
  list.innerHTML = '';
  document.getElementById('song-count').textContent = state.queue.length;

  state.queue.forEach((song, idx) => {
    const item = createSidebarTrack(song, idx);
    list.appendChild(item);
  });

  // Search filter
  document.getElementById('sidebar-search').addEventListener('input', e => {
    filterSidebar(e.target.value);
  });
}

function createSidebarTrack(song, idx) {
  const item = document.createElement('div');
  item.className = 'sidebar-track';
  item.dataset.id = song.id;
  item.dataset.idx = idx;
  item.draggable = true;

  const score = song.health || 0;
  let iconClass = '';
  let healthClass = 'zero';

  if (score >= 10) { iconClass = 'immortal'; healthClass = 'gold'; item.classList.add('immortal-track'); }
  else if (score <= -10) { iconClass = 'rejected'; healthClass = 'neg'; item.classList.add('rejected-track'); }
  else if (score > 0) { healthClass = 'pos'; }
  else if (score < 0) { healthClass = 'neg'; }

  item.innerHTML = `
    <svg class="track-icon ${iconClass}" viewBox="0 0 16 16" fill="none">
      <path d="M11.5 3.5a2.5 2.5 0 010 5H9V3.5h2.5z" fill="currentColor" opacity="0.7"/>
      <rect x="4" y="1" width="5" height="14" rx="1" fill="currentColor" opacity="0.5"/>
    </svg>
    <div class="track-info">
      <div class="track-title">${escHtml(song.title)}</div>
      <div class="track-artist">${escHtml(song.artist)}</div>
    </div>
    <div class="track-health ${healthClass}">${score !== 0 ? (score > 0 ? '+' : '') + score : '·'}</div>
  `;

  item.addEventListener('click', () => {
    setCurrentTrack(idx, true);
  });

  // Drag events
  item.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ songId: song.id, songIdx: idx }));
    e.dataTransfer.effectAllowed = 'copy';
    item.style.opacity = '0.5';
  });

  item.addEventListener('dragend', () => {
    item.style.opacity = '1';
  });

  return item;
}

function filterSidebar(query) {
  const items = document.querySelectorAll('.sidebar-track');
  const q = query.toLowerCase();
  items.forEach(item => {
    const title = item.querySelector('.track-title').textContent.toLowerCase();
    const artist = item.querySelector('.track-artist').textContent.toLowerCase();
    item.style.display = (title.includes(q) || artist.includes(q)) ? 'flex' : 'none';
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
  const healthEl = item.querySelector('.track-health');
  healthEl.textContent = score !== 0 ? (score > 0 ? '+' : '') + score : '·';
  healthEl.className = 'track-health ' + (score >= 10 ? 'gold' : score > 0 ? 'pos' : score < 0 ? 'neg' : 'zero');

  item.classList.remove('immortal-track', 'rejected-track');
  if (score >= 10) item.classList.add('immortal-track');
  else if (score <= -10) item.classList.add('rejected-track');

  const icon = item.querySelector('.track-icon');
  icon.className = 'track-icon' + (score >= 10 ? ' immortal' : score <= -10 ? ' rejected' : '');
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
        <div class="mobile-track-title">${escHtml(song.title)}</div>
        <div class="mobile-track-artist">${escHtml(song.artist)}</div>
      </div>
    `;
    item.addEventListener('click', () => setCurrentTrack(idx, true));
    list.appendChild(item);
  });

  document.getElementById('mobile-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.mobile-track').forEach(el => {
      const title = el.querySelector('.mobile-track-title').textContent.toLowerCase();
      const artist = el.querySelector('.mobile-track-artist').textContent.toLowerCase();
      el.style.display = (title.includes(q) || artist.includes(q)) ? 'flex' : 'none';
    });
  });
}

function updateMobileActiveState(songId) {
  document.querySelectorAll('.mobile-track').forEach(el => {
    el.classList.toggle('active-track', el.dataset.id === songId);
  });
}

function updateMobileTrackHealth(songId, score) {
  // Visual feedback on mobile
  const el = document.querySelector(`.mobile-track[data-id="${songId}"]`);
  if (!el) return;
  if (score >= 10) el.style.borderLeft = '3px solid #ffd700';
  else if (score <= -10) el.style.opacity = '0.4';
  else if (score > 0) el.style.borderLeft = '3px solid #00ff88';
  else if (score < 0) el.style.borderLeft = '3px solid #ff0040';
  else el.style.borderLeft = '';
}

// ====================================================
// DRAG & DROP (sidebar → helix)
// ====================================================
function setupDragDrop() {
  const helixContainer = document.getElementById('helix-container');
  if (!helixContainer) return;

  helixContainer.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    helixContainer.classList.add('drag-over');
  });

  helixContainer.addEventListener('dragleave', () => {
    helixContainer.classList.remove('drag-over');
  });

  helixContainer.addEventListener('drop', e => {
    e.preventDefault();
    helixContainer.classList.remove('drag-over');
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const song = state.queue.find(s => s.id === data.songId);
      if (!song) return;

      // Inject after current playing
      const insertAt = state.currentIndex + 1;
      const existing = state.queue.findIndex(s => s.id === data.songId);
      if (existing !== -1) state.queue.splice(existing, 1);
      state.queue.splice(insertAt, 0, song);

      if (window.helixRebuild) window.helixRebuild();
      buildSidebar();
      showToast(`INJECTED: ${song.title} → QUEUE POSITION ${insertAt + 1}`);
    } catch (e) {}
  });
}

// ====================================================
// SPOTIFY BUTTON HANDLER
// ====================================================
function handleSpotifyButtonClick() {
  // YouTube-only mode — toggle the Spotify embed widget or show info
  showToast('AUDIO POWERED BY YOUTUBE');
}

function updateSpotifyButtonState() {
  const btn = document.getElementById('btn-spotify-toggle');
  if (!btn) return;
  btn.textContent = '▶ YOUTUBE';
  btn.title = 'Audio powered by YouTube';
  btn.classList.add('spotify-connected');
  updateAudioSourceIndicator();
}

function updateAudioSourceIndicator() {
  let indicator = document.getElementById('audio-source-indicator');
  if (!indicator) {
    indicator = document.createElement('span');
    indicator.id = 'audio-source-indicator';
    const voteStatus = document.getElementById('vote-status');
    if (voteStatus) voteStatus.parentNode.appendChild(indicator);
  }
  const audioState = audioController.getState();
  indicator.className = '';
  if (audioState.source === 'spotify') {
    indicator.textContent = '♫ SPOTIFY';
    indicator.classList.add('source-spotify');
  } else if (audioState.source === 'youtube') {
    indicator.textContent = '▶ YOUTUBE';
    indicator.classList.add('source-youtube');
  } else {
    indicator.textContent = '';
  }
}

// ====================================================
// SPOTIFY WIDGET TOGGLE (embed panel)
// ====================================================
function toggleSpotify() {
  const widget = document.getElementById('spotify-widget');
  widget.classList.toggle('hidden');
}

// ====================================================
// TOAST NOTIFICATIONS
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
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ====================================================
// DEV BYPASS: Add ?skip to URL to jump straight to main
// ====================================================
if (location.search.includes('skip')) {
  document.getElementById('phase-void').classList.add('hidden');
  // Skip auth gate too in dev mode
  const authOverlay = document.getElementById('auth-overlay');
  if (authOverlay) authOverlay.classList.add('hidden');
  initMainInterface();
}

// ====================================================
// AMBIENT PARTICLES (CSS-based floating dots)
// ====================================================
function createAmbientParticles() {
  const container = document.getElementById('ambient-particles');
  if (!container) return;
  const count = 40;

  // Shape weights: 40% dot, 35% star4, 25% bethlehem
  function pickShape() {
    const r = Math.random();
    if (r < 0.40) return 'particle-dot';
    if (r < 0.75) return 'particle-star4';
    return 'particle-bethlehem';
  }

  // Color weights: 82% white, 9% cyan, 9% yellow
  function pickColor() {
    const r = Math.random();
    if (r < 0.82) return 'particle-white';
    if (r < 0.91) return 'particle-cyan';
    return 'particle-yellow';
  }

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const shape = pickShape();
    const color = pickColor();
    p.className = 'ambient-particle ' + shape + ' ' + color;

    let size;
    if (shape === 'particle-dot') {
      size = 1 + Math.random() * 2; // 1–3px
    } else if (shape === 'particle-star4') {
      size = 3 + Math.random() * 4; // 3–7px
    } else {
      size = 4 + Math.random() * 4; // 4–8px
    }

    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = -10 + 'px';
    p.style.animationDuration = (15 + Math.random() * 25) + 's';
    p.style.animationDelay = (Math.random() * 20) + 's';
    container.appendChild(p);
  }
}
createAmbientParticles();

// ====================================================
// AUTH GATE — must pass before void phase begins
// (skipped in dev mode via ?skip)
// ====================================================
if (!location.search.includes('skip')) {
  initAuth(() => {
    // User passed the gate (logged in or entered as guest)
    // Now start the void beacon phase
    startVoidPhase();
  });
}
// Note: ?skip mode skips both auth and void — jumps directly to main via the check below

// ====================================================
// WINDOW RESIZE - reinit helix on resize
// ====================================================
window.addEventListener('resize', () => {
  if (state.phase === 'main' && window.innerWidth > 768 && !window.helixInitialized) {
    initHelix();
  }
});

// ====================================================
// IMPORT AND INIT HELIX
// ====================================================
async function initHelix() {
  const { initDNAHelix } = await import('./helix.js');
  initDNAHelix(state, {
    onTrackSelect: (idx) => setCurrentTrack(idx, true),
  });
  window.helixInitialized = true;
}
