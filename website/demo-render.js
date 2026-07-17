import { renderActivity } from './demo-activities.js'
import {
  CHAPTERS,
  REQUIRED_ACTIVITY_IDS,
  getActivity,
  getCourseNode,
  retrievalActivityForConcept,
} from './demo-course.js'
import {
  INTERACTION_MODES,
  getInteractionModeDefinition,
} from './demo-modes.js'
import { excerptForFile, sourceForNode } from './demo-pack.js'
import { explainRouteDecision, selectRetrievalConcept } from './demo-routing.js'

export const CONTEXT_TABS = Object.freeze([
  'evidence',
  'route-decision',
  'pack-source',
])

function el(documentRoot, tagName, attributes = {}, text = null) {
  const node = documentRoot.createElement(tagName)
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') node.className = value
    else if (name === 'hidden') node.hidden = value
    else node.setAttribute(name, value)
  }
  if (text !== null) node.textContent = text
  return node
}

export function renderTeachingBlock(
  documentRoot,
  teaching,
  presentation = { teachingVisibility: 'visible' },
) {
  const section = el(documentRoot, 'section', {
    className: 'activity-teaching',
    'data-activity-teaching': '',
    'aria-labelledby': 'activity-key-idea-title',
  })
  const heading = el(
    documentRoot,
    'h3',
    {
      id: 'activity-key-idea-title',
      'data-key-idea-anchor': '',
      tabindex: '-1',
    },
    'Key idea',
  )
  section.append(heading)

  for (const { segments } of teaching) {
    const paragraph = el(documentRoot, 'p')
    for (const segment of segments) {
      paragraph.append(
        segment.kind === 'term'
          ? el(documentRoot, 'strong', {}, segment.text)
          : documentRoot.createTextNode(segment.text),
      )
    }
    section.append(paragraph)
  }

  if (presentation.teachingVisibility !== 'available') return section

  heading.removeAttribute('data-key-idea-anchor')
  heading.removeAttribute('tabindex')
  const disclosure = el(documentRoot, 'details', {
    className: 'teaching-disclosure',
    'data-teaching-disclosure': '',
  })
  disclosure.append(
    el(
      documentRoot,
      'summary',
      { 'data-key-idea-anchor': '', tabindex: '-1' },
      'Review the key idea',
    ),
    section,
  )
  return disclosure
}

function chapterForNode(nodeId) {
  const node = getCourseNode(nodeId)
  return (
    CHAPTERS.find(({ chapterId }) => chapterId === node?.chapterId) ??
    CHAPTERS[0]
  )
}

function renderModePalette(root, state, projection) {
  const documentRoot = root.ownerDocument
  const definition = getInteractionModeDefinition(state.interactionMode)
  const trigger = root.querySelector('[data-mode-trigger]')
  const palette = root.querySelector('[data-mode-palette]')
  const options = root.querySelector('[data-mode-options]')
  trigger.textContent = `Mode: ${definition.label}`
  trigger.setAttribute('aria-expanded', String(projection.modePaletteOpen))
  palette.hidden = !projection.modePaletteOpen
  options.replaceChildren()

  for (const mode of INTERACTION_MODES) {
    const option = el(documentRoot, 'button', {
      type: 'button',
      'data-mode-option': mode.id,
      'aria-pressed': String(mode.id === state.interactionMode),
    })
    option.append(
      el(documentRoot, 'strong', {}, mode.label),
      el(documentRoot, 'span', {}, mode.description),
    )
    options.append(option)
  }
}

