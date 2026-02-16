import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Stars, Sparkles, Trail, MeshDistortMaterial, GradientTexture } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';

interface Song {
  id: number;
  title: string;
  artist: string;
}

interface SongOrbProps {
  song: Song | null;
  position: [number, number, number];
  onClick: (song: Song | null) => void;
  isActive?: boolean;
}

// DNA Helix Component
function DNAHelix({ position = [0, 0, 0], scale = 1, isPlaying = false }: { position?: [number, number, number]; scale?: number; isPlaying: boolean }) {
  const helixRef = useRef<THREE.Group>(null!);
  
  useFrame((state, delta) => {
    if (isPlaying && helixRef.current) {
      helixRef.current.rotation.y += delta * 0.5;
      helixRef.current.rotation.x += delta * 0.1;
    }
  });

  const strands = useMemo(() => {
    const points: [THREE.Vector3, THREE.Vector3][] = [];
    const numPoints = 100;
    const height = 4;
    const radius = 1;
    
    for (let i = 0; i < numPoints; i++) {
      const t = i / numPoints;
      const angle = t * Math.PI * 4;
      
      points.push([
        new THREE.Vector3(
          Math.cos(angle) * radius,
          (t - 0.5) * height,
          Math.sin(angle) * radius
        ),
        new THREE.Vector3(
          Math.cos(angle + Math.PI) * radius,
          (t - 0.5) * height,
          Math.sin(angle + Math.PI) * radius
        )
      ]);
    }
    return points;
  }, []);

  return (
    <group ref={helixRef} position={position} scale={scale}>
      {strands.map((pair, i) => (
        <React.Fragment key={i}>
          <mesh position={pair[0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial 
              color={isPlaying ? "#00ffff" : "#0088ff"} 
              emissive={isPlaying ? "#00ffff" : "#0088ff"}
              emissiveIntensity={0.5}
              metalness={1}
              roughness={0}
            />
          </mesh>
          <mesh position={pair[1]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial 
              color={isPlaying ? "#ff00ff" : "#ff0088"} 
              emissive={isPlaying ? "#ff00ff" : "#ff0088"}
              emissiveIntensity={0.5}
              metalness={1}
              roughness={0}
            />
          </mesh>
          
          {i % 5 === 0 && (
            <>
              <mesh>
                <cylinderGeometry args={[0.02, 0.02, pair[0].distanceTo(pair[1]), 8]} />
                <meshStandardMaterial 
                  color="#ffffff" 
                  emissive="#ffffff"
                  emissiveIntensity={0.3}
                  transparent
                  opacity={0.8}
                  metalness={1}
                  roughness={0}
                />
              </mesh>
              <mesh position={pair[0].clone().lerp(pair[1], 0.5)}>
                <octahedronGeometry args={[0.08]} />
                <meshStandardMaterial 
                  color="#ffff00" 
                  emissive="#ffff00"
                  emissiveIntensity={0.8}
                  metalness={1}
                  roughness={0}
                />
              </mesh>
            </>
          )}
        </React.Fragment>
      ))}
      
      <Sparkles 
        count={50} 
        scale={[3, 3, 3]} 
        size={2} 
        speed={0.5}
        opacity={0.8}
        color={isPlaying ? "#00ffff" : "#0088ff"}
      />
    </group>
  );
}

// Floating Song Orb
function SongOrb({ song, position, onClick, isActive = false }: SongOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh
        ref={meshRef}
        position={position}
        onClick={() => onClick(song)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.3, 32, 32]} />
        <MeshDistortMaterial
          color={isActive ? "#ff0088" : hovered ? "#00ffff" : "#0088ff"}
          emissive={isActive ? "#ff0088" : hovered ? "#00ffff" : "#0088ff"}
          emissiveIntensity={0.8}
          distort={0.3}
          speed={2}
          roughness={0}
          metalness={1}
        />
        {song && (
          <Text
            position={[0, 0, 0.35]}
            fontSize={0.15}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {song.title.slice(0, 10)}
          </Text>
        )}
      </mesh>
    </Float>
  );
}

// Wave Visualizer
function WaveVisualizer({ isPlaying, audioData }: { isPlaying: boolean; audioData: number[] }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame(() => {
    if (meshRef.current && audioData.length > 0) {
      const positions = meshRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = i / 3;
        const audioIndex = Math.floor(x * audioData.length / (positions.length / 3));
        const amplitude = audioData[audioIndex] || 0;
        positions[i + 2] = amplitude * 0.5;
      }
      meshRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, Math.PI / 2]}>
      <planeGeometry args={[10, 2, 100, 10]} />
      <meshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={0.5}
        side={THREE.DoubleSide}
        wireframe
      />
    </mesh>
  );
}

