import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://afyllx.com',
  trailingSlash: 'never',
  output: 'static',
  devToolbar: { enabled: false },
  build: { format: 'file', assets: 'afyllx-assets' },
});
