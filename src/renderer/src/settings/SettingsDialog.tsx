import { useEffect, useRef, useState } from 'react'
import {
  acceleratorFromEvent,
  displayAccelerator,
  sameShortcut
} from '../../../shared/accelerators'
import { COMMANDS, shortcutFor, type CommandId } from '../../../shared/commands'
import {
  DEFAULT_SETTINGS,
  FONT_SIZE_RANGE,
  LINE_WIDTH_RANGE,
  type Settings,
  type ThemeSetting
} from '../../../shared/settings'
import { Icon } from '../app/icons'
import { focusEditor } from '../editor/activeEditor'
import { updateSettings, useSettings } from '../state/settingsStore'
import { uiStore, useUi } from '../state/uiStore'

const THEMES: Array<{ id: ThemeSetting; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' }
]

const GROUPS: Array<{ prefix: string; label: string }> = [
  { prefix: 'file.', label: 'File' },
  { prefix: 'edit.', label: 'Edit' },
  { prefix: 'paragraph.', label: 'Paragraph' },
  { prefix: 'format.', label: 'Format' },
  { prefix: 'view.', label: 'View' }
]

const ALL_COMMANDS = Object.keys(COMMANDS) as CommandId[]

const defaultShortcut = (id: CommandId): string | undefined =>
  (COMMANDS[id] as { accelerator?: string }).accelerator

function close(): void {
  uiStore.set({ settingsOpen: false })
  focusEditor()
}

/** A text setting that is applied when the field loses focus or Enter is pressed. */
function FontField({ value }: { value: string }): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const commit = (): void => {
    if (draft.trim() !== value) updateSettings({ fontFamily: draft.trim() })
  }
  return (
    <input
      id="setting-font"
      className="text-field"
      placeholder="Default (Segoe UI)"
      spellCheck={false}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
    />
  )
}

interface ShortcutRowProps {
  id: CommandId
  settings: Settings
  recording: boolean
  onRecord: (id: CommandId | null) => void
}

function ShortcutRow({ id, settings, recording, onRecord }: ShortcutRowProps): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const current = shortcutFor(id, settings.shortcuts)
  const overridden = settings.shortcuts[id] !== undefined

  const assign = (accelerator: string | null): void => {
    const shortcuts = { ...settings.shortcuts }
    if (accelerator === (defaultShortcut(id) ?? '') || accelerator === null) delete shortcuts[id]
    else shortcuts[id] = accelerator
    updateSettings({ shortcuts })
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey
    if (event.key === 'Escape' && plain) {
      onRecord(null)
      return
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && plain) {
      assign('')
      onRecord(null)
      return
    }
    const accelerator = acceleratorFromEvent(event.nativeEvent)
    if (!accelerator) {
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
        setMessage('Use Ctrl or Alt with a letter, digit or symbol, or a function key.')
      }
      return
    }
    const clash = ALL_COMMANDS.find((other) => {
      const shortcut = other !== id && shortcutFor(other, settings.shortcuts)
      return shortcut && sameShortcut(shortcut, accelerator)
    })
    if (clash) {
      setMessage(
        `${displayAccelerator(accelerator)} is already used by “${COMMANDS[clash].label}”.`
      )
      return
    }
    setMessage(null)
    assign(accelerator)
    onRecord(null)
  }

  return (
    <tr>
      <th scope="row">{COMMANDS[id].label.replace(/…$/, '')}</th>
      <td>
        <button
          type="button"
          className={recording ? 'shortcut-key recording' : 'shortcut-key'}
          data-shortcut-recorder={recording ? '' : undefined}
          data-testid={`shortcut-${id}`}
          aria-label={`Shortcut for ${COMMANDS[id].label}: ${current ? displayAccelerator(current) : 'none'}. Click to change.`}
          onClick={() => {
            setMessage(null)
            onRecord(recording ? null : id)
          }}
          onKeyDown={recording ? onKeyDown : undefined}
          onBlur={() => recording && onRecord(null)}
        >
          {recording ? 'Press a shortcut…' : current ? displayAccelerator(current) : '—'}
        </button>
        {message && (
          <div className="shortcut-message" role="alert">
            {message}
          </div>
        )}
      </td>
      <td className="shortcut-reset">
        {overridden && (
          <button type="button" className="link-button" onClick={() => assign(null)}>
            Reset
          </button>
        )}
      </td>
    </tr>
  )
}

