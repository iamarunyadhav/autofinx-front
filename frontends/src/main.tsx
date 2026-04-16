import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initializeApiBase } from "./lib/api-base";
import "./index.css";

void initializeApiBase().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
