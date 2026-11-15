import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rolldownOptions: { input: ['index.html', 'phuong-an/d.html', 'phuong-an/e.html'] },
  },
});
