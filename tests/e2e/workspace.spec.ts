import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { expect, test, type Mdpad } from './harness'

// M4: folder mode (file tree, create/rename/delete), Quick Open, folder search, themes,
// settings, custom shortcuts, recent files.

/** A notes folder inside the test's scratch folder (which also holds the app's profile). */
function notesFolder(mdpad: Mdpad, files: Record<string, string>): string {
  const root = join(mdpad.dir, 'notes')
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, text)
  }
  mkdirSync(root, { recursive: true })
  return root
}

const tree = (mdpad: Mdpad): ReturnType<Mdpad['page']['getByTestId']> =>
  mdpad.page.getByTestId('file-tree')

const item = (mdpad: Mdpad, name: string): ReturnType<Mdpad['page']['getByRole']> =>
  tree(mdpad).getByRole('treeitem', { name, exact: true })

test('a folder opens in the file tree; clicking files switches documents', async ({ mdpad }) => {
  const root = notesFolder(mdpad, {
    'alpha.md': '# Alpha\n',
    'sub/beta.md': 'Beta text\n'
  })
  await mdpad.launch(root)
  const { page } = mdpad
  await expect(item(mdpad, 'alpha.md')).toBeVisible()
  await expect(item(mdpad, 'beta.md')).toHaveCount(0) // inside a collapsed folder

  await item(mdpad, 'sub').click()
  await item(mdpad, 'beta.md').click()
  await expect(page.locator('.ProseMirror')).toContainText('Beta text')
  await expect(page).toHaveTitle('beta.md — mdpad')
  await expect(item(mdpad, 'beta.md')).toHaveAttribute('aria-current', 'page')

  // Switching files saves the current one (autosave is on by default).
  await mdpad.selectText('Beta text', 'end')
  await page.keyboard.type(' edited')
  await item(mdpad, 'alpha.md').click()
  await expect(page.locator('.ProseMirror h1')).toContainText('Alpha')
  expect(mdpad.read(join(root, 'sub', 'beta.md'))).toBe('Beta text edited\n')

  // Files created by other programs appear.
  writeFileSync(join(root, 'gamma.md'), '')
  await expect(item(mdpad, 'gamma.md')).toBeVisible()
})

test('files and folders can be created, renamed and deleted', async ({ mdpad }) => {
  const root = notesFolder(mdpad, { 'old.md': 'old\n' })
  await mdpad.launch(root)
  const { page } = mdpad
  await mdpad.app.evaluate(({ dialog, shell }) => {
    dialog.showMessageBoxSync = () => 0 // "Move to Recycle Bin"
    // Don't fill the real Recycle Bin from tests.
    shell.trashItem = async (path: string) =>
      process.getBuiltinModule('fs').rmSync(path, { recursive: true })
  })

  // New file from the tree's context menu; it opens right away.
  await page.locator('.file-tree-header').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'New File' }).click()
  await page.getByTestId('tree-name-input').fill('Ideas')
  await page.getByTestId('tree-name-input').press('Enter')
  await expect(page).toHaveTitle('Ideas.md — mdpad')
  expect(existsSync(join(root, 'Ideas.md'))).toBe(true)

  // An invalid name is explained in place.
  await page.getByRole('button', { name: 'New File' }).click()
  await page.getByTestId('tree-name-input').fill('what?')
  await page.getByTestId('tree-name-input').press('Enter')
  await expect(page.locator('.tree-name-error')).toContainText('can’t contain')
  await page.getByTestId('tree-name-input').press('Escape')

  // Renaming the open file keeps it open under the new name.
  await item(mdpad, 'Ideas.md').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Rename' }).click()
  await page.getByTestId('tree-name-input').fill('Plans')
  await page.getByTestId('tree-name-input').press('Enter')
  await expect(item(mdpad, 'Plans.md')).toBeVisible()
  expect(existsSync(join(root, 'Ideas.md'))).toBe(false)
  await expect(page.getByTestId('status-bar')).toContainText('Plans.md')
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('Saved under the new name')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(join(root, 'Plans.md'))).toBe('Saved under the new name\n')

  // New folder, then delete a file (F2/Delete work from the keyboard too).
  await page.getByRole('button', { name: 'New Folder' }).click()
  await page.getByTestId('tree-name-input').fill('Archive')
  await page.getByTestId('tree-name-input').press('Enter')
  await expect(item(mdpad, 'Archive')).toBeVisible()
  await item(mdpad, 'old.md').focus()
  await page.keyboard.press('Delete')
  await expect(item(mdpad, 'old.md')).toHaveCount(0)
  expect(existsSync(join(root, 'old.md'))).toBe(false)
})

