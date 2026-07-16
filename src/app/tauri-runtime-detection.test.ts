import { describe, expect, it } from 'vitest'

import { isTauriRuntime } from './tauri-runtime-detection'

describe('isTauriRuntime', () => {
  it('recognizes the Tauri webview internals marker', () => {
    expect(isTauriRuntime({ __TAURI_INTERNALS__: {} })).toBe(true)
  })

  it('does not classify a normal browser global as Tauri', () => {
    expect(isTauriRuntime({ window: {} })).toBe(false)
    expect(isTauriRuntime(undefined)).toBe(false)
  })
})
