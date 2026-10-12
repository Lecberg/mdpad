import type { MdpadApi } from '../shared/ipc-types'

declare global {
  interface Window {
    api: MdpadApi
  }
}
