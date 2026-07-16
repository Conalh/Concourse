import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')

const restrictedCoreImports = [
  '../ui',
  '../../ui',
  '../subjects',
  '../../subjects',
  '../infrastructure',
  '../../infrastructure',
  '../app',
  '../../app',
  '../application',
  '../../application',
  '../subject-sdk',
  '../../subject-sdk',
  '../profiles',
  '../../profiles',
  'react',
  'react-dom',
]

const restrictedCoreEngineReferences = [
  "from '../subject-sdk",
  "from '../../subject-sdk",
  "from '../profiles",
  "from '../../profiles",
  "from '../subjects",
  "from '../../subjects",
  "from '../infrastructure",
  "from '../../infrastructure",
  "from '../application",
  "from '../../application",
  "from '../ui",
  "from '../../ui",
  "from 'react",
  "from 'react-dom",
  'localStorage',
  'window',
  'document',
  'crypto',
  'Date.now',
  'Math.random',
]

const restrictedCorePortReferences = [
  "from '../infrastructure",
  "from '../../infrastructure",
  "from '../application",
  "from '../../application",
]

const restrictedApplicationReferences = [
  "from '../app",
  "from '../../app",
  "from '../subjects",
  "from '../../subjects",
  "from '../profiles",
  "from '../../profiles",
  "from '../infrastructure",
  "from '../../infrastructure",
  "from '../ui",
  "from '../../ui",
  "from 'react",
  "from 'react-dom",
  'localStorage',
  'globalThis.localStorage',
  'crypto',
  'globalThis.crypto',
  'Date.now',
  'new Date',
  'Math.random',
]

const restrictedInfrastructureReferences = [
  "from '../application",
  "from '../../application",
  "from '../ui",
  "from '../../ui",
  "from 'react",
  "from 'react-dom",
]

const restrictedSubjectReferences = [
  "from '../application",
  "from '../../application",
  "from '../app",
  "from '../../app",
  "from '../profiles",
  "from '../../profiles",
  "from '../infrastructure",
  "from '../../infrastructure",
  "from '../ui",
  "from '../../ui",
  "from 'react",
  "from 'react-dom",
  'localStorage',
  'window',
  'document',
  'globalThis',
  'crypto',
]

const productionSubjectIds = [
  'logic-basics',
  'movement-planes',
  'machine-learning-foundations',
]

const restrictedSubjectSdkImports = [
  '../ui',
  '../subjects',
  '../infrastructure',
  '../app',
  'react',
  'react-dom',
  'localStorage',
  'window',
  'document',
]

const restrictedPresentationImports = [
  '../profiles',
  '../ui',
  '../subjects',
  '../infrastructure',
  '../subject-sdk',
  'react',
  'react-dom',
  'localStorage',
  'window',
  'document',
]

const restrictedProfileImports = [
  '../subject-sdk',
  '../ui',
  '../infrastructure',
  '../subjects',
  '../core/presentation',
  'react',
  'react-dom',
  'localStorage',
  'window',
  'document',
]

const restrictedUiReferences = [
  "from '../infrastructure",
  "from '../../infrastructure",
  "from '../subjects",
  "from '../../subjects",
  "from '../profiles",
  "from '../../profiles",
  "from '../subject-sdk",
  "from '../../subject-sdk",
  'new LearningEngine',
  'new PersistentLearningService',
  'SubjectRegistry',
  'LearningRepository>',
  'localStorage',
  'globalThis.localStorage',
  'globalThis.crypto',
  'correctOptionIds',
  'dangerouslySetInnerHTML',
  'logic-basics',
  'movement-planes',
]

const restrictedMainBootstrapReferences = [
  'new LearningEngine',
  'new PersistentLearningService',
  'SubjectRegistry',
  'correctOptionIds',
  'logic-basics',
  'movement-planes',
  'Boolean value',
  'bodyweight squat',
]

const restrictedRecapAnswerKeyReferences = [
  'correctOptionIds',
  'acceptedAnswers',
  'absoluteTolerance',
  'matchedCriteria',
  'missingCriteria',
  'successCriteria',
]

const restrictedRecapMasteryLanguage = [
  /\bmastered\b/i,
  /\bproficient\b/i,
  /\bability\b/i,
  /\bskill level\b/i,
  /\bknowledge score\b/i,
  /\blearning score\b/i,
  /\bweakness\b/i,
  /\bstrength\b/i,
]

