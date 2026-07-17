export const DEFAULT_INTERACTION_MODE = 'coach'

const definitions = [
  {
    id: 'coach',
    label: 'Coach',
    description: 'Balanced explanation, activity, feedback, and route context.',
    announcement: 'Balanced guidance and checkpoints.',
    policy: {
      workspaceDensity: 'balanced',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'available',
      teachingVisibility: 'visible',
      guidanceVisibility: 'normal',
      hintAccess: 'available',
      feedbackDetail: 'brief',
      interruptionDensity: 'normal',
    },
  },
  {
    id: 'flow',
    label: 'Flow',
    description:
      'Keeps the activity dominant with fewer interruptions and less chrome.',
    announcement:
      'The activity is dominant and secondary context is collapsed.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'collapsed',
      contextVisibility: 'collapsed',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'visible',
      guidanceVisibility: 'normal',
      hintAccess: 'on-request',
      feedbackDetail: 'brief',
      interruptionDensity: 'reduced',
    },
  },
  {
    id: 'test',
    label: 'Test',
    description:
      'Prioritizes an independent response before supporting explanation.',
    announcement: 'Supporting explanation is available after independent work.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'collapsed',
      contextVisibility: 'collapsed',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'available',
      guidanceVisibility: 'reduced',
      hintAccess: 'withheld-until-requested',
      feedbackDetail: 'brief',
      interruptionDensity: 'only-when-blocked',
    },
  },
  {
    id: 'rescue',
    label: 'Rescue',
    description:
      'Expands guidance, support, and the explanation needed for the next step.',
    announcement: 'Guidance and support are expanded.',
    policy: {
      workspaceDensity: 'guided',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'available',
      teachingVisibility: 'expanded',
      guidanceVisibility: 'expanded',
      hintAccess: 'proactive',
      feedbackDetail: 'detailed',
      interruptionDensity: 'normal',
    },
  },
  {
    id: 'zoom',
    label: 'Zoom',
    description:
      'Expands the route, branch reasoning, evidence, and pack structure.',
    announcement:
      'Route and system context are expanded around the current activity.',
    policy: {
      workspaceDensity: 'contextual',
      routeVisibility: 'expanded',
      contextVisibility: 'expanded',
      optionalContentVisibility: 'expanded',
      teachingVisibility: 'visible',
      guidanceVisibility: 'expanded',
      hintAccess: 'available',
      feedbackDetail: 'brief',
      interruptionDensity: 'reduced',
    },
  },
  {
    id: 'recap',
    label: 'Recap',
    description:
      'Emphasizes retrieval, key vocabulary, and previously encountered ideas.',
    announcement: 'Retrieval and key vocabulary are emphasized.',
    policy: {
      workspaceDensity: 'focus',
      routeVisibility: 'compact',
      contextVisibility: 'compact',
      optionalContentVisibility: 'collapsed',
      teachingVisibility: 'available',
      guidanceVisibility: 'reduced',
      hintAccess: 'on-request',
      feedbackDetail: 'brief',
      interruptionDensity: 'normal',
    },
  },
]

export const INTERACTION_MODES = Object.freeze(
  definitions.map(({ policy, ...definition }) =>
    Object.freeze({ ...definition, policy: Object.freeze({ ...policy }) }),
  ),
)

const byId = new Map(
  INTERACTION_MODES.map((definition) => [definition.id, definition]),
)

export function isInteractionMode(value) {
  return typeof value === 'string' && byId.has(value)
}

export function normalizeInteractionMode(value) {
  return isInteractionMode(value) ? value : DEFAULT_INTERACTION_MODE
}

export function getInteractionModeDefinition(value) {
  return byId.get(normalizeInteractionMode(value))
}

export function resolveDemoPresentation(value) {
  return getInteractionModeDefinition(value).policy
}
