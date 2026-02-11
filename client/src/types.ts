export interface Song {
  id: string;
  title: string;
  artist: string;
  isPlaying?: boolean;
  duration?: number;
}

export interface QueueSong extends Song {
  isPlaying: boolean;
}
