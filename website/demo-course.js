import courseData from './demo-course-data.json' with { type: 'json' }

export const COURSE_ID = 'bacterial-survival'
export const COURSE_REVISION = 1

export const REQUIRED_ACTIVITY_IDS = Object.freeze([
  'boundary-permeability',
  'boundary-structure',
  'transport-gradient',
  'transport-mechanism',
  'osmosis-water',
  'osmosis-response',
  'energy-classify',
  'energy-scarce-nutrient',
  'response-sequence',
  'response-transporter',
  'antibiotic-targets',
  'antibiotic-consequence',
  'antibiotic-retrieval',
])

export const SUPPORT_NODE_IDS = Object.freeze([
  'support-charge-size',
  'support-gradient',
  'support-tonicity',
  'support-active-passive',
  'support-central-dogma',
])

export const EXTENSION_NODE_IDS = Object.freeze([
  'extension-cell-envelopes',
  'extension-proton-gradient',
  'extension-anaerobic-energy',
  'extension-plasmids',
])

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export const ACTIVITIES = deepFreeze(courseData.activities)
export const CHAPTERS = deepFreeze(courseData.chapters)

const CORE_NEXT = Object.freeze(
  Object.fromEntries(
    REQUIRED_ACTIVITY_IDS.map((activityId, index) => [
      activityId,
      REQUIRED_ACTIVITY_IDS[index + 1] ?? null,
    ]),
  ),
)

function coreNode(activityId) {
  const activity = ACTIVITIES.find(
    (candidate) => candidate.activityId === activityId,
  )
  const chapter = CHAPTERS.find((candidate) =>
    candidate.coreNodeIds.includes(activityId),
  )
  return Object.freeze({
    nodeId: activityId,
    chapterId: chapter.chapterId,
    kind: activityId === 'antibiotic-retrieval' ? 'retrieval' : 'core',
    title: activity.prompt,
    activityId,
    conceptId: activity.conceptId,
    required: true,
    nextCoreNodeId: CORE_NEXT[activityId],
  })
}

const BRANCH_DETAILS = Object.freeze({
  'support-charge-size': [
    'boundary',
    'Charge and molecular size',
    'transport-gradient',
  ],
  'support-gradient': [
    'transport',
    'Reading a concentration gradient',
    'osmosis-water',
  ],
  'support-tonicity': [
    'osmosis',
    'Tonicity without vocabulary traps',
    'energy-classify',
  ],
  'support-active-passive': [
    'energy',
    'Passive versus active',
    'response-sequence',
  ],
  'support-central-dogma': [
    'response',
    'DNA â†’ RNA â†’ protein',
    'antibiotic-targets',
  ],
  'extension-cell-envelopes': [
    'boundary',
    'Two common envelope patterns',
    'transport-gradient',
  ],
  'extension-proton-gradient': [
    'transport',
    'Using a proton gradient',
    'osmosis-water',
  ],
  'extension-anaerobic-energy': [
    'energy',
    'Making energy without oxygen',
    'response-sequence',
  ],
  'extension-plasmids': [
    'response',
    'Plasmids and resistance traits',
    'antibiotic-targets',
  ],
})

function branchNode(nodeId) {
  const [chapterId, title, nextCoreNodeId] = BRANCH_DETAILS[nodeId]
  const activity = ACTIVITIES.find(
    (candidate) => candidate.activityId === nodeId,
  )
  return Object.freeze({
    nodeId,
    chapterId,
    kind: nodeId.startsWith('support-') ? 'support' : 'extension',
    title,
    activityId: nodeId,
    conceptId: activity.conceptId,
    required: false,
    nextCoreNodeId,
  })
}

export const COURSE_NODES = Object.freeze([
  ...REQUIRED_ACTIVITY_IDS.map(coreNode),
  ...SUPPORT_NODE_IDS.map(branchNode),
  ...EXTENSION_NODE_IDS.map(branchNode),
])

export const SCIENTIFIC_REFERENCES = deepFreeze(courseData.references)

export function getCourseNode(id) {
  return COURSE_NODES.find(({ nodeId }) => nodeId === id) ?? null
}

export function getActivity(id) {
  return ACTIVITIES.find(({ activityId }) => activityId === id) ?? null
}

