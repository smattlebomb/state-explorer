/// <reference types="vitest/config" />

declare const process: { env: Record<string, string | undefined> };
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages is served from https://<user>.github.io/state-explorer/.
// Local dev and `vite preview` stay at `/` unless VITE_BASE_PATH is set.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'State Explorer',
        short_name: 'States',
        description: 'Learn the 50 US states on a map!',
        theme_color: '#0ea5e9',
        background_color: '#e0f2fe',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        // US county shapes (~840 KB) are NOT precached: most visits never open them.
        globIgnores: ['**/counties-10m-*.js'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // The county chunk is cached the first time she opens counties, so it works
            // offline afterwards. Its file name has a content hash, so the cached copy never
            // goes stale: CacheFirst. Old hashed copies are trimmed when a new one arrives.
            urlPattern: ({ url }) => /\/assets\/counties-10m-[\w-]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'us-counties',
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // One ~600 KB bundle (map data + React + framer-motion) that the service worker
    // precaches once; splitting wouldn't help an offline app.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    // .test.tsx files are screen tests; they opt into jsdom with a `@vitest-environment jsdom` comment.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
