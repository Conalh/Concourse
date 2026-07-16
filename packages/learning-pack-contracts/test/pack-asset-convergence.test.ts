import { describe, expect, it } from 'vitest'

import {
  createValidLearningPackFixture,
  validateLearningPackDocuments,
} from '../src/index.js'

describe('pack-asset convergence contract', () => {
  it('accepts a declared notebook asset learning resource', () => {
    const pack = createValidLearningPackFixture()
    pack.manifest.capabilities.required.push({
      capabilityId: 'learning-resource.pack-asset',
      version: '1',
    })
    pack.manifest.files.push(
      {
        assetId: null,
        path: 'resources.json',
        role: 'resources',
        mediaType: 'application/json',
        sha256: '0'.repeat(64),
        bytes: 100,
      },
      {
        assetId: 'asset.lab-notebook',
        path: 'assets/lab.ipynb',
        role: 'asset',
        mediaType: 'application/x-ipynb+json',
        sha256: '0'.repeat(64),
        bytes: 2,
      },
    )
    pack.resources = {
      schemaVersion: '0.1',
      resources: [
        {
          id: 'resource.lab-notebook',
          contentRevision: 1,
          title: 'Lab notebook',
          modality: 'interactive',
          roles: ['demonstration'],
          source: {
            kind: 'pack-asset',
            assetId: 'asset.lab-notebook',
            suggestedFileName: 'lab.ipynb',
            mediaType: 'application/x-ipynb+json',
          } as never,
        },
      ],
    }

    expect(validateLearningPackDocuments(pack)).toMatchObject({
      ok: true,
      diagnostics: [],
    })
  })
})
