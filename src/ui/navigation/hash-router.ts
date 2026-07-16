import type { SessionId, SubjectId } from '../../core/contracts'
import { formatRoute } from './app-route'

export function navigateToLibrary(): void {
  setRouteHash(formatRoute({ kind: 'library' }))
}

export function navigateToSubject(subjectId: SubjectId): void {
  setRouteHash(formatRoute({ kind: 'subject', subjectId }))
}

export function navigateToSession(sessionId: SessionId): void {
  setRouteHash(formatRoute({ kind: 'session', sessionId }))
}

export function navigateToSessionRecap(sessionId: SessionId): void {
  setRouteHash(formatRoute({ kind: 'session-recap', sessionId }))
}

function setRouteHash(hash: string): void {
  window.location.hash = hash
}
