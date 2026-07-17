import {
  ACTIVITIES,
  CHAPTERS,
  COURSE_ID,
  COURSE_NODES,
  COURSE_REVISION,
  SCIENTIFIC_REFERENCES,
  getCourseNode,
} from './demo-course.js'

export const PACK_FILES = Object.freeze([
  'pack.json',
  'catalog.json',
  'courses.json',
  'items.json',
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildDocuments() {
  const concepts = Object.values(
    ACTIVITIES.reduce((byId, activity) => {
      byId[activity.conceptId] ??= {
        conceptId: activity.conceptId,
        title: activity.conceptId
          .split('-')
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(' '),
        activityIds: [],
      }
      byId[activity.conceptId].activityIds.push(activity.activityId)
      return byId
    }, {}),
  )

  return {
    'pack.json': {
      schemaVersion: '0.1',
      packId: 'concourse.bacterial-survival',
      version: '1.0.0',
      title: 'How a bacterium survives',
      summary:
        'A living route through bacterial boundaries, transport, osmotic stress, energy, gene expression, and antibiotic targets.',
      language: 'en-US',
      license: 'CC-BY-4.0',
      authors: [{ name: 'Concourse contributors' }],
      capabilities: {
        required: [{ capabilityId: 'core.learning-pack', version: '0.1' }],
        optional: [
          { capabilityId: 'route.evidence', version: '0.1' },
          { capabilityId: 'route.branching', version: '0.1' },
        ],
      },
      references: SCIENTIFIC_REFERENCES,
    },
    'catalog.json': {
      schemaVersion: '0.1',
      subjects: [
        {
          subjectId: COURSE_ID,
          title: 'Bacterial survival',
          summary:
            'Mechanisms a representative bacterium uses to maintain a living boundary and respond to change.',
          tags: ['microbiology', 'cell-biology', 'local-first-demo'],
          conceptIds: concepts.map(({ conceptId }) => conceptId),
          courseIds: [COURSE_ID],
        },
      ],
      concepts,
    },
    'courses.json': {
      schemaVersion: '0.1',
      courses: [
        {
          courseId: COURSE_ID,
          learningRevision: COURSE_REVISION,
          title: 'How a bacterium survives',
          summary:
            'Six connected chapters with a required spine, transparent support, extensions, and delayed retrieval.',
          estimatedMinutes: 18,
          chapterIds: CHAPTERS.map(({ chapterId }) => chapterId),
          chapters: CHAPTERS.map((chapter) => ({
            chapterId: chapter.chapterId,
            title: chapter.title,
            summary: chapter.summary,
            coreNodeIds: chapter.coreNodeIds,
            supportNodeId: chapter.supportNodeId,
            extensionNodeId: chapter.extensionNodeId,
          })),
          nodes: COURSE_NODES.map((node) => ({
            nodeId: node.nodeId,
            kind: node.kind,
            title: node.title,
            activityId: node.activityId,
            conceptId: node.conceptId,
            required: node.required,
            nextCoreNodeId: node.nextCoreNodeId,
          })),
        },
      ],
    },
    'items.json': {
      schemaVersion: '0.1',
      items: ACTIVITIES.map((activity) => ({
        itemId: activity.activityId,
        learningRevision: COURSE_REVISION,
        title: getCourseNode(activity.activityId)?.title ?? activity.prompt,
        prompt: activity.prompt,
        response: {
          kind: activity.kind,
          choices: activity.choices,
          confidenceRequired: activity.confidenceRequired,
        },
        evaluation: {
          kind: 'deterministic',
          correctResponse: activity.correctResponse,
        },
        feedback: activity.feedback,
        conceptIds: [activity.conceptId],
        estimatedMinutes: activity.minutes,
      })),
    },
  }
}

const SOURCE_DOCUMENTS = Object.freeze(buildDocuments())

export function createSourceDocuments() {
  return clone(SOURCE_DOCUMENTS)
}

export function deriveDraftDocuments(draft = {}) {
  const documents = createSourceDocuments()
  if (draft.biofilmExtensionEnabled !== true) return documents

  const concept = {
    conceptId: 'biofilm-survival',
    title: 'Biofilm survival',
    summary:
      'A surface-associated community can create shared structure and altered local conditions.',
    activityIds: [],
    draft: true,
  }
  const node = {
    nodeId: 'extension-biofilm-survival',
    kind: 'extension',
    title: 'Biofilm survival',
    activityId: null,
    conceptId: 'biofilm-survival',
    required: false,
    nextCoreNodeId: null,
    draft: true,
  }

  documents['catalog.json'].concepts.push(concept)
  documents['catalog.json'].subjects[0].conceptIds.push(concept.conceptId)
  documents['courses.json'].courses[0].nodes.push(node)
  documents['courses.json'].courses[0].draftExtensionNodeIds = [node.nodeId]
  return documents
}

export function excerptForFile(documents, fileName) {
  const selectedFile = PACK_FILES.includes(fileName) ? fileName : 'courses.json'
  return JSON.stringify(documents[selectedFile], null, 2)
}

export function sourceForNode(nodeId) {
  const node = getCourseNode(nodeId)
  if (node === null) {
    return {
      fileName: 'courses.json',
      excerpt: excerptForFile(createSourceDocuments(), 'courses.json'),
    }
  }

  const documents = createSourceDocuments()
  const item = documents['items.json'].items.find(
    ({ itemId }) => itemId === node.activityId,
  )
  return {
    fileName: 'items.json',
    excerpt: JSON.stringify(item, null, 2),
  }
}