const conceptExplorerProductionFiles = [
  resolve(sourceRoot, 'ui', 'screens', 'SessionConceptScreen.tsx'),
  resolve(sourceRoot, 'ui', 'components', 'ConceptExplorer.tsx'),
  resolve(sourceRoot, 'ui', 'hooks', 'use-session-concept-exploration.ts'),
  resolve(sourceRoot, 'application', 'session-concept-exploration.ts'),
]

const draftProviderProductionFiles = [
  resolve(sourceRoot, 'ui', 'responses', 'ResponseDraftProvider.tsx'),
]

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) {
    return []
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name)

    if (entry.isDirectory()) {
      return collectSourceFiles(path)
    }

    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) {
      return []
    }

    return [path]
  })
}

function collectProductionSourceFiles(root: string): string[] {
  return collectSourceFiles(root).filter(
    (file) => !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'),
  )
}

function collectProductionSubjectPackageFiles(): string[] {
  return collectProductionSourceFiles(resolve(sourceRoot, 'subjects')).filter(
    (file) => !file.endsWith(resolve(sourceRoot, 'subjects', 'index.ts')),
  )
}

describe('dependency boundaries', () => {
  it('keeps core independent from UI, subjects, infrastructure, and React', () => {
    const coreFiles = collectSourceFiles(resolve(sourceRoot, 'core'))
    const violations = coreFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedCoreImports
        .filter((restrictedImport) =>
          text.includes(`from '${restrictedImport}`),
        )
        .map((restrictedImport) => ({
          file: relative(sourceRoot, file),
          restrictedImport,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps the core engine independent from app layers, browser APIs, global time, and randomness', () => {
    const engineFiles = collectProductionSourceFiles(
      resolve(sourceRoot, 'core', 'engine'),
    )
    const violations = engineFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedCoreEngineReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps core ports independent from infrastructure implementations', () => {
    const portFiles = collectProductionSourceFiles(
      resolve(sourceRoot, 'core', 'ports'),
    )
    const violations = portFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedCorePortReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps application services independent from infrastructure, UI, React, browser storage, browser crypto, and global time', () => {
    const applicationFiles = collectProductionSourceFiles(
      resolve(sourceRoot, 'application'),
    )
    const violations = applicationFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedApplicationReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps production subjects declarative and independent from application, app, profiles, infrastructure, UI, React, and browser APIs', () => {
    const subjectFiles = collectProductionSubjectPackageFiles()
    const violations = subjectFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedSubjectReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps core, application, presentation, and persistence free of concrete subject-ID branching', () => {
    const checkedFiles = [
      ...collectProductionSourceFiles(resolve(sourceRoot, 'core')),
      ...collectProductionSourceFiles(resolve(sourceRoot, 'application')),
      ...collectProductionSourceFiles(resolve(sourceRoot, 'infrastructure')),
    ]
    const violations = checkedFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return productionSubjectIds
        .filter((subjectId) => text.includes(subjectId))
        .map((subjectId) => ({
          file: relative(sourceRoot, file),
          subjectId,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps app composition as wiring, not subject content or UI rendering', () => {
    const compositionFiles = [
      resolve(sourceRoot, 'app', 'composition-root.ts'),
      resolve(sourceRoot, 'app', 'subject-registry.ts'),
    ]
    const restrictedReferences = [
      "from 'react",
      "from 'react-dom",
      'What is',
      'bodyweight squat',
      'jumping jack',
    ]
    const violations = compositionFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps infrastructure independent from application, UI, and React', () => {
    const infrastructureFiles = collectProductionSourceFiles(
      resolve(sourceRoot, 'infrastructure'),
    )
    const violations = infrastructureFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedInfrastructureReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps subject SDK independent from UI, infrastructure, subjects, React, and browser APIs', () => {
    const sdkFiles = collectSourceFiles(resolve(sourceRoot, 'subject-sdk'))
    const violations = sdkFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedSubjectSdkImports
        .filter((restrictedImport) => text.includes(restrictedImport))
        .map((restrictedImport) => ({
          file: relative(sourceRoot, file),
          restrictedImport,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps presentation policy independent from profiles, subjects, UI, infrastructure, subject SDK, React, and browser APIs', () => {
    const presentationFiles = collectSourceFiles(
      resolve(sourceRoot, 'core', 'presentation'),
    )
    const violations = presentationFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedPresentationImports
        .filter((restrictedImport) => text.includes(restrictedImport))
        .map((restrictedImport) => ({
          file: relative(sourceRoot, file),
          restrictedImport,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps profiles independent from subject SDK, subjects, UI, infrastructure, presentation, React, and browser APIs', () => {
    const profileFiles = collectSourceFiles(resolve(sourceRoot, 'profiles'))
    const violations = profileFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedProfileImports
        .filter((restrictedImport) => text.includes(restrictedImport))
        .map((restrictedImport) => ({
          file: relative(sourceRoot, file),
          restrictedImport,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps UI dependent on the product facade instead of infrastructure, concrete subjects, profile wiring, or subject IDs', () => {
    const uiFiles = collectProductionSourceFiles(resolve(sourceRoot, 'ui'))
    const violations = uiFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedUiReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps session recap derivation from exposing answer-key and criteria internals', () => {
    const recapFiles = [
      resolve(sourceRoot, 'application', 'session-recap.ts'),
      resolve(sourceRoot, 'application', 'session-recap.types.ts'),
    ]
    const violations = recapFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedRecapAnswerKeyReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps recap UI retrieval-oriented without answer keys or mastery-language framing', () => {
    const recapUiFiles = [
      resolve(sourceRoot, 'ui', 'screens', 'SessionRecapScreen.tsx'),
      resolve(sourceRoot, 'ui', 'components', 'RecapEvidenceResponse.tsx'),
      resolve(sourceRoot, 'ui', 'hooks', 'use-session-recap.ts'),
    ]
    const answerKeyViolations = recapUiFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedRecapAnswerKeyReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })
    const languageViolations = recapUiFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedRecapMasteryLanguage
        .filter((restrictedPattern) => restrictedPattern.test(text))
        .map((restrictedPattern) => ({
          file: relative(sourceRoot, file),
          restrictedPattern: String(restrictedPattern),
        }))
    })

    expect(answerKeyViolations).toEqual([])
    expect(languageViolations).toEqual([])
  })

  it('keeps concept exploration free of answer keys, browser storage, and evidence submission', () => {
    const restrictedConceptReferences = [
      'correctOptionIds',
      'acceptedAnswers',
      'absoluteTolerance',
      'submitEvidence',
      'commitSubmission',
      'localStorage',
      'sessionStorage',
      'IndexedDB',
    ]
    const violations = conceptExplorerProductionFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedConceptReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps the response draft provider scoped to React state rather than browser storage', () => {
    const restrictedDraftReferences = [
      'localStorage',
      'sessionStorage',
      'IndexedDB',
      'globalThis',
      'window.',
      'document.',
    ]
    const violations = draftProviderProductionFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return restrictedDraftReferences
        .filter((restrictedReference) => text.includes(restrictedReference))
        .map((restrictedReference) => ({
          file: relative(sourceRoot, file),
          restrictedReference,
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps UI components from mutating session objects directly', () => {
    const uiFiles = collectProductionSourceFiles(resolve(sourceRoot, 'ui'))
    const directMutationPatterns = [
      /\.record\.session\.[A-Za-z0-9_]+[ \t]*=(?!=)/,
      /\.session\.exploration[ \t]*=(?!=)/,
      /\.session\.activityProgress[ \t]*=(?!=)/,
      /\.session\.evidenceEventIds[ \t]*=(?!=)/,
    ]
    const violations = uiFiles.flatMap((file) => {
      const text = readFileSync(file, 'utf8')

      return directMutationPatterns
        .filter((pattern) => pattern.test(text))
        .map((pattern) => ({
          file: relative(sourceRoot, file),
          restrictedPattern: String(pattern),
        }))
    })

    expect(violations).toEqual([])
  })

  it('keeps main bootstrap as composition wiring rather than learning rules or subject content', () => {
    const mainFile = resolve(sourceRoot, 'main.tsx')
    const text = readFileSync(mainFile, 'utf8')
    const violations = restrictedMainBootstrapReferences
      .filter((restrictedReference) => text.includes(restrictedReference))
      .map((restrictedReference) => ({
        file: relative(sourceRoot, mainFile),
        restrictedReference,
      }))

    expect(violations).toEqual([])
    expect(text).toContain('createBrowserLearntApplication()')
    expect(text).toContain(
      '<LearntApplicationProvider application={application}>',
    )
  })
})
