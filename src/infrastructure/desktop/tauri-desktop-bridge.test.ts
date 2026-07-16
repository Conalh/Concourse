import { describe, expect, it } from 'vitest'
import { DEFAULT_ARCHIVE_LIMITS } from '@learnt/learning-pack-sdk'

import { TauriDesktopBridge } from './tauri-desktop-bridge'

describe('TauriDesktopBridge', () => {
  it('uses the native directory picker and persists the selected root through a named command', async () => {
    const calls: unknown[] = []
    const bridge = new TauriDesktopBridge({
      chooseCourseFolder: () => Promise.resolve('C:\\Courses'),
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
