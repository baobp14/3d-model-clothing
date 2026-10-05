import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.ui.test.jsx'], pool: 'threads', fileParallelism: false, testTimeout: 15000 },
})
