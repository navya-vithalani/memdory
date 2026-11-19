var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
var pwaPlugin = VitePWA({
    registerType: 'autoUpdate',
    workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
    includeAssets: ['Icons/apple-touch-icon.png', 'Icons/icon-192.png', 'Icons/icon-512.png'],
    manifest: {
        id: '/',
        name: 'Remembree',
        short_name: 'Remembree',
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
    plugins: __spreadArray([react()], pwaPlugin, true),
    test: {
        environment: 'jsdom',
        globals: true
    }
});
