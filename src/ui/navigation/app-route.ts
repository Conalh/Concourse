import {
  ConceptIdSchema,
  LearningFlowOriginSchema,
  SessionIdSchema,
  SubjectIdSchema,
  type ConceptId,
  type LearningFlowOrigin,
  type SessionId,
  type SubjectId,
} from '../../core/contracts'

export type AppRoute =
  | { kind: 'today' }
  | { kind: 'library' }
  | { kind: 'practice' }
  | { kind: 'transfer' }
  | { kind: 'progress' }
  | { kind: 'profile' }
  | { kind: 'settings' }
  | {
      kind: 'subject'
      subjectId: SubjectId
    }
  | {
      kind: 'session'
      sessionId: SessionId
    }
  | {
      kind: 'session-concept'
      sessionId: SessionId
      conceptId: ConceptId
    }
  | {
      kind: 'session-recap'
      sessionId: SessionId
    }
  | {
      kind: 'resource'
      packId: string
      resourceId: string
      segmentId?: string
      origin?: LearningFlowOrigin
    }
  | {
      kind: 'not-found'
      attemptedHash: string
    }

export function parseHashRoute(hash: string): AppRoute {
  try {
    const normalized = normalizeHash(hash)

    if (normalized === '/' || normalized === '') {
      return { kind: 'library' }
    }

    const { path, query } = splitHashPathAndQuery(normalized)
    const parts = path.split('/').filter((part) => part.length > 0)

    if (parts.length === 1 && parts[0] === 'today') {
      return { kind: 'today' }
    }

    if (parts.length === 1 && parts[0] === 'practice') {
      return { kind: 'practice' }
    }

    if (parts.length === 1 && parts[0] === 'transfer') {
      return { kind: 'transfer' }
    }

    if (parts.length === 1 && parts[0] === 'progress') {
      return { kind: 'progress' }
    }

    if (parts.length === 1 && parts[0] === 'profile') {
      return { kind: 'profile' }
    }

    if (parts.length === 1 && parts[0] === 'settings') {
      return { kind: 'settings' }
    }

    if (parts.length === 2 && parts[0] === 'subjects') {
      const segment = parts[1]

      if (segment === undefined) {
        return { kind: 'not-found', attemptedHash: hash }
      }

      const parsed = SubjectIdSchema.safeParse(decodeRouteSegment(segment))
      return parsed.success
        ? { kind: 'subject', subjectId: parsed.data }
        : { kind: 'not-found', attemptedHash: hash }
    }

    if (
      parts.length === 4 &&
      parts[0] === 'sessions' &&
      parts[2] === 'concepts'
    ) {
      const sessionSegment = parts[1]
      const conceptSegment = parts[3]

      if (sessionSegment === undefined || conceptSegment === undefined) {
        return { kind: 'not-found', attemptedHash: hash }
      }

      const parsedSession = SessionIdSchema.safeParse(
        decodeRouteSegment(sessionSegment),
      )
      const parsedConcept = ConceptIdSchema.safeParse(
        decodeRouteSegment(conceptSegment),
      )

      return parsedSession.success && parsedConcept.success
        ? {
            kind: 'session-concept',
            sessionId: parsedSession.data,
            conceptId: parsedConcept.data,
          }
        : { kind: 'not-found', attemptedHash: hash }
    }

    if (parts.length === 3 && parts[0] === 'sessions' && parts[2] === 'recap') {
      const segment = parts[1]

      if (segment === undefined) {
        return { kind: 'not-found', attemptedHash: hash }
      }

      const parsed = SessionIdSchema.safeParse(decodeRouteSegment(segment))
      return parsed.success
        ? { kind: 'session-recap', sessionId: parsed.data }
        : { kind: 'not-found', attemptedHash: hash }
    }

    if (parts.length === 2 && parts[0] === 'sessions') {
      const segment = parts[1]

      if (segment === undefined) {
        return { kind: 'not-found', attemptedHash: hash }
      }

      const parsed = SessionIdSchema.safeParse(decodeRouteSegment(segment))
      return parsed.success
        ? { kind: 'session', sessionId: parsed.data }
        : { kind: 'not-found', attemptedHash: hash }
    }

    if (
      (parts.length === 4 || parts.length === 6) &&
      parts[0] === 'packs' &&
      parts[2] === 'resources'
    ) {
      const packSegment = parts[1]
      const resourceSegment = parts[3]

      if (packSegment === undefined || resourceSegment === undefined) {
        return { kind: 'not-found', attemptedHash: hash }
      }

      if (parts.length === 6 && parts[4] !== 'segments') {
        return { kind: 'not-found', attemptedHash: hash }
      }

      const packId = decodeRouteSegment(packSegment)
      const resourceId = decodeRouteSegment(resourceSegment)
      const segmentId =
        parts.length === 6 && parts[5] !== undefined
          ? decodeRouteSegment(parts[5])
          : undefined

      if (packId.length === 0 || resourceId.length === 0 || segmentId === '') {
        return { kind: 'not-found', attemptedHash: hash }
      }

      return {
        kind: 'resource',
        packId,
        resourceId,
        ...(segmentId === undefined ? {} : { segmentId }),
        ...parseOriginQuery(query),
      }
    }

    return { kind: 'not-found', attemptedHash: hash }
  } catch {
    return { kind: 'not-found', attemptedHash: hash }
  }
}

