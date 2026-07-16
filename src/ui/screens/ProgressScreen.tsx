import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleAlert,
  Route,
  type LucideIcon,
} from 'lucide-react'

import type {
  PracticeConceptWeakness,
  PracticeItemMetrics,
  PracticeMetricsSummary,
  SessionLibraryEntry,
  SubjectSummary,
} from '../../application'
import { AsyncStateView, formatDateTime } from '../components'
import { useLearntApplication } from '../app/learnt-application-context'
import { mapApplicationError } from '../errors'
import { type AsyncState, useRouteFocus } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

type ProgressData = Readonly<{
  subjects: readonly SubjectSummary[]
  sessions: readonly SessionLibraryEntry[]
  practiceSummary: PracticeMetricsSummary
}>

type ProgressEvidenceState = 'strong' | 'learning' | 'needs' | 'unseen'

type ProgressEvidenceRow = Readonly<{
  id: string
  title: string
  evidence: string
  tag: string
  state: ProgressEvidenceState
  href: string
}>

type ProgressRecommendation = Readonly<{
  id: string
  title: string
  detail: string
  href: string
  state: ProgressEvidenceState
}>

type ProgressOverviewCard = Readonly<{
  id: string
  label: string
  value: string
  detail: string
  state: ProgressEvidenceState
  icon: LucideIcon
}>

type ProgressCoverage = Readonly<{
  assessed: number
  total: number
  percent: number
}>

type ProgressRouteStatusRow = Readonly<{
  id: string
  title: string
  meta: string
  detail: string
  status: string
  state: ProgressEvidenceState
  href: string
}>

type ProgressWeakAreaRow = Readonly<{
  id: string
  title: string
  detail: string
  metric: string
  state: ProgressEvidenceState
  href: string
}>

