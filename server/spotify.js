import fetch from 'node-fetch';
import pkg from 'spotify-url-info';
const { getTracks } = pkg(fetch);
import yts from 'yt-search';
import SpotifyWebApi from 'spotify-web-api-node';
const embeddableCache = new Map();

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
const normalize = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}\-\_\.\,\!\?\'\"]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getYoutubeId = async (title, artist, durationMs = null) => {
  try {
    const nt = normalize(title);
    const na = normalize(artist);
    const targetSec = typeof durationMs === 'number' && durationMs > 0 ? durationMs / 1000 : null;
    const querySet = [
      `${title} ${artist} official audio`,
      `${title} ${artist}`,
      `${title} official audio`,
      `${title} song`,
      `${nt} ${na}`.trim(),
    ].filter(Boolean);

    const scoreVideo = (v) => {
      const vt = normalize(v.title);
      let score = 0;

      if (vt.includes(na)) score += 40;
      if (vt.includes(nt)) score += 45;
      if (vt.includes('official') && vt.includes('audio')) score += 20;
      if (vt.includes('lyrics')) score -= 5;
      if (vt.includes('live')) score -= 20;
      if (vt.includes('cover')) score -= 25;

      if (targetSec && typeof v.seconds === 'number') {
        const delta = Math.abs(v.seconds - targetSec);
        score -= Math.min(35, delta / 4);
      }

      return score;
    };

    const allVideos = [];
    const seen = new Set();
    for (const query of querySet) {
      const r = await yts(query);
      const videos = Array.isArray(r?.videos) ? r.videos.slice(0, 12) : [];
      for (const v of videos) {
        if (!v?.videoId || seen.has(v.videoId)) continue;
        seen.add(v.videoId);
        allVideos.push(v);
      }
      if (allVideos.length >= 20) break;
    }

    if (!allVideos.length) return null;

    const ranked = allVideos
      .map((v) => ({ v, score: scoreVideo(v) }))
      .sort((a, b) => b.score - a.score);
    const topCandidates = ranked.slice(0, 8).map((r) => r.v);

    for (const video of topCandidates) {
      if (!video?.videoId) continue;
      const embeddable = await isEmbeddable(video.videoId);
      if (embeddable) return video.videoId;
    }

    return ranked[0]?.v?.videoId || null;
  } catch (err) {
    console.error('[YOUTUBE] Search failed:', err.message);
    return null;
  }
};

async function isEmbeddable(videoId) {
  if (!videoId) return false;
  if (embeddableCache.has(videoId)) return embeddableCache.get(videoId);
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const ok = resp.ok;
    embeddableCache.set(videoId, ok);
    return ok;
  } catch {
    embeddableCache.set(videoId, false);
    return false;
  }
}
