import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      // The manifest is served by the backend (/api/v1/auth/manifest.webmanifest, linked
      // from index.html) so the installed app is named after the society on each instance.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/(assets|ppm\/tasks)(\?.*)?$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-read-cache", expiration: { maxAgeSeconds: 300 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    proxy: {
      "/api": { target: process.env.VITE_API_BASE_URL || "http://localhost:8000", changeOrigin: true },
      "/uploads": { target: process.env.VITE_API_BASE_URL || "http://localhost:8000", changeOrigin: true },
    },
  },
});
