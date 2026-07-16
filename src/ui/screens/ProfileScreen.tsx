import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleAlert,
  Target,
  type LucideIcon,
} from 'lucide-react'

import type {
  PracticeMetricsSummary,
  ProductVocabularyMode,
  SessionLibraryEntry,
  SubjectSummary,
  ThemeMode,
} from '../../application'
import { useLearntApplication } from '../app/learnt-application-context'
import { useRouteFocus } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

type ProfileScreenProps = Readonly<{
  themeMode: ThemeMode
  vocabularyMode: ProductVocabularyMode
  onThemeModeChange: (mode: ThemeMode) => void
  onVocabularyModeChange: (mode: ProductVocabularyMode) => void
}>

type ProfileGoal = Readonly<{
  id: string
  label: string
  meta: string
}>

type ProfileRouteRow = Readonly<{
  id: string
  glyph: string
  title: string
  meta: string
  percent: number
  href: string
  tone: 'a' | 'b' | 'c' | 'd' | 'e' | 'k'
}>

type ProfileMetricCard = Readonly<{
  id: string
  label: string
  value: string
  detail: string
  state: 'ready' | 'learning' | 'attention' | 'quiet'
  icon: LucideIcon
}>

type ProfileAccountAction = Readonly<{
  id: string
  title: string
  detail: string
  href: string
}>

