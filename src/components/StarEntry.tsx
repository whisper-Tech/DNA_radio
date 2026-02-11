import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StarEntryProps {
  onAccessGranted: () => void;
}

export const StarEntry: React.FC<StarEntryProps> = ({ onAccessGranted }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sequenceStep, setSequenceStep] = useState<'idle' | 'welcome' | 'to-secret' | 'entering'>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const HOLD_DURATION = 2000;

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (sequenceStep !== 'idle') return;
    setIsHolding(true);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(newProgress);

      if (elapsed >= HOLD_DURATION) {
        clearInterval(timerRef.current!);
        triggerSequence();
      }
    }, 10);
  };

  const triggerSequence = async () => {
    setIsHolding(false);
    setSequenceStep('welcome');
    
    // welcome
    await new Promise(r => setTimeout(r, 2500));
    setSequenceStep('to-secret');
    
    // to The Secret
    await new Promise(r => setTimeout(r, 2500));
    setSequenceStep('entering');
    
    // Wait for final effect then grant access
    await new Promise(r => setTimeout(r, 1500));
    onAccessGranted();
  };

  const stopHold = () => {
    if (sequenceStep !== 'idle') return;
    setIsHolding(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden cursor-none">
      <AnimatePresence>
        {sequenceStep === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 2 }}
            className="flex items-center justify-center"
          >
            {[...Array(100)].map((_, i) => (
              <div
                key={i}
                className="absolute bg-white rounded-full opacity-30"
                style={{
                  width: Math.random() * 2 + 'px',
                  height: Math.random() * 2 + 'px',
                  top: Math.random() * 100 + '%',
                  left: Math.random() * 100 + '%',
                }}
              />
            ))}

            <motion.div
              onMouseDown={startHold}
              onTouchStart={startHold}
              onMouseUp={stopHold}
              onTouchEnd={stopHold}
              onMouseLeave={stopHold}
              animate={{
                scale: isHolding ? 1.5 + progress * 2 : 1,
                boxShadow: isHolding 
                  ? `0 0 ${progress * 100}px ${progress * 50}px rgba(0, 255, 204, 0.8)` 
                  : "0 0 20px 2px rgba(255, 255, 255, 0.5)"
              }}
              className="relative w-4 h-4 bg-white rounded-full cursor-pointer z-50"
            >
              {isHolding && (
                <svg className="absolute -inset-8 w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="38"
                    stroke="rgba(0, 255, 204, 0.3)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="38"
                    stroke="#00ffcc"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="238.76"
                    initial={{ strokeDashoffset: 238.76 }}
                    animate={{ strokeDashoffset: 238.76 - (238.76 * progress) }}
                  />
                </svg>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {sequenceStep === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-4xl font-mono tracking-[1em] text-white lowercase"
          >
            welcome
          </motion.div>
        )}
        {sequenceStep === 'to-secret' && (
          <motion.div
            key="to-secret"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-4xl font-mono tracking-[0.5em] text-white lowercase"
          >
            to The Secret
          </motion.div>
        )}
        {sequenceStep === 'entering' && (
          <motion.div
            key="entering"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            className="text-2xl font-mono tracking-[0.3em] uppercase text-cyan-400"
            style={{ textShadow: '0 0 20px #06b6d4' }}
          >
            The Secret
          </motion.div>
        )}
      </AnimatePresence>

      {sequenceStep === 'idle' && (
        <div className="absolute bottom-10 text-cyan-900/40 font-mono text-xs tracking-widest uppercase select-none">
          Seek the brightest light
        </div>
      )}
    </div>
  );
};
