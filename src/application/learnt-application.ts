import type { ResourceRecommendedUse } from '@learnt/learning-pack-contracts'
import type {
  ActivityId,
  ConceptId,
  SessionId,
  SubjectId,
} from '../core/contracts'
import type { LearningSubject } from '../core/engine'
import { cloneDeep, deepFreeze } from '../core/foundation'
import type {
  LearningSessionRecord,
  ProductVocabularyMode,
  ThemeMode,
} from '../core/ports'
import {
  LearningPackInstallError,
  installLearningPackDocuments,
  type InstalledLearningPack,
} from '../learning-packs/learnt-importer'
import { LearningApplicationError } from './learning-application-error'
import { buildSubjectOverview } from './subject-overview'
import type {
  AbandonLearntSessionInput,
  AdvanceLearntSessionInput,
  ChangeLearntModeInput,
  DownloadLearningPackAssetInput,
  GetLearningResourceInput,
  GetEligibleSupportResourcesInput,
  GetPracticeRecommendationsInput,
  GetPracticeSummaryInput,
  GetSupportedPracticeModesInput,
  LearntApplicationDependencies,
  LearnerSummary,
  InstalledLearningPackStore,
  InstalledPackChange,
  LearningPackDirectoryInstallOutcome,
  LearningPackDirectoryInstallResult,
  LearningPackLibraryFilters,
  LearningPackLibrarySnapshot,
  LearningPackLibraryStateEntry,
  LearningPackSourcePort,
  LearningPackSourceReadResult,
  LearningResourceTeachingContext,
  LearntSubmissionResult,
  LearningSessionContext,
  LearningResourceLinkReference,
  ListCurriculumEntriesInput,
  ListResourcesForConceptInput,
  ListResourcesForObjectiveInput,
  ListResourcesForPackInput,
  ListSupportResourcesForLearningItemInput,
  ParkLearntConceptInput,
  PracticeCandidateResolution,
  PracticeMetricsSummary,
  PracticeModeAvailability,
  PracticePlan,
  PracticePresetInput,
  PracticeRequest,
  PracticeScopeOption,
  RecordResourceEngagementInput,
  ResolvePracticeCandidatesInput,
  ResolveStudySetInput,
  ResolvedStudySet,
  SessionRecap,
  SessionConceptExploration,
  SessionLibrarySnapshot,
  StartPracticeSessionResult,
  StartStudySetSessionInput,
  StudySetSessionStartResult,
  StartLearntSessionInput,
  SubjectOverview,
  SubjectSummary,
  SubmitLearntEvidenceInput,
  UnparkLearntConceptInput,
  ValidatedLearningPackCandidate,
} from './learnt-application.types'
import {
  activeInstalledLearningPackRelease,
  planInstalledPackChange,
} from './installed-learning-pack-lifecycle'
import { buildLearningPackLibrarySnapshot } from './learning-pack-library'
import {
  buildLearningResourceTeachingContext,
  listCurriculumEntries,
  listResourcesForConcept,
  listResourcesForObjective,
  listResourcesForPack,
  listSupportResourcesForLearningItem,
  requireInstalledPack,
  validateResourceEngagementForPack,
} from './learning-resource-runtime'
import { resolvePackAssetDownload } from './pack-asset-runtime'
import type { PackAssetSaveResult } from '../learning-packs/pack-asset-delivery-port'
import {
  assertLearnerCompatible,
  buildLearnerSummary,
  buildSessionContext,
  buildSessionLibrarySnapshot,
  buildSubjectSummary,
  resolveReadySubject,
  subjectNotFound,
} from './learning-session-context'
import { buildSessionRecap } from './session-recap'
import { buildSessionConceptExploration } from './session-concept-exploration'
import {
  buildPracticeScopedSubject,
  buildPracticePackBaseSubject,
  buildPracticeSessionContext,
  createPracticeLearningFlow,
  createPracticePlan as createPracticePlanRuntime,
  createPracticePreset as createPracticePresetRuntime,
  getAvailablePracticeScopes as getAvailablePracticeScopesRuntime,
  getRecentMistakes as getRecentMistakesRuntime,
  getSupportedPracticeModes as getSupportedPracticeModesRuntime,
  getWeakConcepts as getWeakConceptsRuntime,
  resolvePracticeCandidates as resolvePracticeCandidatesRuntime,
  summarizePracticeMetrics,
} from './practice-runtime'
import {
  buildStudySetScopedSubject,
  createStudySetLearningFlow,
  repeatedIncorrectThreshold,
  resolveStudySet,
} from './study-set-runtime'