function renderEntry(root, state, projection) {
  const documentRoot = root.ownerDocument
  const entry = root.querySelector('[data-course-entry]')
  entry.replaceChildren()
  entry.hidden = false

  const card = el(documentRoot, 'div', { className: 'course-entry-card' })
  card.append(
    el(
      documentRoot,
      'p',
      { className: 'eyebrow' },
      'Local course · 15–20 minutes',
    ),
    el(documentRoot, 'h2', {}, 'Ready when you are.'),
  )

  if (projection.entryReason === 'corrupt') {
    card.append(
      el(
        documentRoot,
        'p',
        { 'data-resume-copy': '' },
        'Your local course progress could not be restored. Start a clean route; no other browser data will be touched.',
      ),
    )
  } else if (projection.hasSavedProgress) {
    const chapter = chapterForNode(state.currentNodeId)
    const completed = state.completedNodeIds.filter((nodeId) =>
      REQUIRED_ACTIVITY_IDS.includes(nodeId),
    ).length
    card.replaceChildren(
      el(documentRoot, 'p', { className: 'eyebrow' }, 'Saved on this device'),
      el(documentRoot, 'h2', {}, 'Your route is waiting.'),
      el(
        documentRoot,
        'p',
        { 'data-resume-copy': '' },
        `${chapter.title} · ${completed} of 13 required activities complete.`,
      ),
    )
    const actions = el(documentRoot, 'div', {
      className: 'course-entry-actions',
    })
    actions.append(
      el(
        documentRoot,
        'button',
        { type: 'button', 'data-course-action': 'resume' },
        'Resume course',
      ),
      el(
        documentRoot,
        'button',
        { type: 'button', 'data-course-action': 'reset' },
        'Start over',
      ),
    )
    card.append(actions)
    entry.append(card)
    return
  } else {
    card.append(
      el(
        documentRoot,
        'p',
        { 'data-resume-copy': '' },
        'Build evidence across six connected chapters. Optional support and extensions are always explained and skippable.',
      ),
    )
  }

  card.append(
    el(
      documentRoot,
      'button',
      {
        type: 'button',
        className: 'button button-primary',
        'data-course-action': 'start',
      },
      'Start the course',
    ),
  )
  entry.append(card)
}

function routeNode(documentRoot, node) {
  const item = el(documentRoot, 'li', {
    'data-route-node': node.nodeId,
    'data-route-status': node.status,
    'data-route-kind': node.kind,
    'aria-label': `${node.title}: ${node.status}`,
  })
  const marker =
    node.status === 'completed'
      ? 'Done'
      : node.status === 'current'
        ? 'Now'
        : node.status === 'skipped'
          ? 'Skipped'
          : node.kind === 'support'
            ? 'Support'
            : node.kind === 'extension'
              ? 'Extension'
              : 'Next'
  item.append(
    el(documentRoot, 'span', { className: 'route-marker' }, marker),
    el(documentRoot, 'span', { className: 'route-node-title' }, node.title),
  )
  return item
}

function renderRoute(root, projection) {
  const documentRoot = root.ownerDocument
  const routeRoot = root.querySelector('[data-course-route]')
  routeRoot.replaceChildren()
  const list = el(documentRoot, 'ol', { className: 'course-route-list' })

  for (const chapter of CHAPTERS) {
    const chapterNodes = projection.route.filter(
      ({ chapterId }) => chapterId === chapter.chapterId,
    )
    const item = el(documentRoot, 'li', {
      className: 'route-chapter',
      'data-route-chapter': chapter.chapterId,
    })
    const heading = el(documentRoot, 'div', {
      className: 'route-chapter-heading',
    })
    heading.append(
      el(documentRoot, 'span', {}, String(chapter.number).padStart(2, '0')),
      el(documentRoot, 'strong', {}, chapter.title),
    )
    const nodes = el(documentRoot, 'ol')
    chapterNodes.forEach((node) => nodes.append(routeNode(documentRoot, node)))
    item.append(heading, nodes)
    list.append(item)
  }
  for (const node of projection.route.filter(
    ({ chapterId }) => chapterId === 'draft',
  )) {
    list.append(routeNode(documentRoot, node))
  }
  routeRoot.append(list)
}

function pendingRecommendations(state) {
  if (state.awaitingAdvance === null) return []
  return Object.values(state.branchDecisions).filter(
    (decision) =>
      decision.status === 'recommended' &&
      decision.evidenceActivityId === state.awaitingAdvance.nodeId,
  )
}

function nextActionButton(documentRoot, nodeId, label) {
  const attributes = {
    type: 'button',
    className: 'button button-primary',
    'data-course-action': 'advance-course',
  }
  if (nodeId !== undefined) {
    attributes['data-next-node-id'] = nodeId ?? ''
  }
  return el(documentRoot, 'button', attributes, label)
}

