import type {
  LearningPackLibraryCourse,
  LearningPackDirectoryInstallOutcome,
  LearningPackDirectoryInstallResult,
  LearningPackCurriculumEntryView,
  LearningPackLibraryFilters,
  LearningPackLibraryItem,
  LearningPackLibraryNode,
  LearningPackLibraryPack,
  LearningPackLibrarySnapshot,
  LearningPackLibraryStudySet,
  LearningPackLibrarySubject,
  LearningPackLearningStatus,
  PracticeMode,
  PracticeScope,
  PracticeSelectionStrategy,
  SessionLibraryEntry,
} from '../../application'
import type { LearningFlowOrigin } from '../../core/contracts'
import { useState, type RefObject } from 'react'
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  Dumbbell,
  FolderOpen,
  ListFilter,
  PackageOpen,
  RefreshCw,
  Sigma,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useLearntApplication } from '../app/learnt-application-context'
import {
  AsyncStateView,
  EmptyState,
  availabilityLabel,
  availabilityMessage,
  formatDateTime,
  interactionModeLabel,
  sessionStatusLabel,
} from '../components'
import {
  useRouteFocus,
  useSubjectLibrary,
  type SubjectLibraryData,
} from '../hooks'
import { formatRoute } from '../navigation'
import { useProductVocabulary, type ProductVocabularyCopy } from '../vocabulary'

type LibraryView = 'subjects' | 'materials' | 'history'
type TransferReadyView = 'subjects' | 'study-sets' | 'packs' | 'personal'

type LibrarySubjectSummary = SubjectLibraryData['subjects'][number]

export type TransferPreviewState = 'current' | 'empty' | 'loading'

type ImportedSubjectMaterialSource = Readonly<{
  pack: LearningPackLibraryPack
  subject: LearningPackLibrarySubject
}>

type ImportedSubjectMaterialGroup = Readonly<{
  groupId: string
  title: string
  summary: string
  tags: readonly string[]
  sources: readonly ImportedSubjectMaterialSource[]
}>

type ImportedStudySetSource = Readonly<{
  pack: LearningPackLibraryPack
  subject: LearningPackLibrarySubject
  course: LearningPackLibraryCourse
  set: LearningPackLibraryStudySet
}>

type TransferContentCounts = Readonly<{
  courseCount: number
  sectionCount: number
  studySetCount: number
  itemCount: number
  resourceCount: number
}>

type SourceImportAction = 'choose' | 'sync'

type LearningPackSourceImportReport = LearningPackDirectoryInstallResult

type LearningPackSourceImportState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{
      status: 'running'
      action: SourceImportAction
      sourceName?: string
    }>
  | Readonly<{ status: 'success'; report: LearningPackSourceImportReport }>
  | Readonly<{ status: 'error'; message: string }>

export function SubjectLibraryScreen({
  initialView = 'subjects',
  previewState = 'current',
  standalone = false,
}: Readonly<{
  initialView?: LibraryView
  previewState?: TransferPreviewState
  standalone?: boolean
}>) {
  const vocabulary = useProductVocabulary()
  const {
    state,
    chooseAndInstallLearningPackDirectory,
    syncSelectedLearningPackDirectory,
    reload,
    filters,
    setFilters,
  } = useSubjectLibrary()
  const [selectedView, setSelectedView] = useState<LibraryView>(initialView)
  const [sourceDirectoryName, setSourceDirectoryName] = useState<string | null>(
    null,
  )
  const [sourceImportState, setSourceImportState] =
    useState<LearningPackSourceImportState>({ status: 'idle' })
  const hasActiveFilters = Object.values(filters).some(
    (value) => value.length > 0,
  )
  const activeView: LibraryView = hasActiveFilters ? 'materials' : selectedView
  const headingRef = useRouteFocus<HTMLHeadingElement>(activeView)

  if (standalone && previewState === 'loading') {
    return <TransferLoadingPreview headingRef={headingRef} />
  }

  function updateFilters(nextFilters: LearningPackLibraryFilters) {
    setSelectedView('materials')
    setFilters(nextFilters)
  }

  async function chooseDirectory() {
    setSourceImportState({
      status: 'running',
      action: 'choose',
    })

    try {
      const result = await chooseAndInstallLearningPackDirectory()
      if (result === null) {
        setSourceImportState({ status: 'idle' })
        return
      }
      setSourceDirectoryName(result.sourceName)
      setSourceImportState({ status: 'success', report: result })
    } catch (error) {
      setSourceImportState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not import the selected directory.',
      })
    }
  }

  async function refreshDirectory() {
    setSourceImportState({
      status: 'running',
      action: 'sync',
      ...(sourceDirectoryName === null
        ? {}
        : { sourceName: sourceDirectoryName }),
    })

    try {
      const result = await syncSelectedLearningPackDirectory()
      if (result === null) {
        setSourceImportState({
          status: 'error',
          message:
            'No selected directory is available. Choose a directory to sync.',
        })
        return
      }
      setSourceDirectoryName(result.sourceName)
      setSourceImportState({ status: 'success', report: result })
    } catch (error) {
      setSourceImportState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not sync the selected directory.',
      })
    }
  }

  return (
    <AsyncStateView
      state={state}
      loadingLabel={`Loading ${vocabulary.library.title.toLowerCase()}`}
      onRetry={reload}
    >
      {(data) => (
        <SubjectLibraryContent
          activeView={activeView}
          data={data}
          filters={filters}
          headingRef={headingRef}
          previewState={previewState}
          standalone={standalone}
          sourceDirectoryName={sourceDirectoryName}
          sourceImportState={sourceImportState}
          onFiltersChange={updateFilters}
          onImportDirectory={() => void chooseDirectory()}
          onRefreshDirectory={() => void refreshDirectory()}
        />
      )}
    </AsyncStateView>
  )
}

