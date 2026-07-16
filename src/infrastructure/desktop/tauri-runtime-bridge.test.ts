import { describe, expect, it } from 'vitest'

import {
  createTauriRuntimeBridge,
  packAssetSaveDialogOptions,
} from './tauri-runtime-bridge'

describe('createTauriRuntimeBridge', () => {
  it.each([
    ['application/x-ipynb+json', 'Jupyter Notebook', ['ipynb']],
    ['text/x-python', 'Python source', ['py']],
    ['text/csv', 'CSV data', ['csv']],
    ['text/markdown', 'Markdown', ['md']],
    ['text/plain', 'Text', ['txt']],
    ['application/yaml', 'YAML', ['yml', 'yaml']],
  ])(
    'maps %s to a constrained native save filter',
    (mediaType, name, extensions) => {
      expect(
        packAssetSaveDialogOptions({
          suggestedFileName: 'module-01-lab.ipynb',
          mediaType,
        }),
      ).toEqual({
        title: 'Save learning pack file',
        defaultPath: 'module-01-lab.ipynb',
        filters: [{ name, extensions }],
      })
    },
  )

  it('rejects an unsupported media type before opening a native dialog', () => {
    expect(() =>
      packAssetSaveDialogOptions({
        suggestedFileName: 'unsafe.html',
        mediaType: 'text/html',
      }),
    ).toThrow('Unsupported pack asset media type')
  })

  it('delegates pack asset save selection without changing the proposed metadata', async () => {
    const selections: unknown[] = []
    const bridge = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve(null),
      choosePackAssetDestination: (input) => {
        selections.push(input)
        return Promise.resolve('C:\\Labs\\module-01-lab.ipynb')
      },
      invoke: () => Promise.resolve(undefined),
    })
    const input = {
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    }

    await expect(bridge.choosePackAssetDestination(input)).resolves.toBe(
      'C:\\Labs\\module-01-lab.ipynb',
    )
    expect(selections).toEqual([input])
  })

  it('normalizes a single selected native directory before delegating to the command bridge', async () => {
    const calls: unknown[] = []
    const bridge = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve('C:\\Courses'),
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

  it('treats canceled or multi-directory dialog results as no source selection', async () => {
    const canceled = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve(null),
      choosePackAssetDestination: () => Promise.resolve(null),
      invoke: () => Promise.resolve(undefined),
    })
    const multiple = createTauriRuntimeBridge({
      openDirectory: () => Promise.resolve(['C:\\Courses', 'D:\\Courses']),
      choosePackAssetDestination: () => Promise.resolve(null),
      invoke: () => Promise.resolve(undefined),
    })

    await expect(canceled.chooseCourseFolder()).resolves.toBeNull()
    await expect(multiple.chooseCourseFolder()).resolves.toBeNull()
  })
})