function renderCompletionFeedback(documentRoot, state, activity, presentation) {
  const progress = state.activityProgress[state.currentNodeId] ?? {}
  const section = el(documentRoot, 'section', {
    className: 'completion-feedback',
    'data-completion-feedback': '',
    'aria-labelledby': 'completion-feedback-title',
    tabindex: '-1',
  })
  section.append(
    el(
      documentRoot,
      'h3',
      { id: 'completion-feedback-title' },
      progress.lastResponseCorrect
        ? 'That fits the model.'
        : 'Let’s use support.',
    ),
    el(
      documentRoot,
      'p',
      {},
      progress.lastResponseCorrect
        ? activity.feedback.correct
        : activity.feedback.incorrect,
    ),
  )
  if (presentation.feedbackDetail === 'detailed') {
    section.append(
      el(
        documentRoot,
        'p',
        { className: 'feedback-detail' },
        progress.lastResponseCorrect
          ? 'What mattered: your response connected the prompt to the mechanism in the Key idea.'
          : 'What mattered: the mismatch identifies the mechanism to revisit before choosing the next route step.',
      ),
    )
  }

  const recommendations = pendingRecommendations(state)
  const actions = el(documentRoot, 'div', { className: 'branch-actions' })
  for (const decision of recommendations) {
    const node = getCourseNode(decision.nodeId)
    const reason = el(documentRoot, 'div', {
      className: 'route-decision',
      'data-route-decision': decision.nodeId,
    })
    reason.append(
      el(documentRoot, 'strong', {}, node.title),
      el(documentRoot, 'p', {}, explainRouteDecision(decision)),
    )
    section.append(reason)
    actions.append(
      nextActionButton(
        documentRoot,
        decision.nodeId,
        decision.kind === 'support' ? 'Take support' : 'Explore extension',
      ),
    )
  }

  const nextCoreNodeId = state.awaitingAdvance.nextCoreNodeId
  actions.append(
    nextActionButton(
      documentRoot,
      recommendations.length > 0 ? nextCoreNodeId : undefined,
      nextCoreNodeId === null
        ? 'Finish the route'
        : recommendations.length > 0
          ? 'Continue the required route'
          : 'Continue',
    ),
  )
  section.append(actions)
  return section
}

function renderActivityStage(root, state, projection) {
  const documentRoot = root.ownerDocument
  const stage = root.querySelector('[data-course-stage]')
  stage.replaceChildren()
  const node = getCourseNode(state.currentNodeId)
  const chapter = chapterForNode(state.currentNodeId)
  const retrievalTarget =
    node.nodeId === 'antibiotic-retrieval'
      ? selectRetrievalConcept(state.evidence)
      : null
  const activity = retrievalTarget
    ? retrievalActivityForConcept(retrievalTarget)
    : getActivity(node.activityId)
  const progress = state.activityProgress[node.nodeId] ?? {}

  const header = el(documentRoot, 'header', { className: 'activity-heading' })
  header.append(
    el(
      documentRoot,
      'p',
      { className: 'eyebrow' },
      node.required
        ? `Chapter ${chapter.number} · ${chapter.kicker}`
        : `${node.kind === 'support' ? 'Support bridge' : 'Optional extension'} · ${chapter.title}`,
    ),
    el(documentRoot, 'h2', {}, node.required ? chapter.title : node.title),
  )
  if (!node.required) {
    header.append(el(documentRoot, 'p', {}, chapter.model))
  }
  stage.append(header)

  if (node.required) {
    stage.append(
      renderTeachingBlock(
        documentRoot,
        activity.teaching,
        projection.presentation,
      ),
    )
    if (projection.presentation.guidanceVisibility === 'expanded') {
      stage.append(
        el(
          documentRoot,
          'p',
          { className: 'rescue-guidance', 'data-mode-guidance': '' },
          'Try this: name the structure or process in the Key idea, then compare each response with its role.',
        ),
      )
    }
  }

  if (retrievalTarget) {
    stage.append(
      el(
        documentRoot,
        'p',
        {
          className: 'retrieval-target',
          'data-retrieval-target': retrievalTarget,
        },
        `Delayed retrieval · This returns to ${activity.retrievalLabel} because it is the earliest earlier concept without strong evidence. An all-strong route revisits osmosis.`,
      ),
    )
  }

  if (progress.attempts === 1 && progress.status === 'incorrect') {
    stage.append(
      el(
        documentRoot,
        'div',
        {
          className: 'attempt-feedback',
          'data-attempt-feedback': '',
          role: 'status',
          tabindex: '-1',
        },
        activity.feedback.incorrect,
      ),
    )
  }
  stage.append(renderActivity(documentRoot, activity, progress))
  if (state.awaitingAdvance?.nodeId === state.currentNodeId) {
    stage.append(
      renderCompletionFeedback(
        documentRoot,
        state,
        activity,
        projection.presentation,
      ),
    )
  }
}

