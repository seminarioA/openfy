/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icono.png"],
      manifest: {
        name: "Openfy",
        short_name: "Openfy",
        description: "Tu música, en tu dispositivo.",
        lang: "es",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#ebe8f0",
        theme_color: "#ebe8f0",
        icons: [{ src: "icono.png", sizes: "512x512", type: "image/png", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,webp,jpg,mjs,wasm}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: { environment: "node" },
});
