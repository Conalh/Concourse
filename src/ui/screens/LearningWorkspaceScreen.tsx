import { useEffect, useState } from 'react'
import { Bookmark, X } from 'lucide-react'

import type {
  ActivityNavigationOption,
  LearningResourceLinkReference,
  LearningSessionContext,
  PracticeSessionCurrentItem,
  SessionLibraryEntry,
} from '../../application'
import type {
  ActivityDefinition,
  ActivityId,
  LearningFlowOrigin,
  SessionId,
} from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'
import {
  ActivityResponse,
  AsyncStateView,
  BranchSelector,
  ConceptReferenceLink,
  ContentBlockRenderer,
  EvaluationFeedback,
  ModuleNavigator,
  ParkedPathList,
  RecoverableError,
  SessionModeSelector,
  availabilityLabel,
  availabilityMessage,
  formatDateTime,
  interactionModeLabel,
  sessionStatusLabel,
} from '../components'
import { type UiError } from '../errors'
import { useLearningSession, useRouteFocus, useSubjectLibrary } from '../hooks'
import { formatRoute } from '../navigation'
import { useResponseDraftStore } from '../responses'
import { useProductVocabulary } from '../vocabulary'

export function SessionRouteScreen({
  sessionId,
}: Readonly<{ sessionId: SessionId }>) {
  const controller = useLearningSession(sessionId)

  if (
    controller.state.status === 'error' &&
    controller.state.error.recoverability === 'unavailable'
  ) {
    return <UnavailableSessionScreen sessionId={sessionId} />
  }

  return (
    <AsyncStateView
      state={controller.state}
      loadingLabel="Loading saved session"
      retryLabel="Reload session"
      onRetry={controller.reload}
    >
      {(context) => {
        if (context.record.session.status === 'completed') {
          return <CompletedSessionScreen context={context} />
        }

        if (context.record.session.status === 'abandoned') {
          return <AbandonedSessionScreen context={context} />
        }

        return (
          <LearningWorkspaceContent controller={controller} context={context} />
        )
      }}
    </AsyncStateView>
  )
}

