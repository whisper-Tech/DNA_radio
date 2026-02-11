export interface Song {
  id: string;
  title: string;
  artist: string;
  isPlaying?: boolean;
  duration?: number;
  votes?: number;
}

export interface QueueSong extends Song {
  isPlaying: boolean;
}
