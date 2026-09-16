import { openDB } from 'idb'
import type { AppState } from '../types'
import { sampleBook } from '../sample'

let databasePromise: ReturnType<typeof openDB> | undefined
const db = () =>
  (databasePromise ??= openDB('yomu-web', 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('library')) database.createObjectStore('library')
      if (!database.objectStoreNames.contains('assets')) database.createObjectStore('assets')
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
    settings: { theme: 'system', speed: 120, fontSize: 24, writingMode: 'vertical-rl' },
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
  return { ...saved, settings: { ...initialState().settings, ...saved.settings } }
}

// A single atomic record keeps books, words, and progress consistent.
// IndexedDB accommodates book text without localStorage's small size limit.
export async function saveState(state: AppState) {
  const database = await db()
  // Remove artwork only when the corresponding library deletion commits.
  const transaction = database.transaction(['library', 'assets'], 'readwrite')
  const previous: AppState | undefined = await transaction.objectStore('library').get('state')
  for (const book of previous?.books ?? []) {
    if (state.books.some((current) => current.id === book.id)) continue
    const keys = await transaction
      .objectStore('assets')
      .getAllKeys(IDBKeyRange.bound(`${book.id}/`, `${book.id}/\uffff`))
    for (const key of keys) await transaction.objectStore('assets').delete(key)
  }
  await transaction.objectStore('library').put(state, 'state')
  await transaction.done
}

// Store large immutable images separately so progress updates only write metadata.
export async function saveAssets(assets: Map<string, Blob>) {
  if (!assets.size) return
  const transaction = (await db()).transaction('assets', 'readwrite')
  for (const [key, blob] of assets) await transaction.store.put(blob, key)
  await transaction.done
}

export async function loadAsset(key: string): Promise<Blob> {
  const asset = await (await db()).get('assets', key)
  if (!(asset instanceof Blob))
    throw new Error('This page image is missing. Try importing the book again.')
  return asset
}
