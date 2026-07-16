import type { LearntApplication } from '../application'
import {
  createTauriRuntimeBridge,
  type TauriRuntimeBridgeDependencies,
} from '../infrastructure/desktop/tauri-runtime-bridge'

import { createTauriDesktopLearntApplication } from './desktop-composition-root'

export function createTauriDesktopApplication(
  dependencies: TauriRuntimeBridgeDependencies,
): Promise<LearntApplication> {
  return createTauriDesktopLearntApplication({
    bridge: createTauriRuntimeBridge(dependencies),
  })
}