export function formatRoute(route: Exclude<AppRoute, { kind: 'not-found' }>) {
  switch (route.kind) {
    case 'today':
      return '#/today'
    case 'library':
      return '#/'
    case 'practice':
      return '#/practice'
    case 'transfer':
      return '#/transfer'
    case 'progress':
      return '#/progress'
    case 'profile':
      return '#/profile'
    case 'settings':
      return '#/settings'
    case 'subject':
      return `#/subjects/${encodeURIComponent(route.subjectId)}`
    case 'session':
      return `#/sessions/${encodeURIComponent(route.sessionId)}`
    case 'session-concept':
      return `#/sessions/${encodeURIComponent(route.sessionId)}/concepts/${encodeURIComponent(route.conceptId)}`
    case 'session-recap':
      return `#/sessions/${encodeURIComponent(route.sessionId)}/recap`
    case 'resource':
      return `#/packs/${encodeURIComponent(route.packId)}/resources/${encodeURIComponent(route.resourceId)}${
        route.segmentId === undefined
          ? ''
          : `/segments/${encodeURIComponent(route.segmentId)}`
      }${formatOriginQuery(route.origin)}`
  }
}

export function routeLabel(route: AppRoute): string {
  switch (route.kind) {
    case 'today':
      return 'Today'
    case 'library':
      return 'Learning Library'
    case 'practice':
      return 'Practice'
    case 'transfer':
      return 'Transfer'
    case 'progress':
      return 'Progress'
    case 'profile':
      return 'Profile'
    case 'settings':
      return 'Settings'
    case 'subject':
      return 'Subject Overview'
    case 'session':
      return 'Learning Workspace'
    case 'session-concept':
      return 'Concept Explorer'
    case 'session-recap':
      return 'Session Recap'
    case 'resource':
      return 'Teach'
    case 'not-found':
      return 'Not Found'
  }
}

function normalizeHash(hash: string): string {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash
  return withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`
}

function splitHashPathAndQuery(normalized: string): Readonly<{
  path: string
  query: URLSearchParams
}> {
  const queryIndex = normalized.indexOf('?')

  if (queryIndex < 0) {
    return { path: normalized, query: new URLSearchParams() }
  }

  return {
    path: normalized.slice(0, queryIndex),
    query: new URLSearchParams(normalized.slice(queryIndex + 1)),
  }
}

function decodeRouteSegment(segment: string): string {
  return decodeURIComponent(segment)
}

function parseOriginQuery(
  query: URLSearchParams,
): Readonly<{ origin: LearningFlowOrigin }> | Record<string, never> {
  const encoded = query.get('origin')

  if (encoded === null) {
    return {}
  }

  try {
    const parsed = LearningFlowOriginSchema.safeParse(JSON.parse(encoded))
    return parsed.success ? { origin: parsed.data } : {}
  } catch {
    return {}
  }
}

function formatOriginQuery(origin: LearningFlowOrigin | undefined): string {
  if (origin === undefined) {
    return ''
  }

  return `?${new URLSearchParams({
    origin: JSON.stringify(origin),
  }).toString()}`
}
