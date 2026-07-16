import type { ConceptId } from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'

import type {
  ConceptRelationship,
  SubjectOverview,
} from './learnt-application.types'

export function buildSubjectOverview(
  subject: LearningSubject,
): SubjectOverview {
  return deepFreeze(
    cloneDeep({
      subject,
      orderedModules: [...subject.modules].sort(
        (left, right) => left.order - right.order,
      ),
      conceptRelationships: buildConceptRelationships(subject),
    }),
  )
}

function buildConceptRelationships(
  subject: LearningSubject,
): readonly ConceptRelationship[] {
  const relationships: ConceptRelationship[] = []
  const relatedPairs = new Set<string>()

  for (const concept of subject.concepts) {
    for (const prerequisiteId of concept.prerequisiteConceptIds) {
      relationships.push({
        fromConceptId: prerequisiteId,
        toConceptId: concept.id,
        kind: 'prerequisite',
      })
    }

    for (const relatedId of concept.relatedConceptIds) {
      const key = pairKey(concept.id, relatedId)

      if (relatedPairs.has(key)) {
        continue
      }

      relatedPairs.add(key)
      const [fromConceptId, toConceptId] = sortPair(concept.id, relatedId)
      relationships.push({
        fromConceptId,
        toConceptId,
        kind: 'related',
      })
    }
  }

  return relationships.sort((left, right) =>
    `${left.kind}:${left.fromConceptId}:${left.toConceptId}`.localeCompare(
      `${right.kind}:${right.fromConceptId}:${right.toConceptId}`,
    ),
  )
}

function pairKey(left: ConceptId, right: ConceptId): string {
  return sortPair(left, right).join('|')
}

function sortPair(left: ConceptId, right: ConceptId): [ConceptId, ConceptId] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left]
}
