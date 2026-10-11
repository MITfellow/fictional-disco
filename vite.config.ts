import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // PDF compiler files also run inside a Web Worker, where React Fast Refresh cannot run.
  plugins: [react({ exclude: /src\/pdf\// })],
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: { chunkSizeWarningLimit: 4000 },
});
