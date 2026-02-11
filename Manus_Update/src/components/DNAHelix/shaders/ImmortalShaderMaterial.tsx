import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// Immortal Shader: Gold pulsing iridescent aura
const ImmortalShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#fbbf24'),
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
      
      // Subtle vertex displacement for organic feel
      vec3 pos = position;
      float displacement = sin(position.x * 10.0 + uTime * 2.0) * 0.02;
      displacement += sin(position.y * 8.0 + uTime * 1.5) * 0.02;
      pos += normal * displacement;
      
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
    
    // HSV to RGB conversion
    vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    
    void main() {
      // Base gold color
      vec3 baseColor = uColor;
      
      // Iridescent effect based on view angle and time
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
      
      // Rainbow shift for iridescence
      float hueShift = sin(vPosition.x * 3.0 + uTime * 0.5) * 0.1;
      hueShift += sin(vPosition.y * 2.0 + uTime * 0.7) * 0.1;
      
      // Convert base color to HSV, shift hue, convert back
      vec3 iridescent = hsv2rgb(vec3(
        0.12 + hueShift + fresnel * 0.15, // Gold hue with shift
        0.8 - fresnel * 0.3,
        1.0
      ));
      
      // Pulsing glow effect
      float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
      pulse = pulse * 0.4 + 0.6; // Range: 0.6 to 1.0
      
      // Secondary faster pulse
      float pulse2 = sin(uTime * 7.0 + vPosition.x * 5.0) * 0.5 + 0.5;
      
      // Combine colors
      vec3 finalColor = mix(baseColor, iridescent, fresnel * 0.7);
      
      // Add golden glow
      float glow = pulse * (1.0 + fresnel * 2.0);
      finalColor *= glow;
      
      // Add sparkle effect
      float sparkle = pow(sin(vPosition.x * 50.0 + uTime * 10.0) * 
                         sin(vPosition.y * 50.0 + uTime * 8.0), 8.0);
      finalColor += vec3(1.0, 0.9, 0.7) * sparkle * pulse2 * 0.5;
      
      // Emissive intensity
      finalColor *= uIntensity;
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Extend Three.js with our custom material
extend({ ImmortalShaderMaterial });

// TypeScript declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      immortalShaderMaterial: any;
    }
  }
}

export { ImmortalShaderMaterial };
