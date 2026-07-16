import { REQUIRED_JSON_FILE_PATHS, SCHEMA_VERSION } from './constants.js'
import {
  LearningPackErrorCode,
  hasBlockingDiagnostics,
  makeDiagnostic,
  type LearningPackDiagnostic,
  type ValidationResult,
} from './errors.js'
import {
  canPreserveMasteryAcrossRevision,
  checkCapabilities,
  isValidAssetPath,
  isValidLocalEntityId,
  isValidPackId,
} from './helpers.js'
import { validateJsonFile } from './structural-validation.js'
import type {
  CapabilityDeclaration,
  CatalogDocument,
  ContentBlock,
  Course,
  CurriculumNode,
  EvaluationDefinition,
  ItemsDocument,
  LearningItem,
  LearningPackDocuments,
  LearningPackManifest,
  LearningResource,
  PackFileManifestEntry,
  MigrationEntityKind,
  MigrationsDocument,
  PlayMode,
  ResourceLink,
  ResourceSegment,
  ResponseDefinition,
  ResourcesDocument,
  SetsDocument,
  ThemeMetadata,
} from './types.js'

export interface LearningPackValidationOptions {
  supportedCapabilities?: readonly CapabilityDeclaration[]
}

export function validateLearningPackDocuments(
  value: Partial<LearningPackDocuments>,
  options: LearningPackValidationOptions = {},
): ValidationResult<LearningPackDocuments> {
  const structuralDiagnostics: LearningPackDiagnostic[] = []

  if (value.manifest === undefined) {
    structuralDiagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.REQUIRED_FILE_MISSING,
        'error',
        'pack',
        'pack.json is required.',
      ),
    )
  } else {
    structuralDiagnostics.push(
      ...validateJsonFile('pack', value.manifest, { path: 'pack.json' })
        .diagnostics,
    )
  }

  for (const [key, fileName] of [
    ['catalog', 'catalog.json'],
    ['courses', 'courses.json'],
    ['items', 'items.json'],
    ['sets', 'sets.json'],
  ] as const) {
    if (value[key] === undefined) {
      structuralDiagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.REQUIRED_FILE_MISSING,
          'error',
          fileName,
          `${fileName} is required.`,
        ),
      )
      continue
    }
    structuralDiagnostics.push(
      ...validateJsonFile(key, value[key], { path: fileName }).diagnostics,
    )
  }

  if (value.theme !== undefined) {
    structuralDiagnostics.push(
      ...validateJsonFile('theme', value.theme, { path: 'theme.json' })
        .diagnostics,
    )
  }

  if (value.migrations !== undefined) {
    structuralDiagnostics.push(
      ...validateJsonFile('migrations', value.migrations, {
        path: 'migrations.json',
      }).diagnostics,
    )
  }

  if (value.resources !== undefined) {
    structuralDiagnostics.push(
      ...validateJsonFile('resources', value.resources, {
        path: 'resources.json',
      }).diagnostics,
    )
  }

  if (hasBlockingDiagnostics(structuralDiagnostics)) {
    return {
      ok: false,
      diagnostics: [
        ...structuralDiagnostics,
        ...versionMismatchDiagnosticsFromRaw(value),
      ],
    }
  }

  const documents = value as LearningPackDocuments
  const semanticDiagnostics = validateLearningPackSemantics(documents, options)
  const diagnostics = [...structuralDiagnostics, ...semanticDiagnostics]

  return {
    ok: !hasBlockingDiagnostics(diagnostics),
    value: !hasBlockingDiagnostics(diagnostics) ? documents : undefined,
    diagnostics,
  }
}

function versionMismatchDiagnosticsFromRaw(
  value: Partial<LearningPackDocuments>,
): LearningPackDiagnostic[] {
  const manifestVersion = readSchemaVersion(value.manifest)
  if (manifestVersion === undefined) {
    return []
  }

  return [
    ['catalog.json.schemaVersion', value.catalog],
    ['courses.json.schemaVersion', value.courses],
    ['items.json.schemaVersion', value.items],
    ['sets.json.schemaVersion', value.sets],
    ['resources.json.schemaVersion', value.resources],
    ['theme.json.schemaVersion', value.theme],
    ['migrations.json.schemaVersion', value.migrations],
  ].flatMap(([path, candidate]) => {
    const version = readSchemaVersion(candidate)
    if (version === undefined || version === manifestVersion) {
      return []
    }
    return [
      makeDiagnostic(
        LearningPackErrorCode.PACK_FILE_VERSION_MISMATCH,
        'error',
        String(path),
        `File schemaVersion ${version} does not match pack schemaVersion ${manifestVersion}.`,
      ),
    ]
  })
}

function readSchemaVersion(value: unknown): string | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value)
  ) {
    return undefined
  }
  const version = (value as { schemaVersion?: unknown }).schemaVersion
  return typeof version === 'string' ? version : undefined
}

export function validateLearningPackSemantics(
  pack: LearningPackDocuments,
  options: LearningPackValidationOptions = {},
): LearningPackDiagnostic[] {
  const diagnostics: LearningPackDiagnostic[] = []
  const index = buildEntityIndex(pack, diagnostics)

  validateSchemaVersions(pack, diagnostics)
  validateManifestFiles(pack, diagnostics, index.assetIds)
  validateCapabilities(pack.manifest, diagnostics, options)
  validateReferences(pack, diagnostics, index)
  validateResources(pack, diagnostics, index)
  validateConceptPrerequisiteCycles(pack.catalog, diagnostics)
  validateLearningItems(pack.items, diagnostics, index.assetIds)
  validateMigrations(pack, diagnostics, index)

  return diagnostics
}

interface EntityIndex {
  subjects: Set<string>
  courses: Set<string>
  concepts: Set<string>
  objectives: Set<string>
  items: Set<string>
  sets: Set<string>
  resources: Set<string>
  resourceSegments: Map<string, Set<string>>
  nodes: Set<string>
  themes: Set<string>
  assetIds: Set<string>
  manifestFilesByAssetId: Map<string, PackFileManifestEntry>
  itemRevisions: Map<string, number>
}

