import { cp, mkdir, readdir } from 'node:fs/promises'

const modules = new URL('../node_modules/', import.meta.url)
const target = new URL('../public/ocr/', import.meta.url)
await mkdir(new URL('core/', target), { recursive: true })
await cp(new URL('tesseract.js/dist/worker.min.js', modules), new URL('worker.min.js', target))
await cp(new URL('tesseract.js/LICENSE.md', modules), new URL('LICENSE-tesseract.js.md', target))
const core = new URL('tesseract.js-core/', modules)
for (const name of await readdir(core)) {
  if (name.endsWith('.wasm.js') || name.endsWith('.wasm') || name === 'LICENSE') {
    await cp(new URL(name, core), new URL(`core/${name}`, target))
  }
}
for (const language of ['jpn', 'jpn_vert']) {
  await cp(
    new URL(`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`, modules),
    new URL(`${language}.traineddata.gz`, target),
  )
}
