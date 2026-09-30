import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['tradingcandle-web', 'tradingcandle-core', 'klinecharts'],
  },
  server: { port: 5173, host: '127.0.0.1' },
});
