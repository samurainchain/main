import { parseScreenshotText, type ParsedScreenshot } from '../../core/ocr/parseScreenshot'

// On-device text recognition with Tesseract.js. The image never leaves the browser; the engine
// and the English model are fetched once and then cached by the browser.

export type RecognizeProgress = (fraction: number) => void

/**
 * Where the engine files are served from (see `tesseractAssets` in vite.config.ts). Absolute,
 * because the worker resolves relative paths against its own script URL, not the page.
 */
function assetUrl(path: string): string {
  return new URL(`tesseract/${path}`, document.baseURI).href
}

/**
 * Prepares a screenshot for OCR: grayscale, light text on dark themes inverted to dark on
 * light, small images scaled up. Tesseract reads dark-on-light text at ~30 px best.
 */
async function preprocess(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, Math.max(1, 1600 / Math.max(bitmap.width, bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = image.data
  let total = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i]! + 0.587 * pixels[i + 1]! + 0.114 * pixels[i + 2]!
    pixels[i] = pixels[i + 1] = pixels[i + 2] = gray
    total += gray
  }
  const dark = total / (pixels.length / 4) < 128
  if (dark) {
    for (let i = 0; i < pixels.length; i += 4) pixels[i] = pixels[i + 1] = pixels[i + 2] = 255 - pixels[i]!
  }
  context.putImageData(image, 0, 0)
  return canvas
}

/** Gives up when loading the engine or model stalls, e.g. offline on first use. */
const LOAD_TIMEOUT_MS = 60_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Screenshot reader timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export async function recognizeScreenshot(file: Blob, onProgress?: RecognizeProgress): Promise<ParsedScreenshot> {
  const [{ createWorker, OEM }, canvas] = await Promise.all([import('tesseract.js'), preprocess(file)])
  // Download failures inside the worker reach `errorHandler`, not the `createWorker` promise.
  let failLoading: (error: unknown) => void = () => undefined
  const loadFailed = new Promise<never>((_, reject) => (failLoading = reject))
  const creating = createWorker('eng', OEM.LSTM_ONLY, {
    errorHandler: (error: unknown) => failLoading(error),
    workerPath: assetUrl('worker.min.js'),
    corePath: assetUrl(''),
    // Without the bundled model, Tesseract.js downloads it from its default CDN.
    langPath: import.meta.env.VITE_OCR_LOCAL_MODEL ? assetUrl('lang') : undefined,
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(message.progress)
    },
  })
  const worker = await Promise.race([withTimeout(creating, LOAD_TIMEOUT_MS), loadFailed]).catch(async (error: unknown) => {
    // A worker that finishes loading after the timeout must not linger.
    void creating.then((late) => late.terminate(), () => undefined)
    throw error
  })
  try {
    // Keep column gaps: the parser splits "Label    value" pairs and table rows on them.
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(canvas)
    return parseScreenshotText(data.text, data.confidence)
  } finally {
    await worker.terminate()
  }
}
