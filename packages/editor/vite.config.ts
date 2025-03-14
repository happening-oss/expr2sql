/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    minify: false,
    emptyOutDir: false,
    rollupOptions: {
      external: ['fuzzysort'],
    }
  },
  test: {
    coverage: {
      provider: 'istanbul' // or 'v8'
    },
  },
});
