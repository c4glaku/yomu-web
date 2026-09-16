# Yomu Web

A small React version of the Yomu SwiftUI Japanese reading app. Bring a book, read a little, and keep the words you discover. No account, API key, or application backend is needed.

![Yomu library](docs/library-desktop.png)

[Dark theme](docs/library-dark.png) · [Mobile library](docs/library-mobile.png) · [Mobile reader](docs/reader-mobile.png)

## Run locally

Use Node **24.15+ (24.x)** or **26+** and npm.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The original six-page Japanese story, **小さな一歩**, is included, so you can start reading immediately. The install step copies PDF.js support files into `public/pdfjs/`; these are regenerated from the locked dependency rather than checked into Git.

```sh
npm run build    # Type-check and build into dist/
npm run preview  # Serve the production build locally
```

The `dist/` directory can be served by a static web host. Keep its `dictionary/`, `pdfjs/`, and `assets/` directories. Serve from the site root, or set Vite's `base` before building for a subdirectory. Use the same host and port when reopening your library: browser storage belongs to an origin, so `localhost`, `127.0.0.1`, and different ports have separate libraries.

## What works

- **Library:** import multiple PDF, EPUB, or TXT files, including drag and drop. Search, sort, filter by progress, mark books finished, and remove books. EPUB covers are used when available; other books get simple covers.
- **Reader:** resume your page, jump to another page/chapter, and set a goal of a few pages, the current chapter, the rest of the book, or free reading. Automatic scrolling and page turns run at 30–600 characters/minute (120 by default). Pause, change text size, or finish whenever you like. Selecting text, manual scrolling, opening a reader dialog, and switching away pause reading.
- **Dictionary:** select text and choose **Look up**, or use the reader's search button. See readings, English meanings, parts of speech, alternate entries, and individual kanji on’yomi/kun’yomi. Common polite, past, negative, and te forms are handled. Pronunciation uses a Japanese speech voice available in your browser.
- **Highlights and words:** highlight passages and revisit them from the reader's bookmark button. Save words with their source sentence, book title, and page. Search, listen to, practice, or remove saved words. Saved words and finished session history remain after deleting a book.
- **Quizzes:** finish a session to practice readings and meanings from visited pages. Looked-up and saved words are prioritized, followed by highlighted vocabulary and words extracted from the text. Answers, corrections, context, and missed words appear in the results. Saved vocabulary can be practiced independently.
- **Activity:** pages visited, active reading minutes, daily streak, a seven-day chart, session history, and quiz results.
- **Appearance:** responsive desktop/mobile layouts, system/light/dark themes, and persistent pace and text size.

### Shortcuts

| Shortcut                         | Action                                        |
| -------------------------------- | --------------------------------------------- |
| ⌘/Ctrl + O                       | Import books                                  |
| ⌘/Ctrl + 1 / 2 / 3               | Library / Words / Activity                    |
| ⌘/Ctrl + ,                       | Settings                                      |
| Space in the reader              | Pause/resume, when focus is outside a control |
| Left / right arrow in the reader | Previous / next page                          |

## Browser version boundaries

This is a simple web adaptation, with these differences from the native app:

- Books are stored as **extracted text and cover images in IndexedDB**, alongside progress, highlights, vocabulary, and sessions. Original source files are not retained. Clearing site data removes this library; there is no export, cloud sync, or cross-device backup. Use one tab for editing the library.
- Reading position is saved when you visit a page. A session is recorded when you choose **Library** or **Finish & quiz**; closing or reloading the reader first does not record that unfinished session. Page totals count unique pages visited within each session, including manually visited pages. Minutes count time while paced reading is running.
- **PDF:** selectable text is reflowed, with one logical page per original PDF page. Japanese character maps are bundled. Scanned-only PDFs are rejected; individual empty pages are explained. PDF outlines, original layouts, vertical text order, password protection, and OCR are not supported.
- **EPUB:** stored/deflated ZIP files, XML/XHTML chapters, spine order, metadata, common cover metadata, and ruby removal. Encrypted chapters are rejected; font obfuscation alone is allowed. Invalid XML, unsupported compression, duplicate/traversing ZIP paths, and corrupt archive content are rejected. Embedded HTML is never rendered in the app.
- **TXT:** UTF-8, BOM-marked UTF-16, or Shift-JIS. TXT and EPUB use logical pages of roughly 650 Unicode characters.
- Import limits: **75 MB per source**, **16 MB per EPUB member**, **200 MB total expanded EPUB content**, **fewer than 5,000 ZIP members**, and **5,000 PDF pages**. Browser/device memory and storage quotas can impose lower practical limits.
- Lookup includes the full bundled dictionary; automatic quiz extraction uses common entries and browser Japanese segmentation. It is a learning aid with limited inflection rules, not contextual translation or JLPT assessment. Explicitly saved or looked-up uncommon entries can be quizzed too.
- The app, fonts, PDF support, and dictionary are served locally; imported text is not uploaded to an application service. Your browser's speech implementation may use a platform speech service. Actual Japanese audio requires an installed/available Japanese voice.
- This is a static web app, not an installed offline PWA. Keep the local server running, or access the hosted site. Dictionary files are loaded as needed from that same server.

