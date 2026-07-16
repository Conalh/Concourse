import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { composeLearntApplication } from '../../app'
import { ConceptIdSchema, SessionIdSchema } from '../../core/contracts'
import type {
  Clock,
  FirstRunSetupStore,
  LearningIdGenerator,
  ProductVocabularyMode,
  ProductVocabularyPreferenceStore,
  ThemeMode,
  ThemePreferenceStore,
} from '../../core/ports'
import {
  LocalStorageLearningRepository,
  type StorageLike,
} from '../../infrastructure'
import { App } from './App'
import { LearntApplicationProvider } from './LearntApplicationProvider'
import type { LearntApplicationClient } from './learnt-application-client'

class FakeStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  key(index: number): string | null {
    return [...this.values.keys()].sort()[index] ?? null
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class SequenceClock implements Clock {
  private index = 0

  now(): Date {
    const value = new Date(
      `2026-06-22T12:${String(this.index).padStart(2, '0')}:00.000Z`,
    )
    this.index += 1
    return value
  }
}

class SequenceIds implements LearningIdGenerator {
  private sessionIndex = 0
  private evidenceIndex = 0

  createSessionId(): string {
    const id = `session-${String(this.sessionIndex)}`
    this.sessionIndex += 1
    return id
  }

  createEvidenceId(): string {
    const id = `evidence-${String(this.evidenceIndex)}`
    this.evidenceIndex += 1
    return id
  }
}

class InMemoryProductVocabularyPreferenceStore implements ProductVocabularyPreferenceStore {
  private mode: ProductVocabularyMode

  constructor(mode: ProductVocabularyMode) {
    this.mode = mode
  }

  getProductVocabularyMode(): ProductVocabularyMode {
    return this.mode
  }

  setProductVocabularyMode(mode: ProductVocabularyMode): void {
    this.mode = mode
  }
}

class InMemoryThemePreferenceStore implements ThemePreferenceStore {
  private mode: ThemeMode

  constructor(mode: ThemeMode) {
    this.mode = mode
  }

  getThemeMode(): ThemeMode {
    return this.mode
  }

  setThemeMode(mode: ThemeMode): void {
    this.mode = mode
  }
}

class InMemoryFirstRunSetupStore implements FirstRunSetupStore {
  private completed: boolean

  constructor(completed: boolean) {
    this.completed = completed
  }

  hasCompletedFirstRunSetup(): boolean {
    return this.completed
  }

