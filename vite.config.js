
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  outDir: './dist',
  build: {
    outDir: './dist', 
    rollupOptions: {
      input: {
        main: 'client/index.html', 
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Adjust to your backend URL
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

