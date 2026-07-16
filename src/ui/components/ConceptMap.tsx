import type { SubjectOverview } from '../../application'
import type { ConceptId } from '../../core/contracts'

export function ConceptMap({
  subject,
  relationships,
  activeConceptIds = [],
}: Readonly<{
  subject: SubjectOverview['subject']
  relationships: SubjectOverview['conceptRelationships']
  activeConceptIds?: readonly ConceptId[]
}>) {
  const active = new Set(activeConceptIds)

  return (
    <section className="learnt-concept-map" aria-labelledby="concept-map-title">
      <h2 id="concept-map-title">Concept relationships</h2>
      <div
        className="learnt-concept-node-list"
        aria-label="Visual concept relationship list"
      >
        {subject.concepts.map((concept) => {
          const prerequisites = concept.prerequisiteConceptIds
            .map((id) => conceptTitle(subject, id))
            .filter((title) => title !== null)
          const related = concept.relatedConceptIds
            .map((id) => conceptTitle(subject, id))
            .filter((title) => title !== null)

          return (
            <article
              className="learnt-concept-node"
              data-active={active.has(concept.id) ? 'true' : 'false'}
              key={concept.id}
            >
              <h3>
                {concept.title}
                {active.has(concept.id) ? (
                  <span className="learnt-current-label">Current</span>
                ) : null}
              </h3>
              <p>{concept.summary}</p>
              <dl>
                <dt>Prerequisites</dt>
                <dd>
                  {prerequisites.length === 0
                    ? 'None'
                    : prerequisites.join(', ')}
                </dd>
                <dt>Related</dt>
                <dd>{related.length === 0 ? 'None' : related.join(', ')}</dd>
              </dl>
            </article>
          )
        })}
      </div>
      <details className="learnt-details">
        <summary>Text relationship list</summary>
        <ul>
          {relationships.map((relationship) => (
            <li
              key={`${relationship.kind}-${relationship.fromConceptId}-${relationship.toConceptId}`}
            >
              <strong>{relationship.kind}:</strong>{' '}
              {conceptTitle(subject, relationship.fromConceptId) ??
                relationship.fromConceptId}{' '}
              to{' '}
              {conceptTitle(subject, relationship.toConceptId) ??
                relationship.toConceptId}
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function conceptTitle(
  subject: SubjectOverview['subject'],
  conceptId: ConceptId,
): string | null {
  return (
    subject.concepts.find((concept) => concept.id === conceptId)?.title ?? null
  )
}
