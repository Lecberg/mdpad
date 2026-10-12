import { contextBridge } from 'electron'
import type { MdpadApi } from '../shared/ipc-types'

// The preload runs sandboxed: it may only import 'electron' and must stay dependency-free.
const api: MdpadApi = {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
}

contextBridge.exposeInMainWorld('api', api)
