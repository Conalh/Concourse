import {
  LearningPackErrorCode,
  hasBlockingDiagnostics,
  makeDiagnostic,
  type LearningPackDiagnostic,
  type ValidationResult,
} from './errors.js'
import { validateJsonFile } from './structural-validation.js'
import type {
  LearningPackDocuments,
  ResourceEngagementEvent,
  ResourceSegment,
} from './types.js'

export interface ResourceEngagementEventValidationOptions {
  pack?: LearningPackDocuments
  path?: string
}

export function validateResourceEngagementEvent(
  value: unknown,
  options: ResourceEngagementEventValidationOptions = {},
): ValidationResult<ResourceEngagementEvent> {
  const rootPath = options.path ?? 'resourceEngagementEvent'
  const structural = validateJsonFile('resourceEngagementEvent', value, {
    path: rootPath,
  })
  if (!structural.value || hasBlockingDiagnostics(structural.diagnostics)) {
    return structural
  }

  const diagnostics = [
    ...structural.diagnostics,
    ...validateResourceEngagementEventSemantics(structural.value, options),
  ]

  return {
    ok: !hasBlockingDiagnostics(diagnostics),
    value: !hasBlockingDiagnostics(diagnostics) ? structural.value : undefined,
    diagnostics,
  }
}

export function validateResourceEngagementEventSemantics(
  event: ResourceEngagementEvent,
  options: ResourceEngagementEventValidationOptions = {},
): LearningPackDiagnostic[] {
  const rootPath = options.path ?? 'resourceEngagementEvent'
  const diagnostics: LearningPackDiagnostic[] = []

  if (
    event.progressRatio !== null &&
    (event.progressRatio < 0 || event.progressRatio > 1)
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_ENGAGEMENT_EVENT,
        'error',
        `${rootPath}.progressRatio`,
        'progressRatio must be between 0 and 1.',
      ),
    )
  }
  if (event.positionSeconds !== null && event.positionSeconds < 0) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_ENGAGEMENT_EVENT,
        'error',
        `${rootPath}.positionSeconds`,
        'positionSeconds must be nonnegative.',
      ),
    )
  }

  if (options.pack) {
    validatePackReferences(event, rootPath, options.pack, diagnostics)
  }

  return diagnostics
}

function validatePackReferences(
  event: ResourceEngagementEvent,
  rootPath: string,
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (pack.manifest.packId !== event.packId) {
    diagnostics.push(missing(rootPath, 'packId', event.packId))
  }
  if (pack.manifest.version !== event.packVersion) {
    diagnostics.push(missing(rootPath, 'packVersion', event.packVersion))
  }

  const resource = pack.resources?.resources.find(
    (candidate) => candidate.id === event.resourceId,
  )
  if (!resource) {
    diagnostics.push(missing(rootPath, 'resourceId', event.resourceId))
    return
  }

  if (resource.contentRevision !== event.contentRevision) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.MISSING_REFERENCE,
        'error',
        `${rootPath}.contentRevision`,
        `ResourceEngagementEvent contentRevision ${event.contentRevision} does not match resource revision ${resource.contentRevision}.`,
      ),
    )
  }

  if (
    event.segmentId !== null &&
    !findSegment(resource.segments ?? [], event.segmentId)
  ) {
    diagnostics.push(missing(rootPath, 'segmentId', event.segmentId))
  }
}

function findSegment(
  segments: readonly ResourceSegment[],
  segmentId: string,
): ResourceSegment | undefined {
  return segments.find((segment) => segment.id === segmentId)
}

function missing(
  rootPath: string,
  field: string,
  value: string,
): LearningPackDiagnostic {
  return makeDiagnostic(
    LearningPackErrorCode.MISSING_REFERENCE,
    'error',
    `${rootPath}.${field}`,
    `ResourceEngagementEvent references missing ${field}: ${value}.`,
  )
}
