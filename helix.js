/**
 * DNA RADIO // WHISPER COLLEGE
 * Three.js DNA Helix Scene — 1024 Rungs
 * Waveform bar rungs, health-gradient colors, floating particles,
 * data annotations, thick glowing strands, bloom
 * Tuned for Intel Iris Xe integrated GPU
 * Reference: ADVANCEDdnaRadioDesign.jpg
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const CFG = {
  helixRadius: 2.5,
  totalRungs: 1024,
  rungSpacing: 0.35,
  rotationPerUnit: 0.25,
  visibleRungs: 36,
  rotationSpeed: (Math.PI * 2) / 120,
  strandThickness: 0.18,       // thicker strands
  rungWidth: 0.08,
  rungDepth: 0.14,
  waveformBars: 14,            // bars per rung waveform
  particleCount: 180,          // floating particles (tuned for Intel Iris Xe)
  bloomStrength: 1.6,
  bloomRadius: 0.5,
  bloomThreshold: 0.15,
};

// ── Module state ─────────────────────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, composer;
let helixGroup;

let songRungGroups = [];       // Group[] for song rung bar clusters (clickable)
let songRungHitMeshes = [];    // invisible hit-test cylinders for raycasting
let songRungGlows = [];        // Mesh[] glow overlay per song rung
let songNodeSpheres = [];      // Mesh[] node spheres at strand junction
let emptyRungInstanced = null;
let emptyNodeInstanced = null;

let rungLabels = [];           // CSS2DObject[] for song labels
let dataAnnotations = [];      // CSS2DObject[] for floating data annotations

// Waveform bar refs for animation
let songWaveformBars = [];     // Array of { bars: Mesh[], baseHeights: number[] } per song rung

// Particle system
let particleSystem = null;
let particlePositions = null;
let particleVelocities = null;
let particleOpacities = null;

// Precomputed strand points
let strandPts1 = [];
let strandPts2 = [];

let appState, onTrackSelectCb;
let rotationAngle = 0;
let scrollOffset = 0;
let scrollTarget = 0;
let lastTime = 0;
let animRAF;
let activeRungPulse = 0;

// Seeded random for deterministic waveform heights
function _seededRandom(seed) {
  let x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Public init ───────────────────────────────────────────────────────────────
export function initDNAHelix(state, callbacks) {
  appState = state;
  onTrackSelectCb = callbacks.onTrackSelect;

  const container = document.getElementById('helix-container');
  if (!container) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 800);
  const camY = _songRegionY();
  camera.position.set(0, camY, 12);
  camera.lookAt(0, camY, 0);

  const canvas = document.getElementById('helix-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap for integrated GPUs
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.setClearColor(0x000000, 0);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  const css2dLayer = document.getElementById('css2d-layer');
  css2dLayer.innerHTML = '';
  css2dLayer.appendChild(labelRenderer.domElement);

  // Post-processing — dramatic bloom
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    CFG.bloomStrength,
    CFG.bloomRadius,
    CFG.bloomThreshold
  );
  composer.addPass(bloom);

  // Lighting — multiple points for depth
  scene.add(new THREE.AmbientLight(0x0a1a2a, 1.8));

  const mainLight = new THREE.PointLight(0x00e5ff, 4, 60);
  mainLight.position.set(0, camY, 10);
  scene.add(mainLight);

  const backLight = new THREE.PointLight(0x0088aa, 2, 40);
  backLight.position.set(0, camY, -8);
  scene.add(backLight);

  const topLight = new THREE.PointLight(0x00e5ff, 1.5, 35);
  topLight.position.set(0, camY + 15, 5);
  scene.add(topLight);

  const bottomLight = new THREE.PointLight(0xff2200, 1.2, 30);
  bottomLight.position.set(0, camY - 20, 5);
  scene.add(bottomLight);

  helixGroup = new THREE.Group();
  scene.add(helixGroup);

  buildHelixMeshes();

  scrollTarget = _defaultScrollTarget();
  scrollOffset = scrollTarget;

  container.addEventListener('wheel', onWheel, { passive: false });
  container.addEventListener('click', onHelixClick);
  window.addEventListener('resize', onResize);

  window.helixSetCurrentTrack = setCurrentTrack;
  window.helixUpdateHealth = updateRungHealth;
  window.helixRebuild = () => { clearHelixMeshes(); buildHelixMeshes(); };

  requestAnimationFrame(loop);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rungY(idx) { return idx * CFG.rungSpacing; }

function songRungIndex(songIdx) {
  return (CFG.totalRungs - appState.queue.length) + songIdx;
}

function firstSongRung() {
  return CFG.totalRungs - appState.queue.length;
}

function _songRegionY() {
  return 5;
}

function _defaultScrollTarget() {
  const fsr = firstSongRung();
  return Math.max(0, fsr - Math.floor(CFG.visibleRungs / 3));
}

function getStrandPoint1(idx) {
  const angle = idx * CFG.rotationPerUnit;
  return new THREE.Vector3(
    Math.cos(angle) * CFG.helixRadius,
    rungY(idx),
    Math.sin(angle) * CFG.helixRadius
  );
}

function getStrandPoint2(idx) {
  const angle = idx * CFG.rotationPerUnit + Math.PI;
  return new THREE.Vector3(
    Math.cos(angle) * CFG.helixRadius,
    rungY(idx),
    Math.sin(angle) * CFG.helixRadius
  );
}

// ── Health-based color gradient ───────────────────────────────────────────────
function _getHealthColor(health) {
  // Returns a THREE.Color based on health score
  if (health >= 5) return new THREE.Color(0x00e5ff);   // bright cyan
  if (health >= 0) return new THREE.Color(0x008899);    // neutral teal
  if (health >= -5) return new THREE.Color(0xff8800);   // warning orange
  if (health >= -10) return new THREE.Color(0xff4400);  // orange-red
  return new THREE.Color(0xff0020);                      // deep red
}

function _getHealthColorLerped(health) {
  const c = new THREE.Color();
  if (health >= 5) {
    c.set(0x00e5ff);
  } else if (health >= 0) {
    const t = health / 5;
    c.lerpColors(new THREE.Color(0x008899), new THREE.Color(0x00e5ff), t);
  } else if (health >= -5) {
    const t = (health + 5) / 5;
    c.lerpColors(new THREE.Color(0xff4400), new THREE.Color(0x008899), t);
  } else {
    const t = Math.max(0, (health + 15) / 10);
    c.lerpColors(new THREE.Color(0xff0020), new THREE.Color(0xff4400), t);
  }
  return c;
}

function _getRungColors(health, isActive) {
  if (isActive) return { color: 0x00e5ff, emissive: 0x00bbdd, emissiveInt: 5 };
  if (health >= 10) return { color: 0xffd700, emissive: 0xcc9900, emissiveInt: 3.5 };
  if (health <= -10) return { color: 0xff0040, emissive: 0x880020, emissiveInt: 3 };
  if (health > 0) return { color: 0x00ccee, emissive: 0x006688, emissiveInt: 1.2 + health * 0.2 };
  if (health < 0) {
    const lerpFactor = Math.min(1, Math.abs(health) / 10);
    const c = new THREE.Color(0x008899).lerp(new THREE.Color(0xff4400), lerpFactor);
    const e = new THREE.Color(0x002233).lerp(new THREE.Color(0x661100), lerpFactor);
    return { color: c.getHex(), emissive: e.getHex(), emissiveInt: 0.6 + lerpFactor * 2.0 };
  }
  return { color: 0x00aacc, emissive: 0x004455, emissiveInt: 1.0 };
}

// ── Build helix ───────────────────────────────────────────────────────────────
function buildHelixMeshes() {
  const queue = appState.queue;
  const qLen = queue.length;
  const N = CFG.totalRungs;
  const fsr = firstSongRung();

  // Precompute all strand points
  strandPts1 = new Array(N);
  strandPts2 = new Array(N);
  for (let i = 0; i < N; i++) {
    strandPts1[i] = getStrandPoint1(i);
    strandPts2[i] = getStrandPoint2(i);
  }

  // ── STRANDS — thick glowing tubes ──────────────────────────────────────
  const s1pts = [], s2pts = [];
  for (let i = 0; i < N; i += 2) {
    s1pts.push(strandPts1[i].clone());
    s2pts.push(strandPts2[i].clone());
  }
  s1pts.push(strandPts1[N - 1].clone());
  s2pts.push(strandPts2[N - 1].clone());

  const curve1 = new THREE.CatmullRomCurve3(s1pts);
  const curve2 = new THREE.CatmullRomCurve3(s2pts);
  const tubeSeg = Math.floor(N / 2) * 3;

  // Main strand material — thicker, bright, emissive
  const strandMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x007799,
    emissiveIntensity: 3.0,
    metalness: 0.7,
    roughness: 0.1,
    transparent: true,
    opacity: 0.95,
  });

  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness, 12, false), strandMat
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness, 12, false), strandMat.clone()
  ));

  // Glow overlay tubes — inner glow (brighter)
  const glowMat1 = new THREE.MeshBasicMaterial({
    color: 0x00ccff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, tubeSeg, 0.55, 12, false), glowMat1
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, tubeSeg, 0.55, 12, false), glowMat1.clone()
  ));

  // Outer atmospheric glow — wide but fewer segments for perf
  const glowMat2 = new THREE.MeshBasicMaterial({
    color: 0x0088cc,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, Math.floor(tubeSeg * 0.5), 0.85, 6, false), glowMat2
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, Math.floor(tubeSeg * 0.5), 0.85, 6, false), glowMat2.clone()
  ));

  // ── EMPTY RUNGS — InstancedMesh ────────────────────────────────────────
  songRungGroups = [];
  songRungHitMeshes = [];
  songRungGlows = [];
  songNodeSpheres = [];
  rungLabels = [];
  dataAnnotations = [];
  songWaveformBars = [];

  const emptyCount = fsr;

  if (emptyCount > 0) {
    const emptyRungGeom = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    const emptyRungMat = new THREE.MeshStandardMaterial({
      color: 0x002838,
      emissive: 0x001118,
      emissiveIntensity: 0.3,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.4,
    });
    emptyRungInstanced = new THREE.InstancedMesh(emptyRungGeom, emptyRungMat, emptyCount);
    emptyRungInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const emptyNodeGeom = new THREE.SphereGeometry(CFG.strandThickness * 1.6, 6, 6);
    const emptyNodeMat = new THREE.MeshStandardMaterial({
      color: 0x003344,
      emissive: 0x001122,
      emissiveIntensity: 0.3,
      metalness: 0.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.5,
    });
    emptyNodeInstanced = new THREE.InstancedMesh(emptyNodeGeom, emptyNodeMat, emptyCount * 2);
    emptyNodeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < emptyCount; i++) {
      const p1 = strandPts1[i];
      const p2 = strandPts2[i];
      emptyRungInstanced.setMatrixAt(i, _rungMatrix(p1, p2, CFG.rungWidth * 0.6));

      const nodeQ = new THREE.Quaternion();
      const nodeS = new THREE.Vector3(1, 1, 1);
      emptyNodeInstanced.setMatrixAt(i * 2, new THREE.Matrix4().compose(p1, nodeQ, nodeS));
      emptyNodeInstanced.setMatrixAt(i * 2 + 1, new THREE.Matrix4().compose(p2, nodeQ, nodeS));
    }

    emptyRungInstanced.instanceMatrix.needsUpdate = true;
    emptyNodeInstanced.instanceMatrix.needsUpdate = true;
    helixGroup.add(emptyRungInstanced);
    helixGroup.add(emptyNodeInstanced);
  }

  // ── SONG RUNGS — waveform bar clusters ─────────────────────────────────
  const barGeom = new THREE.BoxGeometry(1, 1, 1);  // unit box, scaled per bar

  for (let s = 0; s < qLen; s++) {
    const ri = fsr + s;
    const p1 = strandPts1[ri];
    const p2 = strandPts2[ri];
    const song = queue[s];
    const health = song.health || 0;
    const isActive = s === appState.currentIndex;
    const col = _getRungColors(health, isActive);

    // Direction from p1 to p2
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length();
    const dirNorm = dir.clone().normalize();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    // Rotation to align bars along rung axis
    const up = new THREE.Vector3(0, 1, 0);
    const rungQuat = new THREE.Quaternion().setFromUnitVectors(up, dirNorm);

    // Create group for the waveform bars
    const rungGroup = new THREE.Group();
    rungGroup.position.copy(mid);
    rungGroup.quaternion.copy(rungQuat);

    const numBars = CFG.waveformBars;
    const barSpacing = length / (numBars + 1);
    const barWidth = barSpacing * 0.65;
    const barDepth = CFG.rungDepth;
    const bars = [];
    const baseHeights = [];

    const barMat = new THREE.MeshStandardMaterial({
      color: col.color,
      emissive: col.emissive,
      emissiveIntensity: col.emissiveInt,
      metalness: 0.5,
      roughness: 0.15,
    });

    for (let b = 0; b < numBars; b++) {
      const barMesh = new THREE.Mesh(barGeom, barMat.clone());

      // Position along the rung (in local space, Y = along rung direction)
      const localY = -length / 2 + barSpacing * (b + 1);

      // Random height for non-active, slightly varied
      const seed = ri * 100 + b;
      const randH = 0.08 + _seededRandom(seed) * 0.25;
      const barHeight = isActive ? (0.15 + _seededRandom(seed) * 0.3) : randH;

      barMesh.scale.set(barWidth, 1, barDepth);
      // The box is 1 unit tall, so scale Y = barHeight
      // Place it so bottom sits at the rung plane, bars extend "outward" in local X (perpendicular)
      // Actually we want bars to go perpendicular to the rung direction — that's local X or local Z.
      // Let's have them extend in local Z direction (which becomes perpendicular to the rung in world space)
      barMesh.scale.set(barWidth, barDepth, barHeight);
      barMesh.position.set(0, localY, barHeight / 2);

      rungGroup.add(barMesh);
      bars.push(barMesh);
      baseHeights.push(randH);
    }

    // Also add bars mirrored on the other side for symmetry
    for (let b = 0; b < numBars; b++) {
      const barMesh = new THREE.Mesh(barGeom, barMat.clone());
      const localY = -length / 2 + barSpacing * (b + 1);
      const seed = ri * 100 + b + 50;
      const randH = 0.08 + _seededRandom(seed) * 0.25;
      const barHeight = isActive ? (0.15 + _seededRandom(seed) * 0.3) : randH;

      barMesh.scale.set(barWidth, barDepth, barHeight);
      barMesh.position.set(0, localY, -barHeight / 2);

      rungGroup.add(barMesh);
      bars.push(barMesh);
      baseHeights.push(randH);
    }

    rungGroup.userData = { songIndex: s, songId: song.id, rungIndex: ri };
    helixGroup.add(rungGroup);
    songRungGroups.push(rungGroup);
    songWaveformBars.push({ bars, baseHeights, numBars });

    // Invisible hit-test cylinder for raycasting
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = _createRungMesh(p1, p2, CFG.rungWidth * 2.5, hitMat);
    hitMesh.userData = { songIndex: s, songId: song.id, rungIndex: ri };
    helixGroup.add(hitMesh);
    songRungHitMeshes.push(hitMesh);

    // Glow overlay for rung
    const glowColor = isActive ? 0x00e5ff : (health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff));
    const glowOpacity = isActive ? 0.4 : (health >= 10 ? 0.25 : 0.06);
    const rungGlowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rungGlowMesh = _createRungMesh(p1, p2, CFG.rungWidth * 4, rungGlowMat);
    helixGroup.add(rungGlowMesh);
    songRungGlows.push(rungGlowMesh);

    // Node spheres at strand junctions
    const nodeGeom = new THREE.SphereGeometry(CFG.strandThickness * 2, 10, 10);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: col.color,
      emissive: col.emissive,
      emissiveIntensity: col.emissiveInt * 1.3,
      metalness: 0.5,
      roughness: 0.15,
    });
    const node1 = new THREE.Mesh(nodeGeom, nodeMat);
    node1.position.copy(p1);
    const node2 = new THREE.Mesh(nodeGeom, nodeMat.clone());
    node2.position.copy(p2);
    helixGroup.add(node1, node2);
    songNodeSpheres.push(node1, node2);

    // ── Label — positioned beside the rung ──
    const labelEl = document.createElement('div');
    labelEl.className = 'helix-label' +
      (isActive ? ' active' : '') +
      (health >= 10 ? ' immortal' : '') +
      (health <= -10 ? ' rejected' : '');
    labelEl.textContent = `${song.title}  ·  ${song.artist}`;

    const label = new CSS2DObject(labelEl);
    label.position.copy(mid);
    helixGroup.add(label);
    rungLabels.push(label);

    // ── Floating data annotations ──
    _createDataAnnotations(s, song, health, isActive, mid, p1, p2);
  }

  // ── PARTICLE SYSTEM ────────────────────────────────────────────────────
  _buildParticleSystem();
}

// ── Data Annotations ──────────────────────────────────────────────────────────
function _createDataAnnotations(songIdx, song, health, isActive, mid, p1, p2) {
  // Offset to the right of the helix
  const offsetDir = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize();
  const rightOffset = offsetDir.multiplyScalar(3.5);

  // Only annotate certain rungs to avoid clutter
  const shouldAnnotate = isActive || health >= 10 || health <= -5 || songIdx === 0 || songIdx % 8 === 0;
  if (!shouldAnnotate) return;

  const annoEl = document.createElement('div');
  annoEl.className = 'helix-annotation';
  annoEl.style.cssText = `
    font-family: 'Courier New', monospace;
    font-size: 9px;
    color: ${health <= -5 ? '#ff4444' : '#00cccc'};
    opacity: 0.7;
    white-space: nowrap;
    letter-spacing: 1px;
    text-shadow: 0 0 6px ${health <= -5 ? '#ff000088' : '#00ccff88'};
    pointer-events: none;
  `;

  let text = '';
  if (isActive) {
    text = `TRACK_${String(songIdx + 1).padStart(2, '0')}: PULSE_ORIGIN`;
  } else if (health >= 10) {
    text = 'IMMORTAL_STATE: TRUE';
  } else if (health <= -10) {
    text = 'FRAGMENTED_DATA';
  } else if (health <= -5) {
    text = 'ERROR_DECAY_DETECTED';
  } else if (songIdx === 0) {
    text = 'AUDIO ANALYZER';
  } else {
    text = `SEQ_${String(songIdx).padStart(3, '0')}_ACTIVE`;
  }
  annoEl.textContent = text;

  const annoLabel = new CSS2DObject(annoEl);
  annoLabel.position.set(mid.x + rightOffset.x, mid.y, mid.z + rightOffset.z);
  helixGroup.add(annoLabel);
  dataAnnotations.push({ label: annoLabel, songIdx, health, isActive });

  // Extra waveform data annotation for active track
  if (isActive) {
    const extraEl = document.createElement('div');
    extraEl.className = 'helix-annotation';
    extraEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 8px;
      color: #00aacc;
      opacity: 0.55;
      white-space: nowrap;
      letter-spacing: 1px;
      text-shadow: 0 0 4px #00ccff66;
      pointer-events: none;
    `;
    extraEl.textContent = 'WAVEFORM_DATA: 44.1kHz / 16-BIT / STEREO';
    const extraLabel = new CSS2DObject(extraEl);
    extraLabel.position.set(mid.x + rightOffset.x, mid.y - 0.25, mid.z + rightOffset.z);
    helixGroup.add(extraLabel);
    dataAnnotations.push({ label: extraLabel, songIdx, health, isActive });
  }
}

// ── Particle system ───────────────────────────────────────────────────────────
function _buildParticleSystem() {
  const count = CFG.particleCount;
  const N = CFG.totalRungs;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  particleVelocities = new Float32Array(count * 3);
  particleOpacities = new Float32Array(count);

  const fsr = firstSongRung();

  for (let i = 0; i < count; i++) {
    // Distribute particles along the helix strands
    const rungIdx = Math.floor(Math.random() * N);
    const strand = Math.random() > 0.5 ? 1 : 2;
    const angle = rungIdx * CFG.rotationPerUnit + (strand === 2 ? Math.PI : 0);
    const r = CFG.helixRadius + (Math.random() - 0.5) * 1.5;

    positions[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.5;
    positions[i * 3 + 1] = rungY(rungIdx) + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.5;

    // Particles near song region are brighter cyan, others dimmer
    const isSongRegion = rungIdx >= fsr;
    const nearActive = isSongRegion && Math.abs(rungIdx - (fsr + (appState.currentIndex || 0))) < 5;

    if (nearActive) {
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 1.0;
      sizes[i] = 2.5 + Math.random() * 2;
    } else if (isSongRegion) {
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.6;
      colors[i * 3 + 2] = 0.8;
      sizes[i] = 1.5 + Math.random() * 1.5;
    } else {
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.3;
      colors[i * 3 + 2] = 0.5;
      sizes[i] = 0.8 + Math.random() * 1.0;
    }

    // Gentle upward drift velocity
    particleVelocities[i * 3] = (Math.random() - 0.5) * 0.1;
    particleVelocities[i * 3 + 1] = 0.02 + Math.random() * 0.08;
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    particleOpacities[i] = 0.3 + Math.random() * 0.7;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Create a small round texture for particles
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const particleTexture = new THREE.CanvasTexture(canvas);

  const material = new THREE.PointsMaterial({
    size: 0.15,
    map: particleTexture,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(geometry, material);
  particlePositions = positions;
  helixGroup.add(particleSystem);
}

// Create a cylinder mesh connecting two 3D points
function _createRungMesh(p1, p2, radius, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const length = dir.length();
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const geom = new THREE.CylinderGeometry(radius, radius, length, 8);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(mid);
  const up = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(up, dir.clone().normalize());
  return mesh;
}

// Matrix for instanced rung
function _rungMatrix(p1, p2, radius) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const length = dir.length();
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  const scale = new THREE.Vector3(radius, length, radius);
  return new THREE.Matrix4().compose(mid, quat, scale);
}

function clearHelixMeshes() {
  // Dispose song rung groups
  songRungGroups.forEach(g => {
    g.traverse(child => {
      if (child.isMesh) { child.geometry.dispose(); child.material.dispose(); }
    });
  });
  songRungGroups = [];
  songRungHitMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
  songRungHitMeshes = [];
  songWaveformBars = [];
  songRungGlows.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
  songRungGlows = [];
  songNodeSpheres.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
  songNodeSpheres = [];

  if (emptyRungInstanced) { emptyRungInstanced.geometry.dispose(); emptyRungInstanced.material.dispose(); emptyRungInstanced = null; }
  if (emptyNodeInstanced) { emptyNodeInstanced.geometry.dispose(); emptyNodeInstanced.material.dispose(); emptyNodeInstanced = null; }

  // Remove labels
  rungLabels.forEach(l => {
    if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element);
  });
  rungLabels = [];

  // Remove data annotations
  dataAnnotations.forEach(a => {
    if (a.label.element && a.label.element.parentNode) a.label.element.parentNode.removeChild(a.label.element);
  });
  dataAnnotations = [];

  // Remove particles
  if (particleSystem) {
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
    particlePositions = null;
    particleVelocities = null;
    particleOpacities = null;
  }

  helixGroup.clear();
  strandPts1 = [];
  strandPts2 = [];
}

// ── Render loop ───────────────────────────────────────────────────────────────
function loop(time) {
  animRAF = requestAnimationFrame(loop);
  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  rotationAngle += CFG.rotationSpeed * delta;
  activeRungPulse += delta * 3;

  // Smooth scroll
  scrollOffset += (scrollTarget - scrollOffset) * 0.08;

  // Move and rotate helix
  const yOffset = -scrollOffset * CFG.rungSpacing;
  helixGroup.position.y = yOffset;
  helixGroup.rotation.y = rotationAngle;

  // Pulse active rung glow
  const pulseVal = 0.5 + 0.5 * Math.sin(activeRungPulse);
  const fastPulse = time * 0.001;

  // Visibility culling + active pulse + waveform animation
  const fsr = firstSongRung();
  songRungGroups.forEach((group, s) => {
    const ri = fsr + s;
    const localY = rungY(ri);
    const worldY = localY + yOffset;
    const visible = worldY > -5 && worldY < 30;

    group.visible = visible;
    if (songRungHitMeshes[s]) songRungHitMeshes[s].visible = visible;
    if (songRungGlows[s]) songRungGlows[s].visible = visible;

    const isActive = s === appState.currentIndex;

    if (visible && isActive && songWaveformBars[s]) {
      // Animate waveform bars for active track
      const wb = songWaveformBars[s];
      for (let b = 0; b < wb.bars.length; b++) {
        const bar = wb.bars[b];
        const base = wb.baseHeights[b];
        // Sine wave animation with offset per bar
        const anim = 0.15 + Math.abs(Math.sin(fastPulse * 3 + b * 0.7)) * 0.4;
        const newH = base * 0.3 + anim;
        const isMirror = b >= wb.numBars;
        bar.scale.z = newH;
        bar.position.z = isMirror ? -newH / 2 : newH / 2;
      }

      // Pulse emissive on active bars
      const emInt = 4 + pulseVal * 3;
      wb.bars.forEach(bar => {
        bar.material.emissiveIntensity = emInt;
      });
    }

    // Pulse active glow
    if (visible && isActive && songRungGlows[s]) {
      songRungGlows[s].material.opacity = 0.3 + pulseVal * 0.25;
    }

    // Label visibility
    if (rungLabels[s]) {
      rungLabels[s].element.style.display = visible ? 'block' : 'none';
    }
  });

  // Node sphere visibility
  songNodeSpheres.forEach((node, i) => {
    const s = Math.floor(i / 2);
    const ri = fsr + s;
    const localY = rungY(ri);
    const worldY = localY + yOffset;
    node.visible = worldY > -5 && worldY < 30;
  });

  // Data annotation visibility
  dataAnnotations.forEach(a => {
    const ri = fsr + a.songIdx;
    const localY = rungY(ri);
    const worldY = localY + yOffset;
    const visible = worldY > -3 && worldY < 25;
    a.label.element.style.display = visible ? 'block' : 'none';
  });

  // Animate particles
  if (particleSystem && particlePositions && particleVelocities) {
    const N = CFG.totalRungs;
    const pCount = CFG.particleCount;
    for (let i = 0; i < pCount; i++) {
      particlePositions[i * 3] += particleVelocities[i * 3] * delta;
      particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * delta;
      particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * delta;

      // Wrap particles that go too far vertically
      const maxY = rungY(N - 1) + 2;
      if (particlePositions[i * 3 + 1] > maxY) {
        particlePositions[i * 3 + 1] = 0;
      }
      if (particlePositions[i * 3 + 1] < -2) {
        particlePositions[i * 3 + 1] = maxY;
      }

      // Slight orbital motion
      const px = particlePositions[i * 3];
      const pz = particlePositions[i * 3 + 2];
      const angle = Math.atan2(pz, px) + delta * 0.15;
      const r = Math.sqrt(px * px + pz * pz);
      particlePositions[i * 3] = Math.cos(angle) * r;
      particlePositions[i * 3 + 2] = Math.sin(angle) * r;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
  }

  composer.render();
  labelRenderer.render(scene, camera);
}

// ── Controls ──────────────────────────────────────────────────────────────────
function onWheel(e) {
  e.preventDefault();
  scrollTarget += e.deltaY * 0.004;
  scrollTarget = Math.max(0, Math.min(scrollTarget, CFG.totalRungs - CFG.visibleRungs));
}

function onHelixClick(e) {
  const container = document.getElementById('helix-container');
  const rect = container.getBoundingClientRect();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);

  // Raycast against invisible hit meshes
  const hits = raycaster.intersectObjects(songRungHitMeshes);
  if (hits.length > 0) {
    const idx = hits[0].object.userData.songIndex;
    if (idx !== undefined && onTrackSelectCb) onTrackSelectCb(idx);
  }
}

function onResize() {
  const container = document.getElementById('helix-container');
  if (!container || !renderer) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  composer.setSize(w, h);
}

// ── Public API ────────────────────────────────────────────────────────────────
function setCurrentTrack(index) {
  const queue = appState.queue;
  const fsr = firstSongRung();

  songRungGroups.forEach((group, s) => {
    const song = queue[s];
    const health = song ? (song.health || 0) : 0;
    const isActive = s === index;
    const col = _getRungColors(health, isActive);

    // Update waveform bar materials
    if (songWaveformBars[s]) {
      songWaveformBars[s].bars.forEach(bar => {
        bar.material.color.setHex(col.color);
        bar.material.emissive.setHex(col.emissive);
        bar.material.emissiveIntensity = col.emissiveInt;
      });
    }

    if (songRungGlows[s]) {
      const glowColor = isActive ? 0x00e5ff : (health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff));
      const glowOpacity = isActive ? 0.4 : (health >= 10 ? 0.25 : 0.06);
      songRungGlows[s].material.color.setHex(glowColor);
      songRungGlows[s].material.opacity = glowOpacity;
    }

    // Update node sphere colors
    if (songNodeSpheres[s * 2]) {
      songNodeSpheres[s * 2].material.color.setHex(col.color);
      songNodeSpheres[s * 2].material.emissive.setHex(col.emissive);
    }
    if (songNodeSpheres[s * 2 + 1]) {
      songNodeSpheres[s * 2 + 1].material.color.setHex(col.color);
      songNodeSpheres[s * 2 + 1].material.emissive.setHex(col.emissive);
    }

    if (rungLabels[s]) {
      const el = rungLabels[s].element;
      el.className = 'helix-label' +
        (isActive ? ' active' : '') +
        (health >= 10 ? ' immortal' : '') +
        (health <= -10 ? ' rejected' : '');
    }
  });

  // Rebuild data annotations (they depend on which track is active)
  dataAnnotations.forEach(a => {
    if (a.label.element && a.label.element.parentNode) a.label.element.parentNode.removeChild(a.label.element);
    helixGroup.remove(a.label);
  });
  dataAnnotations = [];

  for (let s = 0; s < queue.length; s++) {
    const ri = fsr + s;
    const p1 = strandPts1[ri];
    const p2 = strandPts2[ri];
    const song = queue[s];
    const health = song.health || 0;
    const isActive = s === index;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    _createDataAnnotations(s, song, health, isActive, mid, p1, p2);
  }

  // Scroll to show active track
  const activeRung = fsr + index;
  const midView = CFG.visibleRungs / 2;
  scrollTarget = Math.max(0, Math.min(activeRung - midView, CFG.totalRungs - CFG.visibleRungs));
}

function updateRungHealth(songId, health) {
  const queue = appState.queue;
  const songIdx = queue.findIndex(s => s.id === songId);
  if (songIdx === -1) return;

  const isActive = songIdx === appState.currentIndex;
  const col = _getRungColors(health, isActive);

  // Update waveform bar materials
  if (songWaveformBars[songIdx]) {
    songWaveformBars[songIdx].bars.forEach(bar => {
      bar.material.color.setHex(col.color);
      bar.material.emissive.setHex(col.emissive);
      bar.material.emissiveIntensity = col.emissiveInt;
    });
  }

  if (songRungGlows[songIdx]) {
    const glowColor = health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff);
    songRungGlows[songIdx].material.color.setHex(glowColor);
    songRungGlows[songIdx].material.opacity = health >= 10 ? 0.25 : (health <= -10 ? 0.2 : 0.06);
  }

  if (songNodeSpheres[songIdx * 2]) {
    songNodeSpheres[songIdx * 2].material.color.setHex(col.color);
    songNodeSpheres[songIdx * 2].material.emissive.setHex(col.emissive);
  }
  if (songNodeSpheres[songIdx * 2 + 1]) {
    songNodeSpheres[songIdx * 2 + 1].material.color.setHex(col.color);
    songNodeSpheres[songIdx * 2 + 1].material.emissive.setHex(col.emissive);
  }

  if (rungLabels[songIdx]) {
    const el = rungLabels[songIdx].element;
    el.className = 'helix-label' +
      (isActive ? ' active' : '') +
      (health >= 10 ? ' immortal' : '') +
      (health <= -10 ? ' rejected' : '');
  }
}
