import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["shield.svg"],
    manifest: {
      name: "BayShield — Tampa Bay Emergency",
      short_name: "BayShield",
      description: "Real-time natural disaster monitoring and evacuation planning for Tampa Bay",
      theme_color: "#0a1222",
      background_color: "#0a1222",
      display: "standalone",
      start_url: "/dashboard",
      icons: [
        { src: "/shield.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
      ],
    },
    workbox: {
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.weather\.gov\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "noaa-weather",
            expiration: { maxEntries: 30, maxAgeSeconds: 300 },
            networkTimeoutSeconds: 8,
          },
        },
        {
          urlPattern: /^https:\/\/api\.tidesandcurrents\.noaa\.gov\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "noaa-tides",
            expiration: { maxEntries: 20, maxAgeSeconds: 300 },
            networkTimeoutSeconds: 8,
          },
        },
        {
          urlPattern: /^https:\/\/services\.arcgis\.com\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "nhc-arcgis",
            expiration: { maxEntries: 10, maxAgeSeconds: 900 },
            networkTimeoutSeconds: 10,
          },
        },
      ],
    },
  }),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
