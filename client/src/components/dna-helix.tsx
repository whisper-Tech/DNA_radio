import { useRef, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Line, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Song } from "@/types";

// ---------- Constants ----------
const HELIX_RADIUS = 1.8;
const HELIX_TURNS_PER_100 = 8;
const RUNG_SPACING = 0.4;
const VISIBLE_RUNGS = 34;
const TEXT_RENDER_LIMIT = 20;
const BACKBONE_POINTS_PER_RUNG = 4;
const BACKBONE_OPACITY = 0.1;
const BACKBONE_LINE_WIDTH = 0.5;
const RUNG_RADIUS = 0.006;
const RUNG_SEGMENTS = 6;
const RUNG_OPACITY_DEFAULT = 0.3;
const RUNG_OPACITY_PLAYING = 1.0;
const ROTATION_PERIOD = 120;
const SCROLL_SPEED = 0.03;

// Shared geometry and materials created once
const rungGeometry = new THREE.CylinderGeometry(RUNG_RADIUS, RUNG_RADIUS, 1, RUNG_SEGMENTS);
const rungMaterialDefault = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#00e5ff"),
  emissive: new THREE.Color("#00e5ff"),
  emissiveIntensity: 0.3,
  transparent: true,
  opacity: RUNG_OPACITY_DEFAULT,
});

interface DNAHelixProps {
  songs: Song[];
}

// ---------- Helpers ----------

/** Compute helix angle for a given rung index */
function rungAngle(index: number, totalSongs: number): number {
  const t = totalSongs <= 1 ? 0.5 : index / (totalSongs - 1);
  return t * HELIX_TURNS_PER_100 * Math.PI * 2;
}

/** Compute Y position for a given rung index relative to scrollOffset */
function rungY(index: number, scrollOffset: number): number {
  return index * RUNG_SPACING - scrollOffset;
}

/** Get two strand positions for a rung at a given angle and y */
function strandPositions(angle: number, y: number): [THREE.Vector3, THREE.Vector3] {
  const p1 = new THREE.Vector3(
    Math.cos(angle) * HELIX_RADIUS,
    y,
    Math.sin(angle) * HELIX_RADIUS
  );
  const p2 = new THREE.Vector3(
    Math.cos(angle + Math.PI) * HELIX_RADIUS,
    y,
    Math.sin(angle + Math.PI) * HELIX_RADIUS
  );
  return [p1, p2];
}

// ---------- Components ----------

/** Instanced rung bars -- one draw call for all visible rungs */
function RungInstances({
  visibleIndices,
  totalSongs,
  scrollOffset,
  playingIndex,
}: {
  visibleIndices: number[];
  totalSongs: number;
  scrollOffset: number;
  playingIndex: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const playingMaterialRef = useRef<THREE.MeshStandardMaterial>(null!);

  // We render the playing rung separately for a brighter material
  const nonPlayingIndices = useMemo(
    () => visibleIndices.filter((i) => i !== playingIndex),
    [visibleIndices, playingIndex]
  );

  useFrame(() => {
    if (!meshRef.current) return;

    nonPlayingIndices.forEach((rungIdx, instanceIdx) => {
      const angle = rungAngle(rungIdx, totalSongs);
      const y = rungY(rungIdx, scrollOffset);
      const [p1, p2] = strandPositions(angle, y);

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();

      dummy.position.copy(mid);
      dummy.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize()
      );
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(instanceIdx, dummy.matrix);
    });
    meshRef.current.count = nonPlayingIndices.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Separate mesh for the playing rung with bright material
  const playingRungData = useMemo(() => {
    if (playingIndex < 0) return null;
    return { index: playingIndex };
  }, [playingIndex]);

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[rungGeometry, rungMaterialDefault, VISIBLE_RUNGS]}
        frustumCulled={false}
      />
      {playingRungData && (
        <PlayingRung
          rungIndex={playingRungData.index}
          totalSongs={totalSongs}
          scrollOffset={scrollOffset}
          materialRef={playingMaterialRef}
        />
      )}
    </>
  );
}

