import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// AFYLLX Account shares the ClassHub toolchain (node_modules) but builds and deploys as its own Worker.
// Run from the classhub folder: node node_modules/vite/bin/vite.js build --config accounts/vite.config.ts [--mode cloud]
const root = fileURLToPath(new URL('.', import.meta.url))
export default defineConfig(({ mode }) => {
  const web = mode === 'cloud'
  return {
    root,
    // Live at https://account.afyllx.com/ (own domain since 08/11/2026). edu.afyllx.com/tai-khoan only proxies the API.
    base: '/',
    build: { outDir: web ? '.wrangler/web-build' : 'dist', emptyOutDir: true },
    server: { host: '127.0.0.1', port: 5190, strictPort: true },
    preview: { host: '127.0.0.1', port: 5190, strictPort: true },
    plugins: [react(), cloudflare({ inspectorPort: false, configPath: web ? 'cloud/wrangler.jsonc' : 'wrangler.jsonc' })],
  }
})