function LearningWorkspaceContent({
  controller,
  context,
}: Readonly<{
  controller: ReturnType<typeof useLearningSession>
  context: LearningSessionContext
}>) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `session-${context.record.session.id}-${context.currentActivity?.id ?? 'terminal'}`,
  )
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const draftStore = useResponseDraftStore()
  const currentActivity = context.currentActivity
  const currentProgress = context.currentActivityProgress
  const commandPending = controller.commandState.status === 'pending'

  useEffect(() => {
    const submission = controller.lastSubmission

    if (submission?.activityCompleted === true) {
      draftStore.clearDraft(
        context.record.session.id,
        submission.evidenceEvent.activityId,
      )
    }
  }, [context.record.session.id, controller.lastSubmission, draftStore])

  if (currentActivity === null || currentProgress === null) {
    return <CompletedSessionScreen context={context} />
  }

  const latestEvidence =
    context.currentActivityEvidence[context.currentActivityEvidence.length - 1]
      ?.response
  const completed = currentProgress.status === 'completed'
  const objectives = currentActivity.objectiveIds
    .map((id) =>
      context.subject.objectives.find((objective) => objective.id === id),
    )
    .filter((objective) => objective !== undefined)
  const primaryBlocks = primaryContentBlocks(currentActivity, context)
  const supportingBlocks = supportingContentBlocks(currentActivity, context)
  const currentPracticeItem = context.practice?.currentItem ?? null
  const practiceFlashcardItem =
    currentPracticeItem?.resolvedMode === 'flashcard'
      ? currentPracticeItem
      : null

  return (
    <div className="learnt-session-player">
      <SessionPlayerHeader
        context={context}
        currentActivity={currentActivity}
        recapLabel={vocabulary.routeLabels.sessionRecap}
      />

      <div className="learnt-session-scroll">
        <article className="learnt-activity-stage learnt-session-card-stage">
          <SessionStepMeta context={context} activity={currentActivity} />

          <h1 id="activity-title" ref={headingRef} tabIndex={-1}>
            {currentActivity.title}
          </h1>

          <section
            aria-labelledby="task-brief-title"
            className="learnt-task-brief"
          >
            <p className="learnt-kicker">Current task</p>
            <h2 id="task-brief-title">What this activity asks</h2>
            <ul>
              {objectives.map((objective) => (
                <li key={objective.id}>{objective.statement}</li>
              ))}
            </ul>
          </section>

          <CurrentConceptContext context={context} />

          <ContentBlockRenderer blocks={primaryBlocks} />

          {supportingBlocks.length > 0 ? (
            <details
              className="learnt-details"
              open={
                context.presentationPolicy?.optionalContentVisibility ===
                'expanded'
              }
            >
              <summary>Supporting content</summary>
              <ContentBlockRenderer blocks={supportingBlocks} />
            </details>
          ) : null}

          {practiceFlashcardItem === null ? (
            <ActivityResponse
              key={currentActivity.id}
              sessionId={context.record.session.id}
              activity={currentActivity}
              isCompleted={completed}
              isSubmitting={
                controller.commandState.status === 'pending' &&
                controller.commandState.command === 'submit evidence'
              }
              showConfidenceMetadata={shouldShowConfidenceMetadata(
                currentActivity,
                context,
              )}
              {...(latestEvidence === undefined ? {} : { latestEvidence })}
              onSubmit={(payload, metadata) => {
                void controller.submitEvidence({
                  activityId: currentActivity.id,
                  response: payload,
                  ...metadata,
                })
              }}
            />
          ) : (
            <PracticeFlashcardResponse
              key={currentActivity.id}
              item={practiceFlashcardItem}
              isCompleted={completed}
              isSubmitting={
                controller.commandState.status === 'pending' &&
                controller.commandState.command === 'submit evidence'
              }
              {...(latestEvidence === undefined ? {} : { latestEvidence })}
              onSubmit={(payload, metadata) => {
                void controller.submitEvidence({
                  activityId: currentActivity.id,
                  response: payload,
                  ...metadata,
                })
              }}
            />
          )}

          <EvaluationFeedback
            evaluation={context.latestCurrentActivityEvaluation}
          />

          <ActivityRemediationPanel
            activityId={currentActivity.id}
            context={context}
            evaluation={context.latestCurrentActivityEvaluation}
            resources={controller.supportResources}
          />

          <AdvancementControls
            completed={completed}
            options={context.nextActivities}
            disabled={commandPending}
            onAdvance={(activityId) => {
              const previousActivityId = currentActivity.id
              void controller.advance(activityId).then((committed) => {
                if (committed) {
                  draftStore.clearDraft(
                    context.record.session.id,
                    previousActivityId,
                  )
                }
              })
            }}
          />

          {controller.commandState.status === 'error' ? (
            <RecoverableCommandError
              error={controller.commandState.error}
              onReload={controller.reload}
            />
          ) : null}
        </article>

        <section className="learnt-session-tools" aria-label="Session tools">
          <details className="learnt-session-tool-panel" open>
            <summary>Session orientation</summary>
            <SessionModeSelector
              value={context.record.session.interactionMode}
              disabled={commandPending}
              onChange={(mode) => void controller.changeMode(mode)}
            />
            <ModuleNavigator context={context} />
          </details>

          <details className="learnt-session-tool-panel">
            <summary>Session context</summary>
            <dl className="learnt-detail-grid">
              <div>
                <dt>{vocabulary.terms.modeSelector}</dt>
                <dd>
                  {interactionModeLabel(context.record.session.interactionMode)}
                </dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{context.record.evidenceEvents.length}</dd>
              </div>
              <div>
                <dt>Last active</dt>
                <dd>
                  <time dateTime={context.record.session.lastActiveAt}>
                    {formatDateTime(context.record.session.lastActiveAt)}
                  </time>
                </dd>
              </div>
            </dl>
          </details>

          <details className="learnt-session-tool-panel">
            <summary>Parked paths</summary>
            <p>Concepts saved for later exploration.</p>
            <ParkedPathList
              sessionId={context.record.session.id}
              paths={context.parkedPaths}
              disabled={commandPending}
              onRemove={(conceptId) => {
                void controller.unparkConcept(conceptId)
              }}
            />
          </details>

          <details className="learnt-session-tool-panel">
            <summary>End session</summary>
            {confirmAbandon ? (
              <div role="alert">
                <p>
                  Progress and evidence remain saved. This session will become
                  abandoned, and the record will not be deleted.
                </p>
                <div className="learnt-action-row">
                  <button
                    className="learnt-button learnt-button-warning"
                    type="button"
                    disabled={commandPending}
                    onClick={() => {
                      void controller.abandon().then((committed) => {
                        if (committed) {
                          draftStore.clearSessionDrafts(
                            context.record.session.id,
                          )
                        }
                      })
                    }}
                  >
                    Confirm end session
                  </button>
                  <button
                    className="learnt-button learnt-button-secondary"
                    type="button"
                    onClick={() => {
                      setConfirmAbandon(false)
                    }}
                  >
                    Keep working
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="learnt-button learnt-button-secondary"
                type="button"
                onClick={() => {
                  setConfirmAbandon(true)
                }}
              >
                End session
              </button>
            )}
          </details>
        </section>
      </div>
    </div>
  )
}

