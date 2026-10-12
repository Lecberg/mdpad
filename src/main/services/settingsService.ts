import { sanitizeSettings, type Settings } from '../../shared/settings'
import { readJson, writeJsonAtomic, WriteQueue } from './jsonFile'

/** userData/settings.json: loaded once at startup, then kept in memory and written on change. */
export class SettingsStore {
  private settings: Settings = sanitizeSettings(undefined)
  private readonly writes = new WriteQueue()

  constructor(private readonly path: string) {}

  get current(): Settings {
    return this.settings
  }

  async load(): Promise<Settings> {
    this.settings = sanitizeSettings(await readJson(this.path))
    return this.settings
  }

  /** Apply a (possibly partial, untrusted) change; resolves to the new settings once saved. */
  async update(patch: unknown): Promise<Settings> {
    const changes = typeof patch === 'object' && patch !== null ? patch : {}
    this.settings = sanitizeSettings({ ...this.settings, ...changes })
    const snapshot = this.settings
    await this.writes.run(() => writeJsonAtomic(this.path, snapshot))
    return snapshot
  }
}
