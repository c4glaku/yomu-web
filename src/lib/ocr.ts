import type { Worker } from 'tesseract.js'
import type { OcrRegion } from '../types'

export type Area = Pick<OcrRegion, 'x' | 'y' | 'width' | 'height'>
export type OcrDirection = 'vertical' | 'horizontal'

export function cleanOcrText(text: string): string {
  return text
    .trim()
    .replace(
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、。！？「」])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、。！？「」])/gu,
      '$1',
    )
}

// Split rows at clear gaps, then order speech bubbles right to left in each row.
// Irregular panel arrangements may still need a manually selected bubble.
export function orderRegions(regions: OcrRegion[]): OcrRegion[] {
  const rows: { bottom: number; regions: OcrRegion[] }[] = []
  for (const region of [...regions].sort((a, b) => a.y - b.y || b.x - a.x)) {
    const row = rows.at(-1)
    if (row && region.y < row.bottom) {
      row.regions.push(region)
      row.bottom = Math.max(row.bottom, region.y + region.height)
    } else rows.push({ bottom: region.y + region.height, regions: [region] })
  }
  return rows.flatMap((row) => row.regions.sort((a, b) => b.x - a.x || a.y - b.y))
}

export function mergeRegions(previous: OcrRegion[], incoming: OcrRegion[], area?: Area) {
  if (!area) return orderRegions(incoming)
  // Re-scanning a bubble replaces its earlier result instead of duplicating it.
  return orderRegions([
    ...previous.filter((region) => {
      const x = region.x + region.width / 2
      const y = region.y + region.height / 2
      return x < area.x || x > area.x + area.width || y < area.y || y > area.y + area.height
    }),
    ...incoming,
  ])
}

export async function recognizeImage(
  source: HTMLCanvasElement,
  direction: OcrDirection,
  signal: AbortSignal,
  onProgress: (message: string) => void,
  area?: Area,
): Promise<OcrRegion[]> {
  signal.throwIfAborted()
  const { createWorker, OEM, PSM } = await import('tesseract.js')
  signal.throwIfAborted()
  const bounds = area ?? { x: 0, y: 0, width: 1, height: 1 }
  const canvas = document.createElement('canvas')
  // Upscale small bubbles, but bound memory on large pages.
  const width = Math.max(1, bounds.width * source.width)
  const height = Math.max(1, bounds.height * source.height)
  const scale = Math.min(2, (area ? 2400 : 1800) / Math.max(width, height))
  const padding = 20
  canvas.width = Math.ceil(width * scale) + padding * 2
  canvas.height = Math.ceil(height * scale) + padding * 2
  const context = canvas.getContext('2d')!
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    source,
    bounds.x * source.width,
    bounds.y * source.height,
    width,
    height,
    padding,
    padding,
    width * scale,
    height * scale,
  )

  let worker: Worker | undefined
  let stopped = false
  let fail: (error: unknown) => void = () => {}
  const interrupted = new Promise<never>((_, reject) => {
    fail = reject
  })
  const stop = (error: unknown) => {
    stopped = true
    void worker?.terminate()
    fail(error)
  }
  const abort = () => stop(new DOMException('OCR cancelled.', 'AbortError'))
  signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(
    () => stop(new Error('OCR took too long. Try selecting a smaller speech bubble.')),
    120_000,
  )
  try {
    const work = async () => {
      onProgress('Loading Japanese OCR…')
      const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
      worker = await createWorker(direction === 'vertical' ? 'jpn_vert' : 'jpn', OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`,
        corePath: `${base}core/`,
        langPath: base.replace(/\/$/, ''),
        workerBlobURL: false,
        logger: (message) => {
          if (!stopped)
            onProgress(
              message.status === 'recognizing text'
                ? `Recognizing Japanese… ${Math.round(message.progress * 100)}%`
                : 'Loading Japanese OCR…',
            )
        },
        errorHandler: () =>
          stop(
            new Error(
              'OCR could not load or read this page. Try again, or select a smaller bubble.',
            ),
          ),
      })
      if (stopped) {
        await worker.terminate()
        signal.throwIfAborted()
        throw new Error('OCR stopped.')
      }
      await worker.setParameters({
        tessedit_pageseg_mode: area
          ? direction === 'vertical'
            ? PSM.SINGLE_BLOCK_VERT_TEXT
            : PSM.SINGLE_BLOCK
          : PSM.AUTO,
        user_defined_dpi: '300',
        textord_tabfind_vertical_text: direction === 'vertical' ? '1' : '0',
        textord_tabfind_force_vertical_text: direction === 'vertical' ? '1' : '0',
      })
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true })
      const regions: OcrRegion[] = []
      for (const block of data.blocks ?? []) {
        const text = cleanOcrText(block.text)
        if (!text) continue
        const x = Math.max(0, (block.bbox.x0 - padding) / (width * scale))
        const y = Math.max(0, (block.bbox.y0 - padding) / (height * scale))
        const right = Math.min(1, (block.bbox.x1 - padding) / (width * scale))
        const bottom = Math.min(1, (block.bbox.y1 - padding) / (height * scale))
        if (right <= x || bottom <= y) continue
        regions.push({
          id: crypto.randomUUID(),
          text,
          x: bounds.x + x * bounds.width,
          y: bounds.y + y * bounds.height,
          width: (right - x) * bounds.width,
          height: (bottom - y) * bounds.height,
        })
      }
      if (!regions.length && data.text.trim())
        regions.push({ id: crypto.randomUUID(), text: cleanOcrText(data.text), ...bounds })
      return orderRegions(regions)
    }
    return await Promise.race([work(), interrupted])
  } finally {
    stopped = true
    window.clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    void worker?.terminate()
    canvas.width = canvas.height = 0
  }
}
