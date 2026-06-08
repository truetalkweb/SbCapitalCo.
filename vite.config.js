import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunks = [
  ['react-vendor', ['react', 'react-dom']],
  ['firebase-vendor', ['firebase']],
  ['charts-vendor', ['lightweight-charts']],
  ['layout-vendor', ['react-grid-layout', 'react-resizable', 'react-resizable-panels']],
  ['data-vendor', ['@supabase', 'axios']],
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          const normalizedId = id.replaceAll('\\', '/')
          const match = vendorChunks.find(([, packages]) =>
            packages.some((packageName) =>
              normalizedId.includes(`/node_modules/${packageName}/`)
            )
          )

          return match?.[0] || 'vendor'
        },
      },
    },
  },
})
