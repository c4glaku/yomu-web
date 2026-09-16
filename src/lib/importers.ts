import { strFromU8, unzip, unzipSync } from 'fflate'
import type { Book, Page } from '../types'

const MB = 1024 * 1024
const PAGE_LENGTH = 650
const clean = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim()

export function paginate(text: string, chapter = '本文 · Main text'): Page[] {
  const characters = Array.from(clean(text))
  const pages: Page[] = []
  while (characters.length) {
    let end = Math.min(PAGE_LENGTH, characters.length)
    if (end < characters.length) {
      for (let i = end; i > end * 0.7; i--) {
        if (/[。！？\n]/.test(characters[i - 1])) {
          end = i
          break
        }
      }
    }
    const page = characters.splice(0, end).join('').trim()
    if (page) pages.push({ text: page, chapter })
  }
  return pages
}

export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('shift-jis', { fatal: true }).decode(bytes)
  }
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('This EPUB contains invalid XML markup.')
  return doc
}

const elements = (doc: Document | Element, name: string) =>
  Array.from(doc.getElementsByTagNameNS('*', name))
const firstText = (doc: Document, name: string) => elements(doc, name)[0]?.textContent?.trim()

function archivePath(base: string, href: string): string {
  const path = decodeURIComponent(href.split('#')[0])
  if (!path || /^(?:[a-z]+:|\/|\\)/i.test(path) || path.includes('\\'))
    throw new Error('This EPUB contains an unsafe content path.')
  const parts = base.split('/').slice(0, -1)
  for (const part of path.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('This EPUB contains an unsafe content path.')
      parts.pop()
    } else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

function crc32(bytes: Uint8Array) {
  let crc = -1
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ -1) >>> 0
}

async function readArchive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0 || end < bytes.length - 65557)
    throw new Error('This EPUB is not a valid ZIP archive.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  if (count >= 5000 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error('This EPUB has too many files or uses an unsupported archive format.')
  let total = 0
  const checksums = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('This EPUB archive is damaged.')
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const next =
      offset +
      46 +
      nameLength +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true)
    if (next > end) throw new Error('This EPUB archive is damaged.')
    const name = strFromU8(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (flags & 1) throw new Error('Password-protected EPUB archives are not supported.')
    if (![0, 8].includes(method)) throw new Error('This EPUB uses unsupported ZIP compression.')
    if (
      /^(?:\/|\\|[a-z]:)/i.test(name) ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      checksums.has(name)
    )
      throw new Error('This EPUB contains unsafe or duplicate file paths.')
    total += size
    if (size > 16 * MB || total > 200 * MB)
      throw new Error(
        'This EPUB expands beyond the supported size limits (16 MB per file, 200 MB total).',
      )
    checksums.set(name, view.getUint32(offset + 16, true))
    offset = next
  }
  // Inspect fflate's directory before any data is inflated.
  unzipSync(bytes, {
    filter: (file) => {
      if (!checksums.has(file.name) || file.originalSize > 16 * MB)
        throw new Error('This EPUB archive is damaged.')
      return false
    },
  })
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(bytes, (error, data) => (error ? reject(error) : resolve(data))),
  )
  for (const [name, data] of Object.entries(files)) {
    if (data.length > 16 * MB || crc32(data) !== checksums.get(name))
      throw new Error('This EPUB failed its integrity check. Try downloading it again.')
  }
  return files
}

