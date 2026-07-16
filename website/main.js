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

  function render(announce = false) {
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
    if (manageFocus && announce) {
      const activePanel = panels.find(
        (panel) => panel.dataset.demoPanel === state.step,
      )
      activePanel?.focus({ preventScroll: true })
    }
  }

  function dispatch(event) {
    state = transitionDemo(state, event)
    render(true)
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

function mountPage() {
  const controller = mountDemo(document)
  for (const link of document.querySelectorAll('[data-focus-demo]')) {
    link.addEventListener('click', () => {
      window.requestAnimationFrame(() =>
        document.querySelector('#demo')?.focus({ preventScroll: true }),
      )
    })
  }
  return controller
}

if (typeof document !== 'undefined') mountPage()
