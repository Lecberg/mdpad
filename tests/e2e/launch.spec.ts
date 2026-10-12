import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from '@playwright/test'

const fixtures = join(__dirname, '../fixtures')

let dir: string
let app: ElectronApplication
let page: Page

async function launch(...files: string[]): Promise<void> {
  app = await electron.launch({ args: ['.', ...files] })
  page = await app.firstWindow()
  await page.locator('.ProseMirror').waitFor()
}

/** Click a native menu item by id (synthetic key presses don't reach menu accelerators). */
async function clickMenu(id: string): Promise<void> {
  await app.evaluate(({ BrowserWindow, Menu }, itemId) => {
    const win = BrowserWindow.getAllWindows()[0]
    Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(undefined, win, win.webContents)
  }, id)
}

function copyFixture(name: string): string {
  const path = join(dir, name)
  copyFileSync(join(fixtures, name), path)
  return path
}

test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mdpad-e2e-'))
})

test.afterEach(async () => {
  // Answer "Don't Save" if a close prompt appears, so teardown never blocks.
  await app
    ?.evaluate(({ dialog }) => {
      dialog.showMessageBoxSync = () => 1
    })
    .catch(() => {}) // the test may already have closed the app
  await app?.close()
  rmSync(dir, { recursive: true, force: true })
})

test('starts with an empty untitled document', async () => {
  await launch()
  await expect(page).toHaveTitle('Untitled — mdpad')
  await expect(page.getByTestId('save-state')).toHaveText('New document')
})

test('opens a file passed on the command line', async () => {
  const path = copyFixture('basics.md')
  await launch(path)
  await expect(page).toHaveTitle('basics.md — mdpad')
  await expect(page.locator('.ProseMirror h1')).toHaveText('Project notes')
  await expect(page.locator('.ProseMirror strong').first()).toHaveText('strong text')
})

test('clicking and moving the caret does not mark the document dirty', async () => {
  const path = copyFixture('lists.md')
  await launch(path)
  await page.locator('.ProseMirror li').first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  await expect(page).toHaveTitle('lists.md — mdpad')
})

test('typing marks the document dirty and Save writes only the edit', async () => {
  const path = copyFixture('syntax-variants.md')
  const before = readFileSync(path, 'utf8')
  await launch(path)
  await expect(page.getByTestId('normalize-note')).toBeVisible()

  // The paragraph spans two lines (hard break); click its first line.
  await page.getByText('Line with a backslash').click({ position: { x: 4, y: 6 } })
  await page.keyboard.press('Home')
  await page.keyboard.type('Really ')
  await expect(page).toHaveTitle('● syntax-variants.md — mdpad')

  await clickMenu('file.save')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  await expect(page).toHaveTitle('syntax-variants.md — mdpad')

  const after = readFileSync(path, 'utf8')
  // Only the edited line changes; untouched syntax elsewhere (setext heading, * bullets,
  // reference link, ~~~ fence, indented code) is kept byte-for-byte.
  expect(after).toBe(before.replace('Line with a backslash', 'Really Line with a backslash'))
})

test('preserves CRLF line endings and BOM when saving an edit', async () => {
  const path = copyFixture('crlf-bom.md')
  await launch(path)
  await page.getByText('Last line.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Added.')
  await clickMenu('file.save')
  await expect(page.getByTestId('save-state')).toHaveText('Saved')

  const bytes = readFileSync(path, 'utf8')
  expect(bytes.startsWith('﻿')).toBe(true)
  expect(bytes).toContain('Last line. Added.\r\n')
  expect(bytes.replace(/\r\n/g, '')).not.toContain('\n')
})

test('closing with unsaved changes asks first, and Cancel keeps the window', async () => {
  const path = copyFixture('basics.md')
  await launch(path)
  await page.getByText('Final paragraph.').click()
  await page.keyboard.type('x')
  await expect(page).toHaveTitle('● basics.md — mdpad')

  // Stub the native dialog: count prompts and answer "Cancel".
  const prompts = await app.evaluate(({ BrowserWindow, dialog }) => {
    let count = 0
    dialog.showMessageBoxSync = () => {
      count++
      return 2
    }
    BrowserWindow.getAllWindows()[0].close()
    return count
  })
  expect(prompts).toBe(1)
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  expect(readFileSync(path, 'utf8')).not.toContain('Final paragraph.x')
})

test('"Save" in the close prompt saves and then closes', async () => {
  const path = copyFixture('basics.md')
  await launch(path)
  await page.getByText('Final paragraph.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Saved on close.')

  const closed = app.waitForEvent('close')
  await app.evaluate(({ BrowserWindow, dialog }) => {
    dialog.showMessageBoxSync = () => 0
    BrowserWindow.getAllWindows()[0].close()
  })
  await closed
  expect(readFileSync(path, 'utf8')).toContain('Final paragraph. Saved on close.\n')
})

test('saving immediately after typing includes the last keystrokes', async () => {
  const path = copyFixture('basics.md')
  await launch(path)
  await page.getByText('Final paragraph.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Fast.')
  await clickMenu('file.save') // no wait: the change has not been serialized yet
  await expect(page.getByTestId('save-state')).toHaveText('Saved')
  expect(readFileSync(path, 'utf8')).toContain('Final paragraph. Fast.\n')
})

test('closing immediately after typing still prompts', async () => {
  const path = copyFixture('basics.md')
  await launch(path)
  await page.getByText('Final paragraph.').click()
  await page.keyboard.type('x')
  const prompts = await app.evaluate(({ BrowserWindow, dialog }) => {
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
