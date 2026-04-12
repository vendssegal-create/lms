import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8000';

  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': backendOrigin,
        '/ws': { target: backendOrigin, ws: true },
        '/auth': backendOrigin,
        '/media': backendOrigin,
        '/static': backendOrigin,
        // Backend legacy pages (embedded via iframe under SPA /legacy/*).
        '/__legacy': backendOrigin,
        '/admin': backendOrigin,
        // Django HTML: sertifikat chop etish (SPA dan tashqari), aks holda Vite * route asosiy sahifaga tashlaydi
        '/lms': backendOrigin,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return;
            }
            if (id.includes('react-router')) {
              return 'router';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('@radix-ui')) {
              return 'radix';
            }
            if (id.includes('react-dom') || id.includes('react')) {
              return 'react-vendor';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
