import { FileTree } from '../navigation/FileTree'
import { Outline } from '../navigation/Outline'
import { SearchPanel } from '../navigation/SearchPanel'
import { uiStore, useUi, type SidebarTab } from '../state/uiStore'
import { Icon, type IconName } from './icons'

const TABS: Array<{ id: SidebarTab; label: string; icon: IconName }> = [
  { id: 'files', label: 'Files', icon: 'files' },
  { id: 'outline', label: 'Outline', icon: 'outline' },
  { id: 'search', label: 'Search', icon: 'search' }
]

export function Sidebar(): React.JSX.Element {
  const { sidebarTab } = useUi()
  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`sidebar-tab-${tab.id}`}
            aria-selected={sidebarTab === tab.id}
            aria-controls="sidebar-panel"
            className="sidebar-tab"
            title={tab.label}
            onClick={() => uiStore.set({ sidebarTab: tab.id })}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div
        className="sidebar-body"
        id="sidebar-panel"
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${sidebarTab}`}
      >
        {sidebarTab === 'files' && <FileTree />}
        {sidebarTab === 'outline' && <Outline />}
        {sidebarTab === 'search' && <SearchPanel />}
      </div>
    </aside>
  )
}
