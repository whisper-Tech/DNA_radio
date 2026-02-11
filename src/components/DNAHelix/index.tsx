import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HelixRung } from './HelixRung';
import { HelixBackbone } from './HelixBackbone';
import { Song, HelixConfig, HelixRungData } from './types';

interface DNAHelixProps {
  playlist: Song[];
  currentIndex: number;
}

export const HELIX_CONFIG: HelixConfig = {
  radius: 3.5,
  verticalSpacing: 1.2,
  rotationPerRung: Math.PI / 6, 
  visibleRungs: 20,
  bufferRungs: 5,
};

export const DNAHelix: React.FC<DNAHelixProps> = ({ playlist, currentIndex }) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, currentIndex - HELIX_CONFIG.bufferRungs);
    const end = Math.min(
      playlist.length,
      currentIndex + HELIX_CONFIG.visibleRungs + HELIX_CONFIG.bufferRungs
    );
    return { start, end };
  }, [currentIndex, playlist.length]);

  const rungData: HelixRungData[] = useMemo(() => {
    return playlist
      .slice(visibleRange.start, visibleRange.end)
      .map((song, localIndex) => {
        const globalIndex = visibleRange.start + localIndex;
        const theta = globalIndex * HELIX_CONFIG.rotationPerRung;
        const y = globalIndex * HELIX_CONFIG.verticalSpacing;

        return {
          ...song,
          globalIndex,
          theta,
          y,
          leftPos: new THREE.Vector3(
            Math.cos(theta) * HELIX_CONFIG.radius,
            y,
            Math.sin(theta) * HELIX_CONFIG.radius
          ),
          rightPos: new THREE.Vector3(
            Math.cos(theta + Math.PI) * HELIX_CONFIG.radius,
            y,
            Math.sin(theta + Math.PI) * HELIX_CONFIG.radius
          ),
        };
      });
  }, [playlist, visibleRange]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    timeRef.current += delta;

    // Ambient rotation
    groupRef.current.rotation.y += delta * 0.1;

    // Smooth scroll position
    const targetY = -currentIndex * HELIX_CONFIG.verticalSpacing;
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetY,
      0.1
    );
  });

  return (
    <group ref={groupRef}>
      <HelixBackbone rungs={rungData} strand="left" color="#06b6d4" />
      <HelixBackbone rungs={rungData} strand="right" color="#a855f7" />

      {rungData.map((rung) => (
        <HelixRung 
          key={rung.id} 
          rung={rung} 
          isCurrent={rung.globalIndex === currentIndex} 
        />
      ))}
    </group>
  );
};
