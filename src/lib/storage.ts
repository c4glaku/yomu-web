import { openDB } from 'idb'
import type { AppState } from '../types'
import { sampleBook } from '../sample'

let databasePromise: ReturnType<typeof openDB> | undefined
const db = () =>
  (databasePromise ??= openDB('yomu-web', 1, {
    upgrade(database) {
      database.createObjectStore('library')
    },
  }).catch((error) => {
    databasePromise = undefined
    throw error
  }))

export function initialState(): AppState {
  return {
    version: 1,
    books: [sampleBook()],
    words: [],
    sessions: [],
    settings: { theme: 'system', speed: 120, fontSize: 24 },
  }
}

export async function loadState(): Promise<AppState> {
  const database = await db()
  const saved = await database.get('library', 'state')
  if (saved === undefined) return initialState()
  if (
    !saved ||
    saved.version !== 1 ||
    !Array.isArray(saved.books) ||
    !Array.isArray(saved.words) ||
    !Array.isArray(saved.sessions) ||
    !saved.settings
  ) {
    throw new Error(
      'Your saved library could not be read. It has been preserved. Try reopening Yomu in the same browser.',
    )
  }
  return saved
}

// A single atomic record keeps books, words, and progress consistent.
// IndexedDB accommodates book text without localStorage's small size limit.
export async function saveState(state: AppState) {
  const database = await db()
  await database.put('library', state, 'state')
}