function renderRecap(root, projection) {
  const documentRoot = root.ownerDocument
  const stage = root.querySelector('[data-course-stage]')
  const recap = projection.recap
  stage.replaceChildren()
  const section = el(documentRoot, 'section', {
    'data-course-recap': '',
    tabindex: '-1',
  })
  section.append(
    el(documentRoot, 'p', { className: 'eyebrow' }, 'Route complete'),
    el(documentRoot, 'h2', {}, 'You kept the whole cell in view.'),
    el(
      documentRoot,
      'p',
      {},
      `${recap.requiredCompleted} required activities across ${recap.chaptersCompleted} chapters. This is evidence from one sample course, not a grade or mastery claim.`,
    ),
  )
  const stats = el(documentRoot, 'dl', { className: 'recap-stats' })
  for (const [label, value] of [
    ['Strong evidence', recap.evidence.strong],
    ['Developing evidence', recap.evidence.developing],
    ['Support indicated', recap.evidence.supportIndicated],
    ['Support completed', recap.supportsCompleted],
    ['Support skipped', recap.supportsSkipped],
    ['Extensions completed', recap.extensionsCompleted],
    ['Extensions skipped', recap.extensionsSkipped],
    ['Delayed retrieval concepts', recap.delayedRetrievalConceptIds.length],
  ]) {
    stats.append(
      el(documentRoot, 'dt', {}, label),
      el(documentRoot, 'dd', {}, String(value)),
    )
  }
  const route = el(documentRoot, 'details', { className: 'recap-route' })
  route.append(
    el(documentRoot, 'summary', {}, 'Review the route taken'),
    el(documentRoot, 'p', {}, recap.routeTaken.join(' → ')),
    el(documentRoot, 'p', {}, `Authored by ${recap.packFiles.join(', ')}.`),
  )
  section.append(
    stats,
    route,
    el(
      documentRoot,
      'button',
      {
        type: 'button',
        className: 'button button-primary',
        'data-course-action': 'try-another-path',
      },
      'Try another path',
    ),
  )
  stage.append(section)
}

function renderEvidence(documentRoot, state) {
  const section = el(documentRoot, 'section', { 'data-evidence-panel': '' })
  section.append(
    el(documentRoot, 'p', { className: 'context-label' }, 'Evidence'),
  )
  if (state.evidence.length === 0) {
    section.append(
      el(
        documentRoot,
        'p',
        {},
        'No evidence yet. Your first response starts the route.',
      ),
    )
    return section
  }
  const latest = state.evidence.at(-1)
  const friendly = {
    strong: 'Secure so far',
    developing: 'Worth revisiting',
    'support-indicated': 'Support recommended',
  }[latest.classification]
  section.append(
    el(documentRoot, 'strong', {}, friendly),
    el(
      documentRoot,
      'p',
      {},
      `${latest.correct ? 'Correct' : 'Not yet correct'} · ${latest.confidence} confidence · ${latest.attempts} attempt${latest.attempts === 1 ? '' : 's'}`,
    ),
    el(documentRoot, 'code', {}, latest.classification),
  )
  return section
}

function renderDecisions(documentRoot, state) {
  const section = el(documentRoot, 'section', {
    'data-route-decision-panel': '',
  })
  section.append(
    el(documentRoot, 'p', { className: 'context-label' }, 'Why this route?'),
  )
  const decisions = Object.values(state.branchDecisions).filter(({ status }) =>
    ['recommended', 'taken'].includes(status),
  )
  if (decisions.length === 0) {
    section.append(
      el(
        documentRoot,
        'p',
        {},
        'The required spine is open. New evidence can add a visible branch or retrieval.',
      ),
    )
    return section
  }
  for (const decision of decisions) {
    const node = getCourseNode(decision.nodeId)
    const card = el(documentRoot, 'div', {
      className: 'route-decision',
      'data-route-decision': decision.nodeId,
    })
    card.append(
      el(documentRoot, 'strong', {}, node.title),
      el(documentRoot, 'p', {}, explainRouteDecision(decision)),
    )
    section.append(card)
  }
  return section
}