// Particle Field
function ParticleField() {
  const particlesRef = useRef<THREE.Points>(null!);
  
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  const particles = useMemo(() => {
    const positions = new Float32Array(3000);
    for (let i = 0; i < 1000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return positions;
  }, []);

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#ffffff"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Main Scene
function Scene({ 
  currentSong, 
  playlist, 
  isPlaying, 
  onSongSelect 
}: { 
  currentSong: Song | null;
  playlist: Song[];
  isPlaying: boolean;
  onSongSelect: (song: Song | null) => void;
}) {
  const audioData = useMemo(() => 
    Array.from({ length: 100 }, () => isPlaying ? Math.random() : 0),
    [isPlaying]
  );

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00ffff" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#ff00ff" />
      <spotLight position={[0, 10, 0]} angle={0.3} penumbra={1} intensity={2} color="#ffffff" />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ParticleField />
      
      <DNAHelix position={[0, 0, 0]} scale={1.5} isPlaying={isPlaying} />
      
      <WaveVisualizer isPlaying={isPlaying} audioData={audioData} />
      
      {playlist.map((song, i) => {
        const angle = (i / playlist.length) * Math.PI * 2;
        const radius = 3;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(i * 0.5) * 0.5;
        
        return (
          <SongOrb
            key={song.id}
            song={song}
            position={[x, y, z] as [number, number, number]}
            onClick={onSongSelect}
            isActive={currentSong?.id === song.id}
          />
        );
      })}
      
      <OrbitControls 
        enablePan={false} 
        minDistance={5} 
        maxDistance={20}
        autoRotate={isPlaying}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// Loading Component
function Loader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-cyan-400 text-2xl font-bold animate-pulse">
        Loading 3D Experience...
      </div>
    </div>
  );
}

// Main Component
export default function DNARadioPlayer3D() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([
    { id: 1, title: "Cosmic Journey", artist: "Stellar Dreams" },
    { id: 2, title: "Neon Nights", artist: "Cyber Pulse" },
    { id: 3, title: "Quantum Leap", artist: "Future Bass" },
    { id: 4, title: "Digital Love", artist: "Synthwave" },
    { id: 5, title: "Holographic", artist: "Virtual Reality" },
    { id: 6, title: "Aurora Borealis", artist: "Northern Lights" },
    { id: 7, title: "Stellar Drift", artist: "Space Echo" },
    { id: 8, title: "Cybernetic Dreams", artist: "Neural Network" },
  ]);
  const [isPlaying, setIsPlaying] = useState(true);

  const handleSongSelect = (song: Song | null) => {
    setCurrentSong(song);
    console.log('Selected:', song);
  };

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <Suspense fallback={<Loader />}>
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
          <Scene 
            currentSong={currentSong}
            playlist={playlist}
            isPlaying={isPlaying}
            onSongSelect={handleSongSelect}
          />
        </Canvas>
      </Suspense>
      
      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 pointer-events-none">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-600 to-pink-600 mb-2 animate-pulse">
            DNA Radio
          </h1>
          <p className="text-cyan-300 text-xl">
            {currentSong ? `${currentSong.title} - ${currentSong.artist}` : "Select a song to begin"}
          </p>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/50 pointer-events-auto"
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            const currentIndex = playlist.findIndex(s => s.id === currentSong?.id);
            const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % playlist.length : 0;
            setCurrentSong(playlist[nextIndex]);
          }}
          className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full text-white font-bold text-lg hover:shadow-lg hover:shadow-purple-500/50 pointer-events-auto"
        >
          ⏭ Next
        </motion.button>
      </div>
      
      {/* Side Panel */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black/70 backdrop-blur-lg p-6 rounded-l-3xl border-l border-t border-b border-cyan-500/30">
        <h3 className="text-cyan-400 font-bold text-xl mb-4">Playlist</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {playlist.map((song, i) => (
            <motion.div
              key={song.id}
              whileHover={{ x: -5 }}
              onClick={() => setCurrentSong(song)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                currentSong?.id === song.id 
                  ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border-l-2 border-cyan-400' 
                  : 'hover:bg-white/10'
              }`}
            >
              <p className="text-white text-sm font-semibold">{song.title}</p>
              <p className="text-gray-400 text-xs">{song.artist}</p>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-8 left-8 text-cyan-400/60 text-sm">
        <p>🖱️ Drag to rotate • Scroll to zoom • Click orbs to select</p>
      </div>
    </div>
  );
}
