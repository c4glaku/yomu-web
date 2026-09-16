import { expect, it } from 'vitest'
import type { OcrRegion } from '../types'
import { cleanOcrText, mergeRegions, orderRegions } from './ocr'

const region = (id: string, x: number, y: number): OcrRegion => ({
  id,
  text: id,
  x,
  y,
  width: 0.1,
  height: 0.2,
})

it('orders separate manga rows top to bottom and bubbles right to left', () => {
  const regions = [region('bottom', 0.7, 0.7), region('left', 0.1, 0.1), region('right', 0.8, 0.15)]
  expect(orderRegions(regions).map((item) => item.id)).toEqual(['right', 'left', 'bottom'])
})

it('replaces rescanned bubbles while preserving other page text', () => {
  const old = [region('left', 0.1, 0.1), region('right', 0.8, 0.1)]
  expect(
    mergeRegions(old, [region('corrected', 0.8, 0.1)], {
      x: 0.7,
      y: 0,
      width: 0.3,
      height: 0.4,
    }).map((item) => item.id),
  ).toEqual(['corrected', 'left'])
})

it('joins Japanese OCR spacing without losing spaces in Latin text', () => {
  expect(cleanOcrText(' 日 本 語\nの 本。 Hello world! ')).toBe('日本語の本。 Hello world!')
})
