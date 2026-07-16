import { useEffect, type ReactNode } from 'react'
import {
  BookOpen,
  Boxes,
  BrainCircuit,
  ChevronDown,
  CirclePlay,
  History,
  House,
  Moon,
  Sun,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'

import type {
  LearnerSummary,
  ProductVocabularyMode,
  ThemeMode,
} from '../../application'
import { formatRoute, type AppRoute } from '../navigation'
import { routeLabelForVocabulary, useProductVocabulary } from '../vocabulary'

export type AppShellToastKind = 'ok' | 'info' | 'warn' | 'error'

export type AppShellToast = Readonly<{
  id: string
  message: string
  kind: AppShellToastKind
}>

export function AppShell({
  learner,
  route,
  theme,
  vocabularyMode,
  toasts,
  onThemeChange,
  onVocabularyModeChange,
  onDismissToast,
  children,
}: Readonly<{
  learner: LearnerSummary
  route: AppRoute
  theme: ThemeMode
  vocabularyMode: ProductVocabularyMode
  toasts: readonly AppShellToast[]
  onThemeChange: (theme: ThemeMode) => void
  onVocabularyModeChange: (mode: ProductVocabularyMode) => void
  onDismissToast: (id: string) => void
  children: ReactNode
}>) {
  const vocabulary = useProductVocabulary()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const usesPlainNames = vocabularyMode === 'plain'
  const routeLabel = routeLabelForVocabulary(vocabulary, route)
  const routePath = routePathForShell(route)
  const todayActive = route.kind === 'today'
  const libraryActive =
    route.kind === 'library' ||
    route.kind === 'subject' ||
    route.kind === 'resource'
  const practiceActive =
    route.kind === 'practice' ||
    route.kind === 'session' ||
    route.kind === 'session-concept' ||
    route.kind === 'session-recap'
  const transferActive = route.kind === 'transfer'
  const progressActive = route.kind === 'progress'
  const profileActive = route.kind === 'profile' || route.kind === 'settings'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div className="learnt-shell">
      <a className="learnt-skip-link" href="#main-content">
        {vocabulary.skipLinkLabel}
      </a>
      <header className="learnt-product-header">
        <a
          className="learnt-mark"
          href={formatRoute({ kind: 'library' })}
          aria-label={vocabulary.homeAriaLabel}
        >
          <span className="learnt-mark-icon" aria-hidden="true">
            <BrainCircuit size={18} strokeWidth={2.2} />
          </span>
          <span>{vocabulary.appName}</span>
        </a>
        <div className="learnt-route-pill" aria-label="Current route">
          <span aria-hidden="true" />
          {routePath}
        </div>
        <div className="learnt-header-actions">
          <span className="learnt-header-checker" aria-hidden="true" />
          <button
            className="learnt-theme-toggle"
            type="button"
            aria-label={`Switch to ${nextTheme} mode`}
            onClick={() => {
              onThemeChange(nextTheme)
            }}
          >
            {theme === 'dark' ? (
              <Sun aria-hidden="true" size={15} strokeWidth={2.2} />
            ) : (
              <Moon aria-hidden="true" size={15} strokeWidth={2.2} />
            )}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <details className="learnt-profile-menu">
            <summary
              aria-label={`Open profile menu for ${learner.displayName}`}
            >
              <span className="learnt-profile-avatar" aria-hidden="true">
                <UserRound size={16} strokeWidth={2.2} />
              </span>
              <span>{learner.displayName}</span>
              <ChevronDown
                className="learnt-profile-chevron"
                aria-hidden="true"
                size={14}
                strokeWidth={2.3}
              />
            </summary>
            <div className="learnt-profile-panel">
              <p className="learnt-kicker">Profile</p>
              <strong>{learner.displayName}</strong>
              <span>{learner.profileId}</span>
              <a
                className="learnt-profile-panel-link"
                href={formatRoute({ kind: 'profile' })}
              >
                Open profile
              </a>
              <a
                className="learnt-profile-panel-link"
                href={formatRoute({ kind: 'settings' })}
              >
                Open settings
              </a>
              <div className="learnt-profile-settings">
                <p className="learnt-kicker">Settings</p>
                <label className="learnt-setting-toggle">
                  <input
                    type="checkbox"
                    checked={usesPlainNames}
                    onChange={(event) => {
                      onVocabularyModeChange(
                        event.currentTarget.checked ? 'plain' : 'branded',
                      )
                    }}
                  />
                  <span className="learnt-setting-toggle-control" />
                  <span>
                    <strong>{vocabulary.plainNamesLabel}</strong>
                    <small>
                      {usesPlainNames
                        ? vocabulary.brandedNamesLabel
                        : vocabulary.plainNamesDescription}
                    </small>
                  </span>
                </label>
              </div>
            </div>
          </details>
        </div>
      </header>
      <div className="learnt-route-rainbow-bar" aria-hidden="true" />
      <div className="learnt-shell-body">
        <aside className="learnt-primary-sidebar" aria-label="Primary">
          <nav className="learnt-shell-nav" aria-label="Primary routes">
            <ShellNavLink
              icon={House}
              href={formatRoute({ kind: 'today' })}
              label={vocabulary.nav.today}
              active={todayActive}
            />
            <ShellNavLink
              icon={BookOpen}
              href={formatRoute({ kind: 'library' })}
              label={vocabulary.nav.library}
              active={libraryActive}
            />
            <ShellNavLink
              icon={CirclePlay}
              href={formatRoute({ kind: 'practice' })}
              label={vocabulary.nav.practice}
              active={practiceActive}
            />
            <ShellNavLink
              icon={Boxes}
              href={formatRoute({ kind: 'transfer' })}
              label={vocabulary.nav.transfer}
              active={transferActive}
            />
            <ShellNavLink
              icon={History}
              href={formatRoute({ kind: 'progress' })}
              label={vocabulary.nav.progress}
              active={progressActive}
            />
          </nav>

          <div className="learnt-sidebar-footer">
            <ShellNavLink
              icon={UserRound}
              href={formatRoute({ kind: 'profile' })}
              label="Profile"
              active={profileActive}
            />
            <div className="learnt-sidebar-context">
              <p className="learnt-sidebar-section-label">Current route</p>
              <strong>{routeLabel}</strong>
              <span>{routePath}</span>
            </div>
          </div>
        </aside>

        <main id="main-content" className="learnt-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="learnt-bottom-nav" aria-label="Primary mobile">
        <BottomNavLink
          icon={House}
          href={formatRoute({ kind: 'today' })}
          label={vocabulary.nav.today}
          active={todayActive}
        />
        <BottomNavLink
          icon={BookOpen}
          href={formatRoute({ kind: 'library' })}
          label={vocabulary.nav.library}
          active={libraryActive}
        />
        <BottomNavLink
          icon={CirclePlay}
          href={formatRoute({ kind: 'practice' })}
          label={vocabulary.nav.practice}
          active={practiceActive}
        />
        <BottomNavLink
          icon={Boxes}
          href={formatRoute({ kind: 'transfer' })}
          label={vocabulary.nav.transfer}
          active={transferActive}
        />
        <BottomNavLink
          icon={UserRound}
          href={formatRoute({ kind: 'profile' })}
          label="Profile"
          active={profileActive}
        />
      </nav>
      <div className="learnt-toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div
            className="learnt-toast"
            data-kind={toast.kind}
            role="status"
            key={toast.id}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label={`Dismiss notification: ${toast.message}`}
              onClick={() => {
                onDismissToast(toast.id)
              }}
            >
              <X aria-hidden="true" size={14} strokeWidth={2.3} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShellNavLink({
  icon: Icon,
  href,
  label,
  active,
}: Readonly<{
  icon: LucideIcon
  href: string
  label: string
  active: boolean
}>) {
  return (
    <a
      className="learnt-shell-nav-link"
      href={href}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={2.2} />
      <span>{label}</span>
    </a>
  )
}

function BottomNavLink({
  icon: Icon,
  href,
  label,
  active,
}: Readonly<{
  icon: LucideIcon
  href: string
  label: string
  active: boolean
}>) {
  return (
    <a
      className="learnt-bottom-nav-link"
      href={href}
      aria-label={`${label} mobile`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" size={21} strokeWidth={2.2} />
      <span>{label}</span>
    </a>
  )
}

function routePathForShell(route: AppRoute): string {
  switch (route.kind) {
    case 'today':
      return '/today'
    case 'library':
      return '/library'
    case 'practice':
      return '/practice'
    case 'transfer':
      return '/transfer'
    case 'progress':
      return '/progress'
    case 'profile':
      return '/profile'
    case 'settings':
      return '/settings'
    case 'subject':
      return `/learn/subjects/${route.subjectId}`
    case 'session':
      return `/practice/session/${route.sessionId}`
    case 'session-concept':
      return `/practice/session/${route.sessionId}/concepts/${route.conceptId}`
    case 'session-recap':
      return `/practice/session/${route.sessionId}/recap`
    case 'resource':
      return `/resources/${route.resourceId}`
    case 'not-found':
      return '/not-found'
  }
}
