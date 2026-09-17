# Yomu Web

Learn Japanese through reading. Yomu Web adapts the [native Yomu app](https://github.com/c4glaku/Yomu) to the browser, with vertical reading and local OCR for manga and scanned pages.

No account, API key, or application backend required. A Japanese starter story and dictionary are included; imported books and OCR processing stay in your browser.

[View screenshots](docs) · [Reading and import guide](docs/reading-and-imports.md)

## Features

- **Personal library:** import PDF, EPUB, TXT, CBZ/ZIP, and PNG/JPEG/WebP pages; search, sort, highlight, and resume reading. Multiple loose images become one naturally ordered book.
- **Vertical and paced reading:** read top to bottom, right to left, or switch to horizontal text; set goals, adjust pacing, and use automatic scrolling and page turns.
- **Manga and scanned pages:** retain artwork from comics, image EPUBs, and scanned PDFs. Recognize the current page, select speech bubbles, choose OCR orientation, and correct transcripts. Manga uses manual page turns.
- **Japanese lookup:** select words for readings, English definitions, kanji details, and pronunciation; save vocabulary with its sentence, book, and page.
- **Practice and progress:** quiz vocabulary from visited pages or saved words, and track sessions, pages, and active reading time.
- **Browser experience:** responsive desktop/mobile layouts, light and dark themes, adjustable text size, and keyboard shortcuts.

OCR can misread furigana, stylized lettering, and panel order. Speech requires an available Japanese voice and may use platform services. See the [reading guide](docs/reading-and-imports.md) for controls, format limits, and how sessions are recorded.

Libraries belong to one browser and site address; clearing site data deletes them. There is no export, backup, or sync; use one tab for editing. Keep the local server running or use the hosted site: this is not an offline PWA.

## Setup

Requires **Node.js 24.15+ within 24.x, or 26+**, and npm.

```sh
git clone https://github.com/c4glaku/yomu-web.git
cd yomu-web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Installation prepares PDF and OCR assets automatically; the web app runs independently of the native project.

To build and preview:

```sh
npm run build
npm run preview
```

Deploy the entire `dist/` directory to a static host. Set Vite's `base` before building for a subdirectory. Reuse the same host and port to access your saved library.

## Tech stack

- **App:** React 19, TypeScript, Vite, custom CSS, and Lucide icons.
- **Documents and OCR:** PDF.js, `fflate`, browser XML/image APIs, and Tesseract.js/WebAssembly with Japanese `jpn` / `jpn_vert` models in a worker.
- **Storage:** IndexedDB via `idb` stores books, progress, and artwork without a database server; separate artwork storage keeps progress updates small.
- **Language:** compressed JMdict/KANJIDIC2 JSON, `Intl.Segmenter`, and Web Speech API. Uncommon dictionary entries load on demand.
- **Tooling:** Vitest, Playwright, GitHub Actions, and Python asset export.

Run unit tests with `npm test`. For browser tests, run `npx playwright install chromium --only-shell`, then `npm run test:e2e`.

## Dictionary and asset attribution

JMdict and KANJIDIC2 © James William BREEN and the Electronic Dictionary Research and Development Group (EDRDG). Dictionary data and its JSON adaptations are licensed under **CC BY-SA 4.0**; see the [dictionary license](public/dictionary/LICENSE.txt) and [native asset export script](scripts/export-assets.py). DM Sans and DM Serif Display notices are in [font licenses](public/licenses).
