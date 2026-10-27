/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** True when the English OCR model is bundled under `tesseract/lang/` (see vite.config.ts). */
  readonly VITE_OCR_LOCAL_MODEL: boolean
}
