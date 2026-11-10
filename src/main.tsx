import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppProviders } from "./providers/AppProviders";
import "./index.css";

// Round 2 G9: a reload opens at the top; the browser must not restore the old
// scroll position (AppShell handles Back/Forward itself).
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

// Round 3 D3: dev only, a per-page CLS line in the console (and window.__zcCls()); never in a build.
if (import.meta.env.DEV) {
  void import("./lib/dev-cls-logger").then(({ startClsLogger }) => startClsLogger());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