function renderPack(documentRoot, state, projection) {
  const section = el(documentRoot, 'section', { 'data-pack-panel': '' })
  const currentSource = sourceForNode(state.currentNodeId).fileName
  section.append(
    el(documentRoot, 'p', { className: 'context-label' }, 'Open the pack'),
    el(documentRoot, 'h3', {}, 'Readable source, beside the route'),
    el(
      documentRoot,
      'p',
      { 'data-current-source-copy': '' },
      `${currentSource} authors the current activity.`,
    ),
  )
  const tabs = el(documentRoot, 'div', {
    role: 'tablist',
    'aria-label': 'Pack documents',
    className: 'pack-tabs',
  })
  for (const fileName of Object.keys(projection.documents)) {
    const selected = fileName === state.draft.activeFile
    const tab = el(
      documentRoot,
      'button',
      {
        type: 'button',
        role: 'tab',
        id: `pack-tab-${fileName.replace('.json', '')}`,
        'data-course-action': 'select-pack-file',
        'data-pack-file': fileName,
        'data-current-source': String(fileName === currentSource),
        'aria-selected': String(selected),
        tabindex: selected ? '0' : '-1',
        'aria-controls': 'course-pack-document',
      },
      fileName,
    )
    tabs.append(tab)
  }
  const code = el(
    documentRoot,
    'code',
    {},
    excerptForFile(projection.documents, state.draft.activeFile),
  )
  const pre = el(documentRoot, 'pre', {
    id: 'course-pack-document',
    role: 'tabpanel',
    tabindex: '0',
    'aria-labelledby': `pack-tab-${state.draft.activeFile.replace('.json', '')}`,
  })
  pre.append(code)
  section.append(tabs, pre)
  if (state.mode === 'recap') {
    const toggle = el(documentRoot, 'label', { className: 'draft-toggle' })
    const input = el(documentRoot, 'input', {
      type: 'checkbox',
      'data-course-action': 'toggle-biofilm-extension',
    })
    input.checked = state.draft.biofilmExtensionEnabled
    toggle.append(
      input,
      el(documentRoot, 'span', {}, 'Add a biofilm survival extension'),
    )
    section.append(
      toggle,
      el(
        documentRoot,
        'p',
        { 'data-draft-status': '' },
        state.draft.biofilmExtensionEnabled
          ? 'Unpacked local draft · 2 files changed · catalog.json · courses.json'
          : 'Released source unchanged · no local draft edits.',
      ),
      el(
        documentRoot,
        'p',
        { className: 'context-note' },
        'Complete validation, manifest hashing, repacking, signing, installation, and export happen outside this browser demo.',
      ),
    )
  }
  return section
}

function renderContext(root, state, projection) {
  const context = root.querySelector('[data-course-context]')
  const documentRoot = root.ownerDocument
  context.replaceChildren()
  const labels = {
    evidence: 'Evidence',
    'route-decision': 'Why this route?',
    'pack-source': 'Open the pack',
  }
  const tabs = el(documentRoot, 'div', {
    role: 'tablist',
    'aria-label': 'Course context',
    className: 'context-tabs',
  })
  for (const tabId of CONTEXT_TABS) {
    const selected = tabId === projection.activeContextTab
    tabs.append(
      el(
        documentRoot,
        'button',
        {
          type: 'button',
          role: 'tab',
          id: `context-tab-${tabId}`,
          'data-context-tab': tabId,
          'aria-selected': String(selected),
          'aria-controls': `context-panel-${tabId}`,
          tabindex: selected ? '0' : '-1',
        },
        labels[tabId],
      ),
    )
  }
  context.append(tabs)
  const contents = {
    evidence: renderEvidence(documentRoot, state),
    'route-decision': renderDecisions(documentRoot, state),
    'pack-source': renderPack(documentRoot, state, projection),
  }
  for (const tabId of CONTEXT_TABS) {
    const panel = el(documentRoot, 'div', {
      id: `context-panel-${tabId}`,
      role: 'tabpanel',
      'data-context-panel': tabId,
      'aria-labelledby': `context-tab-${tabId}`,
      hidden: tabId !== projection.activeContextTab,
    })
    panel.append(contents[tabId])
    context.append(panel)
  }
}

