import {
  moveOrderedItem,
  readActivityResponse,
  restoreActivityResponse,
  validateActivityResponse,
} from './demo-activities.js'
import {
  CHAPTERS,
  getActivity,
  getCourseNode,
  retrievalActivityForConcept,
} from './demo-course.js'
import {
  createCourseState,
  projectRecap,
  transitionCourse,
} from './demo-model.js'
import { resolveDemoPresentation } from './demo-modes.js'
import { createSourceDocuments, deriveDraftDocuments } from './demo-pack.js'
import {
  CONTEXT_TABS,
  announcementForTransition,
  focusTargetForTransition,
  renderCourse,
} from './demo-render.js'
import { deriveCourseRoute, selectRetrievalConcept } from './demo-routing.js'
import {
  clearCourseState,
  loadCourseState,
  saveCourseState,
} from './demo-storage.js'

const REQUIRED_ROOTS = [
  '[data-course-entry]',
  '[data-course-workspace]',
  '[data-course-route]',
  '[data-course-stage]',
  '[data-course-context]',
  '[data-course-status]',
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function noOpController() {
  const state = createCourseState()
  return {
    getState: () => clone(state),
    dispatch: () => {},
    destroy: () => {},
  }
}

function defaultStorage(windowRoot) {
  try {
    return windowRoot.localStorage
  } catch {
    return {
      getItem() {
        throw new Error('Browser storage is unavailable')
      },
      setItem() {
        throw new Error('Browser storage is unavailable')
      },
      removeItem() {
        throw new Error('Browser storage is unavailable')
      },
    }
  }
}

export function mountCourse(
  documentRoot = document,
  windowRoot = window,
  options = {},
) {
  const root = documentRoot.querySelector('[data-course]')
  if (
    root === null ||
    REQUIRED_ROOTS.some((selector) => root.querySelector(selector) === null)
  ) {
    return noOpController()
  }

  documentRoot.documentElement.classList.add('js')
  const storage = options.storage ?? defaultStorage(windowRoot)
  const manageFocus = options.manageFocus ?? true
  const confirmAction =
    options.confirm ?? ((message) => windowRoot.confirm(message))
  const now = options.now ?? (() => new Date().toISOString())
  const loaded = loadCourseState(storage)
  let state = loaded.ok ? loaded.value : createCourseState()
  let hasSavedProgress = loaded.ok
  let entryReason = ['corrupt', 'incompatible', 'invalid'].includes(
    loaded.reason,
  )
    ? 'corrupt'
    : null
  let storageMode = loaded.reason === 'read-failed' ? 'session-only' : 'saved'
  let activeContextTab = 'evidence'
  let modePaletteOpen = false
  let disclosures = disclosureDefaults(state.interactionMode)
  let resumeNotice = ''
  let destroyed = false

  function disclosureDefaults(interactionMode) {
    const presentation = resolveDemoPresentation(interactionMode)
    return {
      routeOpen: presentation.routeVisibility !== 'collapsed',
      contextOpen: presentation.contextVisibility === 'expanded',
    }
  }

  function currentActivity() {
    const node = getCourseNode(state.currentNodeId)
    if (node === null) return null
    return node.nodeId === 'antibiotic-retrieval'
      ? retrievalActivityForConcept(selectRetrievalConcept(state.evidence))
      : getActivity(node.activityId)
  }

  function captureResponseDraft() {
    if (state.mode !== 'course' || state.awaitingAdvance !== null) return null
    const form = root.querySelector('[data-course-activity]')
    const activity = currentActivity()
    return form && activity ? readActivityResponse(form, activity) : null
  }

  function projection() {
    const presentation = resolveDemoPresentation(state.interactionMode)
    return {
      route: deriveCourseRoute(state),
      recap: projectRecap(state),
      documents: state.draft.biofilmExtensionEnabled
        ? deriveDraftDocuments(state.draft)
        : createSourceDocuments(),
      hasSavedProgress,
      entryReason,
      storageMode,
      activeContextTab,
      presentation,
      modePaletteOpen,
      disclosures,
      resumeNotice,
    }
  }

  function render(responseDraft = captureResponseDraft()) {
    renderCourse(root, state, projection())
    if (responseDraft !== null && state.mode === 'course') {
      const form = root.querySelector('[data-course-activity]')
      const activity = currentActivity()
      if (form && activity)
        restoreActivityResponse(form, activity, responseDraft)
    }
  }

  function persist() {
    if (storageMode === 'session-only') return
    const result = saveCourseState(storage, state)
    if (!result.ok) storageMode = 'session-only'
  }

  function focusAndReveal(selector) {
    if (!manageFocus || selector === null) return
    const target = selector
      .split(',')
      .map((candidate) => root.querySelector(candidate.trim()))
      .find((candidate) => candidate !== null)
    if (!target) return
    const disclosure = target.closest('details:not([open])')
    if (disclosure) disclosure.open = true
    target.focus()
    target.scrollIntoView?.({
      behavior: 'instant',
      block: 'start',
      inline: 'nearest',
    })
  }

  function afterTransition(
    previous,
    next,
    { announce = true, responseDraft = null, focusSelector = null } = {},
  ) {
    state = next
    if (state.mode !== 'entry') {
      hasSavedProgress = true
      entryReason = null
      persist()
    }
    render(responseDraft)
    if (announce) {
      const message = announcementForTransition(previous, state)
      if (message)
        root.querySelector('[data-course-status]').textContent = message
    }
    focusAndReveal(focusSelector ?? focusTargetForTransition(previous, state))
  }

  function dispatch(event, transitionOptions = {}) {
    if (destroyed) return
    const previous = state
    const next = transitionCourse(state, event, now())
    if (next === previous) return
    afterTransition(previous, next, transitionOptions)
  }

  function setModePalette(open) {
    const responseDraft = captureResponseDraft()
    modePaletteOpen = open
    render(responseDraft)
    focusAndReveal(
      open
        ? `[data-mode-option="${state.interactionMode}"]`
        : '[data-mode-trigger]',
    )
  }

  function resetCourse() {
    if (
      !confirmAction('Start this course over and erase its local progress?')
    ) {
      return
    }
    const previous = state
    const cleared = clearCourseState(storage)
    if (!cleared.ok) storageMode = 'session-only'
    state = createCourseState()
    hasSavedProgress = false
    entryReason = null
    activeContextTab = 'evidence'
    modePaletteOpen = false
    disclosures = disclosureDefaults(state.interactionMode)
    resumeNotice = ''
    render()
    root.querySelector('[data-course-status]').textContent =
      'Course progress cleared. A new route is ready.'
    focusAndReveal('[data-course-action="start"]')
    return previous
  }

  function showValidation(form, message) {
    const error = form.querySelector('[data-activity-error]')
    error.textContent = message
    error.hidden = false
    form
      .querySelector('[data-response-group]')
      ?.setAttribute('aria-invalid', 'true')
    focusAndReveal('[data-activity-error]')
  }

  function handleSubmit(event) {
    const form = event.target.closest?.('[data-course-activity]')
    if (form === null || form === undefined || !root.contains(form)) return
    event.preventDefault()
    const node = getCourseNode(state.currentNodeId)
    const activity = currentActivity()
    if (activity === null) return
    const submission = readActivityResponse(form, activity)
    const validation = validateActivityResponse(activity, submission)
    if (!validation.valid) {
      showValidation(form, validation.message)
      return
    }
    resumeNotice = ''
    if (node.required) {
      dispatch({
        type: 'submit-response',
        nodeId: node.nodeId,
        response: submission.response,
        confidence: submission.confidence,
      })
    } else {
      dispatch({ type: 'complete-branch', nodeId: node.nodeId })
    }
  }

  function handleOrder(control) {
    const itemId = control.dataset.orderItem
    const direction = control.dataset.orderDirection
    const order = [
      ...root.querySelectorAll('[data-order-list] > [data-order-item]'),
    ].map((item) => item.dataset.orderItem)
    const next = moveOrderedItem(order, itemId, direction)
    const fromIndex = order.indexOf(itemId)
    const toIndex = next.indexOf(itemId)
    if (fromIndex !== toIndex) {
      dispatch({
        type: 'move-order-item',
        nodeId: state.currentNodeId,
        fromIndex,
        toIndex,
      })
    }
  }

  function handleClick(event) {
    const orderControl = event.target.closest?.('[data-order-direction]')
    if (orderControl && root.contains(orderControl)) {
      handleOrder(orderControl)
      return
    }

    const modeOption = event.target.closest?.('[data-mode-option]')
    if (modeOption && root.contains(modeOption)) {
      const responseDraft = captureResponseDraft()
      modePaletteOpen = false
      resumeNotice = ''
      disclosures = disclosureDefaults(modeOption.dataset.modeOption)
      if (modeOption.dataset.modeOption === state.interactionMode) {
        render(responseDraft)
        focusAndReveal('[data-mode-trigger]')
      } else {
        dispatch(
          {
            type: 'change-interaction-mode',
            interactionMode: modeOption.dataset.modeOption,
          },
          { responseDraft, focusSelector: '[data-mode-trigger]' },
        )
      }
      return
    }

    const contextTab = event.target.closest?.('[data-context-tab]')
    if (contextTab && root.contains(contextTab)) {
      activeContextTab = contextTab.dataset.contextTab
      render()
      root.querySelector(`[data-context-tab="${activeContextTab}"]`)?.focus()
      return
    }

    const control = event.target.closest?.('[data-course-action]')
    if (control === null || control === undefined || !root.contains(control)) {
      return
    }
    const action = control.dataset.courseAction
    if (action === 'reset' || action === 'try-another-path') resetCourse()
    else if (action === 'toggle-mode-palette') {
      setModePalette(!modePaletteOpen)
    } else if (action === 'close-mode-palette') {
      setModePalette(false)
    } else if (action === 'start' || action === 'resume') {
      if (action === 'resume') {
        const node = getCourseNode(state.currentNodeId)
        const chapter = CHAPTERS.find(
          ({ chapterId }) => chapterId === node?.chapterId,
        )
        resumeNotice = chapter
          ? `Welcome back — continuing at ${chapter.title}.`
          : 'Welcome back — your course is ready.'
      } else {
        resumeNotice = ''
      }
      dispatch({ type: action })
    } else if (action === 'advance-course') {
      resumeNotice = ''
      const transition = { type: action }
      if (control.hasAttribute('data-next-node-id')) {
        transition.nextNodeId = control.dataset.nextNodeId || null
      }
      dispatch(transition)
    } else if (action === 'select-pack-file') {
      dispatch({ type: action, fileName: control.dataset.packFile })
    } else if (action === 'toggle-biofilm-extension') {
      dispatch({ type: action, enabled: control.checked })
    }
  }

  function handleKeys(event) {
    if (event.key === 'Escape' && modePaletteOpen) {
      event.preventDefault()
      setModePalette(false)
      return
    }
    const contextTab = event.target.closest?.('[data-context-tab]')
    if (contextTab && root.contains(contextTab)) {
      const index = CONTEXT_TABS.indexOf(contextTab.dataset.contextTab)
      let nextIndex
      if (event.key === 'ArrowRight')
        nextIndex = (index + 1) % CONTEXT_TABS.length
      else if (event.key === 'ArrowLeft')
        nextIndex = (index - 1 + CONTEXT_TABS.length) % CONTEXT_TABS.length
      else if (event.key === 'Home') nextIndex = 0
      else if (event.key === 'End') nextIndex = CONTEXT_TABS.length - 1
      else return
      event.preventDefault()
      activeContextTab = CONTEXT_TABS[nextIndex]
      render()
      root.querySelector(`[data-context-tab="${activeContextTab}"]`)?.focus()
      return
    }
    const tab = event.target.closest?.('[role="tab"][data-pack-file]')
    if (tab === null || tab === undefined || !root.contains(tab)) return
    const tabs = [...root.querySelectorAll('[role="tab"][data-pack-file]')]
    const index = tabs.indexOf(tab)
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    const fileName = tabs[nextIndex].dataset.packFile
    dispatch({ type: 'select-pack-file', fileName })
    root.querySelector(`[data-pack-file="${fileName}"]`)?.focus()
  }

  function handleDisclosureToggle(event) {
    if (event.target.matches('[data-course-route-disclosure]')) {
      disclosures.routeOpen = event.target.open
    } else if (event.target.matches('[data-course-context-disclosure]')) {
      disclosures.contextOpen = event.target.open
    }
  }

  root.addEventListener('submit', handleSubmit)
  root.addEventListener('click', handleClick)
  root.addEventListener('keydown', handleKeys)
  root.addEventListener('toggle', handleDisclosureToggle, true)
  render()

  return {
    getState: () => clone(state),
    dispatch,
    destroy() {
      destroyed = true
      root.removeEventListener('submit', handleSubmit)
      root.removeEventListener('click', handleClick)
      root.removeEventListener('keydown', handleKeys)
      root.removeEventListener('toggle', handleDisclosureToggle, true)
    },
  }
}

export function mountPage(documentRoot = document, windowRoot = window) {
  return mountCourse(documentRoot, windowRoot)
}

if (typeof document !== 'undefined') mountPage()