function buildEntityIndex(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
): EntityIndex {
  const allIds = new Map<string, string>()
  const index: EntityIndex = {
    subjects: new Set(),
    courses: new Set(),
    concepts: new Set(),
    objectives: new Set(),
    items: new Set(),
    sets: new Set(),
    resources: new Set(),
    resourceSegments: new Map(),
    nodes: new Set(),
    themes: new Set(),
    assetIds: new Set(),
    manifestFilesByAssetId: new Map(),
    itemRevisions: new Map(),
  }

  checkPackId(pack.manifest.packId, 'pack.json.packId', diagnostics)

  for (const [subjectIndex, subject] of pack.catalog.subjects.entries()) {
    addEntityId(
      'subject',
      subject.subjectId,
      `catalog.json.subjects[${subjectIndex}].subjectId`,
      index.subjects,
      allIds,
      diagnostics,
    )
  }

  for (const [conceptIndex, concept] of pack.catalog.concepts.entries()) {
    addEntityId(
      'concept',
      concept.conceptId,
      `catalog.json.concepts[${conceptIndex}].conceptId`,
      index.concepts,
      allIds,
      diagnostics,
    )
  }

  for (const [objectiveIndex, objective] of pack.catalog.objectives.entries()) {
    addEntityId(
      'objective',
      objective.objectiveId,
      `catalog.json.objectives[${objectiveIndex}].objectiveId`,
      index.objectives,
      allIds,
      diagnostics,
    )
  }

  for (const [courseIndex, course] of pack.courses.courses.entries()) {
    addEntityId(
      'course',
      course.courseId,
      `courses.json.courses[${courseIndex}].courseId`,
      index.courses,
      allIds,
      diagnostics,
    )
    for (const [nodeIndex, node] of course.rootNodes.entries()) {
      traverseCurriculumNode(
        node,
        `courses.json.courses[${courseIndex}].rootNodes[${nodeIndex}]`,
        null,
        [],
        index,
        allIds,
        diagnostics,
      )
    }
  }

  for (const [itemIndex, item] of pack.items.items.entries()) {
    addEntityId(
      'item',
      item.itemId,
      `items.json.items[${itemIndex}].itemId`,
      index.items,
      allIds,
      diagnostics,
    )
    index.itemRevisions.set(item.itemId, item.learningRevision)
  }

  for (const [setIndex, set] of pack.sets.sets.entries()) {
    addEntityId(
      'set',
      set.setId,
      `sets.json.sets[${setIndex}].setId`,
      index.sets,
      allIds,
      diagnostics,
    )
  }

  if (pack.resources) {
    for (const [
      resourceIndex,
      resource,
    ] of pack.resources.resources.entries()) {
      addEntityId(
        'resource',
        resource.id,
        `resources.json.resources[${resourceIndex}].id`,
        index.resources,
        allIds,
        diagnostics,
      )
      const segmentIds = new Set<string>()
      for (const [segmentIndex, segment] of (
        resource.segments ?? []
      ).entries()) {
        addScopedId(
          'resource segment',
          segment.id,
          `resources.json.resources[${resourceIndex}].segments[${segmentIndex}].id`,
          segmentIds,
          diagnostics,
        )
      }
      index.resourceSegments.set(resource.id, segmentIds)
    }
  }

  if (pack.theme) {
    addEntityId(
      'theme',
      pack.theme.themeId,
      'theme.json.themeId',
      index.themes,
      allIds,
      diagnostics,
    )
  }

  for (const [fileIndex, file] of pack.manifest.files.entries()) {
    if (
      file.assetId !== null &&
      !index.manifestFilesByAssetId.has(file.assetId)
    ) {
      index.manifestFilesByAssetId.set(file.assetId, file)
    }
    if (file.role === 'asset' && file.assetId !== null) {
      addEntityId(
        'asset',
        file.assetId,
        `pack.json.files[${fileIndex}].assetId`,
        index.assetIds,
        allIds,
        diagnostics,
      )
    }
  }

  return index
}

function validateSchemaVersions(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
): void {
  const versions = [
    ['pack.json.schemaVersion', pack.manifest.schemaVersion],
    ['catalog.json.schemaVersion', pack.catalog.schemaVersion],
    ['courses.json.schemaVersion', pack.courses.schemaVersion],
    ['items.json.schemaVersion', pack.items.schemaVersion],
    ['sets.json.schemaVersion', pack.sets.schemaVersion],
    pack.resources
      ? ['resources.json.schemaVersion', pack.resources.schemaVersion]
      : undefined,
    pack.theme
      ? ['theme.json.schemaVersion', pack.theme.schemaVersion]
      : undefined,
    pack.migrations
      ? ['migrations.json.schemaVersion', pack.migrations.schemaVersion]
      : undefined,
  ].filter(Boolean) as [string, string][]

  for (const [path, version] of versions) {
    if (version !== pack.manifest.schemaVersion || version !== SCHEMA_VERSION) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.PACK_FILE_VERSION_MISMATCH,
          'error',
          path,
          `File schemaVersion ${version} does not match pack schemaVersion ${pack.manifest.schemaVersion}.`,
        ),
      )
    }
  }
}

function validateManifestFiles(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
  assetIds: ReadonlySet<string>,
): void {
  const byPath = new Map<string, number>()
  const requiredRoles = new Map([
    ['catalog.json', 'catalog'],
    ['courses.json', 'courses'],
    ['items.json', 'items'],
    ['sets.json', 'sets'],
  ])
  const optionalRoles = new Map([
    ['resources.json', 'resources'],
    ['theme.json', 'theme'],
    ['migrations.json', 'migrations'],
  ])

  for (const [index, file] of pack.manifest.files.entries()) {
    const path = `pack.json.files[${index}]`
    const existingIndex = byPath.get(file.path)
    if (existingIndex !== undefined) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
          'error',
          `${path}.path`,
          `File path ${file.path} is already declared at pack.json.files[${existingIndex}].`,
        ),
      )
    }
    byPath.set(file.path, index)

    if (file.role === 'asset') {
      if (file.assetId === null || !assetIds.has(file.assetId)) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
            'error',
            `${path}.assetId`,
            'Asset files must declare a unique assetId.',
          ),
        )
      }
      if (!isValidAssetPath(file.path)) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.INVALID_ASSET_PATH,
            'error',
            `${path}.path`,
            `Asset path ${file.path} must be a relative path under assets/.`,
          ),
        )
      }
    } else if (file.assetId !== null) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
          'error',
          `${path}.assetId`,
          'Non-asset manifest entries must set assetId to null.',
        ),
      )
    }

    if (
      file.role === 'documentation' &&
      (file.path !== 'README.md' || file.mediaType !== 'text/markdown')
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
          'error',
          path,
          'Documentation must declare README.md with mediaType text/markdown.',
        ),
      )
    }
  }

  for (const requiredPath of REQUIRED_JSON_FILE_PATHS) {
    if (requiredPath === 'pack.json') {
      continue
    }
    const role = requiredRoles.get(requiredPath)
    const file = pack.manifest.files.find(
      (entry) => entry.path === requiredPath,
    )
    if (!file || file.role !== role || file.mediaType !== 'application/json') {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.REQUIRED_FILE_MISSING,
          'error',
          'pack.json.files',
          `${requiredPath} must be declared with role ${role} and mediaType application/json.`,
        ),
      )
    }
  }

  for (const [path, role] of optionalRoles) {
    const documentExists =
      path === 'theme.json'
        ? pack.theme !== undefined
        : path === 'resources.json'
          ? pack.resources !== undefined
          : pack.migrations !== undefined
    const manifestEntry = pack.manifest.files.find(
      (entry) => entry.path === path,
    )
    if (documentExists && (!manifestEntry || manifestEntry.role !== role)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
          'error',
          'pack.json.files',
          `${path} is provided but is not declared with role ${role}.`,
        ),
      )
    }
    if (!documentExists && manifestEntry) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.REQUIRED_FILE_MISSING,
          'error',
          'pack.json.files',
          `${path} is declared but the document was not provided.`,
        ),
      )
    }
  }
}

