import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { decodeText, importBook, paginate } from './importers'
import * as storage from './storage'
import * as images from './images'

function file(name: string, bytes: Uint8Array) {
  const value = new File([], name)
  Object.defineProperty(value, 'size', { value: bytes.length })
  Object.defineProperty(value, 'arrayBuffer', { value: async () => new Uint8Array(bytes).buffer })
  return value
}
const fixture = (name: string) => file(name, readFileSync(resolve('tests/fixtures', name)))

describe('book imports', () => {
  it('keeps Japanese characters intact when paginating long paragraphs', () => {
    const text = '読書と𠮷野。'.repeat(200)
    const pages = paginate(text)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.map((page) => page.text).join('')).toBe(text)
    expect(pages.every((page) => Array.from(page.text).length <= 650)).toBe(true)
  })

  it('decodes UTF-8, UTF-16 with a BOM, and Shift-JIS', async () => {
    expect(decodeText(strToU8('日本語の本'))).toBe('日本語の本')
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0xe5, 0x65, 0x2c, 0x67]))).toBe('日本')
    expect(decodeText(new Uint8Array([0xfe, 0xff, 0x65, 0xe5, 0x67, 0x2c]))).toBe('日本')
    const book = await importBook(fixture('shift-jis.txt'))
    expect(book.pages[0].text).toMatch(/[\p{Script=Han}]/u)
    expect(book.pages[0].text).not.toContain('�')
  })

  it.each(['stored.epub', 'deflated.epub'])(
    'imports %s in spine order without duplicated ruby',
    async (name) => {
      const book = await importBook(fixture(name))
      expect(book.title).toBeTruthy()
      expect(book.pages.length).toBeGreaterThanOrEqual(2)
      expect(book.pages[0].text).toContain('日本語の本を読みます')
      expect(book.pages[1].text).toContain('友達と学校')
      expect(book.pages.map((page) => page.text).join('')).not.toContain('にほんご')
      expect(book.pages.map((page) => page.text).join('')).not.toContain('DO NOT INCLUDE')
    },
  )

  it('rejects protected chapters and unsafe archive paths', async () => {
    await expect(importBook(fixture('protected.epub'))).rejects.toThrow(/encrypted/)
    await expect(importBook(fixture('traversal.epub'))).rejects.toThrow(/unsafe/)
  })

  it('rejects corrupt ZIP content before importing', async () => {
    const archive = zipSync({ mimetype: strToU8('application/epub+zip') }, { level: 0 })
    archive[38] ^= 1
    await expect(importBook(file('corrupt.epub', archive))).rejects.toThrow(
      /integrity|damaged|invalid/,
    )
  })

  it('rejects empty, unsupported, and oversized files', async () => {
    await expect(importBook(file('empty.txt', new Uint8Array()))).rejects.toThrow(/empty/)
    await expect(importBook(file('comic.cbr', new Uint8Array([1])))).rejects.toThrow(
      /PDF, EPUB, TXT, CBZ/,
    )
    const tooLarge = new File([], 'large.txt')
    Object.defineProperty(tooLarge, 'size', { value: 76 * 1024 * 1024 })
    await expect(importBook(tooLarge)).rejects.toThrow(/75 MB/)
  })

  it('naturally orders comic pages and stores artwork apart from book metadata', async () => {
    const save = vi.spyOn(storage, 'saveAssets').mockResolvedValue()
    const cover = vi.spyOn(images, 'imageCover').mockResolvedValue('data:image/png;base64,cover')
    try {
      const archive = zipSync({
        'pages/10.png': new Uint8Array([10]),
        'pages/2.png': new Uint8Array([2]),
        'pages/1.png': new Uint8Array([1]),
        '__MACOSX/._1.png': new Uint8Array([3]),
      })
      const book = await importBook(file('comic.cbz', archive))
      expect(book.pages.map((page) => page.chapter)).toEqual(['1.png', '2.png', '10.png'])
      expect(book.illustrated).toBe(true)
      expect(book.pages.every((page) => page.image?.startsWith(`${book.id}/`))).toBe(true)
      expect(save.mock.calls[0][0].size).toBe(3)
    } finally {
      save.mockRestore()
      cover.mockRestore()
    }
  })

  it('rejects empty, unsafe, corrupt, and oversized comic archives', async () => {
    await expect(importBook(file('comic.cbz', new Uint8Array([1])))).rejects.toThrow(/valid ZIP/)
    await expect(
      importBook(file('comic.cbz', zipSync({ 'notes.txt': strToU8('hello') }))),
    ).rejects.toThrow(/no PNG/)
    await expect(
      importBook(file('comic.cbz', zipSync({ '../page.png': new Uint8Array([1]) }))),
    ).rejects.toThrow(/unsafe/)
    const damaged = zipSync({ '1.png': strToU8('original') }, { level: 0 })
    damaged[35] ^= 1
    await expect(importBook(file('comic.cbz', damaged))).rejects.toThrow(/integrity/)
    await expect(
      importBook(file('comic.cbz', zipSync({ '1.png': new Uint8Array(17 * 1024 * 1024) }))),
    ).rejects.toThrow(/size limits/)
  })
})
