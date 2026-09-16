import { expect, it } from 'vitest'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { pdfText } from './pdf'

const item = (str: string, x: number, y: number, dir = 'ttb'): TextItem => ({
  str,
  dir,
  transform: [20, 0, 0, 20, x, y],
  width: 20,
  height: 20,
  fontName: 'japanese',
  hasEOL: false,
})

it('reads shuffled vertical PDF glyphs down each column and then left', () => {
  expect(
    pdfText(
      [
        item('本', 100, 180),
        item('日', 200, 200),
        item('語', 200.1, 160),
        item('の', 100, 200),
        item('本', 199.9, 180),
      ],
      {},
    ),
  ).toBe('日本語\nの本')
})

it('recognizes vertical font metadata and preserves horizontal extraction', () => {
  expect(
    pdfText([item('後', 10, 10, 'ltr'), item('先', 10, 30, 'ltr')], {
      japanese: { vertical: true, fontFamily: 'serif', ascent: 0.8, descent: -0.2 },
    }),
  ).toBe('先後')
  expect(
    pdfText([{ ...item('First', 0, 0, 'ltr'), hasEOL: true }, item('Second', 0, 20, 'ltr')], {}),
  ).toBe('First\nSecond')
})
