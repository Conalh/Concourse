import { createHash } from 'node:crypto'

import { createValidLearningPackFixture } from '@learnt/learning-pack-contracts'

import type { InstalledLearningPackRelease } from '../learning-packs/installed-learning-pack-ports'
import { installLearningPackDocuments } from '../learning-packs/learnt-importer'

export const packAssetBytes = new TextEncoder().encode(
  '{"cells":[],"nbformat":4}',
)
export const packAssetSha256 = createHash('sha256')
  .update(packAssetBytes)
  .digest('hex')

export function createPackAssetTestFixture() {
  const documents = createValidLearningPackFixture()
  documents.manifest.packId = 'learnt.pack-asset-fixture'
  documents.catalog.subjects[0]!.subjectId = 'pack-asset-fixture'
  documents.catalog.subjects[0]!.title = 'Pack Asset Fixture'
  documents.courses.courses[0]!.subjectIds = ['pack-asset-fixture']
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
    ],
  }

  return { documents, installedPack, activeRelease }
}
