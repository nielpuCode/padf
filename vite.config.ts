import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-lib-vendor': ['@cantoo/pdf-lib'],
          'pdfjs-vendor': ['pdfjs-dist'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})
