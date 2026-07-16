import { useState } from 'react'
import {
  Boxes,
  ChevronRight,
  Database,
  LoaderCircle,
  Moon,
  RefreshCcw,
  Route,
  Sun,
  type LucideIcon,
} from 'lucide-react'

import type { ProductVocabularyMode, ThemeMode } from '../../application'
import { useRouteFocus } from '../hooks'
import { useProductVocabulary } from '../vocabulary'

type SettingsScreenProps = Readonly<{
  themeMode: ThemeMode
  vocabularyMode: ProductVocabularyMode
  onThemeModeChange: (mode: ThemeMode) => void
  onVocabularyModeChange: (mode: ProductVocabularyMode) => void
  onReplaySetup: () => void
  onPreviewEmptyTransfer: () => void
  onPreviewLoadingTransfer: () => void
}>

type SettingsActionButtonProps = Readonly<{
  icon: LucideIcon
  title: string
  description: string
  tone: 'blue' | 'green' | 'yellow' | 'pink'
  onClick: () => void
}>

type SettingsStatusCard = Readonly<{
  id: string
  label: string
  value: string
  detail: string
  state: 'ready' | 'warning' | 'neutral'
  icon: LucideIcon
}>

export function SettingsScreen({
  themeMode,
  vocabularyMode,
  onThemeModeChange,
  onVocabularyModeChange,
  onReplaySetup,
  onPreviewEmptyTransfer,
  onPreviewLoadingTransfer,
}: SettingsScreenProps) {
  const vocabulary = useProductVocabulary()
  const headingRef = useRouteFocus<HTMLHeadingElement>('settings')
  const [notice, setNotice] = useState(
    'Presentation preferences are saved on this device.',
  )
  const nextTheme = themeMode === 'dark' ? 'light' : 'dark'
  const nextThemeName = nextTheme === 'dark' ? 'Dark' : 'Light'
  const ThemeIcon = nextTheme === 'dark' ? Moon : Sun
  const statusCards = buildSettingsStatusCards({ themeMode, vocabularyMode })

  return (
    <section className="learnt-screen learnt-settings-route">
      <header className="learnt-settings-header">
        <p className="learnt-kicker">Settings</p>
        <h1 id="settings-title" ref={headingRef} tabIndex={-1}>
          Make it yours
        </h1>
        <p>
          Local preferences, route language, and development-state controls for
          this Concourse workspace.
        </p>
      </header>

      <section
        className="learnt-settings-section"
        aria-labelledby="settings-system-state"
      >
        <h2 id="settings-system-state">System state</h2>
        <div className="learnt-settings-status-grid">
          {statusCards.map((card) => {
            const CardIcon = card.icon

            return (
              <article
                className="learnt-settings-status-card"
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

      <section
        className="learnt-settings-section"
        aria-labelledby="settings-naming"
      >
        <h2 id="settings-naming">Naming</h2>
        <p>
          Concourse names give the suite its own language. Prefer the plain
          words? Switch any time - it is only labels, nothing else changes.
        </p>

        <div className="learnt-settings-panel">
          <div className="learnt-settings-segmented" aria-label="Naming mode">
            <button
              type="button"
              aria-pressed={vocabularyMode === 'branded'}
              onClick={() => {
                onVocabularyModeChange('branded')
                setNotice('Concourse naming is active.')
              }}
            >
              Concourse names
            </button>
            <button
              type="button"
              aria-pressed={vocabularyMode === 'plain'}
              onClick={() => {
                onVocabularyModeChange('plain')
                setNotice('Plain naming is active.')
              }}
            >
              Plain names
            </button>
          </div>

          <dl className="learnt-settings-term-list">
            <div>
              <dt>Course creation &amp; learning</dt>
              <dd>{vocabulary.terms.subjectSingular}</dd>
            </div>
            <div>
              <dt>Flashcards &amp; retrieval practice</dt>
              <dd>{vocabulary.nav.practice}</dd>
            </div>
            <div>
              <dt>Course &amp; pack exchange</dt>
              <dd>{vocabulary.nav.transfer}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        className="learnt-settings-section"
        aria-labelledby="settings-appearance"
      >
        <h2 id="settings-appearance">Appearance</h2>
        <div className="learnt-settings-row-panel">
          <div className="learnt-settings-static-row">
            <span>
              <strong>Theme</strong>
              <small>Dark or light - saved to this device.</small>
            </span>
            <button
              className="learnt-settings-theme-button"
              type="button"
              aria-label={`Switch to ${nextTheme} mode`}
              onClick={() => {
                onThemeModeChange(nextTheme)
                setNotice(`${nextThemeName} theme is active.`)
              }}
            >
              <ThemeIcon aria-hidden="true" size={14} strokeWidth={2.2} />
              {nextThemeName}
            </button>
          </div>
        </div>
      </section>

      <section
        className="learnt-settings-section"
        aria-labelledby="settings-learning-preferences"
      >
        <h2 id="settings-learning-preferences">Learning preferences</h2>
        <div className="learnt-settings-row-panel">
          <div className="learnt-settings-static-row">
            <span>
              <strong>Evidence-first progress</strong>
              <small>
                Progress screens lead with observed work and recent route state.
              </small>
            </span>
            <span className="learnt-settings-pill">On</span>
          </div>
          <div className="learnt-settings-static-row">
            <span>
              <strong>Compact, example-first explanations</strong>
              <small>
                Default profile preference for route sessions and support copy.
              </small>
            </span>
            <span className="learnt-settings-pill">Default</span>
          </div>
          <div className="learnt-settings-static-row">
            <span>
              <strong>Loop recommendations</strong>
              <small>
                Weak concepts and recent misses can steer the next practice run.
              </small>
            </span>
            <span className="learnt-settings-pill">Adaptive</span>
          </div>
        </div>
      </section>

      <section
        className="learnt-settings-section"
        aria-labelledby="settings-data"
      >
        <h2 id="settings-data">Account &amp; data</h2>
        <div className="learnt-settings-row-panel">
          <SettingsActionButton
            icon={RefreshCcw}
            title="Replay first-run setup"
            description="Re-run the welcome flow"
            tone="blue"
            onClick={() => {
              onReplaySetup()
              setNotice('First-run setup opened.')
            }}
          />
          <SettingsActionButton
            icon={Boxes}
            title="Preview empty Transfer"
            description="See the no-content state"
            tone="pink"
            onClick={() => {
              onPreviewEmptyTransfer()
              setNotice('Empty Transfer preview opened.')
            }}
          />
          <SettingsActionButton
            icon={LoaderCircle}
            title="Preview loading Transfer"
            description="See the skeleton state"
            tone="green"
            onClick={() => {
              onPreviewLoadingTransfer()
              setNotice('Loading Transfer preview opened.')
            }}
          />
        </div>
        <p className="learnt-settings-status" role="status">
          {notice}
        </p>
      </section>

      <p className="learnt-settings-footer">
        Concourse is open source. Routes and packs are portable files - yours
        stay yours, and anything you build can be shared through{' '}
        <strong>{vocabulary.nav.transfer}</strong>.
      </p>
    </section>
  )
}

function buildSettingsStatusCards({
  themeMode,
  vocabularyMode,
}: Readonly<{
  themeMode: ThemeMode
  vocabularyMode: ProductVocabularyMode
}>): readonly SettingsStatusCard[] {
  return [
    {
      id: 'storage',
      label: 'Storage',
      value: 'Local',
      detail: 'Preferences and evidence stay on this device.',
      state: 'ready',
      icon: Database,
    },
    {
      id: 'packs',
      label: 'Pack storage',
      value: 'Local',
      detail: 'Installed packs and learning progress stay on this device.',
      state: 'ready',
      icon: Boxes,
    },
    {
      id: 'naming',
      label: 'Naming',
      value: vocabularyMode === 'branded' ? 'Concourse' : 'Plain',
      detail: 'Only product labels change; data stays the same.',
      state: 'neutral',
      icon: Route,
    },
    {
      id: 'theme',
      label: 'Theme',
      value: themeMode === 'dark' ? 'Dark' : 'Light',
      detail: 'Saved as a device preference.',
      state: 'neutral',
      icon: themeMode === 'dark' ? Moon : Sun,
    },
  ]
}

function SettingsActionButton({
  icon: Icon,
  title,
  description,
  tone,
  onClick,
}: SettingsActionButtonProps) {
  return (
    <button
      className="learnt-settings-action"
      type="button"
      data-tone={tone}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={17} strokeWidth={2.1} />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight aria-hidden="true" size={15} strokeWidth={2.4} />
    </button>
  )
}
