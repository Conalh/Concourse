import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LearningPackErrorCode,
  checkCapabilities,
  compareLearningRevision,
  compareResourceRevisions,
  createResourceGlobalKey,
  createInvalidCapabilityFixture,
  createInvalidDuplicateIdFixture,
  createInvalidMissingReferenceFixture,
  createValidLearningPackFixture,
  isValidAssetPath,
  isValidLocalEntityId,
  isValidPackId,
  makeGlobalEntityKey,
  parseGlobalEntityKey,
  planPackUpdate,
  planResourceUpdate,
  publicJsonSchemas,
  validateJsonFile,
  validateLearningPackDocuments,
  validateResourceEngagementEvent,
  validateReviewEvent,
  type LearningPackDocuments,
  type LearningPackErrorCode as LearningPackErrorCodeType,
} from '../src/index.js'

const hash = '0'.repeat(64)

describe('Learning Pack Contract v0.1', () => {
  it('accepts the valid fixture', () => {
    const result = validateLearningPackDocuments(
      createValidLearningPackFixture(),
    )

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('accepts a manifest-tracked README document', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.files.push({
      assetId: null,
      path: 'README.md',
      role: 'documentation' as never,
      mediaType: 'text/markdown',
      sha256: hash,
      bytes: 0,
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(true)
  })

  it('rejects documentation entries that are not README.md', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.files.push({
      assetId: null,
      path: 'notes.md',
      role: 'documentation',
      mediaType: 'text/markdown',
      sha256: hash,
      bytes: 0,
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
    )
  })

  it('rejects documentation entries that are not Markdown', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.files.push({
      assetId: null,
      path: 'README.md',
      role: 'documentation',
      mediaType: 'text/plain',
      sha256: hash,
      bytes: 0,
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
    )
  })

  it('rejects documentation entries with asset IDs', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.files.push({
      assetId: 'readme-documentation',
      path: 'README.md',
      role: 'documentation',
      mediaType: 'text/markdown',
      sha256: hash,
      bytes: 0,
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
    )
  })

  it('accepts the checked-in valid JSON fixture', () => {
    const fixture = readJsonFixture('valid-basic-pack.json')

    const result = validateLearningPackDocuments(fixture)

    expect(result.ok).toBe(true)
  })

  it('rejects the checked-in invalid JSON fixture', () => {
    const fixture = readJsonFixture('invalid-missing-reference-pack.json')

    const result = validateLearningPackDocuments(fixture)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.MISSING_REFERENCE,
    )
  })

  it('exports canonical JSON Schemas for every public JSON file', () => {
    expect(publicJsonSchemas.pack.title).toBe('LearningPackManifest')
    expect(publicJsonSchemas.catalog.title).toBe('LearningPackCatalog')
    expect(publicJsonSchemas.courses.title).toBe('LearningPackCourses')
    expect(publicJsonSchemas.items.title).toBe('LearningPackItems')
    expect(publicJsonSchemas.sets.title).toBe('LearningPackSets')
    expect(publicJsonSchemas.resources.title).toBe('LearningPackResources')
    expect(publicJsonSchemas.theme.title).toBe('LearningPackTheme')
    expect(publicJsonSchemas.migrations.title).toBe('LearningPackMigrations')
    expect(publicJsonSchemas.reviewEvent.title).toBe('ReviewEvent')
    expect(publicJsonSchemas.resourceEngagementEvent.title).toBe(
      'ResourceEngagementEvent',
    )
  })

  it('performs structural validation for public JSON files', () => {
    const manifest = createValidLearningPackFixture().manifest
    const invalidManifest = { ...manifest }
    delete (invalidManifest as Partial<typeof manifest>).title

    const result = validateJsonFile('pack', invalidManifest)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.STRUCTURE_INVALID,
    )
  })

  it('rejects duplicate pack-wide entity IDs', () => {
    const result = validateLearningPackDocuments(
      createInvalidDuplicateIdFixture(),
    )

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.DUPLICATE_ID,
    )
  })

  it('rejects missing cross-file references', () => {
    const result = validateLearningPackDocuments(
      createInvalidMissingReferenceFixture(),
    )

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.MISSING_REFERENCE,
    )
  })

  it('rejects invalid curriculum parents', () => {
    const pack = createValidLearningPackFixture()
    const root = pack.courses.courses[0]!.rootNodes[0]!
    pack.courses.courses[0]!.rootNodes.push({
      ...root,
      title: 'Duplicate parent node',
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_CURRICULUM_PARENT,
    )
  })

  it('rejects curriculum cycles', () => {
    const pack = createValidLearningPackFixture()
    const root = pack.courses.courses[0]!.rootNodes[0]!
    root.children.push({
      ...root,
      children: [],
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.CURRICULUM_CYCLE,
    )
  })

  it('rejects concept prerequisite cycles', () => {
    const pack = createValidLearningPackFixture()
    pack.catalog.concepts[0]!.prerequisiteConceptIds = ['negation']
    pack.catalog.concepts.push({
      conceptId: 'negation',
      title: 'Negation',
      summary: 'Logical NOT.',
      tags: ['logic'],
      prerequisiteConceptIds: ['boolean-values'],
      relatedConceptIds: [],
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.CONCEPT_PREREQUISITE_CYCLE,
    )
  })

  it('rejects invalid answer option references', () => {
    const pack = createValidLearningPackFixture()
    pack.items.items[0]!.evaluation.correctOptionIds = ['missing-option']

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_ANSWER_OPTION_REFERENCE,
    )
  })

  it('rejects items with quiz modes but no deterministic evaluator for that mode', () => {
    const pack = createValidLearningPackFixture()
    pack.items.items[0]!.allowedPlayModes.push('text-recall')

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_PLAY_MODE_EVALUATOR,
    )
  })

  it('rejects items with flashcard mode but no usable solution', () => {
    const pack = createValidLearningPackFixture()
    pack.items.items[0]!.reviewedSolutionBlocks = []

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.FLASHCARD_MISSING_SOLUTION,
    )
  })

  it('rejects invalid migration mappings', () => {
    const pack = withMigrations(createValidLearningPackFixture())
    pack.migrations!.migrations[0]!.toVersion = '0.1.0'
    pack.migrations!.migrations[0]!.entityMappings[0]!.toLearningRevision = 2

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
    )
  })

  it('rejects unsupported required capabilities', () => {
    const result = validateLearningPackDocuments(
      createInvalidCapabilityFixture(),
    )

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.UNSUPPORTED_REQUIRED_CAPABILITY,
    )
  })

  it('warns on unsupported optional capabilities without failing installation', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.capabilities.optional.push({
      capabilityId: 'vendor.future-optional',
      version: '1.0',
    })

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(true)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.UNSUPPORTED_OPTIONAL_CAPABILITY,
    )
  })

  it('rejects invalid asset paths', () => {
    const pack = createValidLearningPackFixture()
    const assetEntry = pack.manifest.files.find(
      (file) => file.role === 'asset',
    )!
    assetEntry.path = 'assets/../cover.png'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_ASSET_PATH,
    )
  })

  it('reports pack/file version mismatches', () => {
    const pack = createValidLearningPackFixture()
    ;(pack.catalog as { schemaVersion: string }).schemaVersion = '0.2'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.PACK_FILE_VERSION_MISMATCH,
    )
  })

  it('rejects missing required file manifest entries', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.files = pack.manifest.files.filter(
      (file) => file.path !== 'catalog.json',
    )

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.REQUIRED_FILE_MISSING,
    )
  })

  it('rejects invalid content block semantics', () => {
    const pack = createValidLearningPackFixture()
    pack.items.items[0]!.promptBlocks[0]!.text = ''

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_CONTENT_BLOCK,
    )
  })

  it('rejects invalid theme asset references', () => {
    const pack = withTheme(createValidLearningPackFixture())
    pack.theme!.coverAssetId = 'missing-cover'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_THEME_ASSET_REFERENCE,
    )
  })

  it('accepts a pack with optional teaching resources', () => {
    const result = validateLearningPackDocuments(withTeachingResources())

    expect(result.ok).toBe(true)
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'error',
      ),
    ).toEqual([])
  })

  it('accepts a manifest-backed pack asset learning resource', () => {
    const result = validateLearningPackDocuments(withPackAssetResource())

    expect(result.ok).toBe(true)
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'error',
      ),
    ).toEqual([])
  })

  it('rejects a pack asset resource without the required capability', () => {
    const pack = withPackAssetResource()
    pack.manifest.capabilities.required =
      pack.manifest.capabilities.required.filter(
        (capability) =>
          capability.capabilityId !== 'learning-resource.pack-asset',
      )

    expectInvalidPackAssetSource(pack)
  })

  it('rejects a pack asset resource whose assetId is missing', () => {
    const pack = withPackAssetResource()
    packAssetSource(pack).assetId = 'missing-notebook'

    expectInvalidPackAssetSource(pack)
  })

  it('rejects a pack asset resource that resolves to a non-asset manifest entry', () => {
    const pack = withPackAssetResource()
    const entry = pack.manifest.files.find(
      (file) => file.assetId === 'lab-01-notebook',
    )!
    entry.role = 'documentation'

    expectInvalidPackAssetSource(pack)
  })

  it('rejects a pack asset resource with a mismatched manifest media type', () => {
    const pack = withPackAssetResource()
    packAssetSource(pack).mediaType = 'text/x-python'

    expectInvalidPackAssetSource(pack)
  })

  it('rejects unsupported pack asset media types', () => {
    const pack = withPackAssetResource()
    packAssetSource(pack).mediaType = 'text/html'

    expectInvalidPackAssetSource(pack)
  })

  it.each([
    ['module-01-lab.IPYNB', 'application/x-ipynb+json'],
    ['module-01-lab.py', 'text/x-python'],
    ['module-01-data.csv', 'text/csv'],
    ['module-01-readme.md', 'text/markdown'],
    ['module-01-notes.txt', 'text/plain'],
    ['environment.yml', 'application/yaml'],
    ['environment.yaml', 'application/yaml'],
  ])('accepts the pack asset pair %s and %s', (fileName, mediaType) => {
    const pack = withPackAssetResource()
    const source = packAssetSource(pack)
    const entry = pack.manifest.files.find(
      (file) => file.assetId === source.assetId,
    )!
    source.suggestedFileName = fileName
    source.mediaType = mediaType
    entry.mediaType = mediaType

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(true)
  })

  it.each([
    ['', 'empty'],
    ['a'.repeat(129), 'over 128 characters'],
    ['.', 'dot'],
    ['..', 'dot-dot'],
    ['labs/module-01-lab.ipynb', 'forward-slash path'],
    ['labs\\module-01-lab.ipynb', 'backslash path'],
    ['module-01\0-lab.ipynb', 'NUL'],
    ['module-01\n-lab.ipynb', 'control character'],
    ['module-01-lab.ipynb.', 'trailing dot'],
    ['module-01-lab.ipynb ', 'trailing space'],
    [' module-01-lab.ipynb', 'leading space'],
    ['module-01-lab.py', 'extension/media mismatch'],
  ])('rejects unsafe pack asset filenames: %s (%s)', (fileName) => {
    const pack = withPackAssetResource()
    packAssetSource(pack).suggestedFileName = fileName

    expectInvalidPackAssetSource(pack)
  })

  it('rejects unsafe resource URL schemes', () => {
    const pack = withTeachingResources()
    const resource = pack.resources!.resources.find(
      (candidate) => candidate.id === 'resource-logic-article',
    )!
    if (resource.source.kind !== 'external-link') {
      throw new Error('Unexpected resource fixture source kind.')
    }
    resource.source.url = 'javascript:alert(1)'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_URL,
    )
  })

  it('rejects missing resource links and segment references', () => {
    const pack = withTeachingResources()
    pack.catalog.concepts[0]!.resourceLinks![0]!.resourceId = 'missing-resource'
    pack.items.items[0]!.supportResourceLinks![0]!.segmentId = 'missing-segment'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.MISSING_REFERENCE,
    )
  })

  it('rejects invalid resource segment timestamp ranges', () => {
    const pack = withTeachingResources()
    const segment = pack.resources!.resources[0]!.segments![0]!
    segment.startSeconds = 120
    segment.endSeconds = 60

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_RESOURCE_SEGMENT,
    )
  })

  it('rejects invalid ordered curriculum entries', () => {
    const pack = withTeachingResources()
    pack.courses.courses[0]!.rootNodes[0]!.entries = [
      { kind: 'resource', resourceId: 'missing-resource' },
    ]

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.MISSING_REFERENCE,
    )
  })

  it('warns for contradictory resource provenance', () => {
    const pack = withTeachingResources()
    pack.resources!.resources[0]!.provenance!.contentOwnership =
      'external-link-only'

    const result = validateLearningPackDocuments(pack)

    expect(result.ok).toBe(true)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_RESOURCE_PROVENANCE,
    )
  })

  it('structurally validates ReviewEvent values', () => {
    const result = validateJsonFile('reviewEvent', createValidReviewEvent())

    expect(result.ok).toBe(true)
  })

  it('semantically validates ReviewEvent references against a pack', () => {
    const result = validateReviewEvent(createValidReviewEvent(), {
      pack: createValidLearningPackFixture(),
    })

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('rejects invalid ReviewEvent response summaries', () => {
    const event = createValidReviewEvent()
    event.responseSummary.kind = 'text'
    event.responseSummary.selectedOptionIds = ['option-false']

    const result = validateReviewEvent(event)

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
    )
  })

  it('allows redacted text ReviewEvent response summaries', () => {
    const event = createValidReviewEvent()
    event.playMode = 'text-recall'
    event.responseSummary = {
      kind: 'text',
      selectedOptionIds: [],
      enteredText: null,
      enteredNumber: null,
      selfGrade: null,
      customSummary: null,
    }

    const result = validateReviewEvent(event)

    expect(result.ok).toBe(true)
  })

  it('structurally validates ResourceEngagementEvent values', () => {
    const result = validateJsonFile(
      'resourceEngagementEvent',
      createValidResourceEngagementEvent(),
    )

    expect(result.ok).toBe(true)
  })

  it('semantically validates ResourceEngagementEvent references against a pack', () => {
    const result = validateResourceEngagementEvent(
      createValidResourceEngagementEvent(),
      {
        pack: withTeachingResources(),
      },
    )

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('rejects ResourceEngagementEvent missing segment references', () => {
    const event = createValidResourceEngagementEvent()
    event.segmentId = 'missing-segment'

    const result = validateResourceEngagementEvent(event, {
      pack: withTeachingResources(),
    })

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.MISSING_REFERENCE,
    )
  })

  function createValidResourceEngagementEvent() {
    return {
      schemaVersion: '0.1',
      eventType: 'resource-engagement',
      eventId: 'resource-event-1',
      packId: 'learnt.logic-basics-core',
      packVersion: '0.1.0',
      resourceId: 'resource-logic-reading',
      contentRevision: 1,
      segmentId: 'segment-reading-intro',
      action: 'completed',
      progressRatio: 1,
      positionSeconds: 300,
      measurement: 'reader-observed',
      occurredAt: '2026-06-23T00:00:00.000Z',
      sourceInstanceId: 'flashcards-device-1',
      metadata: null,
    }
  }

  it('rejects ReviewEvent option references missing from the item', () => {
    const event = createValidReviewEvent()
    event.responseSummary.selectedOptionIds = ['missing-option']

    const result = validateReviewEvent(event, {
      pack: createValidLearningPackFixture(),
    })

    expect(result.ok).toBe(false)
    expect(codes(result.diagnostics)).toContain(
      LearningPackErrorCode.INVALID_ANSWER_OPTION_REFERENCE,
    )
  })
})

