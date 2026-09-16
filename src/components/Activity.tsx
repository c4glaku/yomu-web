import { BookOpen, Clock3, Flame, Sprout } from 'lucide-react'
import type { Session } from '../types'
import { Empty, localDay } from './UI'

export default function Activity({ sessions }: { sessions: Session[] }) {
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - 6 + i); return { date, key: localDay(date) } })
  const daily = days.map(day => ({ ...day, pages: sessions.filter(session => localDay(session.endedAt) === day.key).reduce((sum, session) => sum + session.pages.length, 0) }))
  const max = Math.max(4, ...daily.map(day => day.pages))
  const totalPages = sessions.reduce((sum, session) => sum + session.pages.length, 0)
  const minutes = Math.floor(sessions.reduce((sum, session) => sum + session.seconds, 0) / 60)
  const activeDays = new Set(sessions.map(session => localDay(session.endedAt)))
  let streak = 0
  const day = new Date()
  if (!activeDays.has(localDay(day))) day.setDate(day.getDate() - 1)
  while (activeDays.has(localDay(day))) { streak++; day.setDate(day.getDate() - 1) }
  return <><section className="page-heading"><div className="eyebrow">LITTLE BY LITTLE, EVERY DAY</div><h1>Look how far<br /><em>you’ve come.</em></h1><p>Every page is a step forward.</p></section><div className="stat-grid">{[[BookOpen, totalPages, 'Pages visited'], [Clock3, minutes, 'Minutes reading'], [Flame, streak, `Day${streak === 1 ? '' : 's'} in a row`]].map(([Icon, value, label], i) => { const StatIcon = Icon as typeof BookOpen; return <div className="stat-card" key={i}><StatIcon size={21} /><strong>{String(value)}</strong><span>{String(label)}</span></div> })}</div><section className="activity-chart"><div className="section-heading"><h2>Your week in pages</h2><span className="small muted">Last 7 days</span></div><div className="chart-bars" role="img" aria-label={daily.map(day => `${day.date.toLocaleDateString(undefined, { weekday: 'long' })}: ${day.pages} pages`).join(', ')}>{daily.map((day, i) => <div className={`chart-day ${i === 6 ? 'today' : ''}`} key={day.key}><strong>{day.pages}</strong><div className="bar-area"><div className="bar" style={{ height: `${Math.max(day.pages ? 4 : 2, day.pages / max * 100)}%` }} /></div><span>{day.date.toLocaleDateString(undefined, { weekday: 'short' })}</span></div>)}</div></section><section><div className="section-heading"><h2>Reading sessions</h2><span className="count">{sessions.length}</span></div>{!sessions.length ? <Empty icon={<Sprout size={28} />} title="Your story starts with one page">Finish a reading session to see your progress here.</Empty> : <div className="session-list">{[...sessions].reverse().map(session => <article className="session-row" key={session.id}><span className="session-icon"><BookOpen size={21} /></span><div><h3 lang="ja">{session.bookTitle}</h3><p>{new Date(session.endedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div><div className="session-metrics"><strong>{session.pages.length} {session.pages.length === 1 ? 'page' : 'pages'}</strong><span>{session.seconds < 60 ? '<1 min' : `${Math.floor(session.seconds / 60)} min`}{session.quiz ? ` · Quiz ${session.quiz.correct}/${session.quiz.total}` : ''}</span></div></article>)}</div>}</section></>
}
