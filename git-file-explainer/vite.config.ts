import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { cpSync } from 'fs';

function copyPublic(): Plugin {
  return {
    name: 'copy-public',
    closeBundle() {
      cpSync(resolve(__dirname, 'public'), resolve(__dirname, 'dist'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyPublic()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/popup/popup.ts'),
      name: 'GFEPopup',
      fileName: () => 'popup/popup.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
