import {
  PACK_FILES,
  derivePackDocuments,
  deriveRouteNodes,
  excerptForFile,
} from './demo-content.js'
import { createGuidedDemoState, transitionGuidedDemo } from './demo-model.js'

function predictionEvent(form) {
  const FormDataConstructor = form.ownerDocument.defaultView.FormData
  const data = new FormDataConstructor(form)
  return {
    type: 'submit-prediction',
    choice: data.get('molecule'),
    confidence: data.get('confidence'),
  }
}

function predictionValidationMessage(prediction) {
  if (prediction.choice === null && prediction.confidence === null) {
    return 'Choose a substance and a confidence level.'
  }
  if (prediction.choice === null) return 'Choose a substance.'
  if (prediction.confidence === null) return 'Choose a confidence level.'
  return null
}

function eventFromControl(control) {
  const type = control.dataset.demoAction
  if (type === 'answer-application') {
    return { type, choice: control.dataset.choice }
  }
  if (type === 'select-pack-file') {
    return { type, fileName: control.dataset.packFile }
  }
  if (type === 'toggle-dna-route') {
    return { type, enabled: control.checked }
  }
  return { type }
}

function progressCopy(state) {
  if (state.phase === 'predict') return 'Prediction ready · 0 of 2 activities'
  if (state.phase === 'pack') return 'Route complete · 2 of 2 activities'
  return 'Evidence recorded · 1 of 2 activities'
}

function evidenceCopy(state) {
  if (state.phase === 'predict') {
    return 'No evidence yet. Make a prediction to begin.'
  }
  const confidence =
    state.prediction.confidence === 'high'
      ? 'high confidence'
      : 'low confidence'
  const result =
    state.prediction.status === 'correct'
      ? 'correct prediction'
      : 'incorrect prediction'
  if (state.phase === 'result' || state.phase === 'bridge-offer') {
    return `${result} · ${confidence}`
  }
  if (state.phase === 'bridge') return `${result} · bridge opened by learner`
  if (state.phase === 'apply') {
    return state.bridge.completed
      ? `${result} · bridge completed · application ready`
      : `${result} · application ready`
  }
  return `${result} · application correct · 2 evidence records`
}

function announcementFor(state) {
  if (state.phase === 'result') {
    return state.prediction.status === 'correct'
      ? 'Correct. Oxygen crosses the lipid membrane most easily.'
      : 'Not quite. Oxygen crosses the lipid membrane most easily.'
  }
  if (state.phase === 'bridge-offer') {
    return 'A short charge and size bridge is available.'
  }
  if (state.phase === 'bridge') return 'Charge and size bridge opened.'
  if (state.phase === 'apply') {
    return state.application.status === 'incorrect'
      ? 'Not quite. Glucose crosses with help from a transport protein.'
      : 'Transport proteins application opened.'
  }
  if (state.phase === 'pack') {
    return 'Correct. Two activities complete. Pack draft opened.'
  }
  return 'Prediction ready.'
}

function resultCopy(state) {
  return state.prediction.status === 'correct'
    ? 'Exactly. Small, nonpolar oxygen can diffuse through the lipid bilayer. Glucose and sodium need membrane proteins.'
    : 'Oxygen crosses most easily. Glucose is larger and polar, while sodium carries charge, so both need membrane proteins.'
}

