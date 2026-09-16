import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'fflate'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('bundled dictionary', () => {
  it.each([false, true])('loads real entries with browser decompression = %s', async (decoded) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const compressed = new Uint8Array(readFileSync(resolve('public', url.replace(/^\//, ''))))
        const bytes = decoded ? gunzipSync(compressed) : compressed
        return {
          ok: true,
          arrayBuffer: async () =>
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        }
      }),
    )
    const { lookup, kanjiFor, extractCandidates } = await import('./dictionary')
    expect((await lookup('朝'))[0]).toMatchObject({ word: '朝', reading: 'あさ' })
    expect((await lookup('読みました'))[0].word).toBe('読む')
    expect((await lookup('木漏れ日'))[0]).toMatchObject({
      word: '木漏れ日',
      reading: 'こもれび',
      common: false,
    })
    expect((await kanjiFor('学校')).map((kanji) => kanji.character)).toEqual(['学', '校'])
    const candidates = await extractCandidates([
      { index: 0, page: { text: '学校で友達と勉強しました。', chapter: 'Test' } },
    ])
    expect(candidates.map((candidate) => candidate.entry.word)).toContain('友達')
    expect(await lookup('qwertydoesnotexist')).toEqual([])
  })
})
