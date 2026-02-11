import { Route, Switch, useLocation } from "wouter";
import { StarEntry } from "./components/StarEntry";
import RadioPage from "./pages/RadioPage";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useKonamiCode } from "./hooks/useKonamiCode";

// Root Application Component
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { toggleTraumacore } = useTheme();
  const [, navigate] = useLocation();

  useKonamiCode(() => {
    toggleTraumacore();
    alert("TRAUMCORE MODE ACTIVATED // EMOTIONAL RESONANCE CRITICAL");
  });

  const handleAccessGranted = () => {
    navigate('/dashboard');
  };

  return (
    <div className="w-full h-full bg-black">
      <Switch>
        <Route path="/">
          <StarEntry onAccessGranted={handleAccessGranted} />
        </Route>
        
        <Route path="/dashboard">
          <RadioPage />
        </Route>

        <Route path="/radio">
          <RadioPage />
        </Route>

        <Route>
          <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
            <h1 className="text-2xl font-mono tracking-widest text-red-500">
              404 // DISCONNECTED
            </h1>
          </div>
        </Route>
      </Switch>
    </div>
  );
}