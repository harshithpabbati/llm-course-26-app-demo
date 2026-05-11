import type Store from 'electron-store'
import type { StoreSchema } from './types'
import { defaultSettings, defaultShortcuts } from './defaults'

/**
 * åˆ›å»º electron-store å®žä¾‹ï¼ˆä½¿ç”¨åŠ¨æ€å¯¼å…¥ï¼‰
 */
let store: Store<StoreSchema> | null = null

export async function getStore(): Promise<Store<StoreSchema>> {
  if (!store) {
    const { default: Store } = await import('electron-store')
    store = new Store<StoreSchema>({
      defaults: {
        settings: defaultSettings,
        providers: {},
        shortcuts: defaultShortcuts
      },
      name: 'scout-config',
      // æ–‡ä»¶ä¼šä¿å­˜åœ¨: ~/Library/Application Support/scout/scout-config.json (macOS)
      encryptionKey: undefined // å¦‚æžœéœ€è¦åŠ å¯†å¯ä»¥è®¾ç½®å¯†é’¥
    })
  }
  return store
}

