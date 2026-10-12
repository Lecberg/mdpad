import { expect, test } from './harness'

// M2: shortcuts, syntax reveal, outline, source mode, and links in the real app.

test('Ctrl+S from the keyboard saves', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Final paragraph.', 'end')
  await page.keyboard.type(' Keyboard save.')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toContain('Final paragraph. Keyboard save.\n')
})

test('paragraph and format shortcuts produce the expected Markdown', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Title\n\nBody text\n\nItem\n')
  await mdpad.launch(path)
  const { page } = mdpad

  await page.getByText('Title').click()
  await page.keyboard.press('Control+2')
  // toContainText: the revealed "##" marker is part of the heading's DOM text.
  await expect(page.locator('.ProseMirror h2')).toContainText('Title')

  await mdpad.selectText('Body text')
  await page.keyboard.press('Control+b')
  await expect(page.locator('.ProseMirror strong')).toHaveText('Body text')

  await page.getByText('Item').click()
  await page.keyboard.press('Control+Shift+BracketRight')
  await expect(page.locator('.ProseMirror ul li')).toHaveText('Item')

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe('## Title\n\n**Body text**\n\n- Item\n')
})

test('Ctrl+Z undoes the last formatting change', async ({ mdpad }) => {
  await mdpad.launch(mdpad.writeFile('note.md', 'Heading soon\n'))
  const { page } = mdpad
  await page.getByText('Heading soon').click()
  await page.keyboard.press('Control+1')
  await expect(page.locator('.ProseMirror h1')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.ProseMirror h1')).toHaveCount(0)
})

test('menu items run the same commands', async ({ mdpad }) => {
  await mdpad.launch(mdpad.writeFile('note.md', 'Quote me\n'))
  const { page } = mdpad
  await page.getByText('Quote me').click()
  await mdpad.clickMenu('paragraph.quote')
  await expect(page.locator('.ProseMirror blockquote')).toHaveText('Quote me')
})

test('Markdown syntax is revealed around the caret', async ({ mdpad }) => {
  await mdpad.launch(mdpad.copyFixture('basics.md'))
  const { page } = mdpad
  await page.getByText('Final paragraph.').click()
  await expect(page.locator('.md-syntax')).toHaveCount(0)

  await page.locator('.ProseMirror strong', { hasText: 'strong text' }).click()
  await expect(page.locator('.md-syntax')).toHaveText(['**', '**'])

  await page.locator('.ProseMirror h2').click()
  await expect(page.locator('.md-heading-marker')).toHaveText('##')
})

test('outline lists headings, follows the caret, and navigates', async ({ mdpad }) => {
  await mdpad.launch(mdpad.copyFixture('basics.md'))
  const { page } = mdpad
  await expect(page.getByTestId('sidebar')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+Digit1')

  const items = page.getByTestId('outline').getByRole('button')
  await expect(items).toHaveText(['Project notes', 'Second level', 'Third level', 'Fourth level'])

  await items.filter({ hasText: 'Fourth level' }).click()
  await expect(page.locator('[aria-current="location"]')).toHaveText('Fourth level')

  await page.keyboard.press('Control+Shift+Digit1')
  await expect(page.getByTestId('sidebar')).toHaveCount(0)
})

test('source mode shows the file text and edits there are saved exactly', async ({ mdpad }) => {
  const path = mdpad.copyFixture('syntax-variants.md')
  const original = mdpad.read(path)
  await mdpad.launch(path)
  const { page } = mdpad

  await page.keyboard.press('Control+/')
  const source = page.getByTestId('source-editor')
  await expect(source).toBeVisible()
  await expect(page.getByTestId('mode')).toHaveText('Source')
  // The original syntax is shown, not the editor's normalized form.
  await expect(source).toContainText('Setext Heading')
  await expect(source).toContainText('==============')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')

  await page.locator('.cm-content').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('\nAdded in source.\n')
  await expect(page.getByTestId('save-state')).toHaveText('Unsaved changes')

  await page.keyboard.press('Control+/')
  await expect(page.locator('.ProseMirror')).toContainText('Added in source.')
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe(original + '\nAdded in source.\n')
})

test('switching to source mode and back without edits stays clean', async ({ mdpad }) => {
  const path = mdpad.copyFixture('syntax-variants.md')
  await mdpad.launch(path)
  const { page } = mdpad
  await page.keyboard.press('Control+/')
  await expect(page.getByTestId('source-editor')).toBeVisible()
  await page.keyboard.press('Control+/')
  await expect(page.locator('.ProseMirror')).toBeVisible()
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  await expect(page).toHaveTitle('syntax-variants.md — mdpad')
})

test('Ctrl+K turns the selection into a link', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Read the docs today\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('docs')
  await page.keyboard.press('Control+k')

  const input = page.getByTestId('link-input')
  await expect(input).toBeFocused()
  await input.fill('https://example.com/docs')
  await input.press('Enter')
  await expect(page.locator('.ProseMirror a')).toHaveAttribute('href', 'https://example.com/docs')

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(mdpad.read(path)).toBe('Read the [docs](https://example.com/docs) today\n')
})

test('word count is shown in the status bar', async ({ mdpad }) => {
  await mdpad.launch(mdpad.writeFile('note.md', 'one two three\n\n中文\n'))
  await expect(mdpad.page.getByTestId('word-count')).toHaveText('5 words')
})
