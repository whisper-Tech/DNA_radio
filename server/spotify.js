import fetch from 'node-fetch';
import pkg from 'spotify-url-info';
const { getTracks } = pkg(fetch);
import yts from 'yt-search';
import SpotifyWebApi from 'spotify-web-api-node';

function parsePlaylistId(playlistUrl) {
  if (!playlistUrl) return null;
  // Handles:
  // - https://open.spotify.com/playlist/<id>
  // - spotify:playlist:<id>
  const urlMatch = String(playlistUrl).match(/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  const uriMatch = String(playlistUrl).match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch?.[1]) return uriMatch[1];
  return null;
}

// Use public scraping to get playlist tracks
export const getPlaylistTracks = async (playlistUrl) => {
  const normalizedUrl = playlistUrl || process.env.SPOTIFY_PLAYLIST_URL;

  try {
    // Prefer official API if credentials are present, fall back to public scraping.
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const playlistId = parsePlaylistId(normalizedUrl);

    if (clientId && clientSecret && playlistId) {
      console.log(`[SPOTIFY] Fetching via Web API for playlist: ${playlistId}`);
      const api = new SpotifyWebApi({ clientId, clientSecret });
      const token = await api.clientCredentialsGrant();
      api.setAccessToken(token.body.access_token);

      const items = [];
      let offset = 0;
      const limit = 100;
      while (true) {
        const resp = await api.getPlaylistTracks(playlistId, { offset, limit });
        items.push(...(resp.body?.items || []));
        if (!resp.body?.next) break;
        offset += limit;
        // Safety valve: don't loop forever on weird API responses.
        if (offset > 2000) break;
      }

      const mapped = items
        .map((it) => it?.track)
        .filter(Boolean)
        .map((track) => ({
          id: track.id || Math.random().toString(36).slice(2),
          title: track.name,
          artist: Array.isArray(track.artists) && track.artists[0] ? track.artists[0].name : 'Unknown',
          uri: track.uri,
          duration: track.duration_ms,
          health: 0,
          status: 'active',
        }));

      return mapped;
    }

    console.log(`[SPOTIFY] Fetching public metadata for: ${normalizedUrl}`);
    const tracks = await getTracks(normalizedUrl);
    
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