test('Quick Open finds files by fuzzy name', async ({ mdpad }) => {
  const root = notesFolder(mdpad, {
    'inbox.md': 'inbox\n',
    'journal/week-notes.md': 'Weekly review\n',
    'journal/workouts.md': 'Run\n'
  })
  await mdpad.launch(root)
  const { page } = mdpad
  await page.keyboard.press('Control+p')
  await expect(page.getByTestId('quick-open')).toBeVisible()
  await page.keyboard.type('wkn')
  await expect(page.getByRole('option').first()).toContainText('week-notes')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('quick-open')).toHaveCount(0)
  await expect(page.locator('.ProseMirror')).toContainText('Weekly review')
})

test('search in folder lists matches and opens one selected', async ({ mdpad }) => {
  const root = notesFolder(mdpad, {
    'a.md': 'A haystack with a needle.\n',
    'deep/b.md': '# B\n\nfirst needle\n\nsecond needle here\n',
    'c.md': 'nothing\n'
  })
  await mdpad.launch(root)
  const { page } = mdpad
  await page.keyboard.press('Control+Shift+f')
  await page.getByTestId('search-input').fill('needle')
  await expect(page.getByTestId('search-status')).toHaveText('3 results in 2 files')

  await page.locator('.search-match', { hasText: 'second needle here' }).click()
  await expect(page).toHaveTitle('b.md — mdpad')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('needle')
  // The second match in the file is the one selected.
  await page.keyboard.type('pin')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(join(root, 'deep', 'b.md'))).toBe('# B\n\nfirst needle\n\nsecond pin here\n')
})

test('theme, font size and autosave are set in Preferences and remembered', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Draft\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await page.keyboard.press('Control+,')
  const settings = page.getByTestId('settings')
  await expect(settings).toBeVisible()

  await settings.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await settings.getByLabel('Font size').fill('20')
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('.ProseMirror p')!).fontSize)
    )
    .toBe('20px')
  await settings.getByTestId('setting-autosave').uncheck()
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)

  // With autosave off, edits stay unsaved.
  await mdpad.selectText('Draft', 'end')
  await page.keyboard.type(' unsaved')
  await page.waitForTimeout(3000)
  expect(mdpad.read(path)).toBe('Draft\n')
  await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')

  const stored = JSON.parse(readFileSync(join(mdpad.userData, 'settings.json'), 'utf8'))
  expect(stored).toMatchObject({ theme: 'dark', fontSize: 20, autosave: false })

  await mdpad.app.close()
  await mdpad.launch(path)
  await expect(mdpad.page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('shortcuts can be changed, and the menu shows the new one', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'make me bold\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await page.keyboard.press('Control+,')
  await page.getByTestId('shortcut-format.bold').click()
  await page.keyboard.press('Control+Shift+b')
  await expect(page.getByTestId('shortcut-format.bold')).toHaveText('Ctrl+Shift+B')

  // A shortcut that is already taken is refused.
  await page.getByTestId('shortcut-format.italic').click()
  await page.keyboard.press('Control+Shift+b')
  await expect(page.getByRole('alert')).toContainText('already used by “Bold”')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings')).toHaveCount(0)

  await mdpad.selectText('bold')
  await page.keyboard.press('Control+b') // no longer bold
  await page.keyboard.press('Control+Shift+b')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe('make me **bold**\n')

  const accelerator = await mdpad.app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('format.bold')!.accelerator
  )
  expect(accelerator).toBe('CmdOrCtrl+Shift+B')
})

test('opened files are listed under Open Recent', async ({ mdpad }) => {
  const path = mdpad.writeFile('remember me.md', 'hi\n')
  await mdpad.launch(path)
  const labels = await mdpad.app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()!
      .getMenuItemById('file.openRecent')!
      .submenu!.items.map((i) => i.label)
  )
  expect(labels).toContain(path)
})

test('Ctrl+N opens a new window from the keyboard', async ({ mdpad }) => {
  await mdpad.launch()
  await mdpad.page.keyboard.press('Control+n')
  await expect.poll(() => mdpad.app.windows().length).toBe(2)
})
