import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { expect, test } from './harness'

// M3: tables, task lists, images, find & replace, autosave, crash recovery, outside changes.

const PNG_BASE64 = readFileSync(join(__dirname, '../../resources/icon.png')).toString('base64')

test('Ctrl+T inserts a table; Tab moves between cells', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Before\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Before', 'end')
  await page.keyboard.press('Control+t')
  await expect(page.locator('.milkdown-table-block')).toHaveCount(1)

  await page.keyboard.type('Name')
  await page.keyboard.press('Tab')
  await page.keyboard.type('Age')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  // A new table has no alignment markers (":---"), as in Typora.
  expect(mdpad.read(path)).toMatch(/^Before\n\n\| Name \| Age \| +\|\n\| -+ \| -+ \| -+ \|\n/)
})

test('task checkboxes toggle and strikethrough has a shortcut', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', '- [ ] buy milk\n\nold idea\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await page.locator('li[data-item-type="task"]').click({ position: { x: -12, y: 10 } })
  await expect(page.locator('li[data-item-type="task"]')).toHaveAttribute('data-checked', 'true')

  await mdpad.selectText('old idea')
  await page.keyboard.press('Alt+Shift+5')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe('- [x] buy milk\n\n~~old idea~~\n')
})

test('pasting an image saves it next to the document and shows it', async ({ mdpad }) => {
  const path = mdpad.writeFile('My Note.md', 'Screenshot:\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Screenshot:', 'end')
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'clip.png', { type: 'image/png' }))
    const paste = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true
    })
    document.querySelector('.ProseMirror')!.dispatchEvent(paste)
  }, PNG_BASE64)

  const img = page.locator('.ProseMirror .md-image img')
  await expect(img).toHaveCount(1)
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0)

  const assets = readdirSync(join(mdpad.dir, 'My Note.assets'))
  expect(assets).toHaveLength(1)
  expect(assets[0]).toMatch(/^image-\d{8}-\d{6}\.png$/)

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toContain(`![](<My Note.assets/${assets[0]}>)`)
})

test('find highlights matches and replace all rewrites them', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'cat and cat\n\nanother cat\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await page.locator('.ProseMirror').click()
  await page.keyboard.press('Control+h')
  await page.getByTestId('find-input').fill('cat')
  await expect(page.getByTestId('find-status')).toHaveText('3 found')
  await expect(page.locator('.ProseMirror-search-match')).toHaveCount(3)

  await page.getByTestId('find-input').press('Enter')
  await expect(page.getByTestId('find-status')).toHaveText('1 of 3')

  await page.getByTestId('replace-input').fill('dog')
  await page.getByTestId('replace-all').click()
  await expect(page.getByTestId('find-status')).toHaveText('No results')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('find-bar')).toHaveCount(0)

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe('dog and dog\n\nanother dog\n')
})

test('find in source mode uses the source editor search panel', async ({ mdpad }) => {
  await mdpad.launch(mdpad.writeFile('note.md', 'hello\n'))
  const { page } = mdpad
  await page.keyboard.press('Control+/')
  await expect(page.getByTestId('source-editor')).toBeVisible()
  await page.keyboard.press('Control+f')
  await expect(page.locator('.cm-search')).toBeVisible()
})

test('autosave writes edits to disk after a pause', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Draft\n')
  await mdpad.launch(path)
  await mdpad.selectText('Draft', 'end')
  await mdpad.page.keyboard.type(' autosaved')
  await expect.poll(() => mdpad.read(path), { timeout: 8000 }).toBe('Draft autosaved\n')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
})

test('unsaved work survives a crash and can be kept', async ({ mdpad }) => {
  await mdpad.launch()
  await mdpad.page.locator('.ProseMirror').click()
  await mdpad.page.keyboard.type('Precious unsaved words')
  const recoveryDir = join(mdpad.userData, 'recovery')
  await expect
    .poll(() => existsSync(recoveryDir) && readdirSync(recoveryDir).length, { timeout: 8000 })
    .toBe(1)

  await mdpad.crash()
  await mdpad.launch()
  const { page } = mdpad
  await expect(page.getByTestId('notice')).toContainText('Recovered unsaved changes')
  await expect(page.locator('.ProseMirror')).toContainText('Precious unsaved words')
  await expect(page).toHaveTitle('● Untitled — mdpad')

  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(page.getByTestId('notice')).toHaveCount(0)
  await expect(page.locator('.ProseMirror')).toContainText('Precious unsaved words')
})

test('a recovered draft can be discarded', async ({ mdpad }) => {
  await mdpad.launch()
  await mdpad.page.locator('.ProseMirror').click()
  await mdpad.page.keyboard.type('Throwaway')
  const recoveryDir = join(mdpad.userData, 'recovery')
  await expect
    .poll(() => existsSync(recoveryDir) && readdirSync(recoveryDir).length, { timeout: 8000 })
    .toBe(1)
  await mdpad.crash()
  await mdpad.launch()
  const { page } = mdpad
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(page.locator('.ProseMirror')).not.toContainText('Throwaway')
  await expect(page).toHaveTitle('Untitled — mdpad')
})

test('a clean document reloads when another program changes the file', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Original text\n')
  await mdpad.launch(path)
  await expect(mdpad.page.locator('.ProseMirror')).toContainText('Original text')
  writeFileSync(path, 'Changed elsewhere\n')
  await expect(mdpad.page.locator('.ProseMirror')).toContainText('Changed elsewhere')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
})

test('with unsaved edits, an outside change asks before reloading', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Original text\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Original text', 'end')
  await page.keyboard.type(' plus mine')
  writeFileSync(path, 'Changed elsewhere\n')
  await expect(page.getByTestId('notice')).toContainText('changed by another program')

  // Autosave holds off while the question is open.
  await page.waitForTimeout(2500)
  expect(mdpad.read(path)).toBe('Changed elsewhere\n')

  await page.getByRole('button', { name: 'Reload from disk' }).click()
  await expect(page.locator('.ProseMirror')).toContainText('Changed elsewhere')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
})
