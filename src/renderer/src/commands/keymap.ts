import {
  matchesShortcut,
  parseAccelerator,
  type KeyLike,
  type Shortcut
} from '../../../shared/accelerators'
import {
  COMMANDS,
  shortcutFor,
  type CommandId,
  type ShortcutOverrides
} from '../../../shared/commands'

// Which command a key press triggers: the command table's shortcuts, with the user's
// overrides from Preferences applied.

export { parseAccelerator }

function buildBindings(overrides: ShortcutOverrides): Array<[Shortcut, CommandId]> {
  return (Object.keys(COMMANDS) as CommandId[]).flatMap((id) => {
    const accelerator = shortcutFor(id, overrides)
    if (!accelerator) return []
    try {
      return [[parseAccelerator(accelerator), id] as [Shortcut, CommandId]]
    } catch {
      return []
    }
  })
}

const defaultBindings = buildBindings({})
let bindings = defaultBindings

export function setShortcutOverrides(overrides: ShortcutOverrides): void {
  bindings = buildBindings(overrides)
}

export function commandForKey(event: KeyLike): CommandId | null {
  for (const [shortcut, id] of bindings) {
    if (matchesShortcut(event, shortcut)) return id
  }
  return null
}

/**
 * A key press that is one of the app's default shortcuts but no longer bound to anything
 * (the user moved or removed it). It should do nothing, rather than fall through to the
 * editors' own built-in bindings (e.g. Milkdown's Ctrl+B).
 */
export function isReleasedDefault(event: KeyLike): boolean {
  return (
    commandForKey(event) === null &&
    defaultBindings.some(([shortcut]) => matchesShortcut(event, shortcut))
  )
}
