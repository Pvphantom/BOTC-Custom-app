import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, phones load the app from Vite (port 5173) and Vite forwards
// game traffic to the Node server on port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/api': 'http://localhost:3000',
    },
  },
});
