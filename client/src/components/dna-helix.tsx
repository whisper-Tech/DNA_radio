import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Line, Billboard } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Song } from "@/types";

interface DNAHelixProps {
  songs: Song[];
}

function HelixStrands({ songs }: { songs: Song[] }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    // Very slow rotation: 120 seconds for full rotation
    groupRef.current.rotation.y += (Math.PI * 2) / 120 * delta;
  });

  const { strand1Points, strand2Points } = useMemo(() => {
    const height = 40; // Increased height for 100 rungs
    const radius = 1.8;
    const turns = 8;
    const pointCount = 300;
    const s1: THREE.Vector3[] = [];
    const s2: THREE.Vector3[] = [];

    for (let i = 0; i < pointCount; i++) {
      const t = i / (pointCount - 1);
      const y = t * height - height / 2;
      const angle = t * turns * Math.PI * 2;
      s1.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
      s2.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius));
    }

    return { strand1Points: s1, strand2Points: s2 };
  }, []);

  const rungs = useMemo(() => {
    if (songs.length === 0) return [];
    const height = 40;
    const radius = 1.8;
    const turns = 8;

    return songs.map((song, index) => {
      const t = songs.length === 1 ? 0.5 : index / (songs.length - 1);
      const y = t * height - height / 2;
      const angle = t * turns * Math.PI * 2;
      const p1 = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const p2 = new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const isTop = index === 0;
      return { song, p1, p2, mid, y, isTop };
    });
  }, [songs]);

  return (
    <group ref={groupRef}>
      <Line
        points={strand1Points}
        color="#00e5ff"
        lineWidth={1}
        transparent
        opacity={0.2}
      />
      <Line
        points={strand2Points}
        color="#00e5ff"
        lineWidth={1}
        transparent
        opacity={0.2}
      />

      {rungs.map((rung, i) => {
        const dir = new THREE.Vector3().subVectors(rung.p2, rung.p1);
        const len = dir.length();
        const midPoint = rung.mid;

        return (
          <group key={`rung-${i}`} position={midPoint}>
            <mesh rotation={new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              dir.clone().normalize()
            ))}>
              <cylinderGeometry args={[0.015, 0.015, len, 8]} />
              <meshStandardMaterial
                color="#00e5ff"
                emissive="#00e5ff"
                emissiveIntensity={rung.isTop ? 2 : 0.4}
                transparent
                opacity={0.5}
              />
            </mesh>
            <Billboard>
              <group position={[2.5, 0, 0]}>
                <Text
                  fontSize={0.18}
                  color="white"
                  anchorX="left"
                  anchorY="bottom"
                  outlineWidth={0.02}
                  outlineColor="black"
                >
                  {rung.song.title}
                </Text>
                <Text
                  position={[0, -0.2, 0]}
                  fontSize={0.14}
                  color="#00e5ff"
                  anchorX="left"
                  anchorY="top"
                  outlineWidth={0.01}
                  outlineColor="black"
                >
                  {rung.song.artist}
                </Text>
              </group>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function CircuitBackground() {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const size = 30;
    const step = 2;

    for (let x = -size; x <= size; x += step) {
      result.push([new THREE.Vector3(x, -size, -8), new THREE.Vector3(x, size, -8)]);
    }
    for (let y = -size; y <= size; y += step) {
      result.push([new THREE.Vector3(-size, y, -8), new THREE.Vector3(size, y, -8)]);
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
          opacity={0.05}
        />
      ))}
    </group>
  );
}

export function DNAHelix({ songs }: DNAHelixProps) {
  return (
    <div data-testid="canvas-dna-helix" className="w-full h-full bg-black">
      <Canvas
        gl={{ alpha: false, antialias: true }}
        camera={{ position: [0, 15, 12], fov: 45 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000");
        }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <HelixStrands songs={songs} />
        <CircuitBackground />
        <EffectComposer>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
