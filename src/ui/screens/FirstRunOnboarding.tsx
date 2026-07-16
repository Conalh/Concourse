import { useState } from 'react'
import { ArrowRight, BrainCircuit } from 'lucide-react'

type FirstRunStep = 0 | 1 | 2

type FirstRunOnboardingProps = Readonly<{
  step: FirstRunStep
  onStepChange: (step: FirstRunStep) => void
  onFinish: () => void
}>

type IntentId = 'beginning' | 'class' | 'exam' | 'maintain' | 'create'

type SubjectId = 'ai' | 'logic' | 'movement' | 'music' | 'stats' | 'ling'

type StarterPackId = 'ai' | 'logic'

const stepLabels = ['Welcome', 'Tailor it', 'Start a Route'] as const

const intentOptions: readonly Readonly<{ id: IntentId; label: string }>[] = [
  { id: 'beginning', label: 'Learn a subject from scratch' },
  { id: 'class', label: "Support a class I'm taking" },
  { id: 'exam', label: 'Prepare for an exam' },
  { id: 'maintain', label: 'Keep knowledge sharp' },
  { id: 'create', label: 'Build & share my own Routes' },
]

const subjectOptions: readonly Readonly<{
  id: SubjectId
  label: string
  glyph: string
  color: string
}>[] = [
  {
    id: 'ai',
    label: 'AI Foundations',
    glyph: 'AI',
    color: 'var(--learnt-line-a)',
  },
  {
    id: 'logic',
    label: 'Logic Basics',
    glyph: 'LG',
    color: 'var(--learnt-line-c)',
  },
  {
    id: 'movement',
    label: 'Movement Planes',
    glyph: 'MV',
    color: 'var(--learnt-line-e)',
  },
  {
    id: 'music',
    label: 'Music Theory',
    glyph: 'MU',
    color: 'var(--learnt-line-k)',
  },
  {
    id: 'stats',
    label: 'Statistics',
    glyph: 'ST',
    color: 'var(--learnt-line-d)',
  },
  {
    id: 'ling',
    label: 'Linguistics',
    glyph: 'LI',
    color: 'var(--learnt-line-b)',
  },
]

const starterPacks: readonly Readonly<{
  id: StarterPackId
  title: string
  glyph: string
  color: string
  meta: string
}>[] = [
  {
    id: 'ai',
    title: 'AI Foundations',
    glyph: 'AI',
    color: 'var(--learnt-line-a)',
    meta: '14 concepts / 5 study sets',
  },
  {
    id: 'logic',
    title: 'Logic Basics',
    glyph: 'LG',
    color: 'var(--learnt-line-c)',
    meta: '9 concepts / 3 study sets',
  },
]

export function FirstRunOnboarding({
  step,
  onStepChange,
  onFinish,
}: FirstRunOnboardingProps) {
  const [intent, setIntent] = useState<IntentId>('beginning')
  const [subjects, setSubjects] = useState<
    Readonly<Record<SubjectId, boolean>>
  >({
    ai: true,
    logic: false,
    movement: false,
    music: false,
    stats: false,
    ling: false,
  })
  const [pack, setPack] = useState<StarterPackId>('ai')
  const progressScale = (step + 1) / stepLabels.length
  const primaryLabel = step === 2 ? 'Finish setup' : 'Continue'

  function continueSetup() {
    if (step === 2) {
      onFinish()
      return
    }

    onStepChange((step + 1) as FirstRunStep)
  }

  function back() {
    onStepChange(Math.max(0, step - 1) as FirstRunStep)
  }

  function toggleSubject(subjectId: SubjectId) {
    setSubjects((current) => ({
      ...current,
      [subjectId]: !current[subjectId],
    }))
  }

  return (
    <div className="learnt-first-run" role="dialog" aria-modal="true">
      <div className="learnt-first-run-rainbow" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <header className="learnt-first-run-header">
        <BrainCircuit aria-hidden="true" size={23} strokeWidth={2.1} />
        <span>Concourse</span>
        <button type="button" onClick={onFinish}>
          Skip setup
        </button>
      </header>

      <div className="learnt-first-run-progress" aria-label="Setup progress">
        <span>{stepLabels[step]}</span>
        <div>
          <span style={{ transform: `scaleX(${String(progressScale)})` }} />
        </div>
      </div>

      <main className="learnt-first-run-main">
        <section className="learnt-first-run-card">
          {step === 0 ? (
            <div className="learnt-first-run-welcome">
              <span className="learnt-first-run-icon" aria-hidden="true">
                <BrainCircuit size={24} strokeWidth={2.1} />
              </span>
              <h1>Welcome to Concourse.</h1>
              <p>
                One place to learn things properly - and to build and share how
                you learn them.
              </p>
              <div className="learnt-first-run-thesis">
                <span>
                  Build a <strong>Route</strong>.
                </span>
                <span aria-hidden="true">/</span>
                <span>
                  Practice it in <strong>Loop</strong>.
                </span>
                <span aria-hidden="true">/</span>
                <span>
                  Share it through <strong>Concourse</strong>.
                </span>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="learnt-first-run-tailor">
              <p className="learnt-kicker">Tailor it</p>
              <h1>What brings you here, and to what?</h1>
              <div className="learnt-first-run-option-list">
                {intentOptions.map((option) => (
                  <button
                    className="learnt-first-run-option"
                    type="button"
                    aria-pressed={intent === option.id}
                    key={option.id}
                    onClick={() => {
                      setIntent(option.id)
                    }}
                  >
                    <span
                      className="learnt-first-run-radio"
                      aria-hidden="true"
                    />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <p className="learnt-first-run-subtitle">Interests / pick any</p>
              <div className="learnt-first-run-subject-grid">
                {subjectOptions.map((option) => (
                  <button
                    className="learnt-first-run-subject"
                    type="button"
                    aria-pressed={subjects[option.id]}
                    key={option.id}
                    onClick={() => {
                      toggleSubject(option.id)
                    }}
                  >
                    <span
                      className="learnt-first-run-glyph"
                      style={{ background: option.color }}
                      aria-hidden="true"
                    >
                      {option.glyph}
                    </span>
                    <span>{option.label}</span>
                    <span
                      className="learnt-first-run-check"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="learnt-first-run-pack-step">
              <p className="learnt-kicker">Start a Route</p>
              <h1>Install a starter pack</h1>
              <p>
                Brings in the subject, its concepts, and ready Loop sets.
                Everything is a portable file you can share later.
              </p>
              <div className="learnt-first-run-pack-list">
                {starterPacks.map((option) => (
                  <button
                    className="learnt-first-run-pack"
                    type="button"
                    aria-pressed={pack === option.id}
                    key={option.id}
                    onClick={() => {
                      setPack(option.id)
                    }}
                  >
                    <span
                      className="learnt-first-run-pack-glyph"
                      style={{ background: option.color }}
                      aria-hidden="true"
                    >
                      {option.glyph}
                    </span>
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.meta}</small>
                    </span>
                    <em>Ready</em>
                    <span
                      className="learnt-first-run-check"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="learnt-first-run-actions">
            {step === 0 ? null : (
              <button
                className="learnt-first-run-back"
                type="button"
                onClick={back}
              >
                Back
              </button>
            )}
            <button
              className="learnt-first-run-next"
              type="button"
              onClick={continueSetup}
            >
              {primaryLabel}
              <ArrowRight aria-hidden="true" size={16} strokeWidth={2.4} />
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
