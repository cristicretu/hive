// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://hive.cretu.dev',

  build: {
    // Inline small assets
    inlineStylesheets: 'auto',
  },

  vite: {
    plugins: [tailwindcss()],
    build: {
      // Better chunk naming for caching
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[hash][extname]',
          chunkFileNames: 'chunks/[hash].js',
          entryFileNames: 'entries/[hash].js',
        },
      },
    },
  },

  integrations: [react(), sitemap()],
});