function extractChapter(text: string) {
  // Validate XHTML, then extract only text from a detached document. Imported
  // markup is never attached to the page or rendered as HTML.
  const doc = xml(text)
  for (const element of doc.querySelectorAll('rt, rp, script, style, head, svg, nav'))
    element.remove()
  const heading = doc.querySelector('h1, h2, h3')?.textContent?.trim()
  const body = elements(doc, 'body')[0] ?? doc.documentElement
  for (const element of body.querySelectorAll('p, div, section, h1, h2, h3, li, br'))
    element.append('\n\n')
  return {
    text: clean(body.textContent ?? '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n(?:\s*\n)+/g, '\n\n'),
    heading,
  }
}

async function importEpub(bytes: Uint8Array) {
  const files = await readArchive(bytes)
  const get = (path: string) => {
    if (!files[path]) throw new Error(`The EPUB is missing a required file: ${path}`)
    return strFromU8(files[path])
  }
  const container = xml(get('META-INF/container.xml'))
  const packagePath = elements(container, 'rootfile')[0]?.getAttribute('full-path')
  if (!packagePath) throw new Error('This EPUB has no book package.')
  const pkg = xml(get(archivePath('', packagePath)))
  const manifest = new Map(elements(pkg, 'item').map((item) => [item.getAttribute('id'), item]))
  const encrypted = new Set<string>()
  if (files['META-INF/encryption.xml']) {
    for (const reference of elements(xml(get('META-INF/encryption.xml')), 'CipherReference')) {
      const uri = reference.getAttribute('URI')
      if (uri) encrypted.add(archivePath('', uri))
    }
  }
  const pages: Page[] = []
  for (const ref of elements(pkg, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue
    const item = manifest.get(ref.getAttribute('idref'))
    const href = item?.getAttribute('href')
    if (!href) throw new Error('The EPUB reading order contains a missing chapter.')
    const path = archivePath(packagePath, href)
    if (encrypted.has(path))
      throw new Error('This EPUB has encrypted chapters. Import a DRM-free edition.')
    const chapter = extractChapter(get(path))
    pages.push(...paginate(chapter.text, chapter.heading || `Chapter ${pages.length + 1}`))
  }
  const coverId = elements(pkg, 'meta')
    .find((meta) => meta.getAttribute('name') === 'cover')
    ?.getAttribute('content')
  const coverItem =
    [...manifest.values()].find((item) =>
      item.getAttribute('properties')?.split(' ').includes('cover-image'),
    ) ?? manifest.get(coverId ?? '')
  let cover: string | undefined
  const media = coverItem?.getAttribute('media-type') ?? ''
  if (coverItem?.getAttribute('href') && /^image\/(png|jpeg|webp|gif)$/.test(media)) {
    const image = files[archivePath(packagePath, coverItem.getAttribute('href')!)]
    if (image && image.length <= 4 * MB) {
      const blob = new Blob([new Uint8Array(image)], { type: media })
      cover = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('The EPUB cover could not be read.'))
        reader.readAsDataURL(blob)
      })
    }
  }
  return { title: firstText(pkg, 'title'), author: firstText(pkg, 'creator'), pages, cover }
}

async function importPdf(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  const task = pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  })
  try {
    const document = await task.promise
    if (document.numPages > 5000)
      throw new Error('PDFs with more than 5,000 pages are not supported.')
    const pages: Page[] = []
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('')
      pages.push({ text: clean(text), chapter: `PDF · Page ${i}` })
      page.cleanup()
    }
    if (!pages.some((page) => page.text))
      throw new Error('This PDF has no selectable text. Scanned pages need OCR before importing.')
    return { pages }
  } finally {
    await task.destroy()
  }
}

export async function importBook(file: File): Promise<Book> {
  if (file.size > 75 * MB) throw new Error('Choose a file smaller than 75 MB.')
  if (!file.size) throw new Error('This file is empty.')
  const format = file.name.split('.').pop()?.toLowerCase()
  if (format !== 'txt' && format !== 'epub' && format !== 'pdf')
    throw new Error('Choose a PDF, EPUB, or TXT file.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const base: Book = {
    id: crypto.randomUUID(),
    title: file.name.replace(/\.[^.]+$/, ''),
    author: 'Your collection',
    format,
    pages: [],
    position: 0,
    readPages: [],
    completed: false,
    addedAt: new Date().toISOString(),
    tone: Math.floor(Math.random() * 4),
    highlights: [],
  }
  const content: { pages: Page[]; title?: string; author?: string; cover?: string } =
    format === 'epub'
      ? await importEpub(bytes)
      : format === 'pdf'
        ? await importPdf(bytes)
        : { pages: paginate(decodeText(bytes)) }
  const book = {
    ...base,
    ...content,
    title: content.title || base.title,
    author: content.author || base.author,
  }
  if (!book.pages.length) throw new Error('This book does not contain any readable text.')
  return book
}