export class LearntApplication {
  private readonly dependencies: LearntApplicationDependencies
  private resourceEngagementSequence = 0
  private readonly runtimeInstalledLearningPacks = new Map<
    string,
    InstalledLearningPack
  >()
  private readonly runtimeSubjectOwners = new Map<string, string>()
  private readonly runtimeLearningPackLibraryStates = new Map<
    string,
    LearningPackLibraryStateEntry
  >()

  constructor(dependencies: LearntApplicationDependencies) {
    this.dependencies = dependencies
  }

  getLearner(): LearnerSummary {
    return buildLearnerSummary(this.dependencies.profile)
  }

  getThemeMode(): ThemeMode {
    return this.dependencies.themePreferenceStore?.getThemeMode() ?? 'dark'
  }

  setThemeMode(theme: ThemeMode): void {
    this.dependencies.themePreferenceStore?.setThemeMode(theme)
  }

  getProductVocabularyMode(): ProductVocabularyMode {
    return (
      this.dependencies.productVocabularyPreferenceStore?.getProductVocabularyMode() ??
      'branded'
    )
  }

  setProductVocabularyMode(mode: ProductVocabularyMode): void {
    this.dependencies.productVocabularyPreferenceStore?.setProductVocabularyMode(
      mode,
    )
  }

  hasCompletedFirstRunSetup(): boolean {
    return (
      this.dependencies.firstRunSetupStore?.hasCompletedFirstRunSetup() ?? true
    )
  }

  completeFirstRunSetup(): void {
    this.dependencies.firstRunSetupStore?.completeFirstRunSetup()
  }

  listSubjects(): readonly SubjectSummary[] {
    return deepFreeze(
      cloneDeep(
        this.dependencies.subjectRegistry
          .list()
          .map((adapter) => buildSubjectSummary(adapter.subject)),
      ),
    )
  }

  getSubjectOverview(subjectId: SubjectId): SubjectOverview {
    return buildSubjectOverview(this.getSubject(subjectId))
  }

