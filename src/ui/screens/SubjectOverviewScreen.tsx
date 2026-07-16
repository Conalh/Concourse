import { useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  CirclePlay,
  GitBranch,
  ListTree,
  Map as MapIcon,
  PackageCheck,
  Play,
  Target,
  Zap,
} from 'lucide-react'

import type { SessionLibraryEntry, SubjectOverview } from '../../application'
import type { DeepReadonly } from '../../core/foundation'
import type {
  ActivityDefinition,
  ConceptDefinition,
  ConceptId,
  LearningObjective,
  ModuleDefinition,
} from '../../core/contracts'
import {
  AsyncStateView,
  RecoverableError,
  availabilityLabel,
} from '../components'
import { useLearntApplication } from '../app/learnt-application-context'
import { mapApplicationError, type UiError } from '../errors'
import {
  useRouteFocus,
  useSubjectOverview,
  type SubjectOverviewData,
} from '../hooks'
import { formatRoute, navigateToSession } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

type ConceptSystemView = 'outline' | 'map'

type ConceptState = 'current' | 'covered' | 'queued'

const nodePositions: readonly Readonly<{ x: number; y: number }>[] = [
  { x: 14, y: 24 },
  { x: 36, y: 18 },
  { x: 30, y: 52 },
  { x: 55, y: 40 },
  { x: 58, y: 72 },
  { x: 80, y: 34 },
  { x: 82, y: 68 },
  { x: 18, y: 76 },
  { x: 72, y: 16 },
  { x: 44, y: 84 },
  { x: 90, y: 50 },
  { x: 10, y: 48 },
]

export function SubjectOverviewScreen({
  subjectId,
}: Readonly<{ subjectId: SubjectOverview['subject']['id'] }>) {
  const vocabulary = useProductVocabulary()
  const { state, reload } = useSubjectOverview(subjectId)

  return (
    <AsyncStateView
      state={state}
      loadingLabel={`Loading ${vocabulary.terms.subjectOverview.toLowerCase()}`}
      onRetry={reload}
    >
      {(data) => <SubjectOverviewContent data={data} />}
    </AsyncStateView>
  )
}

