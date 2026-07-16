import { useEffect, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CirclePlay,
  Clock3,
  Target,
} from 'lucide-react'

import type {
  PracticeConceptWeakness,
  PracticeItemMetrics,
  PracticeMode,
  PracticeMetricsSummary,
  PracticePresetKind,
  PracticeRequest,
  PracticeScope,
  PracticeScopeOption,
  PracticeSelectionStrategy,
} from '../../application'
import { AsyncStateView, RecoverableError } from '../components'
import { mapApplicationError, type UiError } from '../errors'
import { useLearntApplication } from '../app/learnt-application-context'
import { type AsyncState, useRouteFocus } from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary } from '../vocabulary'

type PracticePack = Readonly<{
  packId: string
  title: string
}>

type PracticeStudySet = Readonly<{
  key: string
  packId: string
  studySetId: string
  title: string
  itemCount: number
}>

type PracticeScreenData = Readonly<{
  scopes: readonly PracticeScopeOption[]
  packs: readonly PracticePack[]
  summary: PracticeMetricsSummary
  studySets: readonly PracticeStudySet[]
}>

const modes: readonly PracticeMode[] = ['mixed', 'flashcard', 'quiz', 'recall']
const strategies: readonly PracticeSelectionStrategy[] = [
  'due-or-weak',
  'authored-order',
  'random',
  'weakest-first',
  'recent-mistakes',
  'least-seen',
  'balanced-by-concept',
]

