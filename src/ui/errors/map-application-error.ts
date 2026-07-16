import { LearningApplicationError } from '../../application'
import { LearningEngineError } from '../../core/engine'
import { LearningRepositoryError } from '../../core/ports'
import type { UiError } from './ui-error'

export function mapApplicationError(error: unknown): UiError {
  if (error instanceof LearningApplicationError) {
    return mapLearntError(error)
  }

  if (error instanceof LearningEngineError) {
    return mapEngineError(error)
  }

  if (error instanceof LearningRepositoryError) {
    return mapRepositoryError(error)
  }

  if (error instanceof Error) {
    return {
      title: 'Unexpected application error',
      message: 'Concourse could not complete that operation.',
      code: error.name,
      recoverability: 'retry',
      cause: error,
    }
  }

  return {
    title: 'Unexpected application error',
    message: 'Concourse could not complete that operation.',
    recoverability: 'retry',
    cause: error,
  }
}

export function mapBootstrapError(error: unknown): UiError {
  const mapped = mapApplicationError(error)

  if (
    mapped.code === 'storage-unavailable' ||
    mapped.code === 'write-failed' ||
    mapped.code === 'read-failed'
  ) {
    return mapped
  }

  if (error instanceof Error && error.message.includes('randomUUID')) {
    return {
      title: 'Secure browser IDs unavailable',
      message:
        'Concourse cannot create durable learning sessions because secure browser ID generation is unavailable.',
      code: 'secure-id-unavailable',
      recoverability: 'reload',
      cause: error,
    }
  }

  return {
    ...mapped,
    title: 'Concourse could not start',
    recoverability: 'reload',
  }
}

function mapLearntError(error: LearningApplicationError): UiError {
  switch (error.code) {
    case 'session-not-found':
      return {
        title: 'Session not found',
        message: 'That saved session is not available in this browser.',
        code: error.code,
        recoverability: 'return-library',
        cause: error,
      }
    case 'subject-not-found':
      return {
        title: 'Subject unavailable',
        message: 'The subject for this saved session is not registered.',
        code: error.code,
        recoverability: 'unavailable',
        cause: error,
      }
    case 'concept-not-found':
      return {
        title: 'Concept unavailable',
        message: 'That concept is not available in this saved session subject.',
        code: error.code,
        recoverability: 'return-library',
        cause: error,
      }
    case 'subject-version-mismatch':
      return {
        title: 'Saved subject version differs',
        message:
          'This saved session belongs to a different subject version and cannot be continued automatically.',
        code: error.code,
        recoverability: 'unavailable',
        cause: error,
      }
    case 'learner-profile-mismatch':
      return {
        title: 'Configured learner differs',
        message:
          'This saved session belongs to another configured learner profile and cannot be continued here.',
        code: error.code,
        recoverability: 'unavailable',
        cause: error,
      }
    case 'session-state-incompatible':
      return {
        title: 'Saved session state changed',
        message:
          'This saved session cannot reconstruct that view with the current subject data.',
        code: error.code,
        recoverability: 'reload',
        cause: error,
      }
    case 'pack-asset-integrity-failed':
      return {
        title: 'Pack asset unavailable',
        message:
          'The installed file did not match its validated learning-pack record, so it was not delivered.',
        code: error.code,
        recoverability: 'unavailable',
        cause: error,
      }
    case 'pack-asset-delivery-unavailable':
      return {
        title: 'Download unavailable',
        message:
          'This runtime is not configured to save files from learning packs.',
        code: error.code,
        recoverability: 'retry',
        cause: error,
      }
  }
}

function mapEngineError(error: LearningEngineError): UiError {
  switch (error.code) {
    case 'next-activity-selection-required':
      return {
        title: 'Choose a branch',
        message:
          'This activity has multiple next steps. Select one before continuing.',
        code: error.code,
        recoverability: 'retry',
        cause: error,
      }
    case 'session-not-active':
      return {
        title: 'Session is not active',
        message: 'This saved session cannot accept that command.',
        code: error.code,
        recoverability: 'return-library',
        cause: error,
      }
    default:
      return {
        title: 'Learning operation rejected',
        message: 'The learning engine rejected that operation.',
        code: error.code,
        recoverability: 'retry',
        cause: error,
      }
  }
}

function mapRepositoryError(error: LearningRepositoryError): UiError {
  switch (error.code) {
    case 'revision-conflict':
      return {
        title: 'Saved session changed',
        message:
          'This session changed in another application instance. Reload the latest saved state before continuing.',
        code: error.code,
        recoverability: 'reload',
        cause: error,
      }
    case 'storage-unavailable':
    case 'read-failed':
    case 'write-failed':
    case 'quota-exceeded':
      return {
        title: 'Durable progress unavailable',
        message:
          'Concourse cannot access durable local progress, so it cannot claim changes will persist.',
        code: error.code,
        recoverability: 'reload',
        cause: error,
      }
    case 'corrupt-record':
    case 'unsupported-storage-version':
    case 'invalid-record':
      return {
        title: 'Saved session unavailable',
        message:
          'A saved session could not be read with the current storage contract.',
        code: error.code,
        recoverability: 'return-library',
        cause: error,
      }
    default:
      return {
        title: 'Persistence operation failed',
        message: 'Concourse could not commit the saved session change.',
        code: error.code,
        recoverability: 'retry',
        cause: error,
      }
  }
}