describe('Learning pack helper APIs', () => {
  it('validates stable pack and local entity IDs', () => {
    expect(isValidPackId('learnt.logic-basics-core')).toBe(true)
    expect(isValidPackId('Learnt Logic')).toBe(false)
    expect(isValidLocalEntityId('boolean-values')).toBe(true)
    expect(isValidLocalEntityId('../boolean-values')).toBe(false)
  })

  it('builds and parses global entity keys', () => {
    const key = makeGlobalEntityKey(
      'learnt.logic-basics-core',
      'boolean-values',
    )

    expect(key).toBe('learnt.logic-basics-core:boolean-values')
    expect(parseGlobalEntityKey(key)).toEqual({
      packId: 'learnt.logic-basics-core',
      entityId: 'boolean-values',
    })
  })

  it('checks capabilities directly', () => {
    const result = checkCapabilities(
      [{ capabilityId: 'core.learning-pack', version: '0.1' }],
      [{ capabilityId: 'vendor.optional', version: '1.0' }],
    )

    expect(result.ok).toBe(true)
    expect(result.unsupportedOptional).toHaveLength(1)
  })

  it('compares learning revisions', () => {
    expect(compareLearningRevision(1, 2)).toBe(-1)
    expect(compareLearningRevision(2, 1)).toBe(1)
    expect(compareLearningRevision(2, 2)).toBe(0)
  })

  it('builds resource global keys and plans resource updates', () => {
    expect(
      createResourceGlobalKey(
        'learnt.logic-basics-core',
        'resource-logic-reading',
      ),
    ).toBe('learnt.logic-basics-core:resource-logic-reading')
    expect(compareResourceRevisions(1, 2)).toBe(-1)
    expect(
      planResourceUpdate(
        {
          packId: 'learnt.logic-basics-core',
          resourceId: 'resource-logic-reading',
          contentRevision: 1,
        },
        { id: 'resource-logic-reading', contentRevision: 2 },
        'learnt.logic-basics-core',
      ).action,
    ).toBe('stale-engagement-history')
  })

  it('plans immutable pack updates', () => {
    const pack = createValidLearningPackFixture()
    const installed = [
      {
        packId: pack.manifest.packId,
        version: pack.manifest.version,
        files: pack.manifest.files.map((file) => ({
          path: file.path,
          sha256: file.sha256,
        })),
      },
    ]

    expect(planPackUpdate(installed, pack.manifest).action).toBe(
      'already-installed',
    )

    const conflictingManifest = createValidLearningPackFixture().manifest
    conflictingManifest.files[0]!.sha256 = '1'.repeat(64)
    expect(planPackUpdate(installed, conflictingManifest).action).toBe(
      'reject-version-conflict',
    )

    const nextManifest = createValidLearningPackFixture().manifest
    nextManifest.version = '0.2.0'
    expect(planPackUpdate(installed, nextManifest).action).toBe(
      'install-additional-version',
    )
  })

  it('validates asset paths without archive extraction', () => {
    expect(isValidAssetPath('assets/cover.png')).toBe(true)
    expect(isValidAssetPath('../cover.png')).toBe(false)
    expect(isValidAssetPath('C:/tmp/cover.png')).toBe(false)
  })
})

