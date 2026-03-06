/**
 * DNA RADIO // WHISPER COLLEGE — v14
 * Three.js DNA Helix Scene — Textbook base-pair design
 * Each rung = two halves (like A-T / C-G base pairs) with a gap in the middle.
 * Active (NOW PLAYING) rung = audio visualizer. All others = static pairs.
 * Multi-neon color palette on dark theme. MeshPhysicalMaterial for strands.
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
  bloomStrength: 0.9,
  bloomRadius: 0.35,
  bloomThreshold: 0.2,
  glowTubeRadius: 0.22,
  nodeRadius: 0.10,
};

// ── DNA Base-Pair Neon Color Palette ──────────────────────────────────────────
const BASE_PAIR_COLORS = [
  { left: { color: 0xff0066, emissive: 0xaa0044, emInt: 1.8 },
    right: { color: 0x00e5ff, emissive: 0x007799, emInt: 1.8 } },
  { left: { color: 0x00ff88, emissive: 0x009955, emInt: 1.6 },
    right: { color: 0xffaa00, emissive: 0x996600, emInt: 1.6 } },
  { left: { color: 0x8844ff, emissive: 0x4422aa, emInt: 1.5 },
    right: { color: 0xff6699, emissive: 0x993355, emInt: 1.5 } },
  { left: { color: 0x3399ff, emissive: 0x1155aa, emInt: 1.6 },
    right: { color: 0xccff00, emissive: 0x778800, emInt: 1.6 } },
];

const ACTIVE_COLOR = { color: 0x00e5ff, emissive: 0x00bbee, emInt: 4.5 };

const STRAND_COLORS = {
  strand1: { color: 0x00ccff, emissive: 0x0066aa },
  strand2: { color: 0xcc44ff, emissive: 0x6622aa },
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
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
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

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    CFG.bloomStrength,
    CFG.bloomRadius,
    CFG.bloomThreshold
  );
  composer.addPass(bloom);

  scene.add(new THREE.AmbientLight(0x0a0a18, 2.5));

  const mainLight = new THREE.PointLight(0x00ccff, 3.0, 50);
  mainLight.position.set(0, 5, 8);
  scene.add(mainLight);

  const accentLight1 = new THREE.PointLight(0xff0066, 1.5, 35);
  accentLight1.position.set(-5, 0, 4);
  scene.add(accentLight1);

  const accentLight2 = new THREE.PointLight(0x8844ff, 1.2, 30);
  accentLight2.position.set(5, -5, -3);
  scene.add(accentLight2);

  const topLight = new THREE.PointLight(0x00ffaa, 1.8, 30);
  topLight.position.set(0, 15, 4);
  scene.add(topLight);

  const bottomLight = new THREE.PointLight(0xff4400, 0.6, 25);
  bottomLight.position.set(0, -20, 3);
  scene.add(bottomLight);

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
  const current = appState.currentIndex;
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
  const tubeSeg = Math.max(s1pts.length * 4, 80);

  const strandMat1 = new THREE.MeshPhysicalMaterial({
    color: STRAND_COLORS.strand1.color,
    emissive: STRAND_COLORS.strand1.emissive,
    emissiveIntensity: 2.0,
    metalness: 0.7,
    roughness: 0.08,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.92,
  });

  const strandMat2 = new THREE.MeshPhysicalMaterial({
    color: STRAND_COLORS.strand2.color,
    emissive: STRAND_COLORS.strand2.emissive,
    emissiveIntensity: 2.0,
    metalness: 0.7,
    roughness: 0.08,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.92,
  });

  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness, 8, false), strandMat1
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness, 8, false), strandMat2
  ));

  const glowMat1 = new THREE.MeshBasicMaterial({
    color: STRAND_COLORS.strand1.color,
    transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowMat2 = new THREE.MeshBasicMaterial({
    color: STRAND_COLORS.strand2.color,
    transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 6, false), glowMat1
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 6, false), glowMat2
  ));

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
      const numBars = CFG.activeWaveformBars;
      const barSpacing = length / (numBars + 1);
      const barWidth = barSpacing * 0.55;
      const barDepth = 0.10;
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

      for (let b = 0; b < numBars; b++) {
        const barMesh = new THREE.Mesh(barGeom, activeMat.clone());
        const localY = -length / 2 + barSpacing * (b + 1);
        const seed = v * 100 + b;
        const randH = 0.1 + _seededRandom(seed) * 0.35;

        barMesh.scale.set(barWidth, barDepth, randH);
        barMesh.position.set(0, localY, randH / 2);

        rungGroup.add(barMesh);
        bars.push(barMesh);
        baseHeights.push(randH);
      }

      for (let b = 0; b < numBars; b++) {
        const barMesh = new THREE.Mesh(barGeom, activeMat.clone());
        const localY = -length / 2 + barSpacing * (b + 1);
        const seed = v * 100 + b + 50;
        const randH = 0.1 + _seededRandom(seed) * 0.35;

        barMesh.scale.set(barWidth, barDepth, randH);
        barMesh.position.set(0, localY, -randH / 2);

        rungGroup.add(barMesh);
        bars.push(barMesh);
        baseHeights.push(randH);
      }

      songWaveformBars.push({ bars, baseHeights, numBars });

    } else {
      const halfLen = (length - CFG.basePairGap) / 2;
      const pairH = CFG.basePairHeight;
      const pairDepth = 0.06;

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

      const bondCount = (bpIdx % 2 === 0) ? 2 : 3;
      const bondGeom = new THREE.SphereGeometry(0.015, 6, 6);
      const bondMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
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

    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = _createRungMesh(p1, p2, 0.15, hitMat);
    hitMesh.userData = { songIndex: qIdx, songId: song.id, visualIndex: v };
    helixGroup.add(hitMesh);
    songRungHitMeshes.push(hitMesh);

    const glowColor = isActive ? 0x00e5ff : _blendPairColor(bpColors);
    const glowOpacity = isActive ? 0.25 : 0.02;
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

    const nodeGeom = new THREE.SphereGeometry(CFG.nodeRadius, 10, 10);
    const nodeMat1 = new THREE.MeshPhysicalMaterial({
      color: isActive ? ACTIVE_COLOR.color : bpColors.left.color,
      emissive: isActive ? ACTIVE_COLOR.emissive : bpColors.left.emissive,
      emissiveIntensity: (isActive ? ACTIVE_COLOR.emInt : bpColors.left.emInt) * 1.2,
      metalness: 0.6,
      roughness: 0.1,
      clearcoat: 0.5,
    });
    const nodeMat2 = new THREE.MeshPhysicalMaterial({
      color: isActive ? ACTIVE_COLOR.color : bpColors.right.color,
      emissive: isActive ? ACTIVE_COLOR.emissive : bpColors.right.emissive,
      emissiveIntensity: (isActive ? ACTIVE_COLOR.emInt : bpColors.right.emInt) * 1.2,
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

    const labelEl = document.createElement('div');
    labelEl.className = 'helix-label' + (isActive ? ' active' : '');
    labelEl.textContent = `${song.title}  \u00b7  ${song.artist}`;

    const label = new CSS2DObject(labelEl);
    label.position.copy(mid);
    helixGroup.add(label);
    rungLabels.push(label);
  }

  _buildParticleSystem();
}

function _blendPairColor(bp) {
  const c = new THREE.Color(bp.left.color);
  c.lerp(new THREE.Color(bp.right.color), 0.5);
  return c.getHex();
}

function _buildParticleSystem() {
  const count = CFG.particleCount;
  const qLen = appState.queue.length;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  particleVelocities = new Float32Array(count * 3);

  const pColors = [
    [0, 0.9, 1.0],
    [1.0, 0, 0.4],
    [0.53, 0.27, 1.0],
    [0, 1.0, 0.53],
    [1.0, 0.67, 0],
    [1.0, 1.0, 1.0],
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
      sizes[i] = 2.0 + Math.random() * 1.5;
    } else {
      colors[i * 3] = pc[0] * 0.5;
      colors[i * 3 + 1] = pc[1] * 0.5;
      colors[i * 3 + 2] = pc[2] * 0.5;
      sizes[i] = 0.8 + Math.random() * 1.0;
    }

    particleVelocities[i * 3] = (Math.random() - 0.5) * 0.08;
    particleVelocities[i * 3 + 1] = -(0.01 + Math.random() * 0.05);
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

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
    size: 0.12,
    map: new THREE.CanvasTexture(cnv),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });

  particleSystem = new THREE.Points(geometry, material);
  particlePositions = positions;
  helixGroup.add(particleSystem);
}

function _createRungMesh(p1, p2, radius, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const length = dir.length();
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const geom = new THREE.CylinderGeometry(radius, radius, length, 6);
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

  scrollOffset += (scrollTarget - scrollOffset) * 0.08;

  const yOffset = -scrollOffset * CFG.rungSpacing;
  helixGroup.position.y = yOffset;
  helixGroup.rotation.y = rotationAngle;

  const pulseVal = 0.5 + 0.5 * Math.sin(activeRungPulse);
  const fastPulse = time * 0.001;
  const qLen = appState.queue.length;

  songRungGroups.forEach((group, v) => {
    const localY = rungY(v);
    const worldY = localY + yOffset;
    const visible = worldY > -15 && worldY < 20;

    group.visible = visible;
    if (songRungHitMeshes[v]) songRungHitMeshes[v].visible = visible;
    if (songRungGlows[v]) songRungGlows[v].visible = visible;

    const isActive = v === 0;

    if (visible && isActive && songWaveformBars[v]) {
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

        bar.scale.z = newH;
        bar.position.z = isMirror ? -newH / 2 : newH / 2;
      }

      const emInt = 3.5 + pulseVal * 2.5;
      wb.bars.forEach(bar => {
        bar.material.emissiveIntensity = emInt;
      });
    }

    if (visible && isActive && songRungGlows[v]) {
      songRungGlows[v].material.opacity = 0.2 + pulseVal * 0.2;
    }

    if (rungLabels[v]) {
      rungLabels[v].element.style.display = visible ? 'block' : 'none';
    }
  });

  songNodeSpheres.forEach((node, i) => {
    const v = Math.floor(i / 2);
    const localY = rungY(v);
    const worldY = localY + yOffset;
    node.visible = worldY > -15 && worldY < 20;
  });

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

function setCurrentTrack(index) {
  clearHelixMeshes();
  buildHelixMeshes();
  scrollTarget = _scrollForActiveTrack();
}

function updateRungHealth(songId, health) {
  // Health system removed — stub for API compatibility
}