## Verification

```sh
npm test
npx playwright install chromium --only-shell
npm run test:e2e
```

- **18 unit tests:** Japanese text encodings, Unicode pagination, EPUB order/ruby/markup, encryption/traversal/integrity/size errors, real bundled dictionary lookup in both raw and browser-decompressed modes, inflections, and quiz answer correctness.
- **10 Chromium browser tests:** desktop and mobile viewports cover imports and reloads, Japanese PDF extraction, scanned-PDF errors, word lookup and saving, highlights, full quizzes, vocabulary practice, activity, preserved words/history after book deletion, settings, automatic page turns, reading goals, manual pause, and screen overflow.
- Production TypeScript/Vite build. Desktop and mobile light/dark layouts reviewed. Mobile checks use Chromium emulation; physical iOS/Safari and audible speech remain manual checks.

GitHub Actions runs the build and both test suites on pushes and pull requests. A custom Chromium binary can be selected with `YOMU_CHROMIUM_PATH`. Set `PLAYWRIGHT_BROWSERS_PATH` for both installation and tests if using a separate browser cache.

## Project layout

| Path                             | Purpose                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `src/App.tsx`                    | Navigation, library state, import and reading flows               |
| `src/components/`                | Library, reader, dictionary, vocabulary, quiz, activity, settings |
| `src/lib/`                       | IndexedDB persistence, document import, dictionary, quiz logic    |
| `src/styles.css`                 | Responsive styling and light/dark themes                          |
| `src/sample.ts`                  | Original six-page story adapted from the Swift app                |
| `public/dictionary/`             | Complete compressed dictionary, metadata, and license             |
| `scripts/export-assets.py`       | Re-export story and dictionary from the Swift app                 |
| `scripts/prepare-pdf-assets.mjs` | Copy installed PDF.js support files for local serving             |
| `tests/`                         | Browser flows and small original import fixtures                  |

Built with React, TypeScript, and [Vite](https://vite.dev/guide/), using [PDF.js](https://mozilla.github.io/pdf.js/), [fflate](https://github.com/101arrowz/fflate), IndexedDB via `idb`, Lucide icons, and locally served DM Sans/DM Serif Display fonts. No UI framework, router, authentication, or backend is required. Run `npm run format` to format source files.

## Dictionary attribution

**JMdict and KANJIDIC2**, copyright © James William BREEN and the **Electronic Dictionary Research and Development Group (EDRDG)**, are used under **Creative Commons Attribution-ShareAlike 4.0**. The compressed JSON adaptations remain under this license. See [the bundled license](public/dictionary/LICENSE.txt), [EDRDG's license](https://www.edrdg.org/edrdg/licence.html), and Settings → Dictionary sources & licenses.

The September 15, 2026 snapshot includes **324,835 word/reading pairs** and **13,108 kanji**. Common entries load together; uncommon entries are split into 64 local lookup files. The dictionary is approximately **15.6 MB compressed** in total. Readings, meanings, and word/reading restrictions are preserved from the Swift database.

To regenerate from the neighboring Swift project after refreshing its dictionary:

```sh
python3 scripts/export-assets.py ../JapeneseApp
npm run format
npm test
```

No sibling project is needed for normal installation or development. The native app's original story and test EPUB/TXT fixtures are reused. Generated PDF fixtures are small original test documents. Dictionary and dependency licenses do not assign a license to the app's source code or to books you import.
