import React, { createContext, useContext, useState } from 'react';

type Theme = 'default' | 'traumacore';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTraumacore: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('default');

  const toggleTraumacore = () => {
    setTheme(prev => prev === 'traumacore' ? 'default' : 'traumacore');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTraumacore }}>
      <div className={theme === 'traumacore' ? 'traumacore-mode' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
