import { useRef, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Billboard, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Song } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const HELIX_RADIUS = 2.0;
const VERTICAL_SPACING = 0.45;
const TURNS_PER_RUNG = 0.08;
const VISIBLE_WINDOW = 30;
const LABEL_LIMIT = 16;
const RUNG_RADIUS = 0.012;
const RUNG_SEGMENTS = 6;
const BACKBONE_OPACITY = 0.12;
const ROTATION_SPEED = (Math.PI * 2) / 120;
const SCROLL_SPEED = 0.04;

/* Shared geometry */
const sharedRungGeo = new THREE.CylinderGeometry(
  RUNG_RADIUS, RUNG_RADIUS, 1, RUNG_SEGMENTS
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function angleForRung(i: number): number {
  return i * TURNS_PER_RUNG * Math.PI * 2;
}

function yForRung(i: number, scroll: number): number {
  return i * VERTICAL_SPACING - scroll;
}

/* Reusable vectors for the hot loop (imperative only -- never read concurrently) */
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function strandXYZ(angle: number, y: number, offset: number, out: THREE.Vector3) {
  out.set(
    Math.cos(angle + offset) * HELIX_RADIUS,
    y,
    Math.sin(angle + offset) * HELIX_RADIUS
  );
}

/* ------------------------------------------------------------------ */
/*  HelixScene -- orchestrates animation + child components            */
/* ------------------------------------------------------------------ */
function HelixScene({ songs }: { songs: Song[] }) {
  const groupRef = useRef<THREE.Group>(null!);
  const scrollRef = useRef(0);
  const frameCount = useRef(0);

  // tick is bumped every N frames to trigger React re-render for labels/backbone
  const [, setTick] = useState(0);

  const total = songs.length;
  const playingIdx = useMemo(() => songs.findIndex((s) => s.isPlaying), [songs]);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += ROTATION_SPEED * delta;
    scrollRef.current += SCROLL_SPEED * delta;

    const maxScroll = Math.max(1, (total - 1) * VERTICAL_SPACING);
    if (scrollRef.current > maxScroll) scrollRef.current = 0;

    frameCount.current++;
    if (frameCount.current % 6 === 0) {
      setTick((t) => t + 1);
    }
  });

  // Snapshot scroll for the React render pass (labels/backbone)
  const scroll = scrollRef.current;
  const centerRung = Math.round(scroll / VERTICAL_SPACING);
  const halfWin = Math.floor(VISIBLE_WINDOW / 2);
  const startIdx = Math.max(0, centerRung - halfWin);
  const endIdx = Math.min(total - 1, centerRung + halfWin);

  const visibleIndices: number[] = [];
  for (let i = startIdx; i <= endIdx; i++) visibleIndices.push(i);

  return (
    <group ref={groupRef}>
      <BackboneStrands indices={visibleIndices} scroll={scroll} />
      <Rungs
        indices={visibleIndices}
        scrollRef={scrollRef}
        playingIdx={playingIdx}
      />
      <Labels
        indices={visibleIndices}
        songs={songs}
        scroll={scroll}
        playingIdx={playingIdx}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Backbone strands -- imperative THREE.Line with stable identity     */
/* ------------------------------------------------------------------ */
const backboneMat = new THREE.LineBasicMaterial({
  color: new THREE.Color("#00e5ff"),
  transparent: true,
  opacity: BACKBONE_OPACITY,
});

function BackboneStrands({
  indices,
  scroll,
}: {
  indices: number[];
  scroll: number;
}) {
  // Create stable Line objects once
  const [line1] = useState(
    () => new THREE.Line(new THREE.BufferGeometry(), backboneMat)
  );
  const [line2] = useState(
    () => new THREE.Line(new THREE.BufferGeometry(), backboneMat)
  );

  // Update geometry whenever indices/scroll change
  useMemo(() => {
    if (indices.length < 2) {
      line1.visible = false;
      line2.visible = false;
      return;
    }
    line1.visible = true;
    line2.visible = true;

    const minI = indices[0];
    const maxI = indices[indices.length - 1];
    const subdivs = 4;
    const steps = (maxI - minI) * subdivs + 1;
    if (steps < 2) return;

    const arr1 = new Float32Array(steps * 3);
    const arr2 = new Float32Array(steps * 3);

    for (let s = 0; s < steps; s++) {
      const rungF = minI + (s / (steps - 1)) * (maxI - minI);
      const angle = angleForRung(rungF);
      const y = yForRung(rungF, scroll);
      const j = s * 3;

      arr1[j] = Math.cos(angle) * HELIX_RADIUS;
      arr1[j + 1] = y;
      arr1[j + 2] = Math.sin(angle) * HELIX_RADIUS;

      arr2[j] = Math.cos(angle + Math.PI) * HELIX_RADIUS;
      arr2[j + 1] = y;
      arr2[j + 2] = Math.sin(angle + Math.PI) * HELIX_RADIUS;
    }

    line1.geometry.dispose();
    line1.geometry = new THREE.BufferGeometry();
    line1.geometry.setAttribute("position", new THREE.BufferAttribute(arr1, 3));

    line2.geometry.dispose();
    line2.geometry = new THREE.BufferGeometry();
    line2.geometry.setAttribute("position", new THREE.BufferAttribute(arr2, 3));
  }, [indices, scroll, line1, line2]);

  return (
    <>
      <primitive object={line1} />
      <primitive object={line2} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Rung bars (instanced mesh -- one draw call)                        */
/* ------------------------------------------------------------------ */
function Rungs({
  indices,
  scrollRef,
  playingIdx,
}: {
  indices: number[];
  scrollRef: React.MutableRefObject<number>;
  playingIdx: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const playingMeshRef = useRef<THREE.Mesh>(null!);
  const playingMatRef = useRef<THREE.MeshStandardMaterial>(null!);
  const pulseRef = useRef(0);

  // Store indices in a ref so useFrame always has latest
  const indicesRef = useRef(indices);
  indicesRef.current = indices;

  useFrame((_s, delta) => {
    const scroll = scrollRef.current;
    const vis = indicesRef.current;

    if (meshRef.current) {
      let inst = 0;
      for (const rungIdx of vis) {
        if (rungIdx === playingIdx) continue;
        const angle = angleForRung(rungIdx);
        const y = yForRung(rungIdx, scroll);

        strandXYZ(angle, y, 0, _v1);
        strandXYZ(angle, y, Math.PI, _v2);
        _mid.addVectors(_v1, _v2).multiplyScalar(0.5);
        _dir.subVectors(_v2, _v1);
        const len = _dir.length();

        dummy.position.copy(_mid);
        dummy.quaternion.setFromUnitVectors(_up, _dir.normalize());
        dummy.scale.set(1, len, 1);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(inst, dummy.matrix);
        inst++;
      }
      meshRef.current.count = inst;
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    // Playing rung
    if (playingMeshRef.current && playingIdx >= 0) {
      const angle = angleForRung(playingIdx);
      const y = yForRung(playingIdx, scroll);
      strandXYZ(angle, y, 0, _v1);
      strandXYZ(angle, y, Math.PI, _v2);
      _mid.addVectors(_v1, _v2).multiplyScalar(0.5);
      _dir.subVectors(_v2, _v1);
      const len = _dir.length();

      playingMeshRef.current.position.copy(_mid);
      playingMeshRef.current.quaternion.setFromUnitVectors(_up, _dir.normalize());
      playingMeshRef.current.scale.set(2, len, 2);

      pulseRef.current += delta * 2;
      if (playingMatRef.current) {
        playingMatRef.current.emissiveIntensity =
          1.5 + Math.sin(pulseRef.current) * 0.5;
      }
    }
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[sharedRungGeo, undefined, VISIBLE_WINDOW + 1]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#00e5ff"
          emissive="#00e5ff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.3}
        />
      </instancedMesh>
      <mesh ref={playingMeshRef} geometry={sharedRungGeo} frustumCulled={false}>
        <meshStandardMaterial
          ref={playingMatRef}
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={2}
          transparent
          opacity={1}
        />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Text labels (Billboard + troika Text)                              */
/* ------------------------------------------------------------------ */
function Labels({
  indices,
  songs,
  scroll,
  playingIdx,
}: {
  indices: number[];
  songs: Song[];
  scroll: number;
  playingIdx: number;
}) {
  const labelData = useMemo(() => {
    return indices
      .filter((i) => i >= 0 && i < songs.length)
      .map((i) => {
        const y = yForRung(i, scroll);
        return { i, y, dist: Math.abs(y) };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, LABEL_LIMIT);
  }, [indices, songs.length, scroll]);

  return (
    <>
      {labelData.map(({ i, y, dist }) => {
        const song = songs[i];
        if (!song) return null;

        const angle = angleForRung(i);
        // Midpoint between the two strands (always at origin x=0, z=0 for a full helix)
        // but we offset slightly so labels sit near one strand
        const labelAngle = angle + Math.PI * 0.5; // 90 deg offset from strand
        const mx = Math.cos(labelAngle) * (HELIX_RADIUS * 0.3);
        const mz = Math.sin(labelAngle) * (HELIX_RADIUS * 0.3);

        const scale = Math.max(0.5, 1 - dist * 0.05);
        const opacity = Math.max(0.2, 1 - dist * 0.07);
        const isPlaying = i === playingIdx;

        return (
          <Billboard
            key={`lbl-${i}`}
            position={[mx, y + 0.12, mz]}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.22 * scale}
              color={isPlaying ? "#00ffcc" : "#ffffff"}
              anchorX="center"
              anchorY="bottom"
              outlineWidth={0.02}
              outlineColor="#000000"
              fillOpacity={opacity}
              maxWidth={3.5}
            >
              {song.title}
            </Text>
            <Text
              position={[0, -0.06, 0]}
              fontSize={0.15 * scale}
              color="#00e5ff"
              anchorX="center"
              anchorY="top"
              outlineWidth={0.012}
              outlineColor="#000000"
              fillOpacity={opacity * 0.8}
              maxWidth={3.5}
            >
              {song.artist}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Background grid                                                    */
/* ------------------------------------------------------------------ */
function BackgroundGrid() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    const size = 30;
    const step = 2;
    for (let x = -size; x <= size; x += step) {
      pts.push(x, -size, -8, x, size, -8);
    }
    for (let y = -size; y <= size; y += step) {
      pts.push(-size, y, -8, size, y, -8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#00e5ff" transparent opacity={0.03} />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */
interface DNAHelixProps {
  songs: Song[];
}

export function DNAHelix({ songs }: DNAHelixProps) {
  console.log("[v0] DNAHelix rendered with", songs.length, "songs");
  const glConfig = useMemo(
    () => ({
      alpha: false,
      antialias: false,
      powerPreference: "high-performance" as const,
    }),
    []
  );

  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      gl.setClearColor("#000000");
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    },
    []
  );

  return (
    <div className="w-full h-full bg-black">
      <Canvas
        gl={glConfig}
        camera={{ position: [0, 2, 10], fov: 50 }}
        onCreated={handleCreated}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -5, 5]} intensity={0.3} color="#00e5ff" />

        <HelixScene songs={songs} />
        <BackgroundGrid />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          maxPolarAngle={Math.PI * 0.75}
          minPolarAngle={Math.PI * 0.25}
        />

        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.35}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
