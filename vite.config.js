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
  server: {
    watch: {
      // Browser downloads can remain locked on Windows; generated evidence is not app source.
      ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright*-report/**', '**/release-gate-artifacts/**'],
    },
  },
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
