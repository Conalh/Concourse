import { useEffect, useState } from 'react'
import { ArrowRight, CirclePlay } from 'lucide-react'

import type {
  LearningPackLibrarySnapshot,
  PracticeMetricsSummary,
  PracticeScopeOption,
  SessionLibraryEntry,
  SubjectSummary,
} from '../../application'
import { AsyncStateView, formatDateTime } from '../components'
import { useLearntApplication } from '../app/learnt-application-context'
import { mapApplicationError } from '../errors'
import { type AsyncState, useRouteFocus } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

type TodayData = Readonly<{
  subjects: readonly SubjectSummary[]
  sessions: readonly SessionLibraryEntry[]
  library: LearningPackLibrarySnapshot
  practiceSummary: PracticeMetricsSummary
  practiceScopes: readonly PracticeScopeOption[]
}>

export function TodayScreen() {
  const application = useLearntApplication()
  const [state, setState] = useState<AsyncState<TodayData>>({
    status: 'loading',
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      application.listSessions(),
      application.getLearningPackLibrary(),
      application.getPracticeSummary({}),
      application.getAvailablePracticeScopes(),
    ])
      .then(([sessionLibrary, library, practiceSummary, practiceScopes]) => {
        if (cancelled) {
          return
        }

        setState({
          status: 'success',
          data: {
            subjects: application.listSubjects(),
            sessions: sessionLibrary.sessions,
            library,
            practiceSummary,
            practiceScopes,
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
      loadingLabel="Loading today"
      retryLabel="Reload today"
      onRetry={() => {
        setState((current) =>
          current.status === 'success'
            ? { status: 'loading', data: current.data }
            : { status: 'loading' },
        )
        setReloadKey((current) => current + 1)
      }}
    >
      {(data) => <TodayContent data={data} />}
    </AsyncStateView>
  )
}

function TodayContent({ data }: Readonly<{ data: TodayData }>) {
  const vocabulary = useProductVocabulary()
  const application = useLearntApplication()
  const learner = application.getLearner()
  const headingRef = useRouteFocus<HTMLHeadingElement>('today')
  const [selectedSessionLength, setSelectedSessionLength] = useState(10)
  const readyActiveSessions = data.sessions
    .filter(
      (session) =>
        session.sessionStatus === 'active' && session.availability === 'ready',
    )
    .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
  const primarySession = readyActiveSessions[0] ?? null
  const primarySubject =
    primarySession === null
      ? (data.subjects[0] ?? null)
      : (data.subjects.find(
          (subject) => subject.id === primarySession.subjectId,
        ) ?? null)
  const recentMistakes = data.practiceSummary.recentMistakes.slice(0, 3)
  const weakConcepts = data.practiceSummary.weakConcepts.slice(0, 3)

  return (
    <section className="learnt-screen learnt-today-screen">
      <div className="learnt-today-header">
        <p className="learnt-kicker">Today / {weekdayLabel()}</p>
        <h1 id="today-title" ref={headingRef} tabIndex={-1}>
          Good to see you, {learner.displayName}.
        </h1>
        <p>Pick up where you left off, or run a short focused session.</p>
      </div>

      {data.subjects.length === 0 ? null : (
        <nav className="learnt-today-chip-row" aria-label="Today subjects">
          {data.subjects.slice(0, 6).map((subject) => (
            <a
              className="learnt-today-chip"
              href={formatRoute({ kind: 'subject', subjectId: subject.id })}
              key={subject.id}
            >
              <span aria-hidden="true" />
              {subject.title}
            </a>
          ))}
        </nav>
      )}

      <section className="learnt-today-primary" aria-labelledby="today-primary">
        <div>
          <p className="learnt-kicker">
            {primarySession === null ? 'Start route' : 'Continue route'}
          </p>
          <h2 id="today-primary">
            {primaryTitle(primarySession, primarySubject)}
          </h2>
          <p>{primaryMessage(primarySession, primarySubject)}</p>
          {primarySession === null ? null : (
            <dl className="learnt-today-inline-stats">
              <div>
                <dt>Current activity</dt>
                <dd>
                  {primarySession.currentActivityTitle ?? 'Next activity'}
                </dd>
              </div>
              <div>
                <dt>Last active</dt>
                <dd>
                  <time dateTime={primarySession.lastActiveAt}>
                    {formatDateTime(primarySession.lastActiveAt)}
                  </time>
                </dd>
              </div>
            </dl>
          )}
        </div>
        <a
          className="learnt-button"
          href={primaryHref(primarySession, primarySubject)}
        >
          {primarySession === null
            ? `Open ${vocabulary.nav.library}`
            : 'Continue'}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={2.4} />
        </a>
      </section>

      <section
        className="learnt-today-short-session"
        aria-label="Short session"
      >
        <div>
          <h2>Got a few minutes?</h2>
          <p>Run weak-concept practice sized to your time.</p>
        </div>
        <div className="learnt-today-lens-row" aria-label="Session length">
          {[5, 10, 20].map((minutes) => (
            <button
              type="button"
              aria-pressed={selectedSessionLength === minutes}
              onClick={() => {
                setSelectedSessionLength(minutes)
              }}
              key={minutes}
            >
              {minutes}m
            </button>
          ))}
        </div>
        <a
          className="learnt-button learnt-button-secondary"
          href={formatRoute({ kind: 'practice' })}
        >
          <CirclePlay aria-hidden="true" size={16} strokeWidth={2.3} />
          Start practice
        </a>
      </section>

      <div className="learnt-today-two-column">
        <TodayList
          title="Due review"
          actionLabel="View all"
          items={
            recentMistakes.length === 0
              ? [
                  {
                    title: 'No recent mistakes yet',
                    detail:
                      'Practice history will appear here after evaluated sessions.',
                    badge: '0',
                  },
                ]
              : recentMistakes.map((item) => ({
                  title: item.title,
                  detail:
                    item.lastPracticedAt === null
                      ? 'Not practiced yet'
                      : `Last practiced ${formatDateTime(item.lastPracticedAt)}`,
                  badge: `${String(item.successes)}/${String(item.attempts)}`,
                }))
          }
        />
        <TodayList
          title="Needs reinforcement"
          actionLabel="Practice weak concepts"
          items={
            weakConcepts.length === 0
              ? [
                  {
                    title: 'No weak concepts yet',
                    detail: 'Weak concepts appear after repeated misses.',
                    badge: 'OK',
                  },
                ]
              : weakConcepts.map((concept) => ({
                  title: concept.title,
                  detail: `${String(
                    concept.unsuccessfulAttempts,
                  )} misses across ${String(concept.attempts)} attempts`,
                  badge: String(concept.weakItemIds.length),
                }))
          }
        />
      </div>
    </section>
  )
}

function TodayList({
  title,
  actionLabel,
  items,
}: Readonly<{
  title: string
  actionLabel: string
  items: readonly {
    title: string
    detail: string
    badge: string
  }[]
}>) {
  return (
    <section className="learnt-today-list" aria-labelledby={domId(title)}>
      <header>
        <h2 id={domId(title)}>{title}</h2>
        <a href={formatRoute({ kind: 'practice' })}>{actionLabel}</a>
      </header>
      <div>
        {items.map((item) => (
          <a
            className="learnt-today-row"
            href={formatRoute({ kind: 'practice' })}
            key={`${item.title}-${item.badge}`}
          >
            <span className="learnt-today-row-badge">{item.badge}</span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
          </a>
        ))}
      </div>
    </section>
  )
}

function primaryTitle(
  session: SessionLibraryEntry | null,
  subject: SubjectSummary | null,
): string {
  if (session !== null) {
    return (
      session.currentModuleTitle ?? session.subjectTitle ?? 'Active session'
    )
  }

  return subject?.title ?? 'No routes registered'
}

function primaryMessage(
  session: SessionLibraryEntry | null,
  subject: SubjectSummary | null,
): string {
  if (session !== null) {
    return session.currentActivityTitle === null
      ? 'Continue the active route from the saved session state.'
      : `Next up: ${session.currentActivityTitle}.`
  }

  return subject === null
    ? 'Install or register a route to begin learning.'
    : subject.summary
}

function primaryHref(
  session: SessionLibraryEntry | null,
  subject: SubjectSummary | null,
): string {
  if (session !== null) {
    return formatRoute({ kind: 'session', sessionId: session.sessionId })
  }

  if (subject !== null) {
    return formatRoute({ kind: 'subject', subjectId: subject.id })
  }

  return formatRoute({ kind: 'library' })
}

function weekdayLabel(): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(
    new Date(),
  )
}

function domId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
