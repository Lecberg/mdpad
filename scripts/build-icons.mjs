// Rasterizes build/icon.svg (and the simplified build/icon-small.svg for tiny
// sizes) into the PNG/ICO files used by electron-builder and the app window.
// Runs inside Electron so Chromium does the SVG rendering. Run: npm run icons
import { app, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SMALL_MAX = 48
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]

async function render(win, svg, size) {
  const draw = async ({ svg, size }) => {
    const img = new Image()
    img.src = 'data:image/svg+xml;base64,' + btoa(svg)
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
    const rgba = Array.from(ctx.getImageData(0, 0, size, size).data)
    return { rgba, png: canvas.toDataURL('image/png').split(',')[1] }
  }
  return win.webContents.executeJavaScript(`(${draw})(${JSON.stringify({ svg, size })})`)
}

// 32-bit BMP (DIB) entry: bottom-up BGRA rows followed by an all-zero AND mask.
function dib(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const src = ((size - 1 - y) * size + x) * 4
      const dst = (y * size + x) * 4
      pixels[dst] = rgba[src + 2]
      pixels[dst + 1] = rgba[src + 1]
      pixels[dst + 2] = rgba[src]
      pixels[dst + 3] = rgba[src + 3]
    }
  }
  const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size)
  return Buffer.concat([header, pixels, mask])
}

function ico(entries) {
  const dir = Buffer.alloc(6 + entries.length * 16)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(entries.length, 4)
  let offset = dir.length
  entries.forEach(({ size, data }, i) => {
    const at = 6 + i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, at)
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1)
    dir.writeUInt16LE(1, at + 4)
    dir.writeUInt16LE(32, at + 6)
    dir.writeUInt32LE(data.length, at + 8)
    dir.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([dir, ...entries.map((e) => e.data)])
}

async function main() {
  const master = await readFile(join(root, 'build/icon.svg'), 'utf8')
  const small = await readFile(join(root, 'build/icon-small.svg'), 'utf8')
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  const entries = []
  for (const size of ICO_SIZES) {
    const { rgba, png } = await render(win, size <= SMALL_MAX ? small : master, size)
    // Vista+ convention: PNG-compressed 256px entry, uncompressed DIBs below it.
    entries.push({ size, data: size >= 256 ? Buffer.from(png, 'base64') : dib(size, rgba) })
  }
  await writeFile(join(root, 'build/icon.ico'), ico(entries))

  const { png } = await render(win, master, 512)
  const buffer = Buffer.from(png, 'base64')
  await writeFile(join(root, 'build/icon.png'), buffer)
  await writeFile(join(root, 'resources/icon.png'), buffer)
  console.log('Wrote build/icon.ico, build/icon.png, resources/icon.png')
}

// No top-level await: Electron holds the `ready` event until the entry module finishes.
app
  .whenReady()
  .then(main)
  .then(
    () => app.exit(0),
    (err) => {
      console.error(err)
      app.exit(1)
    }
  )
