import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  
  // THE FIX: Tell Vite to build for the GitHub Pages sub-path
  base: '/CampusDrive/', 

  server: {
    port: 5173,
    open: true,
    host: true,
    // Intercept Roboflow API calls to bypass CORS
    proxy: {
      '/roboflow-api': {
        target: 'https://serverless.roboflow.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/roboflow-api/, '')
      }
    }
  },
});