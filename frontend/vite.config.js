import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // Everything shipped here is ES2020+ anyway; a lower target only
    // adds transpilation weight for browsers we do not support.
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    // Route chunks are small by design — warn only on genuinely big ones.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /* Split the heavy, rarely-changing libraries into their own
           chunks. Recharts and framer-motion together are most of the
           bundle, and neither is needed to render the first screen, so
           bundling them with app code forced every user to download
           them before anything painted. Stable chunk names also mean a
           routine app deploy does not invalidate the vendor cache. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('axios')) return 'vendor-http';
          return 'vendor';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },

  server: {
    port: 5173,
    strictPort: false,
  },

  preview: {
    port: 4173,
  },
});
