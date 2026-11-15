import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";
// Theme proposals (see the file headers). Imported after App so they follow console.css.
// theme-mono.css must come after theme-deep-space.css: it reuses that layout and swaps the palette.
import "./styles/theme-deep-space.css";
import "./styles/theme-mono.css";
// Layout of the console column (status, stops, budget, collapsibles, pinned emergency block). Uses theme variables only.
import "./styles/console-column.css";

// ?theme=mono (default) | deep-space | classic. "classic" is the Contract 6 palette and the old layout.
const requested = new URLSearchParams(window.location.search).get("theme");
document.documentElement.dataset.theme =
  requested === "classic" || requested === "deep-space" ? requested : "mono";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
