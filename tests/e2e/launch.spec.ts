import { expect, test } from './harness'

// M1: opening, editing, saving, and closing files.

test('starts with an empty untitled document', async ({ mdpad }) => {
  await mdpad.launch()
  await expect(mdpad.page).toHaveTitle('Untitled — mdpad')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('New document')
})

test('opens a file passed on the command line', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  await expect(mdpad.page).toHaveTitle('basics.md — mdpad')
  await expect(mdpad.page.locator('.ProseMirror h1')).toContainText('Project notes')
  await expect(mdpad.page.locator('.ProseMirror strong').first()).toHaveText('strong text')
})

test('clicking and moving the caret does not mark the document dirty', async ({ mdpad }) => {
  const path = mdpad.copyFixture('lists.md')
  await mdpad.launch(path)
  await mdpad.page.locator('.ProseMirror li').first().click()
  await mdpad.page.keyboard.press('End')
  await mdpad.page.keyboard.press('ArrowDown')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
  await expect(mdpad.page).toHaveTitle('lists.md — mdpad')
})

test('typing marks the document dirty and Save writes only the edit', async ({ mdpad }) => {
  const path = mdpad.copyFixture('syntax-variants.md')
  const before = mdpad.read(path)
  await mdpad.launch(path)
  await expect(mdpad.page.getByTestId('normalize-note')).toBeVisible()

  await mdpad.selectText('Line with a backslash', 'start')
  await mdpad.page.keyboard.type('Really ')
  await expect(mdpad.page).toHaveTitle('● syntax-variants.md — mdpad')

  await mdpad.clickMenu('file.save')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
  await expect(mdpad.page).toHaveTitle('syntax-variants.md — mdpad')

  const after = mdpad.read(path)
  // Only the edited line changes; untouched syntax elsewhere (setext heading, * bullets,
  // reference link, ~~~ fence, indented code) is kept byte-for-byte.
  expect(after).toBe(before.replace('Line with a backslash', 'Really Line with a backslash'))
})

test('preserves CRLF line endings and BOM when saving an edit', async ({ mdpad }) => {
  const path = mdpad.copyFixture('crlf-bom.md')
  await mdpad.launch(path)
  await mdpad.selectText('Last line.', 'end')
  await mdpad.page.keyboard.type(' Added.')
  await mdpad.clickMenu('file.save')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')

  const bytes = mdpad.read(path)
  expect(bytes.startsWith('﻿')).toBe(true)
  expect(bytes).toContain('Last line. Added.\r\n')
  expect(bytes.replace(/\r\n/g, '')).not.toContain('\n')
})

test('closing with unsaved changes asks first, and Cancel keeps the window', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  await mdpad.page.getByText('Final paragraph.').click()
  await mdpad.page.keyboard.type('x')
  await expect(mdpad.page).toHaveTitle('● basics.md — mdpad')

  // Stub the native dialog: count prompts and answer "Cancel".
  const prompts = await mdpad.app.evaluate(({ BrowserWindow, dialog }) => {
    let count = 0
    dialog.showMessageBoxSync = () => {
      count++
      return 2
    }
    BrowserWindow.getAllWindows()[0].close()
    return count
  })
  expect(prompts).toBe(1)
  expect(
    await mdpad.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
  ).toBe(1)
  expect(mdpad.read(path)).not.toContain('Final paragraph.x')
})

test('"Save" in the close prompt saves and then closes', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  await mdpad.selectText('Final paragraph.', 'end')
  await mdpad.page.keyboard.type(' Saved on close.')

  const closed = mdpad.app.waitForEvent('close')
  await mdpad.app.evaluate(({ BrowserWindow, dialog }) => {
    dialog.showMessageBoxSync = () => 0
    BrowserWindow.getAllWindows()[0].close()
  })
  await closed
  expect(mdpad.read(path)).toContain('Final paragraph. Saved on close.\n')
})

test('saving immediately after typing includes the last keystrokes', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  await mdpad.selectText('Final paragraph.', 'end')
  await mdpad.page.keyboard.type(' Fast.')
  // Wait only until the keystrokes are in the document (the menu's IPC message could
  // otherwise overtake them), then save at once: well before the 150 ms serialization
  // pause, so the save must read the editor itself.
  await expect(mdpad.page.locator('.ProseMirror')).toContainText('Final paragraph. Fast.')
  await mdpad.clickMenu('file.save')
  await expect.poll(() => mdpad.read(path)).toContain('Final paragraph. Fast.\n')
  await expect(mdpad.page.getByTestId('save-state')).toHaveText('Saved')
})

test('closing immediately after typing still prompts', async ({ mdpad }) => {
  const path = mdpad.copyFixture('basics.md')
  await mdpad.launch(path)
  await mdpad.page.getByText('Final paragraph.').click()
  await mdpad.page.keyboard.type('x')
  const prompts = await mdpad.app.evaluate(({ BrowserWindow, dialog }) => {
    let count = 0
    dialog.showMessageBoxSync = () => {
      count++
      return 2 // Cancel
    }
    BrowserWindow.getAllWindows()[0].close()
    return count
  })
  expect(prompts).toBe(1)
})
