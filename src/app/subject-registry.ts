import { SubjectRegistry } from '../subject-sdk'
import type { SubjectAdapter } from '../subject-sdk'
import { productionSubjectAdapters } from '../subjects'
import type { InstalledLearningPack } from '../learning-packs/learnt-importer'
import { registerInstalledLearningPack } from '../learning-packs/learnt-importer'

export type CreateSubjectRegistryOptions = Readonly<{
  importedAdapters?: readonly SubjectAdapter[]
  importedLearningPacks?: readonly InstalledLearningPack[]
}>

export function createSubjectRegistry(
  options: CreateSubjectRegistryOptions = {},
): SubjectRegistry {
  const registry = new SubjectRegistry()

  for (const adapter of productionSubjectAdapters) {
    registry.register(adapter)
  }

  for (const importedPack of options.importedLearningPacks ?? []) {
    registerInstalledLearningPack(registry, importedPack)
  }

  for (const adapter of options.importedAdapters ?? []) {
    registry.register(adapter)
  }

  return registry
}

export function createProductionSubjectRegistry(
  options: CreateSubjectRegistryOptions = {},
): SubjectRegistry {
  return createSubjectRegistry(options)
}
