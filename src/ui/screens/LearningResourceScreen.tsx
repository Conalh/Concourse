import type { ContentBlock as PackContentBlock } from '@learnt/learning-pack-contracts'

import type {
  LearningPackCurriculumEntryView,
  LearningResourceCheckpointReference,
  LearningResourceSegmentReference,
  LearningResourceTeachingContext,
} from '../../application'
import type { ContentBlock, LearningFlowOrigin } from '../../core/contracts'
import {
  AsyncStateView,
  ContentBlockRenderer,
  RecoverableError,
} from '../components'
import { useLearningResource, useRouteFocus } from '../hooks'
import { formatRoute, navigateToSession } from '../navigation'
import { useProductVocabulary, type ProductVocabularyCopy } from '../vocabulary'
import { getSafeExternalResourceUrl } from './learning-resource-url'

type ResourceSource = LearningResourceTeachingContext['source']
type ExternalResourceSource = Extract<
  ResourceSource,
  | { readonly kind: 'external-link' }
  | { readonly kind: 'external-video' }
  | { readonly kind: 'external-audio' }
  | { readonly kind: 'interactive-reference' }
>
type BibliographicResourceSource = Extract<
  ResourceSource,
  { readonly kind: 'bibliographic-reference' }
>

export function LearningResourceScreen({
  packId,
  resourceId,
  segmentId,
  origin,
}: Readonly<{
  packId: string
  resourceId: string
  segmentId?: string
  origin?: LearningFlowOrigin
}>) {
  const vocabulary = useProductVocabulary()
  const controller = useLearningResource(packId, resourceId, segmentId)

  return (
    <AsyncStateView
      state={controller.state}
      loadingLabel={`Loading ${vocabulary.terms.resource.toLowerCase()}`}
      retryLabel={`Reload ${vocabulary.terms.resource.toLowerCase()}`}
      onRetry={controller.reload}
    >
      {(resource) => (
        <LearningResourceContent
          resource={resource}
          {...(origin === undefined ? {} : { origin })}
          commandState={controller.commandState}
          onMarkComplete={() => {
            void controller.markComplete()
          }}
          onLeave={() => {
            void controller.leaveResource()
          }}
          onExternalOpen={() => {
            void controller.recordExternalOpen()
          }}
          onStartCheckpoint={(checkpoint) => {
            void controller
              .startCheckpoint(
                checkpoint.setId,
                checkpointOrigin(resource, origin),
              )
              .then((result) => {
                if (result !== null) {
                  navigateToSession(result.context.record.session.id)
                }
              })
          }}
          onReload={controller.reload}
        />
      )}
    </AsyncStateView>
  )
}

