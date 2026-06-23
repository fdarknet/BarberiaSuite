import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["bc-logo.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Camarguinho",
        short_name: "Camarguinho",
        description: "Reservas, turnos y tienda de Camarguinho Barber Club.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#050505",
        theme_color: "#050505",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173 },
});
