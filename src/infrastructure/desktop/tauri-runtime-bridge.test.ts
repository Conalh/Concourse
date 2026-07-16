import { describe, expect, it } from 'vitest'

import { createTauriRuntimeBridge } from './tauri-runtime-bridge'

describe('createTauriRuntimeBridge', () => {
  it('normalizes a single selected native directory before delegating to the command bridge', async () => {
    const calls: unknown[] = []
    const bridge = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve('C:\\Courses'),
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

  it('treats canceled or multi-directory dialog results as no source selection', async () => {
    const canceled = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve(null),
      invoke: () => Promise.resolve(undefined),
    })
    const multiple = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve(['C:\\Courses', 'D:\\Courses']),
      invoke: () => Promise.resolve(undefined),
    })

    await expect(canceled.chooseCourseFolder()).resolves.toBeNull()
    await expect(multiple.chooseCourseFolder()).resolves.toBeNull()
  })
})