function validateCapabilities(
  manifest: LearningPackManifest,
  diagnostics: LearningPackDiagnostic[],
  options: LearningPackValidationOptions,
): void {
  const result = checkCapabilities(
    manifest.capabilities.required,
    manifest.capabilities.optional,
    {
      supportedCapabilities: options.supportedCapabilities,
      path: 'pack.json.capabilities',
    },
  )
  diagnostics.push(...result.diagnostics)
}

function validateReferences(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
  index: EntityIndex,
): void {
  for (const [subjectIndex, subject] of pack.catalog.subjects.entries()) {
    checkReferences(
      subject.conceptIds,
      index.concepts,
      `catalog.json.subjects[${subjectIndex}].conceptIds`,
      'concept',
      diagnostics,
    )
    checkReferences(
      subject.objectiveIds,
      index.objectives,
      `catalog.json.subjects[${subjectIndex}].objectiveIds`,
      'objective',
      diagnostics,
    )
    checkReferences(
      subject.courseIds,
      index.courses,
      `catalog.json.subjects[${subjectIndex}].courseIds`,
      'course',
      diagnostics,
    )
  }

  for (const [conceptIndex, concept] of pack.catalog.concepts.entries()) {
    checkReferences(
      concept.prerequisiteConceptIds,
      index.concepts,
      `catalog.json.concepts[${conceptIndex}].prerequisiteConceptIds`,
      'concept',
      diagnostics,
    )
    checkReferences(
      concept.relatedConceptIds,
      index.concepts,
      `catalog.json.concepts[${conceptIndex}].relatedConceptIds`,
      'concept',
      diagnostics,
    )
    validateResourceLinks(
      concept.resourceLinks ?? [],
      `catalog.json.concepts[${conceptIndex}].resourceLinks`,
      index,
      diagnostics,
    )
  }

  for (const [objectiveIndex, objective] of pack.catalog.objectives.entries()) {
    checkReferences(
      objective.conceptIds,
      index.concepts,
      `catalog.json.objectives[${objectiveIndex}].conceptIds`,
      'concept',
      diagnostics,
    )
    validateResourceLinks(
      objective.resourceLinks ?? [],
      `catalog.json.objectives[${objectiveIndex}].resourceLinks`,
      index,
      diagnostics,
    )
  }

  for (const [courseIndex, course] of pack.courses.courses.entries()) {
    checkReferences(
      course.subjectIds,
      index.subjects,
      `courses.json.courses[${courseIndex}].subjectIds`,
      'subject',
      diagnostics,
    )
    for (const [nodeIndex, node] of course.rootNodes.entries()) {
      validateNodeReferences(
        node,
        `courses.json.courses[${courseIndex}].rootNodes[${nodeIndex}]`,
        index,
        diagnostics,
      )
    }
  }

  for (const [itemIndex, item] of pack.items.items.entries()) {
    checkReferences(
      item.conceptIds,
      index.concepts,
      `items.json.items[${itemIndex}].conceptIds`,
      'concept',
      diagnostics,
    )
    checkReferences(
      item.objectiveIds,
      index.objectives,
      `items.json.items[${itemIndex}].objectiveIds`,
      'objective',
      diagnostics,
    )
    validateContentBlockReferences(
      item.promptBlocks,
      `items.json.items[${itemIndex}].promptBlocks`,
      index.assetIds,
      diagnostics,
    )
    validateContentBlockReferences(
      item.reviewedSolutionBlocks,
      `items.json.items[${itemIndex}].reviewedSolutionBlocks`,
      index.assetIds,
      diagnostics,
    )
    validateResourceLinks(
      item.supportResourceLinks ?? [],
      `items.json.items[${itemIndex}].supportResourceLinks`,
      index,
      diagnostics,
    )
    for (const [optionIndex, option] of item.response.options.entries()) {
      validateContentBlockReferences(
        option.contentBlocks,
        `items.json.items[${itemIndex}].response.options[${optionIndex}].contentBlocks`,
        index.assetIds,
        diagnostics,
      )
    }
  }

  for (const [setIndex, set] of pack.sets.sets.entries()) {
    if (set.selection.kind === 'explicit') {
      checkReferences(
        set.selection.itemIds,
        index.items,
        `sets.json.sets[${setIndex}].selection.itemIds`,
        'item',
        diagnostics,
      )
    } else {
      checkReferences(
        set.selection.include.subjectIds,
        index.subjects,
        `sets.json.sets[${setIndex}].selection.include.subjectIds`,
        'subject',
        diagnostics,
      )
      checkReferences(
        set.selection.include.courseIds,
        index.courses,
        `sets.json.sets[${setIndex}].selection.include.courseIds`,
        'course',
        diagnostics,
      )
      checkReferences(
        set.selection.include.nodeIds,
        index.nodes,
        `sets.json.sets[${setIndex}].selection.include.nodeIds`,
        'curriculum node',
        diagnostics,
      )
      checkReferences(
        set.selection.include.conceptIds,
        index.concepts,
        `sets.json.sets[${setIndex}].selection.include.conceptIds`,
        'concept',
        diagnostics,
      )
      checkReferences(
        set.selection.include.objectiveIds,
        index.objectives,
        `sets.json.sets[${setIndex}].selection.include.objectiveIds`,
        'objective',
        diagnostics,
      )
      checkReferences(
        set.selection.exclude.itemIds,
        index.items,
        `sets.json.sets[${setIndex}].selection.exclude.itemIds`,
        'item',
        diagnostics,
      )
      checkReferences(
        set.selection.exclude.conceptIds,
        index.concepts,
        `sets.json.sets[${setIndex}].selection.exclude.conceptIds`,
        'concept',
        diagnostics,
      )
      checkReferences(
        set.selection.exclude.objectiveIds,
        index.objectives,
        `sets.json.sets[${setIndex}].selection.exclude.objectiveIds`,
        'objective',
        diagnostics,
      )
    }
  }

  if (pack.theme) {
    validateThemeAsset(
      pack.theme.iconAssetId,
      'theme.json.iconAssetId',
      index.assetIds,
      diagnostics,
    )
    validateThemeAsset(
      pack.theme.coverAssetId,
      'theme.json.coverAssetId',
      index.assetIds,
      diagnostics,
    )
  }
}

