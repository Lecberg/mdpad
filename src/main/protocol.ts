import { net, protocol } from 'electron'
import { extname } from 'path'
import { pathToFileURL } from 'url'
import { LOCAL_FILE_SCHEME, localPathFromUrl } from './localFileUrl'

// Serves local images to the renderer as mdpad-file://local/C:/path/to/image.png. The
// renderer can't load file:// URLs from the dev server origin, and this keeps access
// limited to image files (documents can reference arbitrary paths).

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.avif'
])

/** Must run before the app is ready. */
export function registerLocalFileScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_FILE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
  ])
}

export function handleLocalFiles(): void {
  protocol.handle(LOCAL_FILE_SCHEME, (request) => {
    const path = localPathFromUrl(request.url)
    if (!path || !IMAGE_EXTENSIONS.has(extname(path).toLowerCase())) {
      return new Response('Not found', { status: 404 })
    }
    return net.fetch(pathToFileURL(path).toString())
  })
}
