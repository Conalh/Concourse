import type { SubjectId } from '../core/contracts'

import { defineSubject } from './define-subject'
import { isDefinedSubject } from './defined-subjects'
import { createSubjectAdapter } from './subject-adapter'
import type { SubjectAdapter } from './subject-adapter'
import { SubjectRegistryError } from './subject-sdk-error'

export class SubjectRegistry {
  readonly #adapters = new Map<SubjectId, SubjectAdapter>()

  register(adapter: SubjectAdapter): void {
    const trustedSubject = isDefinedSubject(adapter.subject)
      ? adapter.subject
      : defineSubject(adapter.subject)
    const normalizedAdapter =
      trustedSubject === adapter.subject && Object.isFrozen(adapter)
        ? adapter
        : createSubjectAdapter(trustedSubject)
    const existingAdapter = this.#adapters.get(normalizedAdapter.subject.id)

    if (existingAdapter !== undefined) {
      throw new SubjectRegistryError(
        `Subject "${normalizedAdapter.subject.id}" is already registered. Existing version: ${existingAdapter.subject.version}; incoming version: ${normalizedAdapter.subject.version}.`,
      )
    }

    this.#adapters.set(normalizedAdapter.subject.id, normalizedAdapter)
  }

  get(subjectId: SubjectId): SubjectAdapter | undefined {
    return this.#adapters.get(subjectId)
  }

  has(subjectId: SubjectId): boolean {
    return this.#adapters.has(subjectId)
  }

  unregister(subjectId: SubjectId): void {
    this.#adapters.delete(subjectId)
  }

  list(): readonly SubjectAdapter[] {
    return Object.freeze([...this.#adapters.values()])
  }
}
