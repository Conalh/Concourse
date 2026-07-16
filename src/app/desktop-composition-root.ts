import type {
  InstalledLearningPackStore,
  LearntApplication,
  LearningPackSourcePort,
  PackAssetDeliveryPort,
} from '../application'
import {
  createBrowserFirstRunSetupStore,
  createBrowserLearningIdGenerator,
  createBrowserLearningRepository,
  createBrowserProductVocabularyPreferenceStore,
  createBrowserResourceEngagementStore,
  createBrowserThemePreferenceStore,
  SystemClock,
} from '../infrastructure'
import {
  TauriInstalledLearningPackStore,
  type TauriInstalledLearningPackStoreBridge,
} from '../infrastructure/desktop/tauri-installed-learning-pack-store'
import {
  TauriLearningPackSource,
  type TauriLearningPackSourceBridge,
} from '../infrastructure/desktop/tauri-learning-pack-source'
import {
  TauriPackAssetDelivery,
  type TauriPackAssetDeliveryBridge,
} from '../infrastructure/desktop/tauri-pack-asset-delivery'

import { composeLearntApplication } from './composition-root'

export type DesktopLearntApplicationOptions = Readonly<{
  sourcePort: LearningPackSourcePort
  installedPackStore: InstalledLearningPackStore
  packAssetDelivery: PackAssetDeliveryPort
}>

export type TauriDesktopLearntApplicationOptions = Readonly<{
  bridge: TauriLearningPackSourceBridge &
    TauriInstalledLearningPackStoreBridge &
    TauriPackAssetDeliveryBridge
}>

/**
 * Creates the desktop adapter composition without changing the application
 * facade, installed-pack lifecycle, or pack validation authority.
 */
export async function createDesktopLearntApplication(
  options: DesktopLearntApplicationOptions,
): Promise<LearntApplication> {
  const application = composeLearntApplication({
    clock: new SystemClock(),
    idGenerator: createBrowserLearningIdGenerator(),
    repository: createBrowserLearningRepository(),
    resourceEngagementStore: createBrowserResourceEngagementStore(),
    themePreferenceStore: createBrowserThemePreferenceStore(),
    productVocabularyPreferenceStore:
      createBrowserProductVocabularyPreferenceStore(),
    firstRunSetupStore: createBrowserFirstRunSetupStore(),
    installedLearningPackStore: options.installedPackStore,
    packAssetDelivery: options.packAssetDelivery,
    learningPackSource: options.sourcePort,
  })
  await application.restoreInstalledLearningPacks(options.installedPackStore)
  return application
}

export function createTauriDesktopLearntApplication(
  options: TauriDesktopLearntApplicationOptions,
): Promise<LearntApplication> {
  return createDesktopLearntApplication({
    sourcePort: new TauriLearningPackSource(options.bridge),
    installedPackStore: new TauriInstalledLearningPackStore(options.bridge),
    packAssetDelivery: new TauriPackAssetDelivery(options.bridge),
  })
}