function codes(
  diagnostics: { code: LearningPackErrorCodeType }[],
): LearningPackErrorCodeType[] {
  return diagnostics.map((diagnostic) => diagnostic.code)
}

function createValidReviewEvent() {
  return {
    schemaVersion: '0.1',
    eventId: 'event-1',
    packId: 'learnt.logic-basics-core',
    packVersion: '0.1.0',
    itemId: 'predict-negation-item',
    learningRevision: 1,
    subjectId: 'logic-basics',
    courseId: 'logic-basics-core',
    playMode: 'single-choice-quiz',
    responseSummary: {
      kind: 'choice',
      selectedOptionIds: ['option-false'],
      enteredText: null,
      enteredNumber: null,
      selfGrade: null,
      customSummary: null,
    },
    result: 'correct',
    normalizedScore: 1,
    responseTimeMs: 1200,
    occurredAt: '2026-06-23T00:00:00.000Z',
    sourceInstanceId: 'flashcards-device-1',
    confusionTargetIds: ['boolean-values'],
    privacy: {
      learnerId: null,
      sessionId: 'session-1',
      sourceAppId: 'flashcards',
      sourceAppVersion: '1.0.0',
    },
    extensions: null,
  }
}

function withTheme(pack: LearningPackDocuments): LearningPackDocuments {
  pack.manifest.capabilities.optional.push({
    capabilityId: 'theme.metadata',
    version: '0.1',
  })
  pack.manifest.files.push({
    assetId: null,
    path: 'theme.json',
    role: 'theme',
    mediaType: 'application/json',
    sha256: hash,
    bytes: 100,
  })
  pack.theme = {
    schemaVersion: '0.1',
    themeId: 'logic-theme',
    displayName: 'Logic Theme',
    accentColor: '#33C27E',
    backgroundRole: 'dark',
    iconAssetId: null,
    coverAssetId: 'cover',
  }
  return pack
}

