import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  base: './',
  build: {
    modulePreload: false,
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        'src/components/list/list.html': 'src/components/list/list.html',
        'src/components/login/login.html': 'src/components/login/login.html',
      },
    },
  },
})