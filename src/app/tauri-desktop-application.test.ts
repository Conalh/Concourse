import { describe, expect, it } from 'vitest'

import { createTauriDesktopApplication } from './tauri-desktop-application'

describe('createTauriDesktopApplication', () => {
  it('restores installed packs through the native bridge during desktop bootstrap', async () => {
    const commands: string[] = []

    const application = await createTauriDesktopApplication({
      openDirectory: () => Promise.resolve(null),
      choosePackAssetDestination: () => Promise.resolve(null),
      invoke: (command) => {
        commands.push(command)
        if (command === 'read_installed_pack_records') {
          return Promise.resolve([])
        }
        throw new Error(`Unexpected native command ${command}.`)
      },
    })

    expect(application.getInstalledLearningPacksForRuntime()).toEqual([])
    expect(commands).toEqual(['read_installed_pack_records'])
  })
})
