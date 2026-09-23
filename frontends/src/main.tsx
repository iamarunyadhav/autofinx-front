import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initializeApiBase } from "./lib/api-base";
import "./index.css";

// Kick off API-base resolution in the background — do NOT block the initial
// render on it. If the probe is slow/hangs, the app shell must still render
// immediately. Any code that needs the resolved base (auth check, workspace
// load, etc.) awaits this same shared promise itself before firing its first
// real request, instead of the whole app waiting here.
void initializeApiBase();

createRoot(document.getElementById("root")!).render(<App />);