function withTeachingResources(
  pack: LearningPackDocuments = createValidLearningPackFixture(),
): LearningPackDocuments {
  pack.manifest.capabilities.optional.push(
    { capabilityId: 'learning-resource.embedded-content', version: '1' },
    { capabilityId: 'learning-resource.external-link', version: '1' },
    { capabilityId: 'learning-resource.external-video', version: '1' },
    { capabilityId: 'learning-resource.external-audio', version: '1' },
    { capabilityId: 'learning-resource.bibliographic-reference', version: '1' },
    { capabilityId: 'learning-resource.interactive-reference', version: '1' },
    { capabilityId: 'learning-resource.segments', version: '1' },
    { capabilityId: 'learning-resource.checkpoints', version: '1' },
    { capabilityId: 'curriculum.ordered-resource-entries', version: '1' },
  )
  pack.manifest.files.push({
    assetId: null,
    path: 'resources.json',
    role: 'resources',
    mediaType: 'application/json',
    sha256: hash,
    bytes: 100,
  })

  pack.catalog.concepts[0]!.resourceLinks = [
    {
      resourceId: 'resource-logic-reading',
      segmentId: 'segment-reading-intro',
      role: 'primary',
      recommendedUse: 'before-attempt',
      priority: 10,
    },
    {
      resourceId: 'resource-logic-article',
      role: 'alternative-explanation',
      recommendedUse: 'after-incorrect',
      priority: 50,
    },
    {
      resourceId: 'resource-negation-video',
      segmentId: 'segment-video-worked-example',
      role: 'worked-example',
      recommendedUse: 'during-review',
      priority: 20,
    },
  ]
  pack.catalog.objectives[0]!.resourceLinks = [
    {
      resourceId: 'resource-truth-table-demo',
      role: 'demonstration',
      recommendedUse: 'optional',
    },
  ]
  pack.items.items[0]!.supportResourceLinks = [
    {
      resourceId: 'resource-logic-reading',
      segmentId: 'segment-reading-intro',
      role: 'remediation',
      recommendedUse: 'after-incorrect',
      priority: 5,
    },
  ]
  pack.courses.courses[0]!.rootNodes[0]!.entries = [
    { kind: 'resource', resourceId: 'resource-logic-reading' },
    { kind: 'item', itemId: 'predict-negation-item' },
    {
      kind: 'resource',
      resourceId: 'resource-negation-video',
      segmentId: 'segment-video-worked-example',
    },
    { kind: 'study-set', studySetId: 'logic-basics-deck' },
  ]

  pack.resources = {
    schemaVersion: '0.1',
    resources: [
      {
        id: 'resource-logic-reading',
        contentRevision: 1,
        title: 'Five-Minute Logic Reading',
        summary: 'A short pack-native reading that introduces truth values.',
        modality: 'text',
        roles: ['introduction', 'explanation'],
        conceptIds: ['boolean-values'],
        objectiveIds: ['predict-negation'],
        estimatedDurationSeconds: 300,
        difficulty: 'introductory',
        language: 'en-US',
        source: {
          kind: 'embedded-content',
          content: [
            {
              blockId: 'block-reading-intro',
              kind: 'text',
              text: 'A proposition is a statement that can be true or false.',
              language: null,
              calloutRole: null,
              assetId: null,
              altText: null,
            },
            {
              blockId: 'block-reading-example',
              kind: 'callout',
              text: 'Negation reverses the truth value of a proposition.',
              language: null,
              calloutRole: 'definition',
              assetId: null,
              altText: null,
            },
          ],
        },
        segments: [
          {
            id: 'segment-reading-intro',
            title: 'Truth-value intuition',
            summary: 'Introduces propositions and truth values.',
            contentBlockStartId: 'block-reading-intro',
            contentBlockEndId: 'block-reading-example',
            conceptIds: ['boolean-values'],
            objectiveIds: ['predict-negation'],
            checkpointStudySetIds: ['logic-basics-deck'],
            tags: ['reading'],
          },
        ],
        checkpointStudySetIds: ['logic-basics-deck'],
        tags: ['reading', 'intro'],
        provenance: {
          author: 'Learnt',
          license: 'CC-BY-4.0',
          attributionText: 'Logic reading by Learnt.',
          contentOwnership: 'pack-authored',
        },
        accessibility: {
          screenReaderOptimized: true,
          textAlternativeAvailable: true,
          language: 'en-US',
        },
        metadata: { authoringNote: 'offline fixture' },
      },
      {
        id: 'resource-logic-article',
        contentRevision: 1,
        title: 'External Article On Propositions',
        modality: 'text',
        roles: ['remediation', 'reference'],
        source: {
          kind: 'external-link',
          url: 'https://example.com/logic/propositions',
          providerName: 'Example University',
          contentTypeHint: 'article',
        },
        provenance: {
          sourceTitle: 'Example University Logic Notes',
          canonicalUrl: 'https://example.com/logic/propositions',
          contentOwnership: 'external-link-only',
        },
      },
      {
        id: 'resource-negation-video',
        contentRevision: 1,
        title: 'Negation Walkthrough Video',
        modality: 'video',
        roles: ['demonstration', 'worked-example'],
        conceptIds: ['boolean-values'],
        objectiveIds: ['predict-negation'],
        estimatedDurationSeconds: 420,
        source: {
          kind: 'external-video',
          provider: 'youtube',
          mediaId: 'dQw4w9WgXcQ',
          canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          startSeconds: 0,
          endSeconds: 420,
        },
        segments: [
          {
            id: 'segment-video-intro',
            title: 'Negation setup',
            startSeconds: 10,
            endSeconds: 90,
            conceptIds: ['boolean-values'],
            objectiveIds: ['predict-negation'],
            checkpointStudySetIds: [],
            tags: ['video'],
          },
          {
            id: 'segment-video-worked-example',
            title: 'Worked NOT true example',
            startSeconds: 91,
            endSeconds: 180,
            conceptIds: ['boolean-values'],
            objectiveIds: ['predict-negation'],
            checkpointStudySetIds: ['logic-basics-deck'],
            tags: ['worked-example'],
          },
        ],
        provenance: {
          sourceTitle: 'Negation Walkthrough',
          canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          contentOwnership: 'external-link-only',
        },
        accessibility: {
          captionsAvailable: true,
          transcriptAvailable: false,
          language: 'en-US',
        },
      },
      {
        id: 'resource-logic-podcast',
        contentRevision: 1,
        title: 'Logic Podcast Segment',
        modality: 'audio',
        roles: ['enrichment'],
        source: {
          kind: 'external-audio',
          provider: 'example-podcast',
          mediaId: 'episode-logic-1',
          canonicalUrl: 'https://example.com/podcasts/logic-1',
          startSeconds: 30,
          endSeconds: 240,
        },
        accessibility: {
          transcriptAvailable: true,
          language: 'en-US',
        },
      },
      {
        id: 'resource-logic-book-chapter',
        contentRevision: 1,
        title: 'Logic Textbook Chapter',
        modality: 'text',
        roles: ['reference'],
        source: {
          kind: 'bibliographic-reference',
          title: 'Introduction to Logic',
          authors: ['A. Author'],
          publisher: 'Example Press',
          publicationYear: 2020,
          chapter: 'Chapter 1',
          pageRange: '1-24',
          canonicalUrl: 'https://example.com/books/intro-logic',
          citationText: 'A. Author, Introduction to Logic, Chapter 1.',
        },
        provenance: {
          sourceTitle: 'Introduction to Logic',
          contentOwnership: 'external-link-only',
        },
      },
      {
        id: 'resource-truth-table-demo',
        contentRevision: 1,
        title: 'Truth Table Sandbox',
        modality: 'interactive',
        roles: ['demonstration', 'worked-example'],
        source: {
          kind: 'interactive-reference',
          url: 'https://example.com/sandboxes/truth-table',
          providerName: 'Example Sandbox',
          interactionSummary:
            'Learners toggle proposition values to observe truth-table rows.',
          requiredEnvironment: 'modern browser',
        },
        provenance: {
          sourceTitle: 'Truth Table Sandbox',
          contentOwnership: 'external-link-only',
        },
        accessibility: {
          accessibilityNotes:
            'External sandbox accessibility is provider-owned.',
        },
      },
    ],
  }

  return pack
}

