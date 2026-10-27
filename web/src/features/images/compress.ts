/** Long side of a stored screenshot, and its JPEG quality (SPEC section 5, TradeImage). */
const MAX_SIDE = 1600
const QUALITY = 0.8

export interface CompressedImage {
  blob: Blob
  width: number
  height: number
}

/** Scales a picked image down to 1600 px on the long side and re-encodes it as JPEG. */
export async function compressImage(file: Blob): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  // JPEG has no transparency; paint white under transparent PNGs instead of black.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('Could not encode the image')
  return { blob, width, height }
}
