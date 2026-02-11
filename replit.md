# CyberDNA - Music Visualizer

## Overview
A cyberpunk-themed 3D DNA double helix music queue visualizer built with React Three Fiber. Features a rotating double helix where song queue items are displayed as rungs, a draggable music library sidebar, and a now-playing control bar.

## Architecture
- **Frontend-only application** - All state is managed client-side
- **React Three Fiber** (v8) for 3D visualization with postprocessing bloom effects
- **Tailwind CSS** with custom cyberpunk dark theme (cyan/turquoise accents on black)
- **TypeScript** throughout

## Key Components
- `client/src/components/dna-helix.tsx` - 3D DNA double helix Canvas with bloom, circuit background
- `client/src/components/music-library.tsx` - Right sidebar with draggable song library
- `client/src/components/now-playing-bar.tsx` - Bottom fixed playback controls
- `client/src/pages/home.tsx` - Main page with state management, drag-drop, auto-progression
- `client/src/types.ts` - Song interface definitions

## Theme
- Dark cyberpunk aesthetic with cyan (#00e5ff) neon accents
- Font: Oxanium (cyber), JetBrains Mono (mono)
- Always dark mode (class="dark" on html)
- Custom Tailwind utilities: shadow-neonGlow, shadow-neonGlowStrong, font-cyber, animate-spin-slow

## Recent Changes
- 2026-02-11: Initial build - complete cyberpunk DNA music visualizer

## User Preferences
- Cyberpunk/neon aesthetic
- 3D visualizations with React Three Fiber
