import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rolldownOptions: { input: ['index.html', 'home.html', 'dat-lam.html', 'quyen-rieng-tu.html', 'phuong-an/d.html', 'phuong-an/e.html', 'phuong-an/dat-lam.html', 'phuong-an/quyen-rieng-tu.html'] },
  },
});
