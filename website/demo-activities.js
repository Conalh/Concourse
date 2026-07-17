function documentFor(root) {
  return root.nodeType === 9 ? root : root.ownerDocument
}

function element(documentRoot, tagName, attributes = {}, text = null) {
  const node = documentRoot.createElement(tagName)
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') node.className = value
    else if (name === 'hidden') node.hidden = value
    else node.setAttribute(name, value)
  }
  if (text !== null) node.textContent = text
  return node
}

function choiceLabel(
  documentRoot,
  { type, name, value, label, detail, checked },
) {
  const wrapper = element(documentRoot, 'label', {
    className: 'course-choice',
  })
  const input = element(documentRoot, 'input', { type, name, value })
  input.checked = checked
  wrapper.append(input, element(documentRoot, 'span', {}, label))
  if (detail) {
    wrapper.append(element(documentRoot, 'small', {}, detail))
  }
  return wrapper
}

function renderChoices(documentRoot, activity, progress) {
  const fieldset = element(documentRoot, 'fieldset', {
    'data-response-group': '',
  })
  fieldset.append(element(documentRoot, 'legend', {}, activity.prompt))
  const previous = progress.lastResponse
  const multiple = activity.kind === 'multi-select'
  if (multiple) {
    fieldset.append(
      element(
        documentRoot,
        'p',
        { 'data-selection-guidance': '', className: 'activity-guidance' },
        'Select all that apply.',
      ),
    )
  }
  for (const choice of activity.choices) {
    fieldset.append(
      choiceLabel(documentRoot, {
        type: multiple ? 'checkbox' : 'radio',
        name: 'response',
        value: choice.id,
        label: choice.label,
        detail: choice.detail,
        checked: multiple
          ? Array.isArray(previous) && previous.includes(choice.id)
          : previous === choice.id,
      }),
    )
  }
  return fieldset
}

function renderMatching(documentRoot, activity, progress) {
  const fieldset = element(documentRoot, 'fieldset', {
    'data-response-group': '',
  })
  fieldset.append(element(documentRoot, 'legend', {}, activity.prompt))
  const previous = progress.lastResponse ?? {}
  for (const prompt of activity.choices.prompts) {
    const row = element(documentRoot, 'div', { className: 'matching-row' })
    const id = `${activity.activityId}-${prompt.id}`
    const label = element(documentRoot, 'label', { for: id }, prompt.label)
    const select = element(documentRoot, 'select', {
      id,
      name: `match-${prompt.id}`,
      'data-match-prompt': prompt.id,
    })
    select.append(
      element(documentRoot, 'option', { value: '' }, 'Choose a match'),
    )
    for (const target of activity.choices.targets) {
      const option = element(
        documentRoot,
        'option',
        { value: target.id },
        target.label,
      )
      option.selected = previous[prompt.id] === target.id
      select.append(option)
    }
    row.append(label, select)
    fieldset.append(row)
  }
  return fieldset
}

function renderOrdering(documentRoot, activity, progress) {
  const fieldset = element(documentRoot, 'fieldset', {
    'data-response-group': '',
  })
  fieldset.append(element(documentRoot, 'legend', {}, activity.prompt))
  fieldset.append(
    element(
      documentRoot,
      'p',
      { className: 'activity-guidance' },
      'Use the move buttons to place the steps in order.',
    ),
  )
  const order = progress.draftOrder ?? activity.choices.map(({ id }) => id)
  const choices = new Map(activity.choices.map((choice) => [choice.id, choice]))
  const list = element(documentRoot, 'ol', { 'data-order-list': '' })
  order.forEach((itemId, index) => {
    const choice = choices.get(itemId)
    if (choice === undefined) return
    const item = element(documentRoot, 'li', {
      'data-order-item': choice.id,
    })
    const controls = element(documentRoot, 'span', {
      className: 'order-controls',
    })
    const up = element(
      documentRoot,
      'button',
      {
        type: 'button',
        'data-order-item': choice.id,
        'data-order-direction': 'up',
        'aria-label': `Move ${choice.label} up`,
      },
      '↑',
    )
    const down = element(
      documentRoot,
      'button',
      {
        type: 'button',
        'data-order-item': choice.id,
        'data-order-direction': 'down',
        'aria-label': `Move ${choice.label} down`,
      },
      '↓',
    )
    up.disabled = index === 0
    down.disabled = index === order.length - 1
    controls.append(up, down)
    item.append(
      element(documentRoot, 'span', { className: 'order-label' }, choice.label),
      controls,
    )
    list.append(item)
  })
  fieldset.append(list)
  return fieldset
}

