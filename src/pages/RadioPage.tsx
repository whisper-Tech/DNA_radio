import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  Noise, 
  ChromaticAberration,
  Scanline,
  Vignette,
  Glitch
} from '@react-three/postprocessing';
import { BlendFunction, GlitchMode } from 'postprocessing';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, XCircle, Radio, Wifi, WifiOff, SkipForward, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import ReactPlayer from 'react-player';
import * as THREE from 'three';
import { DNAHelix } from '../components/DNAHelix';

// `react-player` types can conflict with duplicate React type packages in this workspace.
// Treat it as `any` to keep `tsc` green without affecting runtime behavior.
const ReactPlayerAny: any = ReactPlayer;
const EffectComposerAny: any = EffectComposer;

// Define Song interface locally
interface Song {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  duration: number;
  health: number;
  status?: string;
  totalPlays?: number;
  totalAccepts?: number;
  totalRejects?: number;
}

const formatTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Server time offset for precise sync
let serverTimeOffset = 0;

// Camera Rig for smooth movement and intro
const CameraRig = ({ isVortexing }: { isVortexing: boolean }) => {
  useFrame((state) => {
    if (isVortexing) {
      // Spinning vortex intro
      const t = state.clock.getElapsedTime();
      state.camera.position.lerp(new THREE.Vector3(Math.sin(t * 2) * 10, 5, Math.cos(t * 2) * 10), 0.05);
      state.camera.lookAt(0, 0, 0);
    } else {
      // Smooth follow
      state.camera.position.lerp(new THREE.Vector3(0, 5, 15), 0.02);
      state.camera.lookAt(0, 0, 0);
    }
  });
  return null;
};

