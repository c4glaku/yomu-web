# Manga OCR Research and Groundwork

**Status:** Research proposal only. This document does not change the reader, import flow, dependencies, or saved-library format.

## Current baseline

Yomu Web currently keeps scanned PDFs and manga as images. Image-only pages remain readable, but do not provide selectable text, highlights, dictionary lookup, or quizzes. The original artwork is the reliable source of truth.

An earlier implementation used Tesseract.js in a browser worker with Japanese horizontal and vertical models, page and bubble scans, and transcript editing. It was removed in [`b863ddd`](https://github.com/c4glaku/yomu-web/commit/b863dddba00b83aca721df78fce065e87f7eadbb), whose commit message describes the OCR as unreliable. That implementation is useful as a benchmark baseline, but should not be restored unchanged.

## Options explored

| Option | What it offers | Main trade-off |
| --- | --- | --- |
| Existing Tesseract.js approach | Static hosting, browser worker, Japanese horizontal/vertical models, and an existing Yomu integration to compare against. | Yomu removed this implementation after reliability problems; repeating the same full-page flow is unlikely to be a meaningful improvement. |
| [Manga OCR](https://github.com/kha-white/manga-ocr) | A Japanese recognizer designed for manga, including vertical and horizontal text, furigana, varied fonts, and multi-line bubbles. The upstream project describes a Python/PyTorch setup and a roughly 400 MB first model download. | It recognizes text from an image crop; it does not locate all text on a page or determine bubble order. Its model can produce plausible text even for images with no text, so detection and human review matter. |
| [Mokuro](https://github.com/kha-white/mokuro) | A working offline pipeline combining comic text detection with Manga OCR, processing a volume before reading and saving results in a `.mokuro` data file. This is a useful end-to-end quality reference and suggests a possible sidecar-import path. | It is a separate Python workflow rather than an in-browser library. Its project and the linked [comic-text-detector](https://github.com/dmMaze/comic-text-detector) are GPL-3.0; review code, model, and data terms before bundling or depending on assets. |
| ONNX Runtime Web | A possible way to run compatible exported models locally in the browser, preserving Yomu’s no-backend privacy model. It supports WASM and WebGPU execution. | Model export/conversion, supported operators, memory use, download size, and performance on mobile browsers need a prototype. WebGPU support varies by browser and device, so a WASM path may also be needed. |

Manga OCR’s upstream code is Apache-2.0, but check the specific model weights and training-data terms before redistributing them. ONNX Runtime Web documents its [browser execution providers and compatibility](https://onnxruntime.ai/docs/get-started/with-javascript/web.html); WebGPU is an acceleration option rather than a universal requirement.

## Recommended next step: isolated benchmark

Before adding OCR back to the reader, compare the old Tesseract path with Manga OCR and the Mokuro pipeline on the same small, representative page set. Include vertical and horizontal dialogue, furigana, sound effects, textured backgrounds, and pages with no text. Use synthetic or appropriately licensed test pages in the repository; keep personal or copyrighted manga pages local to the evaluator.

Record:

- Japanese character error rate on manually transcribed text.
- Text-region precision and recall, plus reading-order errors.
- Processing time, peak memory, model download size, and first-use delay.
- Results on at least one desktop and one mobile browser/device.

This separates recognition quality from text detection and panel ordering. Manga OCR alone can be a strong recognizer while still needing a detector to produce useful selectable regions.

## Integration direction if the benchmark succeeds

Keep OCR optional and additive. First scan only the current page, outside the main UI thread, with progress, cancel, retry, and a manual crop action. Keep the image readable if model loading or recognition fails. Show OCR as an editable transcript and require user review before it contributes to lookup, highlights, saved words, or quizzes; never treat plausible model output as proof that text exists.

Store OCR output separately from imported page artwork and source text. A future OCR record should use normalized page-relative boxes and retain the engine/model version and whether a user edited the transcript. This keeps the original image intact and gives future model versions a way to reprocess pages without overwriting reader data.

If a browser-sized Manga OCR model is not practical, investigate importing Mokuro sidecar data as an alternate bridge. That would let users process locally without adding a server or a large model download to the static app. Validate format compatibility and licenses before choosing that route.

Do not merge an implementation until the benchmark demonstrates a measurable improvement over the previous Tesseract baseline and the OCR path remains optional, cancellable, usable on mobile, and covered by tests for persistence and failure recovery.
