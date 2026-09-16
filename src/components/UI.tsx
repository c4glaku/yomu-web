import { BookOpen, X, Sun } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { Book } from '../types'

export function Brand() {
  return <div className="brand"><span className="brand-mark"><BookOpen size={22} strokeWidth={1.8} /></span><span>yomu<span className="brand-period">.</span></span></div>
}

export function Cover({ book, small = false }: { book: Book; small?: boolean }) {
  return <div className={`book-cover tone-${book.tone} ${small ? 'cover-small' : ''}`} aria-label={`Cover of ${book.title}`}>
    {book.cover ? <img src={book.cover} alt="" /> : <><div className="cover-top">YOMU EDITIONS <Sun size={15} /></div><div className="cover-title" lang="ja">{book.title}</div><div className="cover-rings" /><div className="cover-bottom">{book.format === 'sample' ? 'A SMALL STEP' : `${book.format.toUpperCase()} · YOUR COLLECTION`}</div></>}
  </div>
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-label={title} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}>
    <header className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>
    <div className="modal-content">{children}</div>
  </dialog>
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p></div>
}

export const percentRead = (book: Book) => book.completed ? 100 : Math.round(book.readPages.length / book.pages.length * 100)
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
export const localDay = (date: string | Date) => new Date(date).toLocaleDateString('en-CA')
