import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

async function startStory(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.locator('.japanese-text')).toContainText('朝、窓を開ける')
}

async function selectText(page: Page, text: string) {
  await page.locator('.japanese-text').evaluate((element, word) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const start = node.textContent?.indexOf(word) ?? -1
      if (start < 0) continue
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + word.length)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      break
    }
  }, text)
}

test('reading, lookup, highlights, words, quiz, and activity survive reload', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await startStory(page)
  await selectText(page, '朝')
  await expect(page.getByRole('button', { name: 'Resume reading' })).toBeVisible()
  await page.getByRole('button', { name: 'Look up', exact: true }).click()
  const lookup = page.getByRole('dialog', { name: 'A word to take with you' })
  await expect(lookup.locator('.dictionary-heading h3')).toHaveText('朝')
  await expect(lookup.locator('.word-reading')).toHaveText('あさ')
  await expect(lookup.getByText('morning', { exact: true })).toBeVisible()
  await lookup.getByRole('button', { name: 'Save word & sentence' }).click()
  await expect(lookup.getByRole('button', { name: 'Saved to your words' })).toBeDisabled()
  await lookup.getByRole('button', { name: 'Close dialog' }).click()
  await selectText(page, '静かな町')
  await page.getByRole('button', { name: 'Highlight', exact: true }).click()
  await expect(page.locator('.japanese-text mark')).toHaveText('静かな町')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.locator('.japanese-text')).toContainText('駅までの道')
  await page.getByRole('button', { name: 'Finish & quiz', exact: true }).click()
  const quiz = page.getByRole('dialog', { name: 'Let those words sink in' })
  await expect(quiz.locator('.quiz-word')).toHaveText('朝')
  await quiz.locator('.quiz-options button').filter({ hasText: 'あさ' }).click()
  await expect(quiz.getByText('You’ve got it.')).toBeVisible()
  for (let i = 0; i < 8; i++) {
    const resultButton = quiz.getByRole('button', { name: 'See your results' })
    if (await resultButton.isVisible()) {
      await resultButton.click()
      break
    }
    await quiz.getByRole('button', { name: 'Next word' }).click()
    await quiz.locator('.quiz-options button').first().click()
  }
  await expect(page.getByRole('dialog', { name: 'A little more familiar' })).toBeVisible()
  await page.getByRole('button', { name: 'All done' }).click()
  await page.reload()
  await page.getByRole('navigation').getByRole('button', { name: /Words/ }).click()
  await expect(page.locator('.word-card')).toHaveCount(1)
  await expect(page.locator('.word-context')).toContainText('朝、窓を開ける')
  await page.getByRole('button', { name: 'Practice words' }).click()
  await expect(page.locator('.quiz-word')).toHaveText('朝')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Activity/ })
    .click()
  await expect(page.locator('.session-row')).toHaveCount(1)
  await expect(page.locator('.session-metrics')).toContainText('2 pages')
  await expect(page.locator('.session-metrics')).toContainText('Quiz')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Library/ })
    .click()
  await page.getByRole('button', { name: 'Continue reading' }).click()
  await expect(page.getByLabel('Start at')).toHaveValue('1')
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.locator('.japanese-text mark')).toHaveText('静かな町')
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true })
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: 'Options for 小さな一歩' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove book', exact: true }).click()
  await expect(page.locator('.book-card')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(0)
  await page.getByRole('navigation').getByRole('button', { name: /Words/ }).click()
  await expect(page.locator('.word-card')).toHaveCount(1)
  await page
    .getByRole('navigation')
    .getByRole('button', { name: /Activity/ })
    .click()
  await expect(page.locator('.session-row')).toHaveCount(2)
  expect(errors).toEqual([])
})

test('imports multiple formats, reports bad imports, searches, and preserves saved history on removal', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('Import book files')
    .setInputFiles([fixture('japanese.txt'), fixture('deflated.epub'), fixture('shift-jis.txt')])
  await expect(page.locator('.book-card')).toHaveCount(4)
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(4)
  await page.getByLabel('Search books').fill('japanese')
  await expect(page.locator('.book-card')).toHaveCount(1)
  await page.getByLabel('Search books').fill('not-on-the-shelf')
  await expect(page.getByText('Nothing on this shelf yet')).toBeVisible()
  await page.getByLabel('Search books').fill('')
  await page.getByLabel('Import book files').setInputFiles(fixture('protected.epub'))
  await expect(page.getByRole('dialog')).toContainText('encrypted chapters')
  await page.getByRole('button', { name: 'Got it' }).click()
  await page.getByRole('button', { name: 'Options for japanese', exact: true }).click()
  await page.getByRole('button', { name: 'Mark finished', exact: true }).click()
  await page.getByRole('button', { name: 'Finished', exact: true }).click()
  await expect(page.locator('.book-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Options for japanese', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove book' }).click()
  await page.getByRole('button', { name: 'All books', exact: true }).click()
  await expect(page.locator('.book-card')).toHaveCount(3)
  await page.reload()
  await expect(page.locator('.book-card')).toHaveCount(3)
})

test('settings persist and the layout fits the screen', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('heading', { name: 'Your library' }).waitFor()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('library-light.png'), fullPage: true })
  await page
    .getByRole('button', { name: /^Settings/ })
    .filter({ visible: true })
    .click()
  await page.getByRole('button', { name: 'dark', exact: true }).click()
  await page.getByLabel('Reading pace').fill('240')
  await page.getByLabel('Text size').fill('30')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: testInfo.outputPath('library-dark.png'), fullPage: true })
  await page.getByRole('button', { name: 'Start reading', exact: true }).click()
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.getByLabel('Reading speed')).toHaveValue('240')
  await expect(page.locator('.japanese-text')).toHaveCSS('font-size', '30px')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('extracts selectable and Japanese PDFs and opens scanned pages with OCR', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page
    .getByLabel('Import book files')
    .setInputFiles([fixture('selectable.pdf'), fixture('japanese.pdf')])
  await expect(page.locator('.book-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Read japanese', exact: true }).click()
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.locator('.japanese-text')).toContainText('日本語の本')
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByLabel('Import book files').setInputFiles(fixture('scanned.pdf'))
  await expect(page.locator('.book-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'Read scanned', exact: true }).click()
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await expect(page.getByRole('img', { name: 'Artwork for page 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Select speech bubble' })).toBeEnabled({
    timeout: 30_000,
  })
  await expect(page.locator('.reader-subheader')).toContainText('Manual reading')
  expect(errors).toEqual([])
})

test('paced reading turns pages, respects the goal, and pauses for manual scrolling', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('Import book files').setInputFiles({
    name: 'pace.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('学校。'.repeat(300)),
  })
  await page.getByRole('button', { name: 'Read pace', exact: true }).click()
  await page.getByLabel('Number of pages').fill('2')
  await page.clock.install()
  await page.getByRole('button', { name: 'Let’s read' }).click()
  await page.getByLabel('Reading speed').fill('600')
  await page.clock.runFor(65_500)
  await expect(page.getByLabel('Go to page')).toHaveValue('1')
  await page.clock.runFor(26_000)
  await expect(page.getByRole('heading', { name: 'A little progress, made.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume reading' })).toBeDisabled()
  await page.getByRole('button', { name: 'Previous page' }).click()
  await page.getByRole('button', { name: 'Resume reading' }).click()
  await page.locator('.reader-scroll').dispatchEvent('wheel')
  await expect(page.getByRole('button', { name: 'Resume reading' })).toBeVisible()
})
