const INITIAL_STATE = Object.freeze({
  step: 'route',
  answerStatus: 'unanswered',
})

const VALID_STEPS = new Set(['route', 'lesson', 'recall', 'pack'])
const VALID_ANSWER_STATUSES = new Set(['unanswered', 'incorrect', 'correct'])

export const DEMO_ANSWERS = Object.freeze([
  Object.freeze({ id: 'membrane', label: 'Cell membrane', correct: true }),
  Object.freeze({ id: 'dna', label: 'DNA', correct: false }),
  Object.freeze({ id: 'ribosomes', label: 'Ribosomes', correct: false }),
])

export function createDemoState() {
  return { ...INITIAL_STATE }
}

function isValidState(state) {
  return (
    state !== null &&
    typeof state === 'object' &&
    VALID_STEPS.has(state.step) &&
    VALID_ANSWER_STATUSES.has(state.answerStatus)
  )
}

export function transitionDemo(state, event) {
  if (!isValidState(state) || event === null || typeof event !== 'object') {
    return createDemoState()
  }

  if (event.type === 'reset') {
    return createDemoState()
  }

  if (state.step === 'route' && event.type === 'start') {
    return { step: 'lesson', answerStatus: 'unanswered' }
  }

  if (state.step === 'lesson') {
    if (event.type === 'back') return createDemoState()
    if (event.type === 'continue') {
      return { step: 'recall', answerStatus: 'unanswered' }
    }
  }

  if (state.step === 'recall') {
    if (event.type === 'back') {
      return { step: 'lesson', answerStatus: 'unanswered' }
    }
    if (event.type === 'retry') {
      return { step: 'recall', answerStatus: 'unanswered' }
    }
    if (event.type === 'answer') {
      const choice = DEMO_ANSWERS.find(({ id }) => id === event.choice)
      if (choice?.correct === true) {
        return { step: 'pack', answerStatus: 'correct' }
      }
      if (choice !== undefined) {
        return { step: 'recall', answerStatus: 'incorrect' }
      }
    }
  }

  if (state.step === 'pack' && event.type === 'back') {
    return { step: 'recall', answerStatus: 'correct' }
  }

  return { ...state }
}