/** The currently-playing rung rendered as a single bright mesh */
function PlayingRung({
  rungIndex,
  totalSongs,
  scrollOffset,
  materialRef,
}: {
  rungIndex: number;
  totalSongs: number;
  scrollOffset: number;
  materialRef: React.MutableRefObject<THREE.MeshStandardMaterial>;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const pulseRef = useRef(0);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    const angle = rungAngle(rungIndex, totalSongs);
    const y = rungY(rungIndex, scrollOffset);
    const [p1, p2] = strandPositions(angle, y);

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();

    meshRef.current.position.copy(mid);
    meshRef.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize()
    );
    meshRef.current.scale.set(1.5, len, 1.5);

    // Gentle pulse on emissive
    pulseRef.current += delta * 2;
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 1.5 + Math.sin(pulseRef.current) * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} geometry={rungGeometry} frustumCulled={false}>
      <meshStandardMaterial
        ref={materialRef}
        color="#00ffcc"
        emissive="#00ffcc"
        emissiveIntensity={2}
        transparent
        opacity={RUNG_OPACITY_PLAYING}
      />
    </mesh>
  );
}

/** Billboard text labels for the nearest visible rungs */
function RungLabels({
  visibleIndices,
  songs,
  totalSongs,
  scrollOffset,
  cameraY,
}: {
  visibleIndices: number[];
  songs: Song[];
  totalSongs: number;
  scrollOffset: number;
  cameraY: number;
}) {
  // Sort by distance to camera, take the nearest TEXT_RENDER_LIMIT
  const labelData = useMemo(() => {
    const items = visibleIndices
      .filter((i) => i >= 0 && i < songs.length)
      .map((rungIdx) => {
        const y = rungY(rungIdx, scrollOffset);
        const dist = Math.abs(y - cameraY);
        return { rungIdx, y, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, TEXT_RENDER_LIMIT);
    return items;
  }, [visibleIndices, songs.length, scrollOffset, cameraY]);

  return (
    <>
      {labelData.map(({ rungIdx, y, dist }) => {
        const song = songs[rungIdx];
        if (!song) return null;

        const angle = rungAngle(rungIdx, totalSongs);
        const [p1, p2] = strandPositions(angle, y);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Scale text size based on distance: closer = larger
        const sizeFactor = Math.max(0.6, 1 - dist * 0.04);
        const titleSize = 0.2 * sizeFactor;
        const artistSize = 0.14 * sizeFactor;
        const opacity = Math.max(0.3, 1 - dist * 0.06);
        const isPlaying = song.isPlaying;

        return (
          <Billboard
            key={`label-${rungIdx}`}
            position={mid}
            follow
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <group position={[0, 0.15, 0]}>
              <Text
                fontSize={titleSize}
                color={isPlaying ? "#00ffcc" : "white"}
                anchorX="center"
                anchorY="bottom"
                outlineWidth={0.025}
                outlineColor="black"
                fillOpacity={opacity}
                maxWidth={3.2}
              >
                {song.title}
              </Text>
              <Text
                position={[0, -0.06, 0]}
                fontSize={artistSize}
                color="#00e5ff"
                anchorX="center"
                anchorY="top"
                outlineWidth={0.015}
                outlineColor="black"
                fillOpacity={opacity * 0.85}
                maxWidth={3.2}
              >
                {song.artist}
              </Text>
            </group>
          </Billboard>
        );
      })}
    </>
  );
}

/** Backbone strands rendered as lines for the visible window */
function BackboneStrands({
  visibleIndices,
  totalSongs,
  scrollOffset,
}: {
  visibleIndices: number[];
  totalSongs: number;
  scrollOffset: number;
}) {
  const { strand1Points, strand2Points } = useMemo(() => {
    if (visibleIndices.length < 2) return { strand1Points: [], strand2Points: [] };

    const minIdx = visibleIndices[0];
    const maxIdx = visibleIndices[visibleIndices.length - 1];
    const s1: THREE.Vector3[] = [];
    const s2: THREE.Vector3[] = [];

    // Add extra points between rungs for smooth curves
    const stepsPerRung = BACKBONE_POINTS_PER_RUNG;
    const totalSteps = (maxIdx - minIdx) * stepsPerRung;

    for (let step = 0; step <= totalSteps; step++) {
      const rungFloat = minIdx + step / stepsPerRung;
      const angle = rungAngle(rungFloat, totalSongs);
      const y = rungY(rungFloat, scrollOffset);
      s1.push(
        new THREE.Vector3(
          Math.cos(angle) * HELIX_RADIUS,
          y,
          Math.sin(angle) * HELIX_RADIUS
        )
      );
      s2.push(
        new THREE.Vector3(
          Math.cos(angle + Math.PI) * HELIX_RADIUS,
          y,
          Math.sin(angle + Math.PI) * HELIX_RADIUS
        )
      );
    }

    return { strand1Points: s1, strand2Points: s2 };
  }, [visibleIndices, totalSongs, scrollOffset]);

  if (strand1Points.length < 2) return null;

  return (
    <>
      <Line
        points={strand1Points}
        color="#00e5ff"
        lineWidth={BACKBONE_LINE_WIDTH}
        transparent
        opacity={BACKBONE_OPACITY}
      />
      <Line
        points={strand2Points}
        color="#00e5ff"
        lineWidth={BACKBONE_LINE_WIDTH}
        transparent
        opacity={BACKBONE_OPACITY}
      />
    </>
  );
}

/** Main helix scene -- manages rotation, scroll offset, and visible window */
function HelixScene({ songs }: { songs: Song[] }) {
  const groupRef = useRef<THREE.Group>(null!);
  const scrollOffsetRef = useRef(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const frameCounter = useRef(0);
  const { camera } = useThree();

  const totalSongs = songs.length;
  const playingIndex = useMemo(
    () => songs.findIndex((s) => s.isPlaying),
    [songs]
  );

  // Compute visible rung window
  const visibleIndices = useMemo(() => {
    // Center the visible window around the top of the helix (scrollOffset area)
    const centerRung = Math.floor(scrollOffsetRef.current / RUNG_SPACING);
    const halfWindow = Math.floor(VISIBLE_RUNGS / 2);
    const start = Math.max(0, centerRung - halfWindow);
    const end = Math.min(totalSongs - 1, centerRung + halfWindow);

    const indices: number[] = [];
    for (let i = start; i <= end; i++) {
      indices.push(i);
    }
    return indices;
  }, [totalSongs, scrollOffset]);

  const cameraY = camera.position.y;

  useFrame((_state, delta) => {
    if (!groupRef.current) return;

    // Slow rotation
    groupRef.current.rotation.y += ((Math.PI * 2) / ROTATION_PERIOD) * delta;

    // Slow scroll to simulate advancing queue
    scrollOffsetRef.current += SCROLL_SPEED * delta;

    // Wrap scroll when we've passed the full queue
    const maxScroll = (totalSongs - 1) * RUNG_SPACING;
    if (maxScroll > 0 && scrollOffsetRef.current > maxScroll) {
      scrollOffsetRef.current = 0;
    }

    // Update state at a reduced rate (every 3 frames) to avoid excessive re-renders
    frameCounter.current++;
    if (frameCounter.current % 3 === 0) {
      setScrollOffset(scrollOffsetRef.current);
    }
  });

  return (
    <group ref={groupRef}>
      <BackboneStrands
        visibleIndices={visibleIndices}
        totalSongs={totalSongs}
        scrollOffset={scrollOffsetRef.current}
      />
      <RungInstances
        visibleIndices={visibleIndices}
        totalSongs={totalSongs}
        scrollOffset={scrollOffsetRef.current}
        playingIndex={playingIndex}
      />
      <RungLabels
        visibleIndices={visibleIndices}
        songs={songs}
        totalSongs={totalSongs}
        scrollOffset={scrollOffsetRef.current}
        cameraY={cameraY}
      />
    </group>
  );
}

/** Subtle background grid */
function CircuitBackground() {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const size = 30;
    const step = 2;

    for (let x = -size; x <= size; x += step) {
      result.push([
        new THREE.Vector3(x, -size, -8),
        new THREE.Vector3(x, size, -8),
      ]);
    }
    for (let y = -size; y <= size; y += step) {
      result.push([
        new THREE.Vector3(-size, y, -8),
        new THREE.Vector3(size, y, -8),
      ]);
    }

    return result;
  }, []);

  return (
    <group>
      {lines.map((pts, i) => (
        <Line
          key={`circuit-${i}`}
          points={pts}
          color="#00e5ff"
          lineWidth={0.5}
          transparent
          opacity={0.04}
        />
      ))}
    </group>
  );
}

// ---------- Main Export ----------

export function DNAHelix({ songs }: DNAHelixProps) {
  // Memoize the camera position to avoid re-creating it
  const cameraPosition = useMemo(
    (): [number, number, number] => [0, 2, 10],
    []
  );

  const glConfig = useMemo(
    () => ({
      alpha: false,
      antialias: true,
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
    <div data-testid="canvas-dna-helix" className="w-full h-full bg-black">
      <Canvas
        gl={glConfig}
        camera={{ position: cameraPosition, fov: 50 }}
        onCreated={handleCreated}
        frameloop="always"
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -5, 5]} intensity={0.3} color="#00e5ff" />
        <HelixScene songs={songs} />
        <CircuitBackground />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
