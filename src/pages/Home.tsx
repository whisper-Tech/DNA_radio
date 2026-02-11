import React from 'react';
import { useLocation } from 'wouter';

const Home: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center p-4">
      {/* Static Stars (CSS only, no JS calculation) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full opacity-50"></div>
        <div className="absolute top-3/4 left-1/3 w-2 h-2 bg-white rounded-full opacity-30"></div>
        <div className="absolute top-1/2 left-2/3 w-1 h-1 bg-white rounded-full opacity-70"></div>
        <div className="absolute top-10 left-10 w-3 h-3 bg-cyan-500 rounded-full blur-[2px]"></div>
      </div>

      <div className="z-10 text-center space-y-8">
        <h1 className="text-4xl text-cyan-400 font-mono tracking-widest border-b border-cyan-500/30 pb-4">
          THE FREQUENCY
        </h1>
        
        <p className="text-gray-400 max-w-md mx-auto">
          Secure independent broadcast detected. 
          Initialize connection sequence below.
        </p>

        <button 
          onClick={() => setLocation('/secret')}
          className="px-8 py-4 bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold tracking-widest transition-all rounded"
        >
          ENTER BROADCAST
        </button>
      </div>
    </div>
  );
};

export default Home;