function TransferLoadingPreview({
  headingRef,
}: Readonly<{
  headingRef: RefObject<HTMLHeadingElement | null>
}>) {
  const vocabulary = useProductVocabulary()

  return (
    <div className="learnt-screen learnt-library-screen learnt-library-screen-standalone">
      <div className="learnt-library-workbench learnt-library-workbench-standalone">
        <div className="learnt-library-main">
          <section
            className="learnt-library-section learnt-pack-library"
            aria-labelledby="pack-library-title"
            aria-busy="true"
          >
            <div className="learnt-section-heading-row learnt-pack-library-heading">
              <div>
                <p className="learnt-kicker">Imported content</p>
                <h1 id="pack-library-title" ref={headingRef} tabIndex={-1}>
                  {vocabulary.transfer.title}
                </h1>
              </div>
            </div>
            <div className="learnt-transfer-loading-preview" role="status">
              <span>{`Loading ${vocabulary.transfer.regionLabel.toLowerCase()}`}</span>
              <div aria-hidden="true" />
              <div aria-hidden="true" />
              <div aria-hidden="true" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SubjectLibraryContent({
  activeView,
  data,
  filters,
  headingRef,
  previewState,
  standalone,
  sourceDirectoryName,
  sourceImportState,
  onFiltersChange,
  onImportDirectory,
  onRefreshDirectory,
}: Readonly<{
  activeView: LibraryView
  data: SubjectLibraryData
  filters: LearningPackLibraryFilters
  headingRef: RefObject<HTMLHeadingElement | null>
  previewState: TransferPreviewState
  standalone: boolean
  sourceDirectoryName: string | null
  sourceImportState: LearningPackSourceImportState
  onFiltersChange: (filters: LearningPackLibraryFilters) => void
  onImportDirectory: () => void
  onRefreshDirectory: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const readyActiveSessions = data.sessionLibrary.sessions.filter(
    (session) =>
      session.sessionStatus === 'active' && session.availability === 'ready',
  )
  const mostRecentReady = readyActiveSessions[0] ?? null
  const screenClassName = standalone
    ? 'learnt-screen learnt-library-screen learnt-library-screen-standalone'
    : 'learnt-screen learnt-library-screen'
  const workbenchClassName = standalone
    ? 'learnt-library-workbench learnt-library-workbench-standalone'
    : 'learnt-library-workbench'

  return (
    <div className={screenClassName}>
      <div className={workbenchClassName}>
        <div className="learnt-library-main">
          {data.sessionLibrary.repositoryIssues.length > 0 ? (
            <RepositoryIssues
              issues={data.sessionLibrary.repositoryIssues.map(
                (issue) => issue.code,
              )}
            />
          ) : null}

          {activeView === 'subjects' ? (
            <>
              <section
                className="learnt-library-view-header"
                aria-labelledby="library-title"
              >
                <p className="learnt-kicker">{vocabulary.library.kicker}</p>
                <h1 id="library-title" ref={headingRef} tabIndex={-1}>
                  {vocabulary.library.title}
                </h1>
                <p>{vocabulary.library.description}</p>
              </section>

              {mostRecentReady === null ? null : (
                <ResumePanel session={mostRecentReady} />
              )}

              <SubjectList
                subjects={data.subjects}
                readyActiveSessions={readyActiveSessions}
              />
            </>
          ) : null}

          {activeView === 'materials' ? (
            <LearningPackLibraryPanel
              library={data.learningPackLibrary}
              filters={filters}
              headingRef={headingRef}
              previewState={standalone ? previewState : 'current'}
              sourceDirectoryName={sourceDirectoryName}
              sourceImportState={sourceImportState}
              onFiltersChange={onFiltersChange}
              onImportDirectory={onImportDirectory}
              onRefreshDirectory={onRefreshDirectory}
            />
          ) : null}

          {standalone && activeView === 'history' ? (
            <SessionHistory sessions={data.sessionLibrary.sessions} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ResumePanel({ session }: Readonly<{ session: SessionLibraryEntry }>) {
  const vocabulary = useProductVocabulary()

  return (
    <section
      className="learnt-panel learnt-resume-panel"
      aria-labelledby="resume-title"
    >
      <p className="learnt-kicker">Resume</p>
      <h2 id="resume-title" tabIndex={-1}>
        {sessionSubjectTitle(session, vocabulary)}
      </h2>
      <dl className="learnt-detail-grid">
        <div>
          <dt>Module</dt>
          <dd>{session.currentModuleTitle ?? 'No active module'}</dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>{session.currentActivityTitle ?? 'No active activity'}</dd>
        </div>
        <div>
          <dt>{vocabulary.terms.modeSelector}</dt>
          <dd>{interactionModeLabel(session.interactionMode)}</dd>
        </div>
        <div>
          <dt>Last active</dt>
          <dd>
            <time dateTime={session.lastActiveAt}>
              {formatDateTime(session.lastActiveAt)}
            </time>
          </dd>
        </div>
      </dl>
      <div className="learnt-action-row">
        <a
          className="learnt-button"
          href={formatRoute({
            kind: 'session',
            sessionId: session.sessionId,
          })}
        >
          Continue session
        </a>
        <a
          className="learnt-button learnt-button-secondary"
          href={formatRoute({
            kind: 'session-recap',
            sessionId: session.sessionId,
          })}
        >
          View Recap
        </a>
      </div>
    </section>
  )
}

function SubjectList({
  subjects,
  readyActiveSessions,
}: Readonly<{
  subjects: SubjectLibraryData['subjects']
  readyActiveSessions: readonly SessionLibraryEntry[]
}>) {
  const vocabulary = useProductVocabulary()

  return subjects.length === 0 ? (
    <EmptyState
      title={vocabulary.library.emptyTitle}
      message={vocabulary.library.emptyMessage}
    />
  ) : (
    <section
      aria-label={vocabulary.terms.subjectPlural}
      className="learnt-library-section learnt-subject-library-section"
    >
      <div className="learnt-subject-grid">
        {subjects.map((subject) => {
          const activeSession =
            readyActiveSessions.find(
              (session) => session.subjectId === subject.id,
            ) ?? null
          const SubjectIcon = subjectIcon(subject.title, subject.tags)
          const progressPercent = subjectProgressPercent(subject, activeSession)
          const progressPercentText = progressPercent.toString()
          const progressLabel = `${subject.title} progress: ${progressPercentText}%`
          const primaryHref =
            activeSession === null
              ? formatRoute({
                  kind: 'subject',
                  subjectId: subject.id,
                })
              : formatRoute({
                  kind: 'session',
                  sessionId: activeSession.sessionId,
                })
          const primaryAction =
            activeSession === null
              ? vocabulary.library.viewSubjectAction
              : 'Continue'

          return (
            <article
              className={
                activeSession === null
                  ? 'learnt-subject-card'
                  : 'learnt-subject-card learnt-subject-card-active'
              }
              key={subject.id}
            >
              <header className="learnt-subject-card-header">
                <span className="learnt-subject-avatar" aria-hidden="true">
                  <SubjectIcon size={20} strokeWidth={2.2} />
                </span>
                <div>
                  <h3>{subject.title}</h3>
                  <p className="learnt-subject-subtitle">
                    {subject.tags.slice(0, 2).join(' / ')}
                  </p>
                </div>
              </header>
              <p className="learnt-subject-summary">{subject.summary}</p>
              <div
                aria-label={progressLabel}
                className="learnt-subject-progress"
                role="progressbar"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progressPercent}
              >
                <span style={{ width: `${progressPercentText}%` }} />
              </div>
              <div className="learnt-subject-card-footer">
                <span className="learnt-subject-meta">
                  {subjectCardMeta(subject, activeSession)}
                </span>
                <a className="learnt-subject-card-link" href={primaryHref}>
                  <span>{primaryAction}</span>
                  <ArrowRight aria-hidden="true" size={14} strokeWidth={2.4} />
                </a>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LearningPackLibraryPanel({
  library,
  filters,
  headingRef,
  previewState,
  sourceDirectoryName,
  sourceImportState,
  onFiltersChange,
  onImportDirectory,
  onRefreshDirectory,
}: Readonly<{
  library: LearningPackLibrarySnapshot
  filters: LearningPackLibraryFilters
  headingRef: RefObject<HTMLHeadingElement | null>
  previewState: TransferPreviewState
  sourceDirectoryName: string | null
  sourceImportState: LearningPackSourceImportState
  onFiltersChange: (filters: LearningPackLibraryFilters) => void
  onImportDirectory: () => void
  onRefreshDirectory: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const [selectedTransferView, setSelectedTransferView] =
    useState<TransferReadyView>('subjects')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null,
  )
  const materialGroups = buildImportedSubjectMaterialGroups(library)
  const studySetSources = buildImportedStudySetSources(library)
  const statusOnlyPacks = library.packs.filter(
    (pack) => pack.subjects.length === 0,
  )
  const isTransferEmpty = previewState === 'empty' || library.isEmpty
  const selectedSubject =
    materialGroups.find((group) => group.groupId === selectedSubjectId) ??
    materialGroups[0] ??
    null
  const visibleTransferView =
    materialGroups.length === 0 && selectedTransferView === 'subjects'
      ? 'packs'
      : selectedTransferView

  return (
    <section
      className="learnt-library-section learnt-pack-library"
      aria-labelledby="pack-library-title"
    >
      <div className="learnt-section-heading-row learnt-pack-library-heading">
        <div>
          <p className="learnt-kicker">Imported content</p>
          <h1 id="pack-library-title" ref={headingRef} tabIndex={-1}>
            {vocabulary.transfer.title}
          </h1>
          <p>{vocabulary.transfer.description}</p>
        </div>
        {isTransferEmpty ? null : (
          <LearningPackFilters
            library={library}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        )}
      </div>

      {isTransferEmpty ? (
        <TransferEmptyState
          sourceImportState={sourceImportState}
          onImportDirectory={onImportDirectory}
          onRefreshDirectory={onRefreshDirectory}
        />
      ) : materialGroups.length === 0 && statusOnlyPacks.length === 0 ? (
        <EmptyState
          title={`No matching ${vocabulary.terms.subjectMaterials.toLowerCase()}`}
          message="The installed material library has no content matching the current filters."
        />
      ) : (
        <>
          <TransferReadyStats library={library} />
          <TransferReadyViewSwitcher
            selectedView={visibleTransferView}
            library={library}
            studySetCount={studySetSources.length}
            onSelectedViewChange={setSelectedTransferView}
          />
          {sourceDirectoryName === null ? null : (
            <TransferSourceDirectoryQuickActions
              sourceDirectoryName={sourceDirectoryName}
              sourceImportState={sourceImportState}
              onRefreshDirectory={onRefreshDirectory}
            />
          )}
          {sourceImportState.status === 'idle' ? null : (
            <LearningPackSourceImportStatus state={sourceImportState} />
          )}
          {visibleTransferView === 'subjects' ? (
            <TransferSubjectCardsView
              materialGroups={materialGroups}
              selectedSubject={selectedSubject}
              onSelectedSubjectChange={setSelectedSubjectId}
            />
          ) : null}
          {visibleTransferView === 'study-sets' ? (
            <TransferStudySetsView studySetSources={studySetSources} />
          ) : null}
          {visibleTransferView === 'packs' ? (
            <TransferPacksView
              library={library}
              sourceDirectoryName={sourceDirectoryName}
              sourceImportState={sourceImportState}
              onImportDirectory={onImportDirectory}
              onRefreshDirectory={onRefreshDirectory}
            />
          ) : null}
          {visibleTransferView === 'personal' ? <TransferPersonalView /> : null}
        </>
      )}
    </section>
  )
}

function TransferReadyStats({
  library,
}: Readonly<{ library: LearningPackLibrarySnapshot }>) {
  const vocabulary = useProductVocabulary()

  return (
    <dl className="learnt-count-row learnt-transfer-ready-stats">
      <div>
        <dt>{vocabulary.terms.subjectPlural}</dt>
        <dd>{library.summary.subjectCount}</dd>
      </div>
      <div>
        <dt>{vocabulary.terms.studySetPlural}</dt>
        <dd>{countStudySets(library)}</dd>
      </div>
      <div>
        <dt>{vocabulary.terms.learningItemPlural}</dt>
        <dd>{library.summary.visibleItemCount}</dd>
      </div>
      <div>
        <dt>{vocabulary.terms.packPlural}</dt>
        <dd>{library.summary.packCount}</dd>
      </div>
    </dl>
  )
}

function TransferReadyViewSwitcher({
  selectedView,
  library,
  studySetCount,
  onSelectedViewChange,
}: Readonly<{
  selectedView: TransferReadyView
  library: LearningPackLibrarySnapshot
  studySetCount: number
  onSelectedViewChange: (view: TransferReadyView) => void
}>) {
  const vocabulary = useProductVocabulary()
  const tabs: readonly Readonly<{
    id: TransferReadyView
    label: string
    meta: string
  }>[] = [
    {
      id: 'subjects',
      label: vocabulary.terms.subjectPlural,
      meta: countLabel(library.summary.subjectCount, 'ready', 'ready'),
    },
    {
      id: 'study-sets',
      label: vocabulary.terms.studySetPlural,
      meta: countLabel(studySetCount, 'set', 'sets'),
    },
    {
      id: 'packs',
      label: 'Packs',
      meta: countLabel(library.summary.packCount, 'source', 'sources'),
    },
    {
      id: 'personal',
      label: 'Personal',
      meta: 'private drafts',
    },
  ]

  return (
    <div
      className="learnt-transfer-view-tabs"
      role="tablist"
      aria-label="Transfer views"
    >
      {tabs.map((tab) => {
        const selected = selectedView === tab.id

        return (
          <button
            aria-current={selected ? 'page' : undefined}
            aria-selected={selected}
            className="learnt-transfer-view-tab"
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => {
              onSelectedViewChange(tab.id)
            }}
          >
            <span>{tab.label}</span>
            <small>{tab.meta}</small>
          </button>
        )
      })}
    </div>
  )
}

function TransferSubjectCardsView({
  materialGroups,
  selectedSubject,
  onSelectedSubjectChange,
}: Readonly<{
  materialGroups: readonly ImportedSubjectMaterialGroup[]
  selectedSubject: ImportedSubjectMaterialGroup | null
  onSelectedSubjectChange: (subjectId: string) => void
}>) {
  const vocabulary = useProductVocabulary()

  if (materialGroups.length === 0) {
    return (
      <EmptyState
        title={`No browsable ${vocabulary.terms.subjectPlural.toLowerCase()}`}
        message={`The installed ${vocabulary.terms.packPlural.toLowerCase()} have status records, but no route content is currently available.`}
      />
    )
  }

  return (
    <div className="learnt-transfer-subjects">
      <div className="learnt-transfer-subject-grid">
        {materialGroups.map((group) => (
          <TransferSubjectCard
            group={group}
            key={group.groupId}
            selected={selectedSubject?.groupId === group.groupId}
            onSelect={() => {
              onSelectedSubjectChange(group.groupId)
            }}
          />
        ))}
      </div>
      {selectedSubject === null ? null : (
        <section
          className="learnt-transfer-subject-detail"
          aria-labelledby={transferSubjectDetailDomId(selectedSubject)}
        >
          <div className="learnt-section-heading-row">
            <p className="learnt-kicker">{vocabulary.library.sourceDetails}</p>
            <h2 id={transferSubjectDetailDomId(selectedSubject)}>
              {selectedSubject.title} content
            </h2>
          </div>
          <div className="learnt-pack-source-list">
            {selectedSubject.sources.map((source) => (
              <PackMaterialSource
                source={source}
                key={materialSourceKey(source)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TransferSubjectCard({
  group,
  selected,
  onSelect,
}: Readonly<{
  group: ImportedSubjectMaterialGroup
  selected: boolean
  onSelect: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const counts = countImportedSubjectContent(group)
  const status = transferSubjectStatus(group)

  return (
    <article
      className={
        selected
          ? 'learnt-transfer-subject-card learnt-transfer-subject-card-selected'
          : 'learnt-transfer-subject-card'
      }
      data-state={status.state}
    >
      <header>
        <span className="learnt-transfer-subject-avatar" aria-hidden="true">
          {initials(group.title)}
        </span>
        <div>
          <h3>{group.title}</h3>
          <p>{group.tags[0] ?? vocabulary.terms.subjectSingular}</p>
        </div>
        <span className="learnt-transfer-status-chip" data-state={status.state}>
          {status.state === 'ready' ? (
            <CheckCircle2 aria-hidden="true" size={13} strokeWidth={2.3} />
          ) : (
            <CircleAlert aria-hidden="true" size={13} strokeWidth={2.3} />
          )}
          {status.label}
        </span>
      </header>
      <p>{group.summary}</p>
      <ul className="learnt-tag-list" aria-label={`${group.title} tags`}>
        {group.tags.slice(0, 4).map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className="learnt-transfer-card-counts">
        <span>
          {countLabel(counts.courseCount, 'route', 'routes')} /{' '}
          {countLabel(counts.sectionCount, 'section', 'sections')}
        </span>
        <span>
          {countLabel(counts.studySetCount, 'set', 'sets')} /{' '}
          {countLabel(counts.itemCount, 'item', 'items')}
        </span>
      </div>
      <div className="learnt-transfer-card-footer">
        <span>
          {countLabel(group.sources.length, 'source pack', 'source packs')}
        </span>
        <button
          aria-pressed={selected}
          className="learnt-button"
          type="button"
          onClick={onSelect}
        >
          <span>{selected ? 'Open' : 'Open'}</span>
          <ArrowRight aria-hidden="true" size={14} strokeWidth={2.4} />
        </button>
      </div>
    </article>
  )
}

function TransferStudySetsView({
  studySetSources,
}: Readonly<{ studySetSources: readonly ImportedStudySetSource[] }>) {
  const vocabulary = useProductVocabulary()

  return studySetSources.length === 0 ? (
    <EmptyState
      title={vocabulary.transfer.noCheckpointSets}
      message={`Installed ${vocabulary.terms.packPlural.toLowerCase()} can still include readings and route content.`}
    />
  ) : (
    <div
      className="learnt-transfer-study-set-list"
      aria-label={vocabulary.terms.studySetPlural}
    >
      {studySetSources.map((source) => (
        <TransferStudySetRow source={source} key={studySetSourceKey(source)} />
      ))}
    </div>
  )
}

function TransferStudySetRow({
  source,
}: Readonly<{ source: ImportedStudySetSource }>) {
  const vocabulary = useProductVocabulary()
  const primaryMode = source.set.playModes[0] ?? 'self-grade-review'

  return (
    <article className="learnt-transfer-study-set-row">
      <span className="learnt-transfer-row-icon" aria-hidden="true">
        <BookOpen size={18} strokeWidth={2.2} />
      </span>
      <div>
        <h3>{source.set.title}</h3>
        <p>
          {source.subject.title} / {source.course.title} /{' '}
          {countLabel(
            source.set.itemCount,
            vocabulary.terms.learningItemSingular.toLowerCase(),
            vocabulary.terms.learningItemPlural.toLowerCase(),
          )}
        </p>
      </div>
      <span className="learnt-transfer-mode-chip">
        {playModeLabel(primaryMode)}
      </span>
      <PracticeLaunchButton
        label={vocabulary.terms.practiceAction}
        scope={{
          kind: 'study-set',
          packId: source.set.packId,
          studySetId: source.set.setId,
        }}
        mode="flashcard"
        selectionStrategy="authored-order"
        returnRoute={formatRoute({ kind: 'transfer' })}
        disabled={source.set.itemCount === 0}
      />
    </article>
  )
}

function TransferPacksView({
  library,
  sourceDirectoryName,
  sourceImportState,
  onImportDirectory,
  onRefreshDirectory,
}: Readonly<{
  library: LearningPackLibrarySnapshot
  sourceDirectoryName: string | null
  sourceImportState: LearningPackSourceImportState
  onImportDirectory: () => void
  onRefreshDirectory: () => void
}>) {
  return (
    <div className="learnt-transfer-packs">
      <div className="learnt-transfer-pack-list">
        {library.packs.map((pack) => (
          <TransferPackRow pack={pack} key={packKey(pack)} />
        ))}
      </div>
      <LearningPackSourceControls
        sourceDirectoryName={sourceDirectoryName}
        sourceImportState={sourceImportState}
        onImportDirectory={onImportDirectory}
        onRefreshDirectory={onRefreshDirectory}
      />
    </div>
  )
}

function TransferSourceDirectoryQuickActions({
  sourceDirectoryName,
  sourceImportState,
  onRefreshDirectory,
}: Readonly<{
  sourceDirectoryName: string
  sourceImportState: LearningPackSourceImportState
  onRefreshDirectory: () => void
}>) {
  return (
    <div className="learnt-transfer-source-quick-actions">
      <p className="learnt-source-import-path">
        Selected: {sourceDirectoryName}
      </p>
      <button
        className="learnt-button learnt-button-secondary"
        type="button"
        disabled={sourceImportState.status === 'running'}
        onClick={onRefreshDirectory}
      >
        <RefreshCw
          className="learnt-icon"
          aria-hidden="true"
          size={16}
          strokeWidth={2.2}
        />
        <span>Sync selected directory</span>
      </button>
    </div>
  )
}

function TransferPackRow({
  pack,
}: Readonly<{ pack: LearningPackLibraryPack }>) {
  const vocabulary = useProductVocabulary()
  const status = transferPackStatus(pack)

  return (
    <article
      className={`learnt-transfer-pack-row learnt-pack-card-${pack.visualToken}`}
      data-state={pack.state}
    >
      <span className="learnt-transfer-pack-bar" aria-hidden="true" />
      <div>
        <h3>{pack.title}</h3>
        <p>
          v{pack.packVersion} /{' '}
          {countLabel(pack.subjectCount, 'subject', 'subjects')} /{' '}
          {countLabel(pack.courseCount, 'route', 'routes')} /{' '}
          {countLabel(pack.itemCount, 'item', 'items')}
        </p>
      </div>
      <span className="learnt-transfer-pack-status" data-state={status.state}>
        {status.state === 'ready' ? (
          <CheckCircle2 aria-hidden="true" size={13} strokeWidth={2.3} />
        ) : (
          <CircleAlert aria-hidden="true" size={13} strokeWidth={2.3} />
        )}
        {status.label}
      </span>
      {pack.stateMessage === null ? null : <p>{pack.stateMessage}</p>}
      <PackDiagnostics pack={pack} />
      {pack.subjects.length > 0 ? null : (
        <p className="learnt-muted">
          {vocabulary.transfer.sourcePackUnavailable}
        </p>
      )}
    </article>
  )
}

function TransferPersonalView() {
  return (
    <section
      className="learnt-transfer-personal"
      aria-labelledby="transfer-personal-title"
    >
      <span className="learnt-transfer-row-icon" aria-hidden="true">
        <PackageOpen size={18} strokeWidth={2.2} />
      </span>
      <div>
        <h2 id="transfer-personal-title">Personal</h2>
        <p>
          Cards and study sets you create will live here. They stay private to
          this workspace unless you package and share them.
        </p>
      </div>
      <button className="learnt-button learnt-button-secondary" disabled>
        New study set
      </button>
    </section>
  )
}

function TransferEmptyState({
  sourceImportState,
  onImportDirectory,
  onRefreshDirectory,
}: Readonly<{
  sourceImportState: LearningPackSourceImportState
  onImportDirectory: () => void
  onRefreshDirectory: () => void
}>) {
  const vocabulary = useProductVocabulary()

  return (
    <div className="learnt-transfer-empty-workbench">
      <LearningPackSourceControls
        sourceDirectoryName={null}
        sourceImportState={sourceImportState}
        onImportDirectory={onImportDirectory}
        onRefreshDirectory={onRefreshDirectory}
      />
      <section
        className="learnt-transfer-empty"
        role="status"
        aria-labelledby="transfer-empty-title"
      >
        <span className="learnt-transfer-empty-icon" aria-hidden="true">
          <BookOpen size={24} strokeWidth={1.8} />
        </span>
        <h2 id="transfer-empty-title">{vocabulary.transfer.emptyTitle}</h2>
        <p>{vocabulary.transfer.emptyMessage}</p>
      </section>
    </div>
  )
}

function LearningPackSourceControls({
  sourceDirectoryName,
  sourceImportState,
  onImportDirectory,
  onRefreshDirectory,
}: Readonly<{
  sourceDirectoryName: string | null
  sourceImportState: LearningPackSourceImportState
  onImportDirectory: () => void
  onRefreshDirectory: () => void
}>) {
  const vocabulary = useProductVocabulary()
  const isRunning = sourceImportState.status === 'running'

  return (
    <section
      className="learnt-source-import-panel"
      aria-labelledby="source-import-title"
    >
      <div>
        <p className="learnt-kicker">{vocabulary.transfer.importTitle}</p>
        <h2 id="source-import-title">Local pack directory</h2>
        <p>{vocabulary.transfer.importDescription}</p>
        <p className="learnt-source-import-path">
          {sourceDirectoryName === null
            ? 'No directory selected.'
            : `Selected: ${sourceDirectoryName}`}
        </p>
      </div>
      <div className="learnt-source-import-actions">
        <button
          className="learnt-button"
          type="button"
          disabled={isRunning}
          onClick={onImportDirectory}
        >
          <FolderOpen
            className="learnt-icon"
            aria-hidden="true"
            size={16}
            strokeWidth={2.2}
          />
          <span>Choose pack directory</span>
        </button>
        <button
          className="learnt-button learnt-button-secondary"
          type="button"
          disabled={isRunning}
          onClick={onRefreshDirectory}
        >
          <RefreshCw
            className="learnt-icon"
            aria-hidden="true"
            size={16}
            strokeWidth={2.2}
          />
          <span>Sync selected directory</span>
        </button>
      </div>
      <LearningPackSourceImportStatus state={sourceImportState} />
    </section>
  )
}

function LearningPackSourceImportStatus({
  state,
}: Readonly<{ state: LearningPackSourceImportState }>) {
  const vocabulary = useProductVocabulary()

  if (state.status === 'idle') {
    return null
  }

  if (state.status === 'running') {
    return (
      <p className="learnt-inline-status" aria-live="polite">
        {sourceImportActionLabel(state.action)}{' '}
        {state.sourceName ?? 'directory'}
        ...
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p
        className="learnt-inline-status learnt-inline-status-warning"
        role="alert"
      >
        {state.message}
      </p>
    )
  }

  const installedCount = state.report.outcomes.filter(
    (outcome) =>
      outcome.status === 'installed' || outcome.status === 'reinstalled',
  ).length
  const invalidCount = state.report.outcomes.filter(
    (outcome) =>
      outcome.status === 'invalid' ||
      outcome.status === 'rejected' ||
      outcome.status === 'installation-error',
  ).length
  const scannedDirectoryCount = String(state.report.scannedDirectoryCount)
  const importedDirectoryCount = String(installedCount)
  const invalidDirectoryCount = String(invalidCount)

  return (
    <div className="learnt-source-import-report" aria-live="polite">
      <p className="learnt-inline-status">
        {state.report.outcomes.length === 0
          ? `Scanned ${scannedDirectoryCount} directories in ${state.report.sourceName}. No canonical ${vocabulary.terms.packPlural.toLowerCase()} were found.`
          : `Installed ${importedDirectoryCount} ${vocabulary.terms.packPlural.toLowerCase()} from ${state.report.sourceName}. ${invalidDirectoryCount} need attention.`}
      </p>
      {state.report.outcomes.length === 0 ? null : (
        <ul className="learnt-source-import-list">
          {state.report.outcomes.map((outcome) => (
            <LearningPackSourceImportOutcome
              outcome={outcome}
              key={`${outcome.directoryName}-${outcome.status}-${outcomePackKey(outcome)}`}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function LearningPackSourceImportOutcome({
  outcome,
}: Readonly<{ outcome: LearningPackDirectoryInstallOutcome }>) {
  return (
    <li data-status={outcome.status}>
      <div>
        <strong>{outcomeTitle(outcome)}</strong>
        <span>{outcome.directoryName}</span>
      </div>
      <p>{outcome.message}</p>
      {outcome.diagnostics.length === 0 ? null : (
        <details>
          <summary>{outcome.diagnostics.length} validation details</summary>
          <ul className="learnt-pack-diagnostics">
            {outcome.diagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.code}-${diagnostic.path}-${String(index)}`}
              >
                {diagnostic.severity}: {diagnostic.code} at {diagnostic.path}
                {diagnostic.message.length === 0
                  ? ''
                  : ` - ${diagnostic.message}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function LearningPackFilters({
  library,
  filters,
  onFiltersChange,
}: Readonly<{
  library: LearningPackLibrarySnapshot
  filters: LearningPackLibraryFilters
  onFiltersChange: (filters: LearningPackLibraryFilters) => void
}>) {
  const vocabulary = useProductVocabulary()

  function updateFilter(key: keyof LearningPackLibraryFilters, value: string) {
    const nextFilters: Record<string, string> = {}

    for (const [entryKey, entryValue] of Object.entries(filters)) {
      if (entryKey !== key) {
        nextFilters[entryKey] = entryValue
      }
    }

    if (value.length > 0) {
      nextFilters[key] = value
    }

    onFiltersChange(nextFilters)
  }

  const hasFilters = Object.values(filters).some((value) => value.length > 0)
  const filterCount = Object.keys(filters).length

  return (
    <details className="learnt-library-filter-menu">
      <summary>
        <ListFilter
          className="learnt-icon"
          aria-hidden="true"
          size={17}
          strokeWidth={2.2}
        />
        <span>Filters</span>
        {filterCount === 0 ? null : (
          <span className="learnt-filter-count">{filterCount}</span>
        )}
        <ChevronDown
          className="learnt-filter-chevron"
          aria-hidden="true"
          size={16}
          strokeWidth={2.4}
        />
      </summary>
      <form
        className="learnt-library-filter-panel"
        aria-label="Library filters"
      >
        <FilterSelect
          label={vocabulary.terms.packSingular}
          value={filters.installedPackId}
          options={library.filterOptions.installedPacks}
          onChange={(value) => {
            updateFilter('installedPackId', value)
          }}
        />
        <FilterSelect
          label={vocabulary.terms.subjectSingular}
          value={filters.subjectId}
          options={library.filterOptions.subjects}
          onChange={(value) => {
            updateFilter('subjectId', value)
          }}
        />
        <FilterSelect
          label={vocabulary.terms.courseSingular}
          value={filters.courseId}
          options={library.filterOptions.courses}
          onChange={(value) => {
            updateFilter('courseId', value)
          }}
        />
        <FilterSelect
          label="Concept"
          value={filters.conceptId}
          options={library.filterOptions.concepts}
          onChange={(value) => {
            updateFilter('conceptId', value)
          }}
        />
        <FilterSelect
          label="Objective"
          value={filters.objectiveId}
          options={library.filterOptions.objectives}
          onChange={(value) => {
            updateFilter('objectiveId', value)
          }}
        />
        <FilterSelect
          label={vocabulary.terms.itemMode}
          value={filters.itemMode}
          options={library.filterOptions.itemModes}
          onChange={(value) => {
            updateFilter('itemMode', value)
          }}
        />
        <FilterSelect
          label="Authored tag"
          value={filters.authoredTag}
          options={library.filterOptions.authoredTags}
          onChange={(value) => {
            updateFilter('authoredTag', value)
          }}
        />
        <FilterSelect
          label="Learning status"
          value={filters.learningStatus}
          options={library.filterOptions.learningStatuses}
          onChange={(value) => {
            updateFilter('learningStatus', value)
          }}
        />
        <button
          className="learnt-button learnt-button-secondary"
          type="button"
          disabled={!hasFilters}
          onClick={() => {
            onFiltersChange({})
          }}
        >
          Clear filters
        </button>
      </form>
    </details>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string
  value: string | undefined
  options: readonly { id: string; label: string }[]
  onChange: (value: string) => void
}>) {
  return (
    <label className="learnt-field">
      <span>{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => {
          onChange(event.currentTarget.value)
        }}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function PackMaterialSource({
  source,
}: Readonly<{ source: ImportedSubjectMaterialSource }>) {
  const vocabulary = useProductVocabulary()
  const { pack, subject } = source

  return (
    <section
      className={`learnt-pack-source learnt-pack-card-${pack.visualToken}`}
      data-state={pack.state}
      aria-labelledby={materialSourceDomId(source)}
    >
      <header className="learnt-pack-card-header">
        <span className="learnt-pack-token" aria-hidden="true">
          <PackStateIcon state={pack.state} />
        </span>
        <div>
          <p className="learnt-kicker">
            {vocabulary.transfer.sourcePackKicker}
          </p>
          <h3 id={materialSourceDomId(source)} tabIndex={-1}>
            {pack.title}
          </h3>
          <p>{pack.summary}</p>
          <ul className="learnt-tag-list" aria-label={`${pack.title} state`}>
            <li>{pack.packVersion}</li>
            <li>{packStateLabel(pack.state)}</li>
            {pack.visualLabel === null ? null : (
              <li>
                {vocabulary.transfer.visualStyleLabel}: {pack.visualLabel}
              </li>
            )}
          </ul>
        </div>
      </header>

      {pack.stateMessage === null ? null : (
        <p className="learnt-inline-status">{pack.stateMessage}</p>
      )}

      <PackDiagnostics pack={pack} />

      <div className="learnt-pack-course-list">
        {subject.courses.map((course) => (
          <PackCourseSection course={course} key={course.courseId} />
        ))}
      </div>
    </section>
  )
}

function PackDiagnostics({
  pack,
}: Readonly<{ pack: LearningPackLibraryPack }>) {
  return pack.diagnostics.length === 0 ? null : (
    <ul className="learnt-pack-diagnostics" aria-label="Pack diagnostics">
      {pack.diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${diagnostic.path}-${String(index)}`}>
          {diagnostic.severity}: {diagnostic.code} at {diagnostic.path}
        </li>
      ))}
    </ul>
  )
}

function PackCourseSection({
  course,
}: Readonly<{ course: LearningPackLibraryCourse }>) {
  const vocabulary = useProductVocabulary()
  const itemCount = countCourseContent(course).itemCount

  return (
    <section
      className="learnt-pack-course"
      aria-labelledby={courseDomId(course)}
    >
      <header>
        <p className="learnt-kicker">{vocabulary.terms.courseSingular}</p>
        <h4 id={courseDomId(course)} tabIndex={-1}>
          {course.title}
        </h4>
        <p>{course.summary}</p>
        <div className="learnt-action-row">
          <PracticeLaunchButton
            label="Practice route"
            scope={{
              kind: 'course',
              packId: course.packId,
              courseId: course.courseId,
            }}
            mode="mixed"
            selectionStrategy="authored-order"
            returnRoute={formatRoute({ kind: 'library' })}
            disabled={itemCount === 0}
          />
        </div>
      </header>
      <div className="learnt-pack-node-list">
        {course.rootNodes.map((node) => (
          <PackCurriculumNode node={node} depth={0} key={node.nodeId} />
        ))}
      </div>
    </section>
  )
}

function PackCurriculumNode({
  node,
  depth,
}: Readonly<{ node: LearningPackLibraryNode; depth: number }>) {
  const headingId = nodeDomId(node)
  const itemCount = countNodeContent(node).itemCount

  return (
    <article
      className="learnt-pack-node"
      data-depth={String(Math.min(depth, 4))}
      aria-labelledby={headingId}
    >
      <header>
        <p className="learnt-kicker">{node.kindLabel}</p>
        <h5 id={headingId} tabIndex={-1}>
          {node.title}
        </h5>
        <p>{node.summary}</p>
        {itemCount === 0 ? null : (
          <div className="learnt-action-row">
            <PracticeLaunchButton
              label="Practice section"
              scope={{
                kind: 'curriculum-node',
                packId: node.packId,
                courseId: node.courseId,
                nodeId: node.nodeId,
                includeDescendants: true,
              }}
              mode="mixed"
              selectionStrategy="authored-order"
              returnRoute={formatRoute({ kind: 'library' })}
            />
          </div>
        )}
      </header>

      {node.entries.length > 0 ? (
        <CurriculumEntryList entries={node.entries} />
      ) : (
        <>
          {node.studySets.length === 0 ? null : (
            <StudySetList sets={node.studySets} ownerNodeId={node.nodeId} />
          )}

          {node.items.length === 0 ? null : (
            <LearningItemList items={node.items} />
          )}
        </>
      )}

      {node.children.length === 0 ? null : (
        <div className="learnt-pack-node-children">
          {node.children.map((child) => (
            <PackCurriculumNode
              node={child}
              depth={depth + 1}
              key={child.nodeId}
            />
          ))}
        </div>
      )}
    </article>
  )
}

function CurriculumEntryList({
  entries,
}: Readonly<{ entries: readonly LearningPackCurriculumEntryView[] }>) {
  const vocabulary = useProductVocabulary()

  return (
    <ol
      className="learnt-learning-item-list"
      aria-label={vocabulary.transfer.orderedContentLabel}
    >
      {entries.map((entry) => (
        <li className="learnt-learning-item" key={entryDomId(entry)}>
          <div>
            <p className="learnt-kicker">
              {entryKindLabel(entry.kind, vocabulary)}
            </p>
            <h6 id={entryDomId(entry)} tabIndex={-1}>
              {entry.title}
            </h6>
            {'summary' in entry &&
            typeof entry.summary === 'string' &&
            entry.summary.length > 0 ? (
              <p>{entry.summary}</p>
            ) : null}
          </div>
          <dl className="learnt-detail-grid">
            <div>
              <dt>Type</dt>
              <dd>{entryKindLabel(entry.kind, vocabulary)}</dd>
            </div>
            {entry.kind === 'resource' ? (
              <>
                <div>
                  <dt>Modality</dt>
                  <dd>{entry.modality}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{entry.sourceKind}</dd>
                </div>
              </>
            ) : null}
            {entry.kind === 'study-set' ? (
              <div>
                <dt>{vocabulary.terms.learningItemPlural}</dt>
                <dd>{entry.itemCount}</dd>
              </div>
            ) : null}
          </dl>
          {entry.kind === 'resource' ? (
            <a
              className="learnt-button learnt-button-secondary"
              href={formatRoute({
                kind: 'resource',
                packId: entry.packId,
                resourceId: entry.resourceId,
                ...(entry.segmentId === null
                  ? {}
                  : { segmentId: entry.segmentId }),
              })}
            >
              Open {vocabulary.terms.resource.toLowerCase()}
            </a>
          ) : null}
          {entry.kind === 'study-set' ? (
            <PracticeLaunchButton
              label={`Start ${vocabulary.terms.studySetSingular.toLowerCase()}`}
              scope={{
                kind: 'study-set',
                packId: entry.packId,
                studySetId: entry.setId,
              }}
              mode="flashcard"
              selectionStrategy="authored-order"
              returnRoute={formatRoute({ kind: 'library' })}
              disabled={entry.itemCount === 0}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function StudySetList({
  sets,
  ownerNodeId,
}: Readonly<{
  sets: readonly LearningPackLibraryStudySet[]
  ownerNodeId: string
}>) {
  const vocabulary = useProductVocabulary()

  return (
    <div
      className="learnt-study-set-list"
      aria-label={vocabulary.terms.studySetPlural}
    >
      {sets.map((set) => (
        <article className="learnt-study-set" key={set.setId}>
          <p className="learnt-kicker">{vocabulary.terms.studySetSingular}</p>
          <h6 id={studySetDomId(set, ownerNodeId)} tabIndex={-1}>
            {set.title}
          </h6>
          <p>{set.summary}</p>
          <ul className="learnt-tag-list" aria-label={`${set.title} details`}>
            <li>{set.kind}</li>
            <li>
              {set.itemCount}{' '}
              {vocabulary.terms.learningItemPlural.toLowerCase()}
            </li>
            {set.playModes.map((mode) => (
              <li key={mode}>{playModeLabel(mode)}</li>
            ))}
          </ul>
          <PracticeLaunchButton
            label={`Start ${vocabulary.terms.studySetSingular.toLowerCase()}`}
            scope={{
              kind: 'study-set',
              packId: set.packId,
              studySetId: set.setId,
            }}
            mode="flashcard"
            selectionStrategy="authored-order"
            returnRoute={formatRoute({ kind: 'library' })}
            disabled={set.itemCount === 0}
          />
        </article>
      ))}
    </div>
  )
}

function PracticeLaunchButton({
  label,
  scope,
  mode,
  selectionStrategy,
  count,
  returnRoute,
  disabled = false,
}: Readonly<{
  label: string
  scope: PracticeScope
  mode: PracticeMode
  selectionStrategy: PracticeSelectionStrategy
  count?: number
  returnRoute: string
  disabled?: boolean
}>) {
  const application = useLearntApplication()
  const [status, setStatus] = useState<'idle' | 'starting'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isStarting = status === 'starting'

  return (
    <span className="learnt-practice-launch">
      <button
        className="learnt-button"
        type="button"
        disabled={disabled || isStarting}
        aria-busy={isStarting || undefined}
        onClick={() => {
          setStatus('starting')
          setErrorMessage(null)
          void application
            .startPracticeSession({
              scope,
              mode,
              selectionStrategy,
              ...(count === undefined ? {} : { count }),
              origin: practiceLaunchOrigin(scope, returnRoute),
            })
            .then((started) => {
              window.location.hash = formatRoute({
                kind: 'session',
                sessionId: started.context.record.session.id,
              })
            })
            .catch((error: unknown) => {
              setErrorMessage(practiceLaunchErrorMessage(error))
            })
            .finally(() => {
              setStatus('idle')
            })
        }}
      >
        <Dumbbell
          className="learnt-icon"
          aria-hidden="true"
          size={16}
          strokeWidth={2.2}
        />
        <span>{isStarting ? 'Starting...' : label}</span>
      </button>
      {errorMessage === null ? null : (
        <span className="learnt-practice-launch-error" role="alert">
          {errorMessage}
        </span>
      )}
    </span>
  )
}

function practiceLaunchOrigin(
  scope: PracticeScope,
  returnRoute: string,
): LearningFlowOrigin {
  switch (scope.kind) {
    case 'course':
      return {
        kind: 'course-curriculum',
        packId: scope.packId,
        courseId: scope.courseId,
        returnRoute,
      }
    case 'curriculum-node':
      return {
        kind: 'course-curriculum',
        packId: scope.packId,
        courseId: scope.courseId,
        curriculumNodeId: scope.nodeId,
        returnRoute,
      }
    default:
      return { kind: 'library', returnRoute }
  }
}

function practiceLaunchErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : 'Practice could not be started from this source.'
}

function LearningItemList({
  items,
}: Readonly<{ items: readonly LearningPackLibraryItem[] }>) {
  const vocabulary = useProductVocabulary()

  return (
    <ul
      className="learnt-learning-item-list"
      aria-label={vocabulary.terms.learningItemPlural}
    >
      {items.map((item) => (
        <li className="learnt-learning-item" key={item.itemId}>
          <div>
            <p className="learnt-kicker">
              {vocabulary.terms.learningItemSingular}
            </p>
            <h6 id={itemDomId(item)} tabIndex={-1}>
              {item.title}
            </h6>
          </div>
          <dl className="learnt-detail-grid">
            <div>
              <dt>ID</dt>
              <dd>{item.itemId}</dd>
            </div>
            <div>
              <dt>{vocabulary.terms.mode}</dt>
              <dd>{item.allowedPlayModes.map(playModeLabel).join(', ')}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{learningStatusLabel(item.learningStatus)}</dd>
            </div>
            <div>
              <dt>Evaluation</dt>
              <dd>{item.evaluationKind}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  )
}

function RepositoryIssues({ issues }: Readonly<{ issues: readonly string[] }>) {
  const counts = new Map<string, number>()

  for (const issue of issues) {
    counts.set(issue, (counts.get(issue) ?? 0) + 1)
  }

  return (
    <section
      className="learnt-warning-panel"
      role="status"
      aria-labelledby="repository-issues-title"
    >
      <p className="learnt-kicker">Repository scan warning</p>
      <h2 id="repository-issues-title">
        {issues.length} saved record {issues.length === 1 ? 'issue' : 'issues'}
      </h2>
      <ul>
        {[...counts.entries()].map(([code, count]) => (
          <li key={code}>
            {count} {code}
          </li>
        ))}
      </ul>
      <p>Valid sessions remain visible. No repair action is applied here.</p>
    </section>
  )
}

function sourceImportActionLabel(action: SourceImportAction): string {
  switch (action) {
    case 'choose':
      return 'Choosing'
    case 'sync':
      return 'Syncing'
  }
}

function outcomeTitle(outcome: LearningPackDirectoryInstallOutcome): string {
  if (outcome.status === 'not-pack') {
    return 'No pack found'
  }

  return outcome.title ?? outcome.packId ?? 'Invalid pack'
}

function outcomePackKey(outcome: LearningPackDirectoryInstallOutcome): string {
  if (outcome.status === 'not-pack') {
    return 'not-pack'
  }

  return `${outcome.packId ?? 'unknown'}:${outcome.packVersion ?? 'unknown'}`
}

function SessionHistory({
  sessions,
}: Readonly<{ sessions: readonly SessionLibraryEntry[] }>) {
  const vocabulary = useProductVocabulary()

  return (
    <section className="learnt-library-section" aria-labelledby="history-title">
      <div className="learnt-library-view-header">
        <p className="learnt-kicker">History</p>
        <h1 id="history-title" tabIndex={-1}>
          {vocabulary.library.historyTitle}
        </h1>
        <p>{vocabulary.library.historyDescription}</p>
      </div>
      {sessions.length === 0 ? (
        <p className="learnt-muted">No saved sessions yet.</p>
      ) : (
        <div className="learnt-session-list">
          {sessions.map((session) => (
            <article className="learnt-session-card" key={session.sessionId}>
              <div>
                <h3>{sessionSubjectTitle(session, vocabulary)}</h3>
                <p>
                  {session.currentActivityTitle ??
                    session.currentActivityId ??
                    'No current activity'}
                </p>
              </div>
              <dl className="learnt-detail-grid">
                <div>
                  <dt>Status</dt>
                  <dd>{sessionStatusLabel(session.sessionStatus)}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>
                    {availabilityLabel(session.availability)}
                    <small>{availabilityMessage(session.availability)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Last active</dt>
                  <dd>
                    <time dateTime={session.lastActiveAt}>
                      {formatDateTime(session.lastActiveAt)}
                    </time>
                  </dd>
                </div>
              </dl>
              <div className="learnt-action-row">
                <a
                  className={
                    session.availability === 'ready'
                      ? 'learnt-button learnt-button-secondary'
                      : 'learnt-button learnt-button-warning'
                  }
                  href={formatRoute({
                    kind: 'session',
                    sessionId: session.sessionId,
                  })}
                >
                  {session.availability === 'ready'
                    ? session.sessionStatus === 'active'
                      ? 'Continue'
                      : 'Open'
                    : 'View unavailable details'}
                </a>
                {session.availability === 'ready' ? (
                  <a
                    className="learnt-button learnt-button-secondary"
                    href={formatRoute({
                      kind: 'session-recap',
                      sessionId: session.sessionId,
                    })}
                  >
                    View Recap
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function buildImportedSubjectMaterialGroups(
  library: LearningPackLibrarySnapshot,
): ImportedSubjectMaterialGroup[] {
  const groups = new Map<
    string,
    {
      groupId: string
      title: string
      summary: string
      tags: string[]
      sources: ImportedSubjectMaterialSource[]
    }
  >()

  for (const pack of library.packs) {
    for (const subject of pack.subjects) {
      const group = groups.get(subject.subjectId) ?? {
        groupId: subject.subjectId,
        title: subject.title,
        summary: subject.summary,
        tags: [],
        sources: [],
      }

      group.tags = uniqueStrings([...group.tags, ...subject.tags])
      group.sources.push({ pack, subject })
      groups.set(subject.subjectId, group)
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    sources: group.sources.sort((left, right) =>
      left.pack.title.localeCompare(right.pack.title),
    ),
  }))
}

function buildImportedStudySetSources(
  library: LearningPackLibrarySnapshot,
): ImportedStudySetSource[] {
  const sources: ImportedStudySetSource[] = []

  for (const pack of library.packs) {
    for (const subject of pack.subjects) {
      for (const course of subject.courses) {
        for (const node of course.rootNodes) {
          collectStudySetSources(sources, pack, subject, course, node)
        }
      }
    }
  }

  return sources.sort((left, right) =>
    left.set.title.localeCompare(right.set.title),
  )
}

function collectStudySetSources(
  sources: ImportedStudySetSource[],
  pack: LearningPackLibraryPack,
  subject: LearningPackLibrarySubject,
  course: LearningPackLibraryCourse,
  node: LearningPackLibraryNode,
): void {
  for (const set of node.studySets) {
    sources.push({ pack, subject, course, set })
  }

  for (const child of node.children) {
    collectStudySetSources(sources, pack, subject, course, child)
  }
}

function countStudySets(library: LearningPackLibrarySnapshot): number {
  return buildImportedStudySetSources(library).length
}

function countImportedSubjectContent(
  group: ImportedSubjectMaterialGroup,
): TransferContentCounts {
  return group.sources.reduce(
    (total, source) => mergeContentCounts(total, countSubjectContent(source)),
    emptyTransferContentCounts(),
  )
}

function countSubjectContent(
  source: ImportedSubjectMaterialSource,
): TransferContentCounts {
  return source.subject.courses.reduce(
    (total, course) => mergeContentCounts(total, countCourseContent(course)),
    {
      ...emptyTransferContentCounts(),
      courseCount: source.subject.courses.length,
    },
  )
}

function countCourseContent(
  course: LearningPackLibraryCourse,
): TransferContentCounts {
  return course.rootNodes.reduce(
    (total, node) => mergeContentCounts(total, countNodeContent(node)),
    emptyTransferContentCounts(),
  )
}

function countNodeContent(
  node: LearningPackLibraryNode,
): TransferContentCounts {
  const nestedCounts = node.children.reduce(
    (total, child) => mergeContentCounts(total, countNodeContent(child)),
    emptyTransferContentCounts(),
  )

  return mergeContentCounts(nestedCounts, {
    courseCount: 0,
    sectionCount: 1,
    studySetCount: node.studySets.length,
    itemCount: node.items.length,
    resourceCount: node.resources.length,
  })
}

function mergeContentCounts(
  left: TransferContentCounts,
  right: TransferContentCounts,
): TransferContentCounts {
  return {
    courseCount: left.courseCount + right.courseCount,
    sectionCount: left.sectionCount + right.sectionCount,
    studySetCount: left.studySetCount + right.studySetCount,
    itemCount: left.itemCount + right.itemCount,
    resourceCount: left.resourceCount + right.resourceCount,
  }
}

function emptyTransferContentCounts(): TransferContentCounts {
  return {
    courseCount: 0,
    sectionCount: 0,
    studySetCount: 0,
    itemCount: 0,
    resourceCount: 0,
  }
}

function transferSubjectStatus(
  group: ImportedSubjectMaterialGroup,
): Readonly<{ label: string; state: 'ready' | 'warning' | 'update' }> {
  const states = group.sources.map((source) => source.pack.state)

  if (
    states.some(
      (state) => state === 'invalid-pack' || state === 'unsupported-capability',
    )
  ) {
    return { label: 'Needs attention', state: 'warning' }
  }

  if (states.some((state) => state === 'update-available')) {
    return { label: 'Update', state: 'update' }
  }

  if (states.some((state) => state === 'partially-supported')) {
    return { label: 'Partial', state: 'warning' }
  }

  return { label: 'Ready', state: 'ready' }
}

function transferPackStatus(
  pack: LearningPackLibraryPack,
): Readonly<{ label: string; state: 'ready' | 'warning' | 'update' }> {
  switch (pack.state) {
    case 'ready':
      return { label: 'Ready', state: 'ready' }
    case 'update-available':
      return { label: 'Update available', state: 'update' }
    case 'partially-supported':
      return { label: 'Partially supported', state: 'warning' }
    case 'invalid-pack':
      return { label: 'Invalid pack', state: 'warning' }
    case 'unsupported-capability':
      return { label: 'Unsupported capability', state: 'warning' }
  }
}

function initials(value: string): string {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) {
    return 'CT'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function subjectProgressPercent(
  subject: LibrarySubjectSummary,
  activeSession: SessionLibraryEntry | null,
): number {
  if (activeSession === null || subject.activityCount === 0) {
    return 0
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round((activeSession.evidenceCount / subject.activityCount) * 100),
    ),
  )
}

function subjectCardMeta(
  subject: LibrarySubjectSummary,
  activeSession: SessionLibraryEntry | null,
): string {
  if (activeSession !== null) {
    const checkpointLabel = countLabel(
      activeSession.evidenceCount,
      'checkpoint',
      'checkpoints',
    )

    return `Active / ${checkpointLabel}`
  }

  return `${countLabel(subject.moduleCount, 'module', 'modules')} / ${countLabel(
    subject.activityCount,
    'checkpoint',
    'checkpoints',
  )}`
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count.toString()} ${count === 1 ? singular : plural}`
}

function sessionSubjectTitle(
  session: SessionLibraryEntry,
  vocabulary: ProductVocabularyCopy,
): string {
  return (
    session.subjectTitle ??
    `${vocabulary.library.sessionFallbackPrefix} ${session.subjectId}`
  )
}

function subjectIcon(title: string, tags: readonly string[]): LucideIcon {
  const searchable = `${title} ${tags.join(' ')}`.toLowerCase()

  if (searchable.includes('machine') || searchable.includes('ai')) {
    return BrainCircuit
  }

  if (
    searchable.includes('movement') ||
    searchable.includes('anatomy') ||
    searchable.includes('kinesiology')
  ) {
    return Dumbbell
  }

  if (searchable.includes('logic') || searchable.includes('proof')) {
    return Sigma
  }

  return BookOpen
}

function packKey(pack: LearningPackLibraryPack): string {
  return `${pack.packId}:${pack.packVersion}`
}

function materialSourceKey(source: ImportedSubjectMaterialSource): string {
  return `${packKey(source.pack)}:${source.subject.subjectId}`
}

function studySetSourceKey(source: ImportedStudySetSource): string {
  return `${packKey(source.pack)}:${source.subject.subjectId}:${source.course.courseId}:${source.set.setId}`
}

function materialSourceDomId(source: ImportedSubjectMaterialSource): string {
  return domId(
    'source-pack',
    source.pack.packId,
    source.pack.packVersion,
    source.subject.subjectId,
  )
}

function transferSubjectDetailDomId(
  group: ImportedSubjectMaterialGroup,
): string {
  return domId('transfer-subject-detail', group.groupId)
}

function courseDomId(course: LearningPackLibraryCourse): string {
  return domId('course', course.packId, course.courseId)
}

function nodeDomId(node: LearningPackLibraryNode): string {
  return domId('node', node.packId, node.courseId, node.nodeId)
}

function studySetDomId(
  set: LearningPackLibraryStudySet,
  ownerNodeId: string,
): string {
  return domId('set', set.packId, ownerNodeId, set.setId)
}

function itemDomId(item: LearningPackLibraryItem): string {
  return domId(
    'item',
    item.packId,
    item.courseId,
    item.curriculumNodeId,
    item.itemId,
  )
}

function entryDomId(entry: LearningPackCurriculumEntryView): string {
  switch (entry.kind) {
    case 'child-node':
      return domId(
        'entry-child',
        entry.packId,
        entry.courseId,
        entry.nodeId,
        entry.childNodeId,
      )
    case 'resource':
      return domId(
        'entry-resource',
        entry.packId,
        entry.courseId,
        entry.nodeId,
        entry.resourceId,
        entry.segmentId ?? 'whole',
      )
    case 'item':
      return domId(
        'entry-item',
        entry.packId,
        entry.courseId,
        entry.nodeId,
        entry.itemId,
      )
    case 'study-set':
      return domId(
        'entry-set',
        entry.packId,
        entry.courseId,
        entry.nodeId,
        entry.setId,
      )
  }
}

function domId(prefix: string, ...parts: readonly string[]): string {
  return [prefix, ...parts]
    .join('-')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function PackStateIcon({
  state,
}: Readonly<{ state: LearningPackLibraryPack['state'] }>) {
  switch (state) {
    case 'invalid-pack':
    case 'unsupported-capability':
    case 'partially-supported':
      return <TriangleAlert size={22} strokeWidth={2.2} />
    case 'ready':
    case 'update-available':
      return <PackageOpen size={22} strokeWidth={2.2} />
  }
}

function packStateLabel(state: LearningPackLibraryPack['state']): string {
  switch (state) {
    case 'ready':
      return 'Ready'
    case 'invalid-pack':
      return 'Invalid pack'
    case 'unsupported-capability':
      return 'Unsupported capability'
    case 'update-available':
      return 'Update available'
    case 'partially-supported':
      return 'Partially supported'
  }
}

function playModeLabel(
  mode: LearningPackLibraryItem['allowedPlayModes'][number],
): string {
  switch (mode) {
    case 'flashcard':
      return 'Flashcard'
    case 'single-choice-quiz':
      return 'Single-choice quiz'
    case 'multiple-choice-quiz':
      return 'Multiple-choice quiz'
    case 'text-recall':
      return 'Text recall'
    case 'number-recall':
      return 'Number recall'
    case 'manual-read':
      return 'Manual reading'
    case 'self-grade-review':
      return 'Self-grade review'
  }
}

function learningStatusLabel(status: LearningPackLearningStatus): string {
  switch (status) {
    case 'not-started':
      return 'Not started'
    case 'active':
      return 'Active'
    case 'attempted':
      return 'Attempted'
    case 'completed':
      return 'Completed'
    case 'unavailable':
      return 'Unavailable'
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
