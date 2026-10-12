import type { CustomCss } from './customCss'
import type { RecentStore } from './services/recentService'
import type { RecoveryStore } from './services/recoveryService'
import type { SettingsStore } from './services/settingsService'

/** Long-lived app services, created once at startup (see index.ts). */
export interface AppServices {
  settings: SettingsStore
  recent: RecentStore
  recovery: RecoveryStore
  customCss: CustomCss
}

let current: AppServices | null = null

export function setServices(services: AppServices): void {
  current = services
}

export function services(): AppServices {
  if (!current) throw new Error('App services are not initialised yet')
  return current
}
