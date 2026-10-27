import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from the GitHub Pages project subpath.
  base: './',
  test: {
    environment: 'node',
  },
})
