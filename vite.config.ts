import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['vite.svg'],
  manifest: {
    name: 'Remembery',
    short_name: 'Remembery',
    theme_color: '#1E2A78',
    background_color: '#F6F7FD',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
}) as any;

export default defineConfig({
  plugins: [react(), ...pwaPlugin],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
