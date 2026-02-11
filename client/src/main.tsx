import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("[v0] main.tsx booting");
createRoot(document.getElementById("root")!).render(<App />);
