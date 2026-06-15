import { defineConfig, Plugin } from 'vite';
import { createConfigApiMiddleware } from './server/configApi';

function configApiPlugin(): Plugin {
  return {
    name: 'config-api',
    configureServer(server) {
      server.middlewares.use(createConfigApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createConfigApiMiddleware());
    }
  };
}

export default defineConfig({
  plugins: [configApiPlugin()],
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        editor: 'editor.html',
        admin: 'admin.html'
      }
    }
  }
});
