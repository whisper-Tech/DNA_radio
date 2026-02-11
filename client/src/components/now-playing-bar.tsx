import { Music, ThumbsUp, ThumbsDown, Volume2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Song } from "@/types";

interface NowPlayingBarProps {
  currentSong: Song | null;
  progress: number;
  volume: number;
  onVolumeChange: (val: number) => void;
  onVote: (type: "accept" | "reject") => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function NowPlayingBar({ currentSong, progress, volume, onVolumeChange, onVote }: NowPlayingBarProps) {
  const duration = currentSong?.duration ?? 0;
  const elapsed = (progress / 100) * duration;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-black/60 backdrop-blur-lg border-t border-white/5 z-50 flex items-center px-6 gap-8">
      <div className="flex items-center gap-4 w-72 min-w-0">
        <div className="w-12 h-12 min-w-[48px] bg-white/5 border border-[#00e5ff]/20 rounded-md flex items-center justify-center shadow-neonGlow">
          <Music className="w-5 h-5 text-[#00e5ff]/60" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate font-cyber">
            {currentSong ? currentSong.title : "Initializing Stream..."}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {currentSong ? currentSong.artist : "CyberDNA Radio"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onVote("accept")}
          className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-[#00e5ff] hover:border-[#00e5ff]/50 transition-all hover:shadow-neonGlow"
          title="Accept"
        >
          <ThumbsUp className="w-5 h-5" />
        </button>
        <button
          onClick={() => onVote("reject")}
          className="p-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-red-500 hover:border-red-500/50 transition-all"
          title="Reject"
        >
          <ThumbsDown className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center gap-4">
        <span className="text-xs text-gray-500 font-mono w-10 text-right">
          {formatTime(elapsed)}
        </span>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00e5ff] rounded-full transition-all shadow-[0_0_10px_rgba(0,229,255,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 font-mono w-10">
          {formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-3 w-40">
        <Volume2 className="w-4 h-4 text-gray-400" />
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={(vals) => onVolumeChange(vals[0] / 100)}
          className="w-24"
        />
      </div>
    </div>
  );
}
