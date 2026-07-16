import { createHash } from 'node:crypto'
export { stableJsonBytes } from './stable-json.js'

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function contentHash(
  files: readonly { path: string; sha256: string }[],
): string {
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.path)
    hash.update('\0')
    hash.update(file.sha256)
    hash.update('\n')
  }
  return hash.digest('hex')
}
