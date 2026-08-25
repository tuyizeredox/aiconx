import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'info',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-hook-form',
      '@hookform/resolvers/zod',
      '@tanstack/react-query',
      'socket.io-client',
      'framer-motion',
      'lucide-react',
      'zod',
      'clsx',
      'tailwind-merge',
      'date-fns',
      // Reached only through a dynamic import, so without listing them
      // here the dev server first meets them when someone opens the map
      // - then stops to re-optimize dependencies and full-reloads the
      // page mid-use.
      'leaflet',
      'react-leaflet',
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:10000',
        ws: true,
      },
    },
  },
  build: {
    sourcemap: false,
  },
});