function SubjectOverviewContent({
  data,
}: Readonly<{ data: SubjectOverviewData }>) {
  const application = useLearntApplication()
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `subject-${data.overview.subject.id}`,
  )
  const [startError, setStartError] = useState<UiError | null>(null)
  const [starting, setStarting] = useState(false)
  const [conceptSystemView, setConceptSystemView] =
    useState<ConceptSystemView>('outline')
  const [inspectedConceptId, setInspectedConceptId] =
    useState<ConceptId | null>(data.overview.subject.concepts[0]?.id ?? null)
  const activeSession =
    data.sessionLibrary.sessions.find(
      (session) =>
        session.subjectId === data.overview.subject.id &&
        session.sessionStatus === 'active' &&
        session.availability === 'ready',
    ) ?? null
  const currentActivity =
    activeSession?.currentActivityId === null ||
    activeSession?.currentActivityId === undefined
      ? null
      : (data.overview.subject.activities.find(
          (activity) => activity.id === activeSession.currentActivityId,
        ) ?? null)
  const currentConceptIds = currentActivity?.conceptIds ?? []
  const inspectedConcept =
    data.overview.subject.concepts.find(
      (concept) => concept.id === inspectedConceptId,
    ) ??
    currentConceptIds
      .map((conceptId) =>
        data.overview.subject.concepts.find(
          (concept) => concept.id === conceptId,
        ),
      )
      .find((concept) => concept !== undefined) ??
    data.overview.subject.concepts[0] ??
    null
  const subjectInitials = subjectGlyph(data.overview.subject.title)
  const primaryActionLabel =
    activeSession === null
      ? 'Begin new session'
      : activeSession.currentModuleTitle === null
        ? 'Continue active session'
        : `Continue ${activeSession.currentModuleTitle}`
  const routeStats = buildRouteStats(data.overview, activeSession)

  async function beginSession() {
    if (starting) {
      return
    }

    setStarting(true)
    setStartError(null)

    try {
      const context = await application.startSession({
        subjectId: data.overview.subject.id,
        interactionMode: 'coach',
      })
      navigateToSession(context.record.session.id)
    } catch (error) {
      setStartError(mapApplicationError(error))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="learnt-screen learnt-route-detail-screen">
      <a className="learnt-route-back" href={formatRoute({ kind: 'library' })}>
        <ArrowLeft aria-hidden="true" size={14} strokeWidth={2.4} />
        {vocabulary.nav.library}
      </a>

      <section
        className="learnt-route-hero"
        aria-labelledby="subject-title"
        style={routeAccentStyle(data.overview.subject.title)}
      >
        <span className="learnt-route-avatar" aria-hidden="true">
          {subjectInitials}
        </span>
        <div className="learnt-route-hero-copy">
          <p className="learnt-kicker">{vocabulary.terms.subjectOverview}</p>
          <h1 id="subject-title" ref={headingRef} tabIndex={-1}>
            {data.overview.subject.title}
          </h1>
          <p>{data.overview.subject.summary}</p>
          <ul
            className="learnt-tag-list"
            aria-label={`${data.overview.subject.title} tags`}
          >
            {data.overview.subject.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </div>
        <div className="learnt-route-hero-actions">
          {activeSession === null ? (
            <button
              className="learnt-button"
              type="button"
              disabled={starting}
              onClick={() => {
                void beginSession()
              }}
            >
              {starting ? 'Starting' : primaryActionLabel}
            </button>
          ) : (
            <a
              className="learnt-button"
              href={formatRoute({
                kind: 'session',
                sessionId: activeSession.sessionId,
              })}
            >
              {primaryActionLabel}
            </a>
          )}
          {activeSession === null ? null : (
            <button
              className="learnt-button learnt-button-secondary"
              type="button"
              disabled={starting}
              onClick={() => {
                void beginSession()
              }}
            >
              {starting ? 'Starting' : 'Begin new session'}
            </button>
          )}
        </div>
      </section>

      <dl className="learnt-route-meta" aria-label="Route details">
        {routeStats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {startError === null ? null : (
        <RecoverableError
          error={startError}
          actionLabel="Try again"
          onAction={() => {
            void beginSession()
          }}
        />
      )}

      <a className="learnt-route-jump" href="#module-sequence-title">
        <ListTree aria-hidden="true" size={16} strokeWidth={2.2} />
        Jump to module
      </a>

      <div className="learnt-route-detail-grid">
        <main className="learnt-route-detail-main">
          <section
            className="learnt-route-concept-system"
            aria-labelledby="concept-system-title"
          >
            <div className="learnt-route-section-bar">
              <div>
                <p className="learnt-kicker">Concept system</p>
                <h2 id="concept-system-title">Module sequence</h2>
              </div>
              <div
                className="learnt-route-view-switch"
                aria-label="Concept system view"
              >
                <button
                  type="button"
                  aria-pressed={conceptSystemView === 'outline'}
                  onClick={() => {
                    setConceptSystemView('outline')
                  }}
                >
                  <ListTree aria-hidden="true" size={15} strokeWidth={2.2} />
                  Outline
                </button>
                <button
                  type="button"
                  aria-pressed={conceptSystemView === 'map'}
                  onClick={() => {
                    setConceptSystemView('map')
                  }}
                >
                  <MapIcon aria-hidden="true" size={15} strokeWidth={2.2} />
                  Map
                </button>
              </div>
            </div>

            {conceptSystemView === 'outline' ? (
              <ModuleSequence
                overview={data.overview}
                activeSession={activeSession}
              />
            ) : (
              <RouteConceptMap
                overview={data.overview}
                currentConceptIds={currentConceptIds}
                inspectedConceptId={inspectedConcept?.id ?? null}
                onInspect={setInspectedConceptId}
                onPractice={() => {
                  void beginSession()
                }}
                starting={starting}
              />
            )}
          </section>

          <TeachingResources
            overview={data.overview}
            activeSession={activeSession}
          />
        </main>

        <aside className="learnt-route-detail-aside">
          <ConceptList
            overview={data.overview}
            currentConceptIds={currentConceptIds}
            inspectedConceptId={inspectedConcept?.id ?? null}
            onInspect={(conceptId) => {
              setInspectedConceptId(conceptId)
              setConceptSystemView('map')
            }}
          />
          <ProvenancePanel overview={data.overview} />
        </aside>
      </div>

      <SessionCompatibility sessions={data.sessionLibrary.sessions} />
    </div>
  )
}

function ModuleSequence({
  overview,
  activeSession,
}: Readonly<{
  overview: SubjectOverview
  activeSession: SessionLibraryEntry | null
}>) {
  return (
    <div className="learnt-route-module-list" id="module-sequence-title">
      {overview.orderedModules.map((module, index) => (
        <RouteModuleCard
          activeSession={activeSession}
          index={index}
          key={module.id}
          module={module}
          overview={overview}
        />
      ))}
    </div>
  )
}

function RouteModuleCard({
  overview,
  module,
  index,
  activeSession,
}: Readonly<{
  overview: SubjectOverview
  module: DeepReadonly<ModuleDefinition>
  index: number
  activeSession: SessionLibraryEntry | null
}>) {
  const concepts = module.conceptIds
    .map((id) => overview.subject.concepts.find((concept) => concept.id === id))
    .filter((concept) => concept !== undefined)
  const objectives = module.objectiveIds
    .map((id) =>
      overview.subject.objectives.find((objective) => objective.id === id),
    )
    .filter((objective) => objective !== undefined)
  const activities = module.activityIds
    .map((id) =>
      overview.subject.activities.find((activity) => activity.id === id),
    )
    .filter((activity) => activity !== undefined)
  const moduleStatus = moduleStatusFor(module, activeSession)

  return (
    <article
      className="learnt-route-module"
      data-status={moduleStatus}
      style={moduleAccentStyle(index)}
    >
      <header>
        <span className="learnt-route-module-index">{index + 1}</span>
        <div>
          <p className="learnt-kicker">Module {index + 1}</p>
          <h3>{module.title}</h3>
          <p>{module.summary}</p>
        </div>
        <span className="learnt-route-module-status">
          {moduleStatusLabel(moduleStatus)}
        </span>
      </header>

      <div className="learnt-route-lesson-list">
        {activities.map((activity) => (
          <ActivityOutlineRow
            activity={activity}
            active={activeSession?.currentActivityId === activity.id}
            key={activity.id}
          />
        ))}
      </div>

      <div className="learnt-route-module-details">
        <dl>
          <div>
            <dt>Concepts</dt>
            <dd>{concepts.map((concept) => concept.title).join(', ')}</dd>
          </div>
          <div>
            <dt>Objectives</dt>
            <dd>{objectives.length}</dd>
          </div>
        </dl>
        <ObjectiveList objectives={objectives} />
      </div>
    </article>
  )
}

function ActivityOutlineRow({
  activity,
  active,
}: Readonly<{
  activity: DeepReadonly<ActivityDefinition>
  active: boolean
}>) {
  return (
    <div className="learnt-route-lesson-row" data-active={active}>
      <span className="learnt-route-lesson-icon" aria-hidden="true">
        <ActivityKindIcon activity={activity} size={16} />
      </span>
      <span>
        <strong>{activity.title}</strong>
        <small>
          {activity.kind} / {activity.scaffoldLevel}
        </small>
      </span>
      <span className="learnt-route-lesson-badge">
        {active ? 'Active' : activity.response === undefined ? 'Read' : 'Check'}
      </span>
    </div>
  )
}

function RouteConceptMap({
  overview,
  currentConceptIds,
  inspectedConceptId,
  onInspect,
  onPractice,
  starting,
}: Readonly<{
  overview: SubjectOverview
  currentConceptIds: readonly ConceptId[]
  inspectedConceptId: ConceptId | null
  onInspect: (conceptId: ConceptId) => void
  onPractice: () => void
  starting: boolean
}>) {
  const visibleConcepts = overview.subject.concepts.slice(
    0,
    nodePositions.length,
  )
  const visibleConceptIds = new Set(
    visibleConcepts.map((concept) => concept.id),
  )
  const positionedConcepts = visibleConcepts.map((concept, index) => ({
    concept,
    position: nodePositions[index] ?? { x: 50, y: 50 },
  }))
  const inspectedConcept =
    visibleConcepts.find((concept) => concept.id === inspectedConceptId) ??
    visibleConcepts[0] ??
    null
  const visibleRelationships = overview.conceptRelationships.filter(
    (relationship) =>
      visibleConceptIds.has(relationship.fromConceptId) &&
      visibleConceptIds.has(relationship.toConceptId),
  )

  return (
    <div className="learnt-route-map-view">
      <div
        className="learnt-route-map-canvas"
        aria-label="Concept relationships"
      >
        <svg aria-hidden="true" focusable="false">
          {visibleRelationships.map((relationship) => {
            const from = positionedConcepts.find(
              (entry) => entry.concept.id === relationship.fromConceptId,
            )
            const to = positionedConcepts.find(
              (entry) => entry.concept.id === relationship.toConceptId,
            )

            if (from === undefined || to === undefined) {
              return null
            }

            return (
              <line
                data-kind={relationship.kind}
                key={`${relationship.kind}-${relationship.fromConceptId}-${relationship.toConceptId}`}
                x1={`${String(from.position.x)}%`}
                y1={`${String(from.position.y)}%`}
                x2={`${String(to.position.x)}%`}
                y2={`${String(to.position.y)}%`}
              />
            )
          })}
        </svg>
        {positionedConcepts.map(({ concept, position }, index) => {
          const state = conceptState(concept, currentConceptIds, index)
          const selected = concept.id === inspectedConcept?.id

          return (
            <button
              className="learnt-route-map-node"
              type="button"
              data-state={state}
              data-selected={selected}
              key={concept.id}
              style={
                {
                  '--route-node-x': `${String(position.x)}%`,
                  '--route-node-y': `${String(position.y)}%`,
                } as CSSProperties
              }
              onClick={() => {
                onInspect(concept.id)
              }}
            >
              <span>{conceptShortLabel(concept.title)}</span>
              <small>{concept.title}</small>
            </button>
          )
        })}
        <div className="learnt-route-map-legend">
          <span>
            <i data-kind="prerequisite" />
            prereq
          </span>
          <span>
            <i data-kind="related" />
            related
          </span>
        </div>
      </div>

      {inspectedConcept === null ? null : (
        <ConceptInspector
          concept={inspectedConcept}
          overview={overview}
          state={conceptState(
            inspectedConcept,
            currentConceptIds,
            visibleConcepts.findIndex(
              (concept) => concept.id === inspectedConcept.id,
            ),
          )}
          onPractice={onPractice}
          starting={starting}
        />
      )}
      {overview.subject.concepts.length > visibleConcepts.length ? (
        <p className="learnt-route-map-note">
          Showing the first {visibleConcepts.length} concepts in this route. The
          full concept list remains available beside the map.
        </p>
      ) : null}
    </div>
  )
}

function ConceptInspector({
  overview,
  concept,
  state,
  onPractice,
  starting,
}: Readonly<{
  overview: SubjectOverview
  concept: DeepReadonly<ConceptDefinition>
  state: ConceptState
  onPractice: () => void
  starting: boolean
}>) {
  const prerequisites = concept.prerequisiteConceptIds
    .map((conceptId) => conceptTitle(overview, conceptId))
    .filter((title) => title !== null)
  const related = concept.relatedConceptIds
    .map((conceptId) => conceptTitle(overview, conceptId))
    .filter((title) => title !== null)

  return (
    <article className="learnt-route-concept-inspector">
      <header>
        <div>
          <h3>{concept.title}</h3>
          <p>{concept.summary}</p>
        </div>
        <span data-state={state}>{conceptStateLabel(state)}</span>
      </header>
      <div className="learnt-route-concept-links">
        <div>
          <strong>Requires first</strong>
          <span>
            {prerequisites.length === 0 ? 'None' : prerequisites.join(', ')}
          </span>
        </div>
        <div>
          <strong>Related</strong>
          <span>{related.length === 0 ? 'None' : related.join(', ')}</span>
        </div>
        <button
          className="learnt-button"
          type="button"
          disabled={starting}
          onClick={onPractice}
        >
          {starting ? 'Starting' : 'Practice this'}
        </button>
      </div>
    </article>
  )
}

function TeachingResources({
  overview,
  activeSession,
}: Readonly<{
  overview: SubjectOverview
  activeSession: SessionLibraryEntry | null
}>) {
  const focusModule =
    overview.orderedModules.find(
      (module) => module.id === activeSession?.currentModuleId,
    ) ??
    overview.orderedModules[0] ??
    null
  const focusActivities =
    focusModule === null
      ? overview.subject.activities.slice(0, 3)
      : focusModule.activityIds
          .map((activityId) =>
            overview.subject.activities.find(
              (activity) => activity.id === activityId,
            ),
          )
          .filter((activity) => activity !== undefined)
          .slice(0, 3)

  return (
    <section
      className="learnt-route-resources"
      aria-labelledby="route-resources-title"
    >
      <div className="learnt-route-section-bar">
        <div>
          <p className="learnt-kicker">Route material</p>
          <h2 id="route-resources-title">Teaching resources</h2>
        </div>
      </div>
      <div className="learnt-route-resource-list">
        {focusActivities.map((activity, index) => {
          return (
            <article className="learnt-route-resource-row" key={activity.id}>
              <span aria-hidden="true">
                <ResourceKindIcon activity={activity} index={index} />
              </span>
              <div>
                <h3>{resourceTitle(activity)}</h3>
                <p>
                  {activity.kind} / {activity.scaffoldLevel}
                </p>
              </div>
              <span>{resourceTag(activity, index)}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ConceptList({
  overview,
  currentConceptIds,
  inspectedConceptId,
  onInspect,
}: Readonly<{
  overview: SubjectOverview
  currentConceptIds: readonly ConceptId[]
  inspectedConceptId: ConceptId | null
  onInspect: (conceptId: ConceptId) => void
}>) {
  const visibleConcepts = overview.subject.concepts.slice(0, 14)

  return (
    <section className="learnt-route-concepts" aria-labelledby="concepts-title">
      <h2 id="concepts-title">Concepts</h2>
      <div>
        {visibleConcepts.map((concept, index) => {
          const state = conceptState(concept, currentConceptIds, index)

          return (
            <button
              type="button"
              data-state={state}
              aria-current={
                concept.id === inspectedConceptId ? 'true' : undefined
              }
              key={concept.id}
              onClick={() => {
                onInspect(concept.id)
              }}
            >
              <span aria-hidden="true" />
              <strong>{concept.title}</strong>
              <small>{conceptStateShortLabel(state)}</small>
            </button>
          )
        })}
      </div>
      {overview.subject.concepts.length > visibleConcepts.length ? (
        <p>
          +{overview.subject.concepts.length - visibleConcepts.length} more
          concepts in this route.
        </p>
      ) : null}
    </section>
  )
}

function ProvenancePanel({
  overview,
}: Readonly<{ overview: SubjectOverview }>) {
  return (
    <section
      className="learnt-route-provenance"
      aria-labelledby="provenance-title"
    >
      <p className="learnt-kicker" id="provenance-title">
        Provenance
      </p>
      <div>
        <PackageCheck aria-hidden="true" size={16} strokeWidth={2.2} />
        <span>
          From pack: <strong>{overview.subject.id}</strong>
        </span>
      </div>
      <p>
        v{overview.subject.version} / local / Ready / all authored capabilities
        supported.
      </p>
      <a href={formatRoute({ kind: 'transfer' })}>Manage pack</a>
    </section>
  )
}

function ObjectiveList({
  objectives,
}: Readonly<{ objectives: readonly DeepReadonly<LearningObjective>[] }>) {
  return (
    <div>
      <h4>Observable objectives</h4>
      <ul>
        {objectives.map((objective) => (
          <li key={objective.id}>{objective.statement}</li>
        ))}
      </ul>
    </div>
  )
}

function SessionCompatibility({
  sessions,
}: Readonly<{ sessions: readonly SessionLibraryEntry[] }>) {
  const unavailable = sessions.filter(
    (session) => session.availability !== 'ready',
  )

  if (unavailable.length === 0) {
    return null
  }

  return (
    <section className="learnt-warning-panel" aria-labelledby="compat-title">
      <h2 id="compat-title">Unavailable saved sessions</h2>
      <ul>
        {unavailable.map((session) => (
          <li key={session.sessionId}>
            {session.sessionId}: {availabilityLabel(session.availability)}
          </li>
        ))}
      </ul>
    </section>
  )
}

function buildRouteStats(
  overview: SubjectOverview,
  activeSession: SessionLibraryEntry | null,
): readonly Readonly<{ label: string; value: string }>[] {
  return [
    { label: 'Modules', value: String(overview.subject.modules.length) },
    { label: 'Concepts', value: String(overview.subject.concepts.length) },
    { label: 'Activities', value: String(overview.subject.activities.length) },
    {
      label: 'Status',
      value:
        activeSession === null
          ? 'Ready'
          : activeSession.currentModuleTitle === null
            ? 'Active'
            : `Active / ${activeSession.currentModuleTitle}`,
    },
  ]
}

function subjectGlyph(title: string): string {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

  return initials.length === 0 ? 'RT' : initials
}

function conceptShortLabel(title: string): string {
  const words = title.split(/\s+/).filter(Boolean)

  if (words.length === 1) {
    return words[0]?.slice(0, 2).toUpperCase() ?? 'C'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function routeAccentStyle(title: string): CSSProperties {
  const line = lineForText(title)

  return {
    '--route-accent': `var(--learnt-line-${line})`,
    '--route-accent-rgb': `var(--learnt-line-${line}-rgb)`,
  } as CSSProperties
}

function moduleAccentStyle(index: number): CSSProperties {
  const line = ['a', 'c', 'e', 'b', 'd', 'k'][index % 6] ?? 'a'

  return {
    '--route-accent': `var(--learnt-line-${line})`,
    '--route-accent-rgb': `var(--learnt-line-${line}-rgb)`,
  } as CSSProperties
}

function lineForText(text: string): 'a' | 'b' | 'c' | 'd' | 'e' | 'k' {
  const lower = text.toLowerCase()

  if (lower.includes('logic')) {
    return 'c'
  }

  if (lower.includes('movement')) {
    return 'e'
  }

  if (lower.includes('machine') || lower.includes('ai')) {
    return 'a'
  }

  return 'b'
}

function moduleStatusFor(
  module: DeepReadonly<ModuleDefinition>,
  activeSession: SessionLibraryEntry | null,
): 'current' | 'ready' {
  return module.id === activeSession?.currentModuleId ? 'current' : 'ready'
}

function moduleStatusLabel(status: 'current' | 'ready'): string {
  return status === 'current' ? 'in progress' : 'ready'
}

function ActivityKindIcon({
  activity,
  size,
}: Readonly<{
  activity: DeepReadonly<ActivityDefinition>
  size: number
}>) {
  if (activity.kind === 'predict') {
    return <Zap size={size} strokeWidth={2.2} />
  }

  if (activity.kind === 'recall') {
    return <Boxes size={size} strokeWidth={2.2} />
  }

  if (activity.kind === 'worked-example') {
    return <BookOpen size={size} strokeWidth={2.2} />
  }

  if (activity.kind === 'transfer') {
    return <GitBranch size={size} strokeWidth={2.2} />
  }

  if (activity.response === undefined) {
    return <Play size={size} strokeWidth={2.2} />
  }

  return <Target size={size} strokeWidth={2.2} />
}

function ResourceKindIcon({
  activity,
  index,
}: Readonly<{
  activity: DeepReadonly<ActivityDefinition>
  index: number
}>) {
  if (activity.response === undefined) {
    return <BookOpen size={17} strokeWidth={2.1} />
  }

  if (activity.kind === 'recall') {
    return <Boxes size={17} strokeWidth={2.1} />
  }

  if (index === 0) {
    return <CirclePlay size={17} strokeWidth={2.1} />
  }

  return <ActivityKindIcon activity={activity} size={17} />
}

function resourceTitle(activity: DeepReadonly<ActivityDefinition>): string {
  if (activity.kind === 'worked-example') {
    return `Worked example: ${activity.title}`
  }

  if (activity.response === undefined) {
    return `Reading: ${activity.title}`
  }

  return activity.title
}

function resourceTag(
  activity: DeepReadonly<ActivityDefinition>,
  index: number,
): string {
  if (activity.response === undefined) {
    return 'Primary'
  }

  if (activity.kind === 'recall') {
    return 'Loop'
  }

  return index === 0 ? 'Next' : 'Try'
}

function conceptState(
  concept: DeepReadonly<ConceptDefinition>,
  currentConceptIds: readonly ConceptId[],
  index: number,
): ConceptState {
  if (currentConceptIds.includes(concept.id)) {
    return 'current'
  }

  return index < 3 ? 'covered' : 'queued'
}

function conceptStateLabel(state: ConceptState): string {
  if (state === 'current') {
    return 'Active / current concept'
  }

  if (state === 'covered') {
    return 'Strong evidence'
  }

  return 'Not yet seen'
}

function conceptStateShortLabel(state: ConceptState): string {
  if (state === 'current') {
    return 'active'
  }

  if (state === 'covered') {
    return 'seen'
  }

  return 'new'
}

function conceptTitle(
  overview: SubjectOverview,
  conceptId: ConceptId,
): string | null {
  return (
    overview.subject.concepts.find((concept) => concept.id === conceptId)
      ?.title ?? null
  )
}
