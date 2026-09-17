import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../node_modules/pdfjs-dist/', import.meta.url))
const target = fileURLToPath(new URL('../public/pdfjs/', import.meta.url))
// Upgrades may still have generated assets from the retired OCR feature.
await rm(new URL('../public/ocr/', import.meta.url), { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`${source}/${folder}`, `${target}/${folder}`, { recursive: true })
}
await cp(`${source}/LICENSE`, `${target}/LICENSE`)
