/**
 * DNA RADIO // WHISPER COLLEGE — v13
 * Three.js DNA Helix Scene — Song-only, flipped orientation
 * Current track is ALWAYS the TOP rung. Queue descends below.
 * Thinner strands, wider rung spacing, audio visualizer on active rung.
 * Tuned for Intel Iris Xe integrated GPU.
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const CFG = {
  helixRadius: 1.5,              // slimmer helix (was 2.5)
  rungSpacing: 0.7,              // more spread (was 0.35)
  rotationPerUnit: 0.22,         // slightly tighter twist
  visibleRungs: 20,              // how many rungs visible at once
  rotationSpeed: (Math.PI * 2) / 150,  // gentle rotation
  strandThickness: 0.06,         // much thinner strands (was 0.18)
  rungWidth: 0.05,
  rungDepth: 0.10,
  waveformBars: 16,              // bars per rung waveform
  activeWaveformBars: 24,        // more bars for the active/visualizer rung
  particleCount: 120,            // tuned for Intel Iris Xe
  bloomStrength: 1.0,            // dialed back for sharpness (was 1.6)
  bloomRadius: 0.3,              // tighter bloom
  bloomThreshold: 0.25,          // higher threshold = less bloom bleed
  glowTubeRadius: 0.25,          // single subtle glow tube (was 0.55 + 0.85)
  nodeRadius: 0.10,              // smaller junction nodes (was strandThickness * 2)
};

// ── Module state ─────────────────────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, composer;
let helixGroup;

let songRungGroups = [];
let songRungHitMeshes = [];
let songRungGlows = [];
let songNodeSpheres = [];

let rungLabels = [];
let dataAnnotations = [];

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

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
  camera.position.set(0, 2, 9);
  camera.lookAt(0, 0, 0);

  const canvas = document.getElementById('helix-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
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

  // Post-processing — sharper bloom
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    CFG.bloomStrength,
    CFG.bloomRadius,
    CFG.bloomThreshold
  );
  composer.addPass(bloom);

  // Lighting — crisp and directional
  scene.add(new THREE.AmbientLight(0x081828, 2.0));

  const mainLight = new THREE.PointLight(0x00e5ff, 3.5, 50);
  mainLight.position.set(0, 5, 8);
  scene.add(mainLight);

  const backLight = new THREE.PointLight(0x005577, 1.5, 35);
  backLight.position.set(0, 0, -6);
  scene.add(backLight);

  const topLight = new THREE.PointLight(0x00ccff, 2.0, 30);
  topLight.position.set(0, 15, 4);
  scene.add(topLight);

  const bottomLight = new THREE.PointLight(0xff2200, 0.8, 25);
  bottomLight.position.set(0, -20, 3);
  scene.add(bottomLight);

  helixGroup = new THREE.Group();
  scene.add(helixGroup);

  buildHelixMeshes();

  // Start scrolled so active track (index 0 visually = top) is visible
  scrollTarget = _scrollForActiveTrack(appState.currentIndex);
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

// Rung Y position: current track at top (Y=0), queue descends into negative Y
function rungY(visualIdx) {
  return -visualIdx * CFG.rungSpacing;
}

// Convert queue index to visual index:
// Visual index 0 = current track (top), then subsequent tracks below
function queueToVisual(queueIdx) {
  const current = appState.currentIndex;
  const len = appState.queue.length;
  // Wrap around: current track is visual 0, next is visual 1, etc.
  return ((queueIdx - current) + len) % len;
}

// Convert visual index back to queue index
function visualToQueue(visualIdx) {
  const current = appState.currentIndex;
  const len = appState.queue.length;
  return (current + visualIdx) % len;
}

function _scrollForActiveTrack() {
  // Active track is always at visual index 0 (top), so scroll to show top
  return -2; // slight offset so active track isn't clipped at the very top
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

// ── Health-based color gradient ───────────────────────────────────────────────
function _getRungColors(health, isActive) {
  if (isActive) return { color: 0x00e5ff, emissive: 0x00bbdd, emissiveInt: 4.5 };
  if (health >= 10) return { color: 0xffd700, emissive: 0xcc9900, emissiveInt: 3.0 };
  if (health <= -10) return { color: 0xff0040, emissive: 0x880020, emissiveInt: 2.5 };
  if (health > 0) return { color: 0x00ccee, emissive: 0x006688, emissiveInt: 1.0 + health * 0.15 };
  if (health < 0) {
    const t = Math.min(1, Math.abs(health) / 10);
    const c = new THREE.Color(0x008899).lerp(new THREE.Color(0xff4400), t);
    const e = new THREE.Color(0x002233).lerp(new THREE.Color(0x661100), t);
    return { color: c.getHex(), emissive: e.getHex(), emissiveInt: 0.5 + t * 1.8 };
  }
  return { color: 0x00aacc, emissive: 0x004455, emissiveInt: 0.8 };
}

// ── Build helix ───────────────────────────────────────────────────────────────
function buildHelixMeshes() {
  const queue = appState.queue;
  const qLen = queue.length;

  // Precompute strand points for all song rungs (in visual order)
  strandPts1 = new Array(qLen);
  strandPts2 = new Array(qLen);
  for (let v = 0; v < qLen; v++) {
    strandPts1[v] = getStrandPoint1(v);
    strandPts2[v] = getStrandPoint2(v);
  }

  // ── STRANDS — thin, sharp tubes ──────────────────────────────────────
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

  // Main strand — thin and precise
  const strandMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ee,
    emissive: 0x006699,
    emissiveIntensity: 2.5,
    metalness: 0.8,
    roughness: 0.05,
    transparent: true,
    opacity: 0.9,
  });

  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness, 8, false), strandMat
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness, 8, false), strandMat.clone()
  ));

  // Single subtle glow tube (not the massive double-glow from before)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00aadd,
    transparent: true,
    opacity: 0.10,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve1, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 6, false), glowMat
  ));
  helixGroup.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve2, Math.floor(tubeSeg * 0.6), CFG.glowTubeRadius, 6, false), glowMat.clone()
  ));

  // ── SONG RUNGS — waveform bar clusters ─────────────────────────────
  songRungGroups = [];
  songRungHitMeshes = [];
  songRungGlows = [];
  songNodeSpheres = [];
  rungLabels = [];
  dataAnnotations = [];
  songWaveformBars = [];

  const barGeom = new THREE.BoxGeometry(1, 1, 1);

  for (let v = 0; v < qLen; v++) {
    const qIdx = visualToQueue(v);
    const song = queue[qIdx];
    const health = song.health || 0;
    const isActive = v === 0; // visual index 0 = current track = top rung
    const col = _getRungColors(health, isActive);

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

    const numBars = isActive ? CFG.activeWaveformBars : CFG.waveformBars;
    const barSpacing = length / (numBars + 1);
    const barWidth = barSpacing * 0.55;
    const barDepth = CFG.rungDepth;
    const bars = [];
    const baseHeights = [];

    const barMat = new THREE.MeshStandardMaterial({
      color: col.color,
      emissive: col.emissive,
      emissiveIntensity: col.emissiveInt,
      metalness: 0.6,
      roughness: 0.1,
    });

    // Front bars
    for (let b = 0; b < numBars; b++) {
      const barMesh = new THREE.Mesh(barGeom, barMat.clone());
      const localY = -length / 2 + barSpacing * (b + 1);
      const seed = v * 100 + b;
      const randH = isActive
        ? 0.1 + _seededRandom(seed) * 0.35
        : 0.05 + _seededRandom(seed) * 0.18;

      barMesh.scale.set(barWidth, barDepth, randH);
      barMesh.position.set(0, localY, randH / 2);

      rungGroup.add(barMesh);
      bars.push(barMesh);
      baseHeights.push(randH);
    }

    // Mirror bars (back side)
    for (let b = 0; b < numBars; b++) {
      const barMesh = new THREE.Mesh(barGeom, barMat.clone());
      const localY = -length / 2 + barSpacing * (b + 1);
      const seed = v * 100 + b + 50;
      const randH = isActive
        ? 0.1 + _seededRandom(seed) * 0.35
        : 0.05 + _seededRandom(seed) * 0.18;

      barMesh.scale.set(barWidth, barDepth, randH);
      barMesh.position.set(0, localY, -randH / 2);

      rungGroup.add(barMesh);
      bars.push(barMesh);
      baseHeights.push(randH);
    }

    rungGroup.userData = { songIndex: qIdx, songId: song.id, visualIndex: v };
    helixGroup.add(rungGroup);
    songRungGroups.push(rungGroup);
    songWaveformBars.push({ bars, baseHeights, numBars });

    // Invisible hit mesh
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = _createRungMesh(p1, p2, CFG.rungWidth * 3, hitMat);
    hitMesh.userData = { songIndex: qIdx, songId: song.id, visualIndex: v };
    helixGroup.add(hitMesh);
    songRungHitMeshes.push(hitMesh);

    // Glow overlay
    const glowColor = isActive ? 0x00e5ff : (health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00bbdd));
    const glowOpacity = isActive ? 0.30 : (health >= 10 ? 0.18 : 0.03);
    const rungGlowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: glowOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rungGlowMesh = _createRungMesh(p1, p2, CFG.rungWidth * 3.5, rungGlowMat);
    helixGroup.add(rungGlowMesh);
    songRungGlows.push(rungGlowMesh);

    // Node spheres — smaller, sharper
    const nodeGeom = new THREE.SphereGeometry(CFG.nodeRadius, 8, 8);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: col.color,
      emissive: col.emissive,
      emissiveIntensity: col.emissiveInt * 1.2,
      metalness: 0.6,
      roughness: 0.1,
    });
    const node1 = new THREE.Mesh(nodeGeom, nodeMat);
    node1.position.copy(p1);
    const node2 = new THREE.Mesh(nodeGeom, nodeMat.clone());
    node2.position.copy(p2);
    helixGroup.add(node1, node2);
    songNodeSpheres.push(node1, node2);

    // Label
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

    // Data annotations — only on active, immortal, rejected, or every 10th
    _createDataAnnotations(v, qIdx, song, health, isActive, mid, p1, p2);
  }

  // ── PARTICLE SYSTEM ────────────────────────────────────────────────────
  _buildParticleSystem();
}

// ── Data Annotations ──────────────────────────────────────────────────────────
function _createDataAnnotations(visualIdx, queueIdx, song, health, isActive, mid, p1, p2) {
  const offsetDir = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5).normalize();
  const rightOffset = offsetDir.multiplyScalar(2.8);

  const shouldAnnotate = isActive || health >= 10 || health <= -5 || visualIdx % 10 === 0;
  if (!shouldAnnotate) return;

  const annoEl = document.createElement('div');
  annoEl.className = 'helix-annotation';
  annoEl.style.cssText = `
    font-family: 'Courier New', monospace;
    font-size: 8px;
    color: ${health <= -5 ? '#ff4444' : '#00bbcc'};
    opacity: 0.6;
    white-space: nowrap;
    letter-spacing: 1px;
    text-shadow: 0 0 4px ${health <= -5 ? '#ff000066' : '#00ccff66'};
    pointer-events: none;
  `;

  let text = '';
  if (isActive) {
    text = `TRACK_${String(queueIdx + 1).padStart(2, '0')}: PULSE_ORIGIN`;
  } else if (health >= 10) {
    text = 'IMMORTAL_STATE: TRUE';
  } else if (health <= -10) {
    text = 'FRAGMENTED_DATA';
  } else if (health <= -5) {
    text = 'ERROR_DECAY_DETECTED';
  } else {
    text = `SEQ_${String(queueIdx).padStart(3, '0')}_ACTIVE`;
  }
  annoEl.textContent = text;

  const annoLabel = new CSS2DObject(annoEl);
  annoLabel.position.set(mid.x + rightOffset.x, mid.y, mid.z + rightOffset.z);
  helixGroup.add(annoLabel);
  dataAnnotations.push({ label: annoLabel, visualIdx, queueIdx, health, isActive });

  // Extra waveform data for active
  if (isActive) {
    const extraEl = document.createElement('div');
    extraEl.className = 'helix-annotation';
    extraEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 7px;
      color: #009aaa;
      opacity: 0.45;
      white-space: nowrap;
      letter-spacing: 1px;
      text-shadow: 0 0 3px #00ccff44;
      pointer-events: none;
    `;
    extraEl.textContent = 'WAVEFORM_DATA: 44.1kHz / 16-BIT / STEREO';
    const extraLabel = new CSS2DObject(extraEl);
    extraLabel.position.set(mid.x + rightOffset.x, mid.y - 0.2, mid.z + rightOffset.z);
    helixGroup.add(extraLabel);
    dataAnnotations.push({ label: extraLabel, visualIdx, queueIdx, health, isActive });

    // Audio analyzer label
    const analyzerEl = document.createElement('div');
    analyzerEl.className = 'helix-annotation';
    analyzerEl.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 7px;
      color: #00ddff;
      opacity: 0.5;
      white-space: nowrap;
      letter-spacing: 1.5px;
      text-shadow: 0 0 5px #00ccff66;
      pointer-events: none;
    `;
    analyzerEl.textContent = 'AUDIO ANALYZER';
    const analyzerLabel = new CSS2DObject(analyzerEl);
    analyzerLabel.position.set(mid.x + rightOffset.x, mid.y + 0.2, mid.z + rightOffset.z);
    helixGroup.add(analyzerLabel);
    dataAnnotations.push({ label: analyzerLabel, visualIdx, queueIdx, health, isActive });
  }
}

// ── Particle system ───────────────────────────────────────────────────────────
function _buildParticleSystem() {
  const count = CFG.particleCount;
  const qLen = appState.queue.length;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  particleVelocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const vIdx = Math.floor(Math.random() * qLen);
    const strand = Math.random() > 0.5 ? 1 : 2;
    const angle = vIdx * CFG.rotationPerUnit + (strand === 2 ? Math.PI : 0);
    const r = CFG.helixRadius + (Math.random() - 0.5) * 1.0;

    positions[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 1] = rungY(vIdx) + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.3;

    // Particles near active rung (top) are brighter
    const nearActive = vIdx < 5;
    if (nearActive) {
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 1.0;
      sizes[i] = 2.0 + Math.random() * 1.5;
    } else {
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 0.4;
      colors[i * 3 + 2] = 0.6;
      sizes[i] = 0.8 + Math.random() * 1.0;
    }

    particleVelocities[i * 3] = (Math.random() - 0.5) * 0.08;
    particleVelocities[i * 3 + 1] = -(0.01 + Math.random() * 0.05); // drift downward (queue direction)
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

// ── Mesh helpers ──────────────────────────────────────────────────────────────
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

  dataAnnotations.forEach(a => {
    if (a.label.element && a.label.element.parentNode) a.label.element.parentNode.removeChild(a.label.element);
  });
  dataAnnotations = [];

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
      // ── AUDIO VISUALIZER — animate waveform bars on active (top) rung ──
      const wb = songWaveformBars[v];
      for (let b = 0; b < wb.bars.length; b++) {
        const bar = wb.bars[b];
        const base = wb.baseHeights[b];
        const isMirror = b >= wb.numBars;
        const barIdx = isMirror ? b - wb.numBars : b;

        // Multi-frequency visualization: bass on edges, treble in center
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

      // Pulse emissive
      const emInt = 3.5 + pulseVal * 2.5;
      wb.bars.forEach(bar => {
        bar.material.emissiveIntensity = emInt;
      });
    }

    // Pulse active glow
    if (visible && isActive && songRungGlows[v]) {
      songRungGlows[v].material.opacity = 0.2 + pulseVal * 0.2;
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

  // Annotation visibility
  dataAnnotations.forEach(a => {
    const localY = rungY(a.visualIdx);
    const worldY = localY + yOffset;
    const visible = worldY > -12 && worldY < 18;
    a.label.element.style.display = visible ? 'block' : 'none';
  });

  // Animate particles
  if (particleSystem && particlePositions && particleVelocities) {
    const pCount = CFG.particleCount;
    const maxY = 2; // slightly above top rung
    const minY = rungY(qLen - 1) - 1;

    for (let i = 0; i < pCount; i++) {
      particlePositions[i * 3] += particleVelocities[i * 3] * delta;
      particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * delta;
      particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * delta;

      // Wrap
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
  // Full rebuild — current track changes visual ordering (it's now on top)
  clearHelixMeshes();
  buildHelixMeshes();

  // Scroll back to top to show the new active track
  scrollTarget = _scrollForActiveTrack();
}

function updateRungHealth(songId, health) {
  const queue = appState.queue;
  const queueIdx = queue.findIndex(s => s.id === songId);
  if (queueIdx === -1) return;

  // Find which visual index this corresponds to
  const visualIdx = queueToVisual(queueIdx);
  const isActive = visualIdx === 0;
  const col = _getRungColors(health, isActive);

  // Update bar materials
  if (songWaveformBars[visualIdx]) {
    songWaveformBars[visualIdx].bars.forEach(bar => {
      bar.material.color.setHex(col.color);
      bar.material.emissive.setHex(col.emissive);
      bar.material.emissiveIntensity = col.emissiveInt;
    });
  }

  if (songRungGlows[visualIdx]) {
    const gc = health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00bbdd);
    songRungGlows[visualIdx].material.color.setHex(gc);
    songRungGlows[visualIdx].material.opacity = health >= 10 ? 0.18 : (health <= -10 ? 0.15 : 0.03);
  }

  if (songNodeSpheres[visualIdx * 2]) {
    songNodeSpheres[visualIdx * 2].material.color.setHex(col.color);
    songNodeSpheres[visualIdx * 2].material.emissive.setHex(col.emissive);
  }
  if (songNodeSpheres[visualIdx * 2 + 1]) {
    songNodeSpheres[visualIdx * 2 + 1].material.color.setHex(col.color);
    songNodeSpheres[visualIdx * 2 + 1].material.emissive.setHex(col.emissive);
  }

  if (rungLabels[visualIdx]) {
    const el = rungLabels[visualIdx].element;
    el.className = 'helix-label' +
      (isActive ? ' active' : '') +
      (health >= 10 ? ' immortal' : '') +
      (health <= -10 ? ' rejected' : '');
  }
}
