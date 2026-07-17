export const PREDICTION_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'oxygen',
    label: 'Oxygen',
    formula: 'O₂',
    correct: true,
  }),
  Object.freeze({
    id: 'glucose',
    label: 'Glucose',
    formula: 'C₆H₁₂O₆',
    correct: false,
  }),
  Object.freeze({
    id: 'sodium',
    label: 'Sodium ion',
    formula: 'Na⁺',
    correct: false,
  }),
])

export const APPLICATION_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'transport-protein',
    label: 'A transport protein',
    correct: true,
  }),
  Object.freeze({ id: 'ribosome', label: 'A ribosome', correct: false }),
  Object.freeze({ id: 'dna', label: 'DNA', correct: false }),
])

export const PACK_FILES = Object.freeze([
  'pack.json',
  'catalog.json',
  'courses.json',
  'items.json',
])

const BASE_DOCUMENTS = {
  pack: {
    schemaVersion: '0.1',
    packId: 'concourse.bacterial-cell-basics',
    version: '0.1.0',
    title: 'Bacterial Cell Basics',
    summary: 'A short route through membrane permeability and transport.',
    language: 'en-US',
    license: 'CC-BY-4.0',
    authors: [{ name: 'Concourse' }],
    capabilities: {
      required: [{ capabilityId: 'core.learning-pack', version: '0.1' }],
      optional: [],
    },
  },
  catalog: {
    schemaVersion: '0.1',
    subjects: [
      {
        subjectId: 'bacterial-cell-basics',
        title: 'Bacterial Cell Basics',
        summary: 'How a bacterial membrane controls exchange.',
        tags: ['microbiology'],
        conceptIds: [
          'membrane-permeability',
          'charge-and-size',
          'transport-proteins',
        ],
        objectiveIds: ['predict-membrane-crossing', 'choose-glucose-transport'],
        courseIds: ['bacterial-cell-route'],
      },
    ],
    concepts: [
      {
        conceptId: 'membrane-permeability',
        title: 'Membrane permeability',
        summary: 'Size, polarity, and charge affect membrane crossing.',
        tags: ['microbiology', 'membrane'],
        prerequisiteConceptIds: [],
        relatedConceptIds: ['charge-and-size', 'transport-proteins'],
      },
      {
        conceptId: 'charge-and-size',
        title: 'Charge and size',
        summary: 'Charged and larger polar substances need membrane proteins.',
        tags: ['microbiology', 'bridge'],
        prerequisiteConceptIds: ['membrane-permeability'],
        relatedConceptIds: ['transport-proteins'],
      },
      {
        conceptId: 'transport-proteins',
        title: 'Transport proteins',
        summary: 'Channels and carriers help selected substances cross.',
        tags: ['microbiology', 'membrane'],
        prerequisiteConceptIds: ['membrane-permeability'],
        relatedConceptIds: ['charge-and-size'],
      },
    ],
    objectives: [
      {
        objectiveId: 'predict-membrane-crossing',
        statement:
          'Predict which substance crosses a lipid membrane most easily.',
        successCriteria: [
          'Select oxygen and explain the role of polarity and charge.',
        ],
        conceptIds: ['membrane-permeability'],
      },
      {
        objectiveId: 'choose-glucose-transport',
        statement: 'Choose a mechanism that helps glucose cross a membrane.',
        successCriteria: ['Select a transport protein.'],
        conceptIds: ['transport-proteins'],
      },
    ],
  },
  courses: {
    schemaVersion: '0.1',
    courses: [
      {
        courseId: 'bacterial-cell-route',
        title: 'Inside a bacterial cell',
        summary: 'A guided route through membrane exchange.',
        subjectIds: ['bacterial-cell-basics'],
        tags: ['microbiology'],
        rootNodes: [
          {
            nodeId: 'node-membrane-permeability',
            kind: 'lesson',
            title: 'Membrane permeability',
            summary: 'Predict what crosses directly.',
            itemIds: ['item-membrane-prediction'],
            conceptIds: ['membrane-permeability'],
            objectiveIds: ['predict-membrane-crossing'],
            children: [],
            customKindLabel: null,
          },
          {
            nodeId: 'node-transport-proteins',
            kind: 'lesson',
            title: 'Transport proteins',
            summary: 'Apply the idea to glucose transport.',
            itemIds: ['item-glucose-application'],
            conceptIds: ['transport-proteins'],
            objectiveIds: ['choose-glucose-transport'],
            children: [],
            customKindLabel: null,
          },
        ],
      },
    ],
  },
  items: {
    schemaVersion: '0.1',
    items: [
      {
        itemId: 'item-membrane-prediction',
        learningRevision: 1,
        title: 'Predict membrane crossing',
        prompt:
          'Which substance crosses the lipid membrane most easily without a transport protein?',
        response: {
          kind: 'single-choice',
          options: PREDICTION_OPTIONS.map(({ id, label }) => ({
            optionId: id,
            label,
          })),
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['oxygen'],
        },
        conceptIds: ['membrane-permeability'],
        objectiveIds: ['predict-membrane-crossing'],
      },
      {
        itemId: 'item-glucose-application',
        learningRevision: 1,
        title: 'Choose glucose transport',
        prompt:
          'A bacterial cell needs glucose. What helps it cross its membrane?',
        response: {
          kind: 'single-choice',
          options: APPLICATION_OPTIONS.map(({ id, label }) => ({
            optionId: id,
            label,
          })),
        },
        evaluation: {
          kind: 'choice-selection',
          correctOptionIds: ['transport-protein'],
        },
        conceptIds: ['transport-proteins'],
        objectiveIds: ['choose-glucose-transport'],
      },
    ],
  },
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function derivePackDocuments(dnaSideRouteEnabled = false) {
  const documents = clone(BASE_DOCUMENTS)
  if (!dnaSideRouteEnabled) return documents

  documents.catalog.subjects[0].conceptIds.push('dna-storage')
  documents.catalog.concepts.push({
    conceptId: 'dna-storage',
    title: 'DNA storage',
    summary: 'Bacterial DNA stores genetic instructions.',
    tags: ['microbiology', 'dna'],
    prerequisiteConceptIds: ['membrane-permeability'],
    relatedConceptIds: ['transport-proteins'],
  })
  documents.courses.courses[0].rootNodes.push({
    nodeId: 'node-dna-storage',
    kind: 'lesson',
    title: 'DNA storage',
    summary: 'Follow an optional side route into bacterial DNA.',
    itemIds: [],
    conceptIds: ['dna-storage'],
    objectiveIds: [],
    children: [],
    customKindLabel: null,
  })
  return documents
}

export function excerptForFile(documents, fileName) {
  const selected = PACK_FILES.includes(fileName) ? fileName : 'catalog.json'
  if (selected === 'pack.json') return JSON.stringify(documents.pack, null, 2)
  if (selected === 'items.json') return JSON.stringify(documents.items, null, 2)
  if (selected === 'catalog.json') {
    return JSON.stringify(
      {
        schemaVersion: documents.catalog.schemaVersion,
        subject: documents.catalog.subjects[0],
        concepts: documents.catalog.concepts.map(
          ({
            conceptId,
            title,
            prerequisiteConceptIds,
            relatedConceptIds,
          }) => ({
            conceptId,
            title,
            prerequisiteConceptIds,
            relatedConceptIds,
          }),
        ),
      },
      null,
      2,
    )
  }

  const course = documents.courses.courses[0]
  return JSON.stringify(
    {
      schemaVersion: documents.courses.schemaVersion,
      courseId: course.courseId,
      rootNodes: course.rootNodes.map(
        ({ nodeId, title, conceptIds, itemIds }) => ({
          nodeId,
          title,
          conceptIds,
          itemIds,
        }),
      ),
    },
    null,
    2,
  )
}

export function deriveRouteNodes(state) {
  const nodes = [
    {
      id: 'membrane-permeability',
      label: 'Membrane permeability',
      state: state.phase === 'predict' ? 'active' : 'complete',
    },
  ]
  if (state.bridge.accepted || state.bridge.completed) {
    nodes.push({
      id: 'charge-and-size',
      label: 'Charge and size',
      state: state.bridge.completed ? 'complete' : 'bridge',
    })
  }
  nodes.push({
    id: 'transport-proteins',
    label: 'Transport proteins',
    state:
      state.phase === 'pack'
        ? 'complete'
        : state.phase === 'apply'
          ? 'active'
          : 'upcoming',
  })
  if (state.dnaSideRouteEnabled) {
    nodes.push({ id: 'dna-storage', label: 'DNA side route', state: 'draft' })
  }
  return nodes
}