export function renderCourse(root, state, projection) {
  const entry = root.querySelector('[data-course-entry]')
  const workspace = root.querySelector('[data-course-workspace]')
  const heading = root.querySelector('[data-course-heading]')
  const staticCourse = root.querySelector('.static-course')
  if (staticCourse) staticCourse.hidden = true
  heading.hidden = state.mode !== 'entry'
  root.dataset.interactionMode = state.interactionMode
  root.dataset.courseActive = String(state.mode !== 'entry')

  root.querySelector('[data-save-status]').textContent =
    projection.storageMode === 'session-only'
      ? 'Session only · browser save unavailable'
      : 'Saved on this device'

  if (state.mode === 'entry') {
    workspace.hidden = true
    renderEntry(root, state, projection)
    return
  }

  entry.hidden = true
  workspace.hidden = false
  renderModePalette(root, state, projection)
  const resumeNotice = root.querySelector('[data-resume-notice]')
  resumeNotice.textContent = projection.resumeNotice
  resumeNotice.hidden = projection.resumeNotice.length === 0
  root.querySelector('[data-course-route-disclosure]').open =
    projection.disclosures.routeOpen
  root.querySelector('[data-course-context-disclosure]').open =
    projection.disclosures.contextOpen
  const completed = state.completedNodeIds.filter((nodeId) =>
    REQUIRED_ACTIVITY_IDS.includes(nodeId),
  ).length
  const availableDecisions = Object.values(state.branchDecisions).filter(
    ({ status }) => status === 'recommended',
  )
  let opportunity = ''
  if (availableDecisions.length === 1) {
    opportunity =
      availableDecisions[0].kind === 'support'
        ? ' · 1 support activity available'
        : ' · 1 extension available'
  } else if (availableDecisions.length > 1) {
    opportunity = ` · ${availableDecisions.length} optional activities available`
  }
  root.querySelector('[data-course-progress]').textContent =
    state.mode === 'recap'
      ? 'Route complete · 13 of 13 required activities'
      : `${completed} of 13 required activities${opportunity}`
  renderRoute(root, projection)
  if (state.mode === 'recap') renderRecap(root, projection)
  else renderActivityStage(root, state, projection)
  renderContext(root, state, projection)
}

export function focusTargetForTransition(previous, next) {
  if (previous.mode !== 'recap' && next.mode === 'recap') {
    return '[data-course-recap]'
  }
  if (
    previous.currentNodeId !== next.currentNodeId ||
    previous.mode !== next.mode
  ) {
    return '[data-key-idea-anchor], .activity-heading h2'
  }
  if (previous.awaitingAdvance === null && next.awaitingAdvance !== null) {
    return '[data-completion-feedback]'
  }
  const previousAttempts =
    previous.activityProgress[previous.currentNodeId]?.attempts ?? 0
  const nextAttempts = next.activityProgress[next.currentNodeId]?.attempts ?? 0
  return nextAttempts > previousAttempts ? '[data-attempt-feedback]' : null
}

export function announcementForTransition(previous, next) {
  if (previous.interactionMode !== next.interactionMode) {
    const definition = getInteractionModeDefinition(next.interactionMode)
    return `${definition.label} Mode. ${definition.announcement}`
  }
  if (previous.mode !== 'recap' && next.mode === 'recap') {
    return 'Course complete. Your route recap is ready.'
  }
  if (previous.currentNodeId !== next.currentNodeId) {
    const label = next.currentNodeId
      .replace(/^(support|extension)-/, '')
      .replaceAll('-', ' ')
    return `${label} ready.`
  }
  const progress = next.activityProgress[next.currentNodeId]
  if (progress?.attempts === 1 && progress.status === 'incorrect') {
    return 'Not yet. Read the feedback and try once more.'
  }
  if (previous.awaitingAdvance === null && next.awaitingAdvance !== null) {
    return 'Response recorded. Feedback and the next route choice are ready.'
  }
  return ''
}