function validateConceptPrerequisiteCycles(
  catalog: CatalogDocument,
  diagnostics: LearningPackDiagnostic[],
): void {
  const graph = new Map(
    catalog.concepts.map((concept) => [
      concept.conceptId,
      concept.prerequisiteConceptIds,
    ]),
  )
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(conceptId: string, path: string[]): void {
    if (visiting.has(conceptId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.CONCEPT_PREREQUISITE_CYCLE,
          'error',
          'catalog.json.concepts',
          `Concept prerequisite cycle detected: ${[...path, conceptId].join(' -> ')}.`,
        ),
      )
      return
    }
    if (visited.has(conceptId)) {
      return
    }
    visiting.add(conceptId)
    for (const prerequisiteId of graph.get(conceptId) ?? []) {
      if (graph.has(prerequisiteId)) {
        visit(prerequisiteId, [...path, conceptId])
      }
    }
    visiting.delete(conceptId)
    visited.add(conceptId)
  }

  for (const concept of catalog.concepts) {
    visit(concept.conceptId, [])
  }
}

function validateLearningItems(
  items: ItemsDocument,
  diagnostics: LearningPackDiagnostic[],
  assetIds: ReadonlySet<string>,
): void {
  for (const [itemIndex, item] of items.items.entries()) {
    const path = `items.json.items[${itemIndex}]`
    validateResponseEvaluationPair(
      item.response,
      item.evaluation,
      path,
      diagnostics,
    )
    validateOptionIds(item, path, diagnostics)
    validateItemPlayModes(item, path, diagnostics)
    validateContentBlocks(
      item.promptBlocks,
      `${path}.promptBlocks`,
      assetIds,
      diagnostics,
    )
    validateContentBlocks(
      item.reviewedSolutionBlocks,
      `${path}.reviewedSolutionBlocks`,
      assetIds,
      diagnostics,
    )
    for (const [optionIndex, option] of item.response.options.entries()) {
      validateContentBlocks(
        option.contentBlocks,
        `${path}.response.options[${optionIndex}].contentBlocks`,
        assetIds,
        diagnostics,
      )
    }
  }
}

function validateMigrations(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
  index: EntityIndex,
): void {
  if (!pack.migrations) {
    return
  }

  for (const [
    migrationIndex,
    migration,
  ] of pack.migrations.migrations.entries()) {
    const path = `migrations.json.migrations[${migrationIndex}]`
    if (migration.toVersion !== pack.manifest.version) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
          'error',
          `${path}.toVersion`,
          'Migration toVersion must match pack.json version.',
        ),
      )
    }
    if (migration.fromVersion === migration.toVersion) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
          'error',
          `${path}.fromVersion`,
          'Migration fromVersion and toVersion must differ.',
        ),
      )
    }

    for (const [mappingIndex, mapping] of migration.entityMappings.entries()) {
      const mappingPath = `${path}.entityMappings[${mappingIndex}]`
      const targetIds = idsForEntityKind(mapping.entityKind, index)

      if (mapping.changeKind === 'removed') {
        if (mapping.toId !== null) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.toId`,
              'Removed mappings must set toId to null.',
            ),
          )
        }
        if (mapping.progressPolicy === 'preserve') {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.progressPolicy`,
              'Removed mappings cannot preserve current mastery.',
            ),
          )
        }
      } else if (mapping.toId === null) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
            'error',
            `${mappingPath}.toId`,
            `${mapping.changeKind} mappings must provide a toId.`,
          ),
        )
      }

      if (
        mapping.changeKind === 'unchanged' &&
        mapping.toId !== mapping.fromId
      ) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
            'error',
            `${mappingPath}.toId`,
            'Unchanged mappings must keep the same ID.',
          ),
        )
      }

      if (mapping.toId !== null && !targetIds.has(mapping.toId)) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
            'error',
            `${mappingPath}.toId`,
            `Migration target ${mapping.toId} does not exist in this pack.`,
          ),
        )
      }

      if (mapping.entityKind === 'item') {
        if (
          mapping.fromLearningRevision === null ||
          mapping.toLearningRevision === null ||
          mapping.fromLearningRevision < 1 ||
          mapping.toLearningRevision < 1
        ) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.toLearningRevision`,
              'Item mappings must include positive fromLearningRevision and toLearningRevision values.',
            ),
          )
        }
        if (
          mapping.progressPolicy === 'preserve' &&
          mapping.fromLearningRevision !== null &&
          mapping.toLearningRevision !== null &&
          !canPreserveMasteryAcrossRevision(
            mapping.fromLearningRevision,
            mapping.toLearningRevision,
          )
        ) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.progressPolicy`,
              'Item progress can be preserved only when learningRevision is unchanged.',
            ),
          )
        }
        if (
          mapping.toId !== null &&
          mapping.toLearningRevision !== null &&
          index.itemRevisions.get(mapping.toId) !== mapping.toLearningRevision
        ) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.toLearningRevision`,
              'Item mapping toLearningRevision must match the target item.',
            ),
          )
        }
      } else if (
        mapping.entityKind === 'resource' ||
        mapping.entityKind === 'resource-segment'
      ) {
        if (
          mapping.engagementPolicy !== undefined &&
          mapping.engagementPolicy !== null &&
          mapping.engagementPolicy === 'preserve' &&
          mapping.fromContentRevision !== undefined &&
          mapping.toContentRevision !== undefined &&
          mapping.fromContentRevision !== null &&
          mapping.toContentRevision !== null &&
          mapping.fromContentRevision !== mapping.toContentRevision
        ) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.engagementPolicy`,
              'Resource engagement can be preserved only when contentRevision is unchanged.',
            ),
          )
        }
        if (
          mapping.entityKind === 'resource-segment' &&
          (mapping.fromSegmentId === undefined ||
            mapping.fromSegmentId === null)
        ) {
          diagnostics.push(
            makeDiagnostic(
              LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
              'error',
              `${mappingPath}.fromSegmentId`,
              'Resource-segment mappings must include fromSegmentId.',
            ),
          )
        }
      } else if (
        mapping.fromLearningRevision !== null ||
        mapping.toLearningRevision !== null ||
        mapping.fromContentRevision !== undefined ||
        mapping.toContentRevision !== undefined ||
        mapping.engagementPolicy !== undefined ||
        mapping.fromSegmentId !== undefined ||
        mapping.toSegmentId !== undefined
      ) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.INVALID_MIGRATION_MAPPING,
            'error',
            `${mappingPath}.fromLearningRevision`,
            'Only item mappings may include learningRevision values, and only resource mappings may include contentRevision, segment, or engagementPolicy values.',
          ),
        )
      }
    }
  }
}

