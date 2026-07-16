import {
  createLogicFoundationsGoldenFixture,
  expectedLogicFoundationsGlobalEntityKeys,
  type LogicFoundationsGoldenFixture,
  type LogicFoundationsReleaseVersion,
} from './logic-foundations-golden.js'
import {
  planPackUpdate,
  type InstalledPackRecord,
  type PackUpdatePlan,
} from './helpers.js'
import { validateLearningPackDocuments } from './semantic-validation.js'
import type { LearningPackDocuments, LearningPackManifest } from './types.js'

export interface ConformanceAcceptedPackResult {
  accepted: boolean
  globalEntityKeys: string[]
  importedLearnerProgressCount: number
}

export interface ConformanceRejectedPackResult {
  rejected: boolean
}

export interface LearningPackConformanceAdapter {
  acceptPack(
    pack: LearningPackDocuments,
    context: { version: LogicFoundationsReleaseVersion },
  ): Promise<ConformanceAcceptedPackResult> | ConformanceAcceptedPackResult
  rejectPack(
    pack: Partial<LearningPackDocuments>,
    context: { name: string },
  ): Promise<ConformanceRejectedPackResult> | ConformanceRejectedPackResult
  planUpdate(
    installed: InstalledPackRecord[],
    nextManifest: LearningPackManifest,
    context: { name: string },
  ): Promise<PackUpdatePlan> | PackUpdatePlan
}

export interface LearningPackConformanceCheck {
  name: string
  passed: boolean
  message: string
}

export interface LearningPackConformanceReport {
  ok: boolean
  checks: LearningPackConformanceCheck[]
}

export async function runLearningPackConformanceChecks(
  adapter: LearningPackConformanceAdapter,
  fixture: LogicFoundationsGoldenFixture = createLogicFoundationsGoldenFixture(),
): Promise<LearningPackConformanceReport> {
  const checks: LearningPackConformanceCheck[] = []

  for (const [version, pack] of objectEntries(fixture.releases)) {
    const accepted = await adapter.acceptPack(pack, { version })
    checks.push({
      name: `accepts-valid-pack-${version}`,
      passed: accepted.accepted,
      message: accepted.accepted
        ? 'Accepted valid pack.'
        : 'Adapter rejected a valid pack.',
    })

    const expectedKeys = expectedLogicFoundationsGlobalEntityKeys(pack)
    const missingKeys = expectedKeys.filter(
      (key) => !accepted.globalEntityKeys.includes(key),
    )
    checks.push({
      name: `preserves-stable-identity-${version}`,
      passed: missingKeys.length === 0,
      message:
        missingKeys.length === 0
          ? 'Adapter returned all expected global entity keys.'
          : `Adapter omitted global entity keys: ${missingKeys.join(', ')}.`,
    })

    checks.push({
      name: `does-not-import-progress-${version}`,
      passed: accepted.importedLearnerProgressCount === 0,
      message:
        accepted.importedLearnerProgressCount === 0
          ? 'Adapter did not import learner progress from pack content.'
          : `Adapter imported ${accepted.importedLearnerProgressCount} learner progress records from pack content.`,
    })
  }

  for (const [name, pack] of objectEntries(fixture.invalidPacks)) {
    const rejected = await adapter.rejectPack(pack, { name })
    checks.push({
      name: `rejects-invalid-pack-${name}`,
      passed: rejected.rejected,
      message: rejected.rejected
        ? 'Rejected invalid pack.'
        : 'Adapter accepted an invalid pack.',
    })
  }

  for (const scenario of fixture.updateScenarios) {
    const nextManifest = nextManifestForScenario(
      fixture,
      scenario.nextVersion,
      scenario.conflictFileHash,
    )
    const plan = await adapter.planUpdate(
      scenario.installed as InstalledPackRecord[],
      nextManifest,
      { name: scenario.name },
    )
    const conflictFilesMatch =
      scenario.expectedConflictingFiles === undefined ||
      arraysEqual(plan.conflictingFiles, scenario.expectedConflictingFiles)
    checks.push({
      name: `handles-update-plan-${scenario.name}`,
      passed: plan.action === scenario.expectedAction && conflictFilesMatch,
      message:
        plan.action === scenario.expectedAction && conflictFilesMatch
          ? `Produced expected update action ${scenario.expectedAction}.`
          : `Expected ${scenario.expectedAction} with conflicts ${JSON.stringify(scenario.expectedConflictingFiles ?? [])}, got ${plan.action} with conflicts ${JSON.stringify(plan.conflictingFiles)}.`,
    })
  }

  return {
    ok: checks.every((check) => check.passed),
    checks,
  }
}

export function createContractValidatorConformanceAdapter(): LearningPackConformanceAdapter {
  return {
    acceptPack(pack) {
      const result = validateLearningPackDocuments(pack)
      return {
        accepted: result.ok,
        globalEntityKeys: result.ok
          ? expectedLogicFoundationsGlobalEntityKeys(pack)
          : [],
        importedLearnerProgressCount: 0,
      }
    },
    rejectPack(pack) {
      const result = validateLearningPackDocuments(pack)
      return { rejected: !result.ok }
    },
    planUpdate(installed, nextManifest) {
      return planPackUpdate(installed, nextManifest)
    },
  }
}

function nextManifestForScenario(
  fixture: LogicFoundationsGoldenFixture,
  version: LogicFoundationsReleaseVersion,
  conflictFileHash = false,
): LearningPackManifest {
  const manifest = structuredClone(fixture.releases[version].manifest)
  if (conflictFileHash) {
    manifest.files[0]!.sha256 = '9'.repeat(64)
  }
  return manifest
}

function objectEntries<T extends Record<string, unknown>>(
  value: T,
): Array<[keyof T & string, T[keyof T]]> {
  return Object.entries(value) as Array<[keyof T & string, T[keyof T]]>
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  return left.every((value, index) => value === right[index])
}
