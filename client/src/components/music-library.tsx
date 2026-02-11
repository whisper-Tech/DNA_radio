import { useState } from "react";
import { Search, Music } from "lucide-react";
import type { Song } from "@/types";

interface MusicLibraryProps {
  songs: Song[];
  onDragStart: (e: React.DragEvent, song: Song) => void;
  onSongClick?: (song: Song) => void;
}

export function MusicLibrary({ songs, onDragStart, onSongClick }: MusicLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative w-80 bg-black/40 backdrop-blur-md h-[calc(100vh-5rem)] flex flex-col border-l border-white/5">
      <div className="relative z-10 flex flex-col h-full">
        <div className="p-4 pb-2">
          <h2
            className="font-cyber uppercase tracking-widest text-sm text-[#00e5ff]"
            style={{
              textShadow: "0 0 10px rgba(0, 229, 255, 0.5)",
            }}
          >
            THE SECRET PLAYLIST
          </h2>
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="search"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-library"
              className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00e5ff] focus:ring-1 focus:ring-[#00e5ff]/30 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#00e5ff]/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              draggable={true}
              onDragStart={(e) => onDragStart(e, song)}
              onClick={() => onSongClick?.(song)}
              data-testid={`item-song-${song.id}`}
              className="flex items-center gap-3 p-3 cursor-grab border-l-2 border-l-transparent hover:border-l-[#00e5ff]/50 hover:bg-white/5 rounded-r-md transition-colors group"
            >
              <div className="w-10 h-10 min-w-[40px] bg-white/5 border border-[#00e5ff]/20 rounded-md flex items-center justify-center group-hover:border-[#00e5ff]/50">
                <Music className="w-4 h-4 text-[#00e5ff]/40" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{song.title}</p>
                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
