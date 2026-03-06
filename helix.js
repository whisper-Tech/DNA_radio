/**
 * DNA RADIO // WHISPER COLLEGE — v15
 * Three.js DNA Helix Scene — Textbook base-pair design
 * Each rung = two halves (like A-T / C-G base pairs) with a gap in the middle.
 * Active (NOW PLAYING) rung = audio visualizer on Y axis (up/down).
 * Cohesive neon palette — cyan primary with accent colors, not full rainbow.
 * Tuned for Intel Iris Xe integrated GPU.
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const CFG = {
  helixRadius: 1.6,
  rungSpacing: 0.72,
  rotationPerUnit: 0.22,
  visibleRungs: 20,
  rotationSpeed: (Math.PI * 2) / 150,
  strandThickness: 0.055,
  basePairGap: 0.12,
  basePairHeight: 0.08,
  activeWaveformBars: 24,
  particleCount: 140,
  bloomStrength: 0.65,        // toned down from 0.9
  bloomRadius: 0.3,           // toned down from 0.35
  bloomThreshold: 0.3,        // raised from 0.2 — less stuff blooms
  glowTubeRadius: 0.18,       // toned down from 0.22
  nodeRadius: 0.10,
  tubeRadialSegments: 12,     // up from 8 — smoother tubes
};

// ── DNA Base-Pair Neon Color Palette ──────────────────────────────────────────
// Cohesive palette: cyan-dominant with controlled accent colors.
// Emissive intensities toned down to reduce rainbow wash.
const BASE_PAIR_COLORS = [
  // A-T: teal / soft cyan
  { left: { color: 0x00ccaa, emissive: 0x006655, emInt: 0.8 },
    right: { color: 0x00ccff, emissive: 0x006688, emInt: 0.8 } },
  // C-G: cool blue / muted violet
  { left: { color: 0x3388dd, emissive: 0x1a4477, emInt: 0.7 },
    right: { color: 0x8866cc, emissive: 0x443366, emInt: 0.7 } },
  // T-A: cyan / soft blue-green
  { left: { color: 0x00ddcc, emissive: 0x006e66, emInt: 0.8 },
    right: { color: 0x44aaee, emissive: 0x225577, emInt: 0.7 } },
  // G-C: steel blue / muted teal
  { left: { color: 0x5599cc, emissive: 0x2a4d66, emInt: 0.7 },
    right: { color: 0x33bbaa, emissive: 0x1a5d55, emInt: 0.7 } },
];

// Active rung — bright cyan for the NOW PLAYING visualizer
const ACTIVE_COLOR = { color: 0x00e5ff, emissive: 0x00aacc, emInt: 3.0 };

// Strand colors: cyan and a muted blue-violet (not magenta)
const STRAND_COLORS = {
  strand1: { color: 0x00ccff, emissive: 0x005577 },
  strand2: { color: 0x7755cc, emissive: 0x3a2a66 },
};

// ── Module state ─────────────────────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, composer;
let helixGroup;

let songRungGroups = [];
let songRungHitMeshes = [];
let songRungGlows = [];
let songNodeSpheres = [];
let rungLabels = [];
let songWaveformBars = [];

let particleSystem = null;
let particlePositions = null;
let particleVelocities = null;

let strandPts1 = [];
let strandPts2 = [];

let appState, onTrackSelectCb;
let rotationAngle = 0;
let scrollOffset = 0;
let scrollTarget = 0;
let lastTime = 0;
let animRAF;
let activeRungPulse = 0;

// Seeded random for deterministic heights
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

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
  camera.position.set(0, 2, 6.5);
  camera.lookAt(0, 0, 0);

  const canvas = document.getElementById('helix-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    // Request high-performance antialiasing
    powerPreference: 'high-performance',
  });
  renderer.setSize(w, h);
  // Use native pixel ratio (up to 2.0) for sharper lines on HiDPI
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;  // slightly less hot
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

  // Post-processing bloom — toned down
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    CFG.bloomStrength,
    CFG.bloomRadius,
    CFG.bloomThreshold
  );
  composer.addPass(bloom);

  // Lighting — simplified, no rainbow point lights
  scene.add(new THREE.AmbientLight(0x0a0a18, 2.0));

  const mainLight = new THREE.PointLight(0x88ccff, 2.5, 50);
  mainLight.position.set(0, 5, 8);
  scene.add(mainLight);

  // Single subtle accent — cool toned
  const accentLight = new THREE.PointLight(0x4466aa, 1.0, 35);
  accentLight.position.set(-4, -3, 4);
  scene.add(accentLight);

  // Top fill — very subtle cool white
  const topLight = new THREE.PointLight(0xaaddff, 1.2, 30);
  topLight.position.set(0, 15, 4);
  scene.add(topLight);

  helixGroup = new THREE.Group();
  scene.add(helixGroup);

  buildHelixMeshes();

  scrollTarget = _scrollForActiveTrack();
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
function rungY(visualIdx) {
  return -visualIdx * CFG.rungSpacing;
}

function queueToVisual(queueIdx) {
  const current = appState.currentIndex;
  const len = appState.queue.length;
  return ((queueIdx - current) + len) % len;
}

function visualToQueue(visualIdx) {
  const current = Math.max(0, appState.currentIndex);
  const len = appState.queue.length;
  return (current + visualIdx) % len;
}

function _scrollForActiveTrack() {
  return -2;
}

function getStrandPoint1(visualIdx) {
  const angle = visualIdx * CFG.rotationPerUnit;
  return new THREE.Vector3(
    Math.cos(angle) * CFG.helixRadius,
    rungY(visualIdx),
    Math.sin(angle) * CFG.helixRadius
  );
}

function getStrandPoint2(visualIdx) {
  const angle = visualIdx * CFG.rotationPerUnit + Math.PI;
  return new THREE.Vector3(
    Math.cos(angle) * CFG.helixRadius,
    rungY(visualIdx),
    Math.sin(angle) * CFG.helixRadius
  );
}

// ── Build helix ───────────────────────────────────────────────────────────────
function buildHelixMeshes() {
  const queue = appState.queue;
  const qLen = queue.length;

  strandPts1 = new Array(qLen);
  strandPts2 = new Array(qLen);
  for (let v = 0; v < qLen; v++) {
    strandPts1[v] = getStrandPoint1(v);
    strandPts2[v] = getStrandPoint2(v);
  }

  // ── STRANDS — smoother curves with more sample points ──
  const s1pts = [], s2pts = [];
  for (let v = 0; v < qLen; v += 2) {
    s1pts.push(strandPts1[v].clone());
    s2pts.push(strandPts2[v].clone());
  }
  if (qLen % 2 === 0) {
    s1pts.push(strandPts1[qLen - 1].clone());
    s2pts.push(strandPts2[qLen - 1].clone());
  }

  const curve1 = new THREE.CatmullRomCurve3(s1pts);
  const curve2 = new THREE.CatmullRomCurve3(s2pts);
  const tubeSeg = Math.max(s1pts.length * 6, 120); // more segments for smoother curves

  // Strand 1 — cyan backbone
  const strandMat1 = new THREE.MeshPhysicalMaterial({
    color: STRAND_COLORS.strand1.color,
    emissive: STRAND_COLORS.strand1.emissive,
    emissiveIntensity: 1.2,     // down from 2.0
    metalness: 0.6,
    roughness: 0.12,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.92,
  });

  // Strand 2 — muted violet backbone
  const strandMat2 = new THREE.MeshPhysicalMaterial({
    color: STRAND_COLORS.strand2.color,
    emissive: STRAND_COLORS.strand2.emissive,
    emissiveIntensity: 1.2,
    metalness: 0.6,
    roughness: 0.12,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.92,
  });

  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness, CFG.tubeRadialSegments, false), strandMat1
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness, CFG.tubeRadialSegments, false), strandMat2
  ));

  // Glow tubes — subtle
  const glowMat1 = new THREE.MeshBasicMaterial({
    color: STRAND_COLORS.strand1.color,
    transparent: true, opacity: 0.05,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowMat2 = new THREE.MeshBasicMaterial({
    color: STRAND_COLORS.strand2.color,
    transparent: true, opacity: 0.05,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 8, false), glowMat1
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 8, false), glowMat2
  ));

  // ── SONG RUNGS — base pairs or audio visualizer ─────────────────────
  songRungGroups = [];
  songRungHitMeshes = [];
  songRungGlows = [];
  songNodeSpheres = [];
  rungLabels = [];
  songWaveformBars = [];

  const barGeom = new THREE.BoxGeometry(1, 1, 1);

  for (let v = 0; v < qLen; v++) {
    const qIdx = visualToQueue(v);
    const song = queue[qIdx];
    const isActive = v === 0;
    const bpIdx = v % BASE_PAIR_COLORS.length;
    const bpColors = BASE_PAIR_COLORS[bpIdx];

    const p1 = strandPts1[v];
    const p2 = strandPts2[v];

    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length();
    const dirNorm = dir.clone().normalize();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const up = new THREE.Vector3(0, 1, 0);
    const rungQuat = new THREE.Quaternion().setFromUnitVectors(up, dirNorm);

    const rungGroup = new THREE.Group();
    rungGroup.position.copy(mid);
    rungGroup.quaternion.copy(rungQuat);

    if (isActive) {
      // ── ACTIVE RUNG: Audio visualizer bars extending on LOCAL X axis ──
      // The rung group is rotated so its local Y points along p1→p2 (the rung direction).
      // We place bars along local Y (across the rung) and scale them on LOCAL X (which
      // maps to world-space roughly up/down perpendicular to the rung) for the waveform.
      const numBars = CFG.activeWaveformBars;
      const barSpacing = length / (numBars + 1);
      const barWidth = barSpacing * 0.55;
      const barDepth = 0.08;
      const bars = [];
      const baseHeights = [];

      const activeMat = new THREE.MeshPhysicalMaterial({
        color: ACTIVE_COLOR.color,
        emissive: ACTIVE_COLOR.emissive,
        emissiveIntensity: ACTIVE_COLOR.emInt,
        metalness: 0.5,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
      });

      // Front bars — scale on X (perpendicular to rung, appears as Y in world)
      for (let b = 0; b < numBars; b++) {
        const barMesh = new THREE.Mesh(barGeom, activeMat.clone());
        const localY = -length / 2 + barSpacing * (b + 1);
        const seed = v * 100 + b;
        const randH = 0.1 + _seededRandom(seed) * 0.35;

        // barWidth along Y (across rung), barDepth on Z, randH on X (up/down in world)
        barMesh.scale.set(randH, barWidth, barDepth);
        barMesh.position.set(randH / 2, localY, 0.05);

        rungGroup.add(barMesh);
        bars.push(barMesh);
        baseHeights.push(randH);
      }

      // Mirror bars (back side) — extend in -X direction
      for (let b = 0; b < numBars; b++) {
        const barMesh = new THREE.Mesh(barGeom, activeMat.clone());
        const localY = -length / 2 + barSpacing * (b + 1);
        const seed = v * 100 + b + 50;
        const randH = 0.1 + _seededRandom(seed) * 0.35;

        barMesh.scale.set(randH, barWidth, barDepth);
        barMesh.position.set(-randH / 2, localY, -0.05);

        rungGroup.add(barMesh);
        bars.push(barMesh);
        baseHeights.push(randH);
      }

      songWaveformBars.push({ bars, baseHeights, numBars });

    } else {
      // ── NON-ACTIVE RUNG: Two-half base pair with gap ──
      const halfLen = (length - CFG.basePairGap) / 2;
      const pairH = CFG.basePairHeight;
      const pairDepth = 0.06;

      // Left half (strand1 side → center)
      const leftMat = new THREE.MeshPhysicalMaterial({
        color: bpColors.left.color,
        emissive: bpColors.left.emissive,
        emissiveIntensity: bpColors.left.emInt,
        metalness: 0.5,
        roughness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      });

      const leftMesh = new THREE.Mesh(barGeom, leftMat);
      leftMesh.scale.set(pairDepth, halfLen, pairH);
      leftMesh.position.set(0, -length / 2 + halfLen / 2, 0);
      rungGroup.add(leftMesh);

      // Right half (center → strand2 side)
      const rightMat = new THREE.MeshPhysicalMaterial({
        color: bpColors.right.color,
        emissive: bpColors.right.emissive,
        emissiveIntensity: bpColors.right.emInt,
        metalness: 0.5,
        roughness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
      });

      const rightMesh = new THREE.Mesh(barGeom, rightMat);
      rightMesh.scale.set(pairDepth, halfLen, pairH);
      rightMesh.position.set(0, length / 2 - halfLen / 2, 0);
      rungGroup.add(rightMesh);

      // Tiny hydrogen bond dots in the gap
      const bondCount = (bpIdx % 2 === 0) ? 2 : 3;
      const bondGeom = new THREE.SphereGeometry(0.015, 6, 6);
      const bondMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
      });

      for (let hb = 0; hb < bondCount; hb++) {
        const bondMesh = new THREE.Mesh(bondGeom, bondMat);
        const offset = (hb - (bondCount - 1) / 2) * 0.04;
        bondMesh.position.set(offset, 0, 0);
        rungGroup.add(bondMesh);
      }

      songWaveformBars.push(null);
    }

    rungGroup.userData = { songIndex: qIdx, songId: song.id, visualIndex: v };
    helixGroup.add(rungGroup);
    songRungGroups.push(rungGroup);

    // Invisible hit mesh for click detection
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = _createRungMesh(p1, p2, 0.15, hitMat);
    hitMesh.userData = { songIndex: qIdx, songId: song.id, visualIndex: v };
    helixGroup.add(hitMesh);
    songRungHitMeshes.push(hitMesh);

    // Glow overlay — subtle
    const glowColor = isActive ? 0x00e5ff : _blendPairColor(bpColors);
    const glowOpacity = isActive ? 0.18 : 0.015;
    const rungGlowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rungGlowMesh = _createRungMesh(p1, p2, 0.18, rungGlowMat);
    helixGroup.add(rungGlowMesh);
    songRungGlows.push(rungGlowMesh);

    // Node spheres — color-matched to strand side
    const nodeGeom = new THREE.SphereGeometry(CFG.nodeRadius, 12, 12);
    const nodeMat1 = new THREE.MeshPhysicalMaterial({
      color: isActive ? ACTIVE_COLOR.color : bpColors.left.color,
      emissive: isActive ? ACTIVE_COLOR.emissive : bpColors.left.emissive,
      emissiveIntensity: (isActive ? ACTIVE_COLOR.emInt * 0.8 : bpColors.left.emInt) * 0.9,
      metalness: 0.6,
      roughness: 0.1,
      clearcoat: 0.5,
    });
    const nodeMat2 = new THREE.MeshPhysicalMaterial({
      color: isActive ? ACTIVE_COLOR.color : bpColors.right.color,
      emissive: isActive ? ACTIVE_COLOR.emissive : bpColors.right.emissive,
      emissiveIntensity: (isActive ? ACTIVE_COLOR.emInt * 0.8 : bpColors.right.emInt) * 0.9,
      metalness: 0.6,
      roughness: 0.1,
      clearcoat: 0.5,
    });
    const node1 = new THREE.Mesh(nodeGeom, nodeMat1);
    node1.position.copy(p1);
    const node2 = new THREE.Mesh(nodeGeom, nodeMat2);
    node2.position.copy(p2);
    helixGroup.add(node1, node2);
    songNodeSpheres.push(node1, node2);

    // Label
    const labelEl = document.createElement('div');
    labelEl.className = 'helix-label' + (isActive ? ' active' : '');
    labelEl.textContent = `${song.title}  ·  ${song.artist}`;

    const label = new CSS2DObject(labelEl);
    label.position.copy(mid);
    helixGroup.add(label);
    rungLabels.push(label);
  }

  // ── PARTICLE SYSTEM — cool-toned ──────────────────────────────────────
  _buildParticleSystem();
}

// Blend left+right pair colors for glow
function _blendPairColor(bp) {
  const c = new THREE.Color(bp.left.color);
  c.lerp(new THREE.Color(bp.right.color), 0.5);
  return c.getHex();
}

// ── Particle system — cool neon tones ────────────────────────────────────────
function _buildParticleSystem() {
  const count = CFG.particleCount;
  const qLen = appState.queue.length;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  particleVelocities = new Float32Array(count * 3);

  // Cool-toned particle palette — no warm amber/magenta
  const pColors = [
    [0, 0.85, 1.0],     // cyan
    [0.3, 0.6, 1.0],    // cool blue
    [0.4, 0.3, 0.9],    // muted violet
    [0, 0.8, 0.7],      // teal
    [0.7, 0.85, 1.0],   // ice blue
    [1.0, 1.0, 1.0],    // white sparkle
  ];

  for (let i = 0; i < count; i++) {
    const vIdx = Math.floor(Math.random() * qLen);
    const strand = Math.random() > 0.5 ? 1 : 2;
    const angle = vIdx * CFG.rotationPerUnit + (strand === 2 ? Math.PI : 0);
    const r = CFG.helixRadius + (Math.random() - 0.5) * 1.0;

    positions[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 1] = rungY(vIdx) + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.3;

    const nearActive = vIdx < 4;
    const pc = pColors[Math.floor(Math.random() * pColors.length)];

    if (nearActive) {
      colors[i * 3] = pc[0];
      colors[i * 3 + 1] = pc[1];
      colors[i * 3 + 2] = pc[2];
      sizes[i] = 1.5 + Math.random() * 1.0;
    } else {
      colors[i * 3] = pc[0] * 0.4;
      colors[i * 3 + 1] = pc[1] * 0.4;
      colors[i * 3 + 2] = pc[2] * 0.4;
      sizes[i] = 0.6 + Math.random() * 0.8;
    }

    particleVelocities[i * 3] = (Math.random() - 0.5) * 0.08;
    particleVelocities[i * 3 + 1] = -(0.01 + Math.random() * 0.05);
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Round particle texture
  const cnv = document.createElement('canvas');
  cnv.width = 32; cnv.height = 32;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const material = new THREE.PointsMaterial({
    size: 0.10,
    map: new THREE.CanvasTexture(cnv),
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(geometry, material);
  particlePositions = positions;
  helixGroup.add(particleSystem);
}

// ── Mesh helpers ──────────────────────────────────────────────────────────────
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

function clearHelixMeshes() {
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

  rungLabels.forEach(l => {
    if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element);
  });
  rungLabels = [];

  if (particleSystem) {
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
    particlePositions = null;
    particleVelocities = null;
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
  activeRungPulse += delta * 3.5;

  // Smooth scroll
  scrollOffset += (scrollTarget - scrollOffset) * 0.08;

  // Move and rotate helix
  const yOffset = -scrollOffset * CFG.rungSpacing;
  helixGroup.position.y = yOffset;
  helixGroup.rotation.y = rotationAngle;

  const pulseVal = 0.5 + 0.5 * Math.sin(activeRungPulse);
  const fastPulse = time * 0.001;
  const qLen = appState.queue.length;

  // Visibility culling + active waveform animation
  songRungGroups.forEach((group, v) => {
    const localY = rungY(v);
    const worldY = localY + yOffset;
    const visible = worldY > -15 && worldY < 20;

    group.visible = visible;
    if (songRungHitMeshes[v]) songRungHitMeshes[v].visible = visible;
    if (songRungGlows[v]) songRungGlows[v].visible = visible;

    const isActive = v === 0;

    if (visible && isActive && songWaveformBars[v]) {
      // ── AUDIO VISUALIZER — bars extend on X axis (maps to up/down in world) ──
      const wb = songWaveformBars[v];
      for (let b = 0; b < wb.bars.length; b++) {
        const bar = wb.bars[b];
        const base = wb.baseHeights[b];
        const isMirror = b >= wb.numBars;
        const barIdx = isMirror ? b - wb.numBars : b;

        const centerDist = Math.abs(barIdx - wb.numBars / 2) / (wb.numBars / 2);
        const bassFreq = 2.0 + centerDist * 1.5;
        const trebleFreq = 4.0 - centerDist * 2.0;

        const wave1 = Math.abs(Math.sin(fastPulse * bassFreq + barIdx * 0.5));
        const wave2 = Math.abs(Math.sin(fastPulse * trebleFreq + barIdx * 0.9 + 1.2));
        const wave3 = Math.abs(Math.sin(fastPulse * 1.5 + barIdx * 0.3));

        const combined = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
        const newH = base * 0.2 + combined * 0.45;

        // Scale on X (perpendicular/vertical in world space)
        bar.scale.x = newH;
        bar.position.x = isMirror ? -newH / 2 : newH / 2;
      }

      // Pulse emissive on active bars
      const emInt = 2.5 + pulseVal * 1.5;
      wb.bars.forEach(bar => {
        bar.material.emissiveIntensity = emInt;
      });
    }

    // Pulse active glow
    if (visible && isActive && songRungGlows[v]) {
      songRungGlows[v].material.opacity = 0.15 + pulseVal * 0.15;
    }

    // Label visibility
    if (rungLabels[v]) {
      rungLabels[v].element.style.display = visible ? 'block' : 'none';
    }
  });

  // Node sphere visibility
  songNodeSpheres.forEach((node, i) => {
    const v = Math.floor(i / 2);
    const localY = rungY(v);
    const worldY = localY + yOffset;
    node.visible = worldY > -15 && worldY < 20;
  });

  // Animate particles
  if (particleSystem && particlePositions && particleVelocities) {
    const pCount = CFG.particleCount;
    const maxY = 2;
    const minY = rungY(qLen - 1) - 1;

    for (let i = 0; i < pCount; i++) {
      particlePositions[i * 3] += particleVelocities[i * 3] * delta;
      particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * delta;
      particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * delta;

      if (particlePositions[i * 3 + 1] < minY) {
        particlePositions[i * 3 + 1] = maxY;
      }
      if (particlePositions[i * 3 + 1] > maxY + 1) {
        particlePositions[i * 3 + 1] = minY;
      }

      // Gentle orbital motion
      const px = particlePositions[i * 3];
      const pz = particlePositions[i * 3 + 2];
      const angle = Math.atan2(pz, px) + delta * 0.12;
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
  scrollTarget += e.deltaY * 0.006;
  const maxScroll = appState.queue.length - CFG.visibleRungs;
  scrollTarget = Math.max(-3, Math.min(scrollTarget, maxScroll));
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
  clearHelixMeshes();
  buildHelixMeshes();
  scrollTarget = _scrollForActiveTrack();
}

function updateRungHealth(songId, health) {
  // Health system removed for guest view — stub for API compatibility
}
