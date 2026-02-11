import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HelixRungData } from './types';
import './shaders/BackboneShaderMaterial';

interface BackboneProps {
  rungs: HelixRungData[];
  strand: 'left' | 'right';
  color: string;
}

export const HelixBackbone: React.FC<BackboneProps> = ({ rungs, strand, color }) => {
  const matRef = useRef<any>(null);
  
  const tubeGeometry = useMemo(() => {
    if (rungs.length < 2) return new THREE.BufferGeometry();

    const points = rungs.map(r =>
      strand === 'left' ? r.leftPos : r.rightPos
    );

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, rungs.length * 6, 0.15, 8, false);
  }, [rungs, strand]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uTime = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh geometry={tubeGeometry}>
      <backboneShaderMaterial
        ref={matRef}
        uColor={new THREE.Color(color)}
        uIntensity={1.5}
        transparent
      />
    </mesh>
  );
};