function withPackAssetResource(): LearningPackDocuments {
  const pack = withTeachingResources()
  pack.manifest.capabilities.required.push({
    capabilityId: 'learning-resource.pack-asset',
    version: '1',
  })
  pack.manifest.files.push({
    assetId: 'lab-01-notebook',
    path: 'assets/labs/module-01-lab.ipynb',
    role: 'asset',
    mediaType: 'application/x-ipynb+json',
    sha256: hash,
    bytes: 128,
  })
  pack.resources!.resources.push({
    id: 'resource-lab-01-notebook',
    contentRevision: 1,
    title: 'Module 1 learner notebook',
    modality: 'interactive',
    roles: ['worked-example'],
    source: {
      kind: 'pack-asset',
      assetId: 'lab-01-notebook',
      suggestedFileName: 'module-01-lab.ipynb',
      mediaType: 'application/x-ipynb+json',
    } as never,
    provenance: {
      author: 'Concourse',
      license: 'CC-BY-4.0',
      contentOwnership: 'pack-authored',
    },
  })
  return pack
}

type MutablePackAssetSource = {
  assetId: string
  suggestedFileName: string
  mediaType: string
}

function packAssetSource(pack: LearningPackDocuments): MutablePackAssetSource {
  return pack.resources!.resources.find(
    (resource) => resource.id === 'resource-lab-01-notebook',
  )!.source as unknown as MutablePackAssetSource
}