export function PracticeScreen() {
  const application = useLearntApplication()
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>('practice-screen')
  const [state, setState] = useState<AsyncState<PracticeScreenData>>({
    status: 'loading',
  })
  const [selectedScopeKey, setSelectedScopeKey] = useState('')
  const [mode, setMode] = useState<PracticeMode>('mixed')
  const [strategy, setStrategy] =
    useState<PracticeSelectionStrategy>('due-or-weak')
  const [count, setCount] = useState(8)
  const [reloadKey, setReloadKey] = useState(0)
  const [startError, setStartError] = useState<UiError | null>(null)
  const [startingAction, setStartingAction] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      application.getAvailablePracticeScopes(),
      application.getPracticeSummary({}),
    ])
      .then(([scopes, summary]) => {
        if (cancelled) {
          return
        }

        const packs = application
          .getInstalledLearningPacksForRuntime()
          .map((pack) => ({
            packId: pack.packId,
            title: pack.documents.manifest.title,
          }))

        setState({
          status: 'success',
          data: {
            scopes,
            packs,
            summary,
            studySets: buildStudySetRows(scopes),
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

  const selectedScope =
    state.status === 'success'
      ? (state.data.scopes.find(
          (scope) => scopeKey(scope) === selectedScopeKey,
        ) ??
        state.data.scopes[0] ??
        null)
      : null
  const selectedScopeValue =
    selectedScope === null ? '' : scopeKey(selectedScope)

  return (
    <AsyncStateView
      state={state}
      loadingLabel={vocabulary.practice.loadingLabel}
      retryLabel={vocabulary.practice.retryLabel}
      onRetry={() => {
        setState((current) =>
          current.status === 'success'
            ? { status: 'loading', data: current.data }
            : { status: 'loading' },
        )
        setReloadKey((current) => current + 1)
      }}
    >
      {(data) => {
        const scope = selectedScope ?? data.scopes[0] ?? null
        const scopeValue = scope === null ? '' : scopeKey(scope)
        const startRequest = (request: PracticeRequest, actionId: string) => {
          setStartingAction(actionId)
          setStartError(null)
          void application
            .startPracticeSession(request)
            .then((started) => {
              window.location.hash = formatRoute({
                kind: 'session',
                sessionId: started.context.record.session.id,
              })
            })
            .catch((error: unknown) => {
              setStartError(mapApplicationError(error))
            })
            .finally(() => {
              setStartingAction(null)
            })
        }
        const startPreset = (
          kind: PracticePresetKind,
          actionId: string,
          extra: Partial<{
            packId: string
            subjectId: string
            studySetId: string
          }> = {},
        ) => {
          try {
            startRequest(
              application.createPracticePreset({
                kind,
                ...presetTarget(data, scope),
                ...extra,
                origin: practiceOrigin(),
              }),
              actionId,
            )
          } catch (error: unknown) {
            setStartError(mapApplicationError(error))
          }
        }
        const startCustom = (
          overrides: Readonly<{
            mode: PracticeMode
            selectionStrategy: PracticeSelectionStrategy
            count: number
          }>,
          actionId: string,
        ) => {
          const practiceScope =
            scope === null ? null : practiceScopeFromOption(scope)

          if (practiceScope === null) {
            return
          }

          startRequest(
            {
              scope: practiceScope,
              mode: overrides.mode,
              selectionStrategy: overrides.selectionStrategy,
              count: overrides.count,
              origin: practiceOrigin(),
            },
            actionId,
          )
        }
        const busy = startingAction !== null
        const weakConcepts = data.summary.weakConcepts.slice(0, 3)
        const recentMistakes = data.summary.recentMistakes.slice(0, 3)
        const weakestPreset: PracticePresetKind =
          data.summary.weakConcepts.length > 0 ? 'weakest-concepts' : 'quiz-me'
        const hasPracticePacks = data.packs.length > 0

        return (
          <section
            className="learnt-screen learnt-loop-screen"
            aria-labelledby="practice-title"
          >
            <header className="learnt-loop-header">
              <p className="learnt-kicker">{vocabulary.practice.kicker}</p>
              <h1 id="practice-title" ref={headingRef} tabIndex={-1}>
                Retrieve &amp; reinforce
              </h1>
              <p>
                Fast, focused recall. Start in two taps, then tune the rest only
                when you need to.
              </p>
            </header>

            <section
              className="learnt-loop-launch-grid"
              aria-label="Fast Loop starts"
            >
              <LoopLaunchCard
                accent="a"
                title="Quick Practice"
                description="Mixed items, weak-first."
                meta="About 10 min"
                icon={<CirclePlay aria-hidden="true" size={24} />}
                disabled={busy || !hasPracticePacks}
                isStarting={startingAction === 'quick-practice'}
                onClick={() => {
                  startPreset('quick-practice', 'quick-practice')
                }}
              />
              <LoopLaunchCard
                accent="e"
                title="Due Review"
                description={dueReviewDescription(recentMistakes)}
                meta={dueReviewMeta(data.summary)}
                icon={<Clock3 aria-hidden="true" size={24} />}
                disabled={busy || !hasPracticePacks}
                isStarting={startingAction === 'due-review'}
                onClick={() => {
                  startPreset(
                    data.summary.recentMistakes.length > 0
                      ? 'recent-mistakes'
                      : 'flashcards',
                    'due-review',
                  )
                }}
              />
              <LoopLaunchCard
                accent="b"
                title="Weakest Concepts"
                description={weakConceptDescription(weakConcepts)}
                meta={
                  data.summary.weakConcepts.length > 0
                    ? `${String(data.summary.weakConcepts.length)} weak concepts`
                    : 'Balanced quiz fallback'
                }
                icon={<Target aria-hidden="true" size={24} />}
                disabled={busy || !hasPracticePacks}
                isStarting={startingAction === 'weakest-concepts'}
                onClick={() => {
                  startPreset(weakestPreset, 'weakest-concepts')
                }}
              />
            </section>

            {hasPracticePacks ? null : (
              <section className="learnt-panel" aria-label="No packs">
                <h2>{vocabulary.practice.noPacksTitle}</h2>
                <p>{vocabulary.practice.noPacksMessage}</p>
              </section>
            )}

            {startError === null ? null : (
              <RecoverableError error={startError} />
            )}

            <div className="learnt-loop-content-grid">
              <section
                className="learnt-loop-panel"
                aria-labelledby="loop-modes-title"
              >
                <div className="learnt-loop-section-header">
                  <h2 id="loop-modes-title">Choose a mode</h2>
                </div>
                <div className="learnt-loop-row-list">
                  <ModeRow
                    mode="mixed"
                    title="Mixed practice"
                    detail="Interleaves flashcards, quiz, and recall."
                    disabled={busy || !hasPracticePacks}
                    isStarting={startingAction === 'mode-mixed'}
                    onClick={() => {
                      startPreset('quick-practice', 'mode-mixed')
                    }}
                  />
                  <ModeRow
                    mode="flashcard"
                    title="Flashcards"
                    detail="Least-seen cards first."
                    disabled={busy || !hasPracticePacks}
                    isStarting={startingAction === 'mode-flashcard'}
                    onClick={() => {
                      startPreset('flashcards', 'mode-flashcard')
                    }}
                  />
                  <ModeRow
                    mode="quiz"
                    title="Quiz me"
                    detail="Balanced checks across concepts."
                    disabled={busy || !hasPracticePacks}
                    isStarting={startingAction === 'mode-quiz'}
                    onClick={() => {
                      startPreset('quiz-me', 'mode-quiz')
                    }}
                  />
                  <ModeRow
                    mode="recall"
                    title="Recall"
                    detail="Open-ended retrieval with fewer prompts."
                    disabled={busy || scope === null}
                    isStarting={startingAction === 'mode-recall'}
                    onClick={() => {
                      startCustom(
                        {
                          mode: 'recall',
                          selectionStrategy: 'balanced-by-concept',
                          count: 8,
                        },
                        'mode-recall',
                      )
                    }}
                  />
                </div>
              </section>

              <section
                className="learnt-loop-panel"
                aria-labelledby="loop-sets-title"
              >
                <div className="learnt-loop-section-header">
                  <h2 id="loop-sets-title">
                    Recommended {vocabulary.terms.studySetPlural}
                  </h2>
                  <a href={formatRoute({ kind: 'library' })}>Browse all</a>
                </div>
                <div className="learnt-loop-row-list">
                  {data.studySets.slice(0, 4).map((studySet, index) => (
                    <StudySetRow
                      key={studySet.key}
                      studySet={studySet}
                      index={index}
                      disabled={busy || !hasPracticePacks}
                      isStarting={
                        startingAction === `study-set-${studySet.key}`
                      }
                      onClick={() => {
                        startPreset(
                          'study-set-practice',
                          `study-set-${studySet.key}`,
                          {
                            packId: studySet.packId,
                            studySetId: studySet.studySetId,
                          },
                        )
                      }}
                    />
                  ))}
                  {data.studySets.length === 0 ? (
                    <div className="learnt-loop-empty-row">
                      <BookOpen
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.3}
                      />
                      <span>
                        <strong>No authored sets yet</strong>
                        <small>
                          Use Quick Practice or tune a scoped session.
                        </small>
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <form
              className="learnt-loop-tune-panel"
              aria-label={vocabulary.practice.launcherAriaLabel}
              onSubmit={(event) => {
                event.preventDefault()
                if (scope === null) {
                  return
                }

                const practiceScope = practiceScopeFromOption(scope)
                if (practiceScope === null) {
                  return
                }

                startRequest(
                  {
                    scope: practiceScope,
                    mode,
                    selectionStrategy: strategy,
                    count,
                    origin: practiceOrigin(),
                  },
                  'custom',
                )
              }}
            >
              <div className="learnt-loop-tune-copy">
                <p className="learnt-kicker">Tune session</p>
                <h2>Fine-control the next run</h2>
                <p>
                  Scope down to a route, concept, or authored set when the fast
                  starts are too broad.
                </p>
              </div>
              <div className="learnt-loop-form-grid">
                <label>
                  <span>{vocabulary.practice.scopeLabel}</span>
                  <select
                    value={selectedScopeValue || scopeValue}
                    onChange={(event) => {
                      setSelectedScopeKey(event.target.value)
                    }}
                  >
                    {data.scopes.map((option) => (
                      <option key={scopeKey(option)} value={scopeKey(option)}>
                        {optionLabel(option, vocabulary)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{vocabulary.practice.modeLabel}</span>
                  <select
                    value={mode}
                    onChange={(event) => {
                      setMode(event.target.value as PracticeMode)
                    }}
                  >
                    {modes.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {modeLabel(candidate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Selection</span>
                  <select
                    value={strategy}
                    onChange={(event) => {
                      setStrategy(
                        event.target.value as PracticeSelectionStrategy,
                      )
                    }}
                  >
                    {strategies.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {strategyLabel(candidate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Items</span>
                  <input
                    min={1}
                    max={50}
                    type="number"
                    value={count}
                    onChange={(event) => {
                      setCount(Number(event.target.value))
                    }}
                  />
                </label>
              </div>
              <div className="learnt-loop-tune-actions">
                <button
                  className="learnt-button"
                  type="submit"
                  disabled={busy || scope === null}
                >
                  {startingAction === 'custom'
                    ? vocabulary.practice.startingLabel
                    : vocabulary.practice.startLabel}
                  <ArrowRight aria-hidden="true" size={16} strokeWidth={2.4} />
                </button>
              </div>
            </form>
          </section>
        )
      }}
    </AsyncStateView>
  )
}

function practiceOrigin() {
  return {
    kind: 'library' as const,
    returnRoute: formatRoute({ kind: 'practice' }),
  }
}

function presetTarget(
  data: PracticeScreenData,
  scope: PracticeScopeOption | null,
): Partial<{ packId: string; subjectId: string }> {
  const packId = scope?.packId ?? data.packs[0]?.packId
  const subjectId = scope?.kind === 'subject' ? scope.subjectId : undefined

  return {
    ...(packId === undefined ? {} : { packId }),
    ...(subjectId === undefined ? {} : { subjectId }),
  }
}

function buildStudySetRows(
  scopes: readonly PracticeScopeOption[],
): readonly PracticeStudySet[] {
  return scopes
    .filter(
      (
        scope,
      ): scope is PracticeScopeOption & {
        kind: 'study-set'
        packId: string
        studySetId: string
      } =>
        scope.kind === 'study-set' &&
        scope.packId !== undefined &&
        scope.studySetId !== undefined,
    )
    .map((scope) => ({
      key: scopeKey(scope),
      packId: scope.packId,
      studySetId: scope.studySetId,
      title: scope.label,
      itemCount: scope.itemCount,
    }))
}

function dueReviewDescription(
  recentMistakes: readonly PracticeItemMetrics[],
): string {
  if (recentMistakes.length === 0) {
    return 'Least-seen cards queued for review.'
  }

  return recentMistakes
    .map((mistake) => mistake.title)
    .slice(0, 2)
    .join(' / ')
}

function dueReviewMeta(summary: PracticeMetricsSummary): string {
  if (summary.recentMistakes.length === 0) {
    return 'No recent misses'
  }

  return `${String(summary.recentMistakes.length)} recent misses`
}

function weakConceptDescription(
  concepts: readonly PracticeConceptWeakness[],
): string {
  if (concepts.length === 0) {
    return 'Balanced checks until weak spots appear.'
  }

  return concepts.map((concept) => concept.title).join(' / ')
}

function LoopLaunchCard({
  accent,
  title,
  description,
  meta,
  icon,
  disabled,
  isStarting,
  onClick,
}: Readonly<{
  accent: 'a' | 'b' | 'e'
  title: string
  description: string
  meta: string
  icon: ReactNode
  disabled: boolean
  isStarting: boolean
  onClick: () => void
}>) {
  return (
    <button
      className="learnt-loop-launch-card"
      data-accent={accent}
      type="button"
      disabled={disabled}
      aria-busy={isStarting || undefined}
      onClick={onClick}
    >
      <span className="learnt-loop-launch-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{isStarting ? 'Starting...' : description}</small>
      </span>
      <em>{meta}</em>
    </button>
  )
}

function ModeRow({
  mode,
  title,
  detail,
  disabled,
  isStarting,
  onClick,
}: Readonly<{
  mode: PracticeMode
  title: string
  detail: string
  disabled: boolean
  isStarting: boolean
  onClick: () => void
}>) {
  return (
    <button
      className="learnt-loop-row"
      type="button"
      disabled={disabled}
      aria-busy={isStarting || undefined}
      onClick={onClick}
    >
      <span className="learnt-loop-row-icon" data-mode={mode}>
        <PracticeModeIcon mode={mode} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{isStarting ? 'Starting...' : detail}</small>
      </span>
      <ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
    </button>
  )
}

function PracticeModeIcon({ mode }: Readonly<{ mode: PracticeMode }>) {
  switch (mode) {
    case 'mixed':
      return <BrainCircuit aria-hidden="true" size={18} strokeWidth={2.3} />
    case 'flashcard':
      return <BookOpen aria-hidden="true" size={18} strokeWidth={2.3} />
    case 'quiz':
      return <Target aria-hidden="true" size={18} strokeWidth={2.3} />
    case 'recall':
      return <CirclePlay aria-hidden="true" size={18} strokeWidth={2.3} />
  }
}

function StudySetRow({
  studySet,
  index,
  disabled,
  isStarting,
  onClick,
}: Readonly<{
  studySet: PracticeStudySet
  index: number
  disabled: boolean
  isStarting: boolean
  onClick: () => void
}>) {
  const accent = ['a', 'c', 'd', 'k'][index % 4] ?? 'a'

  return (
    <button
      className="learnt-loop-row learnt-loop-set-row"
      type="button"
      data-accent={accent}
      disabled={disabled}
      aria-busy={isStarting || undefined}
      onClick={onClick}
    >
      <span className="learnt-loop-set-avatar" aria-hidden="true">
        {studySet.title.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{studySet.title}</strong>
        <small>
          {String(studySet.itemCount)} item
          {studySet.itemCount === 1 ? '' : 's'} / flashcard-first
        </small>
      </span>
      <span className="learnt-loop-mode-badge">Loop</span>
    </button>
  )
}

function practiceScopeFromOption(
  option: PracticeScopeOption,
): PracticeScope | null {
  switch (option.kind) {
    case 'pack':
      return option.packId === undefined
        ? null
        : { kind: 'pack', packId: option.packId }
    case 'subject':
      return option.subjectId === undefined
        ? null
        : {
            kind: 'subject',
            ...(option.packId === undefined ? {} : { packId: option.packId }),
            subjectId: option.subjectId,
          }
    case 'course':
      return option.packId === undefined || option.courseId === undefined
        ? null
        : {
            kind: 'course',
            packId: option.packId,
            courseId: option.courseId,
          }
    case 'curriculum-node':
      return option.packId === undefined ||
        option.courseId === undefined ||
        option.nodeId === undefined
        ? null
        : {
            kind: 'curriculum-node',
            packId: option.packId,
            courseId: option.courseId,
            nodeId: option.nodeId,
            includeDescendants: true,
          }
    case 'concept':
      return option.packId === undefined || option.conceptId === undefined
        ? null
        : {
            kind: 'concepts',
            packId: option.packId,
            conceptIds: [option.conceptId],
          }
    case 'objective':
      return option.packId === undefined || option.objectiveId === undefined
        ? null
        : {
            kind: 'objectives',
            packId: option.packId,
            objectiveIds: [option.objectiveId],
          }
    case 'study-set':
      return option.packId === undefined || option.studySetId === undefined
        ? null
        : {
            kind: 'study-set',
            packId: option.packId,
            studySetId: option.studySetId,
          }
    case 'weak-items':
      return {
        kind: 'weak-items',
        ...(option.packId === undefined ? {} : { packId: option.packId }),
        ...(option.subjectId === undefined
          ? {}
          : { subjectId: option.subjectId }),
      }
    case 'recent-mistakes':
      return {
        kind: 'recent-mistakes',
        ...(option.packId === undefined ? {} : { packId: option.packId }),
        ...(option.subjectId === undefined
          ? {}
          : { subjectId: option.subjectId }),
      }
  }
}

function scopeKey(scope: PracticeScopeOption): string {
  return [
    scope.kind,
    scope.packId,
    scope.subjectId,
    scope.courseId,
    scope.nodeId,
    scope.conceptId,
    scope.objectiveId,
    scope.studySetId,
  ]
    .filter((value): value is string => value !== undefined)
    .join(':')
}

function optionLabel(
  option: PracticeScopeOption,
  vocabulary: ReturnType<typeof useProductVocabulary>,
): string {
  return `${scopeKindLabel(option.kind, vocabulary)} / ${
    option.label
  } (${String(option.itemCount)})`
}

function scopeKindLabel(
  kind: PracticeScopeOption['kind'],
  vocabulary: ReturnType<typeof useProductVocabulary>,
): string {
  switch (kind) {
    case 'pack':
      return vocabulary.terms.packSingular
    case 'subject':
      return vocabulary.terms.subjectSingular
    case 'course':
      return vocabulary.terms.courseSingular
    case 'curriculum-node':
      return 'Curriculum'
    case 'concept':
      return 'Concept'
    case 'objective':
      return 'Objective'
    case 'study-set':
      return vocabulary.terms.studySetSingular
    case 'weak-items':
      return 'Weak'
    case 'recent-mistakes':
      return 'Mistakes'
  }
}

function modeLabel(mode: PracticeMode): string {
  switch (mode) {
    case 'mixed':
      return 'Mixed'
    case 'flashcard':
      return 'Flashcards'
    case 'quiz':
      return 'Quiz'
    case 'recall':
      return 'Recall'
  }
}

function strategyLabel(strategy: PracticeSelectionStrategy): string {
  switch (strategy) {
    case 'due-or-weak':
      return 'Due or weak'
    case 'authored-order':
      return 'Authored order'
    case 'random':
      return 'Random'
    case 'weakest-first':
      return 'Weakest first'
    case 'recent-mistakes':
      return 'Recent mistakes'
    case 'least-seen':
      return 'Least seen'
    case 'balanced-by-concept':
      return 'Balanced by concept'
  }
}
