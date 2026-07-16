import { defineSubject } from './define-subject'
import type { DefinedSubject } from './defined-subjects'
import { isDefinedSubject } from './defined-subjects'

export interface SubjectAdapter {
  readonly subject: DefinedSubject
}

export function createSubjectAdapter(subject: DefinedSubject): SubjectAdapter {
  const trustedSubject = isDefinedSubject(subject)
    ? subject
    : defineSubject(subject)

  return Object.freeze({
    subject: trustedSubject,
  })
}
