import type {
  ProductVocabularyMode,
  ProductVocabularyPreferenceStore,
} from '../../core/ports'

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

const productVocabularyStorageKey = 'learnt-product-vocabulary'
const defaultProductVocabularyMode: ProductVocabularyMode = 'branded'

export class BrowserProductVocabularyPreferenceStore implements ProductVocabularyPreferenceStore {
  private readonly storage: PreferenceStorage | null

  constructor(storage: PreferenceStorage | null = null) {
    this.storage = storage
  }

  getProductVocabularyMode(): ProductVocabularyMode {
    const storedMode = this.resolveStorage()?.getItem(
      productVocabularyStorageKey,
    )

    if (storedMode === 'branded' || storedMode === 'plain') {
      return storedMode
    }

    return defaultProductVocabularyMode
  }

  setProductVocabularyMode(mode: ProductVocabularyMode): void {
    this.resolveStorage()?.setItem(productVocabularyStorageKey, mode)
  }

  private resolveStorage(): PreferenceStorage | null {
    return this.storage ?? safeLocalStorage()
  }
}

export function createBrowserProductVocabularyPreferenceStore(): ProductVocabularyPreferenceStore {
  return new BrowserProductVocabularyPreferenceStore()
}

function safeLocalStorage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null
  }

  return globalThis.localStorage
}
