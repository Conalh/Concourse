import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { LearnerIdSchema, LearnerProfileIdSchema } from '../../core/contracts'
import { LearntApplicationProvider } from './LearntApplicationProvider'
import { useLearntApplication } from './learnt-application-context'
import type { LearntApplicationClient } from './learnt-application-client'

function createStructuralApplication(): LearntApplicationClient {
  return {
    getLearner: () => ({
      learnerId: LearnerIdSchema.parse('demo-learner'),
      profileId: LearnerProfileIdSchema.parse('demo-learner-v1'),
      displayName: 'Demo learner',
    }),
    getThemeMode: () => 'dark',
    setThemeMode: () => undefined,
    getProductVocabularyMode: () => 'plain',
    setProductVocabularyMode: () => undefined,
    hasCompletedFirstRunSetup: () => true,
    completeFirstRunSetup: () => undefined,
    listSubjects: () => [],
    getSubjectOverview: () => {
      throw new Error('unused')
    },
    listSessions: () => Promise.resolve({ sessions: [], repositoryIssues: [] }),
    chooseAndInstallLearningPackDirectory: () => Promise.resolve(null),
    syncSelectedLearningPackDirectory: () => Promise.resolve(null),
    getInstalledLearningPacksForRuntime: () => [],
    getLearningPackLibrary: () =>
      Promise.resolve({
        packs: [],
        filterOptions: {
          installedPacks: [],
          subjects: [],
          courses: [],
          concepts: [],
          objectives: [],
          itemModes: [],
          authoredTags: [],
          learningStatuses: [],
        },
        appliedFilters: {},
        summary: {
          packCount: 0,
          subjectCount: 0,
          courseCount: 0,
          curriculumNodeCount: 0,
          studySetCount: 0,
          itemCount: 0,
          visibleItemCount: 0,
          invalidPackCount: 0,
          unsupportedCapabilityCount: 0,
          updateAvailableCount: 0,
          partiallySupportedCount: 0,
        },
        isEmpty: true,
      }),
    getLearningResource: () => Promise.reject(new Error('unused')),
    listResourcesForPack: () => Promise.resolve([]),
    listResourcesForConcept: () => Promise.resolve([]),
    listResourcesForObjective: () => Promise.resolve([]),
    listSupportResourcesForLearningItem: () => Promise.resolve([]),
    listCurriculumEntries: () => Promise.resolve([]),
    resolveStudySet: () => Promise.reject(new Error('unused')),
    startStudySetSession: () => Promise.reject(new Error('unused')),
    getAvailablePracticeScopes: () => Promise.resolve([]),
    getSupportedPracticeModes: () => [],
    createPracticeRequest: () => {
      throw new Error('unused')
    },
    createPracticePreset: () => {
      throw new Error('unused')
    },
    resolvePracticeCandidates: () => Promise.resolve([]),
    createPracticePlan: () => Promise.reject(new Error('unused')),
    startPracticeSession: () => Promise.reject(new Error('unused')),
    getPracticeSummary: () =>
      Promise.resolve({
        items: {},
        weakConcepts: [],
        recentMistakes: [],
        leastSeen: [],
        modeAvailability: {},
        exclusions: [],
        confusionRelationships: [],
        warnings: [],
      }),
    getWeakConcepts: () => Promise.resolve([]),
    getRecentMistakes: () => Promise.resolve([]),
    getEligibleSupportResources: () => Promise.resolve([]),
    recordResourceEngagement: () => Promise.reject(new Error('unused')),
    getSessionContext: () => Promise.reject(new Error('unused')),
    getSessionRecap: () => Promise.reject(new Error('unused')),
    getSessionConceptExploration: () => Promise.reject(new Error('unused')),
    startSession: () => Promise.reject(new Error('unused')),
    submitEvidence: () => Promise.reject(new Error('unused')),
    advanceSession: () => Promise.reject(new Error('unused')),
    changeInteractionMode: () => Promise.reject(new Error('unused')),
    abandonSession: () => Promise.reject(new Error('unused')),
    parkConcept: () => Promise.reject(new Error('unused')),
    unparkConcept: () => Promise.reject(new Error('unused')),
  }
}

function Consumer() {
  const application = useLearntApplication()
  return <p>{application.getLearner().displayName}</p>
}

describe('LearntApplicationProvider', () => {
  it('exposes the supplied structural application without constructing services', () => {
    const application = createStructuralApplication()
    const { rerender } = render(
      <LearntApplicationProvider application={application}>
        <Consumer />
      </LearntApplicationProvider>,
    )

    expect(screen.getByText('Demo learner')).toBeInTheDocument()

    rerender(
      <LearntApplicationProvider application={application}>
        <Consumer />
      </LearntApplicationProvider>,
    )
    expect(screen.getByText('Demo learner')).toBeInTheDocument()
  })

  it('fails clearly when consumed outside the provider', () => {
    expect(() => render(<Consumer />)).toThrow(
      /useLearntApplication must be used inside LearntApplicationProvider/i,
    )
  })
})
