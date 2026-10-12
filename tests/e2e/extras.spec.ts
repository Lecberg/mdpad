import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { expect, test, type Mdpad } from './harness'

// M5: math, diagrams, highlight, export, focus and typewriter modes.

async function save(mdpad: Mdpad): Promise<void> {
  await mdpad.page.keyboard.press('Control+s')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
}

test('inline math renders, opens as source when clicked, and renders again', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Area:\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Area:', 'end')
  await page.keyboard.type(' $\\pi r^2$ done')
  await expect(page.locator('.md-math-inline .katex')).toHaveCount(1)
  await save(mdpad)
  expect(mdpad.read(path)).toBe('Area: $\\pi r^2$ done\n')

  // Clicking shows the source with a preview; leaving the paragraph renders it again.
  await page.locator('.md-math-inline .katex-html').click()
  await expect(page.locator('.md-math-source')).toHaveText('$\\pi r^2$')
  await expect(page.locator('.md-math-preview .katex')).toHaveCount(1)
  await page.keyboard.type('h') // the caret starts just before the closing $
  // Leave the formula (End is read asynchronously, so place the caret deterministically).
  await mdpad.selectText(' done', 'end')
  await page.keyboard.press('Enter')
  await expect(page.locator('.md-math-inline')).toHaveAttribute('data-value', '\\pi r^2h')
  await save(mdpad)
  expect(mdpad.read(path)).toBe('Area: $\\pi r^2h$ done\n')
})

test('money amounts are not mistaken for math', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Lunch $5 and coffee $3.\n')
  await mdpad.launch(path)
  await expect(mdpad.page.locator('.md-math-inline')).toHaveCount(0)
  await mdpad.selectText('coffee $3.', 'end')
  await mdpad.page.keyboard.type(' Total $8.')
  await save(mdpad)
  expect(mdpad.read(path)).toBe('Lunch $5 and coffee $3. Total $8.\n')
})

test('$$ then Enter starts a math block that saves as $$…$$', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Formula:\n')
  await mdpad.launch(path)
  const { page } = mdpad
  await mdpad.selectText('Formula:', 'end')
  await page.keyboard.press('Enter')
  await page.keyboard.type('$$')
  await page.keyboard.press('Enter')
  await page.keyboard.type('x = \\frac{1}{2}')
  await expect(page.locator('.milkdown-code-block .preview .katex')).toHaveCount(1)
  await save(mdpad)
  expect(mdpad.read(path)).toBe('Formula:\n\n$$\nx = \\frac{1}{2}\n$$\n')
})

test('Mermaid diagrams render; their source shows when focused', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'Flow:\n\n```mermaid\ngraph LR\n  A --> B\n```\n')
  await mdpad.launch(path)
  const { page } = mdpad
  const block = page.locator('.milkdown-code-block')
  await expect(block.locator('.preview svg')).toHaveCount(1, { timeout: 15000 })
  await expect(block.locator('.cm-content')).not.toBeInViewport()
  await block.locator('.preview').click()
  await expect(block.locator('.cm-content')).toBeFocused()
  await expect(block.locator('.tools')).toBeVisible()
})

test('Ctrl+Shift+H highlights the selection', async ({ mdpad }) => {
  const path = mdpad.writeFile('note.md', 'remember this part\n')
  await mdpad.launch(path)
  await mdpad.selectText('this part')
  await mdpad.page.keyboard.press('Control+Shift+h')
  await expect(mdpad.page.locator('mark.md-highlight')).toHaveText('this part')
  await save(mdpad)
  expect(mdpad.read(path)).toBe('remember ==this part==\n')
})

test('exports HTML and PDF', async ({ mdpad }) => {
  const path = mdpad.writeFile('report.md', '# Report\n\nSee $a^2$ and ==this==.\n')
  await mdpad.launch(path)
  const html = join(mdpad.dir, 'out.html')
  const pdf = join(mdpad.dir, 'out.pdf')
  const stubSaveDialog = (target: string): Promise<void> =>
    mdpad.app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath: file })) as never
    }, target)

  await stubSaveDialog(html)
  await mdpad.clickMenu('file.exportHtml')
  await expect(mdpad.page.getByTestId('status-message')).toHaveText('Exported to out.html')
  const page = readFileSync(html, 'utf8')
  expect(page).toContain('<title>Report</title>')
  expect(page).toContain('<mark>this</mark>')
  expect(page).toContain('class="katex"')
  expect(page).toMatch(/@font-face\{[^}]*data:font\/woff2;base64,/) // math fonts embedded

  await stubSaveDialog(pdf)
  await mdpad.clickMenu('file.exportPdf')
  await expect(mdpad.page.getByTestId('status-message')).toHaveText('Exported to out.pdf', {
    timeout: 20000
  })
  expect(existsSync(pdf)).toBe(true)
  expect(readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-')
})

test('focus mode (F8) and typewriter mode (F9) toggle and are remembered', async ({ mdpad }) => {
  const lines = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n')
  const path = mdpad.writeFile('long.md', `${lines}\n`)
  await mdpad.launch(path)
  const { page } = mdpad
  const app = page.locator('.app')

  await mdpad.selectText('Paragraph 3', 'end')
  await page.keyboard.press('F8')
  await expect(app).toHaveClass(/focus-mode/)
  const opacity = (text: string): Promise<string> =>
    page
      .locator('.ProseMirror > p', { hasText: new RegExp(`^${text}$`) })
      .evaluate((el) => getComputedStyle(el).opacity)
  await expect.poll(() => opacity('Paragraph 3')).toBe('1')
  await expect.poll(() => opacity('Paragraph 4')).not.toBe('1')

  await page.keyboard.press('F9')
  await expect(app).toHaveClass(/typewriter-mode/)
  await mdpad.selectText('Paragraph 60', 'end')
  await page.keyboard.type(' typed')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scroller = document.querySelector('.editor-scroll')!.getBoundingClientRect()
        const caret = window.getSelection()!.getRangeAt(0).getBoundingClientRect()
        return Math.abs(caret.top - (scroller.top + scroller.height / 2))
      })
    )
    .toBeLessThan(40)

  const checked = await mdpad.app.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu()!
    return [
      menu.getMenuItemById('view.focusMode')!.checked,
      menu.getMenuItemById('view.typewriterMode')!.checked
    ]
  })
  expect(checked).toEqual([true, true])
  const stored = JSON.parse(readFileSync(join(mdpad.userData, 'settings.json'), 'utf8'))
  expect(stored).toMatchObject({ focusMode: true, typewriterMode: true })
})
