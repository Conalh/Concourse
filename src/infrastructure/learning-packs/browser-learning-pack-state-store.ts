import type {
  InstalledLearningPackRecord,
  InstalledLearningPackStore,
  InstalledLearningPackStoreSnapshot,
  PersistedLearningPackRecordIssue,
} from '../../learning-packs/installed-learning-pack-ports'
import {
  decodeInstalledLearningPackRecord,
  encodeInstalledLearningPackRecord,
} from './installed-learning-pack-record-codec'

const DEFAULT_DATABASE_NAME = 'concourse-learning-packs-v1'
const INSTALLED_PACK_RECORDS_STORE = 'installed-pack-records'
const PREFERENCES_STORE = 'preferences'
const SELECTED_DIRECTORY_KEY = 'selected-directory'

export type BrowserLearningPackStateStoreOptions = Readonly<{
  indexedDB?: IDBFactory
  databaseName?: string
}>

export class BrowserLearningPackStateStore implements InstalledLearningPackStore {
  private readonly indexedDB: IDBFactory
  private readonly databaseName: string

  constructor(options: BrowserLearningPackStateStoreOptions = {}) {
    const indexedDB =
      options.indexedDB ??
      (globalThis as Readonly<{ indexedDB?: IDBFactory }>).indexedDB
    if (indexedDB === undefined) {
      throw new Error(
        'IndexedDB is required to persist installed learning packs.',
      )
    }
    this.indexedDB = indexedDB
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME
  }

  async readSnapshot(): Promise<InstalledLearningPackStoreSnapshot> {
    return this.readRecords()
  }

  async write(record: InstalledLearningPackRecord): Promise<void> {
    const database = await openDatabase(this.indexedDB, this.databaseName)
    try {
      const transaction = database.transaction(
        INSTALLED_PACK_RECORDS_STORE,
        'readwrite',
      )
      const completion = transactionAsPromise(transaction)
      transaction
        .objectStore(INSTALLED_PACK_RECORDS_STORE)
        .put(encodeInstalledLearningPackRecord(record, (bytes) => bytes))
      await completion
    } finally {
      database.close()
    }
  }

  private async readRecords(): Promise<
    Readonly<{
      records: readonly InstalledLearningPackRecord[]
      issues: readonly PersistedLearningPackRecordIssue[]
    }>
  > {
    const database = await openDatabase(this.indexedDB, this.databaseName)
    try {
      const transaction = database.transaction(
        INSTALLED_PACK_RECORDS_STORE,
        'readonly',
      )
      const completion = transactionAsPromise(transaction)
      const values = await requestAsPromise(
        transaction.objectStore(INSTALLED_PACK_RECORDS_STORE).getAll(),
      )
      await completion

      const records: InstalledLearningPackRecord[] = []
      const issues: PersistedLearningPackRecordIssue[] = []
      for (const value of values) {
        const decoded = await decodeInstalledLearningPackRecord(
          value,
          decodeStructuredCloneBytes,
        )
        if ('record' in decoded) {
          records.push(decoded.record)
        } else {
          issues.push(decoded.issue)
        }
      }

      return { records, issues }
    } finally {
      database.close()
    }
  }
}

export class BrowserLearningPackSourceStore<
  DirectoryHandle extends Readonly<{ name: string }> = Readonly<{
    name: string
  }>,
> {
  private readonly indexedDB: IDBFactory
  private readonly databaseName: string

  constructor(options: BrowserLearningPackStateStoreOptions = {}) {
    const indexedDB =
      options.indexedDB ??
      (globalThis as Readonly<{ indexedDB?: IDBFactory }>).indexedDB
    if (indexedDB === undefined) {
      throw new Error(
        'IndexedDB is required to persist the selected directory.',
      )
    }
    this.indexedDB = indexedDB
    this.databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME
  }

  async loadSelectedDirectory(): Promise<DirectoryHandle | null> {
    const database = await openDatabase(this.indexedDB, this.databaseName)
    try {
      const transaction = database.transaction(PREFERENCES_STORE, 'readonly')
      const completion = transactionAsPromise(transaction)
      const value: unknown = await requestAsPromise(
        transaction.objectStore(PREFERENCES_STORE).get(SELECTED_DIRECTORY_KEY),
      )
      await completion

      return hasDirectoryName(value) ? (value as DirectoryHandle) : null
    } finally {
      database.close()
    }
  }

  async saveSelectedDirectory(handle: DirectoryHandle): Promise<void> {
    const database = await openDatabase(this.indexedDB, this.databaseName)
    try {
      const transaction = database.transaction(PREFERENCES_STORE, 'readwrite')
      const completion = transactionAsPromise(transaction)
      transaction
        .objectStore(PREFERENCES_STORE)
        .put(handle, SELECTED_DIRECTORY_KEY)
      await completion
    } finally {
      database.close()
    }
  }

  async clearSelectedDirectory(): Promise<void> {
    const database = await openDatabase(this.indexedDB, this.databaseName)
    try {
      const transaction = database.transaction(PREFERENCES_STORE, 'readwrite')
      const completion = transactionAsPromise(transaction)
      transaction.objectStore(PREFERENCES_STORE).delete(SELECTED_DIRECTORY_KEY)
      await completion
    } finally {
      database.close()
    }
  }
}

function openDatabase(
  indexedDB: IDBFactory,
  databaseName: string,
): Promise<IDBDatabase> {
  const request = indexedDB.open(databaseName, 1)
  request.addEventListener('upgradeneeded', () => {
    const database = request.result
    if (!database.objectStoreNames.contains(INSTALLED_PACK_RECORDS_STORE)) {
      database.createObjectStore(INSTALLED_PACK_RECORDS_STORE, {
        keyPath: 'packId',
      })
    }
    if (!database.objectStoreNames.contains(PREFERENCES_STORE)) {
      database.createObjectStore(PREFERENCES_STORE)
    }
  })
  return requestAsPromise(request)
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(asError(request.error, 'IndexedDB request failed.'))
    })
  })
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => {
      resolve()
    })
    transaction.addEventListener('error', () => {
      reject(asError(transaction.error, 'IndexedDB transaction failed.'))
    })
    transaction.addEventListener('abort', () => {
      reject(asError(transaction.error, 'IndexedDB transaction aborted.'))
    })
  })
}

function asError(error: DOMException | null, fallback: string): Error {
  return error ?? new Error(fallback)
}

function hasDirectoryName(value: unknown): value is Readonly<{ name: string }> {
  return isRecord(value) && typeof value.name === 'string'
}

function decodeStructuredCloneBytes(value: unknown): Uint8Array | null {
  if (
    !ArrayBuffer.isView(value) ||
    Object.prototype.toString.call(value) !== '[object Uint8Array]'
  ) {
    return null
  }
  const view = value as Uint8Array
  const bytes = new Uint8Array(view.byteLength)
  bytes.set(view)
  return bytes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
