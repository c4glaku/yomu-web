import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'

export async function openPdf(data: Uint8Array) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  return pdfjs.getDocument({
    data,
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  })
}

// PDF content streams are drawing commands, not necessarily reading order.
// Group vertical glyphs by column before reading each column from top to bottom.
export function pdfText(items: TextItem[], styles: Record<string, TextStyle>): string {
  // Some Japanese CMaps return vertical presentation forms instead of ordinary
  // punctuation. Let CSS orient those marks for the chosen reading direction.
  // Limit normalization to those forms so full-width text and kanji stay intact.
  const textFor = (item: TextItem) =>
    item.str.replace(/[\uFE10-\uFE19\uFE30-\uFE48]/g, (character) => character.normalize('NFKC'))
  const vertical = items.filter((item) => item.dir === 'ttb' || styles[item.fontName]?.vertical)
  if (!vertical.length)
    return items.map((item) => textFor(item) + (item.hasEOL ? '\n' : '')).join('')
  const sizes = vertical
    .map((item) => Math.hypot(item.transform[0], item.transform[1]))
    .sort((a, b) => a - b)
  const tolerance = Math.max(1, sizes[Math.floor(sizes.length / 2)] * 0.45)
  const columns: { x: number; items: TextItem[] }[] = []
  for (const item of [...items].sort((a, b) => b.transform[4] - a.transform[4])) {
    const column = columns.find((column) => Math.abs(column.x - item.transform[4]) < tolerance)
    if (column) column.items.push(item)
    else columns.push({ x: item.transform[4], items: [item] })
  }
  return columns
    .map((column) =>
      column.items
        .sort((a, b) => b.transform[5] - a.transform[5])
        .map(textFor)
        .join(''),
    )
    .join('\n')
}