  completeFirstRunSetup(): void {
    this.completed = true
  }
}

function createApplication(
  storage: FakeStorage,
  vocabularyMode: ProductVocabularyMode = 'plain',
  themeMode: ThemeMode = 'dark',
  firstRunSetupStore?: FirstRunSetupStore,
): LearntApplicationClient {
  return composeLearntApplication({
    clock: new SequenceClock(),
    idGenerator: new SequenceIds(),
    repository: new LocalStorageLearningRepository(storage),
    themePreferenceStore: new InMemoryThemePreferenceStore(themeMode),
    productVocabularyPreferenceStore:
      new InMemoryProductVocabularyPreferenceStore(vocabularyMode),
    ...(firstRunSetupStore === undefined ? {} : { firstRunSetupStore }),
  })
}

function renderProduct(application: LearntApplicationClient) {
  return render(
    <LearntApplicationProvider application={application}>
      <App />
    </LearntApplicationProvider>,
  )
}

describe('Learnt React product flow', () => {
  beforeEach(() => {
    window.location.hash = '#/'
  })

  it('runs first-run onboarding and persists setup completion', async () => {
    const user = userEvent.setup()
    const firstRunSetupStore = new InMemoryFirstRunSetupStore(false)

    renderProduct(
      createApplication(
        new FakeStorage(),
        'branded',
        'dark',
        firstRunSetupStore,
      ),
    )

    expect(
      await screen.findByRole('heading', { name: 'Welcome to Concourse.' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('dialog')).getByText(
        'One place to learn things properly - and to build and share how you learn them.',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', {
        name: 'What brings you here, and to what?',
      }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Prepare for an exam' }),
    )
    expect(
      screen.getByRole('button', { name: 'Prepare for an exam' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Logic Basics/i }))
    expect(
      screen.getByRole('button', { name: /Logic Basics/i }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('heading', { name: 'Install a starter pack' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Logic Basics/i }))
    expect(
      screen.getByRole('button', { name: /Logic Basics/i }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      await screen.findByRole('heading', {
        name: 'What brings you here, and to what?',
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))

    expect(firstRunSetupStore.hasCompletedFirstRunSetup()).toBe(true)
    expect(window.location.hash).toBe('#/today')
    expect(
      await screen.findByRole('heading', {
        name: 'Good to see you, Demo learner.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Today \//i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10m' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '5m' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.queryByText('Practice scopes')).not.toBeInTheDocument()
    expect(
      screen.getByText('Welcome to Concourse - AI Foundations installed'),
    ).toBeInTheDocument()
  })

  it('defaults to Concourse naming and can switch to plain names', async () => {
    const user = userEvent.setup()
    renderProduct(createApplication(new FakeStorage(), 'branded'))

    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Navigation' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Transfer:/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Route history:/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Concourse home' }),
    ).toHaveAttribute('href', '#/')
    expect(screen.getByRole('link', { name: 'Loop' })).toHaveAttribute(
      'href',
      '#/practice',
    )

    await user.click(
      screen.getByLabelText(/Open profile menu for Demo learner/i),
    )
    await user.click(screen.getByRole('checkbox', { name: /Plain names/i }))

    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Concourse home' }),
    ).toHaveAttribute('href', '#/')
    expect(screen.getByRole('link', { name: 'Flashcards' })).toHaveAttribute(
      'href',
      '#/practice',
    )
  })

  it('opens Transfer as a top-level imported content route', async () => {
    window.location.hash = '#/transfer'
    renderProduct(createApplication(new FakeStorage(), 'branded'))

    expect(
      await screen.findByRole('heading', { name: 'Your content' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Nothing here yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Choose pack directory' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sync selected directory' }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('heading', { name: 'Navigation' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Transfer' })).toHaveAttribute(
      'href',
      '#/transfer',
    )
  })

  it('opens Loop as a fast-start practice cockpit', async () => {
    window.location.hash = '#/practice'
    renderProduct(createApplication(new FakeStorage(), 'branded'))

    expect(
      await screen.findByRole('heading', { name: 'Retrieve & reinforce' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Quick Practice/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Due Review/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Weakest Concepts/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Choose a mode' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Recommended Loop sets' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Fine-control the next run' }),
    ).toBeInTheDocument()
  })

  it('opens Settings and synchronizes naming and theme controls', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/settings'
    renderProduct(createApplication(new FakeStorage(), 'branded', 'dark'))

    expect(
      await screen.findByRole('heading', { name: 'Make it yours' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'System state' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Installed packs and learning progress stay on this device.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /toggle offline mode/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Concourse names' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Route', { selector: 'dd' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Plain names' }))

    expect(screen.getByRole('button', { name: 'Plain names' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Course', { selector: 'dd' })).toBeInTheDocument()

    const appearanceSection = screen
      .getByRole('heading', { name: 'Appearance' })
      .closest('section')

    if (appearanceSection === null) {
      throw new Error('Expected Settings appearance section.')
    }

    await user.click(
      within(appearanceSection).getByRole('button', {
        name: 'Switch to light mode',
      }),
    )

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light')
    })
    expect(
      within(appearanceSection).getByRole('button', {
        name: 'Switch to dark mode',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Learning preferences' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Evidence-first progress')).toBeInTheDocument()
    expect(screen.getByText('Loop recommendations')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Replay first-run setup/i }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Welcome to Concourse.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('First-run setup replayed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip setup' }))

    expect(window.location.hash).toBe('#/today')
    window.location.hash = '#/settings'
    await screen.findByRole('heading', { name: 'Make it yours' })

    await user.click(
      screen.getByRole('button', { name: /Preview empty Transfer/i }),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Nothing here yet',
      }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/transfer')
    expect(
      screen.queryByRole('link', { name: 'Progress mobile' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Profile mobile' }),
    ).toHaveAttribute('href', '#/profile')

    window.location.hash = '#/settings'
    await screen.findByRole('heading', { name: 'Make it yours' })
    await user.click(
      screen.getByRole('button', { name: /Preview loading Transfer/i }),
    )
    expect(
      await screen.findByText('Loading course materials'),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/transfer')
    expect(
      screen.getByText('Showing loading Transfer preview'),
    ).toBeInTheDocument()
    await waitFor(
      () => {
        expect(
          screen.queryByText('Loading course materials'),
        ).not.toBeInTheDocument()
      },
      { timeout: 2500 },
    )
  })

  it('opens Profile as a learner overview with routes and presentation controls', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/profile'
    renderProduct(createApplication(new FakeStorage(), 'branded', 'dark'))

    expect(
      await screen.findByRole('heading', { name: 'Demo learner' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Evidence summary' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Evidence events')).toBeInTheDocument()
    expect(screen.getByText('Loop items assessed')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Active Routes' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Presentation preferences' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Account controls' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '#/settings',
    )

    const namingSwitch = screen.getByRole('switch', {
      name: 'Concourse names',
    })
    const themeSwitch = screen.getByRole('switch', { name: 'Dark appearance' })

    expect(namingSwitch).toHaveAttribute('aria-checked', 'true')
    expect(themeSwitch).toHaveAttribute('aria-checked', 'true')

    await user.click(namingSwitch)

    expect(namingSwitch).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.getByText(/Courses, Flashcards, and Library labels/i),
    ).toBeInTheDocument()

    await user.click(themeSwitch)

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light')
    })
    expect(themeSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('starts, submits, retries, advances, changes mode, and restores from persisted state after refresh', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()
    const application = createApplication(storage)
    const rendered = renderProduct(application)

    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Logic Basics' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Movement Planes' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Machine Learning Foundations' }),
    ).toBeInTheDocument()

    const logicCard = screen
      .getByRole('heading', { name: 'Logic Basics' })
      .closest('article')

    if (logicCard === null) {
      throw new Error('Expected a Logic Basics subject card.')
    }

    await user.click(
      within(logicCard).getByRole('link', { name: 'View course' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Logic Basics' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Your courses' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Module sequence' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Teaching resources' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Provenance')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Map' }))
    expect(
      screen.getByRole('button', { name: 'Practice this' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Begin new session' }))
    expect(
      await screen.findByRole('heading', { name: 'Orient to Boolean values' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exit session' })).toHaveAttribute(
      'href',
      '#/subjects/logic-basics',
    )
    expect(
      screen.getByRole('progressbar', {
        name: '0 of 8 activities completed',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Park' })).toHaveAttribute(
      'href',
      '#concept-context',
    )
    expect(screen.getByRole('link', { name: 'Session Recap' })).toHaveAttribute(
      'href',
      '#/sessions/session-0/recap',
    )

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      await screen.findByRole('heading', { name: 'Passed' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Continue to Predict NOT true/i }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Predict NOT true' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'true' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Retry' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Reviewed answer')).toBeInTheDocument()
    expect(screen.getAllByText('Learn the why').length).toBeGreaterThan(0)
    expect(screen.queryByText('Evaluation')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'true' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'false' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Passed' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'false' })).toBeChecked()

    await user.click(
      screen.getByRole('button', {
        name: /Continue to Recall Boolean values/i,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Recall Boolean values' }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Learning mode'), 'flow')
    await waitFor(() => {
      expect(screen.getByLabelText('Learning mode')).toHaveValue('flow')
    })
    expect(screen.getByText(/Fewer interruptions/i)).toBeInTheDocument()

    const sessionId = SessionIdSchema.parse(
      window.location.hash.split('/').at(-1),
    )
    rendered.unmount()

    const restoredApplication = createApplication(storage)
    renderProduct(restoredApplication)

    expect(
      await screen.findByRole('heading', { name: 'Recall Boolean values' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Learning mode')).toHaveValue('flow')
    expect(screen.getByText(/Evidence/i)).toBeInTheDocument()

    const restoredContext =
      await restoredApplication.getSessionContext(sessionId)
    expect(restoredContext.record.session.id).toBe(sessionId)
    expect(restoredContext.record.session.interactionMode).toBe('flow')
    expect(restoredContext.currentActivity?.title).toBe('Recall Boolean values')
    expect(restoredContext.record.evidenceEvents).toHaveLength(3)
  })

  it('renders Progress as an evidence-first dashboard with weak areas and route status', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()

    renderProduct(createApplication(storage))

    await openLogicBasics(user)
    await completeManual(user)
    await continueTo(user, /Predict NOT true/i)

    await user.click(screen.getByRole('radio', { name: 'true' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Retry' }),
    ).toBeInTheDocument()

    window.location.hash = '#/progress'
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    expect(
      await screen.findByRole('heading', { name: 'Evidence, not scores' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Progress overview')).toBeInTheDocument()
    expect(screen.getByText('Evidence events')).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: 'Assessment coverage' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Concepts in Logic Basics/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Recommended next' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Weak areas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Recent sessions' }),
    ).toBeInTheDocument()

    const routeStatus = screen
      .getByRole('heading', { name: 'Route status' })
      .closest('section')
    const weakAreas = screen
      .getByRole('heading', { name: 'Weak areas' })
      .closest('section')

    if (routeStatus === null || weakAreas === null) {
      throw new Error('Expected Progress route status and weak-area panels.')
    }

    expect(within(routeStatus).getByText('Logic Basics')).toBeInTheDocument()
    expect(within(routeStatus).getByText('In progress')).toBeInTheDocument()
    expect(
      within(weakAreas).queryByText(/No weak areas yet/i),
    ).not.toBeInTheDocument()
    expect(within(weakAreas).getByText('Predict NOT true')).toBeInTheDocument()
  })

  it('requires an explicit branch selection for multi-edge advancement', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()
    renderProduct(createApplication(storage))

    await openLogicBasics(user)
    await completeManual(user)
    await continueTo(user, /Predict NOT true/i)
    await submitSingleChoice(user, 'false')
    await continueTo(user, /Recall Boolean values/i)
    await submitMultipleChoice(user, ['true', 'false'])
    await continueTo(user, /Orient to compound conditions/i)
    await completeManual(user)
    await continueTo(user, /Predict true AND false/i)
    await submitSingleChoice(user, 'false')
    await continueTo(user, /Predict true OR false/i)
    await submitSingleChoice(user, 'true')

    const debugBranch = screen.getByRole('radio', {
      name: /Debug an access rule/i,
    })
    const transferBranch = screen.getByRole('radio', {
      name: /Transfer to a release gate/i,
    })
    const continueBranch = screen.getByRole('button', {
      name: 'Continue selected branch',
    })

    expect(debugBranch).not.toBeChecked()
    expect(transferBranch).not.toBeChecked()
    expect(continueBranch).toBeDisabled()

    await user.click(transferBranch)
    await user.click(continueBranch)

    expect(
      await screen.findByRole('heading', {
        name: 'Transfer to a release gate',
      }),
    ).toBeInTheDocument()
  })

  it('opens a persisted retrieval-first session recap without exposing prior attempts until requested', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()
    const rendered = renderProduct(createApplication(storage))

    await openLogicBasics(user)
    const sessionId = SessionIdSchema.parse(
      window.location.hash.split('/').at(-1),
    )
    await completeManual(user)
    await continueTo(user, /Predict NOT true/i)

    await user.click(screen.getByRole('radio', { name: 'true' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Retry' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'false' }))
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Passed' }),
    ).toBeInTheDocument()
    await continueTo(user, /Recall Boolean values/i)
    await submitMultipleChoice(user, ['true', 'false'])

    await user.click(screen.getByRole('link', { name: 'Session Recap' }))
    expect(
      await screen.findByRole('heading', { name: 'Activity trail' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(
        'Try to reconstruct your reasoning before opening the attempt history.',
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Continue Session' }),
    ).toHaveAttribute('href', '#/sessions/session-0')

    const predictCard = screen
      .getByRole('heading', { name: 'Predict NOT true' })
      .closest('article')

    if (predictCard === null) {
      throw new Error('Expected Predict NOT true recap card.')
    }

    const attemptDetails = within(predictCard)
      .getByText('Show previous attempts')
      .closest('details')

    expect(attemptDetails).not.toHaveAttribute('open')
    await user.click(within(predictCard).getByText('Show previous attempts'))
    expect(attemptDetails).toHaveAttribute('open')
    expect(
      within(predictCard).getByRole('heading', { name: 'Attempt 1' }),
    ).toBeInTheDocument()
    expect(
      within(predictCard).getByRole('heading', { name: 'Attempt 2' }),
    ).toBeInTheDocument()
    expect(within(predictCard).getAllByText('true').length).toBeGreaterThan(0)
    expect(within(predictCard).getAllByText('false').length).toBeGreaterThan(0)
    expect(
      within(predictCard).queryByText('option-true'),
    ).not.toBeInTheDocument()
    expect(
      within(predictCard).queryByText('correctOptionIds'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Continue Session' }))
    expect(
      await screen.findByRole('heading', { name: 'Recall Boolean values' }),
    ).toBeInTheDocument()

    window.location.hash = `#/sessions/${sessionId}/recap`
    rendered.unmount()

    const restoredApplication = createApplication(storage)
    renderProduct(restoredApplication)
    expect(
      await screen.findByRole('heading', { name: 'Activity trail' }),
    ).toBeInTheDocument()

    const recap = await restoredApplication.getSessionRecap(sessionId)
    expect(recap.evidenceCount).toBe(4)
    expect(recap.currentThread?.activityTitle).toBe('Recall Boolean values')
  })

  it('preserves the current thread while exploring and parking concepts', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()
    const application = createApplication(storage)
    const rendered = renderProduct(application)

    await openLogicBasics(user)
    const sessionId = SessionIdSchema.parse(
      window.location.hash.split('/').at(-1),
    )
    await completeManual(user)
    await continueTo(user, /Predict NOT true/i)

    await user.click(screen.getByRole('radio', { name: 'true' }))
    expect(screen.getByRole('radio', { name: 'true' })).toBeChecked()

    let booleanValuesLink = screen.queryByRole('link', {
      name: 'Boolean values',
    })

    if (booleanValuesLink === null) {
      await user.click(screen.getByText('Concept context'))
      booleanValuesLink = await screen.findByRole('link', {
        name: 'Boolean values',
      })
    }

    await user.click(booleanValuesLink)
    expect(
      await screen.findByRole('heading', { name: 'Boolean values' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Predict NOT true' }),
    ).toBeInTheDocument()

    const conjunctionLink = screen.getAllByRole('link', {
      name: 'Logical conjunction',
    })[0]

    if (conjunctionLink === undefined) {
      throw new Error('Expected related Logical conjunction link.')
    }

    await user.click(conjunctionLink)
    expect(
      await screen.findByRole('heading', { name: 'Logical conjunction' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Park .* for later/i }))
    expect(
      await screen.findByRole('button', {
        name: /Remove Logical conjunction from parked paths/i,
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Return to Activity' }))
    expect(
      await screen.findByRole('heading', { name: 'Predict NOT true' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'true' })).toBeChecked()

    const context = await application.getSessionContext(sessionId)
    expect(context.currentActivity?.id).toBe('predict-negation')
    expect(context.currentActivityProgress?.status).toBe('active')
    expect(context.record.evidenceEvents).toHaveLength(1)
    expect(context.record.session.interactionMode).toBe('coach')
    expect(context.parkedPaths.map((concept) => concept.conceptId)).toEqual([
      'logical-conjunction',
    ])

    const conceptRoute = `#/sessions/${sessionId}/concepts/logical-conjunction`
    window.location.hash = conceptRoute
    rendered.unmount()

    const restoredApplication = createApplication(storage)
    renderProduct(restoredApplication)
    expect(
      await screen.findByRole('heading', { name: 'Logical conjunction' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/This concept is parked/i)).toBeInTheDocument()

    const beforeRead = await restoredApplication.getSessionContext(sessionId)
    await restoredApplication.getSessionConceptExploration(
      sessionId,
      ConceptIdSchema.parse('logical-conjunction'),
    )
    const afterRead = await restoredApplication.getSessionContext(sessionId)
    expect(afterRead.record.revision).toBe(beforeRead.record.revision)
    expect(afterRead.record.session.lastActiveAt).toBe(
      beforeRead.record.session.lastActiveAt,
    )
    expect(afterRead.record.evidenceEvents).toHaveLength(1)
  })

  it('renders Machine Learning Foundations through generic overview, activity, retry, and recap flows', async () => {
    const user = userEvent.setup()
    const storage = new FakeStorage()
    renderProduct(createApplication(storage))

    expect(
      await screen.findByRole('heading', { name: 'Your courses' }),
    ).toBeInTheDocument()

    const subjectCard = screen
      .getByRole('heading', { name: 'Machine Learning Foundations' })
      .closest('article')

    if (subjectCard === null) {
      throw new Error('Expected a Machine Learning Foundations subject card.')
    }

    expect(within(subjectCard).getByText(/optimization/i)).toBeInTheDocument()
    expect(
      within(subjectCard).getByRole('progressbar', {
        name: /Machine Learning Foundations progress: 0%/i,
      }),
    ).toBeInTheDocument()
    await user.click(
      within(subjectCard).getByRole('link', { name: 'View course' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Machine Learning Foundations',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Module sequence' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Teaching resources' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Provenance')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'The Learning System' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Begin new session' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Orient to the learning loop',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This activity records manual completion.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      await screen.findByRole('heading', { name: 'Passed' }),
    ).toBeInTheDocument()
    await continueTo(user, /Predict serving behavior/i)
    expect(
      await screen.findByRole('heading', {
        name: 'Predict serving behavior',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('option-inference-no-update')).toBeNull()

    await user.click(
      screen.getByRole('radio', {
        name: /Update the weights from this one request/i,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Retry' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('radio', {
        name: /Use current parameters to predict without an optimizer update/i,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Submit response' }))
    expect(
      await screen.findByRole('heading', { name: 'Passed' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Session Recap' }))
    expect(
      await screen.findByRole('heading', { name: 'Activity trail' }),
    ).toBeInTheDocument()

    const predictionCard = screen
      .getAllByRole('heading', { name: 'Predict serving behavior' })
      .map((heading) => heading.closest('article'))
      .find((article): article is HTMLElement => article !== null)

    if (predictionCard === undefined) {
      throw new Error('Expected Predict serving behavior recap card.')
    }

    await user.click(within(predictionCard).getByText('Show previous attempts'))
    expect(
      within(predictionCard).getByRole('heading', { name: 'Attempt 1' }),
    ).toBeInTheDocument()
    expect(
      within(predictionCard).getByRole('heading', { name: 'Attempt 2' }),
    ).toBeInTheDocument()
  })
})

async function openLogicBasics(user: ReturnType<typeof userEvent.setup>) {
  expect(
    await screen.findByRole('heading', { name: 'Your courses' }),
  ).toBeInTheDocument()
  const logicCard = screen
    .getByRole('heading', { name: 'Logic Basics' })
    .closest('article')

  if (logicCard === null) {
    throw new Error('Expected a Logic Basics subject card.')
  }

  await user.click(within(logicCard).getByRole('link', { name: 'View course' }))
  await user.click(
    await screen.findByRole('button', { name: 'Begin new session' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Orient to Boolean values' }),
  ).toBeInTheDocument()
}

async function completeManual(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(
    await screen.findByRole('heading', { name: 'Passed' }),
  ).toBeInTheDocument()
}

async function continueTo(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(screen.getByRole('button', { name }))
}

async function submitSingleChoice(
  user: ReturnType<typeof userEvent.setup>,
  optionLabel: string,
) {
  await user.click(screen.getByRole('radio', { name: optionLabel }))
  await user.click(screen.getByRole('button', { name: 'Submit response' }))
  expect(
    await screen.findByRole('heading', { name: 'Passed' }),
  ).toBeInTheDocument()
}

async function submitMultipleChoice(
  user: ReturnType<typeof userEvent.setup>,
  optionLabels: readonly string[],
) {
  for (const optionLabel of optionLabels) {
    await user.click(screen.getByRole('checkbox', { name: optionLabel }))
  }

  await user.click(screen.getByRole('button', { name: 'Submit response' }))
  expect(
    await screen.findByRole('heading', { name: 'Passed' }),
  ).toBeInTheDocument()
}
