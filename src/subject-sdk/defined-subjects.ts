import type { SubjectPackage } from '../core/contracts'
import type { DeepReadonly } from '../core/foundation'

export type DefinedSubject = DeepReadonly<SubjectPackage>

const definedSubjects = new WeakSet<object>()

export function markDefinedSubject(subject: DefinedSubject): void {
  definedSubjects.add(subject)
}

export function isDefinedSubject(subject: unknown): subject is DefinedSubject {
  return (
    typeof subject === 'object' &&
    subject !== null &&
    definedSubjects.has(subject)
  )
}
