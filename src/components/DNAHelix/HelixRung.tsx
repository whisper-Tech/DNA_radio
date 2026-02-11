import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { HelixRungData } from './types';
import './shaders/ImmortalShaderMaterial';
import './shaders/DamagedShaderMaterial';

interface RungProps {
  rung: HelixRungData;
  isCurrent: boolean;
}

export const HelixRung: React.FC<RungProps> = ({ rung, isCurrent }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const immortalMatRef = useRef<any>(null);
  const damagedMatRef = useRef<any>(null);
  const standardMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Determine rung state
  const isImmortal = rung.health >= 10 || rung.status === 'immortal';
  const isDamaged = rung.health <= -5;
  const damageLevel = isDamaged ? Math.min(1.0, Math.abs(rung.health + 5) / 5) : 0;

  // Calculate rung geometry
  const rungLength = useMemo(() => {
    return rung.leftPos.distanceTo(rung.rightPos);
  }, [rung.leftPos, rung.rightPos]);

  const rungPosition = useMemo(() => {
    return new THREE.Vector3(
      (rung.leftPos.x + rung.rightPos.x) / 2,
      (rung.leftPos.y + rung.rightPos.y) / 2,
      (rung.leftPos.z + rung.rightPos.z) / 2
    );
  }, [rung.leftPos, rung.rightPos]);

  const rungRotation = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(rung.rightPos, rung.leftPos).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);
    return euler;
  }, [rung.leftPos, rung.rightPos]);

  // Get color for standard material
  const getColor = () => {
    if (isImmortal) return '#fbbf24'; // Gold
    if (isDamaged) return '#ef4444'; // Red
    return '#ffffff';
  };

  // Animate shader uniforms
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (immortalMatRef.current && isImmortal) {
      immortalMatRef.current.uTime = time;
      immortalMatRef.current.uIntensity = isCurrent ? 2.5 : 1.5;
    }

    if (damagedMatRef.current && isDamaged) {
      damagedMatRef.current.uTime = time;
      damagedMatRef.current.uDamageLevel = damageLevel;
      damagedMatRef.current.uIntensity = isCurrent ? 2.0 : 1.2;
    }
  });

  // Render the appropriate material based on state
  const renderMaterial = () => {
    if (isImmortal) {
      return (
        <immortalShaderMaterial
          ref={immortalMatRef}
          uTime={0}
          uColor={new THREE.Color('#fbbf24')}
          uIntensity={isCurrent ? 2.5 : 1.5}
          transparent={false}
          side={THREE.DoubleSide}
        />
      );
    }

    if (isDamaged) {
      return (
        <damagedShaderMaterial
          ref={damagedMatRef}
          uTime={0}
          uColor={new THREE.Color('#ef4444')}
          uDamageLevel={damageLevel}
          uIntensity={isCurrent ? 2.0 : 1.2}
          transparent={false}
          side={THREE.DoubleSide}
        />
      );
    }

    // Standard material for normal rungs
    return (
      <meshStandardMaterial
        ref={standardMatRef}
        color={getColor()}
        emissive={getColor()}
        emissiveIntensity={isCurrent ? 2 : 0.5}
      />
    );
  };

  return (
    <group>
      {/* The Rung Bar */}
      <mesh
        ref={meshRef}
        position={rungPosition}
        rotation={rungRotation}
      >
        <boxGeometry args={[rungLength, 0.15, 0.15]} />
        {renderMaterial()}
      </mesh>

      {/* Node spheres at connection points */}
      <mesh position={rung.leftPos}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {isImmortal ? (
          <immortalShaderMaterial
            uTime={0}
            uColor={new THREE.Color('#fbbf24')}
            uIntensity={isCurrent ? 2.0 : 1.0}
          />
        ) : isDamaged ? (
          <damagedShaderMaterial
            uTime={0}
            uColor={new THREE.Color('#ef4444')}
            uDamageLevel={damageLevel}
            uIntensity={isCurrent ? 1.5 : 0.8}
          />
        ) : (
          <meshStandardMaterial
            color="#06b6d4"
            emissive="#06b6d4"
            emissiveIntensity={isCurrent ? 1.5 : 0.3}
          />
        )}
      </mesh>

      <mesh position={rung.rightPos}>
        <sphereGeometry args={[0.12, 16, 16]} />
        {isImmortal ? (
          <immortalShaderMaterial
            uTime={0}
            uColor={new THREE.Color('#fbbf24')}
            uIntensity={isCurrent ? 2.0 : 1.0}
          />
        ) : isDamaged ? (
          <damagedShaderMaterial
            uTime={0}
            uColor={new THREE.Color('#ef4444')}
            uDamageLevel={damageLevel}
            uIntensity={isCurrent ? 1.5 : 0.8}
          />
        ) : (
          <meshStandardMaterial
            color="#a855f7"
            emissive="#a855f7"
            emissiveIntensity={isCurrent ? 1.5 : 0.3}
          />
        )}
      </mesh>

      {/* Aura effect for immortal songs */}
      {isImmortal && (
        <mesh position={rungPosition}>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0.08}
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Glitch particles for damaged songs */}
      {isDamaged && isCurrent && (
        <group position={rungPosition}>
          {[...Array(5)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin(i * 1.2) * 0.5,
                Math.cos(i * 0.8) * 0.3,
                Math.sin(i * 0.5) * 0.4
              ]}
            >
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshBasicMaterial color="#ff0000" transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      )}

      {/* Song Info Text */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <Text
          position={[
            rung.leftPos.x * 1.5,
            rung.leftPos.y,
            rung.leftPos.z * 1.5
          ]}
          rotation={[0, rung.theta + Math.PI / 2, 0]}
          fontSize={isCurrent ? 0.35 : 0.28}
          color={
            isImmortal
              ? '#fbbf24'
              : isDamaged
              ? '#ef4444'
              : isCurrent
              ? '#22d3ee'
              : '#ffffff'
          }
          maxWidth={2.5}
          textAlign="center"
          font="https://fonts.gstatic.com/s/orbitron/v25/yMJ4Dvm7UmS6B93S50u5.woff"
          outlineWidth={isCurrent ? 0.02 : 0}
          outlineColor={isImmortal ? '#ff8c00' : isDamaged ? '#8b0000' : '#0891b2'}
        >
          {rung.title}
          {'\n'}
          {rung.artist}
          {isImmortal && '\n★ IMMORTAL ★'}
          {rung.health <= -8 && '\n⚠ CRITICAL ⚠'}
        </Text>
      </Float>

      {/* Health indicator bar */}
      {isCurrent && (
        <group position={[rung.leftPos.x * 1.5, rung.leftPos.y - 0.5, rung.leftPos.z * 1.5]}>
          <mesh>
            <planeGeometry args={[1.5, 0.08]} />
            <meshBasicMaterial color="#333333" transparent opacity={0.5} />
          </mesh>
          <mesh position={[(rung.health / 20) * 0.75 - 0.375, 0, 0.001]}>
            <planeGeometry args={[Math.abs(rung.health) / 10 * 0.75, 0.06]} />
            <meshBasicMaterial
              color={rung.health >= 0 ? '#22c55e' : '#ef4444'}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
