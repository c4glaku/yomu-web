export type Page = { text: string; chapter: string }
export type Highlight = { id: string; page: number; text: string; start: number; end: number }
export type Book = {
  id: string
  title: string
  author: string
  format: 'sample' | 'txt' | 'epub' | 'pdf'
  pages: Page[]
  position: number
  readPages: number[]
  completed: boolean
  addedAt: string
  openedAt?: string
  cover?: string
  tone: number
  highlights: Highlight[]
}
export type Entry = { id: number; word: string; reading: string; meanings: string[]; pos: string; common: boolean }
export type Kanji = { character: string; onyomi: string[]; kunyomi: string[]; meanings: string[] }
export type SavedWord = { id: string; entry: Entry; sentence: string; bookTitle: string; bookId: string; page: number; addedAt: string }
export type Session = { id: string; bookId: string; bookTitle: string; startedAt: string; endedAt: string; pages: number[]; seconds: number; quiz?: { correct: number; total: number } }
export type Settings = { theme: 'system' | 'light' | 'dark'; speed: number; fontSize: number }
export type AppState = { version: 1; books: Book[]; words: SavedWord[]; sessions: Session[]; settings: Settings }
export type View = 'library' | 'words' | 'activity'
export type Selection = { text: string; sentence: string; start: number; end: number; page: number }
export type Candidate = { entry: Entry; sentence: string; page: number; priority: number }
export type Question = { entry: Entry; sentence: string; page: number; kind: 'meaning' | 'reading'; options: string[]; answer: string }
