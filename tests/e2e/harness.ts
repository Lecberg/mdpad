import { execFileSync } from 'child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page
} from '@playwright/test'

const fixturesDir = join(__dirname, '../fixtures')

/** One launched app plus a scratch folder for the files it edits. */
export class Mdpad {
  readonly dir = mkdtempSync(join(tmpdir(), 'mdpad-e2e-'))
  private launched: { app: ElectronApplication; page: Page } | null = null

  get app(): ElectronApplication {
    if (!this.launched) throw new Error('call launch() first')
    return this.launched.app
  }

  get page(): Page {
    if (!this.launched) throw new Error('call launch() first')
    return this.launched.page
  }

  /** Profile folder for this test, so tests never touch the real app's data or instance. */
  readonly userData = join(this.dir, 'user-data')

  /** Uncaught main-process errors are written here (see launch). */
  private readonly errorLog = join(this.dir, 'main-errors.log')

  async launch(...files: string[]): Promise<void> {
    const app = await electron.launch({
      args: ['.', ...files],
      env: { ...process.env, MDPAD_USER_DATA: this.userData }
    })
    // Record uncaught main-process errors (and fail the test in dispose) rather than
    // letting Electron show its "A JavaScript error occurred" dialog. They go to a file so
    // errors during shutdown are caught as well.
    await app.evaluate((_electron, logFile) => {
      const fs = process.getBuiltinModule('fs')
      process.on('uncaughtException', (error) => {
        fs.appendFileSync(logFile, `${String(error?.stack ?? error)}\n\n`)
      })
    }, this.errorLog)
    const page = await app.firstWindow()
    await page.locator('.ProseMirror').waitFor()
    this.launched = { app, page }
  }

  /**
   * Simulate a crash: kill the whole app process tree (main, renderer, GPU) without any of
   * its normal shutdown. Killing only the main process leaves children holding the
   * single-instance lock.
   */
  async crash(): Promise<void> {
    const { app } = this.launched!
    this.launched = null
    const exited = new Promise((resolve) => app.process().once('exit', resolve))
    execFileSync('taskkill', ['/PID', String(app.process().pid), '/T', '/F'], { stdio: 'ignore' })
    await exited
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  /** Copy a file from tests/fixtures into the scratch folder; returns its path. */
  copyFixture(name: string): string {
    const path = join(this.dir, name)
    copyFileSync(join(fixturesDir, name), path)
    return path
  }

  writeFile(name: string, text: string): string {
    const path = join(this.dir, name)
    writeFileSync(path, text)
    return path
  }

  read(path: string): string {
    return readFileSync(path, 'utf8')
  }

  /**
   * Select the first occurrence of `text` in the visual editor, or with `collapse` put the
   * caret at its start or end. Deterministic, unlike click + Home/End: a key pressed right
   * after a click can be overridden when ProseMirror applies the click's selection.
   */
  async selectText(text: string, collapse?: 'start' | 'end'): Promise<void> {
    await this.page.evaluate(
      async ([needle, edge]) => {
        const root = document.querySelector('.ProseMirror')!
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const index = node.textContent!.indexOf(needle)
          if (index < 0) continue
          ;(root as HTMLElement).focus()
          const range = document.createRange()
          range.setStart(node, edge === 'end' ? index + needle.length : index)
          range.setEnd(node, edge === 'start' ? index : index + needle.length)
          // ProseMirror reads the DOM selection in its own (earlier-registered)
          // selectionchange listener; wait for that event so keys typed next can't
          // overtake it.
          const applied = new Promise((resolve) =>
            document.addEventListener('selectionchange', () => setTimeout(resolve, 0), {
              once: true
            })
          )
          const selection = window.getSelection()!
          selection.removeAllRanges()
          selection.addRange(range)
          await applied
          return
        }
        throw new Error(`text not found: ${needle}`)
      },
      [text, collapse] as const
    )
  }

  /** Click a native menu item by id, as a user would with the mouse. */
  async clickMenu(id: string): Promise<void> {
    await this.app.evaluate(({ BrowserWindow, Menu }, itemId) => {
      const win = BrowserWindow.getAllWindows()[0]
      Menu.getApplicationMenu()!.getMenuItemById(itemId)!.click(undefined, win, win.webContents)
    }, id)
  }

  async dispose(): Promise<void> {
    if (this.launched) {
      // Answer "Don't Save" if a close prompt appears, so teardown never blocks.
      await this.launched.app
        .evaluate(({ dialog }) => {
          dialog.showMessageBoxSync = () => 1
        })
        .catch(() => {}) // the test may already have closed the app
      await this.launched.app.close()
    }
    const errors = existsSync(this.errorLog) ? readFileSync(this.errorLog, 'utf8') : ''
    rmSync(this.dir, { recursive: true, force: true })
    if (errors) throw new Error(`Uncaught errors in the main process:\n${errors}`)
  }
}

export const test = base.extend<{ mdpad: Mdpad }>({
  // eslint-disable-next-line no-empty-pattern
  mdpad: async ({}, provide) => {
    const mdpad = new Mdpad()
    await provide(mdpad)
    await mdpad.dispose()
  }
})

export { expect } from '@playwright/test'
