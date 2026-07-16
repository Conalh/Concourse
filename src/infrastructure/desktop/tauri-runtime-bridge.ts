import { TauriDesktopBridge } from './tauri-desktop-bridge'

export type TauriRuntimeBridgeDependencies = Readonly<{
  openDirectory(): Promise<string | readonly string[] | null>
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}>

export function createTauriRuntimeBridge(
  dependencies: TauriRuntimeBridgeDependencies,
): TauriDesktopBridge {
  return new TauriDesktopBridge({
    chooseCourseFolder: async () => {
      const selection = await dependencies.openDirectory()
      return typeof selection === 'string' ? selection : null
    },
    invoke: dependencies.invoke,
  })
}