function addEntityId(
  kind: string,
  id: string,
  path: string,
  ownSet: Set<string>,
  allIds: Map<string, string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (!isValidLocalEntityId(id)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_ID,
        'error',
        path,
        `${kind} ID ${id} is not a valid local entity ID.`,
      ),
    )
  }
  if (ownSet.has(id) || allIds.has(id)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.DUPLICATE_ID,
        'error',
        path,
        `${kind} ID ${id} duplicates ${allIds.get(id) ?? 'another ID'}.`,
      ),
    )
  }
  ownSet.add(id)
  allIds.set(id, path)
}

function addScopedId(
  kind: string,
  id: string,
  path: string,
  ownSet: Set<string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (!isValidLocalEntityId(id)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_ID,
        'error',
        path,
        `${kind} ID ${id} is not a valid local entity ID.`,
      ),
    )
  }
  if (ownSet.has(id)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.DUPLICATE_ID,
        'error',
        path,
        `${kind} ID ${id} is duplicated within its parent scope.`,
      ),
    )
  }
  ownSet.add(id)
}

function checkPackId(
  packId: string,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (!isValidPackId(packId)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_PACK_ID,
        'error',
        path,
        `${packId} is not a valid packId.`,
      ),
    )
  }
}

function traverseCurriculumNode(
  node: CurriculumNode,
  path: string,
  parentId: string | null,
  ancestry: string[],
  index: EntityIndex,
  allIds: Map<string, string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (ancestry.includes(node.nodeId)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.CURRICULUM_CYCLE,
        'error',
        `${path}.nodeId`,
        `Curriculum cycle detected: ${[...ancestry, node.nodeId].join(' -> ')}.`,
      ),
    )
  }

  if (index.nodes.has(node.nodeId)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_CURRICULUM_PARENT,
        'error',
        `${path}.nodeId`,
        `Curriculum node ${node.nodeId} appears under more than one parent.`,
      ),
    )
  }

  addEntityId(
    'curriculum node',
    node.nodeId,
    `${path}.nodeId`,
    index.nodes,
    allIds,
    diagnostics,
  )

  if (
    node.kind === 'custom' &&
    (!node.customKindLabel || node.customKindLabel.trim() === '')
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_CURRICULUM_PARENT,
        'error',
        `${path}.customKindLabel`,
        'Custom curriculum nodes must provide customKindLabel.',
      ),
    )
  }
  if (node.kind !== 'custom' && node.customKindLabel !== null) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_CURRICULUM_PARENT,
        'error',
        `${path}.customKindLabel`,
        'Non-custom curriculum nodes must set customKindLabel to null.',
      ),
    )
  }

  const nextAncestry = [...ancestry, node.nodeId]
  for (const [childIndex, child] of node.children.entries()) {
    traverseCurriculumNode(
      child,
      `${path}.children[${childIndex}]`,
      node.nodeId,
      nextAncestry,
      index,
      allIds,
      diagnostics,
    )
  }
  void parentId
}

function validateNodeReferences(
  node: CurriculumNode,
  path: string,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  checkReferences(
    node.itemIds,
    index.items,
    `${path}.itemIds`,
    'item',
    diagnostics,
  )
  checkReferences(
    node.conceptIds,
    index.concepts,
    `${path}.conceptIds`,
    'concept',
    diagnostics,
  )
  checkReferences(
    node.objectiveIds,
    index.objectives,
    `${path}.objectiveIds`,
    'objective',
    diagnostics,
  )
  validateCurriculumEntries(node, path, index, diagnostics)
  for (const [childIndex, child] of node.children.entries()) {
    validateNodeReferences(
      child,
      `${path}.children[${childIndex}]`,
      index,
      diagnostics,
    )
  }
}

function validateCurriculumEntries(
  node: CurriculumNode,
  path: string,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  const seen = new Set<string>()
  for (const [entryIndex, entry] of (node.entries ?? []).entries()) {
    const entryPath = `${path}.entries[${entryIndex}]`
    const key = JSON.stringify(entry)
    if (seen.has(key)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CURRICULUM_ENTRY,
          'error',
          entryPath,
          'Curriculum entries must not contain duplicate identical targets within the same node.',
        ),
      )
    }
    seen.add(key)

    if (entry.kind === 'child-node') {
      if (!index.nodes.has(entry.nodeId)) {
        diagnostics.push(
          missingReferenceDiagnostic(
            `${entryPath}.nodeId`,
            'curriculum node',
            entry.nodeId,
          ),
        )
      }
      if (entry.nodeId === node.nodeId) {
        diagnostics.push(
          makeDiagnostic(
            LearningPackErrorCode.CURRICULUM_CYCLE,
            'error',
            `${entryPath}.nodeId`,
            `Curriculum entry creates a self-cycle for node ${node.nodeId}.`,
          ),
        )
      }
    } else if (entry.kind === 'resource') {
      validateResourceTarget(
        entry.resourceId,
        entry.segmentId,
        `${entryPath}.resourceId`,
        index,
        diagnostics,
      )
    } else if (entry.kind === 'item') {
      if (!index.items.has(entry.itemId)) {
        diagnostics.push(
          missingReferenceDiagnostic(
            `${entryPath}.itemId`,
            'item',
            entry.itemId,
          ),
        )
      }
    } else if (!index.sets.has(entry.studySetId)) {
      diagnostics.push(
        missingReferenceDiagnostic(
          `${entryPath}.studySetId`,
          'StudySet',
          entry.studySetId,
        ),
      )
    }
  }
}

function validateResourceLinks(
  links: readonly ResourceLink[],
  path: string,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  const seen = new Set<string>()
  for (const [linkIndex, link] of links.entries()) {
    const linkPath = `${path}[${linkIndex}]`
    const key = `${link.resourceId}:${link.segmentId ?? ''}:${link.role}:${link.recommendedUse ?? ''}`
    if (seen.has(key)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_RESOURCE_LINK,
          'error',
          linkPath,
          'Resource links must not contain duplicate semantically identical links.',
        ),
      )
    }
    seen.add(key)
    validateResourceTarget(
      link.resourceId,
      link.segmentId,
      `${linkPath}.resourceId`,
      index,
      diagnostics,
    )
  }
}

function validateResourceTarget(
  resourceId: string,
  segmentId: string | undefined,
  path: string,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (!index.resources.has(resourceId)) {
    diagnostics.push(missingReferenceDiagnostic(path, 'resource', resourceId))
    return
  }
  if (
    segmentId !== undefined &&
    !index.resourceSegments.get(resourceId)?.has(segmentId)
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.MISSING_REFERENCE,
        'error',
        path.replace(/resourceId$/, 'segmentId'),
        `Missing resource segment reference: ${resourceId}#${segmentId}.`,
      ),
    )
  }
}

function validateResources(
  pack: LearningPackDocuments,
  diagnostics: LearningPackDiagnostic[],
  index: EntityIndex,
): void {
  if (!pack.resources) {
    return
  }

  for (const [resourceIndex, resource] of pack.resources.resources.entries()) {
    const path = `resources.json.resources[${resourceIndex}]`
    validateResource(resource, path, pack.manifest, index, diagnostics)
  }
}

