import {
  LearntApplication,
  PersistentLearningService,
  type InstalledLearningPackStore,
  type LearningPackLibraryStateEntry,
  type LearningPackSourcePort,
} from '../application'
import { LearningEngine } from '../core/engine'
import type {
  Clock,
  FirstRunSetupStore,
  LearningIdGenerator,
  LearningRepository,
  ProductVocabularyPreferenceStore,
  ResourceEngagementStore,
  ThemePreferenceStore,
} from '../core/ports'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import {
  BrowserLearningPackStateStore,
  BrowserLearningPackSource,
  createBrowserLearningIdGenerator,
  createBrowserLearningRepository,
  createBrowserFirstRunSetupStore,
  createBrowserProductVocabularyPreferenceStore,
  createBrowserResourceEngagementStore,
  createBrowserThemePreferenceStore,
  InMemoryResourceEngagementStore,
  SystemClock,
} from '../infrastructure'
import { demoLearnerProfile } from '../profiles'
import { createProductionSubjectRegistry } from './subject-registry'

export type LearntRuntimeDependencies = Readonly<{
  clock: Clock
  idGenerator: LearningIdGenerator
  repository: LearningRepository
  resourceEngagementStore?: ResourceEngagementStore
  themePreferenceStore?: ThemePreferenceStore
  productVocabularyPreferenceStore?: ProductVocabularyPreferenceStore
  firstRunSetupStore?: FirstRunSetupStore
  installedLearningPacks?: readonly InstalledLearningPack[]
  installedLearningPackStore?: InstalledLearningPackStore
  learningPackSource?: LearningPackSourcePort
  learningPackLibraryStates?: readonly LearningPackLibraryStateEntry[]
}>

export function composeLearntApplication(
  runtime: LearntRuntimeDependencies,
): LearntApplication {
  const engine = new LearningEngine({
    clock: runtime.clock,
    idGenerator: runtime.idGenerator,
  })
  const persistentLearningService = new PersistentLearningService({
    engine,
    repository: runtime.repository,
  })
  const resourceEngagementStore =
    runtime.resourceEngagementStore ?? new InMemoryResourceEngagementStore()
  const registry = createProductionSubjectRegistry({
    ...(runtime.installedLearningPacks === undefined
      ? {}
      : { importedLearningPacks: runtime.installedLearningPacks }),
  })

  return new LearntApplication({
    clock: runtime.clock,
    profile: demoLearnerProfile,
    subjectRegistry: registry,
    persistentLearningService,
    resourceEngagementStore,
    ...(runtime.themePreferenceStore === undefined
      ? {}
      : { themePreferenceStore: runtime.themePreferenceStore }),
    ...(runtime.productVocabularyPreferenceStore === undefined
      ? {}
      : {
          productVocabularyPreferenceStore:
            runtime.productVocabularyPreferenceStore,
        }),
    ...(runtime.firstRunSetupStore === undefined
      ? {}
      : { firstRunSetupStore: runtime.firstRunSetupStore }),
    ...(runtime.installedLearningPacks === undefined
      ? {}
      : { installedLearningPacks: runtime.installedLearningPacks }),
    ...(runtime.installedLearningPackStore === undefined
      ? {}
      : { installedLearningPackStore: runtime.installedLearningPackStore }),
    ...(runtime.learningPackSource === undefined
      ? {}
      : { learningPackSource: runtime.learningPackSource }),
    ...(runtime.learningPackLibraryStates === undefined
      ? {}
      : { learningPackLibraryStates: runtime.learningPackLibraryStates }),
  })
}

export async function createBrowserLearntApplication(): Promise<LearntApplication> {
  const installedLearningPackStore = new BrowserLearningPackStateStore()
  const learningPackSource = new BrowserLearningPackSource()
  const application = composeLearntApplication({
    clock: new SystemClock(),
    idGenerator: createBrowserLearningIdGenerator(),
    repository: createBrowserLearningRepository(),
    resourceEngagementStore: createBrowserResourceEngagementStore(),
    themePreferenceStore: createBrowserThemePreferenceStore(),
    productVocabularyPreferenceStore:
      createBrowserProductVocabularyPreferenceStore(),
    firstRunSetupStore: createBrowserFirstRunSetupStore(),
    installedLearningPackStore,
    learningPackSource,
  })
  await application.restoreInstalledLearningPacks(installedLearningPackStore)
  return application
}
