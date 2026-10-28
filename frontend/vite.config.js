import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The 3D try-on page reuses the Next.js app's code (../src) and assets (../public).
const appRoot = resolve(__dirname, '..')
const tryOnAssets = ['models', 'prints', 'outfit']
const types = { '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' }

function tryOnAssetsPlugin() {
  return {
    name: 'tryon-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || '').split('?')[0])
        const root = tryOnAssets.find(dir => path.startsWith(`/${dir}/`))
        const file = root && resolve(appRoot, 'public', path.slice(1))
        if (!file || !file.startsWith(resolve(appRoot, 'public') + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        const stat = statSync(file)
        res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
        res.setHeader('Content-Length', stat.size)
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      for (const dir of tryOnAssets) cpSync(join(appRoot, 'public', dir), join(__dirname, 'dist', dir), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), tryOnAssetsPlugin()],
  resolve: {
    alias: { '@': resolve(appRoot, 'src'), 'next/dynamic': resolve(__dirname, 'src/tryon/nextDynamicShim.jsx') },
    // ../src has no node_modules of its own; resolve its imports from the shop.
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', '@imgly/background-removal'],
  },
  server: {
    allowedHosts: true,
    watch: { ignored: ['**/.qa/**', '**/e2e/**'] },
    fs: { allow: [appRoot] },
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
