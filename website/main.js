import { createDemoState, transitionDemo } from './demo-model.js'

const STEP_MESSAGES = Object.freeze({
  route: 'Route ready. Zero of three concepts complete.',
  lesson: 'Lesson opened. Cell membrane is the active concept.',
  recall: 'Recall question opened.',
  pack: 'Correct. Route advanced to one of three concepts.',
})

function eventFromControl(control) {
  const type = control.dataset.demoAction
  if (type === 'answer') return { type, choice: control.dataset.choice }
  return { type }
}

export function mountDemo(documentRoot = document, options = {}) {
  const root = documentRoot.querySelector('[data-demo]')
  if (root === null) {
    return { getState: createDemoState, dispatch: () => {}, destroy: () => {} }
  }

  const manageFocus = options.manageFocus ?? true
  const panels = [...root.querySelectorAll('[data-demo-panel]')]
  const nodes = [...root.querySelectorAll('[data-route-node]')]
  const feedback = root.querySelector('[data-feedback]')
  const progress = root.querySelector('[data-demo-progress]')
  const status = root.querySelector('[data-demo-status]')
  let state = createDemoState()

  documentRoot.documentElement?.classList.add('js')

  function render(announce = false, moveFocus = false, focusAnswer = false) {
    for (const panel of panels)
      panel.hidden = panel.dataset.demoPanel !== state.step
    for (const node of nodes) {
      const active = node.dataset.routeNode === 'membrane'
      node.dataset.state =
        state.step === 'route' ? 'upcoming' : active ? 'active' : 'upcoming'
      if (state.step === 'pack' && active) node.dataset.state = 'complete'
    }
    if (feedback !== null) feedback.hidden = state.answerStatus !== 'incorrect'
    if (progress !== null) {
      progress.textContent =
        state.step === 'pack'
          ? 'Route in progress · 1 of 3 concepts'
          : 'Route ready · 0 of 3 concepts'
    }
    if (announce && status !== null)
      status.textContent =
        state.answerStatus === 'incorrect'
          ? 'Not quite. DNA stores genetic instructions. The cell membrane regulates movement across the cell boundary.'
          : STEP_MESSAGES[state.step]
    if (manageFocus && (moveFocus || focusAnswer)) {
      const activePanel = panels.find(
        (panel) => panel.dataset.demoPanel === state.step,
      )
      const focusTarget = focusAnswer
        ? root.querySelector('[data-choice]')
        : state.step === 'route'
          ? root.querySelector('[data-demo-action="start"]')
          : activePanel
      focusTarget?.focus({ preventScroll: true })
    }
  }

  function dispatch(event) {
    const previousStep = state.step
    const previousAnswerStatus = state.answerStatus
    state = transitionDemo(state, event)
    const retriedIncorrectAnswer =
      event?.type === 'retry' &&
      previousAnswerStatus === 'incorrect' &&
      state.step === 'recall' &&
      state.answerStatus === 'unanswered'
    render(true, state.step !== previousStep, retriedIncorrectAnswer)
  }

  function handleClick(event) {
    const control = event.target.closest?.('[data-demo-action]')
    if (control === null || control === undefined || !root.contains(control))
      return
    dispatch(eventFromControl(control))
  }

  root.addEventListener('click', handleClick)
  render(false)

  return {
    getState: () => ({ ...state }),
    dispatch,
    destroy: () => root.removeEventListener('click', handleClick),
  }
}

export function mountPage(documentRoot = document, windowRoot = window) {
  const controller = mountDemo(documentRoot)
  for (const link of documentRoot.querySelectorAll('[data-focus-demo]')) {
    const resetsDemo = link.closest('.final-invitation') !== null
    link.addEventListener('click', () => {
      if (resetsDemo) controller.dispatch({ type: 'reset' })
      windowRoot.requestAnimationFrame(() => {
        const focusTarget = resetsDemo
          ? documentRoot.querySelector('[data-demo-action="start"]')
          : documentRoot.querySelector('#demo')
        focusTarget?.focus({ preventScroll: true })
      })
    })
  }
  return controller
}

if (typeof document !== 'undefined') mountPage()
