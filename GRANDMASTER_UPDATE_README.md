# DNA Webapp Player - Grandmaster Plan Implementation

## Overview

This update implements the complete Grandmaster Plan with four major enhancements:

1. **Custom GLSL Shaders** - Immortal (gold iridescent) and Damaged (red glitching) effects
2. **Precise Sync Logic** - <100ms jitter synchronization with server timestamp
3. **Immediate Removal** - Cross-fade transition when health hits -10
4. **Cyberpunk Post-Processing** - Bloom, Chromatic Aberration, Scanlines, Noise, Vignette, Glitch

---

## Installation

### 1. Install New Dependencies

```bash
npm install postprocessing
```

### 2. Copy Files to Your Project

Copy the files from this zip to your project, maintaining the directory structure:

```
your-project/
├── src/
│   ├── components/
│   │   └── DNAHelix/
│   │       ├── shaders/                    # NEW FOLDER
│   │       │   ├── ImmortalShaderMaterial.tsx
│   │       │   ├── DamagedShaderMaterial.tsx
│   │       │   └── index.ts
│   │       ├── HelixRung.tsx               # MODIFIED
│   │       └── types.ts                    # MODIFIED
│   └── pages/
│       └── RadioPage.tsx                   # MODIFIED
└── server/
    ├── index.js                            # MODIFIED
    └── state.js                            # MODIFIED
```

---

## File Descriptions

### New Files

#### `src/components/DNAHelix/shaders/ImmortalShaderMaterial.tsx`
Custom GLSL shader for songs that reach +10 health (immortal status):
- Gold base color with pulsing intensity
- Iridescent rainbow shift based on view angle
- Fresnel edge glow effect
- Sparkle particles
- Subtle vertex displacement for organic movement

#### `src/components/DNAHelix/shaders/DamagedShaderMaterial.tsx`
Custom GLSL shader for songs with health ≤ -5:
- Red emissive base with procedural cracks (simplex noise)
- RGB split glitch effect triggered randomly
- Scanline overlay
- Flickering based on damage level
- Vertex jitter displacement

#### `src/components/DNAHelix/shaders/index.ts`
Barrel export file for shader materials.

### Modified Files

#### `src/components/DNAHelix/HelixRung.tsx`
- Integrates both custom shader materials
- Dynamically switches materials based on song health
- Animates shader uniforms via `useFrame` hook
- Adds node spheres at helix connection points
- Displays aura effect for immortal songs
- Shows glitch particles for damaged songs
- Includes health indicator bar for current song

#### `src/components/DNAHelix/types.ts`
- Added `youtubeId?: string` field to Song interface
- Added `duration?: number` field to Song interface

#### `src/pages/RadioPage.tsx`
**Sync Logic Improvements:**
- NTP-style ping/pong for calculating server time offset
- Continuous sync check every 2 seconds
- 100ms drift threshold for seeking
- Visual sync status display (drift, offset)

**Cyberpunk Post-Processing Stack:**
- `Bloom` - intensity 2.0, radius 0.8, 8 mipmap levels
- `ChromaticAberration` - radial modulation for edge distortion
- `Scanline` - overlay blend at 8% opacity
- `Noise` - film grain at 15% opacity
- `Vignette` - 0.7 darkness for focus
- `Glitch` - dynamic, triggered on removal events

**UI Enhancements:**
- Cross-fade transitions on song change
- Sync status panel with real-time drift display
- Visual feedback for voting actions
- Improved progress and health bars

#### `server/state.js`
- Immediate removal when health hits -10
- Cross-fade support with 300ms transition delay
- Pre-fetches next song's YouTube ID
- Emits `song_removed` and `song_immortal` events
- Includes `serverTime` in state for sync

#### `server/index.js`
- Ping/pong handler for time synchronization
- Broadcasts removal and immortal events
- Low-latency WebSocket configuration
- New `/api/sync` endpoint for debugging

---

## How It Works

### Sync Logic

1. On connect, client sends `ping` with local timestamp
2. Server responds with `pong` containing both client and server timestamps
3. Client calculates round-trip time and server offset
4. All playback positions are adjusted using this offset
5. Sync checks run every 2 seconds; if drift > 100ms, player seeks

### Shader Effects

**Immortal (health ≥ 10):**
- Song status changes to `'immortal'`
- Gold iridescent shader activates
- Aura sphere surrounds the rung
- Text displays "★ IMMORTAL ★"

**Damaged (health ≤ -5):**
- Red glitching shader activates
- Intensity increases as health decreases
- At health ≤ -8, text displays "⚠ CRITICAL ⚠"

**Removed (health ≤ -10):**
- Song immediately removed from sequence
- Cross-fade transition to next song
- Glitch post-processing effect triggers
- Server broadcasts removal event

### Post-Processing

The cyberpunk aesthetic is achieved through layered effects:
1. **Bloom** creates the neon glow on bright elements
2. **Chromatic Aberration** adds color fringing at edges
3. **Scanlines** provide retro-futuristic texture
4. **Noise** adds film grain for atmosphere
5. **Vignette** focuses attention on center
6. **Glitch** triggers on song removal for dramatic effect

---

## Troubleshooting

### Shaders not rendering
- Ensure `postprocessing` package is installed
- Check browser console for WebGL errors
- Verify shader files are in correct location

### Sync issues
- Check server is running on port 3001
- Verify WebSocket connection in browser dev tools
- Look for sync status in UI (should show "Sync Active")

### Performance issues
- Reduce `count` in Stars component
- Lower bloom `intensity` or `radius`
- Disable some post-processing effects

---

## Version

**Grandmaster Plan v1.0**
- Implemented: January 2026
- Compatible with: DNA Webapp Player base codebase

---

## Credits

Custom GLSL shaders inspired by:
- Inigo Quilez's noise functions
- Three.js shader examples
- Cyberpunk 2077 visual aesthetics
