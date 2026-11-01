import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
