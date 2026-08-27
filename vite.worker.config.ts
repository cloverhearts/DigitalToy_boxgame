import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/server',
    emptyOutDir: false,
    target: 'es2022',
    minify: true,
    lib: {
      entry: 'worker.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
  },
});
