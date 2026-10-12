// Single source of truth for the API the preload script exposes as `window.api`.
// Main-process handlers, the preload bridge, and the renderer all import from here.

export interface RuntimeVersions {
  electron: string
  chrome: string
  node: string
}

export interface MdpadApi {
  versions: RuntimeVersions
}
