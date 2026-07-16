import type {
  InstalledLearningPackRecord,
  InstalledLearningPackStore,
  InstalledLearningPackStoreSnapshot,
  PersistedLearningPackRecordIssue,
} from '../../learning-packs/installed-learning-pack-ports'
import {
  decodeInstalledLearningPackRecord,
  encodeInstalledLearningPackRecord,
} from '../learning-packs/installed-learning-pack-record-codec'

export interface TauriInstalledLearningPackStoreBridge {
  readInstalledPackRecords(): Promise<unknown>
  writeInstalledPackRecord(record: unknown): Promise<void>
}

export class TauriInstalledLearningPackStore implements InstalledLearningPackStore {
  private readonly bridge: TauriInstalledLearningPackStoreBridge

  constructor(bridge: TauriInstalledLearningPackStoreBridge) {
    this.bridge = bridge
  }

  async readSnapshot(): Promise<InstalledLearningPackStoreSnapshot> {
    let values: unknown
    try {
      values = await this.bridge.readInstalledPackRecords()
    } catch (error) {
      return {
        records: [],
        issues: [
          {
            packId: null,
            message:
              error instanceof Error
                ? error.message
                : 'Could not read installed-pack records from native storage.',
          },
        ],
      }
    }

    if (!Array.isArray(values)) {
      return {
        records: [],
        issues: [
          {
            packId: null,
            message:
              'Stored installed-pack record collection has an invalid shape.',
          },
        ],
      }
    }

    const records: InstalledLearningPackRecord[] = []
    const issues: PersistedLearningPackRecordIssue[] = []
    for (const value of values) {
      const decoded = await decodeInstalledLearningPackRecord(
        value,
        decodeBase64,
      )
      if ('record' in decoded) {
        records.push(decoded.record)
      } else {
        issues.push(decoded.issue)
      }
    }

    return { records, issues }
  }

  write(record: InstalledLearningPackRecord): Promise<void> {
    return this.bridge.writeInstalledPackRecord(
      encodeInstalledLearningPackRecord(record, encodeBase64),
    )
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64(value: unknown): Uint8Array | null {
  if (typeof value !== 'string') {
    return null
  }
  try {
    const binary = atob(value)
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    )
    return encodeBase64(bytes) === value ? bytes : null
  } catch {
    return null
  }
}
