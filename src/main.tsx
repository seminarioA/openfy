import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/young-serif/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "@fontsource/courier-prime/latin-400.css";
import "./styles/papel.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El service worker deja la app abierta sin conexión. No existe en orígenes
// sin HTTPS (salvo localhost).
if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}
