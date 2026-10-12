// Small line icons for the app chrome (16×16 grid, drawn with the current text color).

const PATHS = {
  files: 'M2.5 3.5h4l1.5 1.5h5.5v7.5h-11z',
  outline: 'M3 4h10M5 8h8M7 12h6',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3l3.2 3.2',
  chevron: 'M6 4l4 4-4 4',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  newFile: 'M4 2.5h5l3 3v8H4zM8 7.5v4M6 9.5h4',
  newFolder: 'M2.5 3.5h4l1.5 1.5h5.5v7.5h-11zM8 7v4M6 9h4',
  refresh: 'M12.5 6.5A4.8 4.8 0 1 0 13 9M12.5 3v3.5H9',
  close: 'M4 4l8 8M12 4l-8 8'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="icon">
      <path
        d={PATHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
