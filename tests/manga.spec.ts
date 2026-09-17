import { test, expect, type Page } from '@playwright/test'
import { zipSync, strToU8 } from 'fflate'

// Original synthetic page: real Japanese pixels, with no embedded text layer.
async function mangaImage(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 700
    canvas.height = 900
    const context = canvas.getContext('2d')!
    context.fillStyle = 'white'
    context.fillRect(0, 0, 700, 900)
    context.strokeStyle = 'black'
    context.lineWidth = 3
    context.strokeRect(20, 20, 660, 860)
    context.beginPath()
    context.ellipse(500, 370, 135, 310, 0, 0, Math.PI * 2)
    context.stroke()
    context.fillStyle = 'black'
    context.font = '48px serif'
    context.textAlign = 'center'
    for (const [i, text] of ['今日は学校へ行く', '友達と本を読む'].entries()) {
      for (const [j, char] of [...text].entries())
        context.fillText(char, 550 - i * 90, 145 + j * 52)
    }
    // A simple figure in the adjoining panel area.
    context.beginPath()
    context.arc(170, 520, 65, 0, Math.PI * 2)
    context.stroke()
    context.beginPath()
    context.moveTo(170, 585)
    context.lineTo(170, 750)
    context.moveTo(100, 640)
    context.lineTo(240, 640)
    context.stroke()
    return canvas.toDataURL('image/png').split(',')[1]
  })
  return Buffer.from(data, 'base64')
}

async function readBook(page: Page, title: string) {
  await page.getByRole('button', { name: `Read ${title}`, exact: true }).click()
  await page.getByRole('button', { name: 'Let’s read' }).click()
}

test('vertical columns, scrolling, navigation, and horizontal preference work', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByLabel('Import book files').setInputFiles({
    name: 'vertical.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('日本語の本を読みます。'.repeat(140)),
  })
  await readBook(page, 'vertical')
  const viewport = page.locator('.text-viewport')
  await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', 'vertical-rl')
  const geometry = await page.locator('.japanese-text').evaluate((element) => {
    const node = element.querySelector('span')!.firstChild!
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 1)
    const first = range.getBoundingClientRect()
    range.setStart(node, 1)
    range.setEnd(node, 2)
    const second = range.getBoundingClientRect()
    return { top: second.top - first.top, left: second.left - first.left }
  })
  expect(geometry.top).toBeGreaterThan(0)
  expect(Math.abs(geometry.left)).toBeLessThan(2)
  await viewport.dispatchEvent('wheel', { deltaY: 250 })
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeLessThan(0)
  await expect(page.getByRole('button', { name: 'Resume reading' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('vertical-reader.png'), fullPage: true })
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByLabel('Go to page')).toHaveValue('1')
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBe(0)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Go to page')).toHaveValue('0')
  await page.getByRole('button', { name: 'Reader settings' }).click()
  await page.getByLabel('Text direction', { exact: true }).selectOption('horizontal-tb')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', 'horizontal-tb')
  await page.locator('.japanese-text').click()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Go to page')).toHaveValue('1')
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.reload()
  await readBook(page, 'vertical')
  await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', 'horizontal-tb')
})

test('image-only comics retain artwork, page order, and reading progress without OCR', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  const ocrRequests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/ocr|tesseract|traineddata/i.test(request.url())) ocrRequests.push(request.url())
  })
  await page.goto('/')
  const image = await mangaImage(page)
  const archive = zipSync({ '10.png': image, '2.png': image, '1.png': image })
  await page
    .getByLabel('Import book files')
    .setInputFiles({ name: 'manga.cbz', mimeType: 'application/zip', buffer: Buffer.from(archive) })
  await page.getByRole('button', { name: 'Read manga', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('This book has no selectable text')
  await expect(page.getByRole('dialog')).toContainText('cannot select or highlight')
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText(
    'cannot select or highlight words or be quizzed',
  )
  await expect(page.locator('.japanese-text')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Scan page', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Finish & quiz', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('image-reader.png'), fullPage: true })
  await page.locator('.page-artwork').click()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByLabel('Go to page')).toHaveValue('1')
  await expect(page.locator('.reader-chapter')).toHaveText('2.png')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.reader-chapter')).toHaveText('10.png')
  await page.getByRole('button', { name: 'Finish reading', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your library' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Read manga', exact: true }).click()
  await expect(page.getByLabel('Start at')).toHaveValue('2')
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.getByRole('img', { name: 'Artwork for page 3' })).toBeVisible()
  expect(ocrRequests).toEqual([])
  expect(errors).toEqual([])
})

test('deleting an illustrated book removes its saved artwork', async ({ page }) => {
  await page.goto('/')
  const image = await mangaImage(page)
  await page
    .getByLabel('Import book files')
    .setInputFiles({ name: 'artwork.png', mimeType: 'image/png', buffer: image })
  await readBook(page, 'artwork')
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: 'Options for artwork', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove book', exact: true }).click()
  await expect(page.locator('.book-card')).toHaveCount(1)
  const count = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('yomu-web')
      request.onsuccess = () => resolve(request.result)
    })
    const count = await new Promise<number>((resolve) => {
      const request = database.transaction('assets').objectStore('assets').count()
      request.onsuccess = () => resolve(request.result)
    })
    database.close()
    return count
  })
  expect(count).toBe(0)
})

