import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/client.ts',
      formats: ['iife'],
      name: 'dshAppearance',
      fileName: () => 'client.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    target: 'es2020',
  },
})
