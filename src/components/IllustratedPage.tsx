import { useEffect, useRef, useState } from 'react'
import type { Book, Page } from '../types'
import { loadAsset } from '../lib/storage'
import { decodeImage } from '../lib/images'
import { openPdf } from '../lib/pdf'

export default function IllustratedPage({
  book,
  page,
  index,
}: {
  book: Book
  page: Page
  index: number
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const display = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let active = true
    let canvas: HTMLCanvasElement | undefined
    let pdfTask: Awaited<ReturnType<typeof openPdf>> | undefined
    setLoadError('')
    setSource(null)
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

  return (
    <section className="illustrated-page" aria-label={`Original page ${index + 1}`}>
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
      <div className="page-artwork" hidden={!source}>
        <canvas ref={display} role="img" aria-label={`Artwork for page ${index + 1}`} />
      </div>
    </section>
  )
}
