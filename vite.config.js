import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Simple plugin to copy HTML file and rename it
const copyHtmlPlugin = () => ({
  name: 'copy-html',
  buildStart() {
    mkdirSync('dist', { recursive: true });
  },
  writeBundle() {
    // After build, copy dashboard.html to index.html
    if (existsSync('dist/templates/dashboard.html')) {
      copyFileSync('dist/templates/dashboard.html', 'dist/index.html');
    }
  }
});

export default defineConfig({
  root: './',
  publicDir: 'public',
  plugins: [copyHtmlPlugin()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'templates/dashboard.html')
      }
    },
    minify: false,
    sourcemap: false,
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
});

