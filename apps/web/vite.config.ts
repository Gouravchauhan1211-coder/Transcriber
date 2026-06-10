import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
      '/health': 'http://localhost:3001',
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('http://localhost:3001'),
    'import.meta.env.VITE_WS_URL': JSON.stringify('ws://localhost:3001'),
  },
});
