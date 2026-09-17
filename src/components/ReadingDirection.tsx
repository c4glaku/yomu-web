import { useId } from 'react'
import type { WritingMode } from '../types'

export default function ReadingDirection({
  value,
  onChange,
  compact = false,
}: {
  value: WritingMode
  onChange: (value: WritingMode) => void
  compact?: boolean
}) {
  const helpId = useId()
  return (
    <div className={`reading-direction ${compact ? 'compact' : ''}`}>
      <label className="field-label">
        Scroll direction
        <select
          aria-label="Scroll direction"
          value={value}
          aria-describedby={helpId}
          onChange={(event) => onChange(event.target.value as WritingMode)}
        >
          <option value="vertical-rl">Horizontal · scroll left ←</option>
          <option value="horizontal-tb">Vertical · scroll down ↓</option>
        </select>
      </label>
      <p id={helpId} className="small muted">
        {value === 'vertical-rl'
          ? 'Vertical Japanese columns, read top to bottom, then right to left.'
          : 'Horizontal text, read left to right, then down the page.'}
      </p>
    </div>
  )
}
