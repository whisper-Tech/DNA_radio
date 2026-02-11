import React, { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
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
import { DNAHelix } from '@/components/DNAHelix';
import { Song } from '@/components/DNAHelix/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, XCircle, Play, Pause, Radio, Wifi, WifiOff, SkipForward } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import ReactPlayer from 'react-player';
import * as THREE from 'three';

const formatTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Server time offset for precise sync
let serverTimeOffset = 0;

const RadioPage: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [songStartTime, setSongStartTime] = useState<number>(Date.now());
  const [serverSongStartTime, setServerSongStartTime] = useState<number>(Date.now());
  const playerRef = useRef<ReactPlayer>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncDrift, setLastSyncDrift] = useState(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [crossFadeOpacity, setCrossFadeOpacity] = useState(1);
  const [glitchIntensity, setGlitchIntensity] = useState(0);

  // Precise time sync with server
  const syncWithServer = useCallback(() => {
    if (!socket) return;
    
    const clientSendTime = Date.now();
    socket.emit('ping', { clientTime: clientSendTime });
  }, [socket]);

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket'],
      upgrade: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[SYNC] Connected to DNA Radio Server');
      setIsConnected(true);
      
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
      
      // Handle song change with cross-fade
      if (state.currentIndex !== currentIndex) {
        setCrossFadeOpacity(0);
        setTimeout(() => {
          setCurrentIndex(state.currentIndex);
          setCrossFadeOpacity(1);
        }, 300);
      }
      
      setIsPlaying(state.isPlaying);
      setServerSongStartTime(state.songStartTime);
      setSongStartTime(state.songStartTime);
      
      // Trigger immediate sync on state update
      setIsSyncing(true);
    });

    // Handle immediate removal notification
    newSocket.on('song_removed', ({ songId, nextIndex }: { songId: string; nextIndex: number }) => {
      console.log(`[REMOVAL] Song ${songId} removed, transitioning to index ${nextIndex}`);
      setGlitchIntensity(1);
      setTimeout(() => setGlitchIntensity(0), 500);
    });

    newSocket.on('disconnect', () => {
      console.log('[SYNC] Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[SYNC] Connection error:', error);
      setIsConnected(false);
    });

    return () => { 
      newSocket.close(); 
    };
  }, []);

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
    if (!isPlaying || !playerRef.current || !isConnected) return;

    const syncPlayback = () => {
      if (!playerRef.current) return;

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
        setIsSyncing(true);
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
  }, [currentIndex, isPlaying, serverSongStartTime, isConnected, playlist]);

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
    socket.emit('vote', { songId: currentSong.id, type });
    
    // Visual feedback for reject vote
    if (type === 'reject') {
      setGlitchIntensity(0.3);
      setTimeout(() => setGlitchIntensity(0), 200);
    }
  };

  // Handle player ready
  const handlePlayerReady = () => {
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
    <div className="relative w-full h-full bg-[#030303] overflow-hidden">
      {/* Hidden Audio Player with improved sync */}
      <div className="hidden">
        {currentSong.youtubeId && (
          <ReactPlayer
            ref={playerRef}
            url={`https://www.youtube.com/watch?v=${currentSong.youtubeId}`}
            playing={isPlaying}
            volume={0.5}
            onReady={handlePlayerReady}
            onBuffer={() => setIsSyncing(true)}
            onBufferEnd={() => setIsSyncing(false)}
            onProgress={({ playedSeconds }) => {
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
            }}
          />
        )}
      </div>

      {/* 3D Canvas with Cyberpunk Post-Processing */}
      <Canvas 
        camera={{ position: [0, 5, 15], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 15, 50]} />
        
        <Suspense fallback={null}>
          {/* Ambient and directional lighting */}
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 5]} intensity={0.5} color="#06b6d4" />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} color="#a855f7" />
          <pointLight position={[0, 0, 0]} intensity={1} color="#22d3ee" distance={20} />
          
          <DNAHelix playlist={playlist} currentIndex={currentIndex} />
          
          <Stars 
            radius={100} 
            depth={50} 
            count={7000} 
            factor={4} 
            saturation={0.5} 
            fade 
            speed={1.5} 
          />
          
          {/* Cyberpunk Post-Processing Stack */}
          <EffectComposer>
            {/* Primary bloom for glow effects */}
            <Bloom 
              luminanceThreshold={0.15} 
              mipmapBlur 
              intensity={2.0} 
              radius={0.8}
              levels={8}
            />
            
            {/* Chromatic Aberration for that cyberpunk edge */}
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={new THREE.Vector2(0.002, 0.002)}
              radialModulation={true}
              modulationOffset={0.5}
            />
            
            {/* Scanlines for retro-futuristic feel */}
            <Scanline
              blendFunction={BlendFunction.OVERLAY}
              density={1.5}
              opacity={0.08}
            />
            
            {/* Film grain / noise for texture */}
            <Noise 
              opacity={0.15}
              blendFunction={BlendFunction.OVERLAY}
            />
            
            {/* Vignette for focus */}
            <Vignette
              offset={0.3}
              darkness={0.7}
              blendFunction={BlendFunction.NORMAL}
            />
            
            {/* Dynamic glitch effect triggered by events */}
            {glitchIntensity > 0 && (
              <Glitch
                delay={new THREE.Vector2(0, 0)}
                duration={new THREE.Vector2(0.1, 0.3)}
                strength={new THREE.Vector2(0.1 * glitchIntensity, 0.2 * glitchIntensity)}
                mode={GlitchMode.SPORADIC}
                active={true}
                ratio={0.85}
              />
            )}
          </EffectComposer>
        </Suspense>
        
        <OrbitControls 
          enablePan={false} 
          autoRotate 
          autoRotateSpeed={0.3}
          minDistance={10}
          maxDistance={30}
          enableDamping
          dampingFactor={0.05}
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
            className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)]"
          >
            <div className="flex items-center gap-3">
              <Radio className="w-8 h-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 uppercase">
                  The Frequency
                </h1>
                <p className="text-[10px] text-cyan-500/70 font-mono tracking-widest">
                  ZERO-CONFIG BROADCAST // QUANTUM SYNC ENABLED
                </p>
              </div>
            </div>
          </motion.div>

          {/* Status Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-black/60 backdrop-blur-xl border border-purple-500/30 p-5 rounded-2xl text-right shadow-[0_0_30px_rgba(168,85,247,0.2)]"
          >
            <div className="flex items-center justify-end gap-2 mb-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <p className="text-xs text-purple-400 font-mono uppercase tracking-widest">
                Global Status
              </p>
            </div>
            <p className={`text-sm font-bold uppercase ${isConnected ? 'text-green-400' : 'text-red-500'}`}>
              {isConnected ? 'Sync Active' : 'Offline'}
            </p>
            {isConnected && (
              <div className="mt-2 text-[10px] font-mono text-purple-400/60">
                <div>Drift: {lastSyncDrift.toFixed(0)}ms</div>
                <div>Offset: {serverTimeOffset.toFixed(0)}ms</div>
              </div>
            )}
            {isSyncing && (
              <div className="mt-2 text-[10px] font-mono text-yellow-400 animate-pulse">
                SYNCING...
              </div>
            )}
          </motion.div>
        </div>

        {/* Main Player Controls */}
        <div className="flex flex-col items-center pointer-events-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSong.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: crossFadeOpacity, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-black/80 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl w-full max-w-xl shadow-[0_0_100px_rgba(0,255,255,0.1)]"
            >
              {/* Song Info */}
              <div className="flex justify-between items-start mb-8">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
                    {currentSong.title}
                  </h2>
                  <p className="text-cyan-500/70 font-medium text-lg">
                    {currentSong.artist}
                  </p>
                  {currentSong.status === 'immortal' && (
                    <span className="inline-block mt-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-400 text-xs font-bold uppercase tracking-wider">
                      ★ Immortal
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-mono font-bold ${
                    currentSong.health >= 5 
                      ? 'text-green-400' 
                      : currentSong.health <= -5 
                        ? 'text-red-400' 
                        : 'text-white'
                  }`}>
                    {currentSong.health >= 0 ? '+' : ''}{currentSong.health}
                  </div>
                  <div className="text-[10px] text-white/40 uppercase tracking-widest">
                    Sequence Health
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-16">
                {/* Reject Button */}
                <motion.button 
                  onClick={() => handleVote('reject')} 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="group flex flex-col items-center gap-3"
                >
                  <div className="p-5 rounded-full bg-red-500/10 border-2 border-red-500/30 group-hover:bg-red-500/30 group-hover:border-red-500/60 transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.2)] group-hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                    <XCircle className="w-10 h-10 text-red-500" />
                  </div>
                  <span className="text-[10px] text-red-500/60 font-bold uppercase tracking-widest group-hover:text-red-500">
                    Reject
                  </span>
                </motion.button>

                {/* Play/Pause Button */}
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 text-black hover:from-cyan-300 hover:to-cyan-500 transition-all duration-300 shadow-[0_0_50px_rgba(6,182,212,0.5)] hover:shadow-[0_0_70px_rgba(6,182,212,0.7)]"
                >
                  {isPlaying ? (
                    <Pause className="w-10 h-10 fill-black" />
                  ) : (
                    <Play className="w-10 h-10 fill-black ml-1" />
                  )}
                </motion.button>

                {/* Accept Button */}
                <motion.button 
                  onClick={() => handleVote('accept')} 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="group flex flex-col items-center gap-3"
                >
                  <div className="p-5 rounded-full bg-green-500/10 border-2 border-green-500/30 group-hover:bg-green-500/30 group-hover:border-green-500/60 transition-all duration-300 shadow-[0_0_20px_rgba(34,197,94,0.2)] group-hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                    <Heart className="w-10 h-10 text-green-500" />
                  </div>
                  <span className="text-[10px] text-green-500/60 font-bold uppercase tracking-widest group-hover:text-green-500">
                    Accept
                  </span>
                </motion.button>
              </div>

              {/* Progress Bar */}
              <div className="mt-10">
                <div className="flex justify-between text-xs font-mono text-cyan-500/60 mb-3">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-white/30">
                    {playlist.length > 0 && `${currentIndex + 1} / ${playlist.length}`}
                  </span>
                  <span>{formatTime(currentSong.duration || 180000)}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_15px_rgba(34,211,238,0.8)]" 
                    initial={{ width: "0%" }} 
                    animate={{ 
                      width: `${Math.min(100, (currentTime / (currentSong.duration || 180000)) * 100)}%` 
                    }}
                    transition={{ duration: 0.1 }}
                  />
                  {/* Glow effect */}
                  <div 
                    className="absolute top-0 h-full w-4 bg-white/50 blur-sm"
                    style={{
                      left: `${Math.min(100, (currentTime / (currentSong.duration || 180000)) * 100)}%`,
                      transform: 'translateX(-50%)'
                    }}
                  />
                </div>
              </div>

              {/* Health Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-[10px] font-mono text-white/30 mb-2">
                  <span>-10 REMOVED</span>
                  <span>HEALTH</span>
                  <span>+10 IMMORTAL</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                  {/* Center marker */}
                  <div className="absolute left-1/2 top-0 w-0.5 h-full bg-white/20 transform -translate-x-1/2" />
                  {/* Health indicator */}
                  <motion.div 
                    className={`absolute top-0 h-full rounded-full ${
                      currentSong.health >= 0 
                        ? 'bg-gradient-to-r from-green-500 to-green-400' 
                        : 'bg-gradient-to-l from-red-500 to-red-400'
                    }`}
                    style={{
                      left: currentSong.health >= 0 ? '50%' : `${50 + (currentSong.health / 10) * 50}%`,
                      width: `${Math.abs(currentSong.health) * 5}%`
                    }}
                    animate={{
                      opacity: [0.8, 1, 0.8]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity
                    }}
                  />
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
    </div>
  );
};

export default RadioPage;
