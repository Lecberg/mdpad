import { useLayoutEffect, useRef, useState } from 'react'

interface Props {
  initial: string
  /** Select only the part before the extension, as Explorer does. */
  selectStem?: boolean
  label: string
  /** Resolves to an error message, or null when done. */
  onSubmit: (name: string) => Promise<string | null>
  onCancel: () => void
}

/** Inline name box in the file tree, for new and renamed files and folders. */
export function NameInput({
  initial,
  selectStem,
  label,
  onSubmit,
  onCancel
}: Props): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  useLayoutEffect(() => {
    const input = ref.current!
    input.focus()
    const dot = initial.lastIndexOf('.')
    input.setSelectionRange(0, selectStem && dot > 0 ? dot : initial.length)
  }, [initial, selectStem])

  const submit = async (): Promise<void> => {
    if (busy.current) return
    const name = value.trim()
    if (!name || name === initial) {
      onCancel()
      return
    }
    busy.current = true
    const problem = await onSubmit(name)
    busy.current = false
    setError(problem)
    if (problem) ref.current?.focus()
  }

  return (
    <div className="tree-name-input">
      <input
        ref={ref}
        value={value}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        data-testid="tree-name-input"
        spellCheck={false}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
        onBlur={() => {
          if (!error) void submit()
        }}
      />
      {error && (
        <div className="tree-name-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
