import { TauriDesktopBridge } from './tauri-desktop-bridge'
import type { TauriPackAssetDeliveryBridge } from './tauri-pack-asset-delivery'

export type TauriRuntimeBridgeDependencies = Readonly<{
  openDirectory(): Promise<string | readonly string[] | null>
  choosePackAssetDestination(
    input: Parameters<
      TauriPackAssetDeliveryBridge['choosePackAssetDestination']
    >[0],
  ): Promise<string | null>
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}>

export type PackAssetSaveDialogOptions = Readonly<{
  title: string
  defaultPath: string
  filters: Array<
    Readonly<{
      name: string
      extensions: string[]
    }>
  >
}>

const packAssetDialogFilters = new Map<
  string,
  Readonly<{ name: string; extensions: readonly string[] }>
>([
  [
    'application/x-ipynb+json',
    { name: 'Jupyter Notebook', extensions: ['ipynb'] },
  ],
  ['text/x-python', { name: 'Python source', extensions: ['py'] }],
  ['text/csv', { name: 'CSV data', extensions: ['csv'] }],
  ['text/markdown', { name: 'Markdown', extensions: ['md'] }],
  ['text/plain', { name: 'Text', extensions: ['txt'] }],
  ['application/yaml', { name: 'YAML', extensions: ['yml', 'yaml'] }],
])

export function packAssetSaveDialogOptions(
  input: Parameters<
    TauriPackAssetDeliveryBridge['choosePackAssetDestination']
  >[0],
): PackAssetSaveDialogOptions {
  const filter = packAssetDialogFilters.get(input.mediaType)
  if (filter === undefined) {
    throw new Error(`Unsupported pack asset media type: ${input.mediaType}`)
  }

  return {
    title: 'Save learning pack file',
    defaultPath: input.suggestedFileName,
    filters: [
      {
        name: filter.name,
        extensions: [...filter.extensions],
      },
    ],
  }
}

export function createTauriRuntimeBridge(
  dependencies: TauriRuntimeBridgeDependencies,
): TauriDesktopBridge {
  return new TauriDesktopBridge({
    chooseCourseFolder: async () => {
      const selection = await dependencies.openDirectory()
      return typeof selection === 'string' ? selection : null
    },
    choosePackAssetDestination: dependencies.choosePackAssetDestination,
    invoke: dependencies.invoke,
  })
}