export function ProgressScreen() {
  const application = useLearntApplication()
  const [state, setState] = useState<AsyncState<ProgressData>>({
    status: 'loading',
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      application.listSessions(),
      application.getPracticeSummary({}),
    ])
      .then(([sessionLibrary, practiceSummary]) => {
        if (cancelled) {
          return
        }

        setState({
          status: 'success',
          data: {
            subjects: application.listSubjects(),
            sessions: sessionLibrary.sessions,
            practiceSummary,
          },
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', error: mapApplicationError(error) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [application, reloadKey])

  return (
    <AsyncStateView
      state={state}
      loadingLabel="Loading progress"
      retryLabel="Reload progress"
      onRetry={() => {
        setState((current) =>
          current.status === 'success'
            ? { status: 'loading', data: current.data }
            : { status: 'loading' },
        )
        setReloadKey((current) => current + 1)
      }}
    >
      {(data) => <ProgressContent data={data} />}
    </AsyncStateView>
  )
}

function ProgressContent({ data }: Readonly<{ data: ProgressData }>) {
  const headingRef = useRouteFocus<HTMLHeadingElement>('progress')
  const vocabulary = useProductVocabulary()
  const recentSessions = data.sessions
    .toSorted((left, right) =>
      right.lastActiveAt.localeCompare(left.lastActiveAt),
    )
    .slice(0, 3)
  const activeSession =
    recentSessions.find(
      (session) =>
        session.sessionStatus === 'active' && session.availability === 'ready',
    ) ?? null
  const primarySubject =
    activeSession === null
      ? (data.subjects[0] ?? null)
      : (data.subjects.find(
          (subject) => subject.id === activeSession.subjectId,
        ) ?? null)
  const evidenceRows = buildEvidenceRows(data.practiceSummary, data.subjects)
  const recommendations = buildRecommendations(
    data.practiceSummary,
    recentSessions,
    data.subjects,
  )
  const overviewCards = buildOverviewCards(data)
  const coverage = buildCoverage(data.practiceSummary)
  const routeRows = buildRouteStatusRows(data.subjects, data.sessions)
  const weakAreas = buildWeakAreas(data.practiceSummary, recentSessions)

  return (
    <section className="learnt-screen learnt-progress-route">
      <div className="learnt-progress-route-header">
        <p className="learnt-kicker">Progress</p>
        <h1 id="progress-title" ref={headingRef} tabIndex={-1}>
          Evidence, not scores
        </h1>
        <p>
          What you have actually demonstrated, and where to point your next
          session.
        </p>
      </div>

      <div className="learnt-progress-overview" aria-label="Progress overview">
        {overviewCards.map((card) => {
          const CardIcon = card.icon

          return (
            <article
              className="learnt-progress-overview-card"
              data-state={card.state}
              key={card.id}
            >
              <span aria-hidden="true">
                <CardIcon size={18} strokeWidth={2.2} />
              </span>
              <div>
                <strong>{card.value}</strong>
                <small>{card.label}</small>
              </div>
              <p>{card.detail}</p>
            </article>
          )
        })}
      </div>

      <div className="learnt-progress-coverage">
        <div>
          <strong>Assessment coverage</strong>
          <small>
            {coverage.total === 0
              ? 'No loop items are available yet'
              : `${String(coverage.assessed)} of ${String(
                  coverage.total,
                )} loop items have evidence`}
          </small>
        </div>
        <div
          aria-label="Assessment coverage"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={coverage.percent}
          className="learnt-progress-coverage-meter"
          role="progressbar"
        >
          <span style={{ width: `${String(coverage.percent)}%` }} />
        </div>
      </div>

      <div className="learnt-progress-legend" aria-label="Evidence legend">
        <LegendItem state="strong" label="Strong evidence" />
        <LegendItem state="learning" label="Learning" />
        <LegendItem state="needs" label="Needs reinforcement" />
        <LegendItem state="unseen" label="Not yet assessed" />
      </div>

      <div className="learnt-progress-layout">
        <div className="learnt-progress-primary-stack">
          <section aria-labelledby="progress-evidence-title">
            <h2 id="progress-evidence-title">
              {primarySubject === null
                ? 'Concept evidence'
                : `Concepts in ${primarySubject.title}`}
            </h2>
            <div className="learnt-progress-evidence-list">
              {evidenceRows.map((row) => (
                <a
                  className="learnt-progress-evidence-row"
                  href={row.href}
                  key={row.id}
                >
                  <span
                    className="learnt-progress-dot"
                    data-state={row.state}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.evidence}</small>
                  </span>
                  <span className="learnt-progress-tag" data-state={row.state}>
                    {row.tag}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section aria-labelledby="progress-route-status-title">
            <h2 id="progress-route-status-title">Route status</h2>
            <div className="learnt-progress-route-list">
              {routeRows.map((row) => (
                <a
                  className="learnt-progress-route-row"
                  data-state={row.state}
                  href={row.href}
                  key={row.id}
                >
                  <span
                    className="learnt-progress-dot"
                    data-state={row.state}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{row.title}</strong>
                    <small>{row.meta}</small>
                    <small>{row.detail}</small>
                  </span>
                  <span className="learnt-progress-tag" data-state={row.state}>
                    {row.status}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>

        <aside className="learnt-progress-aside" aria-label="Progress details">
          <section className="learnt-progress-panel">
            <h2>Recommended next</h2>
            <div className="learnt-progress-action-list">
              {recommendations.map((recommendation) => (
                <a
                  className="learnt-progress-action"
                  data-state={recommendation.state}
                  href={recommendation.href}
                  key={recommendation.id}
                >
                  <span>
                    <strong>{recommendation.title}</strong>
                    <small>{recommendation.detail}</small>
                  </span>
                  <ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
                </a>
              ))}
            </div>
          </section>

          <section className="learnt-progress-panel">
            <h2>Weak areas</h2>
            {weakAreas.length === 0 ? (
              <p className="learnt-progress-empty-note">
                No weak areas yet. Run a few loops and this panel will surface
                the concepts that need reinforcement.
              </p>
            ) : (
              <div className="learnt-progress-weak-list">
                {weakAreas.map((area) => (
                  <a
                    className="learnt-progress-weak-row"
                    data-state={area.state}
                    href={area.href}
                    key={area.id}
                  >
                    <span>
                      <strong>{area.title}</strong>
                      <small>{area.detail}</small>
                    </span>
                    <span
                      className="learnt-progress-tag"
                      data-state={area.state}
                    >
                      {area.metric}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="learnt-progress-panel">
            <h2>Recent sessions</h2>
            <div className="learnt-progress-session-list">
              {recentSessions.length === 0 ? (
                <div className="learnt-progress-session-row">
                  <span>None</span>
                  <strong>No saved sessions yet</strong>
                  <small>{vocabulary.practice.startLabel}</small>
                </div>
              ) : (
                recentSessions.map((session) => (
                  <a
                    className="learnt-progress-session-row"
                    href={sessionHref(session)}
                    key={session.sessionId}
                  >
                    <span>
                      <time dateTime={session.lastActiveAt}>
                        {formatCompactDate(session.lastActiveAt)}
                      </time>
                    </span>
                    <strong>{sessionTitle(session, vocabulary)}</strong>
                    <small>{sessionDetail(session)}</small>
                  </a>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function buildOverviewCards({
  practiceSummary,
  sessions,
}: ProgressData): readonly ProgressOverviewCard[] {
  const items = Object.values(practiceSummary.items)
  const assessedItemCount = items.filter((item) => item.attempts > 0).length
  const totalAttemptCount = items.reduce(
    (total, item) => total + item.attempts,
    0,
  )
  const totalSuccessCount = items.reduce(
    (total, item) => total + item.successes,
    0,
  )
  const evidenceCount = sessions.reduce(
    (total, session) => total + session.evidenceCount,
    0,
  )
  const activeRouteCount = sessions.filter(
    (session) =>
      session.sessionStatus === 'active' && session.availability === 'ready',
  ).length
  const successDetail =
    totalAttemptCount === 0
      ? 'No scored loop attempts yet'
      : `${String(
          Math.round((totalSuccessCount / totalAttemptCount) * 100),
        )}% successful loop attempts`

  return [
    {
      id: 'evidence',
      label: 'Evidence events',
      value: String(evidenceCount),
      detail:
        evidenceCount === 0
          ? 'Start a route to collect evidence'
          : successDetail,
      state: evidenceCount === 0 ? 'unseen' : 'strong',
      icon: Activity,
    },
    {
      id: 'coverage',
      label: 'Loop items assessed',
      value: `${String(assessedItemCount)}/${String(items.length)}`,
      detail: 'Real attempts, not completion theater',
      state: assessedItemCount === 0 ? 'unseen' : 'learning',
      icon: BarChart3,
    },
    {
      id: 'weak',
      label: 'Weak concepts',
      value: String(practiceSummary.weakConcepts.length),
      detail:
        practiceSummary.weakConcepts.length === 0
          ? 'Nothing flagged for reinforcement'
          : 'Needs focused review before advancing',
      state: practiceSummary.weakConcepts.length === 0 ? 'strong' : 'needs',
      icon: CircleAlert,
    },
    {
      id: 'routes',
      label: 'Active routes',
      value: String(activeRouteCount),
      detail:
        activeRouteCount === 0
          ? 'No active route waiting'
          : 'Ready to continue from recent work',
      state: activeRouteCount === 0 ? 'unseen' : 'learning',
      icon: Route,
    },
  ]
}

function buildCoverage(summary: PracticeMetricsSummary): ProgressCoverage {
  const items = Object.values(summary.items)
  const assessed = items.filter((item) => item.attempts > 0).length
  const total = items.length

  return {
    assessed,
    total,
    percent: total === 0 ? 0 : Math.round((assessed / total) * 100),
  }
}

function buildRouteStatusRows(
  subjects: readonly SubjectSummary[],
  sessions: readonly SessionLibraryEntry[],
): readonly ProgressRouteStatusRow[] {
  return subjects
    .map((subject) => {
      const subjectSessions = sessions.filter(
        (session) => session.subjectId === subject.id,
      )
      const activeSession =
        subjectSessions.find(
          (session) =>
            session.sessionStatus === 'active' &&
            session.availability === 'ready',
        ) ?? null
      const evidenceCount = subjectSessions.reduce(
        (total, session) => total + session.evidenceCount,
        0,
      )
      const lastActiveAt = subjectSessions
        .map((session) => session.lastActiveAt)
        .toSorted((left, right) => right.localeCompare(left))[0]
      const state: ProgressEvidenceState =
        activeSession !== null
          ? 'learning'
          : evidenceCount > 0
            ? 'strong'
            : 'unseen'
      const status =
        activeSession !== null
          ? 'In progress'
          : evidenceCount > 0
            ? 'Evidence logged'
            : 'Not assessed'
      const detail =
        evidenceCount > 0
          ? `${pluralize(evidenceCount, 'evidence event', 'evidence events')}${
              lastActiveAt === undefined
                ? ''
                : ` / last active ${formatCompactDate(lastActiveAt)}`
            }`
          : `${pluralize(subject.activityCount, 'activity', 'activities')} ready`
      const href =
        activeSession === null
          ? formatRoute({ kind: 'subject', subjectId: subject.id })
          : formatRoute({ kind: 'session', sessionId: activeSession.sessionId })

      return {
        id: subject.id,
        title: subject.title,
        meta: `${pluralize(subject.moduleCount, 'module', 'modules')} / ${pluralize(
          subject.conceptCount,
          'concept',
          'concepts',
        )}`,
        detail,
        status,
        state,
        href,
      }
    })
    .toSorted(
      (left, right) =>
        progressStateRank(left.state) - progressStateRank(right.state),
    )
}

function buildWeakAreas(
  summary: PracticeMetricsSummary,
  sessions: readonly SessionLibraryEntry[],
): readonly ProgressWeakAreaRow[] {
  const rows: ProgressWeakAreaRow[] = []
  const seenIds = new Set<string>()
  const addRow = (row: ProgressWeakAreaRow) => {
    if (seenIds.has(row.id) || rows.length >= 4) {
      return
    }

    seenIds.add(row.id)
    rows.push(row)
  }

  for (const concept of summary.weakConcepts) {
    addRow(weakConceptToRow(concept))
  }

  for (const item of summary.recentMistakes) {
    addRow({
      id: `mistake:${item.itemId}`,
      title: item.title,
      detail: itemEvidence(item),
      metric: 'Recent miss',
      state: 'learning',
      href: formatRoute({ kind: 'practice' }),
    })
  }

  for (const session of sessions) {
    if (
      rows.length > 0 ||
      session.sessionStatus !== 'active' ||
      session.availability !== 'ready' ||
      session.currentActivityTitle === null
    ) {
      continue
    }

    addRow({
      id: `session:${session.sessionId}`,
      title: session.currentActivityTitle,
      detail: `${session.subjectTitle ?? 'Active route'} / ${pluralize(
        session.evidenceCount,
        'evidence event',
        'evidence events',
      )}`,
      metric: 'In progress',
      state: 'learning',
      href: formatRoute({ kind: 'session', sessionId: session.sessionId }),
    })
  }

  return rows
}

function weakConceptToRow(
  concept: PracticeConceptWeakness,
): ProgressWeakAreaRow {
  return {
    id: `weak:${concept.conceptId}`,
    title: concept.title,
    detail: `${pluralize(
      concept.unsuccessfulAttempts,
      'miss',
      'misses',
    )} across ${pluralize(concept.attempts, 'attempt', 'attempts')}`,
    metric: 'Reinforce',
    state: 'needs',
    href: formatRoute({ kind: 'practice' }),
  }
}

function LegendItem({
  state,
  label,
}: Readonly<{ state: ProgressEvidenceState; label: string }>) {
  return (
    <span>
      <span
        className="learnt-progress-dot"
        data-state={state}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function buildEvidenceRows(
  summary: PracticeMetricsSummary,
  subjects: readonly SubjectSummary[],
): readonly ProgressEvidenceRow[] {
  const rows: ProgressEvidenceRow[] = []
  const seenIds = new Set<string>()
  const addRow = (row: ProgressEvidenceRow) => {
    if (seenIds.has(row.id) || rows.length >= 6) {
      return
    }

    seenIds.add(row.id)
    rows.push(row)
  }

  for (const concept of summary.weakConcepts) {
    addRow({
      id: `weak:${concept.conceptId}`,
      title: concept.title,
      evidence: `${String(concept.unsuccessfulAttempts)} misses across ${String(
        concept.attempts,
      )} attempts`,
      tag: 'Reinforce',
      state: 'needs',
      href: formatRoute({ kind: 'practice' }),
    })
  }

  for (const item of strongestItems(summary)) {
    addRow({
      id: `strong:${item.itemId}`,
      title: item.title,
      evidence: itemEvidence(item),
      tag: 'Strong evidence',
      state: 'strong',
      href: formatRoute({ kind: 'practice' }),
    })
  }

  for (const item of summary.recentMistakes) {
    addRow({
      id: `mistake:${item.itemId}`,
      title: item.title,
      evidence: itemEvidence(item),
      tag: 'Learning',
      state: 'learning',
      href: formatRoute({ kind: 'practice' }),
    })
  }

  for (const item of summary.leastSeen) {
    addRow({
      id: `least-seen:${item.itemId}`,
      title: item.title,
      evidence: item.attempts === 0 ? 'Not practiced yet' : itemEvidence(item),
      tag: item.attempts === 0 ? 'Not assessed' : 'Learning',
      state: item.attempts === 0 ? 'unseen' : 'learning',
      href: formatRoute({ kind: 'practice' }),
    })
  }

  for (const subject of subjects) {
    addRow({
      id: `subject:${subject.id}`,
      title: subject.title,
      evidence: `${String(subject.conceptCount)} concepts ready for assessment`,
      tag: 'Not assessed',
      state: 'unseen',
      href: formatRoute({ kind: 'subject', subjectId: subject.id }),
    })
  }

  if (rows.length === 0) {
    addRow({
      id: 'empty',
      title: 'No evidence yet',
      evidence: 'Start a route or loop session to create progress evidence.',
      tag: 'Not assessed',
      state: 'unseen',
      href: formatRoute({ kind: 'library' }),
    })
  }

  return rows
}

function strongestItems(
  summary: PracticeMetricsSummary,
): readonly PracticeItemMetrics[] {
  return Object.values(summary.items)
    .filter(
      (item) =>
        item.successRate !== null &&
        item.successRate >= 0.8 &&
        item.attempts >= 2,
    )
    .toSorted((left, right) => {
      if (left.successRate === right.successRate) {
        return right.attempts - left.attempts
      }

      return (right.successRate ?? 0) - (left.successRate ?? 0)
    })
    .slice(0, 3)
}

function buildRecommendations(
  summary: PracticeMetricsSummary,
  sessions: readonly SessionLibraryEntry[],
  subjects: readonly SubjectSummary[],
): readonly ProgressRecommendation[] {
  const recommendations: ProgressRecommendation[] = []
  const firstWeakConcept = summary.weakConcepts[0] ?? null
  const firstRecentMistake = summary.recentMistakes[0] ?? null
  const activeSession =
    sessions.find(
      (session) =>
        session.sessionStatus === 'active' && session.availability === 'ready',
    ) ?? null
  const firstSubject = subjects[0] ?? null

  if (firstWeakConcept !== null) {
    recommendations.push({
      id: `weak:${firstWeakConcept.conceptId}`,
      title: `Practice: ${firstWeakConcept.title}`,
      detail: `${String(
        firstWeakConcept.unsuccessfulAttempts,
      )} misses across ${String(firstWeakConcept.attempts)} attempts`,
      href: formatRoute({ kind: 'practice' }),
      state: 'needs',
    })
  }

  if (firstRecentMistake !== null) {
    recommendations.push({
      id: `mistake:${firstRecentMistake.itemId}`,
      title: `Review: ${firstRecentMistake.title}`,
      detail: itemEvidence(firstRecentMistake),
      href: formatRoute({ kind: 'practice' }),
      state: 'learning',
    })
  }

  if (activeSession !== null) {
    recommendations.push({
      id: `session:${activeSession.sessionId}`,
      title: `Continue: ${sessionTitle(activeSession)}`,
      detail:
        activeSession.currentActivityTitle ?? 'Return to the active route',
      href: formatRoute({
        kind: 'session',
        sessionId: activeSession.sessionId,
      }),
      state: 'learning',
    })
  }

  if (firstSubject !== null) {
    recommendations.push({
      id: `subject:${firstSubject.id}`,
      title: `Open: ${firstSubject.title}`,
      detail: `${String(firstSubject.moduleCount)} modules / ${String(
        firstSubject.activityCount,
      )} activities`,
      href: formatRoute({ kind: 'subject', subjectId: firstSubject.id }),
      state: 'unseen',
    })
  }

  if (
    recommendations.length < 2 &&
    !recommendations.some((recommendation) => recommendation.id === 'practice')
  ) {
    recommendations.push({
      id: 'practice',
      title: 'Start a loop',
      detail: 'Run a short evidence-building session.',
      href: formatRoute({ kind: 'practice' }),
      state: 'learning',
    })
  }

  if (
    recommendations.length < 2 &&
    !recommendations.some((recommendation) => recommendation.id === 'library')
  ) {
    recommendations.push({
      id: 'library',
      title: 'Open routes',
      detail: 'Choose a route to begin collecting evidence.',
      href: formatRoute({ kind: 'library' }),
      state: 'unseen',
    })
  }

  return recommendations.slice(0, 2)
}

function itemEvidence(item: PracticeItemMetrics): string {
  if (item.attempts === 0) {
    return 'Not practiced yet'
  }

  const rate =
    item.successRate === null
      ? 'No scored attempts'
      : `${String(Math.round(item.successRate * 100))}% success`
  const last =
    item.lastPracticedAt === null
      ? 'not practiced yet'
      : `last practiced ${formatDateTime(item.lastPracticedAt)}`

  return `${rate} / ${String(item.attempts)} attempts / ${last}`
}

function progressStateRank(state: ProgressEvidenceState): number {
  switch (state) {
    case 'needs':
      return 0
    case 'learning':
      return 1
    case 'strong':
      return 2
    case 'unseen':
      return 3
  }
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`
}

function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function sessionHref(session: SessionLibraryEntry): string {
  return session.availability === 'ready'
    ? formatRoute({ kind: 'session', sessionId: session.sessionId })
    : formatRoute({ kind: 'library' })
}

function sessionTitle(
  session: SessionLibraryEntry,
  vocabulary?: ReturnType<typeof useProductVocabulary>,
): string {
  return (
    session.currentModuleTitle ??
    session.subjectTitle ??
    vocabulary?.library.sessionFallbackPrefix ??
    'Session'
  )
}

function sessionDetail(session: SessionLibraryEntry): string {
  if (session.currentActivityTitle !== null) {
    return session.currentActivityTitle
  }

  return `${session.sessionStatus} / ${String(session.evidenceCount)} evidence events`
}
