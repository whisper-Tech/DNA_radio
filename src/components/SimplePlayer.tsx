import React from 'react';

interface SimplePlayerProps {
  url: string;
  playing: boolean;
  onProgress?: (progress: { played: number }) => void;
  onEnded?: () => void;
}

export default function SimplePlayer({ url, playing, onProgress, onEnded }: SimplePlayerProps) {
  // For now, just return a placeholder div
  // In production, this would be replaced with actual video player
  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="mb-4">📻</div>
        <p>Video Player Placeholder</p>
        <p className="text-sm text-gray-400">URL: {url}</p>
        <p className="text-sm text-gray-400">Playing: {playing ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
}
