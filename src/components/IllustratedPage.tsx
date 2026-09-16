import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ScanText, X } from 'lucide-react'
import type { Book, OcrRegion, Page } from '../types'
import { loadAsset } from '../lib/storage'
import { decodeImage } from '../lib/images'
import { openPdf } from '../lib/pdf'
import { mergeRegions, recognizeImage, type Area, type OcrDirection } from '../lib/ocr'

export default function IllustratedPage({
  book,
  page,
  index,
  onChange,
  onRegion,
  onPause,
}: {
  book: Book
  page: Page
  index: number
  onChange: (page: Page) => void
  onRegion: (region: OcrRegion) => void
  onPause: () => void
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const [direction, setDirection] = useState<OcrDirection>('vertical')
  const [selecting, setSelecting] = useState(false)
  const [area, setArea] = useState<Area | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const display = useRef<HTMLCanvasElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const controller = useRef<AbortController | null>(null)
  const current = useRef(page)
  current.current = page
  const autoStarted = useRef(false)

  useEffect(() => {
    let active = true
    let canvas: HTMLCanvasElement | undefined
    let pdfTask: Awaited<ReturnType<typeof openPdf>> | undefined
    setLoadError('')
    const load = async () => {
      canvas = document.createElement('canvas')
      if (page.image) {
        const image = await decodeImage(await loadAsset(page.image))
        try {
          const scale = Math.min(1, 2400 / Math.max(image.width, image.height))
          canvas.width = Math.max(1, Math.round(image.width * scale))
          canvas.height = Math.max(1, Math.round(image.height * scale))
          const context = canvas.getContext('2d')!
          context.fillStyle = 'white'
          context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
        } finally {
          image.close()
        }
      } else if (book.pdfSource) {
        pdfTask = await openPdf(
          new Uint8Array(await (await loadAsset(book.pdfSource)).arrayBuffer()),
        )
        try {
          const pdf = await pdfTask.promise
          if (!active) return
          const pdfPage = await pdf.getPage(index + 1)
          const size = pdfPage.getViewport({ scale: 1 })
          const viewport = pdfPage.getViewport({
            scale: Math.min(3, 2400 / Math.max(size.width, size.height)),
          })
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await pdfPage.render({ canvas, viewport }).promise
        } finally {
          await pdfTask.destroy()
        }
      }
      if (active) setSource(canvas)
      else canvas.width = canvas.height = 0
    }
    void load().catch((error) => {
      if (active)
        setLoadError(error instanceof Error ? error.message : 'This page could not be opened.')
    })
    return () => {
      active = false
      controller.current?.abort()
      void pdfTask?.destroy()
      if (canvas) canvas.width = canvas.height = 0
    }
  }, [book.pdfSource, page.image, index, attempt])

  useEffect(() => {
    const canvas = display.current
    if (canvas && source) {
      canvas.width = source.width
      canvas.height = source.height
      canvas.getContext('2d')?.drawImage(source, 0, 0)
    }
  }, [source])

  const scan = async (crop?: Area) => {
    if (!source || controller.current) return
    onPause()
    const job = new AbortController()
    controller.current = job
    setStatus('Loading Japanese OCR…')
    setMessage('')
    setSelecting(false)
    try {
      const incoming = await recognizeImage(source, direction, job.signal, setStatus, crop)
      if (job.signal.aborted) return
      if (crop && !incoming.length) {
        setMessage(
          'No text found in this bubble. Try a tighter selection or change the text direction.',
        )
        return
      }
      const previous = current.current
      const regions = mergeRegions(previous.ocr?.regions ?? [], incoming, crop)
      const manualText = crop
        ? (previous.ocr?.manualText ?? (!previous.ocr ? previous.text : ''))
        : ''
      const text = [
        manualText,
        ...regions.map((region) => region.text).filter((text) => !manualText.includes(text)),
      ]
        .filter(Boolean)
        .join('\n\n')
      // A blank re-scan should not erase an existing transcript.
      if (!text && previous.text) {
        setMessage('No new text found. Your existing text has been kept.')
        return
      }
      onChange({ ...previous, text, ocr: { regions, scanned: true, manualText } })
      if (!text)
        setMessage(
          'No text found. Select a speech bubble, or change the text direction and scan again.',
        )
    } catch (error) {
      if (!job.signal.aborted)
        setMessage(error instanceof Error ? error.message : 'OCR failed. Please try again.')
    } finally {
      if (controller.current === job) {
        controller.current = null
        if (!job.signal.aborted) {
          setStatus('')
          setArea(null)
        }
      }
    }
  }

  useEffect(() => {
    if (source && !autoStarted.current) {
      autoStarted.current = true
      if (!current.current.text && !current.current.ocr?.scanned) void scan()
    }
  }, [source])

  const point = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    }
  }
  const rectangle = (end: { x: number; y: number }): Area => ({
    x: Math.min(start.current!.x, end.x),
    y: Math.min(start.current!.y, end.y),
    width: Math.abs(end.x - start.current!.x),
    height: Math.abs(end.y - start.current!.y),
  })

  return (
    <section className="illustrated-page" aria-label={`Original page ${index + 1}`}>
      <div className="ocr-controls">
        <button
          className="secondary"
          disabled={!source || !!status || editing}
          onClick={() => void scan()}
        >
          <ScanText size={16} />
          {page.ocr ? 'Scan page again' : 'Scan page'}
        </button>
        <button
          className="secondary"
          disabled={!source || !!status || editing}
          aria-pressed={selecting}
          onClick={() => {
            onPause()
            setSelecting(!selecting)
            setArea(null)
          }}
        >
          {selecting ? 'Cancel selection' : 'Select speech bubble'}
        </button>
        <label className="ocr-direction">
          Text direction
          <select
            aria-label="OCR text direction"
            value={direction}
            disabled={!!status}
            onChange={(event) => setDirection(event.target.value as OcrDirection)}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </label>
      </div>
      <p className="small muted ocr-hint">
        {selecting
          ? 'Drag a rectangle around one speech bubble. On a touch screen, drag with one finger.'
          : 'Read right to left. Tap a detected text area, or select words in the transcript below.'}
      </p>
      {status && (
        <div className="ocr-status" role="status">
          <span className="spinner" />
          {status}
          <button
            className="text-button"
            onClick={() => {
              controller.current?.abort()
              controller.current = null
              setStatus('')
              setArea(null)
              setMessage('OCR cancelled. Scan the page whenever you are ready.')
            }}
          >
            <X size={14} />
            Cancel OCR
          </button>
        </div>
      )}
      {message && (
        <p className="ocr-message" role="status">
          {message}
        </p>
      )}
      {loadError ? (
        <div className="error-message" role="alert">
          {loadError}
          <button className="text-button" onClick={() => setAttempt((value) => value + 1)}>
            Retry loading page
          </button>
        </div>
      ) : (
        !source && <p role="status">Opening page…</p>
      )}
      <div
        className={`manga-artwork ${selecting ? 'selecting' : ''}`}
        hidden={!source}
        onPointerDown={(event) => {
          if (!selecting || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          start.current = point(event)
          setArea({ ...start.current, width: 0, height: 0 })
        }}
        onPointerMove={(event) => {
          if (start.current) setArea(rectangle(point(event)))
        }}
        onPointerCancel={() => {
          start.current = null
          setArea(null)
        }}
        onPointerUp={(event) => {
          if (!start.current) return
          const crop = rectangle(point(event))
          start.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
          if (crop.width * (source?.width ?? 0) < 12 || crop.height * (source?.height ?? 0) < 12) {
            setArea(null)
            setMessage('Drag around a larger text area.')
            return
          }
          setArea(crop)
          void scan(crop)
        }}
      >
        <canvas ref={display} role="img" aria-label={`Artwork for page ${index + 1}`} />
        {!selecting &&
          (page.ocr?.regions ?? []).map((region, i) => (
            <button
              key={region.id}
              className="ocr-region"
              aria-label={`Read text area ${i + 1}: ${region.text}`}
              style={{
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.width * 100}%`,
                height: `${region.height * 100}%`,
              }}
              onClick={() => {
                onPause()
                onRegion(region)
              }}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        {area && (
          <div
            className="ocr-crop"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.width * 100}%`,
              height: `${area.height * 100}%`,
            }}
          />
        )}
      </div>
      <div className="transcript-heading">
        <h3>Page text</h3>
        <button
          className="text-button"
          disabled={!!status}
          onClick={() => {
            onPause()
            setDraft(page.text)
            setEditing(!editing)
          }}
        >
          {editing ? 'Cancel editing' : 'Edit page text'}
        </button>
      </div>
      {editing && (
        <div className="transcript-editor">
          <label className="field-label">
            Correct the recognized text
            <textarea
              lang="ja"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
            />
          </label>
          <button
            className="secondary"
            onClick={() => {
              onChange({
                ...current.current,
                text: draft.trim(),
                ocr: { regions: [], scanned: true, manualText: draft.trim() },
              })
              setEditing(false)
            }}
          >
            Save page text
          </button>
        </div>
      )}
    </section>
  )
}