const RadioPage: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [songStartTime, setSongStartTime] = useState<number>(Date.now());
  const [serverSongStartTime, setServerSongStartTime] = useState<number>(Date.now());
  const playerRef = useRef<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncDrift, setLastSyncDrift] = useState(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayToggleTime = useRef<number>(0);
  const PLAY_COOLDOWN_MS = 500;
  const [crossFadeOpacity, setCrossFadeOpacity] = useState(1);
  const [glitchIntensity, setGlitchIntensity] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [volume, setVolume] = useState(0.25);
  const [pendingSuggestions, setPendingSuggestions] = useState<any>(null);
  const [suggestionCountdown, setSuggestionCountdown] = useState(10);
  const [transitionDuration, setTransitionDuration] = useState(0.3);
  const [isVortexing, setIsVortexing] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [fxEnabled, setFxEnabled] = useState(false);

  // Get upcoming songs for queue
  const upcomingSongs = playlist.slice(currentIndex + 1, currentIndex + 6);
  
  // Filter songs based on search
  const filteredSongs = playlist.filter(song => 
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Precise time sync with server
  const syncWithServer = useCallback(() => {
    if (!socket) return;
    
    const clientSendTime = Date.now();
    socket.emit('ping', { clientTime: clientSendTime });
  }, [socket]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const text = e.dataTransfer.getData('text');
    console.log('[DROP] Data received:', text);

    // Basic YouTube URL regex
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = text.match(ytRegex);

    if (match && match[1]) {
      const videoId = match[1];
      console.log('[DROP] Detected YouTube ID:', videoId);
      
      try {
        const response = await fetch('/api/add-song', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: "New Drop",
            artist: "Unknown",
            youtubeId: videoId
          })
        });
        const data = await response.json();
        console.log('[DROP] Server response:', data);
        setGlitchIntensity(0.5);
        setTimeout(() => setGlitchIntensity(0), 300);
      } catch (err) {
        console.error('[DROP] Failed to add song:', err);
      }
    } else {
      console.log('[DROP] No valid YouTube URL found');
    }
  };

  useEffect(() => {
    // Vortex intro effect
    const vortexTimeout = setTimeout(() => setIsVortexing(false), 3000);
    return () => clearTimeout(vortexTimeout);
  }, []);

  useEffect(() => {
    const newSocket = io('/', {
      // Polling-only to avoid noisy WS-open/close warnings on some local setups.
      transports: ['polling'],
      upgrade: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[SYNC] Connected to DNA Radio Server');
      setIsConnected(true);
      setSocketError(null);
      
      // Initial time sync
      const clientSendTime = Date.now();
      newSocket.emit('ping', { clientTime: clientSendTime });
    });

    // Handle pong for time synchronization
    newSocket.on('pong', ({ clientTime, serverTime }: { clientTime: number; serverTime: number }) => {
      const clientReceiveTime = Date.now();
      const roundTripTime = clientReceiveTime - clientTime;
      const oneWayLatency = roundTripTime / 2;
      
      // Calculate server time offset
      serverTimeOffset = serverTime + oneWayLatency - clientReceiveTime;
      console.log(`[SYNC] RTT: ${roundTripTime}ms, Offset: ${serverTimeOffset}ms`);
    });

    newSocket.on('state_update', (state: any) => {
      console.log('[STATE] Received update:', {
        currentIndex: state.currentIndex,
        isPlaying: state.isPlaying,
        songStartTime: state.songStartTime
      });
      
      setPlaylist(state.playlist);
      setPendingSuggestions(state.pendingSuggestions);
      
      // Handle song change with cross-fade
      if (state.currentIndex !== currentIndex) {
        setTransitionDuration(0.3); // Reset to default for normal song changes
        setCrossFadeOpacity(0);
        setTimeout(() => {
          setCurrentIndex(state.currentIndex);
          setCrossFadeOpacity(1);
        }, 300);
      }
      
      // Stabilized playback state update to prevent rapid toggling
      const now = Date.now();
      if (state.isPlaying !== isPlaying && (now - lastPlayToggleTime.current) > PLAY_COOLDOWN_MS) {
        lastPlayToggleTime.current = now;
        setIsPlaying(state.isPlaying);
      } else if (state.isPlaying !== isPlaying) {
        // Queue a retry if we are in cooldown
        setTimeout(() => {
          setIsPlaying(state.isPlaying);
        }, PLAY_COOLDOWN_MS);
      }

      setServerSongStartTime(state.songStartTime);
      setSongStartTime(state.songStartTime);
    });

    // Handle immediate removal notification
    newSocket.on('song_removed', ({ songId, nextIndex, pendingSuggestions }: { songId: string; nextIndex: number; pendingSuggestions?: any }) => {
      console.log(`[REMOVAL] Song ${songId} removed, transitioning to index ${nextIndex}`);
      setTransitionDuration(5); // 5s fade out for interruptions
      setGlitchIntensity(1);
      setCrossFadeOpacity(0); // Trigger fade out
      
      if (pendingSuggestions) {
        setPendingSuggestions(pendingSuggestions);
      }
      
      setTimeout(() => setGlitchIntensity(0), 500);
    });

    newSocket.on('disconnect', () => {
      console.log('[SYNC] Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      // Expected briefly during startup/reload; keep logs quieter.
      console.warn('[SYNC] Connection retry:', (error as any)?.message || 'connect_error');
      setIsConnected(false);
      setSocketError((error as any)?.message || 'connect_error');
    });

    return () => { 
      newSocket.close(); 
    };
  }, []);

  // HTTP fallback: load state even if Socket.IO can't connect.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      if (isConnected) return;
      try {
        const r = await fetch('/api/sync');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const state = await r.json();
        setPlaylist(state.playlist || []);
        setCurrentIndex(state.currentIndex || 0);
        setIsPlaying(!!state.isPlaying);
        setServerSongStartTime(state.songStartTime || Date.now());
        setSongStartTime(state.songStartTime || Date.now());
        setPendingSuggestions(state.pendingSuggestions || null);
        console.log('[SYNC] Loaded state via HTTP fallback');
      } catch (err: any) {
        console.error('[SYNC] HTTP fallback failed:', err);
        setSocketError((prev) => prev || err?.message || 'http_fallback_failed');
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isConnected]);

  // Periodic time sync every 10 seconds
  useEffect(() => {
    if (!socket || !isConnected) return;

    const syncInterval = setInterval(() => {
      syncWithServer();
    }, 10000);

    return () => clearInterval(syncInterval);
  }, [socket, isConnected, syncWithServer]);

  // Precise playback synchronization with <100ms jitter target
  useEffect(() => {
    if (!isPlaying || !playerRef.current || !isConnected || !playerReady) return;

    const syncPlayback = () => {
      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      // Calculate expected position using server time offset
      const correctedServerTime = Date.now() + serverTimeOffset;
      const expectedPositionMs = correctedServerTime - serverSongStartTime;
      const expectedPositionSec = expectedPositionMs / 1000;
      
      const actualPositionSec = playerRef.current.getCurrentTime() || 0;
      const driftMs = (actualPositionSec * 1000) - expectedPositionMs;
      
      setLastSyncDrift(driftMs);

      // Sync threshold: 100ms for tight synchronization
      const SYNC_THRESHOLD_MS = 100;
      
      if (Math.abs(driftMs) > SYNC_THRESHOLD_MS) {
        console.log(`[SYNC] Drift detected: ${driftMs.toFixed(0)}ms, seeking to ${expectedPositionSec.toFixed(2)}s`);
        
        // Ensure we don't seek beyond song duration
        const currentSong = playlist[currentIndex];
        const maxPosition = (currentSong?.duration || 180000) / 1000;
        const targetPosition = Math.min(Math.max(0, expectedPositionSec), maxPosition);
        
        playerRef.current.seekTo(targetPosition, 'seconds');
        // setIsSyncing(true);
        setTimeout(() => setIsSyncing(false), 500);
      }
    };

    // Initial sync when song changes or playback starts
    const initialSyncTimeout = setTimeout(syncPlayback, 500);

    // Continuous sync check every 2 seconds
    syncIntervalRef.current = setInterval(syncPlayback, 2000);

    return () => {
      clearTimeout(initialSyncTimeout);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [currentIndex, isPlaying, serverSongStartTime, isConnected, playlist, playerReady]);

  // Suggestion countdown effect
  useEffect(() => {
    if (!pendingSuggestions) {
      setSuggestionCountdown(10);
      return;
    }

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pendingSuggestions.expiresAt - Date.now()) / 1000));
      setSuggestionCountdown(remaining);
      if (remaining === 0) setPendingSuggestions(null);
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingSuggestions]);

  // Update current time display
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying && isConnected) {
        const correctedServerTime = Date.now() + serverTimeOffset;
        const elapsed = correctedServerTime - serverSongStartTime;
        setCurrentTime(Math.max(0, elapsed));
      }
    }, 100); // Update every 100ms for smooth progress bar

    return () => clearInterval(interval);
  }, [isPlaying, serverSongStartTime, isConnected]);

  const currentSong = playlist[currentIndex];

  const handleVote = (type: 'accept' | 'reject') => {
    if (!socket || !currentSong) return;
    setAudioUnlocked(true);
    setPlayerError(null);
    socket.emit('vote', { songId: currentSong.id, type });
    
    // Visual feedback for reject vote
    if (type === 'reject') {
      setGlitchIntensity(0.3);
      setTimeout(() => setGlitchIntensity(0), 200);
    }
  };

  const handleSelectSuggestion = (index: number) => {
    if (!socket) return;
    socket.emit('select_suggestion', { index });
    setPendingSuggestions(null);
  };

  // Handle player ready
  const handlePlayerReady = () => {
    setPlayerReady(true);
    if (!playerRef.current || !isPlaying) return;
    
    // Sync immediately when player is ready
    const correctedServerTime = Date.now() + serverTimeOffset;
    const expectedPositionSec = (correctedServerTime - serverSongStartTime) / 1000;
    
    if (expectedPositionSec > 0) {
      playerRef.current.seekTo(expectedPositionSec, 'seconds');
    }
  };

  if (!currentSong) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-white font-mono">
        <div className="flex flex-col items-center gap-4">
          <Radio className="w-16 h-16 text-cyan-500 animate-pulse" />
          <div className="text-cyan-500 text-lg tracking-widest">INITIATING FREQUENCY SCAN...</div>
          <div className="text-cyan-500/50 text-xs">Establishing quantum link to broadcast server</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full bg-[#030303] overflow-hidden transition-colors duration-500 ${isDragging ? 'bg-[#0a1a1f]' : ''}`}
      style={{height: '100vh'}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={() => {
        if (!audioUnlocked) {
          setAudioUnlocked(true);
          setPlayerError(null);
        }
      }}
    >
      {/* Drag Over Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-cyan-500/10 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex flex-col items-center gap-6 p-12 rounded-[3rem] border-2 border-dashed border-cyan-400/50 bg-black/40">
              <div className="p-8 rounded-full bg-cyan-500/20 animate-bounce">
                <SkipForward className="w-16 h-16 text-cyan-400 rotate-90" />
              </div>
              <div className="text-3xl font-black italic text-cyan-400 tracking-tighter uppercase">
                Release to Inject Sequence
              </div>
              <div className="text-cyan-500/50 font-mono text-sm tracking-[0.3em]">
                YouTube URL Detected
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Audio Player with improved sync */}
      {/* Use offscreen/0-size instead of display:none; some embeds won't play when hidden. */}
      <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
        {currentSong.youtubeId && (
          <ReactPlayerAny
            ref={playerRef}
            playing={isPlaying && audioUnlocked}
            volume={volume}
            onReady={handlePlayerReady}
            onError={(e: any) => {
              console.error('[PLAYER] Error:', e);
              const msg = (e && (e.name || e.message)) ? String(e.name || e.message) : 'player_error';
              if (msg.toLowerCase().includes('notallowed')) {
                setPlayerError('autoplay_blocked_click_play');
              } else {
                setPlayerError(msg);
              }
            }}
            onProgress={(e: any) => {
              const { playedSeconds } = e;
              // Only update if not syncing to avoid jumps
              if (!isSyncing) {
                setCurrentTime(playedSeconds * 1000);
              }
            }}
            config={{
              youtube: {
                playerVars: {
                  disablekb: 1,
                  modestbranding: 1,
                  rel: 0,
                }
              }
            } as any}
            url={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
          />
        )}
      </div>

      {/* 3D Canvas with Cyberpunk Post-Processing */}
      <Canvas 
        camera={{ position: [0, 50, 50], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 15, 50]} />
        
        <Suspense fallback={null}>
          <CameraRig isVortexing={isVortexing} />
          
          {/* Ambient and directional lighting */}
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 5]} intensity={0.5} color="#06b6d4" />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} color="#a855f7" />
          <pointLight position={[0, 0, 0]} intensity={1} color="#22d3ee" distance={20} />
          
          <DNAHelix 
            playlist={playlist} 
            currentIndex={currentIndex} 
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
          
          <Stars 
            radius={100} 
            depth={50} 
            count={fxEnabled ? 4000 : 1400}
            factor={fxEnabled ? 3 : 2}
            saturation={0.5} 
            fade 
            speed={fxEnabled ? 1.2 : 0.5}
          />
          
          {/* Cyberpunk Post-Processing Stack */}
          {fxEnabled ? (
            <EffectComposerAny disableNormalPass>
              <Bloom 
                luminanceThreshold={0.1} 
                mipmapBlur 
                intensity={1.2} 
                radius={0.35}
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={new THREE.Vector2(0.0012, 0.0012)}
                radialModulation={false}
                modulationOffset={0.5}
              />
              <Scanline
                blendFunction={BlendFunction.OVERLAY}
                density={1.1}
                opacity={0.04}
              />
              <Noise 
                opacity={0.04}
                blendFunction={BlendFunction.SOFT_LIGHT}
              />
              <Vignette
                offset={0.5}
                darkness={0.5}
              />
              {glitchIntensity > 0 ? (
                <Glitch
                  delay={new THREE.Vector2(0, 0)}
                  duration={new THREE.Vector2(0.1, 0.25)}
                  strength={new THREE.Vector2(0.08 * glitchIntensity, 0.14 * glitchIntensity)}
                  mode={GlitchMode.SPORADIC}
                  active={true}
                  ratio={0.85}
                />
              ) : null}
            </EffectComposerAny>
          ) : null}
        </Suspense>
        
        <OrbitControls 
          enablePan={false} 
          autoRotate={fxEnabled}
          autoRotateSpeed={0.2}
          minDistance={10}
          maxDistance={30}
          enableDamping={false}
          dampingFactor={0.03}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
        {/* Header */}
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Logo / Title */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-black/60 backdrop-blur-2xl border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
                  <div className="absolute inset-0 w-8 h-8 text-cyan-400 blur-sm opacity-50">
                    <Radio className="w-8 h-8" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase leading-none">
                    DNA<span className="text-cyan-400">RADIO</span>
                  </h1>
                  <p className="text-[9px] text-cyan-500/50 font-mono tracking-[0.3em] uppercase mt-1">
                    Quantum Frequency v2.4 // Global Node SYNC
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Status Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative bg-black/40 backdrop-blur-3xl border border-white/5 p-6 rounded-2xl text-right min-w-[200px]"
          >
            <div className="flex items-center justify-end gap-3 mb-3">
              <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest">
                Network Stream
              </div>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'} animate-pulse`} />
            </div>
            
            <div className="space-y-1">
              <p className={`text-lg font-mono font-bold tracking-tighter ${isConnected ? 'text-white' : 'text-red-500'}`}>
                {isConnected ? 'LIVE_BROADCAST' : 'LINK_ERROR'}
              </p>
              {(socketError || playerError) && (
                <div className="text-[10px] font-mono tracking-widest text-red-400/70">
                  {socketError ? `NET:${socketError}` : `AUDIO:${playerError}`}
                </div>
              )}
              {!audioUnlocked && (
                <div className="text-[10px] font-mono tracking-widest text-yellow-400/70">
                  AUDIO_LOCKED_CLICK_ENABLE_AUDIO
                </div>
              )}
              {isConnected && (
                <div className="flex flex-col gap-0.5 opacity-40">
                  <div className="text-[10px] font-mono text-cyan-400">DRIFT: {lastSyncDrift.toFixed(0)}MS</div>
                  <div className="text-[10px] font-mono text-purple-400">NODE: {socket?.id?.substring(0, 8).toUpperCase()}</div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Main Player Controls */}
        <div className="flex flex-col items-center pointer-events-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSong.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: crossFadeOpacity, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              transition={{ duration: transitionDuration, ease: [0.23, 1, 0.32, 1] }}
              className="relative group w-full max-w-2xl"
            >
              <div className="absolute -inset-1 bg-gradient-to-b from-cyan-500/20 to-purple-500/20 rounded-[2.5rem] blur-2xl opacity-50"></div>
              
              <div className="relative bg-black/60 backdrop-blur-3xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Radio className="w-24 h-24 text-white rotate-12" />
                </div>

                {/* Song Info */}
                <div className="flex justify-between items-start mb-10 relative z-10">
                  <div className="flex-1">
                    <motion.h2 
                      animate={isSyncing ? { opacity: [1, 0.5, 1] } : {}}
                      className="text-4xl font-black text-white tracking-tighter mb-2 uppercase leading-none"
                    >
                      {currentSong.title}
                    </motion.h2>
                    <p className="text-cyan-400 font-mono text-lg tracking-widest opacity-80">
                      {currentSong.artist}
                    </p>
                    {currentSong.status === 'immortal' && (
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                        <span className="text-yellow-400 text-[10px] font-black uppercase tracking-[0.2em]">
                          IMMORTAL_STATUS_LOCKED
                        </span>
                      </motion.div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-black font-mono tracking-tighter leading-none ${
                      currentSong.health >= 5 
                        ? 'text-green-400' 
                        : currentSong.health <= -5 
                          ? 'text-red-400' 
                          : 'text-white'
                    }`}>
                      {currentSong.health >= 0 ? '+' : ''}{currentSong.health}
                    </div>
                    <div className="text-[9px] text-white/30 uppercase tracking-[0.3em] mt-2 font-mono">
                      SEQ_HEALTH
                    </div>
                  </div>
                </div>

                {/* Vote Buttons */}
                <div className="flex items-center justify-center gap-12 mb-10">
                  <motion.button 
                    onClick={() => handleVote('reject')} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group flex flex-col items-center gap-3"
                  >
                    <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-300/20 group-hover:bg-cyan-300/15 group-hover:border-cyan-300/50 transition-all duration-500">
                      <Heart className="w-8 h-8 text-cyan-300/70 group-hover:text-cyan-200" />
                    </div>
                    <span className="text-[9px] text-cyan-300/40 font-mono font-bold uppercase tracking-[0.3em] group-hover:text-cyan-200 transition-colors">
                      Hate
                    </span>
                  </motion.button>

                  <motion.button 
                    onClick={() => handleVote('accept')} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="group flex flex-col items-center gap-3"
                  >
                    <div className="p-6 rounded-2xl bg-black/70 border border-pink-400/40 group-hover:bg-pink-500/10 group-hover:border-pink-300/70 transition-all duration-500">
                      <Heart className="w-8 h-8 text-pink-400 group-hover:text-pink-300" />
                    </div>
                    <span className="text-[9px] text-pink-400/50 font-mono font-bold uppercase tracking-[0.3em] group-hover:text-pink-300 transition-colors">
                      Love
                    </span>
                  </motion.button>
                </div>

                {/* Volume */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="font-mono text-[9px] text-white/30 tracking-[0.3em] uppercase">
                    VOL
                  </div>
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(volume * 100)}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value)));
                      setVolume(v / 100);
                    }}
                    className="w-56 accent-cyan-400"
                  />
                  <div className="font-mono text-[10px] text-cyan-400/70 tabular-nums w-12 text-right">
                    {Math.round(volume * 100)}%
                  </div>
                </div>

                {/* Progress & Meta */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setFxEnabled((v) => !v)}
                      className="px-3 py-1 rounded-lg border border-white/20 text-[9px] font-mono tracking-widest text-white/70 hover:bg-white/10"
                    >
                      {fxEnabled ? 'FX_HIGH' : 'FX_LOW'}
                    </button>
                    {!audioUnlocked && (
                      <button
                        onClick={() => {
                          setAudioUnlocked(true);
                          setPlayerError(null);
                        }}
                        className="px-3 py-1 rounded-lg border border-cyan-500/30 text-[9px] font-mono tracking-widest text-cyan-300/80 hover:bg-cyan-500/10"
                      >
                        ENABLE_AUDIO
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="font-mono text-[10px] text-cyan-400/60 tracking-widest uppercase">
                      Stream_Position: {formatTime(currentTime)}
                    </div>
                    <div className="font-mono text-[10px] text-white/20 tracking-widest uppercase">
                      Queue: {currentIndex + 1} / {playlist.length}
                    </div>
                  </div>
                  
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 relative" 
                      initial={{ width: "0%" }} 
                      animate={{ 
                        width: `${Math.min(100, (currentTime / (currentSong.duration || 180000)) * 100)}%` 
                      }}
                      transition={{ duration: 0.1 }}
                    >
                      <div className="absolute top-0 right-0 h-full w-20 bg-white/20 blur-md" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex justify-center">
          <div className="text-[10px] font-mono text-white/20 tracking-widest">
            DNA RADIO v2.0 // COLLECTIVE CONSCIOUSNESS PROTOCOL
          </div>
        </div>
      </div>

      {/* Queue Panel */}
      <AnimatePresence>
        {showQueue && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-24 right-8 w-80 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-cyan-400">UPCOMING</h3>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4 text-white/50" />
              </button>
            </div>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search playlist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchQuery ? (
                // Search results
                filteredSongs.slice(0, 10).map((song, i) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="text-xs text-white/30 font-mono w-6">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{song.title}</div>
                      <div className="text-xs text-white/50 truncate">{song.artist}</div>
                    </div>
                    <div className={`font-mono text-xs ${
                      song.health >= 5 ? 'text-green-400' :
                      song.health <= -5 ? 'text-red-400' :
                      'text-white/50'
                    }`}>
                      {song.health >= 0 ? '+' : ''}{song.health}
                    </div>
                  </div>
                ))
              ) : (
                // Upcoming queue
                upcomingSongs.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5"
                  >
                    <div className="text-xs text-cyan-400 font-mono w-6">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{song.title}</div>
                      <div className="text-xs text-white/50 truncate">{song.artist}</div>
                    </div>
                    <div className={`font-mono text-xs ${
                      song.health >= 5 ? 'text-green-400' :
                      song.health <= -5 ? 'text-red-400' :
                      'text-white/50'
                    }`}>
                      {song.health >= 0 ? '+' : ''}{song.health}
                    </div>
                  </motion.div>
                ))
              )}
              
              {searchQuery && filteredSongs.length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">
                  No songs found
                </div>
              )}
              
              {!searchQuery && upcomingSongs.length === 0 && (
                <div className="text-center py-8 text-white/30 text-sm">
                  Queue is empty
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-between text-xs text-white/30 font-mono">
                <span>TOTAL: {playlist.length}</span>
                <span>ACTIVE: {playlist.filter(s => s.status === 'active').length}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue Toggle Button */}
      <button
        onClick={() => setShowQueue(!showQueue)}
        className="absolute top-8 right-8 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all pointer-events-auto group"
      >
        {showQueue ? (
          <ChevronDown className="w-5 h-5 text-white/50 group-hover:text-white" />
        ) : (
          <ChevronUp className="w-5 h-5 text-white/50 group-hover:text-white" />
        )}
      </button>

      {/* Sync indicator overlay */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            <div className="px-6 py-3 bg-cyan-500/20 border border-cyan-500/40 rounded-full backdrop-blur-md">
              <span className="text-cyan-400 font-mono text-sm animate-pulse">
                SYNCHRONIZING...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Suggestion Overlay */}
      <AnimatePresence>
        {pendingSuggestions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl pointer-events-auto"
          >
            <div className="flex flex-col items-center max-w-4xl w-full p-12">
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-12"
              >
                <div className="inline-block px-4 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs font-mono tracking-[0.3em] uppercase mb-4">
                  Sequence Interrupted
                </div>
                <h2 className="text-4xl font-bold text-white tracking-tighter mb-2 uppercase">
                  Select Next Frequency
                </h2>
                <p className="text-cyan-500/60 font-mono text-sm tracking-widest uppercase">
                  {pendingSuggestions.voterId === socket?.id 
                    ? "COMMUNITY HAS CHOSEN YOU TO REDIRECT THE FLOW" 
                    : "AWAITING CO-ORDINATOR SELECTION..."}
                </p>
                <div className="mt-6 flex items-center justify-center gap-4">
                  <div className="h-[1px] w-24 bg-gradient-to-r from-transparent to-cyan-500/50" />
                  <div className="text-3xl font-mono text-cyan-400 font-bold w-12 text-center">
                    {suggestionCountdown}
                  </div>
                  <div className="h-[1px] w-24 bg-gradient-to-l from-transparent to-cyan-500/50" />
                </div>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {pendingSuggestions.suggestions.map((suggestion: any, index: number) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(6, 182, 212, 0.15)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectSuggestion(index)}
                    disabled={pendingSuggestions.voterId !== socket?.id}
                    className={`flex items-center gap-6 p-6 rounded-2xl border transition-all duration-300 text-left ${
                      pendingSuggestions.voterId === socket?.id
                        ? 'bg-white/5 border-white/10 hover:border-cyan-500/50 cursor-pointer'
                        : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono font-bold text-lg">
                      0{index + 1}
                    </div>
                    <div>
                      <div className="text-white font-bold text-lg mb-1 leading-tight">{suggestion.title}</div>
                      <div className="text-cyan-500/60 text-sm font-mono tracking-wider">{suggestion.artist}</div>
                    </div>
                  </motion.button>
                ))}
              </div>

              {pendingSuggestions.voterId !== socket?.id && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-12 text-white/20 text-[10px] font-mono tracking-[0.5em] uppercase"
                >
                  Synchronizing Collective Vibe...
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadioPage;
