import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    proxy: {
      // Proxy pour les appels API Pennylane en développement
      '/api/pennylane-proxy': {
        target: 'https://app.pennylane.com',
        changeOrigin: true,
        rewrite: (path) => {
          // Extraire l'endpoint et les params depuis l'URL
          const url = new URL(path, 'http://localhost');
          const endpoint = url.searchParams.get('endpoint') || '';
          url.searchParams.delete('endpoint');
          const remainingParams = url.searchParams.toString();
          return `/api/external/v2${endpoint}${remainingParams ? '?' + remainingParams : ''}`;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Transférer la clé API depuis le header custom vers Authorization
            const apiKey = req.headers['x-pennylane-api-key'];
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
            }
            // Transférer le Company ID (requis par l'API Pennylane v2)
            const companyId = req.headers['x-company-id'];
            if (companyId) {
              proxyReq.setHeader('X-Company-Id', companyId);
            }
            proxyReq.setHeader('Accept', 'application/json');
          });
        }
      }
    }
  }
})
