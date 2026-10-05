import { build } from 'vite'
await build({ configFile: false, build: {
  lib: { entry: 'src/host.ts', formats: ['es'], fileName: () => 'host.js' },
  rollupOptions: { external: id => !id.startsWith('.') && !id.startsWith('/') && !id.match(/^[A-Z]:/i) },
  outDir: 'dist', emptyOutDir: true, minify: false, target: 'es2022',
} })
await build({ configFile: false, build: {
  lib: { entry: 'src/client.ts', formats: ['iife'], name: 'dshUsage', fileName: () => 'client.js' },
  outDir: 'dist', emptyOutDir: false, minify: false, target: 'es2020',
} })
