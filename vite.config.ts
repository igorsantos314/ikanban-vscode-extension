import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(process.cwd(), 'src/webview/main.tsx'),
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          const names = 'names' in assetInfo ? assetInfo.names : [assetInfo.name];
          const name = names.find((entry) => entry?.endsWith('.css'));
          return name ? 'assets/index.css' : 'assets/[name][extname]';
        },
      },
    },
  },
});
