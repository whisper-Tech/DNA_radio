import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Song } from "@/types";

interface DNAHelixProps {
  songs: Song[];
}

function HelixStrands({ songs }: { songs: Song[] }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    groupRef.current.rotation.y += (Math.PI * 2) / 10 * delta;
  });

  const { strand1Points, strand2Points, spheres1, spheres2 } = useMemo(() => {
    const height = 8;
    const radius = 1.5;
    const turns = 2.5;
    const pointCount = 120;
    const s1: THREE.Vector3[] = [];
    const s2: THREE.Vector3[] = [];

    for (let i = 0; i < pointCount; i++) {
      const t = i / (pointCount - 1);
      const y = t * height - height / 2;
      const angle = t * turns * Math.PI * 2;
      s1.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
      s2.push(new THREE.Vector3(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius));
    }

    return { strand1Points: s1, strand2Points: s2, spheres1: s1, spheres2: s2 };
  }, []);

  const rungs = useMemo(() => {
    if (songs.length === 0) return [];
    const height = 8;
    const radius = 1.5;
    const turns = 2.5;

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
      {spheres1.map((pos, i) => (
        <mesh key={`s1-${i}`} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {spheres2.map((pos, i) => (
        <mesh key={`s2-${i}`} position={pos}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.5} />
        </mesh>
      ))}

      <Line
        points={strand1Points}
        color="#00e5ff"
        lineWidth={2}
      />
      <Line
        points={strand2Points}
        color="#00e5ff"
        lineWidth={2}
      />

      {rungs.map((rung, i) => {
        const dir = new THREE.Vector3().subVectors(rung.p2, rung.p1);
        const len = dir.length();
        const midPoint = rung.mid;

        return (
          <group key={`rung-${i}`}>
            <mesh position={midPoint} quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              dir.clone().normalize()
            )}>
              <cylinderGeometry args={[0.03, 0.03, len, 8]} />
              <meshStandardMaterial
                color="#00e5ff"
                emissive="#00e5ff"
                emissiveIntensity={rung.isTop ? 1.5 : 0.3}
                transparent
                opacity={0.7}
              />
            </mesh>
            <Text
              position={[midPoint.x + 2.2, midPoint.y + 0.1, midPoint.z]}
              fontSize={0.15}
              color="white"
              anchorX="left"
              anchorY="middle"
            >
              {rung.song.title}
            </Text>
            <Text
              position={[midPoint.x + 2.2, midPoint.y - 0.1, midPoint.z]}
              fontSize={0.12}
              color="white"
              anchorX="left"
              anchorY="middle"
            >
              {rung.song.artist}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function CircuitBackground() {
  const lines = useMemo(() => {
    const result: THREE.Vector3[][] = [];
    const size = 12;
    const step = 1.5;

    for (let x = -size; x <= size; x += step) {
      result.push([
        new THREE.Vector3(x, -size, -5),
        new THREE.Vector3(x, size, -5),
      ]);
    }
    for (let y = -size; y <= size; y += step) {
      result.push([
        new THREE.Vector3(-size, y, -5),
        new THREE.Vector3(size, y, -5),
      ]);
    }

    for (let i = 0; i < 20; i++) {
      const sx = (Math.random() - 0.5) * size * 2;
      const sy = (Math.random() - 0.5) * size * 2;
      const horizontal = Math.random() > 0.5;
      const len = 1 + Math.random() * 3;
      if (horizontal) {
        result.push([
          new THREE.Vector3(sx, sy, -5),
          new THREE.Vector3(sx + len, sy, -5),
        ]);
      } else {
        result.push([
          new THREE.Vector3(sx, sy, -5),
          new THREE.Vector3(sx, sy + len, -5),
        ]);
      }
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
          opacity={0.07}
        />
      ))}
    </group>
  );
}

export function DNAHelix({ songs }: DNAHelixProps) {
  return (
    <div data-testid="canvas-dna-helix" style={{ width: "100%", height: "100%" }}>
      <Canvas
        gl={{ alpha: false }}
        camera={{ position: [0, 0, 10], fov: 50 }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000000");
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <HelixStrands songs={songs} />
        <CircuitBackground />
        <EffectComposer>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
