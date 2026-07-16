import { describe, expect, it } from 'vitest'

import { getSafeExternalResourceUrl } from './learning-resource-url'

describe('LearningResourceScreen external URLs', () => {
  it('opens only HTTPS external resource locators', () => {
    expect(
      getSafeExternalResourceUrl(
        { kind: 'external-link', url: 'https://example.com/article' },
        null,
      ),
    ).toBe('https://example.com/article')
    expect(
      getSafeExternalResourceUrl(
        { kind: 'external-link', url: 'http://example.com/article' },
        null,
      ),
    ).toBeNull()
    expect(
      getSafeExternalResourceUrl(
        {
          kind: 'interactive-reference',
          url: 'javascript:alert(1)',
          interactionSummary: 'Unsafe',
        },
        null,
      ),
    ).toBeNull()
  })

  it('adds segment start times without downgrading generated video URLs', () => {
    expect(
      getSafeExternalResourceUrl(
        {
          kind: 'external-video',
          provider: 'youtube',
          mediaId: 'video-id',
        },
        {
          segmentId: 'segment-intro',
          title: 'Intro',
          summary: null,
          startSeconds: 42,
          endSeconds: null,
          conceptIds: [],
          objectiveIds: [],
          checkpoints: [],
        },
      ),
    ).toBe('https://www.youtube.com/watch?v=video-id&t=42')
    expect(
      getSafeExternalResourceUrl(
        {
          kind: 'external-video',
          provider: 'other',
          mediaId: 'external-video-id',
          canonicalUrl: 'http://example.com/video',
        },
        null,
      ),
    ).toBeNull()
  })
})
