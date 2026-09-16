import { Monitor, Moon, Sun } from 'lucide-react'
import type { Settings as Preferences } from '../types'
import { Modal } from './UI'

export default function Settings({
  settings,
  onChange,
  onClose,
}: {
  settings: Preferences
  onChange: (patch: Partial<Preferences>) => void
  onClose: () => void
}) {
  return (
    <Modal title="Make yourself at home" onClose={onClose}>
      <p className="muted">A reading space that feels like yours.</p>
      <section className="setting-group">
        <h3>Appearance</h3>
        <div className="theme-options">
          {(['system', 'light', 'dark'] as const).map((theme, i) => {
            const Icon = [Monitor, Sun, Moon][i]
            return (
              <button
                key={theme}
                className={settings.theme === theme ? 'selected' : ''}
                aria-pressed={settings.theme === theme}
                onClick={() => onChange({ theme })}
              >
                <Icon size={22} />
                <span>{theme}</span>
              </button>
            )
          })}
        </div>
      </section>
      <section className="setting-group">
        <label className="field-label">
          Text direction
          <select
            aria-label="Text direction"
            value={settings.writingMode}
            onChange={(event) =>
              onChange({ writingMode: event.target.value as Preferences['writingMode'] })
            }
          >
            <option value="vertical-rl">Vertical · top to bottom, right to left</option>
            <option value="horizontal-tb">Horizontal · left to right</option>
          </select>
        </label>
        <p className="small muted">
          Vertical books turn forward with the left arrow. Manga always reads right to left.
        </p>
      </section>
      <section className="setting-group">
        <label className="range-label" htmlFor="setting-speed">
          <strong>Reading pace</strong>
          <span>{settings.speed} chars/min</span>
        </label>
        <input
          id="setting-speed"
          type="range"
          min="30"
          max="600"
          step="10"
          value={settings.speed}
          onChange={(event) => onChange({ speed: Number(event.target.value) })}
        />
        <div className="range-ends">
          <span>Take your time</span>
          <span>Find your flow</span>
        </div>
      </section>
      <section className="setting-group">
        <label className="range-label" htmlFor="setting-size">
          <strong>Text size</strong>
          <span>{settings.fontSize}px</span>
        </label>
        <input
          id="setting-size"
          type="range"
          min="18"
          max="40"
          value={settings.fontSize}
          onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        />
        <p className="font-preview" lang="ja" style={{ fontSize: settings.fontSize }}>
          毎日、少しずつ。それでいい。
        </p>
      </section>
      <section className="license-box">
        <h3>Dictionary sources & licenses</h3>
        <p>
          324,835 word/reading pairs and 13,108 kanji from JMdict and KANJIDIC2. © James William
          BREEN and EDRDG. Adapted under CC BY-SA 4.0.
        </p>
        <a
          href={`${import.meta.env.BASE_URL}dictionary/LICENSE.txt`}
          target="_blank"
          rel="noreferrer"
        >
          Read the dictionary license ↗
        </a>
        <p className="small muted">Dictionary snapshot: September 15, 2026.</p>
      </section>
      <p className="small muted">
        Your library is saved in this browser. Clearing site data removes your books and progress.
        Pronunciation uses an available Japanese browser voice.
      </p>
    </Modal>
  )
}