export function ProfileScreen({
  themeMode,
  vocabularyMode,
  onThemeModeChange,
  onVocabularyModeChange,
}: ProfileScreenProps) {
  const application = useLearntApplication()
  const vocabulary = useProductVocabulary()
  const learner = application.getLearner()
  const subjects = application.listSubjects()
  const [sessions, setSessions] = useState<readonly SessionLibraryEntry[]>([])
  const [practiceSummary, setPracticeSummary] =
    useState<PracticeMetricsSummary | null>(null)
  const headingRef = useRouteFocus<HTMLHeadingElement>('profile')
  const routeRows = buildProfileRouteRows(subjects, sessions)
  const goals = buildProfileGoals(subjects, sessions, vocabulary.nav.practice)
  const profileSummary = profileSummaryText(subjects, sessions, vocabulary)
  const metricCards = buildProfileMetricCards(
    subjects,
    sessions,
    practiceSummary,
  )
  const accountActions = buildProfileAccountActions(vocabulary)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      application.listSessions(),
      application.getPracticeSummary({}),
    ])
      .then(([snapshot, summary]) => {
        if (!cancelled) {
          setSessions(snapshot.sessions)
          setPracticeSummary(summary)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessions([])
          setPracticeSummary(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [application])

  return (
    <section className="learnt-screen learnt-profile-route">
      <header className="learnt-profile-route-header">
        <span className="learnt-profile-route-avatar" aria-hidden="true">
          {profileInitial(learner.displayName)}
        </span>
        <div>
          <h1 id="profile-title" ref={headingRef} tabIndex={-1}>
            {learner.displayName}
          </h1>
          <p>{profileSummary}</p>
        </div>
      </header>

      <section
        className="learnt-profile-evidence"
        aria-labelledby="profile-evidence"
      >
        <div className="learnt-profile-section-heading">
          <h2 id="profile-evidence">Evidence summary</h2>
          <p>Real work saved on this device, grouped by route and loop.</p>
        </div>
        <div className="learnt-profile-metric-grid">
          {metricCards.map((card) => {
            const CardIcon = card.icon

            return (
              <article
                className="learnt-profile-metric-card"
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
      </section>

      <div className="learnt-profile-route-grid">
        <section aria-labelledby="profile-goals">
          <div className="learnt-profile-section-heading">
            <h2 id="profile-goals">Goals</h2>
          </div>
          <div className="learnt-profile-goal-list">
            {goals.map((goal) => (
              <article className="learnt-profile-goal" key={goal.id}>
                <Target aria-hidden="true" size={16} strokeWidth={2.1} />
                <span>
                  <strong>{goal.label}</strong>
                  <small>{goal.meta}</small>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="profile-active-routes">
          <div className="learnt-profile-section-heading">
            <h2 id="profile-active-routes">Active Routes</h2>
          </div>
          <div className="learnt-profile-route-list">
            {routeRows.map((row) => (
              <a
                className="learnt-profile-route-card"
                href={row.href}
                key={row.id}
              >
                <span
                  className="learnt-profile-route-glyph"
                  data-tone={row.tone}
                  aria-hidden="true"
                >
                  {row.glyph}
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <small>{row.meta}</small>
                </span>
                <span className="learnt-profile-route-percent">
                  {String(row.percent)}%
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <div className="learnt-profile-lower-grid">
        <section aria-labelledby="profile-preferences">
          <div className="learnt-profile-section-heading">
            <h2 id="profile-preferences">Presentation preferences</h2>
          </div>
          <div className="learnt-profile-preference-list">
            <PreferenceSwitch
              label="Concourse names"
              description={`${vocabulary.nav.library}, ${vocabulary.nav.practice}, and ${vocabulary.nav.transfer} labels`}
              checked={vocabularyMode === 'branded'}
              onToggle={() => {
                onVocabularyModeChange(
                  vocabularyMode === 'branded' ? 'plain' : 'branded',
                )
              }}
            />
            <PreferenceSwitch
              label="Dark appearance"
              description="Saved to this device"
              checked={themeMode === 'dark'}
              onToggle={() => {
                onThemeModeChange(themeMode === 'dark' ? 'light' : 'dark')
              }}
            />
            <div className="learnt-profile-preference-row" data-static="true">
              <span>
                <strong>Evidence-first progress</strong>
                <small>
                  Progress surfaces show observed work before scores.
                </small>
              </span>
              <span className="learnt-profile-static-state">On</span>
            </div>
          </div>
          <p className="learnt-profile-preference-note">
            These adapt how Concourse presents material. They are editable
            preferences, not fixed labels about how you learn.
          </p>
        </section>

        <section aria-labelledby="profile-account-controls">
          <div className="learnt-profile-section-heading">
            <h2 id="profile-account-controls">Account controls</h2>
          </div>
          <div className="learnt-profile-account-list">
            {accountActions.map((action) => (
              <a
                className="learnt-profile-account-action"
                href={action.href}
                aria-label={action.title}
                key={action.id}
              >
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </span>
                <ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function PreferenceSwitch({
  label,
  description,
  checked,
  onToggle,
}: Readonly<{
  label: string
  description: string
  checked: boolean
  onToggle: () => void
}>) {
  return (
    <div className="learnt-profile-preference-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        className="learnt-profile-switch"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  )
}

function buildProfileMetricCards(
  subjects: readonly SubjectSummary[],
  sessions: readonly SessionLibraryEntry[],
  practiceSummary: PracticeMetricsSummary | null,
): readonly ProfileMetricCard[] {
  const evidenceCount = sessions.reduce(
    (total, session) => total + session.evidenceCount,
    0,
  )
  const activeRouteCount = sessions.filter(
    (session) =>
      session.sessionStatus === 'active' && session.availability === 'ready',
  ).length
  const items =
    practiceSummary === null ? [] : Object.values(practiceSummary.items)
  const assessedItems = items.filter((item) => item.attempts > 0).length
  const weakConcepts = practiceSummary?.weakConcepts.length ?? 0

  return [
    {
      id: 'evidence',
      label: 'Evidence events',
      value: String(evidenceCount),
      detail:
        evidenceCount === 0
          ? 'Start a route to collect proof'
          : 'Observed route work saved locally',
      state: evidenceCount === 0 ? 'quiet' : 'ready',
      icon: Activity,
    },
    {
      id: 'routes',
      label: 'Active routes',
      value: String(activeRouteCount),
      detail: `${String(subjects.length)} routes available`,
      state: activeRouteCount === 0 ? 'quiet' : 'learning',
      icon: Target,
    },
    {
      id: 'loops',
      label: 'Loop items assessed',
      value: `${String(assessedItems)}/${String(items.length)}`,
      detail: 'Retrieval practice coverage',
      state: assessedItems === 0 ? 'quiet' : 'learning',
      icon: BarChart3,
    },
    {
      id: 'weak',
      label: 'Weak concepts',
      value: String(weakConcepts),
      detail:
        weakConcepts === 0
          ? 'Nothing flagged yet'
          : 'Needs focused reinforcement',
      state: weakConcepts === 0 ? 'ready' : 'attention',
      icon: CircleAlert,
    },
  ]
}

function buildProfileAccountActions(
  vocabulary: ReturnType<typeof useProductVocabulary>,
): readonly ProfileAccountAction[] {
  return [
    {
      id: 'settings',
      title: 'Settings',
      detail: 'Naming, appearance, local state',
      href: formatRoute({ kind: 'settings' }),
    },
    {
      id: 'progress',
      title: 'Progress evidence',
      detail: 'Review route and loop evidence',
      href: formatRoute({ kind: 'progress' }),
    },
    {
      id: 'transfer',
      title: vocabulary.nav.transfer,
      detail: 'Import or inspect shared packs',
      href: formatRoute({ kind: 'transfer' }),
    },
  ]
}

function buildProfileGoals(
  subjects: readonly SubjectSummary[],
  sessions: readonly SessionLibraryEntry[],
  practiceLabel: string,
): readonly ProfileGoal[] {
  const completedSessions = sessions.filter(
    (session) => session.sessionStatus === 'completed',
  ).length
  const activeSessions = sessions.filter(
    (session) => session.sessionStatus === 'active',
  ).length

  return [
    {
      id: 'route-evidence',
      label: 'Build durable route evidence',
      meta: `${String(subjects.length)} local routes ready to collect proof`,
    },
    {
      id: 'practice-loop',
      label: `Keep ${practiceLabel} tied to weak spots`,
      meta:
        completedSessions === 0
          ? 'Complete a session to seed recommendations'
          : `${String(completedSessions)} completed sessions, ${String(
              activeSessions,
            )} still active`,
    },
  ]
}

function buildProfileRouteRows(
  subjects: readonly SubjectSummary[],
  sessions: readonly SessionLibraryEntry[],
): readonly ProfileRouteRow[] {
  const tones: ProfileRouteRow['tone'][] = ['a', 'd', 'c', 'e', 'b', 'k']
  const newestReadySessionBySubject = new Map<string, SessionLibraryEntry>()

  for (const session of sessions
    .filter((candidate) => candidate.availability === 'ready')
    .toSorted((left, right) =>
      right.lastActiveAt.localeCompare(left.lastActiveAt),
    )) {
    if (!newestReadySessionBySubject.has(session.subjectId)) {
      newestReadySessionBySubject.set(session.subjectId, session)
    }
  }

  return subjects.slice(0, 3).map((subject, index) => {
    const session = newestReadySessionBySubject.get(subject.id) ?? null
    const percent =
      session === null
        ? 0
        : Math.min(
            session.sessionStatus === 'completed' ? 100 : 99,
            Math.round((session.evidenceCount / subject.activityCount) * 100),
          )
    const href =
      session?.sessionStatus === 'active'
        ? formatRoute({ kind: 'session', sessionId: session.sessionId })
        : formatRoute({ kind: 'subject', subjectId: subject.id })

    return {
      id: subject.id,
      glyph: routeGlyph(subject.title),
      title: subject.title,
      meta:
        session?.currentActivityTitle ??
        `${String(subject.moduleCount)} modules / ${String(
          subject.activityCount,
        )} activities`,
      percent,
      href,
      tone: tones[index % tones.length] ?? 'a',
    }
  })
}

function profileInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || 'L'
}

function routeGlyph(title: string): string {
  const parts = title
    .split(/\s+/)
    .map((part) => /[A-Za-z0-9]/u.exec(part)?.[0])
    .filter((part) => part !== undefined)

  return parts.slice(0, 2).join('').toUpperCase() || 'RT'
}

function profileSummaryText(
  subjects: readonly SubjectSummary[],
  sessions: readonly SessionLibraryEntry[],
  vocabulary: ReturnType<typeof useProductVocabulary>,
): string {
  const completedSessions = sessions.filter(
    (session) => session.sessionStatus === 'completed',
  ).length
  const routeLabel = vocabulary.terms.subjectPlural

  if (completedSessions > 0) {
    return `Learning across ${String(subjects.length)} ${routeLabel.toLowerCase()} / ${String(completedSessions)} completed sessions.`
  }

  return `Learning across ${String(subjects.length)} ${routeLabel.toLowerCase()} / prefers compact, example-first explanations.`
}
