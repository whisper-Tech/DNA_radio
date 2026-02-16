import { Route, Switch, useLocation } from "wouter";
import { StarEntry } from "./components/StarEntry";
import RadioPage from "./pages/RadioPage";
import RadioPage3D from "./pages/RadioPage3D";
import AdminDashboard from "./pages/AdminDashboard";
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
    navigate('/radio');
  };

  return (
    <div className="w-full h-full bg-black">
      <Switch>
        <Route path="/">
          <RadioPage />
        </Route>
        
        <Route path="/dashboard">
          <RadioPage />
        </Route>

        <Route path="/radio">
          <RadioPage />
        </Route>

        <Route path="/radio-3d">
          <RadioPage3D />
        </Route>

        <Route path="/admin">
          <AdminDashboard />
        </Route>

        <Route>
          <RadioPage />
        </Route>
      </Switch>
    </div>
  );
}