import { ArrowRight, Bookmark, Search, Trash2, Volume2 } from 'lucide-react'
import { useState } from 'react'
import type { SavedWord } from '../types'
import { speakJapanese } from '../lib/dictionary'
import { Empty } from './UI'

export default function Words({
  words,
  onRemove,
  onPractice,
  onLookup,
  onMessage,
}: {
  words: SavedWord[]
  onRemove: (id: string) => void
  onPractice: () => void
  onLookup: (word: SavedWord) => void
  onMessage: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const visible = words.filter((word) =>
    `${word.entry.word} ${word.entry.reading} ${word.entry.meanings.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">COLLECT WORDS, FIND CONNECTIONS</div>
        <h1>
          Words that
          <br />
          <em>stay with you.</em>
        </h1>
        <p>Little discoveries from the stories you read.</p>
      </section>
      <div className="section-heading">
        <div className="section-title">
          <h2>Your words</h2>
          <span className="count">{words.length}</span>
        </div>
        <button className="primary" disabled={!words.length} onClick={onPractice}>
          Practice words <ArrowRight size={17} />
        </button>
      </div>
      <label className="search-field words-search">
        <Search size={17} />
        <input
          aria-label="Search saved words"
          placeholder="Find a word, reading, or meaning…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!visible.length ? (
        <Empty
          icon={<Bookmark size={27} />}
          title={words.length ? 'No matching words' : 'A new word is a new beginning'}
        >
          {words.length
            ? 'Try searching for another reading or meaning.'
            : 'Select a word while reading, look it up, and save it here with its original sentence.'}
        </Empty>
      ) : (
        <div className="word-list">
          {visible.map((word) => (
            <article className="word-card" key={word.id}>
              <div className="word-card-top">
                <button className="word-title" onClick={() => onLookup(word)}>
                  <span lang="ja">{word.entry.reading}</span>
                  <strong lang="ja">{word.entry.word}</strong>
                </button>
                <div className="inline-actions">
                  <button
                    className="icon-button"
                    aria-label={`Pronounce ${word.entry.word}`}
                    onClick={() => {
                      const error = speakJapanese(word.entry.reading)
                      if (error) onMessage(error)
                    }}
                  >
                    <Volume2 size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${word.entry.word}`}
                    onClick={() => onRemove(word.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="word-meaning">{word.entry.meanings.slice(0, 3).join('; ')}</p>
              {word.sentence && (
                <p className="word-context" lang="ja">
                  {word.sentence}
                </p>
              )}
              <p className="word-source">
                {word.bookTitle} <span>·</span> Page {word.page + 1}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