function expectInvalidPackAssetSource(pack: LearningPackDocuments): void {
  const result = validateLearningPackDocuments(pack)

  expect(result.ok).toBe(false)
  expect(codes(result.diagnostics)).toContain(
    LearningPackErrorCode.INVALID_RESOURCE_SOURCE,
  )
}

function withMigrations(pack: LearningPackDocuments): LearningPackDocuments {
  pack.manifest.capabilities.optional.push({
    capabilityId: 'migrations.basic',
    version: '0.1',
  })
  pack.manifest.files.push({
    assetId: null,
    path: 'migrations.json',
    role: 'migrations',
    mediaType: 'application/json',
    sha256: hash,
    bytes: 100,
  })
  pack.migrations = {
    schemaVersion: '0.1',
    migrations: [
      {
        fromVersion: '0.0.9',
        toVersion: '0.1.0',
        notes: 'Initial migration fixture.',
        entityMappings: [
          {
            entityKind: 'item',
            fromId: 'predict-negation-item',
            toId: 'predict-negation-item',
            changeKind: 'unchanged',
            fromLearningRevision: 1,
            toLearningRevision: 1,
            progressPolicy: 'preserve',
            rationale: 'Same item and same revision.',
          },
        ],
      },
    ],
  }
  return pack
}

function readJsonFixture(fileName: string): Partial<LearningPackDocuments> {
  const url = new URL(`../fixtures/${fileName}`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf8')) as Partial<LearningPackDocuments>
}
