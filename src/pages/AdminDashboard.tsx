import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Music, 
  TrendingUp, 
  AlertTriangle, 
  Trash2, 
  RefreshCw,
  Radio,
  Heart,
  XCircle,
  Clock
} from 'lucide-react';

interface SongStats {
  total: number;
  active: number;
  immortal: number;
  removed: number;
  topRated: any[];
  atRisk: any[];
  recentRemovals: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SongStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'songs' | 'plays'>('overview');
  const [songs, setSongs] = useState<any[]>([]);
  const [plays, setPlays] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchSongs = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/songs');
      const data = await response.json();
      setSongs(data);
    } catch (err) {
      console.error('Failed to fetch songs:', err);
    }
  };

  const fetchPlays = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/plays?limit=50');
      const data = await response.json();
      setPlays(data);
    } catch (err) {
      console.error('Failed to fetch plays:', err);
    }
  };

  const handleDeleteSong = async (id: string) => {
    if (!confirm('Are you sure you want to remove this song?')) return;
    
    try {
      await fetch(`http://localhost:3001/api/admin/songs/${id}`, { method: 'DELETE' });
      fetchSongs();
      fetchStats();
    } catch (err) {
      console.error('Failed to delete song:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchSongs(), fetchPlays()]);
      setLoading(false);
    };
    
    loadData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
      fetchSongs();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-cyan-400 font-mono">LOADING_ADMIN_INTERFACE...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-black tracking-tighter mb-2">
            DNA<span className="text-cyan-400">RADIO</span> <span className="text-white/30">//</span> ADMIN
          </h1>
          <p className="text-white/50 font-mono text-sm tracking-widest">
            SYSTEM MONITORING & CONTROL INTERFACE
          </p>
        </motion.div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard 
              icon={<Music className="w-6 h-6" />}
              label="TOTAL SONGS"
              value={stats.total}
              color="cyan"
            />
            <StatCard 
              icon={<Radio className="w-6 h-6" />}
              label="ACTIVE"
              value={stats.active}
              color="green"
            />
            <StatCard 
              icon={<TrendingUp className="w-6 h-6" />}
              label="IMMORTAL"
              value={stats.immortal}
              color="yellow"
            />
            <StatCard 
              icon={<AlertTriangle className="w-6 h-6" />}
              label="AT RISK"
              value={stats.atRisk.length}
              color="red"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
          {[
            { id: 'overview', label: 'OVERVIEW' },
            { id: 'songs', label: 'SONGS' },
            { id: 'plays', label: 'PLAY HISTORY' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-mono text-sm tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && stats && (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Top Rated */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-green-400" />
                  TOP RATED
                </h3>
                <div className="space-y-2">
                  {stats.topRated.slice(0, 5).map((song, i) => (
                    <div key={song.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{song.title}</div>
                        <div className="text-xs text-white/50">{song.artist}</div>
                      </div>
                      <div className="text-green-400 font-mono font-bold">+{song.health}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* At Risk */}
              {stats.atRisk.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    AT RISK
                  </h3>
                  <div className="space-y-2">
                    {stats.atRisk.map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{song.title}</div>
                          <div className="text-xs text-white/50">{song.artist}</div>
                        </div>
                        <div className="text-red-400 font-mono font-bold">{song.health}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Removals */}
              {stats.recentRemovals.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:col-span-2">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    RECENT REMOVALS
                  </h3>
                  <div className="space-y-2">
                    {stats.recentRemovals.map((song) => (
                      <div key={song.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg opacity-60">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate line-through">{song.title}</div>
                          <div className="text-xs text-white/50">{song.artist}</div>
                        </div>
                        <div className="text-red-400 font-mono text-sm">REMOVED</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'songs' && (
            <motion.div
              key="songs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold">ALL SONGS ({songs.length})</h3>
                  <button
                    onClick={fetchSongs}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {songs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-medium truncate">{song.title}</div>
                        <div className="text-sm text-white/50">{song.artist}</div>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            song.status === 'immortal' ? 'bg-yellow-500/20 text-yellow-400' :
                            song.status === 'removed' ? 'bg-red-500/20 text-red-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {song.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-white/30">
                            Plays: {song.totalPlays || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`font-mono font-bold text-lg ${
                          song.health >= 5 ? 'text-green-400' :
                          song.health <= -5 ? 'text-red-400' :
                          'text-white'
                        }`}>
                          {song.health >= 0 ? '+' : ''}{song.health}
                        </div>
                        {song.status !== 'removed' && (
                          <button
                            onClick={() => handleDeleteSong(song.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'plays' && (
            <motion.div
              key="plays"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-bold">RECENT PLAYS</h3>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {plays.map((play) => (
                    <div key={play.id} className="flex items-center justify-between p-4 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                          <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <div className="font-medium">{play.songId}</div>
                          <div className="text-xs text-white/50">
                            {new Date(play.playedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-green-400">
                          <Heart className="w-4 h-4" />
                          <span className="font-mono">{play.acceptsThisPlay}</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="font-mono">{play.rejectsThisPlay}</span>
                        </div>
                        <div className="font-mono text-sm text-white/50">
                          {play.listenerCount} listeners
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  const colors = {
    cyan: 'text-cyan-400 border-cyan-500/30',
    green: 'text-green-400 border-green-500/30',
    yellow: 'text-yellow-400 border-yellow-500/30',
    red: 'text-red-400 border-red-500/30'
  };
  const colorKey = (color in colors ? color : 'cyan') as keyof typeof colors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border ${colors[colorKey].split(' ')[1]} rounded-2xl p-6`}
    >
      <div className={`flex items-center gap-3 ${colors[colorKey].split(' ')[0]} mb-2`}>
        {icon}
      </div>
      <div className="text-3xl font-black font-mono">{value}</div>
      <div className="text-xs text-white/50 font-mono tracking-widest mt-1">{label}</div>
    </motion.div>
  );
}
