import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const tauriConfigPath = resolve(process.cwd(), 'src-tauri', 'tauri.conf.json')

describe('Tauri CSP', () => {
  it('allows the learning-pack schema validator to compile in each webview mode', async () => {
    const config = JSON.parse(await readFile(tauriConfigPath, 'utf8')) as {
      app: { security: { csp: string; devCsp: string } }
    }

    expect(config.app.security.csp).toContain("script-src 'self' 'unsafe-eval'")
    expect(config.app.security.devCsp).toContain(
      "script-src 'self' 'unsafe-eval'",
    )
  })
})
