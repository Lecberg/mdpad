import { _electron as electron, expect, test } from '@playwright/test'

test('app launches and renders the window', async () => {
  const app = await electron.launch({ args: ['.'] })
  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle('mdpad')
    await expect(window.getByRole('heading', { level: 1 })).toHaveText('mdpad')
    await expect(window.getByTestId('versions')).toContainText('Electron')
  } finally {
    await app.close()
  }
})
