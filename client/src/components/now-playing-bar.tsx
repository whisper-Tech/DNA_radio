import { Music, Play, Pause } from "lucide-react";
import type { Song } from "@/types";

interface NowPlayingBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  onPlayPause: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function NowPlayingBar({ currentSong, isPlaying, progress, onPlayPause }: NowPlayingBarProps) {
  const duration = currentSong?.duration ?? 0;
  const elapsed = (progress / 100) * duration;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-black/90 backdrop-blur-md border-t border-[#00e5ff]/10 z-50 flex items-center px-4 gap-6">
      <div className="flex items-center gap-3 w-64 min-w-0">
        <div className="w-12 h-12 min-w-[48px] bg-gray-800 border border-[#00e5ff]/20 rounded-md flex items-center justify-center">
          <Music className="w-5 h-5 text-[#00e5ff]/40" />
        </div>
        <div className="min-w-0">
          <p
            data-testid="text-now-playing-title"
            className="text-sm font-medium text-white truncate"
          >
            {currentSong ? currentSong.title : "No track selected"}
          </p>
          <p
            data-testid="text-now-playing-artist"
            className="text-xs text-gray-400 truncate"
          >
            {currentSong ? currentSong.artist : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={onPlayPause}
          disabled={!currentSong}
          data-testid="button-play-pause"
          className="w-12 h-12 rounded-full bg-[#00e5ff]/10 border border-[#00e5ff]/30 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            boxShadow:
              "0 0 15px rgba(0, 229, 255, 0.3), 0 0 30px rgba(0, 229, 255, 0.15)",
          }}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" style={{ color: "#00e5ff" }} />
          ) : (
            <Play className="w-5 h-5 ml-0.5" style={{ color: "#00e5ff" }} />
          )}
        </button>
      </div>

      <div className="flex-1 flex items-center gap-3" data-testid="progress-bar">
        <span className="text-xs text-gray-400 font-mono min-w-[3ch]">
          {formatTime(elapsed)}
        </span>
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00e5ff] rounded-full transition-all"
            style={{
              width: `${progress}%`,
              boxShadow: "0 0 8px rgba(0, 229, 255, 0.5), 0 0 16px rgba(0, 229, 255, 0.2)",
            }}
          />
        </div>
        <span className="text-xs text-gray-400 font-mono min-w-[3ch]">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
