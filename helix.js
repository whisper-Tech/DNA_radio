/**
 * DNA RADIO // THE SECRET
 * Three.js DNA Helix Scene — 1024 Rungs
 * Thick glowing strands, wide flat rungs, labels on song rungs
 * Reference: ADVANCEDdnaRadioDesign.jpg / dnaRadio_interface.jpg
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
  strandThickness: 0.10,
  rungWidth: 0.08,
  rungDepth: 0.14,
};

// ── Module state ─────────────────────────────────────────────────────────────
let scene, camera, renderer, labelRenderer, composer;
let helixGroup;
let songRungMeshes = [];
let songRungGlows = [];
let songNodeSpheres = [];
let emptyRungInstanced = null;
let emptyNodeInstanced = null;
let rungLabels = [];
let strandPts1 = [];
let strandPts2 = [];
let appState, onTrackSelectCb;
let rotationAngle = 0;
let scrollOffset = 0;
let scrollTarget = 0;
let lastTime = 0;
let animRAF;
let activeRungPulse = 0;

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.5, 0.6, 0.15);
  composer.addPass(bloom);

  scene.add(new THREE.AmbientLight(0x0a1a2a, 1.5));
  const mainLight = new THREE.PointLight(0x00e5ff, 3, 60);
  mainLight.position.set(0, camY, 10);
  scene.add(mainLight);
  const backLight = new THREE.PointLight(0x0088aa, 1.5, 40);
  backLight.position.set(0, camY, -8);
  scene.add(backLight);
  const topLight = new THREE.PointLight(0x00e5ff, 1, 35);
  topLight.position.set(0, camY + 15, 5);
  scene.add(topLight);
  const bottomLight = new THREE.PointLight(0x004466, 0.8, 25);
  bottomLight.position.set(0, camY - 15, 5);
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

function rungY(idx) { return idx * CFG.rungSpacing; }
function songRungIndex(songIdx) { return (CFG.totalRungs - appState.queue.length) + songIdx; }
function firstSongRung() { return CFG.totalRungs - appState.queue.length; }
function _songRegionY() { return 5; }
function _defaultScrollTarget() {
  const fsr = firstSongRung();
  return Math.max(0, fsr - Math.floor(CFG.visibleRungs / 3));
}

function getStrandPoint1(idx) {
  const angle = idx * CFG.rotationPerUnit;
  return new THREE.Vector3(Math.cos(angle) * CFG.helixRadius, rungY(idx), Math.sin(angle) * CFG.helixRadius);
}
function getStrandPoint2(idx) {
  const angle = idx * CFG.rotationPerUnit + Math.PI;
  return new THREE.Vector3(Math.cos(angle) * CFG.helixRadius, rungY(idx), Math.sin(angle) * CFG.helixRadius);
}

function buildHelixMeshes() {
  const queue = appState.queue;
  const qLen = queue.length;
  const N = CFG.totalRungs;
  const fsr = firstSongRung();

  strandPts1 = new Array(N);
  strandPts2 = new Array(N);
  for (let i = 0; i < N; i++) {
    strandPts1[i] = getStrandPoint1(i);
    strandPts2[i] = getStrandPoint2(i);
  }

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

  const strandMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff, emissive: 0x006688, emissiveIntensity: 2.5,
    metalness: 0.7, roughness: 0.1, transparent: true, opacity: 0.95,
  });
  helixGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness, 12, false), strandMat));
  helixGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness, 12, false), strandMat.clone()));

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00ccff, transparent: true, opacity: 0.15,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  helixGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve1, tubeSeg, CFG.strandThickness * 3, 12, false), glowMat));
  helixGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve2, tubeSeg, CFG.strandThickness * 3, 12, false), glowMat.clone()));

  songRungMeshes = []; songRungGlows = []; songNodeSpheres = []; rungLabels = [];
  const emptyCount = fsr;

  if (emptyCount > 0) {
    const emptyRungGeom = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    const emptyRungMat = new THREE.MeshStandardMaterial({
      color: 0x002838, emissive: 0x001118, emissiveIntensity: 0.3,
      metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.4,
    });
    emptyRungInstanced = new THREE.InstancedMesh(emptyRungGeom, emptyRungMat, emptyCount);
    emptyRungInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const emptyNodeGeom = new THREE.SphereGeometry(CFG.strandThickness * 1.6, 6, 6);
    const emptyNodeMat = new THREE.MeshStandardMaterial({
      color: 0x003344, emissive: 0x001122, emissiveIntensity: 0.3,
      metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.5,
    });
    emptyNodeInstanced = new THREE.InstancedMesh(emptyNodeGeom, emptyNodeMat, emptyCount * 2);
    emptyNodeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < emptyCount; i++) {
      const p1 = strandPts1[i]; const p2 = strandPts2[i];
      emptyRungInstanced.setMatrixAt(i, _rungMatrix(p1, p2, CFG.rungWidth * 0.6));
      const nodeQ = new THREE.Quaternion(); const nodeS = new THREE.Vector3(1, 1, 1);
      emptyNodeInstanced.setMatrixAt(i * 2, new THREE.Matrix4().compose(p1, nodeQ, nodeS));
      emptyNodeInstanced.setMatrixAt(i * 2 + 1, new THREE.Matrix4().compose(p2, nodeQ, nodeS));
    }
    emptyRungInstanced.instanceMatrix.needsUpdate = true;
    emptyNodeInstanced.instanceMatrix.needsUpdate = true;
    helixGroup.add(emptyRungInstanced); helixGroup.add(emptyNodeInstanced);
  }

  for (let s = 0; s < qLen; s++) {
    const ri = fsr + s; const p1 = strandPts1[ri]; const p2 = strandPts2[ri];
    const song = queue[s]; const health = song.health || 0;
    const isActive = s === appState.currentIndex;
    const col = _getRungColors(health, isActive);

    const rungMat = new THREE.MeshStandardMaterial({
      color: col.color, emissive: col.emissive, emissiveIntensity: col.emissiveInt,
      metalness: 0.5, roughness: 0.15,
    });
    const rungMesh = _createRungMesh(p1, p2, CFG.rungWidth, rungMat);
    rungMesh.userData = { songIndex: s, songId: song.id, rungIndex: ri };
    helixGroup.add(rungMesh); songRungMeshes.push(rungMesh);

    const glowColor = isActive ? 0x00e5ff : (health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff));
    const glowOpacity = isActive ? 0.35 : (health >= 10 ? 0.25 : 0.06);
    const rungGlowMat = new THREE.MeshBasicMaterial({
      color: glowColor, transparent: true, opacity: glowOpacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const rungGlowMesh = _createRungMesh(p1, p2, CFG.rungWidth * 3, rungGlowMat);
    helixGroup.add(rungGlowMesh); songRungGlows.push(rungGlowMesh);

    const nodeGeom = new THREE.SphereGeometry(CFG.strandThickness * 2, 10, 10);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: col.color, emissive: col.emissive, emissiveIntensity: col.emissiveInt * 1.3,
      metalness: 0.5, roughness: 0.15,
    });
    const node1 = new THREE.Mesh(nodeGeom, nodeMat); node1.position.copy(p1);
    const node2 = new THREE.Mesh(nodeGeom, nodeMat.clone()); node2.position.copy(p2);
    helixGroup.add(node1, node2); songNodeSpheres.push(node1, node2);

    const labelEl = document.createElement('div');
    labelEl.className = 'helix-label' + (isActive ? ' active' : '') + (health >= 10 ? ' immortal' : '') + (health <= -10 ? ' rejected' : '');
    labelEl.textContent = `${song.title}  ·  ${song.artist}`;
    const label = new CSS2DObject(labelEl);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    label.position.copy(mid); helixGroup.add(label); rungLabels.push(label);
  }
}

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
  songRungMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); songRungMeshes = [];
  songRungGlows.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); songRungGlows = [];
  songNodeSpheres.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); songNodeSpheres = [];
  if (emptyRungInstanced) { emptyRungInstanced.geometry.dispose(); emptyRungInstanced.material.dispose(); emptyRungInstanced = null; }
  if (emptyNodeInstanced) { emptyNodeInstanced.geometry.dispose(); emptyNodeInstanced.material.dispose(); emptyNodeInstanced = null; }
  rungLabels.forEach(l => { if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element); });
  rungLabels = [];
  helixGroup.clear(); strandPts1 = []; strandPts2 = [];
}

function _getRungColors(health, isActive) {
  if (isActive) return { color: 0x00e5ff, emissive: 0x00bbdd, emissiveInt: 5 };
  if (health >= 10) return { color: 0xffd700, emissive: 0xcc9900, emissiveInt: 3.5 };
  if (health <= -10) return { color: 0xff0040, emissive: 0x880020, emissiveInt: 3 };
  if (health > 0) return { color: 0x00ccee, emissive: 0x006688, emissiveInt: 1.2 + health * 0.2 };
  if (health < 0) return { color: 0x008899, emissive: 0x002233, emissiveInt: 0.6 };
  return { color: 0x00aacc, emissive: 0x004455, emissiveInt: 1.0 };
}

function loop(time) {
  animRAF = requestAnimationFrame(loop);
  const delta = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  rotationAngle += CFG.rotationSpeed * delta;
  activeRungPulse += delta * 3;
  scrollOffset += (scrollTarget - scrollOffset) * 0.08;
  const yOffset = -scrollOffset * CFG.rungSpacing;
  helixGroup.position.y = yOffset;
  helixGroup.rotation.y = rotationAngle;
  const pulseVal = 0.5 + 0.5 * Math.sin(activeRungPulse);
  const fsr = firstSongRung();
  songRungMeshes.forEach((mesh, s) => {
    const ri = fsr + s; const localY = rungY(ri); const worldY = localY + yOffset;
    const visible = worldY > -5 && worldY < 30;
    mesh.visible = visible;
    if (songRungGlows[s]) songRungGlows[s].visible = visible;
    const isActive = s === appState.currentIndex;
    if (visible && isActive) {
      mesh.material.emissiveIntensity = 4 + pulseVal * 3;
      if (songRungGlows[s]) songRungGlows[s].material.opacity = 0.25 + pulseVal * 0.2;
    }
    if (rungLabels[s]) rungLabels[s].element.style.display = visible ? 'block' : 'none';
  });
  songNodeSpheres.forEach((node, i) => {
    const s = Math.floor(i / 2); const ri = fsr + s;
    const localY = rungY(ri); const worldY = localY + yOffset;
    node.visible = worldY > -5 && worldY < 30;
  });
  composer.render(); labelRenderer.render(scene, camera);
}

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
  const hits = raycaster.intersectObjects(songRungMeshes);
  if (hits.length > 0) {
    const idx = hits[0].object.userData.songIndex;
    if (idx !== undefined && onTrackSelectCb) onTrackSelectCb(idx);
  }
}

function onResize() {
  const container = document.getElementById('helix-container');
  if (!container || !renderer) return;
  const w = container.clientWidth; const h = container.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); labelRenderer.setSize(w, h); composer.setSize(w, h);
}

function setCurrentTrack(index) {
  const queue = appState.queue; const fsr = firstSongRung();
  songRungMeshes.forEach((mesh, s) => {
    const song = queue[s]; const health = song ? (song.health || 0) : 0;
    const isActive = s === index; const col = _getRungColors(health, isActive);
    mesh.material.color.setHex(col.color);
    mesh.material.emissive.setHex(col.emissive);
    mesh.material.emissiveIntensity = col.emissiveInt;
    if (songRungGlows[s]) {
      const glowColor = isActive ? 0x00e5ff : (health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff));
      const glowOpacity = isActive ? 0.35 : (health >= 10 ? 0.25 : 0.06);
      songRungGlows[s].material.color.setHex(glowColor);
      songRungGlows[s].material.opacity = glowOpacity;
    }
    if (songNodeSpheres[s * 2]) { songNodeSpheres[s * 2].material.color.setHex(col.color); songNodeSpheres[s * 2].material.emissive.setHex(col.emissive); }
    if (songNodeSpheres[s * 2 + 1]) { songNodeSpheres[s * 2 + 1].material.color.setHex(col.color); songNodeSpheres[s * 2 + 1].material.emissive.setHex(col.emissive); }
    if (rungLabels[s]) {
      const el = rungLabels[s].element;
      el.className = 'helix-label' + (isActive ? ' active' : '') + (health >= 10 ? ' immortal' : '') + (health <= -10 ? ' rejected' : '');
    }
  });
  const activeRung = fsr + index; const midView = CFG.visibleRungs / 2;
  scrollTarget = Math.max(0, Math.min(activeRung - midView, CFG.totalRungs - CFG.visibleRungs));
}

function updateRungHealth(songId, health) {
  const queue = appState.queue;
  const songIdx = queue.findIndex(s => s.id === songId);
  if (songIdx === -1) return;
  const isActive = songIdx === appState.currentIndex;
  const col = _getRungColors(health, isActive);
  const mesh = songRungMeshes[songIdx];
  if (mesh) { mesh.material.color.setHex(col.color); mesh.material.emissive.setHex(col.emissive); mesh.material.emissiveIntensity = col.emissiveInt; }
  if (songRungGlows[songIdx]) {
    const glowColor = health >= 10 ? 0xffd700 : (health <= -10 ? 0xff0040 : 0x00ccff);
    songRungGlows[songIdx].material.color.setHex(glowColor);
    songRungGlows[songIdx].material.opacity = health >= 10 ? 0.25 : (health <= -10 ? 0.2 : 0.06);
  }
  if (songNodeSpheres[songIdx * 2]) { songNodeSpheres[songIdx * 2].material.color.setHex(col.color); songNodeSpheres[songIdx * 2].material.emissive.setHex(col.emissive); }
  if (songNodeSpheres[songIdx * 2 + 1]) { songNodeSpheres[songIdx * 2 + 1].material.color.setHex(col.color); songNodeSpheres[songIdx * 2 + 1].material.emissive.setHex(col.emissive); }
  if (rungLabels[songIdx]) {
    const el = rungLabels[songIdx].element;
    el.className = 'helix-label' + (isActive ? ' active' : '') + (health >= 10 ? ' immortal' : '') + (health <= -10 ? ' rejected' : '');
  }
}
