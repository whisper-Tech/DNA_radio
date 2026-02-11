# WORKFLOW: THE SECRET - GRANDMASTER MEDIA PLAYER & DNA RADIO

## 1. PROJECT VISION
Develop a high-fidelity, secret-access music experience at `secret.whisper.college`. The core UI is a massive, 3D interactive DNA helix where each "rung" (hydrogen bond) represents a song. The playlist is a living organism shaped by a "biological" voting system (Accept/Reject sequencing).

## 2. TECH STACK (RECOMMENDED)
- **Frontend:** React + Vite + TypeScript.
- **3D Engine:** React Three Fiber (R3F) + Three.js + @react-three/drei + @react-three/postprocessing.
- **Styling:** Tailwind CSS + Framer Motion (for high-end UI transitions).
- **Backend/Real-time:** Node.js (Fastify/Express) + Socket.io (for synced global radio state).
- **Music APIs:** Spotify Web Playback SDK, MusicKit JS (Apple), Soundcloud Widget API.
- **Hosting:** Vercel (Frontend) + Railway/Render (Backend).

## 3. PHASE 1: THE "VOID" ENTRY (SPLASH PAGE)
### Visuals:
- **Background:** Deep space blackness with subtle, randomly positioned twinkling stars (smooth opacity oscillation).
- **The Beacon:** One star is 2-3x larger with a `CSS filter: drop-shadow` or `Bloom` glow.
### Interaction (Mobile/Desktop):
- **Press & Hold / Long Press:** A 2-second threshold triggers the sequence.
- **Transition Sequence (Framer Motion):**
  1. 0-5s: "Welcome" fades in (Left -> Right) and out.
  2. 5-10s: "To The Secret" fades in and floats upward, locking into the site title/header.
  3. 10-15s: A spinning vortex of blue, cyan, and purple glowing bars floats up from the bottom.

## 4. PHASE 2: THE DNA HELIX ENGINE (VORTEX)
### 3D Construction (React Three Fiber):
- **Structure:** Two primary strands (double helix) made of glowing cylinders.
- **Rungs (Base Pairs):** Interactive Bars connecting the strands. Each rung is a `SongTrack` object.
- **Initial Spin:** Fast during the "float up" transition, then slowing down to a casual, human-observable rotation.
### Animation Logic:
- **Inspiration:** Refer to the sine-wave math in `masterScanner-legacy.js` but implement in 3D space (X, Y, Z).
- **Glow:** Use `emissive` materials and a selective `Bloom` pass to give it a "Grandmaster" cyberpunk aesthetic.

## 5. PHASE 3: THE "BIOLOGICAL" VOTING & LOGIC
### The Shared Radio State:
- All users hear the same song at the same time (Synced via Server NTP/Socket.io).
- **Accept Sequence:** Increases a song's "health." If it reaches 10 likes, it gains a **Golden "Immortal" Glow**.
- **Reject Sequencing:** Decreases a song's "health." If it reaches 10 rejects (across plays or users), the song is permanently removed from the DNA strand.
- **Visual Feedback:** Each reject makes the rung look more "damaged" (glitch shaders, cracks, or fragmenting meshes).
### The Interrupt Rule:
- Only 10 total rejects can interrupt a song.
- If interrupted, the song fades out (5s), and the **last person who rejected it** gets 10 seconds to pick the next song from 4 AI-suggested options.

## 6. PHASE 4: ACCOUNT LINKING & DRAG-AND-DROP
- **No Login Wall:** Use anonymous sessions (local storage) + Device Fingerprinting.
- **Library Sidebar:** Users can OAuth into Spotify or Apple Music to see *their* playlists.
- **Drag-and-Drop:** Users can drag a song from their sidebar and "slot" it into the DNA strand at a specific location.
- **Immediate Play:** Dragging to the topmost rung adds it to the current queue.

## 7. PHASE 5: REWARDING THE CURIOUS
- **DevTools/Console Detection:** If a user opens the console or hits a specific route, show a hidden message:
  > "Sequence Detected. We prefer those who look under the hood. Join us: [Secret Link]"

## 8. CRITICAL DIRECTIVES FOR AI AGENT
1. **Cyberpunk Aesthetic:** If it doesn't look like a high-end sci-fi interface, it's not done.
2. **Infinite Helix:** The DNA strand should be procedurally generated as the user scrolls, representing the "infinite" playlist.
3. **Audio Sync:** Use the server as the "Source of Truth" for timestamps.
4. **Mobile Optimization:** Ensure the long-press and drag-and-drop are buttery smooth on touch devices.

# END WORKFLOW
