import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

function Router() {
  console.log("[v0] Router rendering, Home component:", Home);
  return (
    <Switch>
      <Route path="/">
        {() => {
          console.log("[v0] Route matched: /");
          return <Home />;
        }}
      </Route>
      <Route>
        {() => {
          console.log("[v0] Route matched: NotFound (catch-all)");
          return <NotFound />;
        }}
      </Route>
    </Switch>
  );
}

function App() {
  console.log("[v0] App rendering, Router:", Router);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
