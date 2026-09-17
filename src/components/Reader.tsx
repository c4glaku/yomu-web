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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Book, Selection, Settings as Preferences } from '../types'
import { sentenceFor } from '../lib/dictionary'
import { Brand, formatTime, Modal } from './UI'
import Settings from './Settings'
import type { ReadingPlan } from './SessionSetup'
import IllustratedPage from './IllustratedPage'
import ReadingDirection from './ReadingDirection'

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
  const [running, setRunning] = useState(
    !!book.pages[plan.start].text.trim() &&
      !book.pages[plan.start].image &&
      book.readingView !== 'original',
  )
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
  const textScrollRef = useRef<HTMLDivElement>(null)
  const content = book.pages[page]
  const hasText = !!content.text.trim()
  const original =
    !!content.image || (!!book.pdfSource && (!hasText || book.readingView === 'original'))
  const vertical = settings.writingMode === 'vertical-rl' && !original
  const rightToLeft = original || vertical
  const canPace = !original && hasText
  const canQuiz = hasText || [...visited.current].some((index) => book.pages[index].text.trim())

  useLayoutEffect(() => {
    pageProgress.current = 0
    setProgress(0)
    setSelection(null)
    setGoalReached(false)
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
    textScrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [page])

  useEffect(() => {
    visited.current.add(page)
    onUpdate({
      position: page,
      openedAt: new Date().toISOString(),
      readPages: [...new Set([...book.readPages, ...visited.current])],
    })
  }, [page])

  useEffect(() => {
    if (!canPace) setRunning(false)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [canPace, vertical, page])

  // Keep the same reading position when the direction, font size, or screen changes.
  const positionText = useCallback(() => {
    const viewport = textScrollRef.current
    if (!viewport || !canPace) return
    viewport.scrollTo({
      left: vertical
        ? -Math.max(0, viewport.scrollWidth - viewport.clientWidth) * pageProgress.current
        : 0,
      top: vertical
        ? 0
        : Math.max(0, viewport.scrollHeight - viewport.clientHeight) * pageProgress.current,
    })
  }, [canPace, vertical])

  useLayoutEffect(() => {
    positionText()
    const observer = new ResizeObserver(positionText)
    if (textScrollRef.current) observer.observe(textScrollRef.current)
    if (textRef.current) observer.observe(textRef.current)
    return () => observer.disconnect()
  }, [positionText, page, settings.fontSize])

  useEffect(() => {
    const viewport = textScrollRef.current
    if (!vertical || !viewport) return
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      setRunning(false)
      if (viewport.scrollWidth <= viewport.clientWidth) return
      event.preventDefault()
      viewport.scrollLeft +=
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : -event.deltaY
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => viewport.removeEventListener('wheel', wheel)
  }, [vertical])

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
    if (!running || !canPace) return
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
      positionText()
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
  }, [
    running,
    page,
    content.text,
    settings.speed,
    freeReading,
    plan.end,
    book.pages.length,
    positionText,
    canPace,
  ])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest('input, select, textarea, button') ||
        document.querySelector('dialog[open]')
      )
        return
      if (event.code === 'Space') {
        event.preventDefault()
        if (!goalReached && canPace) setRunning((value) => !value)
      }
      if (['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
        setRunning(false)
      if (
        event.key === (rightToLeft ? 'ArrowLeft' : 'ArrowRight') &&
        page < book.pages.length - 1
      ) {
        event.preventDefault()
        setRunning(false)
        setPage(page + 1)
      }
      if (event.key === (rightToLeft ? 'ArrowRight' : 'ArrowLeft') && page > 0) {
        event.preventDefault()
        setRunning(false)
        setPage(page - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, book.pages.length, goalReached, rightToLeft, canPace])

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
    <div
      className={`reader ${rightToLeft ? 'reader-rtl' : ''} ${original ? 'reader-original' : ''}`}
    >
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
            disabled={!hasText && !book.highlights.length}
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
          {original ? 'Manual reading' : running ? 'Reading' : 'Paused'}
          <span className="subheader-time"> · {formatTime(seconds)}</span>
        </span>
        <span>
          {plan.end === null || freeReading
            ? 'Free reading'
            : `Goal: ${plan.end - plan.start + 1} pages`}
        </span>
      </div>
      {(hasText || book.pdfSource) && (
        <div className="reader-toolbar">
          {book.pdfSource && (
            <div className="reader-view-toggle" role="group" aria-label="Page view">
              <button
                className="secondary"
                aria-pressed={original}
                onClick={() => {
                  setRunning(false)
                  onUpdate({ readingView: 'original' })
                }}
              >
                Original page
              </button>
              <button
                className="secondary"
                aria-pressed={!original}
                disabled={!hasText}
                onClick={() => {
                  setRunning(false)
                  onUpdate({ readingView: 'text' })
                }}
              >
                Reflowed text
              </button>
            </div>
          )}
          {hasText && (
            <ReadingDirection
              compact
              value={settings.writingMode}
              onChange={(writingMode) => {
                setRunning(false)
                onSettings({ writingMode })
                if (book.pdfSource) onUpdate({ readingView: 'text' })
              }}
            />
          )}
        </div>
      )}
      <div
        className="reader-scroll"
        ref={scrollRef}
        onWheel={() => setRunning(false)}
        onTouchStart={() => setRunning(false)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) setRunning(false)
        }}
      >
        <div
          className={`reading-page ${original ? '' : 'text-page'} ${vertical ? 'vertical-page' : ''}`}
        >
          <div className="eyebrow reader-chapter" lang="ja">
            {content.chapter}
          </div>
          {book.format === 'pdf' && !book.pdfSource && (
            <p className="small muted page-note">
              Reimport this PDF to use original pages and improved vertical text order. This earlier
              import saved text only.
            </p>
          )}
          {!hasText && (
            <p className="page-note" role="note">
              This page has no selectable text. You can read the original image, but cannot select
              or highlight words or be quizzed on this page.
            </p>
          )}
          {original && <IllustratedPage key={page} book={book} page={content} index={page} />}
          {hasText && (
            <div
              ref={textScrollRef}
              className={`text-viewport ${vertical ? 'vertical' : 'horizontal'}`}
              tabIndex={canPace ? 0 : undefined}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) setRunning(false)
              }}
              aria-label={
                vertical
                  ? 'Japanese text, scroll left to continue'
                  : 'Japanese text, scroll down to continue'
              }
              onScroll={(event) => {
                if (running || !canPace) return
                const viewport = event.currentTarget
                const distance = vertical
                  ? viewport.scrollWidth - viewport.clientWidth
                  : viewport.scrollHeight - viewport.clientHeight
                if (distance <= 0) return
                pageProgress.current = Math.min(
                  1,
                  Math.max(0, (vertical ? -viewport.scrollLeft : viewport.scrollTop) / distance),
                )
                setProgress(pageProgress.current)
              }}
            >
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
                {boundaries
                  .slice(0, -1)
                  .map((start, i) =>
                    highlights.some(
                      (highlight) => highlight.start <= start && highlight.end > start,
                    ) ? (
                      <mark key={start}>{content.text.slice(start, boundaries[i + 1])}</mark>
                    ) : (
                      <span key={start}>{content.text.slice(start, boundaries[i + 1])}</span>
                    ),
                  )}
              </article>
            </div>
          )}
          <div className="page-end">
            <span />
            {String(page + 1).padStart(2, '0')}
            <span />
          </div>
          {hasText && (
            <p className="reading-hint">
              {vertical &&
                'Read top to bottom, then move left to the next column. Scroll or swipe left to continue. '}
              Select a word to look it up or highlight a passage.
            </p>
          )}
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
            {rightToLeft ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
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
            {rightToLeft ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        <div className="pace-controls">
          {!canPace ? (
            <span className="small muted">← Next · Right to left</span>
          ) : (
            <>
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
            </>
          )}
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
          <button className="secondary" onClick={() => finish(canQuiz)}>
            <Flag size={15} />
            <span>{canQuiz ? 'Finish & quiz' : 'Finish reading'}</span>
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
