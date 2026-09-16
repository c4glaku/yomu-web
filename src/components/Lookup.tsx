import { Bookmark, Check, Search, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Entry, Kanji, SavedWord } from '../types'
import { kanjiFor, lookup, speakJapanese } from '../lib/dictionary'
import { Modal } from './UI'

export type LookupSource = { text: string; sentence: string; bookTitle: string; bookId: string; page: number }

export default function Lookup({ source, words, onSave, onFound, onClose }: { source: LookupSource; words: SavedWord[]; onSave: (entry: Entry) => void; onFound: (entry: Entry) => void; onClose: () => void }) {
  const [query, setQuery] = useState(source.text)
  const [term, setTerm] = useState(source.text)
  const [entries, setEntries] = useState<Entry[]>([])
  const [kanji, setKanji] = useState<Kanji[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const entry = entries[selected]
  useEffect(() => {
    let ignore = false
    setLoading(true); setError(''); setSelected(0)
    Promise.all([lookup(term), kanjiFor(term)]).then(([matches, characters]) => { if (!ignore) { setEntries(matches); setKanji(characters); if (matches[0]) onFound(matches[0]) } }).catch(error => { if (!ignore) setError(error.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [term])
  const saved = words.some(word => word.entry.id === entry?.id)
  return <Modal title="A word to take with you" onClose={onClose}><form className="lookup-search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()) }}><Search size={17} /><input aria-label="Look up a Japanese word" placeholder="Search a Japanese word…" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} /><button className="text-button" type="submit">Look up</button></form>
    {loading ? <div className="empty"><span className="spinner" /><p>Opening the dictionary…</p></div> : error ? <p className="error-message" role="alert">{error}</p> : !entry ? <div className="empty"><h3>No match this time</h3><p>Select a shorter word, or try its dictionary form. Names and unusual spellings may not have an entry.</p></div> : <>
      <div className="dictionary-heading"><div><p lang="ja" className="word-reading">{entry.reading}</p><h3 lang="ja">{entry.word}</h3></div><button className="icon-button speech-button" aria-label={`Pronounce ${entry.word}`} onClick={() => { const error = speakJapanese(entry.reading); if (error) setError(error) }}><Volume2 size={23} /></button></div><p className="part-of-speech">{entry.pos}</p><ol className="definitions">{entry.meanings.map((meaning, i) => <li key={i}>{meaning}</li>)}</ol>
      {source.sentence && <blockquote className="source-sentence"><p lang="ja">{source.sentence}</p><cite>{source.bookTitle} · Page {source.page + 1}</cite></blockquote>}
      <button className={`primary full-width ${saved ? 'saved-button' : ''}`} disabled={saved} onClick={() => onSave(entry)}>{saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? 'Saved to your words' : 'Save word & sentence'}</button>
      {entries.length > 1 && <label className="field-label matching-senses">Other readings & senses<select value={selected} onChange={event => { const value = Number(event.target.value); setSelected(value); onFound(entries[value]) }}>{entries.map((match, i) => <option key={match.id} value={i}>{match.word} · {match.reading} — {match.meanings[0]}</option>)}</select></label>}
      {kanji.length > 0 && <section className="kanji-section"><h4>Inside the kanji</h4><p className="small muted">Character readings; the whole-word reading appears above.</p>{kanji.map(character => <div className="kanji-row" key={character.character}><span lang="ja">{character.character}</span><div><strong>{character.meanings.join(', ')}</strong><p><small>ON</small><span lang="ja">{character.onyomi.join('、') || '—'}</span></p><p><small>KUN</small><span lang="ja">{character.kunyomi.join('、') || '—'}</span></p></div></div>)}</section>}
    </>}
  </Modal>
}