function SessionPlayerHeader({
  context,
  currentActivity,
  recapLabel,
}: Readonly<{
  context: LearningSessionContext
  currentActivity: DeepReadonly<ActivityDefinition>
  recapLabel: string
}>) {
  const sessionPosition = sessionPositionLabel(context)
  const completedRatio = sessionProgressRatio(context)
  const completedScale = Math.min(1, Math.max(0, completedRatio / 100))
  const sessionTitle = sessionPlayerTitle(context)
  const sessionMeta = [
    context.subject.title,
    context.currentModule?.title ?? 'Current route',
    currentActivity.kind,
  ].join(' / ')

  return (
    <header className="learnt-session-player-header">
      <a
        className="learnt-session-icon-button"
        href={sessionExitRoute(context)}
        aria-label="Exit session"
      >
        <X aria-hidden="true" size={16} strokeWidth={2.4} />
      </a>
      <div className="learnt-session-title-stack">
        <strong>{sessionTitle}</strong>
        <span>{sessionMeta}</span>
      </div>
      <div className="learnt-session-player-meter">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={context.progress.total}
          aria-valuenow={context.progress.completed}
          aria-label={`${String(context.progress.completed)} of ${String(
            context.progress.total,
          )} activities completed`}
        >
          <span style={{ transform: `scaleX(${String(completedScale)})` }} />
        </div>
      </div>
      <span className="learnt-session-position">{sessionPosition}</span>
      <a className="learnt-session-top-action" href="#concept-context">
        <Bookmark aria-hidden="true" size={14} strokeWidth={2.3} />
        Park
      </a>
      <a
        className="learnt-session-top-action"
        href={formatRoute({
          kind: 'session-recap',
          sessionId: context.record.session.id,
        })}
      >
        {recapLabel}
      </a>
    </header>
  )
}

function SessionStepMeta({
  context,
  activity,
}: Readonly<{
  context: LearningSessionContext
  activity: DeepReadonly<ActivityDefinition>
}>) {
  const conceptTitle =
    activity.conceptIds
      .map((id) =>
        context.subject.concepts.find((concept) => concept.id === id),
      )
      .find((concept) => concept !== undefined)?.title ?? 'Route step'

  return (
    <div className="learnt-session-step-meta">
      <span>{activityKindLabel(activity.kind)}</span>
      <small>{conceptTitle}</small>
    </div>
  )
}

function sessionProgressRatio(context: LearningSessionContext): number {
  if (context.progress.total === 0) {
    return 0
  }

  const activePosition = Math.min(
    context.progress.total,
    context.progress.completed + context.progress.active,
  )
  return Math.round((activePosition / context.progress.total) * 100)
}

function sessionPositionLabel(context: LearningSessionContext): string {
  if (context.progress.total === 0) {
    return '0 / 0'
  }

  const activePosition = Math.min(
    context.progress.total,
    context.progress.completed + context.progress.active,
  )
  return `${String(activePosition)} / ${String(context.progress.total)}`
}

function sessionPlayerTitle(context: LearningSessionContext): string {
  const flow = context.record.session.exploration.learningFlow

  if (flow?.kind === 'practice-plan') {
    return flow.title
  }

  if (flow?.kind === 'study-set-checkpoint') {
    return flow.studySetTitle
  }

  return context.subject.title
}

function sessionExitRoute(context: LearningSessionContext): string {
  const origin = context.record.session.exploration.learningFlow?.origin

  if (origin?.returnRoute !== undefined) {
    return origin.returnRoute
  }

  if (
    origin?.continuationRoute !== undefined &&
    origin.continuationRoute !==
      formatRoute({ kind: 'session', sessionId: context.record.session.id })
  ) {
    return origin.continuationRoute
  }

  return formatRoute({ kind: 'subject', subjectId: context.subject.id })
}

