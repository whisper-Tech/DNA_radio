import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setVolume: (vol: number) => void;
  unMute: () => void;
}

interface YouTubePlayerProps {
  videoId: string;
  playing: boolean;
  volume: number;
  onReady?: () => void;
  onPlaying?: () => void;
  onError?: (e: any) => void;
  onProgress?: (e: { playedSeconds: number }) => void;
}

let apiLoaded = false;
let apiReady = false;
const apiReadyCallbacks: (() => void)[] = [];

function ensureYTAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiReady && window.YT?.Player) {
      resolve();
      return;
    }
    apiReadyCallbacks.push(resolve);
    if (!apiLoaded) {
      apiLoaded = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        apiReadyCallbacks.forEach((cb) => cb());
        apiReadyCallbacks.length = 0;
      };
    }
  });
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, playing, volume, onReady, onPlaying, onError, onProgress }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentVideoId = useRef(videoId);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      getCurrentTime: () => {
        try {
          return playerRef.current?.getCurrentTime?.() || 0;
        } catch {
          return 0;
        }
      },
      seekTo: (seconds: number) => {
        try {
          playerRef.current?.seekTo?.(seconds, true);
        } catch {}
      },
      play: () => {
        try {
          playerRef.current?.playVideo?.();
        } catch {}
      },
      pause: () => {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      },
      setVolume: (vol: number) => {
        try {
          playerRef.current?.setVolume?.(Math.round(vol * 100));
        } catch {}
      },
      unMute: () => {
        try {
          playerRef.current?.unMute?.();
        } catch {}
      },
    }));

    const startProgressTracking = useCallback(() => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      progressInterval.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          const seconds = playerRef.current.getCurrentTime() || 0;
          onProgress?.({ playedSeconds: seconds });
        }
      }, 250);
    }, [onProgress]);

    const stopProgressTracking = useCallback(() => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }, []);

    // Initialize player
    useEffect(() => {
      if (!containerRef.current) return;

      const divId = `yt-player-${Math.random().toString(36).slice(2)}`;
      const el = document.createElement('div');
      el.id = divId;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(el);

      let destroyed = false;

      ensureYTAPI().then(() => {
        if (destroyed || !containerRef.current) return;

        playerRef.current = new window.YT.Player(divId, {
          width: '320',
          height: '180',
          videoId: currentVideoId.current,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              event.target.setVolume(Math.round(volume * 100));
              if (playing) {
                event.target.playVideo();
              }
              onReady?.();
            },
            onStateChange: (event: any) => {
              // YT.PlayerState: PLAYING=1, PAUSED=2, BUFFERING=3, ENDED=0
              if (event.data === 1) {
                onPlaying?.();
                startProgressTracking();
              } else if (event.data === 2 || event.data === 0) {
                stopProgressTracking();
              }
            },
            onError: (event: any) => {
              onError?.({ code: event.data, message: `YouTube error code ${event.data}` });
            },
          },
        });
      });

      return () => {
        destroyed = true;
        stopProgressTracking();
        try {
          playerRef.current?.destroy?.();
        } catch {}
        playerRef.current = null;
      };
    }, []); // Mount once

    // Handle videoId changes
    useEffect(() => {
      if (videoId === currentVideoId.current) return;
      currentVideoId.current = videoId;
      try {
        if (playerRef.current?.loadVideoById) {
          playerRef.current.loadVideoById(videoId);
        }
      } catch {}
    }, [videoId]);

    // Handle play/pause changes
    useEffect(() => {
      try {
        if (playing) {
          playerRef.current?.playVideo?.();
        } else {
          playerRef.current?.pauseVideo?.();
        }
      } catch {}
    }, [playing]);

    // Handle volume changes
    useEffect(() => {
      try {
        playerRef.current?.setVolume?.(Math.round(volume * 100));
      } catch {}
    }, [volume]);

    return (
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          width: 320,
          height: 180,
          overflow: 'hidden',
          opacity: 0.01,
          pointerEvents: 'none',
        }}
      />
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;
