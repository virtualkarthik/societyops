import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "SocietyOps",
        short_name: "SocietyOps",
        description: "Society Maintenance & Operations — facility and compliance tracker",
        theme_color: "#1e40af",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
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