function activityKindLabel(kind: ActivityDefinition['kind']): string {
  switch (kind) {
    case 'orient':
      return 'Orient'
    case 'explain':
      return 'Explain'
    case 'predict':
      return 'Predict'
    case 'worked-example':
      return 'Worked example'
    case 'complete':
      return 'Complete'
    case 'build':
      return 'Build'
    case 'modify':
      return 'Modify'
    case 'debug':
      return 'Debug'
    case 'recall':
      return 'Recall'
    case 'transfer':
      return 'Transfer'
    case 'reflect':
      return 'Reflect'
  }
}

function CurrentConceptContext({
  context,
}: Readonly<{ context: LearningSessionContext }>) {
  const currentActivity = context.currentActivity

  if (
    currentActivity === null ||
    context.presentationPolicy?.systemContextVisibility === 'hidden'
  ) {
    return null
  }

  const concepts = currentActivity.conceptIds
    .map((id) => context.subject.concepts.find((concept) => concept.id === id))
    .filter((concept) => concept !== undefined)
  const objectives = currentActivity.objectiveIds
    .map((id) =>
      context.subject.objectives.find((objective) => objective.id === id),
    )
    .filter((objective) => objective !== undefined)

  return (
    <details
      id="concept-context"
      className="learnt-details learnt-concept-context"
      open={context.presentationPolicy?.systemContextVisibility === 'expanded'}
    >
      <summary>Concept context</summary>
      {concepts.map((concept) => {
        const prerequisites = concept.prerequisiteConceptIds
          .map(
            (id) =>
              context.subject.concepts.find((candidate) => candidate.id === id)
                ?.title ?? id,
          )
          .join(', ')

        return (
          <article key={concept.id}>
            <h3>
              <ConceptReferenceLink
                sessionId={context.record.session.id}
                concept={{ conceptId: concept.id, title: concept.title }}
              />
            </h3>
            <p>{concept.summary}</p>
            <p>
              <strong>Prerequisites:</strong>{' '}
              {prerequisites.length === 0 ? 'None' : prerequisites}
            </p>
          </article>
        )
      })}
      <h3>Relevant objectives</h3>
      <ul>
        {objectives.map((objective) => (
          <li key={objective.id}>{objective.statement}</li>
        ))}
      </ul>
    </details>
  )
}

function AdvancementControls({
  completed,
  options,
  disabled,
  onAdvance,
}: Readonly<{
  completed: boolean
  options: readonly ActivityNavigationOption[]
  disabled: boolean
  onAdvance: (activityId?: ActivityId) => void
}>) {
  if (!completed) {
    return null
  }

  if (options.length === 0) {
    return (
      <button
        className="learnt-button"
        type="button"
        disabled={disabled}
        onClick={() => {
          onAdvance()
        }}
      >
        Complete session
      </button>
    )
  }

  if (options.length === 1) {
    const option = options[0]

    if (option === undefined) {
      return null
    }

    return (
      <button
        className="learnt-button"
        type="button"
        disabled={disabled}
        onClick={() => {
          onAdvance()
        }}
      >
        Continue to {option.activityTitle}
      </button>
    )
  }

  return (
    <BranchSelector
      options={options}
      disabled={disabled}
      onContinue={(activityId) => {
        onAdvance(activityId)
      }}
    />
  )
}

function PracticeFlashcardResponse({
  item,
  latestEvidence,
  isCompleted,
  isSubmitting,
  onSubmit,
}: Readonly<{
  item: PracticeSessionCurrentItem
  latestEvidence?: LearningSessionContext['currentActivityEvidence'][number]['response']
  isCompleted: boolean
  isSubmitting: boolean
  onSubmit: (
    payload: { kind: 'confidence'; value: number },
    metadata: { confidence: number; hintsUsed: number },
  ) => void
}>) {
  const [revealed, setRevealed] = useState(isCompleted)

  const recordedGrade =
    latestEvidence?.kind === 'confidence'
      ? flashcardGradeLabel(latestEvidence.value)
      : null

  return (
    <section
      className="learnt-panel"
      aria-labelledby="flashcard-response-title"
    >
      <p className="learnt-kicker">Flashcard</p>
      <h2 id="flashcard-response-title">Reveal, then self-grade</h2>
      {revealed ? (
        <div className="learnt-flashcard-back">
          <ContentBlockRenderer blocks={item.backBlocks} />
        </div>
      ) : (
        <button
          className="learnt-button learnt-button-secondary"
          type="button"
          onClick={() => {
            setRevealed(true)
          }}
        >
          Reveal solution
        </button>
      )}

      {revealed ? (
        <div className="learnt-action-row" aria-label="Self-grade flashcard">
          {flashcardGradeOptions.map((grade) => (
            <button
              className="learnt-button learnt-button-secondary"
              type="button"
              key={grade.label}
              disabled={isCompleted || isSubmitting}
              onClick={() => {
                onSubmit(
                  { kind: 'confidence', value: grade.value },
                  { confidence: grade.value, hintsUsed: 0 },
                )
              }}
            >
              {grade.label}
            </button>
          ))}
        </div>
      ) : null}

      {recordedGrade === null ? null : (
        <p className="learnt-muted">Recorded self-grade: {recordedGrade}</p>
      )}
    </section>
  )
}

