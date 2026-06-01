import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/dashboard/dashboard.ts'),
      name: 'GFEDashboard',
      fileName: () => 'dashboard/dashboard.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
