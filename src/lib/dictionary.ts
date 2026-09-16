import { gunzipSync, strFromU8 } from 'fflate'
import type { Candidate, Entry, Kanji, Page } from '../types'

type Row = [number, string, string, string[], string, number]
type Dictionary = { entries: Entry[]; index: Map<string, Entry[]> }
let commonPromise: Promise<Dictionary> | undefined
let kanjiPromise: Promise<Map<string, Kanji>> | undefined
const shards = new Map<number, Promise<Dictionary>>()

async function readData<T>(name: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}dictionary/${name}.json.gz`)
  if (!response.ok) throw new Error('The local dictionary could not be loaded. Try again after the page finishes loading.')
  return JSON.parse(strFromU8(gunzipSync(new Uint8Array(await response.arrayBuffer()))))
}

function indexRows(rows: Row[]): Dictionary {
  const entries = rows.map(([id, word, reading, meanings, pos, common]) => ({ id, word, reading, meanings, pos, common: !!common }))
  const index = new Map<string, Entry[]>()
  for (const entry of entries) for (const form of new Set([entry.word, entry.reading])) index.set(form, [...(index.get(form) ?? []), entry])
  return { entries, index }
}

export function commonDictionary() {
  return commonPromise ??= readData<Row[]>('common').then(indexRows).catch(error => { commonPromise = undefined; throw error })
}

async function rareDictionary(form: string) {
  const bucket = form.codePointAt(0)! % 64
  if (!shards.has(bucket)) shards.set(bucket, readData<Row[]>(`rare-${bucket}`).then(indexRows).catch(error => { shards.delete(bucket); throw error }))
  return shards.get(bucket)!
}

export function dictionaryForms(text: string): string[] {
  const result = new Set([text])
  const rules: [string, string[]][] = [
    ['ました', ['る']], ['ます', ['る']], ['ません', ['る']], ['なかった', ['る']], ['ない', ['る']],
    ['かった', ['い']], ['くない', ['い']], ['くて', ['い']],
    ['って', ['う', 'つ', 'る']], ['った', ['う', 'つ', 'る']], ['んで', ['む', 'ぶ', 'ぬ']], ['んだ', ['む', 'ぶ', 'ぬ']],
    ['いて', ['く']], ['いた', ['く']], ['いで', ['ぐ']], ['いだ', ['ぐ']], ['して', ['す', 'する']], ['した', ['す', 'する']], ['て', ['る']], ['た', ['る']],
  ]
  const polite: Record<string, string> = { い: 'う', き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る' }
  const negative: Record<string, string> = { わ: 'う', か: 'く', が: 'ぐ', さ: 'す', た: 'つ', な: 'ぬ', ば: 'ぶ', ま: 'む', ら: 'る' }
  for (const [suffix, endings] of rules) {
    if (!text.endsWith(suffix) || text.length <= suffix.length) continue
    const stem = text.slice(0, -suffix.length)
    for (const ending of endings) result.add(stem + ending)
    const ending = (['ました', 'ます', 'ません'].includes(suffix) ? polite : ['ない', 'なかった'].includes(suffix) ? negative : {})[stem.slice(-1)]
    if (ending) result.add(stem.slice(0, -1) + ending)
  }
  for (const [surface, lemma] of [['した', 'する'], ['して', 'する'], ['します', 'する'], ['しました', 'する'], ['来た', '来る'], ['きた', 'くる'], ['行った', '行く'], ['行って', '行く']]) if (text === surface) result.add(lemma)
  return [...result]
}

export async function lookup(text: string): Promise<Entry[]> {
  const query = text.trim().normalize('NFC')
  if (!query || query.length > 80) return []
  const common = await commonDictionary()
  const direct = [...(common.index.get(query) ?? []), ...((await rareDictionary(query)).index.get(query) ?? [])]
  if (direct.length) return direct.slice(0, 16)
  const forms = dictionaryForms(query).slice(1)
  for (const form of forms) {
    const matches = common.index.get(form)
    if (matches?.length) return matches.slice(0, 16)
  }
  const dictionaries = await Promise.all(forms.map(rareDictionary))
  for (let i = 0; i < forms.length; i++) {
    const matches = dictionaries[i].index.get(forms[i])
    if (matches?.length) return matches.slice(0, 16)
  }
  return []
}

export async function kanjiFor(text: string): Promise<Kanji[]> {
  kanjiPromise ??= readData<[string, string[], string[], string[]][]>('kanji').then(rows => new Map(rows.map(([character, onyomi, kunyomi, meanings]) => [character, { character, onyomi, kunyomi, meanings }]))).catch(error => { kanjiPromise = undefined; throw error })
  const map = await kanjiPromise
  return [...new Set(text)].map(character => map.get(character)).filter((item): item is Kanji => !!item)
}

export function sentenceFor(word: string, text: string) {
  return (text.split(/(?<=[。！？])|\n/).find(sentence => sentence.includes(word)) ?? text).trim().slice(0, 220)
}

export async function extractCandidates(pages: { page: Page; index: number }[]): Promise<Candidate[]> {
  const { index } = await commonDictionary()
  const segmenter = new Intl.Segmenter('ja', { granularity: 'word' })
  const seen = new Set<string>()
  const candidates: Candidate[] = []
  for (const { page, index: pageIndex } of pages) {
    const segments = [...segmenter.segment(page.text)]
    for (let i = 0; i < segments.length; i++) {
      for (let length = Math.min(4, segments.length - i); length >= 1; length--) {
        const surface = segments.slice(i, i + length).map(token => token.segment).join('')
        if (surface.length < 2 || surface.length > 24 || !/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(surface)) continue
        const entry = dictionaryForms(surface).map(form => index.get(form)?.[0]).find(Boolean)
        if (!entry || (!/\p{Script=Han}/u.test(surface) && (entry.word !== surface || surface.length < 3 || /auxiliary|suffix/.test(entry.pos)))) continue
        if (!seen.has(entry.word)) {
          seen.add(entry.word)
          candidates.push({ entry, sentence: sentenceFor(surface, page.text), page: pageIndex, priority: 1 })
        }
        i += length - 1
        break
      }
      if (candidates.length >= 40) return candidates
    }
  }
  return candidates
}

export function speakJapanese(text: string): string | undefined {
  if (!('speechSynthesis' in window)) return 'Pronunciation is not supported in this browser.'
  const voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('ja'))
  if (!voices.length) return 'No Japanese voice is available. Add a Japanese speech voice in your device settings and reopen the browser.'
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'
  utterance.voice = voices.find(voice => voice.localService) ?? voices[0]
  utterance.rate = 0.85
  speechSynthesis.cancel()
  speechSynthesis.speak(utterance)
}
