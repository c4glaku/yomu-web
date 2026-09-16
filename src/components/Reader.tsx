import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Highlighter,
  Pause,
  Play,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book, Selection, Settings as Preferences } from '../types'
import { sentenceFor } from '../lib/dictionary'
import { Brand, formatTime, Modal } from './UI'
import Settings from './Settings'
import type { ReadingPlan } from './SessionSetup'

export type ReadingResult = { pages: number[]; seconds: number; startedAt: string; quiz: boolean }

export default function Reader({
  book,
  settings,
  plan,
  onUpdate,
  onSettings,
  onLookup,
  onFinish,
}: {
  book: Book
  settings: Preferences
  plan: ReadingPlan
  onUpdate: (patch: Partial<Book>) => void
  onSettings: (patch: Partial<Preferences>) => void
  onLookup: (selection: Selection) => void
  onFinish: (result: ReadingResult) => void
}) {
  const [page, setPage] = useState(plan.start)
  const [running, setRunning] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [progress, setProgress] = useState(0)
  const [goalReached, setGoalReached] = useState(false)
  const [freeReading, setFreeReading] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)
  const visited = useRef(new Set<number>())
  const startedAt = useRef(new Date().toISOString())
  const activeMs = useRef(0)
  const pageProgress = useRef(0)
  const finished = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLElement>(null)
  const content = book.pages[page]

  useEffect(() => {
    visited.current.add(page)
    pageProgress.current = 0
    setProgress(0)
    setSelection(null)
    setGoalReached(false)
    scrollRef.current?.scrollTo({ top: 0 })
    onUpdate({
      position: page,
      openedAt: new Date().toISOString(),
      readPages: [...new Set([...book.readPages, ...visited.current])],
    })
  }, [page])

  useEffect(() => {
    const pause = () => setRunning(false)
    const visibility = () => {
      if (document.hidden) pause()
    }
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const count = Math.max(
      10,
      [...content.text].filter((character) => !/\s/.test(character)).length,
    )
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = Math.min(1000, now - last)
      last = now
      activeMs.current += delta
      setSeconds(Math.floor(activeMs.current / 1000))
      pageProgress.current = Math.min(
        1,
        pageProgress.current + (delta * settings.speed) / (count * 60000),
      )
      setProgress(pageProgress.current)
      const container = scrollRef.current
      if (container)
        container.scrollTop =
          Math.max(0, container.scrollHeight - container.clientHeight) * pageProgress.current
      if (pageProgress.current >= 1) {
        if (
          (!freeReading && plan.end !== null && page >= plan.end) ||
          page === book.pages.length - 1
        ) {
          setRunning(false)
          setGoalReached(true)
        } else setPage((current) => current + 1)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [running, page, content.text, settings.speed, freeReading, plan.end, book.pages.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest('input, select, textarea, button') ||
        document.querySelector('dialog[open]')
      )
        return
      if (event.code === 'Space') {
        event.preventDefault()
        if (!goalReached) setRunning((value) => !value)
      }
      if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
        setRunning(false)
      if (event.key === 'ArrowRight' && page < book.pages.length - 1) {
        setRunning(false)
        setPage(page + 1)
      }
      if (event.key === 'ArrowLeft' && page > 0) {
        setRunning(false)
        setPage(page - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, book.pages.length, goalReached])

  const captureSelection = useCallback(() => {
    const selected = window.getSelection()
    if (!selected?.rangeCount || !textRef.current) return
    const range = selected.getRangeAt(0)
    if (!textRef.current.contains(range.commonAncestorContainer)) return
    const text = selected.toString()
    if (!text.trim()) {
      setSelection(null)
      return
    }
    setRunning(false)
    const before = range.cloneRange()
    before.selectNodeContents(textRef.current)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    setSelection({
      text,
      sentence: sentenceFor(text, content.text),
      start,
      end: start + text.length,
      page,
    })
  }, [page, content.text])

  useEffect(() => {
    document.addEventListener('selectionchange', captureSelection)
    return () => document.removeEventListener('selectionchange', captureSelection)
  }, [captureSelection])

  const finish = (quiz: boolean) => {
    if (finished.current) return
    finished.current = true
    setRunning(false)
    const readPages = [...new Set([...book.readPages, ...visited.current])]
    onUpdate({ completed: book.completed || readPages.length === book.pages.length, readPages })
    onFinish({
      pages: [...visited.current],
      seconds: Math.floor(activeMs.current / 1000),
      startedAt: startedAt.current,
      quiz,
    })
  }

  const highlights = book.highlights.filter((highlight) => highlight.page === page)
  const boundaries = [
    ...new Set([
      0,
      content.text.length,
      ...highlights.flatMap((highlight) => [highlight.start, highlight.end]),
    ]),
  ].sort((a, b) => a - b)

  return (
    <div className="reader">
      <header className="reader-header">
        <button className="back-button" onClick={() => finish(false)}>
          <ArrowLeft size={18} />
          <span>Library</span>
        </button>
        <Brand />
        <div className="reader-header-actions">
          <button
            className="icon-button"
            aria-label="View highlights"
            onClick={() => {
              setRunning(false)
              setShowHighlights(true)
            }}
          >
            <Bookmark size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="Reader settings"
            onClick={() => {
              setRunning(false)
              setShowSettings(true)
            }}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      <div className="reader-progress-track">
        <div style={{ width: `${((page + progress) / book.pages.length) * 100}%` }} />
      </div>
      <div className="reader-subheader">
        <span lang="ja">{book.title}</span>
        <span>
          <span className={`status-dot ${running ? 'playing' : ''}`} />
          {running ? 'Reading' : 'Paused'}
          <span className="subheader-time"> · {formatTime(seconds)}</span>
        </span>
        <span>
          {plan.end === null || freeReading
            ? 'Free reading'
            : `Goal: ${plan.end - plan.start + 1} pages`}
        </span>
      </div>
      <div
        className="reader-scroll"
        ref={scrollRef}
        onWheel={() => setRunning(false)}
        onTouchStart={() => setRunning(false)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setRunning(false)
        }}
      >
        <div className="reading-page">
          <div className="eyebrow reader-chapter" lang="ja">
            {content.chapter}
          </div>
          <article
            ref={textRef}
            className="japanese-text"
            lang="ja"
            style={{ fontSize: settings.fontSize }}
            onPointerDown={() => setRunning(false)}
            onMouseUp={captureSelection}
            onTouchEnd={() => window.setTimeout(captureSelection, 50)}
            onKeyUp={captureSelection}
            onSelect={captureSelection}
          >
            {content.text ? (
              boundaries
                .slice(0, -1)
                .map((start, i) =>
                  highlights.some(
                    (highlight) => highlight.start <= start && highlight.end > start,
                  ) ? (
                    <mark key={start}>{content.text.slice(start, boundaries[i + 1])}</mark>
                  ) : (
                    <span key={start}>{content.text.slice(start, boundaries[i + 1])}</span>
                  ),
                )
            ) : (
              <span className="muted">
                This PDF page has no selectable text. Move to the next page to keep reading.
              </span>
            )}
          </article>
          <div className="page-end">
            <span />
            {String(page + 1).padStart(2, '0')}
            <span />
          </div>
          <p className="reading-hint">Select a word to look it up or highlight a passage.</p>
          {goalReached && (
            <div className="goal-complete">
              <Check size={23} />
              <h3>A little progress, made.</h3>
              <p>
                You’ve reached{' '}
                {page === book.pages.length - 1 ? 'the end of the book' : 'your reading goal'}.
              </p>
              <button className="primary" onClick={() => finish(true)}>
                Finish & quiz <ArrowRight size={16} />
              </button>
              {page < book.pages.length - 1 && (
                <button
                  className="text-button"
                  onClick={() => {
                    setFreeReading(true)
                    setPage(page + 1)
                    setRunning(true)
                  }}
                >
                  Keep reading
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {selection && (
        <div className="selection-toolbar" role="region" aria-label="Text selection actions">
          <span lang="ja">{selection.text}</span>
          <button
            disabled={selection.text.length > 80}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setRunning(false)
              onLookup(selection)
            }}
          >
            <Search size={16} />
            Look up
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onUpdate({
                highlights: [...book.highlights, { id: crypto.randomUUID(), ...selection }],
              })
              setSelection(null)
              window.getSelection()?.removeAllRanges()
            }}
          >
            <Highlighter size={16} />
            Highlight
          </button>
        </div>
      )}
      <footer className="reader-controls">
        <div className="reader-page-controls">
          <button
            className="icon-button"
            disabled={page === 0}
            aria-label="Previous page"
            onClick={() => {
              setRunning(false)
              setPage(page - 1)
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <label>
            <span className="sr-only">Go to page</span>
            <select
              value={page}
              onChange={(event) => {
                setRunning(false)
                setPage(Number(event.target.value))
              }}
            >
              {book.pages.map((_, i) => (
                <option value={i} key={i}>
                  Page {i + 1} / {book.pages.length}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            disabled={page === book.pages.length - 1}
            aria-label="Next page"
            onClick={() => {
              setRunning(false)
              setPage(page + 1)
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="pace-controls">
          <button
            className="play-button"
            aria-label={running ? 'Pause reading' : 'Resume reading'}
            disabled={goalReached}
            onClick={() => setRunning(!running)}
          >
            {running ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" />
            )}
          </button>
          <label className="pace-label">
            <span>
              {settings.speed} <small>chars/min</small>
            </span>
            <input
              aria-label="Reading speed"
              type="range"
              min="30"
              max="600"
              step="10"
              value={settings.speed}
              onChange={(event) => onSettings({ speed: Number(event.target.value) })}
            />
          </label>
        </div>
        <div className="reader-finish">
          <button
            className="icon-button"
            aria-label="Open dictionary"
            onClick={() => {
              setRunning(false)
              onLookup({ text: '', sentence: '', start: 0, end: 0, page })
            }}
          >
            <Search size={18} />
          </button>
          <button className="secondary" onClick={() => finish(true)}>
            <Flag size={15} />
            <span>Finish & quiz</span>
          </button>
        </div>
      </footer>
      {showSettings && (
        <Settings
          settings={settings}
          onChange={onSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showHighlights && (
        <Modal title="Your highlights" onClose={() => setShowHighlights(false)}>
          {book.highlights.length ? (
            book.highlights.map((highlight) => (
              <div className="highlight-row" key={highlight.id}>
                <button
                  onClick={() => {
                    setPage(highlight.page)
                    setShowHighlights(false)
                  }}
                >
                  <span lang="ja">{highlight.text}</span>
                  <small>Page {highlight.page + 1}</small>
                </button>
                <button
                  className="icon-button"
                  aria-label="Remove highlight"
                  onClick={() =>
                    onUpdate({
                      highlights: book.highlights.filter((item) => item.id !== highlight.id),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="muted">
              Select a passage in the reader and choose Highlight. Your favorite lines will be
              waiting here.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
