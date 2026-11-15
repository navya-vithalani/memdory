import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['Icons/apple-touch-icon.png', 'Icons/icon-192.png', 'Icons/icon-512.png'],
  manifest: {
    id: '/',
    name: 'remembree',
    short_name: 'remembree',
    description: 'Offline-first flashcards and notes for daily study.',
    theme_color: '#1E2A78',
    background_color: '#F6F7FD',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/Icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/Icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/Icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }
});

export default defineConfig({
  plugins: [react(), ...pwaPlugin],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
