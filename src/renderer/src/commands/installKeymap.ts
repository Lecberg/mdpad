import { commandForKey } from './keymap'
import { runCommand } from './runCommand'

/**
 * App-wide shortcuts. Listens in the capture phase so our bindings take precedence over the
 * editors' built-in ones (e.g. Milkdown's Ctrl+Alt+1 headings), and so shortcuts work the
 * same in visual mode, source mode, and the menus.
 */
export function installKeymap(): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.keyCode === 229) return // IME composition in progress
    const id = commandForKey(event)
    if (!id) return
    const target = event.target as HTMLElement | null
    const appLevel =
      id.startsWith('file.') ||
      id.startsWith('view.') ||
      id === 'edit.find' ||
      id === 'edit.replace'
    // In plain text fields (link URL box, find bar) leave editing keys to the field.
    const inTextField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
    if (inTextField && !appLevel) return
    // Inside a code block's own editor, Markdown formatting doesn't apply.
    const inCodeBlock = !!target?.closest?.('.milkdown-code-block')
    if (inCodeBlock && (id.startsWith('format.') || id.startsWith('paragraph.'))) return
    if (runCommand({ id })) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  window.addEventListener('keydown', onKeyDown, true)
  return () => window.removeEventListener('keydown', onKeyDown, true)
}