function SettingsPanel(): React.JSX.Element {
  const settings = useSettings()
  const [recording, setRecording] = useState<CommandId | null>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        ref={dialog}
        className="modal settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="settings"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
        }}
      >
        <header className="modal-header">
          <h1 id="settings-title">Preferences</h1>
          <button type="button" className="icon-button" aria-label="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">
          <section>
            <h2>Appearance</h2>
            <div className="setting">
              <span className="setting-label" id="setting-theme-label">
                Theme
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="setting-theme-label">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.theme === theme.id}
                    onClick={() => updateSettings({ theme: theme.id })}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <label className="setting-label" htmlFor="setting-font">
                Font
              </label>
              <FontField key={settings.fontFamily} value={settings.fontFamily} />
            </div>
            <div className="setting">
              <label className="setting-label" htmlFor="setting-font-size">
                Font size
              </label>
              <input
                id="setting-font-size"
                type="range"
                min={FONT_SIZE_RANGE.min}
                max={FONT_SIZE_RANGE.max}
                step={1}
                value={settings.fontSize}
                onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
              />
              <span className="setting-value">{settings.fontSize}px</span>
            </div>
            <div className="setting">
              <label className="setting-label" htmlFor="setting-line-width">
                Text width
              </label>
              <input
                id="setting-line-width"
                type="range"
                min={LINE_WIDTH_RANGE.min}
                max={LINE_WIDTH_RANGE.max}
                step={20}
                value={settings.lineWidth}
                onChange={(event) => updateSettings({ lineWidth: Number(event.target.value) })}
              />
              <span className="setting-value">{settings.lineWidth}px</span>
            </div>
            <div className="setting">
              <span className="setting-label">Custom CSS</span>
              <button type="button" className="button" onClick={() => window.api.openCustomCss()}>
                Open custom.css…
              </button>
              <span className="setting-hint">Applied to every window when saved.</span>
            </div>
            {(settings.fontFamily !== DEFAULT_SETTINGS.fontFamily ||
              settings.fontSize !== DEFAULT_SETTINGS.fontSize ||
              settings.lineWidth !== DEFAULT_SETTINGS.lineWidth) && (
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  updateSettings({
                    fontFamily: DEFAULT_SETTINGS.fontFamily,
                    fontSize: DEFAULT_SETTINGS.fontSize,
                    lineWidth: DEFAULT_SETTINGS.lineWidth
                  })
                }
              >
                Reset font and width
              </button>
            )}
          </section>

          <section>
            <h2>Editor</h2>
            <label className="setting checkbox-setting">
              <input
                type="checkbox"
                data-testid="setting-autosave"
                checked={settings.autosave}
                onChange={(event) => updateSettings({ autosave: event.target.checked })}
              />
              <span>
                Save automatically
                <span className="setting-hint">
                  Files that already have a name are saved 2 seconds after you stop typing, and when
                  you switch to another file.
                </span>
              </span>
            </label>
          </section>

          <section>
            <div className="section-heading">
              <h2>Keyboard shortcuts</h2>
              {Object.keys(settings.shortcuts).length > 0 && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => updateSettings({ shortcuts: {} })}
                >
                  Restore all defaults
                </button>
              )}
            </div>
            <p className="setting-hint">
              Click a shortcut, then press the new keys. Backspace removes it, Escape cancels.
            </p>
            {GROUPS.map((group) => (
              <table key={group.prefix} className="shortcuts">
                <caption>{group.label}</caption>
                <tbody>
                  {ALL_COMMANDS.filter((id) => id.startsWith(group.prefix)).map((id) => (
                    <ShortcutRow
                      key={id}
                      id={id}
                      settings={settings}
                      recording={recording === id}
                      onRecord={setRecording}
                    />
                  ))}
                </tbody>
              </table>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

export function SettingsDialog(): React.JSX.Element | null {
  const { settingsOpen } = useUi()
  return settingsOpen ? <SettingsPanel /> : null
}