const RETRIEVAL_VARIANTS = Object.freeze({
  'membrane-permeability': [
    'Membrane permeability',
    'Which substance crosses a lipid membrane directly with relative ease?',
    'oxygen',
    [
      { id: 'oxygen', label: 'Small, nonpolar oxygen' },
      { id: 'glucose', label: 'Large, polar glucose' },
      { id: 'sodium', label: 'A charged sodium ion' },
    ],
  ],
  'cell-envelope': [
    'Cell envelope',
    'Which structure primarily resists osmotic rupture?',
    'wall',
    [
      { id: 'wall', label: 'Cell wall' },
      { id: 'membrane', label: 'Cell membrane' },
      { id: 'ribosome', label: 'Ribosome' },
    ],
  ],
  'concentration-gradient': [
    'Concentration gradients',
    'A permeable solute is more concentrated outside. What is its net movement?',
    'in',
    [
      { id: 'in', label: 'Into the cell' },
      { id: 'out', label: 'Out of the cell' },
      { id: 'none', label: 'No molecules move' },
    ],
  ],
  'transport-proteins': [
    'Transport proteins',
    'What can help a selected polar nutrient cross the lipid membrane?',
    'carrier',
    [
      { id: 'carrier', label: 'A selective carrier' },
      { id: 'wall', label: 'The cell wall alone' },
      { id: 'dna', label: 'DNA crossing with the nutrient' },
    ],
  ],
  osmosis: [
    'Osmosis',
    'The exterior becomes saltier than the cytoplasm. What is the net movement of water?',
    'out',
    [
      { id: 'out', label: 'Out of the cell' },
      { id: 'in', label: 'Into the cell' },
      { id: 'none', label: 'Water stops moving' },
    ],
  ],
  'energy-coupling': [
    'Energy coupling',
    'What can accumulate a scarce nutrient against its concentration gradient?',
    'coupled',
    [
      { id: 'coupled', label: 'An energy-coupled transporter' },
      { id: 'passive', label: 'Passive diffusion alone' },
      { id: 'wall', label: 'The rigid wall alone' },
    ],
  ],
  'gene-expression': [
    'Gene expression',
    'Which structure reads RNA while assembling a new transporter protein?',
    'ribosome',
    [
      { id: 'ribosome', label: 'Ribosome' },
      { id: 'wall', label: 'Cell wall' },
      { id: 'lipid', label: 'A membrane lipid' },
    ],
  ],
})

export function retrievalActivityForConcept(conceptId) {
  const normalized =
    {
      'osmotic-stress': 'osmosis',
      'active-transport': 'energy-coupling',
    }[conceptId] ?? conceptId
  const [label, prompt, correctResponse, choices] =
    RETRIEVAL_VARIANTS[normalized] ?? RETRIEVAL_VARIANTS.osmosis
  return Object.freeze({
    ...getActivity('antibiotic-retrieval'),
    conceptId: normalized,
    prompt,
    correctResponse,
    choices: Object.freeze(choices),
    retrievalLabel: label,
  })
}

function unique(values) {
  return new Set(values).size === values.length
}

export function validateCourseDefinition() {
  const chapterIds = CHAPTERS.map(({ chapterId }) => chapterId)
  const nodeIds = COURSE_NODES.map(({ nodeId }) => nodeId)
  const activityIds = ACTIVITIES.map(({ activityId }) => activityId)

  if (
    CHAPTERS.length !== 6 ||
    REQUIRED_ACTIVITY_IDS.length !== 13 ||
    !unique(chapterIds) ||
    !unique(nodeIds) ||
    !unique(activityIds)
  ) {
    return false
  }

  return COURSE_NODES.every((node) => {
    const chapter = CHAPTERS.find(
      ({ chapterId }) => chapterId === node.chapterId,
    )
    const activity = getActivity(node.activityId)
    const nextNode =
      node.nextCoreNodeId === null ? true : getCourseNode(node.nextCoreNodeId)
    const ownedByChapter =
      chapter !== undefined &&
      (chapter.coreNodeIds.includes(node.nodeId) ||
        chapter.supportNodeId === node.nodeId ||
        chapter.extensionNodeId === node.nodeId)
    return Boolean(activity && nextNode && ownedByChapter)
  })
}
