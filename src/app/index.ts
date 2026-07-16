export {
  composeLearntApplication,
  createBrowserLearntApplication,
  type LearntRuntimeDependencies,
} from './composition-root'
export {
  createDesktopLearntApplication,
  type DesktopLearntApplicationOptions,
  createTauriDesktopLearntApplication,
  type TauriDesktopLearntApplicationOptions,
} from './desktop-composition-root'
export { createTauriDesktopApplication } from './tauri-desktop-application'
