import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        totem: resolve(import.meta.dirname, 'index.html'),
        conexoes: resolve(import.meta.dirname, 'conexoes/index.html'),
      },
    },
  },
});
