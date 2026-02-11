import fetch from 'node-fetch';
import pkg from 'spotify-url-info';
const { getTracks } = pkg(fetch);
import yts from 'yt-search';

// Use public scraping to get playlist tracks
export const getPlaylistTracks = async (playlistUrl) => {
  try {
    console.log(`[SPOTIFY] Fetching public metadata for: ${playlistUrl}`);
    const tracks = await getTracks(playlistUrl);
    
    return tracks.map(track => ({
      id: track.id || Math.random().toString(36).substr(2, 9),
      title: track.name,
      artist: track.artists ? track.artists[0].name : track.artist,
      uri: track.uri,
      duration: track.duration_ms || track.duration,
      health: 0,
      status: 'active'
    }));
  } catch (err) {
    console.error('[SPOTIFY] Public fetch failed:', err.message);
    return [];
  }
};

// Find the best YouTube match for a track
export const getYoutubeId = async (title, artist) => {
  try {
    const query = `${title} ${artist} official audio`;
    const r = await yts(query);
    const video = r.videos[0];
    return video ? video.videoId : null;
  } catch (err) {
    console.error('[YOUTUBE] Search failed:', err.message);
    return null;
  }
};
