import type { TauriInstalledLearningPackStoreBridge } from './tauri-installed-learning-pack-store'
import type { TauriLearningPackSourceBridge } from './tauri-learning-pack-source'
import type { TauriPackAssetDeliveryBridge } from './tauri-pack-asset-delivery'
import type { ArchiveLimits } from '@learnt/learning-pack-sdk'

export type TauriDesktopBridgeDependencies = Readonly<{
  chooseCourseFolder(): Promise<string | null>
  choosePackAssetDestination(
    input: Parameters<
      TauriPackAssetDeliveryBridge['choosePackAssetDestination']
    >[0],
  ): Promise<string | null>
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}>

/**
 * This bridge is the only renderer-side authority allowed to call native
 * commands. Filesystem data and durable local state remain in Rust commands.
 */
export class TauriDesktopBridge
  implements
    TauriLearningPackSourceBridge,
    TauriInstalledLearningPackStoreBridge,
    TauriPackAssetDeliveryBridge
{
  private readonly dependencies: TauriDesktopBridgeDependencies

  constructor(dependencies: TauriDesktopBridgeDependencies) {
    this.dependencies = dependencies
  }

  chooseCourseFolder(): Promise<string | null> {
    return this.dependencies.chooseCourseFolder()
  }

  choosePackAssetDestination(
    input: Parameters<
      TauriPackAssetDeliveryBridge['choosePackAssetDestination']
    >[0],
  ): Promise<string | null> {
    return this.dependencies.choosePackAssetDestination(input)
  }

  writePackAsset(destinationPath: string, bytes: Uint8Array): Promise<void> {
    return this.dependencies.invoke('write_pack_asset', {
      destinationPath,
      bytes: Array.from(bytes),
    }) as Promise<void>
  }

  async loadSelectedCourseFolder(): Promise<string | null> {
    return (await this.dependencies.invoke('load_selected_course_folder')) as
      | string
      | null
  }

  saveSelectedCourseFolder(path: string): Promise<void> {
    return this.dependencies.invoke('save_selected_course_folder', {
      selectedRoot: path,
    }) as Promise<void>
  }

  readCourseFolderCandidates(
    path: string,
    limits: ArchiveLimits,
  ): Promise<unknown> {
    return this.dependencies.invoke('read_course_folder_candidates', {
      selectedRoot: path,
      limits,
    })
  }

  readInstalledPackRecords(): Promise<unknown> {
    return this.dependencies.invoke('read_installed_pack_records')
  }

  writeInstalledPackRecord(record: unknown): Promise<void> {
    return this.dependencies.invoke('write_installed_pack_record', {
      record,
    }) as Promise<void>
  }
}
