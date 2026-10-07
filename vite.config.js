import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: false },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});
