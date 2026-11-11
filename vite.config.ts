import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Собирает sw.js со списком всех файлов приложения — чтобы оно работало офлайн. */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['./', ...Object.keys(bundle).filter((f) => f !== 'sw.js').map((f) => './' + f)]
      const publicFiles = ['icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'].map((f) => './' + f)
      const version = Date.now().toString(36)
      const source = readFileSync('sw-template.js', 'utf-8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...files, ...publicFiles]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// base: './' — относительные пути, чтобы сайт работал на GitHub Pages по адресу /SUP/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  base: './',
})
