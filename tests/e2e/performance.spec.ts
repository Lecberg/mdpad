import { expect, test } from './harness'
import { largeDocument } from './largeDoc'

// M5 performance pass: a ~1 MB note opens in reasonable time and typing stays responsive.
// Limits are generous so the test catches regressions (e.g. a plugin scanning the whole
// document on every keystroke), not machine-to-machine variation.

test('a 1 MB document opens, and typing in it does not block', async ({ mdpad }) => {
  test.setTimeout(120_000)
  const path = mdpad.writeFile('large.md', largeDocument())
  const started = Date.now()
  await mdpad.launch(path)
  const { page } = mdpad
  await expect(page.locator('.ProseMirror h2').first()).toBeVisible({ timeout: 60_000 })
  const openMs = Date.now() - started
  await expect(page.getByTestId('word-count')).not.toHaveText('0 words', { timeout: 30_000 })
  await page.waitForTimeout(2000) // let start-up work settle

  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] }
    w.longTasks = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.longTasks.push(Math.round(entry.duration))
    }).observe({ type: 'longtask' })
  })
  await mdpad.selectText('Section 1', 'end')
  await page.keyboard.type(' and some typing', { delay: 40 })
  const longTasks = await page.evaluate(
    () => (window as unknown as { longTasks: number[] }).longTasks
  )
  console.log(`1 MB document: opened in ${openMs} ms; long tasks while typing: [${longTasks}]`)

  expect(openMs).toBeLessThan(30_000)
  // Each keystroke used to block for 120+ ms; now nothing should come close to that.
  expect(Math.max(0, ...longTasks)).toBeLessThan(120)
  await expect(page.locator('.ProseMirror h2').first()).toContainText('Section 1 and some typing')
})
