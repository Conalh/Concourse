import { describe, expect, it } from 'vitest'
import { DEFAULT_ARCHIVE_LIMITS } from '@learnt/learning-pack-sdk'

import { TauriDesktopBridge } from './tauri-desktop-bridge'

describe('TauriDesktopBridge', () => {
  it('routes pack asset selection and exact bytes through camelCase native arguments', async () => {
    const calls: unknown[] = []
    const bridge = new TauriDesktopBridge({
      chooseCourseFolder: () => Promise.resolve(null),
      choosePackAssetDestination: (input) => {
        calls.push({ choose: input })
        return Promise.resolve('C:\\Labs\\module-01-lab.ipynb')
      },
      invoke: (command, args) => {
        calls.push({ command, args })
        return Promise.resolve(undefined)
      },
    })
    const input = {
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    }

    await expect(bridge.choosePackAssetDestination(input)).resolves.toBe(
      'C:\\Labs\\module-01-lab.ipynb',
    )
    await bridge.writePackAsset(
      'C:\\Labs\\module-01-lab.ipynb',
      new Uint8Array([1, 2, 255]),
    )

    expect(calls).toEqual([
      { choose: input },
      {
        command: 'write_pack_asset',
        args: {
          destinationPath: 'C:\\Labs\\module-01-lab.ipynb',
          bytes: [1, 2, 255],
        },
      },
    ])
  })

  it('uses the native directory picker and persists the selected root through a named command', async () => {
    const calls: unknown[] = []
    const bridge = new TauriDesktopBridge({
      chooseCourseFolder: () => Promise.resolve('C:\\Courses'),
      choosePackAssetDestination: () => Promise.resolve(null),
      invoke: (command, args) => {
        calls.push({ command, args })
        return Promise.resolve(undefined)
      },
    })

    await expect(bridge.chooseCourseFolder()).resolves.toBe('C:\\Courses')
    await bridge.saveSelectedCourseFolder('C:\\Courses')

    expect(calls).toEqual([
      {
        command: 'save_selected_course_folder',
        args: { selectedRoot: 'C:\\Courses' },
      },
    ])
  })

  it('routes source scans and installed-pack records through separate native commands', async () => {
    const calls: unknown[] = []
    const bridge = new TauriDesktopBridge({
      chooseCourseFolder: () => Promise.resolve(null),
      choosePackAssetDestination: () => Promise.resolve(null),
      invoke: (command, args) => {
        calls.push({ command, args })
        if (command === 'load_selected_course_folder') {
          return Promise.resolve('C:\\Courses')
        }
        if (command === 'read_course_folder_candidates') {
          return Promise.resolve({ sourceName: 'Courses' })
        }
        if (command === 'read_installed_pack_records') {
          return Promise.resolve([])
        }
        return Promise.resolve(undefined)
      },
    })

    await expect(bridge.loadSelectedCourseFolder()).resolves.toBe('C:\\Courses')
    await expect(
      bridge.readCourseFolderCandidates('C:\\Courses', DEFAULT_ARCHIVE_LIMITS),
    ).resolves.toEqual({ sourceName: 'Courses' })
    await expect(bridge.readInstalledPackRecords()).resolves.toEqual([])
    await bridge.writeInstalledPackRecord({
      recordVersion: 2,
      packId: 'learnt.logic-foundations',
      activeReleaseId: 'logic-v1',
      rollbackReleaseId: null,
      releases: [],
    })

    expect(calls).toEqual([
      { command: 'load_selected_course_folder', args: undefined },
      {
        command: 'read_course_folder_candidates',
        args: {
          selectedRoot: 'C:\\Courses',
          limits: DEFAULT_ARCHIVE_LIMITS,
        },
      },
      { command: 'read_installed_pack_records', args: undefined },
      {
        command: 'write_installed_pack_record',
        args: {
          record: {
            recordVersion: 2,
            packId: 'learnt.logic-foundations',
            activeReleaseId: 'logic-v1',
            rollbackReleaseId: null,
            releases: [],
          },
        },
      },
    ])
  })
})
