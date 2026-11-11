import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — относительные пути, чтобы сайт работал на GitHub Pages по адресу /SUP/
export default defineConfig({
  plugins: [react()],
  base: './',
})