function LearningResourceContent({
  resource,
  origin,
  commandState,
  onMarkComplete,
  onLeave,
  onExternalOpen,
  onStartCheckpoint,
  onReload,
}: Readonly<{
  resource: LearningResourceTeachingContext
  origin?: LearningFlowOrigin
  commandState: ReturnType<typeof useLearningResource>['commandState']
  onMarkComplete: () => void
  onLeave: () => void
  onExternalOpen: () => void
  onStartCheckpoint: (checkpoint: LearningResourceCheckpointReference) => void
  onReload: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `resource-${resource.packId}-${resource.resourceId}-${resource.selectedSegment?.segmentId ?? 'whole'}`,
  )
  const pending = commandState.status === 'pending'
  const checkpointSource = resource.selectedSegment ?? resource
  const checkpoints =
    'checkpoints' in checkpointSource ? checkpointSource.checkpoints : []
  const returnTarget = returnTargetForOrigin(origin, vocabulary)

  return (
    <div className="learnt-screen learnt-resource-screen">
      <section className="learnt-page-heading" aria-labelledby="resource-title">
        <p className="learnt-kicker">{vocabulary.resource.teachingKicker}</p>
        <h1 id="resource-title" ref={headingRef} tabIndex={-1}>
          {resource.selectedSegment?.title ?? resource.title}
        </h1>
        <p>{resource.selectedSegment?.summary ?? resource.summary}</p>
        <ul className="learnt-tag-list" aria-label="Resource details">
          <li>{sourceKindLabel(resource.sourceKind)}</li>
          <li>{resource.modality}</li>
          <li>{progressLabel(resource.progressState)}</li>
          {resource.estimatedDurationSeconds === null ? null : (
            <li>{formatDuration(resource.estimatedDurationSeconds)}</li>
          )}
          {resource.difficulty === null ? null : <li>{resource.difficulty}</li>}
        </ul>
        <div className="learnt-action-row">
          <button
            className="learnt-button"
            type="button"
            disabled={pending || resource.progressState === 'completed'}
            onClick={onMarkComplete}
          >
            {resource.progressState === 'completed'
              ? vocabulary.resource.completedAction
              : vocabulary.resource.markCompleteAction}
          </button>
          <button
            className="learnt-button learnt-button-secondary"
            type="button"
            disabled={pending}
            onClick={onLeave}
          >
            {vocabulary.resource.leaveAction}
          </button>
          <a
            className="learnt-button learnt-button-secondary"
            href={returnTarget.href}
          >
            {returnTarget.label}
          </a>
        </div>
        {commandState.status === 'error' ? (
          <RecoverableError
            error={commandState.error}
            actionLabel={`Reload ${vocabulary.terms.resource.toLowerCase()}`}
            onAction={onReload}
          />
        ) : null}
      </section>

      <div className="learnt-workspace-grid">
        <article className="learnt-activity-stage">
          <ResourceSourceView
            resource={resource}
            onExternalOpen={onExternalOpen}
          />
          <SegmentList resource={resource} />
        </article>

        <aside className="learnt-workspace-context">
          <ResourceContextPanel resource={resource} />
          <CheckpointPanel
            checkpoints={checkpoints}
            disabled={pending}
            onStartCheckpoint={onStartCheckpoint}
            segmentSelected={resource.selectedSegment !== null}
          />
          <NextEntryPanel nextEntry={resource.nextEntry} />
          <AttributionPanel resource={resource} />
        </aside>
      </div>
    </div>
  )
}

function ResourceSourceView({
  resource,
  onExternalOpen,
}: Readonly<{
  resource: LearningResourceTeachingContext
  onExternalOpen: () => void
}>) {
  const vocabulary = useProductVocabulary()

  if (!resource.supported) {
    return (
      <section className="learnt-unsupported" role="status">
        <p className="learnt-kicker">{vocabulary.resource.unsupportedKicker}</p>
        <h2>{sourceKindLabel(resource.sourceKind)}</h2>
        <p>{resource.supportMessage}</p>
      </section>
    )
  }

  switch (resource.source.kind) {
    case 'embedded-content':
      return (
        <section aria-labelledby="embedded-resource-title">
          <h2 id="embedded-resource-title">Reading</h2>
          <ContentBlockRenderer
            blocks={resource.source.content.flatMap(mapPackContentBlock)}
          />
        </section>
      )
    case 'external-link':
    case 'external-video':
    case 'external-audio':
    case 'interactive-reference':
      return (
        <ExternalResourceView
          source={resource.source}
          segment={resource.selectedSegment}
          onExternalOpen={onExternalOpen}
        />
      )
    case 'bibliographic-reference':
      return <BibliographicResourceView source={resource.source} />
  }
}

