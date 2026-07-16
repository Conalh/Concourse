export const SCHEMA_VERSION = '0.1' as const

export const SUPPORTED_CAPABILITIES = [
  { capabilityId: 'core.learning-pack', version: SCHEMA_VERSION },
  { capabilityId: 'theme.metadata', version: SCHEMA_VERSION },
  { capabilityId: 'migrations.basic', version: SCHEMA_VERSION },
  { capabilityId: 'assets.static', version: SCHEMA_VERSION },
  { capabilityId: 'learning-resource.embedded-content', version: '1' },
  { capabilityId: 'learning-resource.external-link', version: '1' },
  { capabilityId: 'learning-resource.external-video', version: '1' },
  { capabilityId: 'learning-resource.external-audio', version: '1' },
  { capabilityId: 'learning-resource.bibliographic-reference', version: '1' },
  { capabilityId: 'learning-resource.interactive-reference', version: '1' },
  { capabilityId: 'learning-resource.pack-asset', version: '1' },
  { capabilityId: 'learning-resource.segments', version: '1' },
  { capabilityId: 'learning-resource.checkpoints', version: '1' },
  { capabilityId: 'curriculum.ordered-resource-entries', version: '1' },
] as const

export const PUBLIC_JSON_FILE_PATHS = [
  'pack.json',
  'catalog.json',
  'courses.json',
  'items.json',
  'sets.json',
  'resources.json',
  'theme.json',
  'migrations.json',
] as const

export const REQUIRED_JSON_FILE_PATHS = [
  'pack.json',
  'catalog.json',
  'courses.json',
  'items.json',
  'sets.json',
] as const
