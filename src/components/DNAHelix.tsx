import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Song {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  duration: number;
  health: number;
  status?: string;
  totalPlays?: number;
  totalAccepts?: number;
  totalRejects?: number;
}

interface DNAHelixProps {
  playlist: Song[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
}

export const DNAHelix: React.FC<DNAHelixProps> = ({ 
  playlist, 
  currentIndex, 
  isPlaying, 
  currentTime 
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += isPlaying ? 0.01 : 0.002;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Simple DNA helix representation */}
      {playlist.map((song, index) => {
        const angle = (index / playlist.length) * Math.PI * 2;
        const radius = 5;
        const height = (index - playlist.length / 2) * 0.5;
        
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        
        return (
          <mesh
            key={song.id}
            position={[x, height, z]}
            scale={isActive ? 1.5 : 1}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color={
                isActive ? '#00ffff' :
                isPast ? '#ff0066' :
                '#666666'
              }
              emissive={isActive ? '#00ffff' : '#000000'}
              emissiveIntensity={isActive ? 0.5 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
};