function renderConfidence(documentRoot, progress) {
  const fieldset = element(documentRoot, 'fieldset', {
    'data-confidence-group': '',
  })
  fieldset.append(element(documentRoot, 'legend', {}, 'How sure are you?'))
  fieldset.append(
    choiceLabel(documentRoot, {
      type: 'radio',
      name: 'confidence',
      value: 'high',
      label: 'I can explain my reasoning',
      checked: progress.lastConfidence === 'high',
    }),
    choiceLabel(documentRoot, {
      type: 'radio',
      name: 'confidence',
      value: 'low',
      label: 'I am still working it out',
      checked: progress.lastConfidence === 'low',
    }),
  )
  return fieldset
}

export function renderActivity(documentRoot, activity, progress = {}) {
  const documentNode = documentFor(documentRoot)
  const form = element(documentNode, 'form', {
    'data-course-activity': activity.activityId,
    novalidate: '',
  })
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (['single-choice', 'choice', 'multi-select'].includes(kind)) {
    form.append(renderChoices(documentNode, { ...activity, kind }, progress))
  } else if (kind === 'matching') {
    form.append(renderMatching(documentNode, activity, progress))
  } else if (kind === 'ordering') {
    form.append(renderOrdering(documentNode, activity, progress))
  }
  if (activity.confidenceRequired) {
    form.append(renderConfidence(documentNode, progress))
  }
  form.append(
    element(
      documentNode,
      'p',
      {
        'data-activity-error': '',
        role: 'status',
        tabindex: '-1',
        hidden: true,
      },
      '',
    ),
    element(
      documentNode,
      'button',
      { type: 'submit', className: 'button button-primary' },
      activity.confidenceRequired ? 'Check my reasoning' : 'Complete branch',
    ),
  )
  if (typeof progress.completedAt === 'string') {
    form.dataset.activityCompleted = 'true'
    for (const control of form.elements) control.disabled = true
    form.querySelector('button[type="submit"]').hidden = true
  }
  return form
}

export function readActivityResponse(activityRoot, activity) {
  let response = null
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (['single-choice', 'choice'].includes(kind)) {
    response =
      activityRoot.querySelector('input[name="response"]:checked')?.value ??
      null
  } else if (kind === 'multi-select') {
    response = [
      ...activityRoot.querySelectorAll('input[name="response"]:checked'),
    ].map(({ value }) => value)
  } else if (kind === 'matching') {
    response = Object.fromEntries(
      [...activityRoot.querySelectorAll('select[data-match-prompt]')].map(
        (select) => [select.dataset.matchPrompt, select.value],
      ),
    )
  } else if (kind === 'ordering') {
    response = [...activityRoot.querySelectorAll('[data-order-list] > li')].map(
      (item) => item.dataset.orderItem,
    )
  }
  return {
    response,
    confidence:
      activityRoot.querySelector('input[name="confidence"]:checked')?.value ??
      null,
  }
}

export function restoreActivityResponse(activityRoot, activity, submission) {
  if (activityRoot === null || submission === null) return
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (['single-choice', 'choice'].includes(kind)) {
    const input = activityRoot.querySelector(
      `input[name="response"][value="${submission.response}"]`,
    )
    if (input) input.checked = true
  } else if (kind === 'multi-select' && Array.isArray(submission.response)) {
    for (const input of activityRoot.querySelectorAll(
      'input[name="response"]',
    )) {
      input.checked = submission.response.includes(input.value)
    }
  } else if (kind === 'matching' && submission.response !== null) {
    for (const select of activityRoot.querySelectorAll('[data-match-prompt]')) {
      select.value = submission.response[select.dataset.matchPrompt] ?? ''
    }
  }
  if (['high', 'low'].includes(submission.confidence)) {
    const confidence = activityRoot.querySelector(
      `input[name="confidence"][value="${submission.confidence}"]`,
    )
    if (confidence) confidence.checked = true
  }
}

export function validateActivityResponse(activity, submission) {
  const kind = activity.kind === 'retrieval' ? 'single-choice' : activity.kind
  if (
    ['single-choice', 'choice'].includes(kind) &&
    typeof submission.response !== 'string'
  ) {
    return { valid: false, message: 'Choose one response.' }
  }
  if (kind === 'multi-select' && submission.response?.length === 0) {
    return { valid: false, message: 'Choose at least one response.' }
  }
  if (
    kind === 'matching' &&
    (!submission.response ||
      activity.choices.prompts.some(({ id }) => !submission.response[id]))
  ) {
    return { valid: false, message: 'Match every row before continuing.' }
  }
  if (
    kind === 'ordering' &&
    (!Array.isArray(submission.response) ||
      submission.response.length !== activity.choices.length)
  ) {
    return { valid: false, message: 'Place every step before continuing.' }
  }
  if (
    activity.confidenceRequired &&
    !['high', 'low'].includes(submission.confidence)
  ) {
    return { valid: false, message: 'Choose how sure you are.' }
  }
  return { valid: true, message: '' }
}

export function moveOrderedItem(response, itemId, direction) {
  const next = [...response]
  const index = next.indexOf(itemId)
  if (index === -1 || !['up', 'down'].includes(direction)) return next
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
