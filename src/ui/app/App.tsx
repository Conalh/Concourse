import { useCallback, useEffect, useRef, useState } from 'react'

import { AppShell, type AppShellToastKind } from '../components'
import { useLearntApplication } from './learnt-application-context'
import { formatRoute, useHashRoute } from '../navigation'
import { ResponseDraftProvider } from '../responses'
import { ProductVocabularyProvider } from '../vocabulary'
import {
  NotFoundScreen,
  FirstRunOnboarding,
  LearningResourceScreen,
  PracticeScreen,
  ProgressScreen,
  ProfileScreen,
  SessionConceptScreen,
  SessionRecapScreen,
  SessionRouteScreen,
  SettingsScreen,
  SubjectLibraryScreen,
  SubjectOverviewScreen,
  TodayScreen,
  type TransferPreviewState,
} from '../screens'

type AppToast = Readonly<{
  id: string
  message: string
  kind: AppShellToastKind
}>

type FirstRunStep = 0 | 1 | 2

export function App() {
  const route = useHashRoute()
  const application = useLearntApplication()
  const learner = application.getLearner()
  const toastTimeoutsRef = useRef<number[]>([])
  const transferPreviewTimeoutRef = useRef<number | null>(null)
  const [themeMode, setThemeMode] = useState(() => application.getThemeMode())
  const [vocabularyMode, setVocabularyMode] = useState(() =>
    application.getProductVocabularyMode(),
  )
  const [toasts, setToasts] = useState<readonly AppToast[]>([])
  const [transferPreview, setTransferPreview] =
    useState<TransferPreviewState>('current')
  const [firstRunStep, setFirstRunStep] = useState<FirstRunStep | null>(() =>
    application.hasCompletedFirstRunSetup() ? null : 0,
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, kind: AppShellToastKind = 'info') => {
      const id = `${String(Date.now())}-${Math.random().toString(16).slice(2)}`
      setToasts((current) => [...current, { id, message, kind }].slice(-3))

      const timeout = window.setTimeout(() => {
        dismissToast(id)
      }, 3400)
      toastTimeoutsRef.current.push(timeout)
    },
    [dismissToast],
  )

  const updateThemeMode = useCallback(
    (mode: typeof themeMode) => {
      setThemeMode(mode)
      application.setThemeMode(mode)
    },
    [application],
  )

  const updateVocabularyMode = useCallback(
    (mode: typeof vocabularyMode) => {
      setVocabularyMode(mode)
      application.setProductVocabularyMode(mode)
      pushToast(
        mode === 'branded'
          ? 'Concourse names on - Route / Loop / Transfer'
          : 'Plain names on - Course / Practice / Library',
        'info',
      )
    },
    [application, pushToast],
  )

  const openTransferPreview = useCallback(
    (mode: TransferPreviewState) => {
      if (transferPreviewTimeoutRef.current !== null) {
        window.clearTimeout(transferPreviewTimeoutRef.current)
        transferPreviewTimeoutRef.current = null
      }

      setTransferPreview(mode)
      window.location.hash = formatRoute({ kind: 'transfer' })

      if (mode === 'empty') {
        pushToast('Showing empty Transfer preview', 'info')
        return
      }

      if (mode === 'loading') {
        pushToast('Showing loading Transfer preview', 'info')
        transferPreviewTimeoutRef.current = window.setTimeout(() => {
          setTransferPreview('current')
          transferPreviewTimeoutRef.current = null
        }, 1600)
        return
      }

      pushToast('Showing current Transfer content', 'info')
    },
    [pushToast],
  )

  const finishFirstRun = useCallback(() => {
    application.completeFirstRunSetup()
    setFirstRunStep(null)
    window.location.hash = formatRoute({ kind: 'today' })
    pushToast('Welcome to Concourse - AI Foundations installed', 'ok')
  }, [application, pushToast])

  useEffect(() => {
    const toastTimeouts = toastTimeoutsRef.current
    const transferPreviewTimeout = transferPreviewTimeoutRef

    return () => {
      for (const timeout of toastTimeouts) {
        window.clearTimeout(timeout)
      }

      if (transferPreviewTimeout.current !== null) {
        window.clearTimeout(transferPreviewTimeout.current)
      }
    }
  }, [])

  return (
    <ResponseDraftProvider>
      <ProductVocabularyProvider mode={vocabularyMode}>
        <AppShell
          learner={learner}
          route={route}
          theme={themeMode}
          vocabularyMode={vocabularyMode}
          toasts={toasts}
          onThemeChange={updateThemeMode}
          onVocabularyModeChange={updateVocabularyMode}
          onDismissToast={dismissToast}
        >
          <div className="learnt-sr-only" aria-live="polite">
            {route.kind === 'not-found' ? 'Route not found' : route.kind}
          </div>
          {route.kind === 'today' ? <TodayScreen /> : null}
          {route.kind === 'library' ? <SubjectLibraryScreen /> : null}
          {route.kind === 'transfer' ? (
            <SubjectLibraryScreen
              initialView="materials"
              previewState={transferPreview}
              standalone
            />
          ) : null}
          {route.kind === 'practice' ? <PracticeScreen /> : null}
          {route.kind === 'progress' ? <ProgressScreen /> : null}
          {route.kind === 'profile' ? (
            <ProfileScreen
              themeMode={themeMode}
              vocabularyMode={vocabularyMode}
              onThemeModeChange={updateThemeMode}
              onVocabularyModeChange={updateVocabularyMode}
            />
          ) : null}
          {route.kind === 'settings' ? (
            <SettingsScreen
              themeMode={themeMode}
              vocabularyMode={vocabularyMode}
              onThemeModeChange={updateThemeMode}
              onVocabularyModeChange={updateVocabularyMode}
              onReplaySetup={() => {
                setFirstRunStep(0)
                pushToast('First-run setup replayed', 'info')
              }}
              onPreviewEmptyTransfer={() => {
                openTransferPreview('empty')
              }}
              onPreviewLoadingTransfer={() => {
                openTransferPreview('loading')
              }}
            />
          ) : null}
          {route.kind === 'subject' ? (
            <SubjectOverviewScreen subjectId={route.subjectId} />
          ) : null}
          {route.kind === 'session' ? (
            <SessionRouteScreen sessionId={route.sessionId} />
          ) : null}
          {route.kind === 'session-concept' ? (
            <SessionConceptScreen
              sessionId={route.sessionId}
              conceptId={route.conceptId}
            />
          ) : null}
          {route.kind === 'session-recap' ? (
            <SessionRecapScreen sessionId={route.sessionId} />
          ) : null}
          {route.kind === 'resource' ? (
            <LearningResourceScreen
              packId={route.packId}
              resourceId={route.resourceId}
              {...(route.segmentId === undefined
                ? {}
                : { segmentId: route.segmentId })}
              {...(route.origin === undefined ? {} : { origin: route.origin })}
            />
          ) : null}
          {route.kind === 'not-found' ? (
            <NotFoundScreen attemptedHash={route.attemptedHash} />
          ) : null}
        </AppShell>
        {firstRunStep === null ? null : (
          <FirstRunOnboarding
            step={firstRunStep}
            onStepChange={setFirstRunStep}
            onFinish={finishFirstRun}
          />
        )}
      </ProductVocabularyProvider>
    </ResponseDraftProvider>
  )
}