function validateResource(
  resource: LearningResource,
  path: string,
  manifest: LearningPackManifest,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (
    !Number.isInteger(resource.contentRevision) ||
    resource.contentRevision < 1
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_SOURCE,
        'error',
        `${path}.contentRevision`,
        'contentRevision must be a positive integer.',
      ),
    )
  }
  checkReferences(
    resource.conceptIds ?? [],
    index.concepts,
    `${path}.conceptIds`,
    'concept',
    diagnostics,
  )
  checkReferences(
    resource.objectiveIds ?? [],
    index.objectives,
    `${path}.objectiveIds`,
    'objective',
    diagnostics,
  )
  checkReferences(
    resource.checkpointStudySetIds ?? [],
    index.sets,
    `${path}.checkpointStudySetIds`,
    'StudySet',
    diagnostics,
  )
  validateResourceSource(resource, path, manifest, index, diagnostics)
  validateResourceSegments(resource, path, index, diagnostics)
  validateResourceProvenance(resource, path, diagnostics)
}

function validateResourceSource(
  resource: LearningResource,
  path: string,
  manifest: LearningPackManifest,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  const source = resource.source
  if (source.kind === 'embedded-content') {
    validateContentBlocks(
      source.content,
      `${path}.source.content`,
      index.assetIds,
      diagnostics,
    )
    return
  }

  if (
    source.kind === 'external-link' ||
    source.kind === 'interactive-reference'
  ) {
    validateHttpsUrl(source.url, `${path}.source.url`, diagnostics)
    return
  }

  if (source.kind === 'external-video') {
    if (source.canonicalUrl !== undefined) {
      validateHttpsUrl(
        source.canonicalUrl,
        `${path}.source.canonicalUrl`,
        diagnostics,
      )
    }
    validateTimestampRange(
      source.startSeconds,
      source.endSeconds,
      `${path}.source`,
      diagnostics,
    )
    return
  }

  if (source.kind === 'external-audio') {
    validateHttpsUrl(
      source.canonicalUrl,
      `${path}.source.canonicalUrl`,
      diagnostics,
    )
    validateTimestampRange(
      source.startSeconds,
      source.endSeconds,
      `${path}.source`,
      diagnostics,
    )
    return
  }

  if (source.kind === 'pack-asset') {
    validatePackAssetSource(
      source,
      `${path}.source`,
      manifest,
      index.manifestFilesByAssetId,
      diagnostics,
    )
    return
  }

  if (
    source.kind === 'bibliographic-reference' &&
    source.canonicalUrl !== undefined
  ) {
    validateHttpsUrl(
      source.canonicalUrl,
      `${path}.source.canonicalUrl`,
      diagnostics,
    )
  }
}

const packAssetExtensionsByMediaType = new Map<string, readonly string[]>([
  ['application/x-ipynb+json', ['.ipynb']],
  ['text/x-python', ['.py']],
  ['text/csv', ['.csv']],
  ['text/markdown', ['.md']],
  ['text/plain', ['.txt']],
  ['application/yaml', ['.yml', '.yaml']],
])

function validatePackAssetSource(
  source: Extract<LearningResource['source'], { kind: 'pack-asset' }>,
  path: string,
  manifest: LearningPackManifest,
  manifestFilesByAssetId: ReadonlyMap<string, PackFileManifestEntry>,
  diagnostics: LearningPackDiagnostic[],
): void {
  const requiredCapability = manifest.capabilities.required.some(
    (capability) =>
      capability.capabilityId === 'learning-resource.pack-asset' &&
      capability.version === '1',
  )
  if (!requiredCapability) {
    invalidPackAssetSource(
      diagnostics,
      path,
      'Pack-asset resources require learning-resource.pack-asset@1.',
    )
  }

  const manifestEntry = manifestFilesByAssetId.get(source.assetId)
  if (manifestEntry === undefined) {
    invalidPackAssetSource(
      diagnostics,
      `${path}.assetId`,
      `Pack asset ${source.assetId} is not declared in the manifest.`,
    )
  } else {
    if (manifestEntry.role !== 'asset') {
      invalidPackAssetSource(
        diagnostics,
        `${path}.assetId`,
        `Manifest entry ${source.assetId} must have role asset.`,
      )
    }
    if (manifestEntry.mediaType !== source.mediaType) {
      invalidPackAssetSource(
        diagnostics,
        `${path}.mediaType`,
        `Resource media type ${source.mediaType} does not match manifest media type ${manifestEntry.mediaType}.`,
      )
    }
  }

  const allowedExtensions = packAssetExtensionsByMediaType.get(source.mediaType)
  if (allowedExtensions === undefined) {
    invalidPackAssetSource(
      diagnostics,
      `${path}.mediaType`,
      `Media type ${source.mediaType} is not allowed for pack-asset resources.`,
    )
    return
  }

  const fileName = source.suggestedFileName
  const trimmedFileName = fileName.trim()
  const characterCount = Array.from(trimmedFileName).length
  if (characterCount < 1 || characterCount > 128) {
    invalidPackAssetSource(
      diagnostics,
      `${path}.suggestedFileName`,
      'suggestedFileName must contain 1 to 128 characters after trimming.',
    )
    return
  }
  if (
    trimmedFileName === '.' ||
    trimmedFileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    /[\u0000-\u001f\u007f]/u.test(fileName) ||
    /[. ]$/u.test(fileName)
  ) {
    invalidPackAssetSource(
      diagnostics,
      `${path}.suggestedFileName`,
      'suggestedFileName must be a safe basename without path separators, control characters, or a trailing dot or space.',
    )
    return
  }

  const lowerFileName = fileName.toLowerCase()
  if (!allowedExtensions.some((extension) => lowerFileName.endsWith(extension))) {
    invalidPackAssetSource(
      diagnostics,
      `${path}.suggestedFileName`,
      `suggestedFileName must use ${allowedExtensions.join(' or ')} for media type ${source.mediaType}.`,
    )
  }
}

function invalidPackAssetSource(
  diagnostics: LearningPackDiagnostic[],
  path: string,
  message: string,
): void {
  diagnostics.push(
    makeDiagnostic(
      LearningPackErrorCode.INVALID_RESOURCE_SOURCE,
      'error',
      path,
      message,
    ),
  )
}

function validateResourceSegments(
  resource: LearningResource,
  path: string,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  const contentBlockIds =
    resource.source.kind === 'embedded-content'
      ? new Set(
          resource.source.content.flatMap((block) =>
            block.blockId ? [block.blockId] : [],
          ),
        )
      : new Set<string>()

  for (const [segmentIndex, segment] of (resource.segments ?? []).entries()) {
    const segmentPath = `${path}.segments[${segmentIndex}]`
    validateResourceSegment(
      segment,
      segmentPath,
      resource,
      contentBlockIds,
      index,
      diagnostics,
    )
  }
}

