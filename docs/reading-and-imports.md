# Reading, imports, and browser storage

[← Project overview](../README.md)

Practical details for reading novels, importing illustrated books, and keeping a local library.

## Reading and studying

- **Library:** import PDF, EPUB, TXT, CBZ/ZIP comics, and PNG/JPEG/WebP pages, including drag and drop. Selecting multiple loose images imports them as one manga, sorted naturally (`1`, `2`, `10`). Search, sort, filter by progress, mark books finished, and remove books. EPUB covers and manga thumbnails are used when available.
- **Reader:** Japanese novels default to vertical columns: top to bottom, then right to left. Scroll the wheel or pan horizontally to continue across columns. Settings → **Text direction** switches to horizontal reading and remembers your choice. Resume your page, jump to another page/chapter, and set a reading goal. Automatic scrolling and page turns for reflowed text run at 30–600 characters/minute (120 by default). Selecting text, manual scrolling, opening a reader dialog, and switching away pause reading.
- **Scanned pages and comics:** retain artwork and turn pages right to left. Pages without selectable text can be read as images, but cannot be highlighted or used for quizzes. Original-image reading uses manual page turns. These limits appear after importing, in session setup, and on the page itself.
- **Dictionary:** select text and choose **Look up**, or use the reader's search button. See readings, English meanings, parts of speech, alternate entries, and individual kanji on’yomi/kun’yomi. Common polite, past, negative, and te forms are handled. Pronunciation uses a Japanese speech voice available in your browser.
- **Highlights and words:** highlight passages and revisit them from the reader's bookmark button. Save words with their source sentence, book title, and page. Search, listen to, practice, or remove saved words. Saved words and finished session history remain after deleting a book.
- **Quizzes:** finish a session to practice readings and meanings from visited pages. Looked-up and saved words are prioritized, followed by highlighted vocabulary and words extracted from the text. Answers, corrections, context, and missed words appear in the results. Saved vocabulary can be practiced independently.
- **Activity:** pages visited, active reading minutes, daily streak, a seven-day chart, session history, and quiz results.
- **Appearance:** responsive desktop/mobile layouts, system/light/dark themes, and persistent pace and text size.

### Shortcuts

| Shortcut                                      | Action                                        |
| --------------------------------------------- | --------------------------------------------- |
| ⌘/Ctrl + O                                    | Import books                                  |
| ⌘/Ctrl + 1 / 2 / 3                            | Library / Words / Activity                    |
| ⌘/Ctrl + ,                                    | Settings                                      |
| Space in the reader                           | Pause/resume, when focus is outside a control |
| Left / right arrow in vertical books or manga | Next / previous page                          |
| Right / left arrow in horizontal books        | Next / previous page                          |

## Supported formats and limits

This is a simple web adaptation, with these differences from the native app:

- Books, text, covers, progress, highlights, vocabulary, and sessions are stored in **IndexedDB**. Imported PDFs and manga page images are retained in a separate asset store, so progress saves do not rewrite the artwork. Removing a book also removes its assets. Older libraries are upgraded in place. Clearing site data removes the library; there is no export, cloud sync, or cross-device backup. Use one tab for editing the library.
- Reading position is saved when you visit a page. A session is recorded when you choose **Library**, **Finish reading**, or **Finish & quiz**; closing or reloading the reader first does not record that unfinished session. Page totals count unique pages visited within each session, including manually visited pages. Minutes count time while paced reading is running.
- **PDF:** one logical page per original PDF page, with selectable-text reflow and an **Original page** view. Vertical text identified by PDF font/direction metadata is grouped into columns and read top to bottom, right to left. Complex layouts and rotated/mixed-direction text may still need the original view. Scanned pages retain their artwork without OCR; mixed PDFs keep text features on pages that contain text. Japanese character maps are bundled. Outlines and password-protected documents are unsupported. **Reimport PDFs added by an older Yomu version** to get original pages and improved extraction; earlier imports did not retain source files.
- **EPUB:** stored/deflated ZIP files, XML/XHTML chapters, spine order, metadata, common cover metadata, and ruby removal. Raster images in XHTML or SVG wrappers become image pages, including image-only manga. In mixed chapters, extracted text precedes the chapter's illustrations; complex publisher layouts and SVG-only artwork are not reproduced. Encrypted content is rejected; font obfuscation alone is allowed. Invalid XML, unsupported compression, duplicate/traversing ZIP paths, and corrupt archive content are rejected. Embedded HTML is never rendered in the app.
- **Comics:** CBZ and ZIP archives with naturally sorted PNG/JPEG/WebP pages. Nested folders work; hidden files and macOS archive metadata are ignored. CBR/RAR, encrypted comics, and other image formats are unsupported.
- **TXT:** UTF-8, BOM-marked UTF-16, or Shift-JIS. TXT and EPUB use logical pages of roughly 650 Unicode characters.
- Import limits: **75 MB per source**, **16 MB per ZIP/EPUB member**, **200 MB total expanded archive content or grouped images**, **fewer than 5,000 ZIP members/grouped images**, and **5,000 PDF pages**. Images above **40 megapixels** are rejected when decoded; reading canvases use at most 2,400 pixels on the long edge. Browser/device memory and storage quotas can impose lower practical limits.
- Lookup includes the full bundled dictionary; automatic quiz extraction uses common entries and browser Japanese segmentation. It is a learning aid with limited inflection rules, not contextual translation or JLPT assessment. Explicitly saved or looked-up uncommon entries can be quizzed too.
- The app, fonts, PDF support, and dictionary are served locally; imported text and images are not uploaded to an application service. Your browser's speech implementation may use a platform speech service. Actual Japanese audio requires an installed/available Japanese voice.
- This is a static web app, not an installed offline PWA. Keep the local server running, or access the hosted site. Dictionary files are loaded as needed from that same server.
