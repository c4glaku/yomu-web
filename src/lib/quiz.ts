import type { Candidate, Entry, Question } from '../types'

export const meaning = (entry: Entry) => entry.meanings.slice(0, 2).join('; ')

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function buildQuiz(
  candidates: Candidate[],
  pool: Entry[],
  random = Math.random,
): Question[] {
  const seen = new Set<string>()
  const selected = [...candidates]
    .sort((a, b) => b.priority - a.priority)
    .filter((candidate) => {
      if (seen.has(candidate.entry.word)) return false
      seen.add(candidate.entry.word)
      return true
    })
    .slice(0, 8)
  return selected.flatMap((candidate, i) => {
    const kind =
      i % 2 === 0 && candidate.entry.word !== candidate.entry.reading ? 'reading' : 'meaning'
    const label = (entry: Entry) => (kind === 'reading' ? entry.reading : meaning(entry))
    const answer = label(candidate.entry)
    const choices = new Set([answer])
    for (const entry of shuffle(pool, random)) {
      if (
        entry.word === candidate.entry.word ||
        entry.reading === candidate.entry.reading ||
        entry.meanings.some((value) => candidate.entry.meanings.includes(value))
      )
        continue
      if (label(entry)) choices.add(label(entry))
      if (choices.size === 4) break
    }
    return choices.size === 4
      ? [
          {
            entry: candidate.entry,
            sentence: candidate.sentence,
            page: candidate.page,
            kind,
            answer,
            options: shuffle([...choices], random),
          },
        ]
      : []
  })
}
