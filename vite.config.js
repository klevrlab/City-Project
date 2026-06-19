import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base public path when served in development or production.
  // We use relative paths './' because GitHub pages often serves from a subdirectory (e.g. username.github.io/repo-name)
  base: './', 
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        locationTour: resolve(__dirname, 'location-tour.html'),
        selfieAr: resolve(__dirname, 'selfie-ar.html'),
        sharkAr8thwall: resolve(__dirname, 'shark-ar-8thwall.html'),
        sharkArDemo: resolve(__dirname, 'shark-ar-demo.html'),
        sharksWay: resolve(__dirname, 'sharks-way.html'),
        soccerAr8thwall: resolve(__dirname, 'soccer-ar-8thwall.html')
        // note: explicitly not including sharks-way-v0.html or debug-8thwall.html for now
      }
    }
  },
  server: {
    open: true
  }
});