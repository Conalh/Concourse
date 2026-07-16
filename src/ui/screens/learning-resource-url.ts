import type { LearningResourceTeachingContext } from '../../application'
import type { LearningResourceSegmentReference } from '../../application'

type ResourceSource = LearningResourceTeachingContext['source']

export function getSafeExternalResourceUrl(
  source: ResourceSource,
  segment: LearningResourceSegmentReference | null,
): string | null {
  return safeHttpsUrl(externalResourceUrl(source, segment))
}

function externalResourceUrl(
  source: ResourceSource,
  segment: LearningResourceSegmentReference | null,
): string | null {
  switch (source.kind) {
    case 'external-link':
    case 'interactive-reference':
      return source.url
    case 'external-audio':
      return appendStartSeconds(
        source.canonicalUrl,
        segment?.startSeconds ?? source.startSeconds,
      )
    case 'external-video': {
      const startSeconds = segment?.startSeconds ?? source.startSeconds

      if (source.canonicalUrl !== undefined) {
        return appendStartSeconds(source.canonicalUrl, startSeconds)
      }
      if (source.provider === 'youtube') {
        return appendStartSeconds(
          `https://www.youtube.com/watch?v=${encodeURIComponent(source.mediaId)}`,
          startSeconds,
        )
      }
      if (source.provider === 'vimeo') {
        return appendStartSeconds(
          `https://vimeo.com/${encodeURIComponent(source.mediaId)}`,
          startSeconds,
        )
      }

      return null
    }
    case 'embedded-content':
    case 'bibliographic-reference':
    case 'pack-asset':
      return null
  }
}

function appendStartSeconds(
  url: string,
  startSeconds: number | undefined,
): string {
  if (startSeconds === undefined) {
    return url
  }

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('t', String(startSeconds))
    return parsed.toString()
  } catch {
    return url
  }
}

function safeHttpsUrl(url: string | null): string | null {
  if (url === null) {
    return null
  }

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
