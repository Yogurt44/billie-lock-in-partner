import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[BILLIE] App starting...");

const rootElement = document.getElementById("root");
if (rootElement) {
  console.log("[BILLIE] Root element found, rendering app");
  createRoot(rootElement).render(<App />);
} else {
  console.error("[BILLIE] Root element not found!");
}
