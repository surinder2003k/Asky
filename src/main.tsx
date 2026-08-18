import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import "./index.css";

/* Offline-first: register the service worker in production so the site
 * loads even with no internet, showing the in-app offline banner instead
 * of a browser error page. */
if (
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Non-fatal: site still works online without the SW. */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
