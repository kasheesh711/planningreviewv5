import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // Increases warning threshold to 1000kb
    rollupOptions: {
      output: {
        manualChunks: {
          // Split external libraries into separate chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['lodash'] // if you use lodash
        }
      }
    }
  }
})
