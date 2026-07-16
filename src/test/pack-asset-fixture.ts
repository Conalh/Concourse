import { createHash } from 'node:crypto'

import { createValidLearningPackFixture } from '@learnt/learning-pack-contracts'
import {
  canonicalizePackFilesForPacking,
  stableJsonBytes,
  type PackFileRecord,
} from '@learnt/learning-pack-sdk'
import { loadLearningPackFromFilesAsync } from '@learnt/learning-pack-sdk/browser'

import type { InstalledLearningPackRelease } from '../learning-packs/installed-learning-pack-ports'
import { installLearningPackDocuments } from '../learning-packs/learnt-importer'

export const packAssetBytes = new TextEncoder().encode(
  '{"cells":[],"nbformat":4}',
)
export const packAssetSha256 = createHash('sha256')
  .update(packAssetBytes)
  .digest('hex')
export const packAssetCsvBytes = new TextEncoder().encode(
  'feature_a,feature_b,target\n1,2,0\n3,4,1\n',
)
export const packAssetCsvSha256 = createHash('sha256')
  .update(packAssetCsvBytes)
  .digest('hex')

export function createPackAssetTestFixture() {
  const documents = createValidLearningPackFixture()
  documents.manifest.packId = 'learnt.pack-asset-fixture'
  const subject = documents.catalog.subjects[0]
  const course = documents.courses.courses[0]
  if (subject === undefined || course === undefined) {
    throw new Error('Pack-asset fixture requires one subject and one course.')
  }
  subject.subjectId = 'pack-asset-fixture'
  subject.title = 'Pack Asset Fixture'
  course.subjectIds = ['pack-asset-fixture']
  documents.manifest.capabilities.required.push({
    capabilityId: 'learning-resource.pack-asset',
    version: '1',
  })
  documents.manifest.files.push(
    {
      assetId: null,
      path: 'resources.json',
      role: 'resources',
      mediaType: 'application/json',
      sha256: '0'.repeat(64),
      bytes: 100,
    },
    {
      assetId: 'lab-01-notebook',
      path: 'assets/labs/module-01-lab.ipynb',
      role: 'asset',
      mediaType: 'application/x-ipynb+json',
      sha256: packAssetSha256,
      bytes: packAssetBytes.byteLength,
    },
    {
      assetId: 'lab-01-data',
      path: 'assets/labs/module-01-data.csv',
      role: 'asset',
      mediaType: 'text/csv',
      sha256: packAssetCsvSha256,
      bytes: packAssetCsvBytes.byteLength,
    },
  )
  documents.resources = {
    schemaVersion: '0.1',
    resources: [
      {
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
        },
      },
      {
        id: 'resource-lab-01-data',
        contentRevision: 1,
        title: 'Module 1 sample data',
        modality: 'interactive',
        roles: ['worked-example'],
        source: {
          kind: 'pack-asset',
          assetId: 'lab-01-data',
          suggestedFileName: 'module-01-data.csv',
          mediaType: 'text/csv',
        },
      },
    ],
  }

  const installedPack = installLearningPackDocuments(documents)
  const activeRelease: InstalledLearningPackRelease = {
    releaseId: 'release-1',
    packVersion: documents.manifest.version,
    contentHash: 'content-hash-1',
    documents,
    files: [
      {
        path: 'assets/labs/module-01-lab.ipynb',
        bytes: packAssetBytes,
        sha256: packAssetSha256,
        size: packAssetBytes.byteLength,
      },
      {
        path: 'assets/labs/module-01-data.csv',
        bytes: packAssetCsvBytes,
        sha256: packAssetCsvSha256,
        size: packAssetCsvBytes.byteLength,
      },
    ],
  }

  return { documents, installedPack, activeRelease }
}

export async function createPersistedPackAssetTestFixture() {
  const fixture = createPackAssetTestFixture()
  const { documents } = fixture
  const sourceFiles = [
    file('pack.json', stableJsonBytes(documents.manifest)),
    file('catalog.json', stableJsonBytes(documents.catalog)),
    file('courses.json', stableJsonBytes(documents.courses)),
    file('items.json', stableJsonBytes(documents.items)),
    file('sets.json', stableJsonBytes(documents.sets)),
    file('resources.json', stableJsonBytes(documents.resources)),
    file('assets/labs/module-01-lab.ipynb', packAssetBytes),
    file('assets/labs/module-01-data.csv', packAssetCsvBytes),
    file('assets/cover.png', new Uint8Array([137, 80, 78, 71])),
  ]
  const canonical = canonicalizePackFilesForPacking(sourceFiles)
  if (!('documents' in canonical)) {
    throw new Error('Could not canonicalize persisted pack-asset fixture.')
  }
  const loaded = await loadLearningPackFromFilesAsync(
    'memory',
    documents.manifest.packId,
    canonical.files,
  )
  if (!('documents' in loaded)) {
    throw new Error('Could not load persisted pack-asset fixture.')
  }

  return {
    documents: loaded.documents,
    installedPack: installLearningPackDocuments(loaded.documents),
    activeRelease: {
      releaseId: loaded.contentHash,
      packVersion: loaded.documents.manifest.version,
      contentHash: loaded.contentHash,
      documents: loaded.documents,
      files: loaded.files,
    } satisfies InstalledLearningPackRelease,
  }
}

function file(path: string, bytes: Uint8Array): PackFileRecord {
  return { path, bytes, sha256: '', size: bytes.byteLength }
}
