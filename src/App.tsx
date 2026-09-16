import {
  BarChart3,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  CircleAlert,
  HardDrive,
  LibraryBig,
  Plus,
  Settings2,
  Sprout,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type {
  AppState,
  Book,
  Candidate,
  Entry,
  Question,
  Session,
  Settings as Preferences,
  View,
} from './types'
import { loadState, saveState } from './lib/storage'
import { importBook, importImageCollection } from './lib/importers'
import { imageType } from './lib/images'
import { commonDictionary, extractCandidates } from './lib/dictionary'
import { buildQuiz } from './lib/quiz'
import Library from './components/Library'
import Words from './components/Words'
import Activity from './components/Activity'
import Settings from './components/Settings'
import SessionSetup, { type ReadingPlan } from './components/SessionSetup'
import Reader, { type ReadingResult } from './components/Reader'
import Lookup, { type LookupSource } from './components/Lookup'
import Quiz from './components/Quiz'
import { Brand, localDay, Modal } from './components/UI'

type ActiveReader = { bookId: string; plan: ReadingPlan }
type ActiveQuiz = { questions: Question[]; sessionId?: string }

export default function App() {
  const [state, setRenderedState] = useState<AppState | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [view, setView] = useState<View>('library')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupBook, setSetupBook] = useState<Book | null>(null)
  const [reader, setReader] = useState<ActiveReader | null>(null)
  const [lookupSource, setLookupSource] = useState<LookupSource | null>(null)
  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const importLock = useRef(false)
  const saveQueue = useRef(Promise.resolve())
  const pendingState = useRef<AppState | null>(null)
  const revision = useRef(0)
  const lookedUp = useRef<Candidate[]>([])
  const dragDepth = useRef(0)

  // Publish a mutation after its IndexedDB transaction commits, so a visible
  // saved word or removed book is durable before the user reloads the page.
  // Calculate against the latest pending snapshot to preserve rapid updates.
  const setState = useCallback((update: SetStateAction<AppState | null>) => {
    const next = typeof update === 'function' ? update(pendingState.current) : update
    if (!next) return Promise.resolve()
    pendingState.current = next
    const currentRevision = ++revision.current
    setSaving(true)
    saveQueue.current = saveQueue.current
      .then(() => saveState(next))
      .then(() => {
        if (currentRevision === revision.current) setSaveError('')
      })
      .catch(() => {
        if (currentRevision === revision.current)
          setSaveError(
            'Your latest changes could not be saved. Browser storage may be full or disabled. Keep this tab open and free up space.',
          )
      })
      .then(() => {
        if (currentRevision === revision.current) {
          setRenderedState(next)
          setSaving(false)
        }
      })
    return saveQueue.current
  }, [])

  useEffect(() => {
    let ignore = false
    loadState()
      .then((value) => {
        if (!ignore) setState(value)
      })
      .catch((error) => {
        if (!ignore) setLoadError(error.message)
      })
    if ('speechSynthesis' in window) speechSynthesis.getVoices()
    return () => {
      ignore = true
    }
  }, [])

  const theme = state?.settings.theme
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : (theme ?? 'light')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 6500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || reader || document.querySelector('dialog[open]'))
        return
      if (event.key === 'o') {
        event.preventDefault()
        inputRef.current?.click()
      }
      if (event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
      if (['1', '2', '3'].includes(event.key)) {
        event.preventDefault()
        setView((['library', 'words', 'activity'] as const)[Number(event.key) - 1])
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [reader])

  const updateBook = useCallback(
    (id: string, patch: Partial<Book>) =>
      setState(
        (current) =>
          current && {
            ...current,
            books: current.books.map((book) => (book.id === id ? { ...book, ...patch } : book)),
          },
      ),
    [],
  )
  const updateSettings = useCallback(
    (patch: Partial<Preferences>) =>
      setState((current) => current && { ...current, settings: { ...current.settings, ...patch } }),
    [],
  )

  const importFiles = async (files: File[]) => {
    if (importLock.current || !files.length) return
    importLock.current = true
    const errors: string[] = []
    let added = 0
    const images = files.filter((file) => imageType(file.name))
    const batches = files.filter((file) => !imageType(file.name)).map((file) => [file])
    if (images.length) batches.push(images)
    try {
      for (const [i, batch] of batches.entries()) {
        const file = batch[0]
        const label = batch.length > 1 ? `${batch.length} manga images` : file.name
        setBusy(`Importing ${label} (${i + 1}/${batches.length})…`)
        try {
          const book =
            batch.length > 1
              ? await importImageCollection(batch)
              : await importBook(file, (message) => setBusy(`${file.name}: ${message}`))
          await setState((current) => current && { ...current, books: [...current.books, book] })
          added++
        } catch (error) {
          errors.push(
            `${label}: ${error instanceof Error ? error.message : 'This file could not be imported.'}`,
          )
        }
      }
    } finally {
      importLock.current = false
      setBusy('')
      if (inputRef.current) inputRef.current.value = ''
    }
    setImportErrors(errors)
    if (added) {
      setView('library')
      setNotice(`${added} ${added === 1 ? 'book added' : 'books added'} to your library.`)
    }
  }

  const makeQuiz = async (candidates: Candidate[], sessionId?: string) => {
    setBusy('Gathering a few words to practice…')
    try {
      const dictionary = await commonDictionary()
      const pool = dictionary.entries
        .filter(
          (entry) => entry.word.length > 1 && entry.word.length < 8 && entry.meanings.length < 10,
        )
        .slice(0, 2000)
      setQuiz({ questions: buildQuiz(candidates, pool), sessionId })
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'The quiz could not be prepared. Please try again.',
      )
    } finally {
      setBusy('')
    }
  }

  const finishReading = async (book: Book, result: ReadingResult) => {
    const session: Session = {
      id: crypto.randomUUID(),
      bookId: book.id,
      bookTitle: book.title,
      startedAt: result.startedAt,
      endedAt: new Date().toISOString(),
      pages: result.pages,
      seconds: result.seconds,
    }
    setState((current) => current && { ...current, sessions: [...current.sessions, session] })
    setReader(null)
    if (!result.quiz) {
      setNotice('Reading session saved. A little progress, every day.')
      return
    }
    setBusy('Finding words from the pages you read…')
    try {
      const candidates = await extractCandidates(
        result.pages.map((index) => ({ page: book.pages[index], index })),
      )
      const saved = (state?.words ?? [])
        .filter((word) => word.bookId === book.id && result.pages.includes(word.page))
        .map((word) => ({
          entry: word.entry,
          sentence: word.sentence,
          page: word.page,
          priority: 4,
        }))
      for (const candidate of candidates)
        if (
          book.highlights.some(
            (highlight) =>
              highlight.page === candidate.page &&
              (highlight.text.includes(candidate.entry.word) ||
                candidate.sentence.includes(highlight.text)),
          )
        )
          candidate.priority = 2
      await makeQuiz([...lookedUp.current, ...saved, ...candidates], session.id)
    } catch (error) {
      setBusy('')
      setNotice(
        error instanceof Error
          ? error.message
          : 'The quiz could not be prepared. Your session was saved.',
      )
    }
  }

  const saveWord = (entry: Entry) => {
    if (!lookupSource) return
    const source = lookupSource
    setState((current) =>
      !current || current.words.some((word) => word.entry.id === entry.id)
        ? current
        : {
            ...current,
            words: [
              {
                id: crypto.randomUUID(),
                entry,
                sentence: source.sentence,
                bookTitle: source.bookTitle,
                bookId: source.bookId,
                page: source.page,
                addedAt: new Date().toISOString(),
              },
              ...current.words,
            ],
          },
    )
  }

  if (!state)
    return (
      <div className="app-loading">
        <Brand />
        {loadError ? (
          <>
            <CircleAlert />
            <h1>Your library needs a moment</h1>
            <p role="alert">{loadError}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Try reopening
            </button>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>Opening your reading space…</p>
          </>
        )}
      </div>
    )
  const activeBook = reader ? state.books.find((book) => book.id === reader.bookId) : null
  const nav = [
    { value: 'library' as const, label: 'Library', icon: LibraryBig },
    { value: 'words' as const, label: 'Words', icon: Bookmark },
    { value: 'activity' as const, label: 'Activity', icon: BarChart3 },
  ]
  const todaysPages = state.sessions
    .filter((session) => localDay(session.endedAt) === localDay(new Date()))
    .reduce((sum, session) => sum + session.pages.length, 0)

  return (
    <>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.epub,.txt,.cbz,.zip,.png,.jpg,.jpeg,.webp"
        multiple
        aria-label="Import book files"
        tabIndex={-1}
        onChange={(event) => void importFiles(Array.from(event.target.files ?? []))}
      />
      {reader && activeBook ? (
        <Reader
          key={`${activeBook.id}-${reader.plan.start}`}
          book={activeBook}
          settings={state.settings}
          plan={reader.plan}
          onUpdate={(patch) => updateBook(activeBook.id, patch)}
          onSettings={updateSettings}
          onLookup={(selection) =>
            setLookupSource({ ...selection, bookId: activeBook.id, bookTitle: activeBook.title })
          }
          onFinish={(result) => void finishReading(activeBook, result)}
        />
      ) : (
        <div
          className="app-shell"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDragEnter={(event) => {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault()
              dragDepth.current++
              setDragging(true)
            }
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (!dragDepth.current) setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            dragDepth.current = 0
            setDragging(false)
            void importFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <aside className="sidebar">
            <button
              className="brand-button"
              aria-label="Yomu library"
              onClick={() => setView('library')}
            >
              <Brand />
            </button>
            <div className="sidebar-label">YOUR READING SPACE</div>
            <nav aria-label="Main navigation">
              {nav.map(({ value, label, icon: Icon }, i) => (
                <button
                  key={value}
                  className={`nav-item ${view === value ? 'active' : ''}`}
                  aria-current={view === value ? 'page' : undefined}
                  onClick={() => setView(value)}
                >
                  <Icon size={20} strokeWidth={1.7} />
                  <span>{label}</span>
                  {value === 'words' && state.words.length > 0 ? (
                    <small>{state.words.length}</small>
                  ) : (
                    <kbd>⌘{i + 1}</kbd>
                  )}
                </button>
              ))}
            </nav>
            <button
              className="primary sidebar-import"
              disabled={!!busy}
              onClick={() => inputRef.current?.click()}
            >
              <Plus size={18} />
              Import books
            </button>
            <p className="sidebar-import-note">
              PDF, EPUB, TXT & manga
              <br />
              <span>Bring a story you love.</span>
            </p>
            <div className="sidebar-bottom">
              <div className="sidebar-motto">
                <span lang="ja">一日一歩</span>
                <p>One page at a time.</p>
                <Sprout size={23} strokeWidth={1.2} />
              </div>
              <button className="nav-item settings-nav" onClick={() => setSettingsOpen(true)}>
                <Settings2 size={19} />
                <span>Settings</span>
                <kbd>⌘,</kbd>
              </button>
              <span className="version-label">YOMU WEB · A QUIET LITTLE SPACE</span>
            </div>
          </aside>
          <div className="main-area">
            <header className="topbar">
              <div className="breadcrumb">
                <BookOpen size={15} />
                <span>Your reading space</span>
                <ChevronRight size={13} />
                <strong>{nav.find((item) => item.value === view)?.label}</strong>
              </div>
              <div className="local-badge">
                <span className="tiny-dot" />
                {saving ? 'SAVING…' : saveError ? 'CHANGES NOT SAVED' : 'SAVED ON THIS DEVICE'}
              </div>
              <button
                className="mobile-settings icon-button"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings2 size={19} />
              </button>
            </header>
            <main className="page-content">
              <div className="page-meta">
                <span>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span>
                  <Sprout size={14} />
                  {todaysPages
                    ? `${todaysPages} ${todaysPages === 1 ? 'page' : 'pages'} today. Keep growing.`
                    : 'A fresh page awaits.'}
                </span>
              </div>
              {view === 'library' && (
                <Library
                  books={state.books}
                  onImport={() => inputRef.current?.click()}
                  onRead={setSetupBook}
                  onUpdate={updateBook}
                  onRemove={(id) => {
                    const book = state.books.find((book) => book.id === id)
                    if (
                      book &&
                      window.confirm(
                        `Remove “${book.title}” and its highlights from this browser? Your saved words and session history will stay.`,
                      )
                    )
                      setState(
                        (current) =>
                          current && {
                            ...current,
                            books: current.books.filter((book) => book.id !== id),
                          },
                      )
                  }}
                />
              )}
              {view === 'words' && (
                <Words
                  words={state.words}
                  onRemove={(id) =>
                    setState(
                      (current) =>
                        current && {
                          ...current,
                          words: current.words.filter((word) => word.id !== id),
                        },
                    )
                  }
                  onPractice={() =>
                    void makeQuiz(
                      state.words.map((word) => ({
                        entry: word.entry,
                        sentence: word.sentence,
                        page: word.page,
                        priority: 1,
                      })),
                    )
                  }
                  onLookup={(word) =>
                    setLookupSource({
                      text: word.entry.word,
                      sentence: word.sentence,
                      bookTitle: word.bookTitle,
                      bookId: word.bookId,
                      page: word.page,
                    })
                  }
                  onMessage={setNotice}
                />
              )}
              {view === 'activity' && <Activity sessions={state.sessions} />}
              <footer className="page-footer">
                <HardDrive size={13} />
                Your books, your pace. Everything stays in this browser.
                <span lang="ja">少しずつ。</span>
              </footer>
            </main>
          </div>
          {dragging && (
            <div className="drop-overlay">
              <BookOpen size={45} />
              <h2>A new story starts here.</h2>
              <p>Drop PDF, EPUB, TXT, CBZ/ZIP, or manga images to add them.</p>
            </div>
          )}
        </div>
      )}
      {settingsOpen && (
        <Settings
          settings={state.settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {setupBook && (
        <SessionSetup
          book={setupBook}
          onClose={() => setSetupBook(null)}
          onStart={(plan) => {
            lookedUp.current = []
            setReader({ bookId: setupBook.id, plan })
            setSetupBook(null)
          }}
        />
      )}
      {lookupSource && (
        <Lookup
          key={`${lookupSource.text}-${lookupSource.page}`}
          source={lookupSource}
          words={state.words}
          onSave={saveWord}
          onFound={(entry) => {
            if (reader)
              lookedUp.current.push({
                entry,
                sentence: lookupSource.sentence,
                page: lookupSource.page,
                priority: 5,
              })
          }}
          onClose={() => setLookupSource(null)}
        />
      )}
      {quiz && (
        <Quiz
          questions={quiz.questions}
          onClose={() => setQuiz(null)}
          onComplete={(score) => {
            if (quiz.sessionId)
              setState(
                (current) =>
                  current && {
                    ...current,
                    sessions: current.sessions.map((session) =>
                      session.id === quiz.sessionId ? { ...session, quiz: score } : session,
                    ),
                  },
              )
          }}
        />
      )}
      {busy && (
        <div className="busy-toast" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {saveError && (
        <div className="storage-error" role="alert">
          <CircleAlert size={18} />
          <span>{saveError}</span>
          <button
            className="text-button"
            onClick={() => {
              if (state)
                saveQueue.current = saveQueue.current
                  .then(() => saveState(state))
                  .then(() => setSaveError(''))
                  .catch(() => {})
            }}
          >
            Retry saving
          </button>
        </div>
      )}
      {importErrors.length > 0 && (
        <Modal title="Some books need another look" onClose={() => setImportErrors([])}>
          <ul className="import-errors">
            {importErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
          <button className="primary full-width" onClick={() => setImportErrors([])}>
            Got it
          </button>
        </Modal>
      )}
    </>
  )
}
