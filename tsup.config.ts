import { defineConfig } from 'tsup';
import { builtinModules } from 'module';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  target: 'node18',
  platform: 'node',
  dts: false,
  treeshake: false,
  minify: false,
  outDir: 'dist',
  bundle: true,
  external: [
    'react-devtools-core',
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
  ],
  esbuildOptions(options) {
    options.platform = 'node';
  },
  outExtension() {
    return {
      js: '.js',
    };
  },
});
