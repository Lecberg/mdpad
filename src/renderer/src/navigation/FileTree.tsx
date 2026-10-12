import { useCallback, useEffect, useState } from 'react'
import type { TreeNode } from '../../../shared/ipc-types'
import { ContextMenu, type MenuEntry } from '../app/ContextMenu'
import { Icon } from '../app/icons'
import { openDocument } from '../commands/openDocument'
import { baseName, extensionOf, isMarkdownName, samePath } from '../lib/paths'
import { useDocument } from '../state/documentStore'
import { expandTo, isExpanded, setExpanded, useFolder } from '../state/folderStore'
import { NameInput } from './NameInput'

type Editing =
  | { kind: 'rename'; node: TreeNode }
  | { kind: 'create'; parent: string; nodeKind: 'file' | 'dir' }
  | null

interface MenuState {
  x: number
  y: number
  items: MenuEntry[]
}

const INDENT = 14

async function createEntry(
  parent: string,
  name: string,
  kind: 'file' | 'dir'
): Promise<string | null> {
  const finalName = kind === 'file' && !isMarkdownName(name) ? `${name}.md` : name
  const result = await window.api.createEntry(parent, finalName, kind)
  if (!result.ok) return result.error ?? null
  setExpanded(parent, true)
  if (kind === 'file') await openDocument(result.path)
  return null
}

async function renameEntry(node: TreeNode, name: string): Promise<string | null> {
  // Keep Markdown files Markdown: "notes" for "notes.md" means "notes.md".
  const finalName =
    node.kind === 'file' && isMarkdownName(node.name) && !isMarkdownName(name)
      ? name + extensionOf(node.name)
      : name
  const result = await window.api.renameEntry(node.path, finalName)
  return result.ok ? null : (result.error ?? null)
}

async function trashEntry(path: string): Promise<void> {
  const result = await window.api.trashEntry(path)
  if (!result.ok && result.error)
    window.alert(`Could not delete “${baseName(path)}”.\n\n${result.error}`)
}

function NameParts({ node }: { node: TreeNode }): React.JSX.Element {
  const ext = node.kind === 'file' ? extensionOf(node.name) : ''
  return (
    <span className="tree-name">
      {ext ? node.name.slice(0, -ext.length) : node.name}
      {ext && <span className="tree-ext">{ext}</span>}
    </span>
  )
}