function validateResourceSegment(
  segment: ResourceSegment,
  path: string,
  resource: LearningResource,
  contentBlockIds: ReadonlySet<string>,
  index: EntityIndex,
  diagnostics: LearningPackDiagnostic[],
): void {
  validateTimestampRange(
    segment.startSeconds,
    segment.endSeconds,
    path,
    diagnostics,
  )
  if (
    resource.estimatedDurationSeconds !== undefined &&
    segment.endSeconds !== undefined &&
    segment.endSeconds > resource.estimatedDurationSeconds
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_SEGMENT,
        'error',
        `${path}.endSeconds`,
        'Segment endSeconds must not exceed estimatedDurationSeconds when duration metadata is declared.',
      ),
    )
  }
  if (
    segment.contentBlockStartId !== undefined &&
    !contentBlockIds.has(segment.contentBlockStartId)
  ) {
    diagnostics.push(
      missingReferenceDiagnostic(
        `${path}.contentBlockStartId`,
        'ContentBlock',
        segment.contentBlockStartId,
      ),
    )
  }
  if (
    segment.contentBlockEndId !== undefined &&
    !contentBlockIds.has(segment.contentBlockEndId)
  ) {
    diagnostics.push(
      missingReferenceDiagnostic(
        `${path}.contentBlockEndId`,
        'ContentBlock',
        segment.contentBlockEndId,
      ),
    )
  }
  checkReferences(
    segment.conceptIds,
    index.concepts,
    `${path}.conceptIds`,
    'concept',
    diagnostics,
  )
  checkReferences(
    segment.objectiveIds,
    index.objectives,
    `${path}.objectiveIds`,
    'objective',
    diagnostics,
  )
  checkReferences(
    segment.checkpointStudySetIds,
    index.sets,
    `${path}.checkpointStudySetIds`,
    'StudySet',
    diagnostics,
  )
}

function validateResourceProvenance(
  resource: LearningResource,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  const provenance = resource.provenance
  if (!provenance) {
    return
  }
  if (provenance.licenseUrl !== undefined) {
    validateHttpsUrl(
      provenance.licenseUrl,
      `${path}.provenance.licenseUrl`,
      diagnostics,
    )
  }
  if (provenance.canonicalUrl !== undefined) {
    validateHttpsUrl(
      provenance.canonicalUrl,
      `${path}.provenance.canonicalUrl`,
      diagnostics,
    )
  }
  if (
    resource.source.kind === 'embedded-content' &&
    provenance.contentOwnership === 'external-link-only'
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_PROVENANCE,
        'warning',
        `${path}.provenance.contentOwnership`,
        'Embedded content should not be marked external-link-only.',
      ),
    )
  }
  if (
    provenance.license !== undefined &&
    /cc-by|attribution/i.test(provenance.license) &&
    provenance.attributionText === undefined
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_PROVENANCE,
        'warning',
        `${path}.provenance.attributionText`,
        'License metadata appears to require attribution, but attributionText is absent.',
      ),
    )
  }
  if (
    (resource.source.kind === 'external-video' ||
      resource.source.kind === 'external-audio' ||
      resource.source.kind === 'external-link') &&
    provenance.contentOwnership === 'pack-authored'
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_PROVENANCE,
        'warning',
        `${path}.provenance.contentOwnership`,
        'Externally hosted material should not usually be marked pack-authored.',
      ),
    )
  }
}

function validateHttpsUrl(
  value: string,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_URL,
          'error',
          path,
          'Learning resource URLs must use https.',
        ),
      )
    }
  } catch {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_URL,
        'error',
        path,
        'Learning resource URL is not a valid URL.',
      ),
    )
  }
}

function validateTimestampRange(
  startSeconds: number | undefined,
  endSeconds: number | undefined,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (startSeconds !== undefined && startSeconds < 0) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_SEGMENT,
        'error',
        `${path}.startSeconds`,
        'startSeconds must be nonnegative.',
      ),
    )
  }
  if (endSeconds !== undefined && endSeconds < 0) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_SEGMENT,
        'error',
        `${path}.endSeconds`,
        'endSeconds must be nonnegative.',
      ),
    )
  }
  if (
    startSeconds !== undefined &&
    endSeconds !== undefined &&
    endSeconds <= startSeconds
  ) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESOURCE_SEGMENT,
        'error',
        `${path}.endSeconds`,
        'endSeconds must be greater than startSeconds.',
      ),
    )
  }
}

function checkReferences(
  ids: readonly string[],
  validIds: ReadonlySet<string>,
  path: string,
  targetKind: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  for (const [index, id] of ids.entries()) {
    if (!validIds.has(id)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.MISSING_REFERENCE,
          'error',
          `${path}[${index}]`,
          `Missing ${targetKind} reference: ${id}.`,
        ),
      )
    }
  }
}

function missingReferenceDiagnostic(
  path: string,
  targetKind: string,
  id: string,
): LearningPackDiagnostic {
  return makeDiagnostic(
    LearningPackErrorCode.MISSING_REFERENCE,
    'error',
    path,
    `Missing ${targetKind} reference: ${id}.`,
  )
}

function validateContentBlockReferences(
  blocks: readonly ContentBlock[],
  path: string,
  assetIds: ReadonlySet<string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  for (const [blockIndex, block] of blocks.entries()) {
    if (block.assetId !== null && !assetIds.has(block.assetId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.MISSING_REFERENCE,
          'error',
          `${path}[${blockIndex}].assetId`,
          `Missing asset reference: ${block.assetId}.`,
        ),
      )
    }
  }
}

function validateThemeAsset(
  assetId: string | null,
  path: string,
  assetIds: ReadonlySet<string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  if (assetId !== null && !assetIds.has(assetId)) {
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_THEME_ASSET_REFERENCE,
        'error',
        path,
        `Theme references missing asset ${assetId}.`,
      ),
    )
  }
}

