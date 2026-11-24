import {defineConfig} from 'vite';

export default defineConfig({
  publicDir: 'public',
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    watch: {
      ignored: ['**/public/studio_projects/**', '**/renders/**', '**/data/**', '**/.env'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/renders': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/studio_projects': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
