import * as THREE from 'three';

export interface Song {
  id: string;
  title: string;
  artist: string;
  uri: string;
  health: number; // -10 to +10
  status: 'active' | 'immortal' | 'removed';
  youtubeId?: string;
  duration?: number;
}

export interface HelixRungData extends Song {
  globalIndex: number;
  theta: number;
  y: number;
  leftPos: THREE.Vector3;
  rightPos: THREE.Vector3;
}

export interface HelixConfig {
  radius: number;
  verticalSpacing: number;
  rotationPerRung: number;
  visibleRungs: number;
  bufferRungs: number;
}
