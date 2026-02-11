import { useState, useCallback, useEffect, useRef } from "react";
import { DNAHelix } from "@/components/dna-helix";
import { MusicLibrary } from "@/components/music-library";
import { NowPlayingBar } from "@/components/now-playing-bar";
import type { Song } from "@/types";

const LIBRARY_SONGS: Song[] = [
  { id: "1", title: "Neon Drift", artist: "Synthwave Collective", duration: 234 },
  { id: "2", title: "Digital Rain", artist: "CyberPulse", duration: 198 },
  { id: "3", title: "Chrome Hearts", artist: "Retro Futures", duration: 267 },
  { id: "4", title: "Ghost in the Wire", artist: "Neural Link", duration: 312 },
  { id: "5", title: "Binary Sunset", artist: "Grid Runner", duration: 189 },
  { id: "6", title: "Quantum Break", artist: "Phase Shift", duration: 245 },
  { id: "7", title: "Electric Dreams", artist: "Midnight Protocol", duration: 278 },
  { id: "8", title: "Void Walker", artist: "Dark Circuit", duration: 301 },
  { id: "9", title: "Pulse Code", artist: "Hex Machine", duration: 223 },
  { id: "10", title: "Skyline Chase", artist: "Neon Arcade", duration: 256 },
];

// Generate 100 rungs for the initial queue
const INITIAL_QUEUE: Song[] = Array.from({ length: 100 }, (_, i) => ({
  ...LIBRARY_SONGS[i % LIBRARY_SONGS.length],
  id: `queue-${i}`,
  isPlaying: i === 0,
}));

export default function Home() {
  const [queue, setQueue] = useState<Song[]>(INITIAL_QUEUE);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const currentSong = queue[0] || null;

  useEffect(() => {
    // Cyberpunk radio stream placeholder
    audioRef.current = new Audio("https://stream.nightride.fm/nightride.mp3");
    audioRef.current.volume = volume;
    audioRef.current.play().catch(() => {
      console.log("Autoplay blocked. Waiting for user interaction.");
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (currentSong) {
      const duration = currentSong.duration || 240;
      const step = 100 / (duration * 10);
      
      progressIntervalRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setQueue((q) => {
              const next = [...q.slice(1)];
              if (next.length < 100) {
                // Keep queue at 100 by recycling or pulling from library
                const refill = { ...LIBRARY_SONGS[Math.floor(Math.random() * LIBRARY_SONGS.length)], id: `refill-${Date.now()}` };
                next.push(refill);
              }
              return next.map((s, idx) => ({ ...s, isPlaying: idx === 0 }));
            });
            return 0;
          }
          return prev + step;
        });
      }, 100);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentSong?.id]);

  const handleDragStart = useCallback((e: React.DragEvent, song: Song) => {
    e.dataTransfer.setData("application/json", JSON.stringify(song));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const songData = JSON.parse(e.dataTransfer.getData("application/json"));
      const newSong = { ...songData, id: `added-${Date.now()}`, isPlaying: false };
      
      setQueue((prev) => {
        // Bump everything down after the currently playing song (index 0)
        const nextQueue = [prev[0], newSong, ...prev.slice(1)];
        return nextQueue.slice(0, 100); // Keep it at 100
      });
    } catch (err) {
      console.error("Drop failed", err);
    }
  }, []);

  const handleVote = useCallback((type: "accept" | "reject") => {
    console.log(`Voted ${type} for ${currentSong?.title}`);
    // Visual feedback or IP-based logic would go here
  }, [currentSong]);

  return (
    <div 
      className="flex h-screen w-full bg-black overflow-hidden select-none" 
      data-testid="page-home"
      onClick={() => audioRef.current?.play()} // Unlock audio on first click
    >
      <div
        className="flex-1 relative"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <DNAHelix songs={queue} />
      </div>

      <div className="relative z-10 border-l border-white/5">
        <MusicLibrary
          songs={LIBRARY_SONGS}
          onDragStart={handleDragStart}
        />
      </div>

      <NowPlayingBar
        currentSong={currentSong}
        progress={progress}
        volume={volume}
        onVolumeChange={setVolume}
        onVote={handleVote}
      />
    </div>
  );
}
