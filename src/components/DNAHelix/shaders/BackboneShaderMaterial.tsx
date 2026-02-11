import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// Backbone Shader: Glowing flowing energy strands
const BackboneShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#06b6d4'),
    uIntensity: 1.0,
  },
  // Vertex Shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      // Flowing wave effect
      vec3 pos = position;
      float flow = sin(vUv.x * 20.0 - uTime * 4.0) * 0.05;
      pos += vNormal * flow;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
      // Flowing energy pattern
      float flow = sin(vUv.x * 10.0 - uTime * 3.0) * 0.5 + 0.5;
      float scanline = sin(vUv.x * 100.0) * 0.1;
      
      vec3 finalColor = uColor;
      
      // Bright flowing pulses
      float energy = pow(flow, 8.0) * 2.0;
      finalColor += uColor * energy;
      
      // Rim light
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
      finalColor += uColor * rim * 2.0;
      
      finalColor *= uIntensity;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

extend({ BackboneShaderMaterial });

declare global {
  namespace JSX {
    interface IntrinsicElements {
      backboneShaderMaterial: any;
    }
  }
}

export { BackboneShaderMaterial };
