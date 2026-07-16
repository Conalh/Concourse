import type {
  ActivityProgress,
  EvaluationStatus,
  InteractionMode,
  SessionStatus,
} from '../../core/contracts'
import type { SessionAvailability } from '../../application'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatDateTime(timestamp: string): string {
  return dateTimeFormatter.format(new Date(timestamp))
}

export function sessionStatusLabel(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'completed':
      return 'Completed'
    case 'abandoned':
      return 'Abandoned'
  }
}

export function availabilityLabel(availability: SessionAvailability): string {
  switch (availability) {
    case 'ready':
      return 'Ready'
    case 'subject-not-registered':
      return 'Subject not registered'
    case 'subject-version-mismatch':
      return 'Subject version mismatch'
    case 'learner-profile-mismatch':
      return 'Learner profile mismatch'
  }
}

export function availabilityMessage(availability: SessionAvailability): string {
  switch (availability) {
    case 'ready':
      return 'This session can be opened.'
    case 'subject-not-registered':
      return 'The saved subject is not registered in this build.'
    case 'subject-version-mismatch':
      return 'The saved subject version differs from the registered version.'
    case 'learner-profile-mismatch':
      return 'The saved session belongs to another configured learner profile.'
  }
}

export function interactionModeLabel(mode: InteractionMode): string {
  switch (mode) {
    case 'coach':
      return 'Coach'
    case 'flow':
      return 'Flow'
    case 'test':
      return 'Test'
    case 'rescue':
      return 'Rescue'
    case 'zoom':
      return 'Zoom'
    case 'recap':
      return 'Recap'
  }
}

export function interactionModeDescription(mode: InteractionMode): string {
  switch (mode) {
    case 'coach':
      return 'Balanced explanation and activity checkpoints.'
    case 'flow':
      return 'Fewer interruptions and a wider working slice.'
    case 'test':
      return 'Independent response before support is exposed.'
    case 'rescue':
      return 'More guidance intended to restore progress.'
    case 'zoom':
      return 'Expanded concept and system context.'
    case 'recap':
      return 'Retrieval-focused presentation with minimal new material.'
  }
}

export function activityStatusLabel(
  status: ActivityProgress['status'],
): string {
  switch (status) {
    case 'unseen':
      return 'Unseen'
    case 'active':
      return 'Active'
    case 'attempted':
      return 'Attempted'
    case 'completed':
      return 'Completed'
  }
}

export function evaluationStatusLabel(status: EvaluationStatus): string {
  switch (status) {
    case 'passed':
      return 'Passed'
    case 'partial':
      return 'Partial'
    case 'retry':
      return 'Retry'
    case 'ungraded':
      return 'Recorded'
  }
}
