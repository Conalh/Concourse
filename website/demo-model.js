import {
  APPLICATION_OPTIONS,
  PACK_FILES,
  PREDICTION_OPTIONS,
} from './demo-content.js'

const GUIDED_PHASES = new Set([
  'predict',
  'result',
  'bridge-offer',
  'bridge',
  'apply',
  'pack',
])
const GUIDED_STATUSES = new Set(['unanswered', 'correct', 'incorrect'])

export function createGuidedDemoState() {
  return {
    phase: 'predict',
    prediction: { choice: null, confidence: null, status: 'unanswered' },
    bridge: { offered: false, accepted: false, completed: false },
    application: { choice: null, status: 'unanswered' },
    dnaSideRouteEnabled: false,
    activePackFile: 'catalog.json',
  }
}

function isValidGuidedState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    GUIDED_PHASES.has(state.phase) &&
    GUIDED_STATUSES.has(state.prediction?.status) &&
    GUIDED_STATUSES.has(state.application?.status) &&
    typeof state.bridge?.offered === 'boolean' &&
    typeof state.bridge?.accepted === 'boolean' &&
    typeof state.bridge?.completed === 'boolean' &&
    typeof state.dnaSideRouteEnabled === 'boolean' &&
    PACK_FILES.includes(state.activePackFile)
  )
}

function submitPrediction(state, event) {
  const option = PREDICTION_OPTIONS.find(({ id }) => id === event.choice)
  if (option === undefined || !['high', 'low'].includes(event.confidence)) {
    return { ...state }
  }

  const status = option.correct ? 'correct' : 'incorrect'
  return {
    ...state,
    phase: 'result',
    prediction: { choice: option.id, confidence: event.confidence, status },
    bridge: {
      offered: status === 'incorrect' || event.confidence === 'low',
      accepted: false,
      completed: false,
    },
  }
}

function navigateBack(state) {
  if (state.phase === 'pack') return { ...state, phase: 'apply' }
  if (state.phase === 'apply') {
    return {
      ...state,
      phase: state.bridge.completed ? 'bridge' : 'result',
      application: { choice: null, status: 'unanswered' },
      bridge: state.bridge.completed
        ? { ...state.bridge, completed: false }
        : state.bridge,
    }
  }
  if (state.phase === 'bridge') {
    return {
      ...state,
      phase: 'bridge-offer',
      bridge: { ...state.bridge, accepted: false, completed: false },
    }
  }
  if (state.phase === 'bridge-offer') return { ...state, phase: 'result' }
  if (state.phase === 'result') {
    return {
      ...createGuidedDemoState(),
      prediction: {
        choice: state.prediction.choice,
        confidence: state.prediction.confidence,
        status: 'unanswered',
      },
    }
  }
  return { ...state }
}

export function transitionGuidedDemo(state, event) {
  if (!isValidGuidedState(state)) return createGuidedDemoState()
  if (event === null || typeof event !== 'object') return { ...state }
  if (event.type === 'reset') return createGuidedDemoState()

  if (state.phase === 'predict' && event.type === 'submit-prediction') {
    return submitPrediction(state, event)
  }
  if (state.phase === 'result' && event.type === 'continue-result') {
    return { ...state, phase: state.bridge.offered ? 'bridge-offer' : 'apply' }
  }
  if (state.phase === 'bridge-offer' && event.type === 'accept-bridge') {
    return {
      ...state,
      phase: 'bridge',
      bridge: { ...state.bridge, accepted: true, completed: false },
    }
  }
  if (state.phase === 'bridge-offer' && event.type === 'skip-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, accepted: false, completed: false },
    }
  }
  if (state.phase === 'bridge' && event.type === 'complete-bridge') {
    return {
      ...state,
      phase: 'apply',
      bridge: { ...state.bridge, completed: true },
    }
  }
  if (state.phase === 'apply' && event.type === 'answer-application') {
    const option = APPLICATION_OPTIONS.find(({ id }) => id === event.choice)
    if (option === undefined) return { ...state }
    return {
      ...state,
      phase: option.correct ? 'pack' : 'apply',
      application: {
        choice: option.id,
        status: option.correct ? 'correct' : 'incorrect',
      },
    }
  }
  if (state.phase === 'pack' && event.type === 'select-pack-file') {
    return PACK_FILES.includes(event.fileName)
      ? { ...state, activePackFile: event.fileName }
      : { ...state }
  }
  if (
    state.phase === 'pack' &&
    event.type === 'toggle-dna-route' &&
    typeof event.enabled === 'boolean'
  ) {
    return { ...state, dnaSideRouteEnabled: event.enabled }
  }
  if (event.type === 'back') return navigateBack(state)
  return { ...state }
}
