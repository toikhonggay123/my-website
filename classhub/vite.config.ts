import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const web = mode === 'cloud'
  return {
    base: web ? '/classhub/' : '/',
    build: { outDir: web ? '.wrangler/web-build' : 'dist' },
    plugins: [
      react(),
      cloudflare({ inspectorPort: false, ...(web ? { configPath: 'cloud/wrangler.jsonc' } : {}) }),
    ],
  }
})
