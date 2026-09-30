import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: false,
    clean: true,
    treeshake: true,
    external: ['react', 'react-dom', 'klinecharts', 'tradingcandle-core', './engine.js', './engine'],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  {
    entry: { engine: 'src/engine.ts' },
    format: ['esm', 'cjs'],
    dts: false,
    clean: false,
    treeshake: true,
    external: ['klinecharts', 'tradingcandle-core'],
  },
]);
