import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Same aliases as vite.config.js: @ is the Next.js app's src (3D try-on, outfit scoring).
  resolve: { alias: { '@': resolve(__dirname, '../src'), 'next/dynamic': resolve(__dirname, 'src/tryon/nextDynamicShim.jsx') } },
  test: { environment: 'jsdom', include: ['src/**/*.ui.test.jsx'], pool: 'threads', fileParallelism: false, testTimeout: 15000 },
})