export function mountDemo(documentRoot = document, options = {}) {
  const root = documentRoot.querySelector('[data-demo]')
  if (root === null) {
    return {
      getState: createGuidedDemoState,
      dispatch: () => {},
      destroy: () => {},
    }
  }

  const manageFocus = options.manageFocus ?? true
  const panels = [...root.querySelectorAll('[data-demo-panel]')]
  const routeNodes = [...root.querySelectorAll('[data-route-node]')]
  const applicationButtons = [
    ...root.querySelectorAll('[data-demo-action="answer-application"]'),
  ]
  const predictionForm = root.querySelector('[data-demo-form="prediction"]')
  const figure = root.querySelector('[data-membrane-figure]')
  const progress = root.querySelector('[data-demo-progress]')
  const evidence = root.querySelector('[data-evidence-context]')
  const applicationFeedback = root.querySelector('[data-application-feedback]')
  const result = root.querySelector('[data-result-copy]')
  const predictionError = root.querySelector('[data-prediction-error]')
  const predictionFieldsets = [...predictionForm.querySelectorAll('fieldset')]
  const inspector = root.querySelector('[data-pack-inspector]')
  const packTabsRoot = root.querySelector('.pack-tabs')
  const packCode = root.querySelector('[data-pack-code]')
  const dnaToggle = root.querySelector('[data-demo-action="toggle-dna-route"]')
  const draftStatus = root.querySelector('[data-draft-status]')
  const status = root.querySelector('[data-demo-status]')
  let state = createGuidedDemoState()

  documentRoot.documentElement?.classList.add('js')

  for (const fileName of PACK_FILES) {
    const tab = documentRoot.createElement('button')
    tab.type = 'button'
    tab.id = `pack-tab-${fileName.replace('.json', '')}`
    tab.dataset.demoAction = 'select-pack-file'
    tab.dataset.packFile = fileName
    tab.setAttribute('role', 'tab')
    tab.setAttribute('aria-controls', 'pack-document')
    tab.textContent = fileName
    packTabsRoot.append(tab)
  }
  const packTabs = [...packTabsRoot.querySelectorAll('[role="tab"]')]

  function render(announce = false, moveFocus = false, resetForm = false) {
    root.querySelector('.learning-lab').dataset.phase = state.phase
    for (const panel of panels) {
      panel.hidden = panel.dataset.demoPanel !== state.phase
    }
    figure.dataset.result = state.phase === 'predict' ? 'idle' : 'oxygen'

    const projectedNodes = new Map(
      deriveRouteNodes(state).map((node) => [node.id, node]),
    )
    for (const node of routeNodes) {
      const projection = projectedNodes.get(node.dataset.routeNode)
      node.hidden = projection === undefined
      if (projection === undefined) {
        delete node.dataset.state
        node.removeAttribute('aria-label')
      } else {
        node.dataset.state = projection.state
        node.setAttribute(
          'aria-label',
          `${projection.label}: ${projection.state}`,
        )
      }
    }

    progress.textContent = progressCopy(state)
    evidence.textContent = evidenceCopy(state)
    applicationFeedback.hidden = state.application.status !== 'incorrect'
    result.textContent = resultCopy(state)
    inspector.hidden = state.phase !== 'pack'

    const documents = derivePackDocuments(state.dnaSideRouteEnabled)
    packCode.textContent = excerptForFile(documents, state.activePackFile)
    for (const tab of packTabs) {
      const selected = tab.dataset.packFile === state.activePackFile
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      if (selected)
        packCode.parentElement.setAttribute('aria-labelledby', tab.id)
    }
    dnaToggle.checked = state.dnaSideRouteEnabled
    draftStatus.textContent = state.dnaSideRouteEnabled
      ? '2 files changed · catalog.json · courses.json'
      : 'No local changes.'

    for (const button of applicationButtons) {
      const submitted = button.dataset.choice === state.application.choice
      if (!submitted || state.application.status === 'unanswered') {
        delete button.dataset.state
      } else {
        button.dataset.state = state.application.status
      }
    }

    if (resetForm) {
      predictionForm.reset()
      predictionError.hidden = true
      for (const fieldset of predictionFieldsets) {
        fieldset.removeAttribute('aria-invalid')
      }
    }
    if (announce) {
      const message = announcementFor(state)
      if (status.textContent !== message) status.textContent = message
    }
    if (manageFocus && moveFocus) {
      const target =
        state.phase === 'predict'
          ? predictionForm.querySelector('[name="molecule"]')
          : panels.find((panel) => panel.dataset.demoPanel === state.phase)
      target?.focus({ preventScroll: true })
    }
  }

  function dispatch(event) {
    const previousPhase = state.phase
    state = transitionGuidedDemo(state, event)
    const reset = event?.type === 'reset'
    const phaseChanged = state.phase !== previousPhase
    const incorrectApplication =
      event?.type === 'answer-application' &&
      state.application.status === 'incorrect'
    render(
      phaseChanged || reset || incorrectApplication,
      phaseChanged || reset,
      reset,
    )
  }

  function handleSubmit(event) {
    if (event.target !== predictionForm) return
    event.preventDefault()
    const prediction = predictionEvent(predictionForm)
    const missingChoice = prediction.choice === null
    const missingConfidence = prediction.confidence === null
    const validationMessage = predictionValidationMessage(prediction)
    if (validationMessage !== null) {
      predictionError.textContent = validationMessage
      predictionError.hidden = false
      predictionFieldsets[0].toggleAttribute('aria-invalid', missingChoice)
      predictionFieldsets[1].toggleAttribute('aria-invalid', missingConfidence)
      if (manageFocus) predictionError.focus({ preventScroll: true })
      return
    }
    predictionError.hidden = true
    for (const fieldset of predictionFieldsets) {
      fieldset.removeAttribute('aria-invalid')
    }
    dispatch(prediction)
  }

  function handleClick(event) {
    const control = event.target.closest?.('[data-demo-action]')
    if (control === null || control === undefined || !root.contains(control)) {
      return
    }
    if (control.matches('input[type="checkbox"]')) return
    dispatch(eventFromControl(control))
  }

  function handleChange(event) {
    const control = event.target.closest?.(
      '[data-demo-action="toggle-dna-route"]',
    )
    if (control === null || control === undefined || !root.contains(control)) {
      return
    }
    dispatch(eventFromControl(control))
  }

  function handlePackTabKeydown(event) {
    const current = event.target.closest?.('[role="tab"]')
    if (current === null || current === undefined) return
    const currentIndex = packTabs.indexOf(current)
    let nextIndex
    if (event.key === 'ArrowRight')
      nextIndex = (currentIndex + 1) % packTabs.length
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + packTabs.length) % packTabs.length
    } else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = packTabs.length - 1
    else return

    event.preventDefault()
    const next = packTabs[nextIndex]
    dispatch(eventFromControl(next))
    next.focus()
  }

  root.addEventListener('submit', handleSubmit)
  root.addEventListener('click', handleClick)
  root.addEventListener('change', handleChange)
  packTabsRoot.addEventListener('keydown', handlePackTabKeydown)
  render(false)

  return {
    getState: () => JSON.parse(JSON.stringify(state)),
    dispatch,
    destroy: () => {
      root.removeEventListener('submit', handleSubmit)
      root.removeEventListener('click', handleClick)
      root.removeEventListener('change', handleChange)
      packTabsRoot.removeEventListener('keydown', handlePackTabKeydown)
    },
  }
}

export function mountPage(documentRoot = document, windowRoot = window) {
  const controller = mountDemo(documentRoot)
  const pageListeners = []
  for (const link of documentRoot.querySelectorAll('[data-focus-demo]')) {
    const resetsDemo = link.closest('.final-invitation') !== null
    const handleClick = () => {
      if (resetsDemo) controller.dispatch({ type: 'reset' })
      windowRoot.requestAnimationFrame(() => {
        const focusTarget = resetsDemo
          ? documentRoot.querySelector('[name="molecule"]')
          : documentRoot.querySelector('#demo')
        focusTarget?.focus({ preventScroll: true })
      })
    }
    link.addEventListener('click', handleClick)
    pageListeners.push({ link, handleClick })
  }
  return {
    ...controller,
    destroy: () => {
      for (const { link, handleClick } of pageListeners) {
        link.removeEventListener('click', handleClick)
      }
      controller.destroy()
    },
  }
}

if (typeof document !== 'undefined') mountPage()
