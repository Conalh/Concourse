import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import {
  createBrowserLearntApplication,
  createTauriDesktopApplication,
} from './app'
import { isTauriRuntime } from './app/tauri-runtime-detection'
import { packAssetSaveDialogOptions } from './infrastructure/desktop/tauri-runtime-bridge'
import {
  App,
  AppErrorBoundary,
  BootstrapFailure,
  LearntApplicationProvider,
} from './ui/app'
import { mapBootstrapError } from './ui/errors'
import './ui/styles/global.css'

const root = document.getElementById('root')

if (root === null) {
  throw new Error('Root element was not found.')
}

const reactRoot = createRoot(root)

void bootstrap()

async function bootstrap(): Promise<void> {
  try {
    const application = await createRuntimeLearntApplication()

    reactRoot.render(
      <StrictMode>
        <AppErrorBoundary>
          <LearntApplicationProvider application={application}>
            <App />
          </LearntApplicationProvider>
        </AppErrorBoundary>
      </StrictMode>,
    )
  } catch (error) {
    reactRoot.render(
      <StrictMode>
        <BootstrapFailure error={mapBootstrapError(error)} />
      </StrictMode>,
    )
  }
}

function createRuntimeLearntApplication() {
  if (!isTauriRuntime(globalThis)) {
    return createBrowserLearntApplication()
  }

  return createTauriDesktopApplication({
    openDirectory: () => open({ directory: true, multiple: false }),
    choosePackAssetDestination: (input) =>
      save(packAssetSaveDialogOptions(input)),
    invoke: (command, args) => invoke(command, args),
  })
}
