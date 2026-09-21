import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    // three.js legitimately exceeds the default advisory; it is already split
    // into its own lazily-loaded chunk, so raise the threshold rather than
    // fragmenting the bundle further.
    chunkSizeWarningLimit: 2200,
  },
});
