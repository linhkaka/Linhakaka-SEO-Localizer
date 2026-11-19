import type { Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

function disableViteClientWebSocketPlugin(): Plugin {
  let shouldDisableWs = false;
  return {
    name: 'disable-vite-client-websocket',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      shouldDisableWs = config.server.hmr === false || config.server.ws === false;
    },
    transform(code, id) {
      if (!shouldDisableWs) return;
      if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
        return code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          '/* WebSocket disabled (hmr/ws = false) */'
        );
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), disableViteClientWebSocketPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: false,
      ws: false,
    },
  };
});
