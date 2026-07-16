import type { FirstRunSetupStore } from '../../core/ports'

type SetupStorage = Pick<Storage, 'getItem' | 'setItem'>

const firstRunSetupStorageKey = 'concourse_setup'

export class BrowserFirstRunSetupStore implements FirstRunSetupStore {
  private readonly storage: SetupStorage | null

  constructor(storage: SetupStorage | null = null) {
    this.storage = storage
  }

  hasCompletedFirstRunSetup(): boolean {
    return this.resolveStorage()?.getItem(firstRunSetupStorageKey) === '1'
  }

  completeFirstRunSetup(): void {
    this.resolveStorage()?.setItem(firstRunSetupStorageKey, '1')
  }

  private resolveStorage(): SetupStorage | null {
    return this.storage ?? safeLocalStorage()
  }
}

export function createBrowserFirstRunSetupStore(): FirstRunSetupStore {
  return new BrowserFirstRunSetupStore()
}

function safeLocalStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null
  }

  return globalThis.localStorage
}
