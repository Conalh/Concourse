import {
  moveOrderedItem,
  readActivityResponse,
  validateActivityResponse,
} from './demo-activities.js'
import { getActivity, getCourseNode } from './demo-course.js'
import {
  createCourseState,
  projectRecap,
  transitionCourse,
} from './demo-model.js'
import { createSourceDocuments, deriveDraftDocuments } from './demo-pack.js'
import {
  announcementForTransition,
  focusTargetForTransition,
  renderCourse,
} from './demo-render.js'
import { deriveCourseRoute } from './demo-routing.js'
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
  let destroyed = false

  function projection() {
    return {
      route: deriveCourseRoute(state),
      recap: projectRecap(state),
      documents: state.draft.biofilmExtensionEnabled
        ? deriveDraftDocuments(state.draft)
        : createSourceDocuments(),
      hasSavedProgress,
      entryReason,
      storageMode,
    }
  }

  function render() {
    renderCourse(root, state, projection())
  }

  function persist() {
    if (storageMode === 'session-only') return
    const result = saveCourseState(storage, state)
    if (!result.ok) storageMode = 'session-only'
  }

  function afterTransition(previous, next, { announce = true } = {}) {
    state = next
    if (state.mode !== 'entry') {
      hasSavedProgress = true
      entryReason = null
      persist()
    }
    render()
    if (announce) {
      const message = announcementForTransition(previous, state)
      if (message)
        root.querySelector('[data-course-status]').textContent = message
    }
    if (manageFocus) {
      const selector = focusTargetForTransition(previous, state)
      root.querySelector(selector)?.focus({ preventScroll: true })
    }
  }

  function dispatch(event) {
    if (destroyed) return
    const previous = state
    const next = transitionCourse(state, event, now())
    if (next === previous) return
    afterTransition(previous, next)
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
    render()
    root.querySelector('[data-course-status]').textContent =
      'Course progress cleared. A new route is ready.'
    if (manageFocus) {
      root
        .querySelector('[data-course-action="start"]')
        ?.focus({ preventScroll: true })
    }
    return previous
  }

  function showValidation(form, message) {
    const error = form.querySelector('[data-activity-error]')
    error.textContent = message
    error.hidden = false
    form
      .querySelector('[data-response-group]')
      ?.setAttribute('aria-invalid', 'true')
    if (manageFocus) error.focus({ preventScroll: true })
  }

  function handleSubmit(event) {
    const form = event.target.closest?.('[data-course-activity]')
    if (form === null || form === undefined || !root.contains(form)) return
    event.preventDefault()
    const node = getCourseNode(state.currentNodeId)
    const activity = getActivity(node?.activityId)
    if (activity === null) return
    const submission = readActivityResponse(form, activity)
    const validation = validateActivityResponse(activity, submission)
    if (!validation.valid) {
      showValidation(form, validation.message)
      return
    }
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

    const branch = event.target.closest?.('[data-branch-action]')
    if (branch && root.contains(branch)) {
      dispatch({
        type:
          branch.dataset.branchAction === 'take'
            ? 'take-branch'
            : 'skip-branch',
        nodeId: branch.dataset.nodeId,
      })
      return
    }

    const control = event.target.closest?.('[data-course-action]')
    if (control === null || control === undefined || !root.contains(control)) {
      return
    }
    const action = control.dataset.courseAction
    if (action === 'reset') resetCourse()
    else if (action === 'start' || action === 'resume') {
      dispatch({ type: action })
    } else if (action === 'select-pack-file') {
      dispatch({ type: action, fileName: control.dataset.packFile })
    }
  }

  function handlePackKeys(event) {
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

  root.addEventListener('submit', handleSubmit)
  root.addEventListener('click', handleClick)
  root.addEventListener('keydown', handlePackKeys)
  render()

  return {
    getState: () => clone(state),
    dispatch,
    destroy() {
      destroyed = true
      root.removeEventListener('submit', handleSubmit)
      root.removeEventListener('click', handleClick)
      root.removeEventListener('keydown', handlePackKeys)
    },
  }
}

export function mountPage(documentRoot = document, windowRoot = window) {
  return mountCourse(documentRoot, windowRoot)
}

if (typeof document !== 'undefined') mountPage()