test('image-only EPUB pages follow the spine and retain their artwork', async ({ page }) => {
  await page.goto('/')
  const image = await mangaImage(page)
  const archive = zipSync({
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
    ),
    'book.opf': strToU8(
      '<package><metadata><title>Image EPUB</title></metadata><manifest><item id="page" href="page.xhtml"/></manifest><spine><itemref idref="page"/></spine></package>',
    ),
    'page.xhtml': strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="1.png"/></body></html>',
    ),
    '1.png': image,
  })
  await page.getByLabel('Import book files').setInputFiles({
    name: 'image.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from(archive),
  })
  await readBook(page, 'Image EPUB')
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Library', exact: true }).click()
})

test('imports several loose page images as one naturally ordered manga', async ({ page }) => {
  await page.goto('/')
  const image = await mangaImage(page)
  await page.getByLabel('Import book files').setInputFiles(
    ['page10.png', 'page2.png', 'page1.png'].map((name) => ({
      name,
      mimeType: 'image/png',
      buffer: image,
    })),
  )
  await expect(page.locator('.book-card')).toHaveCount(2)
  await readBook(page, 'page · 3 pages')
  await expect(page.locator('.reader-chapter')).toHaveText('page1.png')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.locator('.reader-chapter')).toHaveText('page2.png')
  await page.getByRole('button', { name: 'Library', exact: true }).click()
})

test('imports a scanned PDF for image-only reading and keeps it after reload', async ({ page }) => {
  await page.goto('/')
  const image = await mangaImage(page)
  const printPage = await page.context().newPage()
  await printPage.setContent(
    `<style>body{margin:0}img{display:block;width:700px;height:900px}</style><img src="data:image/png;base64,${image.toString('base64')}">`,
  )
  const pdf = await printPage.pdf({ width: '700px', height: '900px' })
  await printPage.close()
  await page
    .getByLabel('Import book files')
    .setInputFiles({ name: 'Scanned manga.pdf', mimeType: 'application/pdf', buffer: pdf })
  await readBook(page, 'Scanned manga')
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await expect(page.getByRole('note')).toContainText('This page has no selectable text')
  await expect(page.getByRole('button', { name: 'Reflowed text', exact: true })).toBeDisabled()
  await expect(page.locator('.japanese-text')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'View highlights' })).toBeDisabled()
  await page.getByRole('button', { name: 'Finish reading', exact: true }).click()
  await page.reload()
  await readBook(page, 'Scanned manga')
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reflowed text', exact: true })).toBeDisabled()
})

test('mixed PDFs show scanned pages even after selecting reflowed text', async ({ page }) => {
  await page.goto('/')
  const image = await mangaImage(page)
  const printPage = await page.context().newPage()
  await printPage.setContent(
    `<style>body{margin:0}section{height:900px;break-after:page}img{width:700px;height:900px}</style>
    <section>Japanese novel: readable text.</section><img src="data:image/png;base64,${image.toString('base64')}">`,
  )
  const pdf = await printPage.pdf({ width: '700px', height: '900px' })
  await printPage.close()
  await page.getByLabel('Import book files').setInputFiles({
    name: 'Mixed.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  })
  await page.getByRole('button', { name: 'Read Mixed', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Some pages have no selectable text')
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await page.getByRole('button', { name: 'Reflowed text', exact: true }).click()
  await expect(page.locator('.japanese-text')).toContainText('Japanese novel')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Artwork for page 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reflowed text', exact: true })).toBeDisabled()
  await expect(page.getByRole('note')).toContainText('no selectable text')
  await expect(page.locator('.japanese-text')).toHaveCount(0)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await readBook(page, 'Mixed')
  await expect(page.getByRole('button', { name: 'Finish reading', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await expect(page.locator('.japanese-text')).toContainText('Japanese novel')
  await expect(page.getByRole('button', { name: 'Finish & quiz', exact: true })).toBeVisible()
})

test('upgrades an existing library without losing its books, words, or progress', async ({
  page,
}) => {
  await page.route('**/migration.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  )
  await page.goto('/migration.html')
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('yomu-web', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('library')
      request.onsuccess = () => resolve(request.result)
    })
    const transaction = database.transaction('library', 'readwrite')
    transaction.objectStore('library').put(
      {
        version: 1,
        settings: { theme: 'dark', speed: 240, fontSize: 28 },
        sessions: [],
        books: [
          {
            id: 'existing',
            title: 'Existing book',
            author: 'Me',
            format: 'txt',
            pages: [
              { text: '日本語の本', chapter: 'First' },
              { text: '友達と学校へ行く', chapter: 'Second' },
            ],
            position: 1,
            readPages: [0],
            completed: false,
            addedAt: '2026-01-01',
            tone: 0,
            highlights: [],
          },
        ],
        words: [
          {
            id: 'saved',
            entry: {
              id: 1,
              word: '学校',
              reading: 'がっこう',
              meanings: ['school'],
              pos: 'noun',
              common: true,
            },
            sentence: '学校へ行く',
            bookTitle: 'Existing book',
            bookId: 'existing',
            page: 0,
            addedAt: '2026-01-01',
          },
        ],
      },
      'state',
    )
    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve()
    })
    database.close()
  })
  await page.goto('/')
  await expect(page.locator('.book-card')).toHaveCount(1)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Read Existing book', exact: true }).click()
  await expect(page.getByLabel('Start at')).toHaveValue('1')
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', 'vertical-rl')
  await expect(page.getByLabel('Reading speed')).toHaveValue('240')
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: /Words/ }).click()
  await expect(page.locator('.word-card')).toHaveCount(1)
})
