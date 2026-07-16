import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js'
import * as addFormatsModule from 'ajv-formats'
import {
  catalogSchema,
  coursesSchema,
  itemsSchema,
  migrationsSchema,
  packManifestSchema,
  resourceEngagementEventSchema,
  resourcesSchema,
  reviewEventSchema,
  setsSchema,
  themeSchema,
  type JsonSchema,
} from './schemas.js'
import {
  LearningPackErrorCode,
  hasBlockingDiagnostics,
  makeDiagnostic,
  type LearningPackDiagnostic,
  type ValidationResult,
} from './errors.js'
import type {
  CatalogDocument,
  CoursesDocument,
  ItemsDocument,
  LearningPackManifest,
  MigrationsDocument,
  ResourceEngagementEvent,
  ResourcesDocument,
  ReviewEvent,
  SetsDocument,
  ThemeMetadata,
} from './types.js'

export type PublicJsonFileKind =
  | 'pack'
  | 'catalog'
  | 'courses'
  | 'items'
  | 'sets'
  | 'resources'
  | 'theme'
  | 'migrations'
  | 'reviewEvent'
  | 'resourceEngagementEvent'

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
})

const addFormats = addFormatsModule.default as unknown as (
  instance: Ajv2020,
) => void
addFormats(ajv)

const validators: Record<PublicJsonFileKind, ValidateFunction> = {
  pack: ajv.compile(packManifestSchema),
  catalog: ajv.compile(catalogSchema),
  courses: ajv.compile(coursesSchema),
  items: ajv.compile(itemsSchema),
  sets: ajv.compile(setsSchema),
  resources: ajv.compile(resourcesSchema),
  theme: ajv.compile(themeSchema),
  migrations: ajv.compile(migrationsSchema),
  reviewEvent: ajv.compile(reviewEventSchema),
  resourceEngagementEvent: ajv.compile(resourceEngagementEventSchema),
}

export interface StructuralValidationOptions {
  path?: string
}

type PublicJsonFileValue<K extends PublicJsonFileKind> = K extends 'pack'
  ? LearningPackManifest
  : K extends 'catalog'
    ? CatalogDocument
    : K extends 'courses'
      ? CoursesDocument
      : K extends 'items'
        ? ItemsDocument
        : K extends 'sets'
          ? SetsDocument
          : K extends 'resources'
            ? ResourcesDocument
            : K extends 'theme'
              ? ThemeMetadata
              : K extends 'migrations'
                ? MigrationsDocument
                : K extends 'reviewEvent'
                  ? ReviewEvent
                  : ResourceEngagementEvent

export function validateJsonFile<K extends PublicJsonFileKind>(
  kind: K,
  value: unknown,
  options: StructuralValidationOptions = {},
): ValidationResult<PublicJsonFileValue<K>> {
  const validate = validators[kind]
  const isValid = validate(value)
  const diagnostics = isValid
    ? []
    : diagnosticsFromAjvErrors(validate.errors ?? [], options.path ?? kind)

  return {
    ok: !hasBlockingDiagnostics(diagnostics),
    value:
      diagnostics.length === 0 ? (value as PublicJsonFileValue<K>) : undefined,
    diagnostics,
  }
}

export function getJsonSchema(kind: PublicJsonFileKind): JsonSchema {
  switch (kind) {
    case 'pack':
      return packManifestSchema
    case 'catalog':
      return catalogSchema
    case 'courses':
      return coursesSchema
    case 'items':
      return itemsSchema
    case 'sets':
      return setsSchema
    case 'resources':
      return resourcesSchema
    case 'theme':
      return themeSchema
    case 'migrations':
      return migrationsSchema
    case 'reviewEvent':
      return reviewEventSchema
    case 'resourceEngagementEvent':
      return resourceEngagementEventSchema
  }
}

function diagnosticsFromAjvErrors(
  errors: readonly ErrorObject[],
  rootPath: string,
): LearningPackDiagnostic[] {
  return errors.map((error) => {
    const path = `${rootPath}${error.instancePath}`
    const field =
      error.params && 'missingProperty' in error.params
        ? `.${String(error.params.missingProperty)}`
        : ''
    return makeDiagnostic(
      LearningPackErrorCode.STRUCTURE_INVALID,
      'error',
      path + field,
      error.message ?? 'JSON file does not match the learning pack schema.',
    )
  })
}
