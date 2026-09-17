import { test, expect, type Page } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'

const passage = '日本語の本を読みます。友達と学校へ行きます。'

function novelEpub() {
  return Buffer.from(
    zipSync({
      'META-INF/container.xml': strToU8(
        '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
      ),
      'book.opf': strToU8(
        '<package><metadata><title>Novel</title></metadata><manifest><item id="chapter" href="chapter.xhtml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
      ),
      'chapter.xhtml': strToU8(
        `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${passage.repeat(100)}</p></body></html>`,
      ),
    }),
  )
}

// Two real PDF pages using the same Japanese CMap as the small PDF fixture,
// laid out in vertical columns. Text extraction must preserve their reading order.
function novelPdf() {
  const hex = [...passage.repeat(2)]
    .map((char) => char.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('')
  const stream = Array.from(
    { length: 15 },
    (_, i) => `BT /F1 10 Tf ${370 - i * 24} 470 Td <${hex}> Tj ET\n`,
  ).join('')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /UniJIS-UTF16-V /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 5 >> >>] >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 500] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}

async function position(page: Page) {
  return page.locator('.text-viewport').evaluate((element) => {
    const vertical = getComputedStyle(element).writingMode === 'vertical-rl'
    return vertical
      ? -element.scrollLeft / (element.scrollWidth - element.clientWidth)
      : element.scrollTop / (element.scrollHeight - element.clientHeight)
  })
}

for (const format of ['epub', 'pdf'] as const) {
  for (const mode of ['vertical-rl', 'horizontal-tb'] as const) {
    test(`${format}: ${mode} scrolls at the selected speed, resumes, and stops at the goal`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto('/')
      await page.getByLabel('Import book files').setInputFiles({
        name: `Novel.${format}`,
        mimeType: format === 'epub' ? 'application/epub+zip' : 'application/pdf',
        buffer: format === 'epub' ? novelEpub() : novelPdf(),
      })
      await page.getByRole('button', { name: 'Read Novel', exact: true }).click()
      await page.getByLabel('Scroll direction', { exact: true }).selectOption(mode)
      await page.getByLabel('Number of pages').fill('2')
      await page.clock.install({ time: new Date('2026-09-17T12:00:00Z') })
      await page.clock.pauseAt(new Date('2026-09-17T12:00:01Z'))
      await page.getByRole('button', { name: 'Let’s read' }).click()
      await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', mode)
      await expect(page.locator('.japanese-text')).toContainText(passage)
      await expect(page.locator('.japanese-text')).not.toContainText('�')
      await page.getByRole('button', { name: 'Pause reading' }).click()
      const viewport = page.locator('.text-viewport')
      const count = [...(await page.locator('.japanese-text').innerText())].filter(
        (char) => !/\s/.test(char),
      ).length
      const initial = await position(page)
      expect(Number.isFinite(initial)).toBe(true)
      await page.getByLabel('Reading speed').fill('120')
      await page.getByRole('button', { name: 'Resume reading' }).click()
      await page.clock.runFor(6000)
      await page.getByRole('button', { name: 'Pause reading' }).click()
      const slow = await position(page)
      expect(slow - initial).toBeCloseTo(12 / count, 2)
      await page.getByLabel('Reading speed').fill('600')
      await page.getByRole('button', { name: 'Resume reading' }).click()
      await page.clock.runFor(6000)
      await page.getByRole('button', { name: 'Pause reading' }).click()
      const fast = await position(page)
      expect(fast - slow).toBeCloseTo(60 / count, 2)
      expect(fast - slow).toBeGreaterThan((slow - initial) * 4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await page.screenshot({
        path: testInfo.outputPath(`novel-${format}-${mode}.png`),
        fullPage: true,
      })

      // A reader who scrolls manually should resume there, not jump back to the timer's position.
      await page.getByRole('button', { name: 'Resume reading' }).click()
      await viewport.dispatchEvent('wheel', { deltaY: 100 })
      await expect(page.getByRole('button', { name: 'Resume reading' })).toBeVisible()
      await viewport.evaluate((element) => {
        if (getComputedStyle(element).writingMode === 'vertical-rl')
          element.scrollLeft = -(element.scrollWidth - element.clientWidth) * 0.45
        else element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.45
      })
      await expect.poll(() => position(page)).toBeCloseTo(0.45, 2)
      await page.clock.runFor(1000)
      expect(await position(page)).toBeCloseTo(0.45, 2)
      await page.getByRole('button', { name: 'Resume reading' }).click()
      await page.clock.runFor(5000)
      await page.getByRole('button', { name: 'Pause reading' }).click()
      expect(await position(page)).toBeCloseTo(0.45 + 50 / count, 2)

      const otherMode = mode === 'vertical-rl' ? 'horizontal-tb' : 'vertical-rl'
      const beforeSwitch = await position(page)
      await page.getByLabel('Scroll direction', { exact: true }).selectOption(otherMode)
      await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', otherMode)
      await expect.poll(() => position(page)).toBeCloseTo(beforeSwitch, 2)
      await page.getByRole('button', { name: 'Reader settings' }).click()
      await page.getByLabel('Text size').fill('32')
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await expect.poll(() => position(page)).toBeCloseTo(beforeSwitch, 2)
      await page.getByRole('button', { name: 'Resume reading' }).click()
      await page.clock.runFor(Math.ceil((1 - beforeSwitch) * count * 100) + 500)
      await expect(page.getByLabel('Go to page')).toHaveValue('1')
      const nextCount = [...(await page.locator('.japanese-text').innerText())].filter(
        (char) => !/\s/.test(char),
      ).length
      await page.clock.runFor(nextCount * 100 + 1000)
      await expect(page.getByRole('heading', { name: 'A little progress, made.' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Resume reading' })).toBeDisabled()
      await page.getByRole('button', { name: 'Library', exact: true }).click()
      await page.reload()
      await page.getByRole('button', { name: 'Read Novel', exact: true }).click()
      await expect(page.getByLabel('Scroll direction')).toHaveValue(otherMode)
      await expect(page.getByLabel('Start at')).toHaveValue('1')
      await page.getByRole('button', { name: 'Let’s read' }).click()
      await expect(page.getByLabel('Reading speed')).toHaveValue('600')
      await expect(page.locator('.japanese-text')).toHaveCSS('writing-mode', otherMode)
      expect(errors).toEqual([])
    })
  }
}
