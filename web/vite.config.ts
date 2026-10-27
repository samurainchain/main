import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)

/**
 * Serves the Tesseract.js worker and engine from this site instead of a CDN, under
 * `tesseract/`. The English model too, when `@tesseract.js-data/eng` is installed;
 * otherwise Tesseract.js fetches it from its default CDN.
 */
function tesseractAssets(): Plugin {
  const tesseractDir = dirname(require.resolve('tesseract.js/package.json'))
  const coreDir = dirname(require.resolve('tesseract.js-core/package.json'))
  const files: Record<string, string> = {
    'worker.min.js': join(tesseractDir, 'dist/worker.min.js'),
    // LSTM engine builds; the worker picks one by the device's SIMD support.
    'tesseract-core-lstm.wasm.js': join(coreDir, 'tesseract-core-lstm.wasm.js'),
    'tesseract-core-simd-lstm.wasm.js': join(coreDir, 'tesseract-core-simd-lstm.wasm.js'),
    'tesseract-core-relaxedsimd-lstm.wasm.js': join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'),
  }
  let model: string | undefined
  try {
    model = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int/eng.traineddata.gz')
  } catch {
    model = undefined
  }
  if (model && existsSync(model)) files['lang/eng.traineddata.gz'] = model
  const hasModel = 'lang/eng.traineddata.gz' in files

  return {
    name: 'tesseract-assets',
    config: () => ({
      define: { 'import.meta.env.VITE_OCR_LOCAL_MODEL': JSON.stringify(hasModel) },
    }),
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = request.url?.match(/\/tesseract\/(.+)$/)
        const file = match && files[decodeURIComponent(match[1]!)]
        if (!file) return next()
        response.setHeader('Content-Type', file.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript')
        response.end(readFileSync(file))
      })
    },
    generateBundle() {
      for (const [name, file] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName: `tesseract/${name}`, source: readFileSync(file) })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tesseractAssets()],
  // Relative asset paths so the build works from the GitHub Pages project subpath.
  base: './',
  test: {
    environment: 'node',
  },
})
