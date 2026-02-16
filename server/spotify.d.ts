export type PlaylistTrack = {
  id: string;
  title: string;
  artist: string;
  uri: string;
  duration: number;
  youtubeId?: string | null;
  health?: number;
  status?: string;
};

export function getPlaylistTracks(playlistUrl: string): Promise<PlaylistTrack[]>;
export function getYoutubeId(title: string, artist: string, durationMs?: number | null): Promise<string | null>;