const flashcardGradeOptions = [
  { label: 'Again', value: 1 },
  { label: 'Hard', value: 2 },
  { label: 'Good', value: 4 },
  { label: 'Easy', value: 5 },
] as const

function flashcardGradeLabel(value: number): string {
  if (value <= 1) {
    return 'Again'
  }
  if (value <= 2) {
    return 'Hard'
  }
  if (value >= 5) {
    return 'Easy'
  }
  return 'Good'
}

function ActivityRemediationPanel({
  activityId,
  context,
  evaluation,
  resources,
}: Readonly<{
  activityId: ActivityId
  context: LearningSessionContext
  evaluation: LearningSessionContext['latestCurrentActivityEvaluation']
  resources: readonly LearningResourceLinkReference[]
}>) {
  const shouldShowFallback =
    evaluation?.status === 'retry' || evaluation?.status === 'partial'

  if (resources.length === 0 && !shouldShowFallback) {
    return null
  }

  const origin = activeSessionOrigin(context, activityId)

  return (
    <details className="learnt-learn-why">
      <summary>
        <span>Learn the why</span>
        <small>Open supporting resources</small>
      </summary>
      <div className="learnt-learn-why-body">
        <p className="learnt-kicker">Learn the why</p>
        <h2 id="learn-why-title">Review the missing concept</h2>
        <p>
          Use these short resources, then return to the checkpoint while the
          prompt is still fresh.
        </p>
        {resources.length === 0 ? (
          <p className="learnt-inline-status">
            No linked resource is available for this checkpoint yet. Re-read the
            concept context and compare the answer against the prompt before
            trying again.
          </p>
        ) : (
          <ul className="learnt-learn-why-resource-list">
            {resources.map((resource) => (
              <li key={supportResourceKey(resource)}>
                <div>
                  <h3>{resource.title}</h3>
                  {resource.summary === null ? null : <p>{resource.summary}</p>}
                  <p className="learnt-muted">
                    {resource.modality}
                    {resource.estimatedDurationSeconds === null
                      ? ''
                      : ` / ${formatSupportDuration(resource.estimatedDurationSeconds)}`}
                  </p>
                </div>
                <a
                  className="learnt-button learnt-button-secondary"
                  href={supportResourceRoute(resource, origin)}
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function RecoverableCommandError({
  error,
  onReload,
}: Readonly<{ error: UiError; onReload: () => void }>) {
  const actionProps =
    error.recoverability === 'reload'
      ? { actionLabel: 'Reload session', onAction: onReload }
      : { actionLabel: 'Try again' }

  return <RecoverableError error={error} {...actionProps} />
}

function primaryContentBlocks(
  activity: DeepReadonly<ActivityDefinition>,
  context: LearningSessionContext,
) {
  const maximum = context.presentationPolicy?.maximumPrimaryBlocks ?? null
  return maximum === null ? activity.blocks : activity.blocks.slice(0, maximum)
}

function supportingContentBlocks(
  activity: DeepReadonly<ActivityDefinition>,
  context: LearningSessionContext,
) {
  const maximum = context.presentationPolicy?.maximumPrimaryBlocks ?? null
  return maximum === null ? [] : activity.blocks.slice(maximum)
}

function shouldShowConfidenceMetadata(
  activity: DeepReadonly<ActivityDefinition>,
  context: LearningSessionContext,
): boolean {
  if (activity.response?.kind === 'confidence') {
    return false
  }

  return (
    context.presentationPolicy?.requireMeaningfulLearnerAction === true &&
    (activity.kind === 'predict' ||
      activity.kind === 'recall' ||
      activity.kind === 'transfer')
  )
}

function activeSessionOrigin(
  context: LearningSessionContext,
  activityId: ActivityId,
): LearningFlowOrigin {
  const sessionRoute = formatRoute({
    kind: 'session',
    sessionId: context.record.session.id,
  })

  return {
    kind: 'active-session',
    sessionId: context.record.session.id,
    activityId,
    returnRoute: sessionRoute,
  }
}

function supportResourceRoute(
  resource: LearningResourceLinkReference,
  origin: LearningFlowOrigin,
): string {
  return formatRoute({
    kind: 'resource',
    packId: resource.packId,
    resourceId: resource.resourceId,
    ...(resource.segmentId === null ? {} : { segmentId: resource.segmentId }),
    origin,
  })
}

function supportResourceKey(resource: LearningResourceLinkReference): string {
  return `${resource.packId}:${resource.resourceId}:${resource.segmentId ?? 'whole'}:${resource.recommendedUse ?? 'any'}`
}

function formatSupportDuration(seconds: number): string {
  if (seconds < 60) {
    return `${String(seconds)} sec`
  }

  const minutes = Math.round(seconds / 60)
  return `${String(minutes)} min`
}

export function CompletedSessionScreen({
  context,
}: Readonly<{ context: LearningSessionContext }>) {
  return <TerminalSessionScreen context={context} title="Session completed" />
}

export function AbandonedSessionScreen({
  context,
}: Readonly<{ context: LearningSessionContext }>) {
  return <TerminalSessionScreen context={context} title="Session abandoned" />
}

function TerminalSessionScreen({
  context,
  title,
}: Readonly<{ context: LearningSessionContext; title: string }>) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `terminal-${context.record.session.id}-${context.record.session.status}`,
  )
  const flowActions = terminalFlowActions(context)
  const evidence = buildTerminalEvidence(context)
  const terminalKicker =
    context.record.session.status === 'completed'
      ? 'Session complete'
      : sessionStatusLabel(context.record.session.status)
  const terminalTitle =
    context.record.session.status === 'completed'
      ? "Nice work - here's the evidence."
      : title

  return (
    <section
      className="learnt-screen learnt-terminal-session"
      aria-labelledby="terminal-title"
    >
      <header className="learnt-terminal-header">
        <p className="learnt-kicker">{terminalKicker}</p>
        <h1 id="terminal-title" ref={headingRef} tabIndex={-1}>
          {terminalTitle}
        </h1>
        <p>
          {String(evidence.reinforcedCount)} items /{' '}
          {String(evidence.conceptCount)} concepts reinforced /{' '}
          {String(evidence.needsReview.length)} flagged for follow-up. No
          mastery claimed - this is what you actually did.
        </p>
      </header>

      <div className="learnt-terminal-evidence-grid">
        <section
          className="learnt-terminal-evidence-card"
          data-state="reinforced"
          aria-labelledby="terminal-reinforced"
        >
          <h2 id="terminal-reinforced">Reinforced</h2>
          <TerminalEvidenceList
            rows={evidence.reinforced}
            emptyLabel="No completed evidence yet"
          />
        </section>
        <section
          className="learnt-terminal-evidence-card"
          data-state="needs"
          aria-labelledby="terminal-needs"
        >
          <h2 id="terminal-needs">Needs another look</h2>
          <TerminalEvidenceList
            rows={evidence.needsReview}
            emptyLabel="No flagged follow-up"
          />
          <p>
            {evidence.needsReview.length === 0
              ? 'No misses were recorded in this run.'
              : 'Retry or partial evidence stays visible so the next loop has a clear target.'}
          </p>
        </section>
      </div>

      <section className="learnt-terminal-meta" aria-label="Session evidence">
        <dl className="learnt-detail-grid">
          <div>
            <dt>Evidence events</dt>
            <dd>{context.record.evidenceEvents.length}</dd>
          </div>
          <div>
            <dt>Last active</dt>
            <dd>
              <time dateTime={context.record.session.lastActiveAt}>
                {formatDateTime(context.record.session.lastActiveAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>Parked paths</dt>
            <dd>{context.parkedPaths.length}</dd>
          </div>
        </dl>
        {context.practice === undefined ? null : (
          <section aria-labelledby="practice-summary">
            <h2 id="practice-summary">{vocabulary.terms.practice} summary</h2>
            <dl className="learnt-detail-grid">
              <div>
                <dt>Self-graded flashcards</dt>
                <dd>{context.practice.summary.selfGradedFlashcards}</dd>
              </div>
              <div>
                <dt>Quiz responses</dt>
                <dd>{context.practice.summary.evaluatedQuizResponses}</dd>
              </div>
              <div>
                <dt>Recent unsuccessful</dt>
                <dd>{context.practice.summary.recentUnsuccessful}</dd>
              </div>
            </dl>
          </section>
        )}
      </section>

      {context.parkedPaths.length === 0 ? null : (
        <section
          className="learnt-terminal-meta"
          aria-labelledby="terminal-parked-paths"
        >
          <h2 id="terminal-parked-paths">Parked paths</h2>
          <p>Concepts saved for later exploration.</p>
          <ParkedPathList
            sessionId={context.record.session.id}
            paths={context.parkedPaths}
          />
        </section>
      )}

      <div className="learnt-terminal-actions">
        {flowActions.map((action) => (
          <a
            key={`${action.label}:${action.href}`}
            className={
              action.primary
                ? 'learnt-button'
                : 'learnt-button learnt-button-secondary'
            }
            href={action.href}
          >
            {action.label}
          </a>
        ))}
        <a className="learnt-button" href={formatRoute({ kind: 'library' })}>
          Return to {vocabulary.nav.library.toLowerCase()}
        </a>
        <a
          className="learnt-button learnt-button-secondary"
          href={formatRoute({
            kind: 'session-recap',
            sessionId: context.record.session.id,
          })}
        >
          View {vocabulary.routeLabels.sessionRecap}
        </a>
        <a
          className="learnt-button learnt-button-secondary"
          href={formatRoute({ kind: 'subject', subjectId: context.subject.id })}
        >
          Open {vocabulary.terms.subjectOverview.toLowerCase()}
        </a>
      </div>
    </section>
  )
}

type TerminalEvidenceRow = Readonly<{
  id: string
  title: string
  detail: string
  tone: 'reinforced' | 'needs'
}>

type TerminalEvidenceSummary = Readonly<{
  reinforced: readonly TerminalEvidenceRow[]
  needsReview: readonly TerminalEvidenceRow[]
  reinforcedCount: number
  conceptCount: number
}>

function TerminalEvidenceList({
  rows,
  emptyLabel,
}: Readonly<{
  rows: readonly TerminalEvidenceRow[]
  emptyLabel: string
}>) {
  if (rows.length === 0) {
    return (
      <div className="learnt-terminal-evidence-row" data-state="empty">
        <span aria-hidden="true" />
        <strong>{emptyLabel}</strong>
      </div>
    )
  }

  return (
    <div className="learnt-terminal-evidence-list">
      {rows.map((row) => (
        <div
          className="learnt-terminal-evidence-row"
          data-state={row.tone}
          key={row.id}
        >
          <span aria-hidden="true" />
          <strong>{row.title}</strong>
          <small>{row.detail}</small>
        </div>
      ))}
    </div>
  )
}

function buildTerminalEvidence(
  context: LearningSessionContext,
): TerminalEvidenceSummary {
  const groupedEvents = new Map<
    ActivityId,
    LearningSessionContext['record']['evidenceEvents']
  >()

  for (const event of context.record.evidenceEvents) {
    groupedEvents.set(event.activityId, [
      ...(groupedEvents.get(event.activityId) ?? []),
      event,
    ])
  }

  const reinforced: TerminalEvidenceRow[] = []
  const needsReview: TerminalEvidenceRow[] = []
  const conceptIds = new Set<string>()

  for (const [activityId, events] of groupedEvents) {
    const activity = context.subject.activities.find(
      (candidate) => candidate.id === activityId,
    )
    const latestEvent = events[events.length - 1]

    if (activity === undefined || latestEvent === undefined) {
      continue
    }

    for (const conceptId of activity.conceptIds) {
      conceptIds.add(conceptId)
    }

    const unsuccessfulAttempts = events.filter(
      (event) =>
        event.evaluation.status === 'retry' ||
        event.evaluation.status === 'partial',
    ).length

    if (
      latestEvent.evaluation.status === 'passed' ||
      latestEvent.evaluation.status === 'ungraded'
    ) {
      reinforced.push({
        id: `reinforced:${activityId}`,
        title: activity.title,
        detail: terminalReinforcedDetail(events),
        tone: 'reinforced',
      })
    }

    if (
      unsuccessfulAttempts > 0 ||
      latestEvent.evaluation.status === 'retry' ||
      latestEvent.evaluation.status === 'partial'
    ) {
      needsReview.push({
        id: `needs:${activityId}`,
        title: activity.title,
        detail: terminalNeedsReviewDetail(unsuccessfulAttempts),
        tone: 'needs',
      })
    }
  }

  return {
    reinforced: reinforced.slice(0, 4),
    needsReview: needsReview.slice(0, 4),
    reinforcedCount: reinforced.length,
    conceptCount: conceptIds.size,
  }
}

function terminalReinforcedDetail(
  events: LearningSessionContext['record']['evidenceEvents'],
): string {
  const latest = events[events.length - 1]

  if (latest?.evaluation.status === 'ungraded') {
    return 'self-graded'
  }

  if (events.length === 1) {
    return 'passed'
  }

  return `${String(events.length)} attempts`
}

function terminalNeedsReviewDetail(unsuccessfulAttempts: number): string {
  if (unsuccessfulAttempts <= 1) {
    return 'missed once'
  }

  return `${String(unsuccessfulAttempts)} misses`
}

function terminalFlowActions(
  context: LearningSessionContext,
): readonly Readonly<{ label: string; href: string; primary: boolean }>[] {
  const flow = context.record.session.exploration.learningFlow

  if (flow === undefined) {
    return []
  }

  const actions: { label: string; href: string; primary: boolean }[] = []
  const origin = flow.origin

  if (origin.kind === 'active-session') {
    actions.push({
      label: 'Return to practice',
      href: formatRoute({ kind: 'session', sessionId: origin.sessionId }),
      primary: true,
    })
  } else if (origin.returnRoute !== undefined) {
    actions.push({
      label:
        origin.kind === 'learning-resource'
          ? 'Back to resource'
          : 'Return to previous work',
      href: origin.returnRoute,
      primary: true,
    })
  }

  if (
    origin.continuationRoute !== undefined &&
    origin.continuationRoute !== origin.returnRoute
  ) {
    actions.push({
      label: 'Continue course',
      href: origin.continuationRoute,
      primary: false,
    })
  }

  return actions
}

function UnavailableSessionScreen({
  sessionId,
}: Readonly<{ sessionId: SessionId }>) {
  const { state, reload } = useSubjectLibrary()
  const headingRef = useRouteFocus<HTMLHeadingElement>(
    `unavailable-${sessionId}`,
  )

  return (
    <AsyncStateView
      state={state}
      loadingLabel="Loading unavailable session details"
      onRetry={reload}
    >
      {(data) => {
        const entry =
          data.sessionLibrary.sessions.find(
            (session) => session.sessionId === sessionId,
          ) ?? null

        return (
          <section
            className="learnt-screen learnt-narrow-screen"
            aria-labelledby="unavailable-title"
          >
            <p className="learnt-kicker">Unavailable saved session</p>
            <h1 id="unavailable-title" ref={headingRef} tabIndex={-1}>
              This session cannot be continued
            </h1>
            {entry === null ? (
              <p>The session is not present in the saved session library.</p>
            ) : (
              <UnavailableSessionDetails entry={entry} />
            )}
            <a
              className="learnt-button"
              href={formatRoute({ kind: 'library' })}
            >
              Return to library
            </a>
          </section>
        )
      }}
    </AsyncStateView>
  )
}

function UnavailableSessionDetails({
  entry,
}: Readonly<{ entry: SessionLibraryEntry }>) {
  return (
    <div className="learnt-panel">
      <h2>{availabilityLabel(entry.availability)}</h2>
      <p>{availabilityMessage(entry.availability)}</p>
      <dl className="learnt-detail-grid">
        <div>
          <dt>Persisted subject ID</dt>
          <dd>{entry.subjectId}</dd>
        </div>
        <div>
          <dt>Persisted version</dt>
          <dd>{entry.persistedSubjectVersion}</dd>
        </div>
        <div>
          <dt>Registered version</dt>
          <dd>{entry.registeredSubjectVersion ?? 'Not registered'}</dd>
        </div>
      </dl>
    </div>
  )
}
