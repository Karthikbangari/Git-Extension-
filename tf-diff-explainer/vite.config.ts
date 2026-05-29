import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { cpSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  // publicDir is false in lib mode by default — copy manually in plugin
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false, // scripts build already populated dist/
    lib: {
      entry: resolve(__dirname, 'src/popup/popup.ts'),
      formats: ['iife'],
      name: '_',
      fileName: () => 'popup/popup.js',
    },
  },
  plugins: [
    {
      name: 'copy-public-dir',
      closeBundle() {
        // Copy manifest.json, icons/, popup/popup.html, popup/popup.css → dist/
        cpSync(resolve(__dirname, 'public'), resolve(__dirname, 'dist'), { recursive: true });
      },
    },
  ],
});
