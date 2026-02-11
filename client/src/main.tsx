import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[v0] main.tsx: app booting, root elem:", document.getElementById("root"));
console.log("[v0] App:", App);
const root = document.getElementById("root");
if (!root) {
  console.error("[v0] ERROR: No root element found!");
  throw new Error("No root element found!");
}
createRoot(root).render(<App />);
