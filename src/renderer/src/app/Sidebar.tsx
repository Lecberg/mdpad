import { Outline } from '../navigation/Outline'

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="sidebar" data-testid="sidebar">
      <h2 className="sidebar-title">Outline</h2>
      <div className="sidebar-body">
        <Outline />
      </div>
    </aside>
  )
}
