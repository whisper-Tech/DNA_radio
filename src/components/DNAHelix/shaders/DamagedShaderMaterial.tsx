import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

// Damaged Shader: Red-emissive glitching/cracking effect with noise
const DamagedShaderMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#ef4444'),
    uDamageLevel: 0.5, // 0.0 to 1.0 based on health
    uIntensity: 1.0,
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uDamageLevel;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vGlitch;
    
    // Simple hash function
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      
      vec3 pos = position;
      
      // Glitch displacement - more intense with higher damage
      float glitchTime = floor(uTime * 20.0);
      float glitchRandom = hash(glitchTime + position.x);
      
      // Random glitch trigger
      vGlitch = step(0.85 - uDamageLevel * 0.3, glitchRandom);
      
      if (vGlitch > 0.5) {
        // Horizontal slice displacement
        float sliceY = floor(position.y * 10.0) / 10.0;
        float sliceOffset = hash(sliceY + glitchTime) * 2.0 - 1.0;
        pos.x += sliceOffset * 0.3 * uDamageLevel;
        pos.z += sliceOffset * 0.2 * uDamageLevel;
      }
      
      // Constant jitter based on damage
      pos += normal * sin(uTime * 50.0 + position.y * 20.0) * 0.01 * uDamageLevel;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  // Fragment Shader
  `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDamageLevel;
    uniform float uIntensity;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vGlitch;
    
    // Simplex-like noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                         -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                       + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                              dot(x12.zw,x12.zw)), 0.0);
      m = m*m;
      m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    // Hash for random values
    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }
    
    void main() {
      vec3 baseColor = uColor;
      
      // Crack pattern using noise
      float crackNoise = snoise(vPosition.xy * 8.0 + uTime * 0.5);
      float crackNoise2 = snoise(vPosition.yz * 12.0 - uTime * 0.3);
      float cracks = smoothstep(0.3, 0.35, abs(crackNoise)) * 
                     smoothstep(0.2, 0.25, abs(crackNoise2));
      
      // Crack glow - brighter in the cracks
      float crackGlow = 1.0 - cracks;
      crackGlow = pow(crackGlow, 2.0) * uDamageLevel * 2.0;
      
      // Pulsing red emission
      float pulse = sin(uTime * 5.0) * 0.5 + 0.5;
      float fastPulse = sin(uTime * 15.0) * 0.5 + 0.5;
      
      // Color variation - darker in cracks, brighter emission
      vec3 crackColor = vec3(1.0, 0.2, 0.1); // Bright orange-red for cracks
      vec3 surfaceColor = baseColor * (0.3 + cracks * 0.7);
      
      vec3 finalColor = mix(surfaceColor, crackColor, crackGlow);
      
      // Glitch color shift
      if (vGlitch > 0.5) {
        float glitchTime = floor(uTime * 30.0);
        float colorShift = hash(glitchTime);
        
        // RGB split effect
        if (colorShift < 0.33) {
          finalColor = vec3(finalColor.r * 2.0, finalColor.g * 0.2, finalColor.b * 0.2);
        } else if (colorShift < 0.66) {
          finalColor = vec3(finalColor.r * 0.2, finalColor.g * 2.0, finalColor.b * 0.2);
        } else {
          finalColor = vec3(1.0, 1.0, 1.0); // White flash
        }
      }
      
      // Scanline effect
      float scanline = sin(vPosition.y * 100.0 + uTime * 20.0) * 0.5 + 0.5;
      scanline = pow(scanline, 4.0) * 0.3 * uDamageLevel;
      finalColor += vec3(scanline * 0.5, scanline * 0.1, scanline * 0.1);
      
      // Flickering
      float flicker = hash(floor(uTime * 60.0));
      if (flicker > 0.95 - uDamageLevel * 0.1) {
        finalColor *= 0.3;
      }
      
      // Edge glow (fresnel)
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
      finalColor += crackColor * fresnel * pulse * uDamageLevel;
      
      // Apply intensity
      finalColor *= uIntensity * (0.8 + pulse * 0.4);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
);

// Extend Three.js with our custom material
extend({ DamagedShaderMaterial });

// TypeScript declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      damagedShaderMaterial: any;
    }
  }
}

export { DamagedShaderMaterial };