export function FileTree(): React.JSX.Element {
  const state = useFolder()
  const { folder } = state
  const doc = useDocument()
  const [editing, setEditing] = useState<Editing>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  // Keep the open document visible in the tree.
  useEffect(() => {
    if (doc.path) expandTo(doc.path)
  }, [doc.path, folder?.root])

  if (!folder) {
    return (
      <div className="sidebar-empty">
        <p>Open a folder to browse and manage its Markdown files.</p>
        <button
          type="button"
          className="button"
          onClick={() => window.api.runMainCommand('file.openFolder')}
        >
          Open Folder…
        </button>
      </div>
    )
  }

  const startCreate = (parent: string, nodeKind: 'file' | 'dir'): void => {
    setExpanded(parent, true)
    setEditing({ kind: 'create', parent, nodeKind })
  }

  const folderItems = (dir: string): MenuEntry[] => [
    { label: 'New File', onSelect: () => startCreate(dir, 'file') },
    { label: 'New Folder', onSelect: () => startCreate(dir, 'dir') },
    'separator',
    { label: 'Reveal in File Explorer', onSelect: () => window.api.revealInExplorer(dir) }
  ]

  const nodeItems = (node: TreeNode): MenuEntry[] => [
    ...(node.kind === 'dir'
      ? folderItems(node.path).slice(0, 3)
      : [{ label: 'Open', onSelect: () => void openDocument(node.path) }, 'separator' as const]),
    { label: 'Rename', onSelect: () => setEditing({ kind: 'rename', node }) },
    { label: 'Copy Path', onSelect: () => void navigator.clipboard.writeText(node.path) },
    { label: 'Reveal in File Explorer', onSelect: () => window.api.revealInExplorer(node.path) },
    'separator',
    { label: 'Move to Recycle Bin', danger: true, onSelect: () => void trashEntry(node.path) }
  ]

  const openMenu = (event: React.MouseEvent, items: MenuEntry[]): void => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, items })
  }

  const createRow = (parent: string, depth: number): React.JSX.Element | null => {
    if (editing?.kind !== 'create' || !samePath(editing.parent, parent)) return null
    const { nodeKind } = editing
    return (
      <li role="none" className="tree-editing" style={{ paddingLeft: 8 + depth * INDENT }}>
        <NameInput
          initial={nodeKind === 'file' ? 'Untitled.md' : 'New folder'}
          selectStem
          label={nodeKind === 'file' ? 'New file name' : 'New folder name'}
          onSubmit={async (name) => {
            const error = await createEntry(parent, name, nodeKind)
            if (!error) setEditing(null)
            return error
          }}
          onCancel={() => setEditing(null)}
        />
      </li>
    )
  }

  const renderNodes = (nodes: TreeNode[], depth: number): React.JSX.Element[] =>
    nodes.map((node) => {
      const isDir = node.kind === 'dir'
      const open = isDir && isExpanded(state, node.path)
      const renaming = editing?.kind === 'rename' && samePath(editing.node.path, node.path)
      const active = !isDir && samePath(doc.path, node.path)
      return (
        <li key={node.path} role="none">
          {renaming ? (
            <div className="tree-editing" style={{ paddingLeft: 8 + depth * INDENT }}>
              <NameInput
                initial={node.name}
                selectStem={!isDir}
                label="New name"
                onSubmit={async (name) => {
                  const error = await renameEntry(node, name)
                  if (!error) setEditing(null)
                  return error
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : (
            <button
              type="button"
              role="treeitem"
              className="tree-item"
              aria-label={node.name}
              aria-expanded={isDir ? open : undefined}
              aria-current={active ? 'page' : undefined}
              title={node.path}
              style={{ paddingLeft: 8 + depth * INDENT }}
              onClick={() => (isDir ? setExpanded(node.path, !open) : void openDocument(node.path))}
              onContextMenu={(event) => openMenu(event, nodeItems(node))}
              onKeyDown={(event) => {
                if (event.key === 'F2') {
                  event.preventDefault()
                  setEditing({ kind: 'rename', node })
                } else if (event.key === 'Delete') {
                  event.preventDefault()
                  void trashEntry(node.path)
                } else if (isDir && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
                  event.preventDefault()
                  setExpanded(node.path, event.key === 'ArrowRight')
                }
              }}
            >
              <span className={open ? 'tree-chevron open' : 'tree-chevron'}>
                {isDir && <Icon name="chevron" size={12} />}
              </span>
              <NameParts node={node} />
            </button>
          )}
          {isDir && open && (
            <ul role="group" className="tree-group">
              {createRow(node.path, depth + 1)}
              {renderNodes(node.children ?? [], depth + 1)}
            </ul>
          )}
        </li>
      )
    })

  return (
    <div className="file-tree" onContextMenu={(event) => openMenu(event, folderItems(folder.root))}>
      <div className="file-tree-header">
        <span className="file-tree-title" title={folder.root}>
          {baseName(folder.root)}
        </span>
        <button
          type="button"
          className="icon-button"
          title="New File"
          aria-label="New File"
          onClick={() => startCreate(folder.root, 'file')}
        >
          <Icon name="newFile" />
        </button>
        <button
          type="button"
          className="icon-button"
          title="New Folder"
          aria-label="New Folder"
          onClick={() => startCreate(folder.root, 'dir')}
        >
          <Icon name="newFolder" />
        </button>
      </div>
      <ul role="tree" aria-label="Files" className="tree" data-testid="file-tree">
        {createRow(folder.root, 0)}
        {renderNodes(folder.children, 0)}
      </ul>
      {folder.children.length === 0 && editing === null && (
        <p className="sidebar-note">This folder has no Markdown files yet.</p>
      )}
      {folder.truncated && (
        <p className="sidebar-note">This folder is very large; only part of it is shown.</p>
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  )
}