function validateResponseEvaluationPair(
  response: ResponseDefinition,
  evaluation: EvaluationDefinition,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  const error = (message: string) =>
    diagnostics.push(
      makeDiagnostic(
        LearningPackErrorCode.INVALID_RESPONSE_EVALUATION_PAIR,
        'error',
        `${path}.evaluation`,
        message,
      ),
    )

  if (response.kind === 'none' && evaluation.kind !== 'manual-completion') {
    error('none responses require manual-completion evaluation.')
  }
  if (response.kind === 'single-choice') {
    if (
      evaluation.kind !== 'choice-selection' ||
      evaluation.correctOptionIds.length !== 1
    ) {
      error(
        'single-choice responses require choice-selection with exactly one correct option.',
      )
    }
  }
  if (response.kind === 'multiple-choice') {
    if (
      evaluation.kind !== 'choice-selection' ||
      evaluation.correctOptionIds.length < 1
    ) {
      error(
        'multiple-choice responses require choice-selection with at least one correct option.',
      )
    }
  }
  if (response.kind === 'text') {
    if (
      evaluation.kind !== 'exact-text' ||
      evaluation.acceptedAnswers.length < 1
    ) {
      error(
        'text responses require exact-text evaluation with at least one accepted answer.',
      )
    }
  }
  if (response.kind === 'number') {
    if (
      evaluation.kind !== 'numerical-tolerance' ||
      evaluation.expectedNumber === null ||
      evaluation.absoluteTolerance === null
    ) {
      error(
        'number responses require numerical-tolerance evaluation with expectedNumber and absoluteTolerance.',
      )
    }
  }
  if (response.kind === 'self-grade') {
    if (
      evaluation.kind !== 'self-grade' ||
      evaluation.passingSelfGrades.length < 1
    ) {
      error(
        'self-grade responses require self-grade evaluation with passing grades.',
      )
    }
  }
}

function validateOptionIds(
  item: LearningItem,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  const optionIds = new Set<string>()
  for (const [optionIndex, option] of item.response.options.entries()) {
    if (optionIds.has(option.optionId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.DUPLICATE_OPTION_ID,
          'error',
          `${path}.response.options[${optionIndex}].optionId`,
          `Option ID ${option.optionId} is duplicated within item ${item.itemId}.`,
        ),
      )
    }
    optionIds.add(option.optionId)
  }

  for (const [
    correctIndex,
    correctOptionId,
  ] of item.evaluation.correctOptionIds.entries()) {
    if (!optionIds.has(correctOptionId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_ANSWER_OPTION_REFERENCE,
          'error',
          `${path}.evaluation.correctOptionIds[${correctIndex}]`,
          `Correct option ${correctOptionId} is not defined in response.options.`,
        ),
      )
    }
  }
}

function validateItemPlayModes(
  item: LearningItem,
  path: string,
  diagnostics: LearningPackDiagnostic[],
): void {
  for (const playMode of item.allowedPlayModes) {
    if (
      isQuizLikePlayMode(playMode) &&
      !hasDeterministicEvaluatorForMode(item, playMode)
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_PLAY_MODE_EVALUATOR,
          'error',
          `${path}.allowedPlayModes`,
          `${playMode} requires a deterministic response/evaluation pair.`,
        ),
      )
    }
    if (playMode === 'flashcard' && !hasUsableSolution(item)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.FLASHCARD_MISSING_SOLUTION,
          'error',
          `${path}.reviewedSolutionBlocks`,
          'flashcard mode requires at least one usable reviewed solution block.',
        ),
      )
    }
  }
}

function validateContentBlocks(
  blocks: readonly ContentBlock[],
  path: string,
  assetIds: ReadonlySet<string>,
  diagnostics: LearningPackDiagnostic[],
): void {
  for (const [blockIndex, block] of blocks.entries()) {
    const blockPath = `${path}[${blockIndex}]`
    if (
      ['text', 'question', 'code', 'equation', 'callout'].includes(
        block.kind,
      ) &&
      block.text.trim() === ''
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.text`,
          `${block.kind} blocks require non-empty text.`,
        ),
      )
    }
    if (
      block.kind === 'code' &&
      (!block.language || block.language.trim() === '')
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.language`,
          'code blocks require a language.',
        ),
      )
    }
    if (block.kind !== 'code' && block.language !== null) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.language`,
          'Only code blocks may set language.',
        ),
      )
    }
    if (block.kind === 'callout' && block.calloutRole === null) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.calloutRole`,
          'callout blocks require calloutRole.',
        ),
      )
    }
    if (block.kind !== 'callout' && block.calloutRole !== null) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.calloutRole`,
          'Only callout blocks may set calloutRole.',
        ),
      )
    }
    if (
      (block.kind === 'image' || block.kind === 'audio') &&
      block.assetId === null
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.assetId`,
          `${block.kind} blocks require assetId.`,
        ),
      )
    }
    if (
      block.kind === 'image' &&
      (!block.altText || block.altText.trim() === '')
    ) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.INVALID_CONTENT_BLOCK,
          'error',
          `${blockPath}.altText`,
          'image blocks require altText.',
        ),
      )
    }
    if (block.assetId !== null && !assetIds.has(block.assetId)) {
      diagnostics.push(
        makeDiagnostic(
          LearningPackErrorCode.MISSING_REFERENCE,
          'error',
          `${blockPath}.assetId`,
          `Missing asset reference: ${block.assetId}.`,
        ),
      )
    }
  }
}

function isQuizLikePlayMode(playMode: PlayMode): boolean {
  return (
    playMode === 'single-choice-quiz' ||
    playMode === 'multiple-choice-quiz' ||
    playMode === 'text-recall' ||
    playMode === 'number-recall'
  )
}

function hasDeterministicEvaluatorForMode(
  item: LearningItem,
  playMode: PlayMode,
): boolean {
  if (playMode === 'single-choice-quiz') {
    return (
      item.response.kind === 'single-choice' &&
      item.evaluation.kind === 'choice-selection' &&
      item.evaluation.correctOptionIds.length === 1
    )
  }
  if (playMode === 'multiple-choice-quiz') {
    return (
      item.response.kind === 'multiple-choice' &&
      item.evaluation.kind === 'choice-selection' &&
      item.evaluation.correctOptionIds.length >= 1
    )
  }
  if (playMode === 'text-recall') {
    return (
      item.response.kind === 'text' &&
      item.evaluation.kind === 'exact-text' &&
      item.evaluation.acceptedAnswers.length >= 1
    )
  }
  if (playMode === 'number-recall') {
    return (
      item.response.kind === 'number' &&
      item.evaluation.kind === 'numerical-tolerance' &&
      item.evaluation.expectedNumber !== null &&
      item.evaluation.absoluteTolerance !== null
    )
  }
  return false
}

function hasUsableSolution(item: LearningItem): boolean {
  return item.reviewedSolutionBlocks.some((block) => {
    if (block.kind === 'image' || block.kind === 'audio') {
      return block.assetId !== null
    }
    return block.text.trim().length > 0
  })
}

function idsForEntityKind(
  kind: MigrationEntityKind,
  index: EntityIndex,
): ReadonlySet<string> {
  switch (kind) {
    case 'subject':
      return index.subjects
    case 'course':
      return index.courses
    case 'curriculum-node':
      return index.nodes
    case 'concept':
      return index.concepts
    case 'objective':
      return index.objectives
    case 'item':
      return index.items
    case 'set':
      return index.sets
    case 'resource':
      return index.resources
    case 'resource-segment':
      return new Set(
        [...index.resourceSegments.values()].flatMap((ids) => [...ids]),
      )
  }
}
