import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'universe.html', dest: '' },
        { src: 'login.html', dest: '' },
        { src: 'js/**/*', dest: 'js' },
        { src: 'css/**/*', dest: 'css' },
        { src: 'engine/**/*', dest: 'engine' },
        { src: 'data/**/*', dest: 'data' },
        { src: '.nojekyll', dest: '' }
      ]
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
