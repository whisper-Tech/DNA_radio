import { useEffect } from 'react';

export const useDevToolsDetector = () => {
  useEffect(() => {
    const handleDevToolsOpen = () => {
      // console.clear();
      console.log(
        "%c SEQUENCE DETECTED ",
        "background: #000; color: #06b6d4; font-size: 20px; font-weight: bold; border: 1px solid #06b6d4; padding: 10px;"
      );
      console.log(
        "%cWe prefer those who look under the hood. You've found the source. Join the collective.",
        "color: #a855f7; font-family: monospace; font-size: 14px;"
      );
      console.log(
        "%cContact: recruitment@whisper.college",
        "color: #ffffff; background: #333; padding: 4px;"
      );
    };

    // Detection logic
    let lastTime = Date.now();
    const threshold = 100;
    
    const check = () => {
      const currentTime = Date.now();
      if (currentTime - lastTime > threshold + 10) {
        // This is a simple way to detect a debugger/profiler pause or DevTools slowing down execution
        // but for a more direct approach, we can use the "element with id" trick or window size.
      }
      lastTime = currentTime;
    };

    const interval = setInterval(check, threshold);

    // Simple window resize detection (often used when docking devtools)
    const handleResize = () => {
      if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
        handleDevToolsOpen();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial greeting if console is already open (maybe)
    handleDevToolsOpen();

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
};