  async listSessions(): Promise<SessionLibrarySnapshot> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return buildSessionLibrarySnapshot(scan.records, scan.issues, {
      profile: this.dependencies.profile,
      subjectRegistry: this.dependencies.subjectRegistry,
    })
  }

  async getLearningPackLibrary(
    filters: LearningPackLibraryFilters = {},
  ): Promise<LearningPackLibrarySnapshot> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return buildLearningPackLibrarySnapshot({
      installedPacks: this.getInstalledLearningPacks(),
      stateEntries: this.getLearningPackLibraryStates(),
      records: scan.records,
      profile: this.dependencies.profile,
      filters,
    })
  }

  getInstalledLearningPacksForRuntime(): readonly InstalledLearningPack[] {
    return deepFreeze(cloneDeep(this.getInstalledLearningPacks()))
  }

  async getLearningResource(
    input: GetLearningResourceInput,
  ): Promise<LearningResourceTeachingContext> {
    const engagementEvents =
      await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
        {
          packId: input.packId,
          resourceId: input.resourceId,
        },
      )

    return buildLearningResourceTeachingContext({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents,
    })
  }

  async downloadLearningPackAsset(
    input: DownloadLearningPackAssetInput,
  ): Promise<PackAssetSaveResult> {
    const delivery = this.dependencies.packAssetDelivery
    const store = this.dependencies.installedLearningPackStore
    if (delivery === undefined || store === undefined) {
      throw new LearningApplicationError(
        'pack-asset-delivery-unavailable',
        'Pack asset delivery is not configured for this runtime.',
        { details: { packId: input.packId, resourceId: input.resourceId } },
      )
    }

    const installedPack = requireInstalledPack(
      this.getInstalledLearningPacks(),
      input.packId,
    )
    const snapshot = await store.readSnapshot()
    const record = snapshot.records.find(
      (candidate) => candidate.packId === input.packId,
    )
    const activeRelease =
      record === undefined ? null : activeInstalledLearningPackRelease(record)
    if (activeRelease === null) {
      throw new LearningApplicationError(
        'pack-asset-integrity-failed',
        'The installed pack has no persisted active release for asset delivery.',
        { details: { packId: input.packId, resourceId: input.resourceId } },
      )
    }

    const download = await resolvePackAssetDownload({
      installedPack,
      activeRelease,
      resourceId: input.resourceId,
    })
    return delivery.save(download)
  }

  async listResourcesForPack(input: ListResourcesForPackInput) {
    return listResourcesForPack({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: input.packId },
        ),
    })
  }

  async listResourcesForConcept(input: ListResourcesForConceptInput) {
    return listResourcesForConcept({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: input.packId },
        ),
    })
  }

  async listResourcesForObjective(input: ListResourcesForObjectiveInput) {
    return listResourcesForObjective({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: input.packId },
        ),
    })
  }

  async listSupportResourcesForLearningItem(
    input: ListSupportResourcesForLearningItemInput,
  ) {
    return listSupportResourcesForLearningItem({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: input.packId },
        ),
    })
  }

  async listCurriculumEntries(input: ListCurriculumEntriesInput) {
    return listCurriculumEntries({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: input.packId },
        ),
    })
  }

  async resolveStudySet(
    input: ResolveStudySetInput,
  ): Promise<ResolvedStudySet> {
    await Promise.resolve()
    return resolveStudySet({
      ...input,
      installedPacks: this.getInstalledLearningPacks(),
    })
  }

  async startStudySetSession(
    input: StartStudySetSessionInput,
  ): Promise<StudySetSessionStartResult> {
    const studySet = await this.resolveStudySet(input)
    const installedPack = requireInstalledPack(
      this.getInstalledLearningPacks(),
      input.packId,
    )
    const subject = this.resolveStudySetSubject(installedPack, studySet)
    const learningFlow = createStudySetLearningFlow(studySet, input.origin)
    const record =
      await this.dependencies.persistentLearningService.startSession({
        subject,
        learnerId: this.dependencies.profile.learnerId,
        profileId: this.dependencies.profile.id,
        interactionMode: input.interactionMode ?? 'rescue',
        learningFlow,
      })

    return deepFreeze(
      cloneDeep({
        studySet,
        context: this.buildContext(record),
      }),
    )
  }

  async getAvailablePracticeScopes(): Promise<readonly PracticeScopeOption[]> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return getAvailablePracticeScopesRuntime({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
    })
  }

  getSupportedPracticeModes(
    input: GetSupportedPracticeModesInput,
  ): readonly PracticeModeAvailability[] {
    const installedPack = requireInstalledPack(
      this.getInstalledLearningPacks(),
      input.packId,
    )
    const item = installedPack.documents.items.items.find(
      (candidate) => candidate.itemId === input.itemId,
    )

    if (item === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'Practice item was not found in the installed pack.',
        { details: input },
      )
    }

    return getSupportedPracticeModesRuntime(item)
  }

  createPracticeRequest(input: PracticePresetInput): PracticeRequest {
    return createPracticePresetRuntime(input)
  }

  createPracticePreset(input: PracticePresetInput): PracticeRequest {
    return createPracticePresetRuntime(input)
  }

  async resolvePracticeCandidates(
    input: ResolvePracticeCandidatesInput,
  ): Promise<readonly PracticeCandidateResolution[]> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return resolvePracticeCandidatesRuntime({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
      scope: input.scope,
    })
  }

  async createPracticePlan(input: PracticeRequest): Promise<PracticePlan> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return createPracticePlanRuntime({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
      request: input,
      createdAt: this.dependencies.clock.now().toISOString(),
    })
  }

  async startPracticeSession(
    input: PracticeRequest,
  ): Promise<StartPracticeSessionResult> {
    const plan = await this.createPracticePlan(input)
    const installedPack = requireInstalledPack(
      this.getInstalledLearningPacks(),
      plan.packId,
    )
    const subject = this.resolvePracticeSubject(installedPack, plan)
    const learningFlow = createPracticeLearningFlow(plan)
    const record =
      await this.dependencies.persistentLearningService.startSession({
        subject,
        learnerId: this.dependencies.profile.learnerId,
        profileId: this.dependencies.profile.id,
        interactionMode: 'rescue',
        learningFlow,
      })

    return deepFreeze(
      cloneDeep({
        plan,
        context: this.buildContext(record),
      }),
    )
  }

  async getPracticeSummary(
    input: GetPracticeSummaryInput = {},
  ): Promise<PracticeMetricsSummary> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return summarizePracticeMetrics({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
      ...input,
    })
  }

  async getWeakConcepts(
    input: GetPracticeRecommendationsInput = {},
  ): Promise<PracticeMetricsSummary['weakConcepts']> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return getWeakConceptsRuntime({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
      ...input,
    })
  }

  async getRecentMistakes(
    input: GetPracticeRecommendationsInput = {},
  ): Promise<PracticeMetricsSummary['recentMistakes']> {
    const scan =
      await this.dependencies.persistentLearningService.listSessions()

    return getRecentMistakesRuntime({
      installedPacks: this.getInstalledLearningPacks(),
      evidenceRecords: scan.records,
      ...input,
    })
  }

  async getEligibleSupportResources(
    input: GetEligibleSupportResourcesInput,
  ): Promise<readonly LearningResourceLinkReference[]> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)
    const activityId =
      input.activityId ?? record.session.currentActivityId ?? undefined

    if (activityId === undefined) {
      return []
    }

    const activity = subject.activities.find(
      (candidate) => candidate.id === activityId,
    )

    if (activity === undefined) {
      return []
    }

    const installedPack = this.getInstalledPackForSubject(subject.id)

    if (installedPack === null) {
      return []
    }

    const recommendedUses = this.eligibleRecommendedUses(record, activityId)

    if (recommendedUses.length === 0) {
      return []
    }

    const engagementEvents =
      await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
        { packId: installedPack.packId },
      )
    const resources = (
      await Promise.all(
        recommendedUses.map((recommendedUse) =>
          listSupportResourcesForLearningItem({
            packId: installedPack.packId,
            itemId: activity.id,
            recommendedUse,
            installedPacks: this.getInstalledLearningPacks(),
            engagementEvents,
          }),
        ),
      )
    ).flat()
    const unique = new Map<string, LearningResourceLinkReference>()

    for (const resource of resources) {
      unique.set(
        `${resource.resourceId}\u0000${resource.segmentId ?? ''}\u0000${resource.recommendedUse ?? ''}`,
        resource,
      )
    }

    return deepFreeze(cloneDeep([...unique.values()]))
  }

  async recordResourceEngagement(input: RecordResourceEngagementInput) {
    const installedPack = requireInstalledPack(
      this.getInstalledLearningPacks(),
      input.packId,
    )
    const resource = installedPack.documents.resources?.resources.find(
      (candidate) => candidate.id === input.resourceId,
    )

    if (resource === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'Learning resource was not found in the installed pack.',
        { details: { packId: input.packId, resourceId: input.resourceId } },
      )
    }

    const occurredAt = this.dependencies.clock.now().toISOString()
    const event = validateResourceEngagementForPack(
      {
        schemaVersion: '0.1',
        eventType: 'resource-engagement',
        eventId: this.createResourceEngagementEventId(occurredAt),
        packId: installedPack.packId,
        packVersion: installedPack.packVersion,
        resourceId: resource.id,
        contentRevision: resource.contentRevision,
        segmentId: input.segmentId ?? null,
        action: input.action,
        progressRatio: input.progressRatio ?? null,
        positionSeconds: input.positionSeconds ?? null,
        measurement: input.measurement ?? 'unknown',
        occurredAt,
        sourceInstanceId: 'learnt-local',
        metadata: null,
      },
      installedPack.documents,
    )

    return this.dependencies.resourceEngagementStore.appendResourceEngagementEvent(
      event,
    )
  }

  async chooseAndInstallLearningPackDirectory(): Promise<LearningPackDirectoryInstallResult | null> {
    const source = this.requireLearningPackSource()
    const result = await source.chooseDirectory()

    return result === null ? null : this.installLearningPackSourceResult(result)
  }

  async syncSelectedLearningPackDirectory(): Promise<LearningPackDirectoryInstallResult | null> {
    const source = this.requireLearningPackSource()
    const result = await source.readSelectedDirectory()

    return result === null ? null : this.installLearningPackSourceResult(result)
  }

  async restoreInstalledLearningPacks(
    store: InstalledLearningPackStore,
  ): Promise<
    Readonly<{
      installed: readonly InstalledLearningPack[]
      states: readonly LearningPackLibraryStateEntry[]
    }>
  > {
    const installed: InstalledLearningPack[] = []
    const states: LearningPackLibraryStateEntry[] = []
    const snapshot = await store.readSnapshot()

    for (const issue of snapshot.issues) {
      states.push(
        this.invalidInstalledPackState(
          issue.packId ?? 'unknown-installed-pack',
          null,
          issue.message,
          [],
        ),
      )
    }

    for (const record of snapshot.records) {
      const activeRelease = activeInstalledLearningPackRelease(record)
      if (activeRelease === null) {
        states.push(
          this.invalidInstalledPackState(
            record.packId,
            null,
            'Stored pack record has no active release.',
            [],
          ),
        )
        continue
      }

      try {
        const restoredPack = installLearningPackDocuments(
          activeRelease.documents,
        )
        if (restoredPack.packId !== record.packId) {
          throw new Error(
            'Stored pack record identity does not match active documents.',
          )
        }
        this.replaceRuntimeInstalledLearningPack(restoredPack)
        installed.push(restoredPack)
      } catch (error) {
        states.push(
          this.invalidInstalledPackState(
            record.packId,
            activeRelease.packVersion,
            error instanceof Error
              ? error.message
              : 'Stored pack could not be restored.',
            error instanceof LearningPackInstallError ? error.diagnostics : [],
          ),
        )
      }
    }

    this.runtimeLearningPackLibraryStates.clear()
    for (const state of states) {
      this.runtimeLearningPackLibraryStates.set(state.packId, state)
    }

    return { installed, states }
  }

  async installValidatedLearningPack(
    candidate: ValidatedLearningPackCandidate,
  ): Promise<InstalledPackChange> {
    const store = this.dependencies.installedLearningPackStore
    if (store === undefined) {
      throw new Error('Installed learning pack storage is not configured.')
    }

    const installedPack = installLearningPackDocuments(candidate.documents)
    const existing = (await store.readSnapshot()).records.find(
      (record) => record.packId === installedPack.packId,
    )
    const change = planInstalledPackChange({
      existing: existing ?? null,
      candidate,
    })
    if (change.kind === 'reject' || change.kind === 'reinstall') {
      return change
    }

    this.assertRuntimeSubjectsCanRegister(installedPack, installedPack.packId)
    await store.write(change.record)

    try {
      this.replaceRuntimeInstalledLearningPack(installedPack)
      this.runtimeLearningPackLibraryStates.delete(installedPack.packId)
      return change
    } catch (error) {
      if (existing !== undefined) {
        await store.write(existing)
      }
      throw error
    }
  }

  async getSessionContext(
    sessionId: SessionId,
  ): Promise<LearningSessionContext> {
    const record =
      await this.dependencies.persistentLearningService.getSession(sessionId)

    if (record === null) {
      throw new LearningApplicationError(
        'session-not-found',
        'Session was not found.',
        {
          details: { sessionId },
        },
      )
    }

    return this.buildContext(record)
  }

  async getSessionRecap(sessionId: SessionId): Promise<SessionRecap> {
    const record = await this.requireRecord(sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)

    return buildSessionRecap(record, subject)
  }

  async getSessionConceptExploration(
    sessionId: SessionId,
    conceptId: ConceptId,
  ): Promise<SessionConceptExploration> {
    const record = await this.requireRecord(sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)

    return this.buildConceptExplorationWithResources(record, subject, conceptId)
  }

  async startSession(
    input: StartLearntSessionInput,
  ): Promise<LearningSessionContext> {
    const subject = this.getSubject(input.subjectId)
    const record =
      await this.dependencies.persistentLearningService.startSession({
        subject,
        learnerId: this.dependencies.profile.learnerId,
        profileId: this.dependencies.profile.id,
        ...(input.interactionMode === undefined
          ? {}
          : { interactionMode: input.interactionMode }),
      })

    return this.buildContext(record)
  }

  async submitEvidence(
    input: SubmitLearntEvidenceInput,
  ): Promise<LearntSubmissionResult> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)
    const result =
      await this.dependencies.persistentLearningService.submitEvidence({
        subject,
        sessionId: input.sessionId,
        activityId: input.activityId,
        response: input.response,
        ...(input.confidence === undefined
          ? {}
          : { confidence: input.confidence }),
        ...(input.hintsUsed === undefined
          ? {}
          : { hintsUsed: input.hintsUsed }),
      })

    return deepFreeze(
      cloneDeep({
        context: this.buildContext(result.record),
        evidenceEvent: result.evidenceEvent,
        evaluation: result.evaluation,
        activityCompleted: result.activityCompleted,
      }),
    )
  }

  async advanceSession(
    input: AdvanceLearntSessionInput,
  ): Promise<LearningSessionContext> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)
    const committed =
      await this.dependencies.persistentLearningService.advanceSession({
        subject,
        sessionId: input.sessionId,
        ...(input.nextActivityId === undefined
          ? {}
          : { nextActivityId: input.nextActivityId }),
      })

    return this.buildContext(committed)
  }

  async changeInteractionMode(
    input: ChangeLearntModeInput,
  ): Promise<LearningSessionContext> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    this.resolveSubjectForRecord(record)
    const committed =
      await this.dependencies.persistentLearningService.changeInteractionMode(
        input,
      )

    return this.buildContext(committed)
  }

  async abandonSession(
    input: AbandonLearntSessionInput,
  ): Promise<LearningSessionContext> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    this.resolveSubjectForRecord(record)
    const committed =
      await this.dependencies.persistentLearningService.abandonSession(input)

    return this.buildContext(committed)
  }

  async parkConcept(
    input: ParkLearntConceptInput,
  ): Promise<SessionConceptExploration> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)
    this.assertConceptExists(subject, input.conceptId, record)
    this.assertActiveForConceptMutation(record)
    const committed =
      await this.dependencies.persistentLearningService.parkConcept({
        subject,
        sessionId: input.sessionId,
        conceptId: input.conceptId,
      })

    return this.buildConceptExplorationWithResources(
      committed,
      subject,
      input.conceptId,
    )
  }

  async unparkConcept(
    input: UnparkLearntConceptInput,
  ): Promise<SessionConceptExploration> {
    const record = await this.requireRecord(input.sessionId)
    assertLearnerCompatible(record, this.dependencies.profile)
    const subject = this.resolveSubjectForRecord(record)
    this.assertConceptExists(subject, input.conceptId, record)
    this.assertActiveForConceptMutation(record)
    const committed =
      await this.dependencies.persistentLearningService.unparkConcept({
        subject,
        sessionId: input.sessionId,
        conceptId: input.conceptId,
      })

    return this.buildConceptExplorationWithResources(
      committed,
      subject,
      input.conceptId,
    )
  }

  private getSubject(subjectId: SubjectId) {
    const adapter = this.dependencies.subjectRegistry.get(subjectId)

    if (adapter === undefined) {
      throw subjectNotFound(subjectId)
    }

    return adapter.subject
  }

  private getInstalledLearningPacks(): readonly InstalledLearningPack[] {
    const installedPacks = new Map<string, InstalledLearningPack>()

    for (const installedPack of this.dependencies.installedLearningPacks ??
      []) {
      installedPacks.set(installedPack.packId, installedPack)
    }

    for (const [packId, installedPack] of this.runtimeInstalledLearningPacks) {
      installedPacks.set(packId, installedPack)
    }

    return [...installedPacks.values()]
  }

  private getLearningPackLibraryStates(): readonly LearningPackLibraryStateEntry[] {
    return [
      ...(this.dependencies.learningPackLibraryStates ?? []),
      ...this.runtimeLearningPackLibraryStates.values(),
    ]
  }

  private async installLearningPackSourceResult(
    result: LearningPackSourceReadResult,
  ): Promise<LearningPackDirectoryInstallResult> {
    const outcomes: LearningPackDirectoryInstallOutcome[] = []

    for (const sourceCandidate of result.candidates) {
      try {
        const change = await this.installValidatedLearningPack(
          sourceCandidate.candidate,
        )
        outcomes.push({
          directoryName: sourceCandidate.directoryName,
          status:
            change.kind === 'reinstall'
              ? 'reinstalled'
              : change.kind === 'reject'
                ? 'rejected'
                : 'installed',
          packId: sourceCandidate.packId,
          packVersion: sourceCandidate.packVersion,
          title: sourceCandidate.title,
          message: directoryInstallMessage(change),
          diagnostics: sourceCandidate.diagnostics,
          change,
        })
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'The validated pack could not be installed.'
        outcomes.push({
          directoryName: sourceCandidate.directoryName,
          status: 'installation-error',
          packId: sourceCandidate.packId,
          packVersion: sourceCandidate.packVersion,
          title: sourceCandidate.title,
          message,
          diagnostics:
            error instanceof LearningPackInstallError
              ? error.diagnostics
              : sourceCandidate.diagnostics,
        })
      }
    }

    outcomes.push(...result.rejectedCandidates)
    return {
      sourceName: result.sourceName,
      scannedDirectoryCount: result.scannedDirectoryCount,
      outcomes,
    }
  }

  private requireLearningPackSource(): LearningPackSourcePort {
    const source = this.dependencies.learningPackSource
    if (source === undefined) {
      throw new Error('Learning pack source is not configured.')
    }
    return source
  }

  private invalidInstalledPackState(
    packId: string,
    packVersion: string | null,
    message: string,
    diagnostics: LearningPackLibraryStateEntry['diagnostics'],
  ): LearningPackLibraryStateEntry {
    return {
      packId,
      ...(packVersion === null ? {} : { packVersion }),
      title: packId,
      state: 'invalid-pack',
      message,
      ...(diagnostics === undefined ? {} : { diagnostics }),
    }
  }

  private replaceRuntimeInstalledLearningPack(
    installedPack: InstalledLearningPack,
  ): void {
    const packId = installedPack.packId
    const previousPack = this.runtimeInstalledLearningPacks.get(packId)

    if (previousPack !== undefined) {
      this.unregisterRuntimeSubjects(previousPack, packId)
    }

    try {
      this.assertRuntimeSubjectsCanRegister(installedPack, packId)
      for (const adapter of installedPack.adapters) {
        this.dependencies.subjectRegistry.register(adapter)
        this.runtimeSubjectOwners.set(adapter.subject.id, packId)
      }
      this.runtimeInstalledLearningPacks.set(packId, installedPack)
    } catch (error) {
      this.unregisterRuntimeSubjects(installedPack, packId)
      if (previousPack !== undefined) {
        for (const adapter of previousPack.adapters) {
          this.dependencies.subjectRegistry.register(adapter)
          this.runtimeSubjectOwners.set(adapter.subject.id, packId)
        }
        this.runtimeInstalledLearningPacks.set(packId, previousPack)
      } else {
        this.runtimeInstalledLearningPacks.delete(packId)
      }
      throw error
    }
  }

  private assertRuntimeSubjectsCanRegister(
    installedPack: InstalledLearningPack,
    packId: string,
  ): void {
    for (const adapter of installedPack.adapters) {
      const subjectId = adapter.subject.id
      const runtimeOwner = this.runtimeSubjectOwners.get(subjectId)

      if (runtimeOwner !== undefined && runtimeOwner !== packId) {
        throw new Error(
          `Imported subject "${subjectId}" is already provided by another runtime learning pack.`,
        )
      }

      if (
        runtimeOwner === undefined &&
        this.dependencies.subjectRegistry.has(subjectId)
      ) {
        throw new Error(
          `Imported subject "${subjectId}" conflicts with an existing registered subject.`,
        )
      }
    }
  }

  private unregisterRuntimeSubjects(
    installedPack: InstalledLearningPack,
    packId: string,
  ): void {
    for (const adapter of installedPack.adapters) {
      if (this.runtimeSubjectOwners.get(adapter.subject.id) !== packId) {
        continue
      }

      this.dependencies.subjectRegistry.unregister(adapter.subject.id)
      this.runtimeSubjectOwners.delete(adapter.subject.id)
    }
  }

  private async requireRecord(
    sessionId: SubmitLearntEvidenceInput['sessionId'],
  ) {
    const record =
      await this.dependencies.persistentLearningService.getSession(sessionId)

    if (record === null) {
      throw new LearningApplicationError(
        'session-not-found',
        'Session was not found.',
        {
          details: { sessionId },
        },
      )
    }

    return record
  }

  private assertConceptExists(
    subject: LearningSubject,
    conceptId: ConceptId,
    record: LearningSessionRecord,
  ): void {
    if (!subject.concepts.some((concept) => concept.id === conceptId)) {
      throw new LearningApplicationError(
        'concept-not-found',
        'Concept was not found in the registered subject.',
        {
          details: {
            sessionId: record.session.id,
            subjectId: subject.id,
            conceptId,
          },
        },
      )
    }
  }

  private assertActiveForConceptMutation(record: LearningSessionRecord): void {
    if (record.session.status !== 'active') {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'Only active sessions can change parked paths.',
        {
          details: {
            sessionId: record.session.id,
            status: record.session.status,
          },
        },
      )
    }
  }

  private buildContext(record: LearningSessionRecord): LearningSessionContext {
    const subject = this.resolveSubjectForRecord(record)
    const context = buildSessionContext(record, {
      profile: this.dependencies.profile,
      subjectRegistry: this.dependencies.subjectRegistry,
      subject,
    })
    const practice = buildPracticeSessionContext({
      record,
      subject,
      installedPack: this.getInstalledPackForLearningFlow(
        record.session.exploration.learningFlow,
      ),
    })

    if (practice === undefined) {
      return context
    }

    return deepFreeze(
      cloneDeep({
        ...context,
        practice,
      }),
    )
  }

  private resolveSubjectForRecord(
    record: LearningSessionRecord,
  ): LearningSubject {
    const learningFlow = record.session.exploration.learningFlow

    if (learningFlow?.kind === 'practice-plan') {
      const installedPack = requireInstalledPack(
        this.getInstalledLearningPacks(),
        learningFlow.packId,
      )

      if (installedPack.packVersion !== learningFlow.packVersion) {
        throw new LearningApplicationError(
          'subject-version-mismatch',
          'Persisted practice plan pack version does not match the installed pack.',
          {
            details: {
              sessionId: record.session.id,
              packId: learningFlow.packId,
              persistedVersion: learningFlow.packVersion,
              installedVersion: installedPack.packVersion,
            },
          },
        )
      }

      const adapter = installedPack.adapters.find(
        (candidate) =>
          candidate.subject.id === record.session.subjectId &&
          learningFlow.selectedItems.every((item) =>
            candidate.subject.activities.some(
              (activity) => activity.id === item.itemId,
            ),
          ),
      )

      return buildPracticeScopedSubject(
        adapter?.subject ??
          buildPracticePackBaseSubject(
            installedPack,
            learningFlow.selectedItems,
          ),
        learningFlow,
      )
    }

    const baseSubject = resolveReadySubject(
      record,
      this.dependencies.subjectRegistry,
    )

    if (learningFlow === undefined) {
      return baseSubject
    }

    const studySet = resolveStudySet({
      packId: learningFlow.packId,
      studySetId: learningFlow.studySetId,
      seed: learningFlow.seed,
      installedPacks: this.getInstalledLearningPacks(),
    })

    return buildStudySetScopedSubject(baseSubject, studySet)
  }

  private resolveStudySetSubject(
    installedPack: InstalledLearningPack,
    studySet: ResolvedStudySet,
  ): LearningSubject {
    const adapter = installedPack.adapters.find((candidate) =>
      studySet.itemIds.every((itemId) =>
        candidate.subject.activities.some((activity) => activity.id === itemId),
      ),
    )

    if (adapter === undefined) {
      throw new LearningApplicationError(
        'session-state-incompatible',
        'StudySet items are not available in a single installed subject runtime.',
        {
          details: {
            packId: installedPack.packId,
            studySetId: studySet.studySetId,
            itemIds: studySet.itemIds,
          },
        },
      )
    }

    return buildStudySetScopedSubject(adapter.subject, studySet)
  }

  private resolvePracticeSubject(
    installedPack: InstalledLearningPack,
    plan: PracticePlan,
  ): LearningSubject {
    const adapter = installedPack.adapters.find((candidate) =>
      plan.selectedItems.every((item) =>
        candidate.subject.activities.some(
          (activity) => activity.id === item.itemId,
        ),
      ),
    )

    return buildPracticeScopedSubject(
      adapter?.subject ??
        buildPracticePackBaseSubject(installedPack, plan.selectedItems),
      plan,
    )
  }

  private getInstalledPackForSubject(
    subjectId: SubjectId,
  ): InstalledLearningPack | null {
    return (
      this.getInstalledLearningPacks().find((pack) =>
        pack.subjects.some((subject) => subject.subjectId === subjectId),
      ) ?? null
    )
  }

  private getInstalledPackForLearningFlow(
    learningFlow: LearningSessionRecord['session']['exploration']['learningFlow'],
  ): InstalledLearningPack | null {
    if (learningFlow === undefined) {
      return null
    }

    return (
      this.getInstalledLearningPacks().find(
        (pack) => pack.packId === learningFlow.packId,
      ) ?? null
    )
  }

  private eligibleRecommendedUses(
    record: LearningSessionRecord,
    activityId: ActivityId,
  ): ResourceRecommendedUse[] {
    const attempts = record.evidenceEvents.filter(
      (event) => event.activityId === activityId,
    )
    const latest = attempts[attempts.length - 1]

    if (latest === undefined) {
      return []
    }

    const uses = new Set<ResourceRecommendedUse>(['after-attempt', 'optional'])
    const unsuccessful = latest.evaluation.status !== 'passed'

    if (unsuccessful) {
      uses.add('after-incorrect')
    }

    const incorrectAttempts = attempts.filter(
      (event) => event.evaluation.status !== 'passed',
    ).length

    if (unsuccessful && incorrectAttempts >= repeatedIncorrectThreshold()) {
      uses.add('after-repeated-incorrect')
    }

    return [...uses]
  }

  private async buildConceptExplorationWithResources(
    record: LearningSessionRecord,
    subject: LearningSubject,
    conceptId: ConceptId,
  ): Promise<SessionConceptExploration> {
    const resources = await this.listInstalledPackResourcesForConcept(
      subject.id,
      conceptId,
    )

    return buildSessionConceptExploration(record, subject, conceptId, resources)
  }

  private async listInstalledPackResourcesForConcept(
    subjectId: SubjectId,
    conceptId: ConceptId,
  ): Promise<readonly LearningResourceLinkReference[]> {
    const installedPack =
      this.getInstalledLearningPacks().find((pack) =>
        pack.subjects.some((subject) => subject.subjectId === subjectId),
      ) ?? null

    if (installedPack === null) {
      return []
    }

    return listResourcesForConcept({
      packId: installedPack.packId,
      conceptId,
      installedPacks: this.getInstalledLearningPacks(),
      engagementEvents:
        await this.dependencies.resourceEngagementStore.listResourceEngagementEvents(
          { packId: installedPack.packId },
        ),
    })
  }

  private createResourceEngagementEventId(occurredAt: string): string {
    const sequence = this.resourceEngagementSequence
    this.resourceEngagementSequence += 1

    return `resource-engagement-${occurredAt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${String(sequence)}`
  }
}

function directoryInstallMessage(change: InstalledPackChange): string {
  switch (change.kind) {
    case 'install':
      return 'Installed locally.'
    case 'reinstall':
      return 'Already installed locally.'
    case 'upgrade':
      return `Updated locally from v${change.fromVersion} to v${change.record.releases.find((release) => release.releaseId === change.record.activeReleaseId)?.packVersion ?? 'the active release'}.`
    case 'reject':
      return installedPackChangeRejectionMessage(change.reason)
  }
}

function installedPackChangeRejectionMessage(
  reason: Extract<InstalledPackChange, { kind: 'reject' }>['reason'],
): string {
  switch (reason) {
    case 'downgrade-blocked':
      return 'The installed release is newer; the proposed downgrade was not applied.'
    case 'invalid-existing-record':
      return 'The installed release record is invalid; no update was applied.'
    case 'invalid-semver':
      return 'The proposed pack version is not valid semantic versioning; no update was applied.'
    case 'pack-id-mismatch':
      return 'The proposed documents do not match their pack identity; no update was applied.'
    case 'same-version-content-conflict':
      return 'A different release uses the active version; the active release was preserved.'
  }
}
