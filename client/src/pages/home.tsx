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
  { id: "11", title: "Memory Leak", artist: "Stack Overflow", duration: 194 },
  { id: "12", title: "Zero Day", artist: "Firewall", duration: 287 },
  { id: "13", title: "Laser Grid", artist: "Tron Legacy", duration: 210 },
  { id: "14", title: "Data Stream", artist: "Byte Force", duration: 242 },
  { id: "15", title: "Hologram", artist: "Virtual Echo", duration: 265 },
];

const INITIAL_QUEUE: Song[] = [
  { ...LIBRARY_SONGS[0], isPlaying: true },
  { ...LIBRARY_SONGS[1], isPlaying: false },
  { ...LIBRARY_SONGS[2], isPlaying: false },
  { ...LIBRARY_SONGS[3], isPlaying: false },
  { ...LIBRARY_SONGS[4], isPlaying: false },
];

export default function Home() {
  const [queue, setQueue] = useState<Song[]>(INITIAL_QUEUE);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<number | null>(null);

  const currentSong = queue.find((s) => s.isPlaying) || queue[0] || null;

  useEffect(() => {
    if (isPlaying && currentSong) {
      const duration = currentSong.duration || 240;
      const increment = 100 / (duration * 10);

      progressRef.current = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setQueue((q) => {
              if (q.length <= 1) return q;
              const next = q.slice(1);
              next[0] = { ...next[0], isPlaying: true };
              return next;
            });
            return 0;
          }
          return prev + increment;
        });
      }, 100);
    }

    return () => {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
    };
  }, [isPlaying, currentSong?.id]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, song: Song) => {
    e.dataTransfer.setData("application/json", JSON.stringify(song));
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const handleSongClick = useCallback((song: Song) => {
    setQueue((prev) => {
      const exists = prev.find((s) => s.id === song.id);
      if (exists) return prev;
      return [...prev, { ...song, isPlaying: false }];
    });
  }, []);

  return (
    <div className="flex h-screen w-full bg-black" data-testid="page-home">
      <div
        className="flex-1 relative pb-20"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          try {
            const song: Song = JSON.parse(e.dataTransfer.getData("application/json"));
            setQueue((prev) => {
              const exists = prev.find((s) => s.id === song.id);
              if (exists) return prev;
              return [...prev, { ...song, isPlaying: prev.length === 0 }];
            });
          } catch {}
        }}
      >
        <DNAHelix songs={queue} />
      </div>

      <div className="border-l border-[#00e5ff]/10">
        <MusicLibrary
          songs={LIBRARY_SONGS}
          onDragStart={handleDragStart}
          onSongClick={handleSongClick}
        />
      </div>

      <NowPlayingBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        progress={progress}
        onPlayPause={handlePlayPause}
      />
    </div>
  );
}
