const MAX_PIXELS = 40_000_000

export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  const image = await createImageBitmap(blob).catch(() => {
    throw new Error('This image could not be decoded. Use a PNG, JPEG, or WebP image.')
  })
  if (image.width * image.height > MAX_PIXELS) {
    image.close()
    throw new Error('Images larger than 40 megapixels are not supported.')
  }
  return image
}

export async function imageCover(blob: Blob): Promise<string> {
  const image = await decodeImage(blob)
  try {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 300 / image.width, 450 / image.height)
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    image.close()
  }
}

export function imageType(path: string): string | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension === 'png'
    ? 'image/png'
    : extension === 'webp'
      ? 'image/webp'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : undefined
}