function ExternalResourceView({
  source,
  segment,
  onExternalOpen,
}: Readonly<{
  source: ExternalResourceSource
  segment: LearningResourceSegmentReference | null
  onExternalOpen: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const url = getSafeExternalResourceUrl(source, segment)

  return (
    <section className="learnt-panel" aria-labelledby="external-resource-title">
      <p className="learnt-kicker">{sourceKindLabel(source.kind)}</p>
      <h2 id="external-resource-title">
        {vocabulary.resource.openExternalTitle}
      </h2>
      <p>
        {vocabulary.appName} will open the canonical external location in a
        separate browser context. Completion remains self-reported unless an
        app-owned player can observe progress.
      </p>
      <dl className="learnt-detail-grid">
        {'providerName' in source ? (
          <div>
            <dt>Provider</dt>
            <dd>{source.providerName}</dd>
          </div>
        ) : null}
        {'provider' in source ? (
          <div>
            <dt>Provider</dt>
            <dd>{source.provider}</dd>
          </div>
        ) : null}
        {segment?.startSeconds === undefined ? null : (
          <div>
            <dt>Segment starts</dt>
            <dd>{String(segment.startSeconds)} seconds</dd>
          </div>
        )}
      </dl>
      {url === null ? (
        <p className="learnt-inline-status">
          No safe external URL is available.
        </p>
      ) : (
        <a
          className="learnt-button"
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={onExternalOpen}
        >
          {vocabulary.resource.openExternalAction}
        </a>
      )}
      {source.kind === 'interactive-reference' ? (
        <p>{source.interactionSummary}</p>
      ) : null}
    </section>
  )
}

function BibliographicResourceView({
  source,
}: Readonly<{
  source: BibliographicResourceSource
}>) {
  return (
    <section
      className="learnt-panel"
      aria-labelledby="bibliographic-resource-title"
    >
      <p className="learnt-kicker">Bibliographic reference</p>
      <h2 id="bibliographic-resource-title">{source.title}</h2>
      <dl className="learnt-detail-grid">
        <ResourceDetail label="Authors" value={source.authors.join(', ')} />
        <ResourceDetail label="Publisher" value={source.publisher ?? null} />
        <ResourceDetail
          label="Publication year"
          value={
            source.publicationYear === undefined
              ? null
              : String(source.publicationYear)
          }
        />
        <ResourceDetail label="Edition" value={source.edition ?? null} />
        <ResourceDetail label="Chapter" value={source.chapter ?? null} />
        <ResourceDetail label="Pages" value={source.pageRange ?? null} />
        <ResourceDetail label="DOI" value={source.doi ?? null} />
        <ResourceDetail label="ISBN" value={source.isbn ?? null} />
      </dl>
      {source.citationText === undefined ? null : <p>{source.citationText}</p>}
      {source.canonicalUrl === undefined ? null : (
        <a
          className="learnt-button learnt-button-secondary"
          href={source.canonicalUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open canonical reference
        </a>
      )}
    </section>
  )
}

function SegmentList({
  resource,
}: Readonly<{ resource: LearningResourceTeachingContext }>) {
  if (resource.segments.length === 0) {
    return null
  }

  return (
    <section className="learnt-panel" aria-labelledby="segments-title">
      <h2 id="segments-title">Segments</h2>
      <ul className="learnt-learning-item-list">
        {resource.segments.map((segment) => (
          <li key={segment.segmentId}>
            <div>
              <p className="learnt-kicker">Segment</p>
              <h3>{segment.title}</h3>
              {segment.summary === null ? null : <p>{segment.summary}</p>}
            </div>
            <a
              className="learnt-button learnt-button-secondary"
              href={formatRoute({
                kind: 'resource',
                packId: resource.packId,
                resourceId: resource.resourceId,
                segmentId: segment.segmentId,
              })}
            >
              Open segment
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ResourceContextPanel({
  resource,
}: Readonly<{ resource: LearningResourceTeachingContext }>) {
  const vocabulary = useProductVocabulary()

  return (
    <section className="learnt-panel" aria-labelledby="resource-context-title">
      <h2 id="resource-context-title">Context</h2>
      <dl className="learnt-detail-grid">
        <div>
          <dt>{vocabulary.terms.packSingular}</dt>
          <dd>
            {resource.packId}@{resource.packVersion}
          </dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{resource.contentRevision}</dd>
        </div>
      </dl>
      <h3>Concepts</h3>
      {resource.concepts.length === 0 ? (
        <p className="learnt-muted">No concept references.</p>
      ) : (
        <ul>
          {resource.concepts.map((concept) => (
            <li key={concept.conceptId}>{concept.title}</li>
          ))}
        </ul>
      )}
      <h3>Objectives</h3>
      {resource.objectives.length === 0 ? (
        <p className="learnt-muted">No objective references.</p>
      ) : (
        <ul>
          {resource.objectives.map((objective) => (
            <li key={objective.objectiveId}>{objective.statement}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CheckpointPanel({
  checkpoints,
  disabled,
  onStartCheckpoint,
  segmentSelected,
}: Readonly<{
  checkpoints: readonly LearningResourceCheckpointReference[]
  disabled: boolean
  onStartCheckpoint: (checkpoint: LearningResourceCheckpointReference) => void
  segmentSelected: boolean
}>) {
  const vocabulary = useProductVocabulary()

  return (
    <section className="learnt-panel" aria-labelledby="resource-checkpoints">
      <h2 id="resource-checkpoints">{vocabulary.resource.checkpointsTitle}</h2>
      {checkpoints.length === 0 ? (
        <p className="learnt-muted">{vocabulary.transfer.noCheckpointSets}</p>
      ) : (
        <ul>
          {checkpoints.map((checkpoint) => (
            <li key={checkpoint.setId}>
              <strong>{checkpoint.title}</strong>
              <p>
                {checkpoint.kind} / {checkpoint.itemCount}{' '}
                {vocabulary.terms.learningItemPlural.toLowerCase()}
              </p>
              <button
                className="learnt-button learnt-button-secondary"
                type="button"
                disabled={disabled || checkpoint.itemCount === 0}
                onClick={() => {
                  onStartCheckpoint(checkpoint)
                }}
              >
                {segmentSelected
                  ? vocabulary.resource.practiceSectionAction
                  : vocabulary.resource.startCheckpointAction}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NextEntryPanel({
  nextEntry,
}: Readonly<{ nextEntry: LearningPackCurriculumEntryView | null }>) {
  const vocabulary = useProductVocabulary()

  return (
    <section className="learnt-panel" aria-labelledby="next-entry-title">
      <h2 id="next-entry-title">{vocabulary.resource.nextEntryTitle}</h2>
      {nextEntry === null ? (
        <p className="learnt-muted">No next authored entry was found.</p>
      ) : (
        <>
          <p>
            {entryKindLabel(nextEntry.kind, vocabulary)}: {nextEntry.title}
          </p>
          {nextEntry.kind === 'resource' ? (
            <a
              className="learnt-button learnt-button-secondary"
              href={formatRoute({
                kind: 'resource',
                packId: nextEntry.packId,
                resourceId: nextEntry.resourceId,
                ...(nextEntry.segmentId === null
                  ? {}
                  : { segmentId: nextEntry.segmentId }),
              })}
            >
              Continue
            </a>
          ) : (
            <a
              className="learnt-button learnt-button-secondary"
              href={formatRoute({ kind: 'library' })}
            >
              Open in library
            </a>
          )}
        </>
      )}
    </section>
  )
}

function AttributionPanel({
  resource,
}: Readonly<{ resource: LearningResourceTeachingContext }>) {
  return (
    <details className="learnt-details">
      <summary>Attribution and accessibility</summary>
      <dl className="learnt-detail-grid">
        <ResourceDetail
          label="Author"
          value={resource.provenance?.author ?? null}
        />
        <ResourceDetail
          label="Publisher"
          value={resource.provenance?.publisher ?? null}
        />
        <ResourceDetail
          label="License"
          value={resource.provenance?.license ?? null}
        />
        <ResourceDetail
          label="Attribution"
          value={resource.provenance?.attributionText ?? null}
        />
        <ResourceDetail
          label="Last reviewed"
          value={resource.provenance?.lastReviewedAt ?? null}
        />
        <ResourceDetail
          label="Captions"
          value={booleanMetadata(resource.accessibility?.captionsAvailable)}
        />
        <ResourceDetail
          label="Transcript"
          value={booleanMetadata(resource.accessibility?.transcriptAvailable)}
        />
        <ResourceDetail
          label="Accessibility notes"
          value={resource.accessibility?.accessibilityNotes ?? null}
        />
      </dl>
    </details>
  )
}

function ResourceDetail({
  label,
  value,
}: Readonly<{ label: string; value: string | null }>) {
  if (value === null || value.length === 0) {
    return null
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function mapPackContentBlock(block: PackContentBlock): ContentBlock[] {
  switch (block.kind) {
    case 'text':
      return [{ kind: 'text', body: block.text }]
    case 'question':
      return [{ kind: 'question', prompt: block.text }]
    case 'code':
      return [
        {
          kind: 'code',
          language: block.language ?? 'text',
          source: block.text,
        },
      ]
    case 'equation':
      return [{ kind: 'equation', expression: block.text }]
    case 'callout':
      return [
        {
          kind: 'callout',
          purpose: mapCalloutPurpose(block.calloutRole),
          body: block.text,
        },
      ]
    case 'image':
      return [
        {
          kind: 'text',
          body: `Image: ${block.altText ?? block.assetId ?? 'referenced asset'}`,
        },
      ]
    case 'audio':
      return [
        {
          kind: 'text',
          body: `Audio: ${block.altText ?? block.assetId ?? 'referenced asset'}`,
        },
      ]
  }
}

function mapCalloutPurpose(
  role: PackContentBlock['calloutRole'],
): Extract<ContentBlock, { kind: 'callout' }>['purpose'] {
  switch (role) {
    case 'warning':
      return 'warning'
    case 'definition':
      return 'mental-model'
    case 'tip':
      return 'connection'
    case 'note':
    case null:
      return 'observation'
  }
}

function checkpointOrigin(
  resource: LearningResourceTeachingContext,
  inheritedOrigin: LearningFlowOrigin | undefined,
): LearningFlowOrigin {
  if (inheritedOrigin?.kind === 'active-session') {
    return inheritedOrigin
  }

  const resourceRoute = formatRoute({
    kind: 'resource',
    packId: resource.packId,
    resourceId: resource.resourceId,
    ...(resource.selectedSegment === null
      ? {}
      : { segmentId: resource.selectedSegment.segmentId }),
  })
  const continuationRoute = continuationRouteForEntry(resource.nextEntry)

  return {
    kind: 'learning-resource',
    packId: resource.packId,
    resourceId: resource.resourceId,
    ...(resource.selectedSegment === null
      ? {}
      : { segmentId: resource.selectedSegment.segmentId }),
    returnRoute: resourceRoute,
    ...(continuationRoute === null ? {} : { continuationRoute }),
  }
}

function returnTargetForOrigin(
  origin: LearningFlowOrigin | undefined,
  vocabulary: ProductVocabularyCopy,
): Readonly<{ label: string; href: string }> {
  if (origin?.kind === 'active-session') {
    return {
      label: vocabulary.resource.returnToPractice,
      href: formatRoute({ kind: 'session', sessionId: origin.sessionId }),
    }
  }

  if (origin?.returnRoute !== undefined) {
    return {
      label:
        origin.kind === 'learning-resource'
          ? vocabulary.resource.backToResource
          : 'Return to previous work',
      href: origin.returnRoute,
    }
  }

  return {
    label: `Return to ${vocabulary.nav.library.toLowerCase()}`,
    href: formatRoute({ kind: 'library' }),
  }
}

function continuationRouteForEntry(
  entry: LearningPackCurriculumEntryView | null,
): string | null {
  if (entry === null) {
    return null
  }

  if (entry.kind === 'resource') {
    return formatRoute({
      kind: 'resource',
      packId: entry.packId,
      resourceId: entry.resourceId,
      ...(entry.segmentId === null ? {} : { segmentId: entry.segmentId }),
    })
  }

  return formatRoute({ kind: 'library' })
}

function sourceKindLabel(kind: ResourceSource['kind']): string {
  switch (kind) {
    case 'embedded-content':
      return 'Embedded reading'
    case 'external-link':
      return 'External link'
    case 'external-video':
      return 'External video'
    case 'external-audio':
      return 'External audio'
    case 'bibliographic-reference':
      return 'Bibliographic reference'
    case 'interactive-reference':
      return 'Interactive reference'
  }
}

function progressLabel(
  state: LearningResourceTeachingContext['progressState'],
) {
  switch (state) {
    case 'unseen':
      return 'Unseen'
    case 'opened':
      return 'Opened'
    case 'in-progress':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'completion-stale':
      return 'Completion stale'
    case 'unavailable':
      return 'Unavailable'
    case 'unsupported':
      return 'Unsupported'
  }
}

function entryKindLabel(
  kind: LearningPackCurriculumEntryView['kind'],
  vocabulary: ProductVocabularyCopy,
): string {
  switch (kind) {
    case 'child-node':
      return 'Section'
    case 'resource':
      return vocabulary.terms.resource
    case 'item':
      return vocabulary.terms.learningItemSingular
    case 'study-set':
      return vocabulary.terms.studySetSingular
  }
}

function booleanMetadata(value: boolean | undefined): string | null {
  if (value === undefined) {
    return null
  }

  return value ? 'Available' : 'Not indicated'
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${String(seconds)} sec`
  }

  const minutes = Math.round(seconds / 60)
  return `${String(minutes)} min`
}
