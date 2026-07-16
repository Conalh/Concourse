import type {
  InstalledLearningPackRecord,
  InstalledLearningPackRelease,
  InstalledPackChange,
  PlanInstalledPackChangeInput,
  ValidatedLearningPackCandidate,
} from './learnt-application.types'

export type {
  InstalledLearningPackRecord,
  InstalledLearningPackRelease,
  InstalledPackChange,
  PlanInstalledPackChangeInput,
  ValidatedLearningPackCandidate,
} from './learnt-application.types'

export function planInstalledPackChange(
  input: PlanInstalledPackChangeInput,
): InstalledPackChange {
  const candidateRelease = releaseFromCandidate(input.candidate)

  if (input.existing === null) {
    return {
      kind: 'install',
      record: {
        packId: input.candidate.documents.manifest.packId,
        activeReleaseId: candidateRelease.releaseId,
        rollbackReleaseId: null,
        releases: [candidateRelease],
      },
    }
  }

  if (input.existing.packId !== input.candidate.documents.manifest.packId) {
    return reject('pack-id-mismatch', input.existing)
  }

  const activeRelease = activeInstalledLearningPackRelease(input.existing)
  if (activeRelease === null) {
    return reject('invalid-existing-record', input.existing)
  }

  if (activeRelease.packVersion === candidateRelease.packVersion) {
    if (activeRelease.contentHash === candidateRelease.contentHash) {
      return { kind: 'reinstall', record: input.existing }
    }
    return reject('same-version-content-conflict', input.existing)
  }

  const versionComparison = compareSemanticVersions(
    candidateRelease.packVersion,
    activeRelease.packVersion,
  )
  if (versionComparison === null) {
    return reject('invalid-semver', input.existing)
  }
  if (versionComparison <= 0) {
    return reject('downgrade-blocked', input.existing)
  }

  return {
    kind: 'upgrade',
    fromVersion: activeRelease.packVersion,
    record: {
      packId: input.existing.packId,
      activeReleaseId: candidateRelease.releaseId,
      rollbackReleaseId: activeRelease.releaseId,
      releases: [candidateRelease, activeRelease],
    },
  }
}

export function activeInstalledLearningPackRelease(
  record: InstalledLearningPackRecord,
): InstalledLearningPackRelease | null {
  return (
    record.releases.find(
      (release) => release.releaseId === record.activeReleaseId,
    ) ?? null
  )
}

function releaseFromCandidate(
  candidate: ValidatedLearningPackCandidate,
): InstalledLearningPackRelease {
  return {
    releaseId: candidate.contentHash,
    packVersion: candidate.documents.manifest.version,
    contentHash: candidate.contentHash,
    documents: candidate.documents,
    files: candidate.files,
  }
}

function reject(
  reason: Extract<InstalledPackChange, { kind: 'reject' }>['reason'],
  record: InstalledLearningPackRecord,
): InstalledPackChange {
  return { kind: 'reject', reason, record }
}

interface SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease: readonly string[] | null
}

function compareSemanticVersions(left: string, right: string): number | null {
  const parsedLeft = parseSemanticVersion(left)
  const parsedRight = parseSemanticVersion(right)
  if (parsedLeft === null || parsedRight === null) {
    return null
  }

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (parsedLeft[key] !== parsedRight[key]) {
      return parsedLeft[key] > parsedRight[key] ? 1 : -1
    }
  }

  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease)
}

function parseSemanticVersion(value: string): SemanticVersion | null {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      value,
    )
  if (match === null) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? null,
  }
}

function comparePrerelease(
  left: readonly string[] | null,
  right: readonly string[] | null,
): number {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index]
    const rightIdentifier = right[index]
    if (leftIdentifier === undefined) {
      return -1
    }
    if (rightIdentifier === undefined) {
      return 1
    }
    if (leftIdentifier === rightIdentifier) {
      continue
    }

    const leftNumber = /^(0|[1-9]\d*)$/.test(leftIdentifier)
    const rightNumber = /^(0|[1-9]\d*)$/.test(rightIdentifier)
    if (leftNumber && rightNumber) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1
    }
    if (leftNumber) {
      return -1
    }
    if (rightNumber) {
      return 1
    }
    return leftIdentifier > rightIdentifier ? 1 : -1
  }

  return 0
}
