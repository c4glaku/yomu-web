import { ArrowRight, BookOpen } from 'lucide-react'
import { useState } from 'react'
import type { Book } from '../types'
import { Modal } from './UI'

export type ReadingPlan = { start: number; end: number | null }

export default function SessionSetup({ book, onStart, onClose }: { book: Book; onStart: (plan: ReadingPlan) => void; onClose: () => void }) {
  const [start, setStart] = useState(book.position)
  const [goal, setGoal] = useState('pages')
  const [count, setCount] = useState(Math.min(3, book.pages.length - start))
  const chapter = book.pages[start].chapter
  let chapterEnd = start
  while (chapterEnd + 1 < book.pages.length && book.pages[chapterEnd + 1].chapter === chapter) chapterEnd++
  const end = goal === 'free' ? null : goal === 'chapter' ? chapterEnd : goal === 'book' ? book.pages.length - 1 : Math.min(book.pages.length - 1, start + Math.max(1, count) - 1)
  return <Modal title="A little time for reading" onClose={onClose}><div className="setup-book"><BookOpen size={22} /><div><h3 lang="ja">{book.title}</h3><p>{book.pages.length} pages · {book.author}</p></div></div><label className="field-label">Start at<select value={start} onChange={event => setStart(Number(event.target.value))}>{book.pages.map((page, i) => <option key={i} value={i}>Page {i + 1} — {page.chapter}</option>)}</select></label><div className="field-label">Your goal<div className="goal-grid">{[['pages', 'A few pages', 'Small steps count'], ['chapter', 'This chapter', 'One story at a time'], ['book', 'Rest of the book', 'See where it goes'], ['free', 'Free reading', 'No finish line']].map(([value, label, help]) => <button key={value} className={goal === value ? 'selected' : ''} aria-pressed={goal === value} onClick={() => setGoal(value)}><strong>{label}</strong><span>{help}</span></button>)}</div></div>{goal === 'pages' && <label className="field-label">Number of pages<input type="number" min="1" max={book.pages.length - start} value={count} onChange={event => setCount(Math.max(1, Math.min(book.pages.length - start, Number(event.target.value))))} /></label>}<p className="small muted">{end === null ? 'Read at your own pace, and finish whenever you like.' : `Pages ${start + 1}–${end + 1}. You can pause or finish at any time.`}</p><button className="primary full-width" onClick={() => onStart({ start, end })}>Let’s read <ArrowRight size={17} /></button></Modal>
}
