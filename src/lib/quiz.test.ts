import { describe, expect, it } from 'vitest'
import type { Candidate, Entry } from '../types'
import { buildQuiz } from './quiz'
import { dictionaryForms, sentenceFor } from './dictionary'

const entries: Entry[] = [
  ['学校', 'がっこう', 'school'],
  ['時間', 'じかん', 'time'],
  ['物語', 'ものがたり', 'story'],
  ['友達', 'ともだち', 'friend'],
  ['旅行', 'りょこう', 'travel'],
  ['天気', 'てんき', 'weather'],
].map(([word, reading, meaning], id) => ({
  id,
  word,
  reading,
  meanings: [meaning],
  pos: 'noun',
  common: true,
}))

describe('dictionary and quiz logic', () => {
  it.each([
    ['読みました', '読む'],
    ['食べた', '食べる'],
    ['歩いて', '歩く'],
    ['美しかった', '美しい'],
    ['読まない', '読む'],
    ['行った', '行く'],
  ])('finds %s → %s', (surface, lemma) => {
    expect(dictionaryForms(surface)).toContain(lemma)
  })

  it('keeps the selected word’s original sentence', () => {
    expect(sentenceFor('学校', '今日は晴れです。学校に行きます。友達がいます。')).toBe(
      '学校に行きます。',
    )
  })

  it('prioritizes saved words, deduplicates, and makes unambiguous choices', () => {
    const candidates: Candidate[] = entries
      .slice(0, 3)
      .map((entry, page) => ({ entry, page, sentence: `${entry.word}です。`, priority: page }))
    const questions = buildQuiz(
      [...candidates, { ...candidates[2], priority: 5 }],
      entries,
      () => 0.4,
    )
    expect(questions).toHaveLength(3)
    expect(questions[0].entry.word).toBe('物語')
    expect(new Set(questions.map((question) => question.kind)).size).toBe(2)
    for (const question of questions) {
      expect(new Set(question.options).size).toBe(4)
      expect(question.options.filter((option) => option === question.answer)).toHaveLength(1)
      expect(question.sentence).toContain(question.entry.word)
    }
  })

  it('returns an empty quiz when there are no words or distinct distractors', () => {
    expect(buildQuiz([], entries)).toEqual([])
    expect(
      buildQuiz([{ entry: entries[0], sentence: '', page: 0, priority: 1 }], [entries[0]]),
    ).toEqual([])
  })
})
