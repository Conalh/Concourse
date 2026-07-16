import type { ProductVocabularyMode } from '../../application'
import type { AppRoute } from '../navigation'

export type ProductVocabularyCopy = Readonly<{
  mode: ProductVocabularyMode
  appName: string
  homeAriaLabel: string
  skipLinkLabel: string
  currentLocationAriaLabel: string
  plainNamesLabel: string
  plainNamesDescription: string
  brandedNamesLabel: string
  nav: Readonly<{
    today: string
    library: string
    practice: string
    transfer: string
    progress: string
  }>
  terms: Readonly<{
    subjectSingular: string
    subjectPlural: string
    subjectMaterials: string
    subjectOverview: string
    courseSingular: string
    coursePlural: string
    packSingular: string
    packPlural: string
    studySetSingular: string
    studySetPlural: string
    learningItemSingular: string
    learningItemPlural: string
    itemMode: string
    mode: string
    modeSelector: string
    practice: string
    practiceAction: string
    resource: string
  }>
  routeLabels: Readonly<{
    today: string
    library: string
    practice: string
    transfer: string
    progress: string
    profile: string
    settings: string
    subject: string
    session: string
    sessionConcept: string
    sessionRecap: string
    resource: string
    notFound: string
  }>
  library: Readonly<{
    navigationAriaLabel: string
    sectionsAriaLabel: string
    title: string
    kicker: string
    description: string
    availableKicker: string
    emptyTitle: string
    emptyMessage: string
    viewSubjectAction: string
    materialsBySubjectKicker: string
    sourceDetails: string
    historyLabel: string
    historyTitle: string
    historyDescription: string
    sessionFallbackPrefix: string
  }>
  transfer: Readonly<{
    title: string
    description: string
    importTitle: string
    importDescription: string
    regionLabel: string
    emptyTitle: string
    emptyMessage: string
    sourcePackKicker: string
    sourcePackUnavailable: string
    visualStyleLabel: string
    orderedContentLabel: string
    noCheckpointSets: string
  }>
  practice: Readonly<{
    title: string
    kicker: string
    description: string
    loadingLabel: string
    retryLabel: string
    readinessAriaLabel: string
    noPacksTitle: string
    noPacksMessage: string
    launcherAriaLabel: string
    scopeLabel: string
    modeLabel: string
    startLabel: string
    startingLabel: string
    libraryAction: string
  }>
  resource: Readonly<{
    teachingKicker: string
    unsupportedKicker: string
    openExternalTitle: string
    openExternalAction: string
    leaveAction: string
    markCompleteAction: string
    completedAction: string
    checkpointsTitle: string
    startCheckpointAction: string
    practiceSectionAction: string
    nextEntryTitle: string
    returnToPractice: string
    backToResource: string
  }>
}>

const brandedVocabulary: ProductVocabularyCopy = {
  mode: 'branded',
  appName: 'Concourse',
  homeAriaLabel: 'Concourse home',
  skipLinkLabel: 'Skip to route workspace',
  currentLocationAriaLabel: 'Current location',
  plainNamesLabel: 'Plain names',
  plainNamesDescription: 'Courses, flashcards, and shared packs',
  brandedNamesLabel: 'Turn off for Concourse names',
  nav: {
    today: 'Today',
    library: 'Routes',
    practice: 'Loop',
    transfer: 'Transfer',
    progress: 'Progress',
  },
  terms: {
    subjectSingular: 'Route',
    subjectPlural: 'Routes',
    subjectMaterials: 'Transfer',
    subjectOverview: 'Route overview',
    courseSingular: 'Route',
    coursePlural: 'Routes',
    packSingular: 'Transfer pack',
    packPlural: 'Transfer packs',
    studySetSingular: 'Loop set',
    studySetPlural: 'Loop sets',
    learningItemSingular: 'Loop item',
    learningItemPlural: 'Loop items',
    itemMode: 'Loop mode',
    mode: 'Mode',
    modeSelector: 'Mode chip',
    practice: 'Loop',
    practiceAction: 'Start loop',
    resource: 'Resource',
  },
  routeLabels: {
    today: 'Today',
    library: 'Route Library',
    practice: 'Loop',
    transfer: 'Transfer',
    progress: 'Progress',
    profile: 'Profile',
    settings: 'Settings',
    subject: 'Route Overview',
    session: 'Route Workspace',
    sessionConcept: 'Concept Explorer',
    sessionRecap: 'Route Recap',
    resource: 'Teach',
    notFound: 'Not Found',
  },
  library: {
    navigationAriaLabel: 'Route library navigation',
    sectionsAriaLabel: 'Route library sections',
    title: 'Your courses',
    kicker: 'Routes',
    description:
      'Structured sequences that interleave readings, predictions, and checkpoints.',
    availableKicker: 'Available routes',
    emptyTitle: 'No routes registered',
    emptyMessage:
      'The Concourse shell is ready, but no routes are available in this composition.',
    viewSubjectAction: 'View route',
    materialsBySubjectKicker: 'Transfer by route',
    sourceDetails: 'Transfer source',
    historyLabel: 'Route history',
    historyTitle: 'Route history',
    historyDescription:
      'Review saved route sessions without mixing them into route browsing.',
    sessionFallbackPrefix: 'Route',
  },
  transfer: {
    title: 'Your content',
    description:
      'Browse shared routes, Loop sets, readings, and imported course packs.',
    importTitle: 'Transfer source',
    importDescription:
      'Choose a local directory to validate Transfer packs and keep active releases in this browser.',
    regionLabel: 'Transfer',
    emptyTitle: 'Nothing here yet',
    emptyMessage:
      'Your Transfer space is empty. Install a pack or import a Route someone shared with you. Both are portable files.',
    sourcePackKicker: 'Transfer pack',
    sourcePackUnavailable: 'No Transfer material is currently browsable.',
    visualStyleLabel: 'Visual style',
    orderedContentLabel: 'Ordered route content',
    noCheckpointSets: 'No checkpoint Loop sets are authored here.',
  },
  practice: {
    title: 'Loop',
    kicker: 'Loop',
    description:
      'Launch flashcards, retrieval practice, and review from installed Transfer packs, routes, concepts, weak items, or recent mistakes.',
    loadingLabel: 'Loading Loop options',
    retryLabel: 'Reload Loop options',
    readinessAriaLabel: 'Loop readiness',
    noPacksTitle: 'No installed Transfer packs',
    noPacksMessage: 'Install a Transfer pack before starting Loop.',
    launcherAriaLabel: 'Loop launcher',
    scopeLabel: 'Scope',
    modeLabel: 'Loop mode',
    startLabel: 'Start loop',
    startingLabel: 'Starting...',
    libraryAction: 'Routes',
  },
  resource: {
    teachingKicker: 'Teaching resource',
    unsupportedKicker: 'Unsupported resource',
    openExternalTitle: 'Open outside Concourse',
    openExternalAction: 'Open external resource',
    leaveAction: 'Leave resource',
    markCompleteAction: 'Mark complete',
    completedAction: 'Completed',
    checkpointsTitle: 'Checkpoints',
    startCheckpointAction: 'Start Checkpoint',
    practiceSectionAction: 'Practice This Section',
    nextEntryTitle: 'Next route entry',
    returnToPractice: 'Return to Loop',
    backToResource: 'Back to resource',
  },
}

const plainVocabulary: ProductVocabularyCopy = {
  mode: 'plain',
  appName: 'Concourse',
  homeAriaLabel: 'Concourse home',
  skipLinkLabel: 'Skip to learning workspace',
  currentLocationAriaLabel: 'Current location',
  plainNamesLabel: 'Plain names',
  plainNamesDescription: 'Courses, flashcards, and shared packs',
  brandedNamesLabel: 'Turn off for Concourse names',
  nav: {
    today: 'Today',
    library: 'Courses',
    practice: 'Flashcards',
    transfer: 'Library',
    progress: 'Progress',
  },
  terms: {
    subjectSingular: 'Course',
    subjectPlural: 'Courses',
    subjectMaterials: 'Course materials',
    subjectOverview: 'Course overview',
    courseSingular: 'Course',
    coursePlural: 'Courses',
    packSingular: 'Learning pack',
    packPlural: 'Learning packs',
    studySetSingular: 'Flashcard set',
    studySetPlural: 'Flashcard sets',
    learningItemSingular: 'Practice item',
    learningItemPlural: 'Practice items',
    itemMode: 'Item mode',
    mode: 'Mode',
    modeSelector: 'Learning mode',
    practice: 'Flashcards',
    practiceAction: 'Start practice',
    resource: 'Resource',
  },
  routeLabels: {
    today: 'Today',
    library: 'Course Library',
    practice: 'Flashcards',
    transfer: 'Course Materials',
    progress: 'Progress',
    profile: 'Profile',
    settings: 'Settings',
    subject: 'Course Overview',
    session: 'Learning Workspace',
    sessionConcept: 'Concept Explorer',
    sessionRecap: 'Session Recap',
    resource: 'Teach',
    notFound: 'Not Found',
  },
  library: {
    navigationAriaLabel: 'Course library navigation',
    sectionsAriaLabel: 'Course library sections',
    title: 'Your courses',
    kicker: 'Courses',
    description:
      'Structured sequences that interleave readings, predictions, and checkpoints.',
    availableKicker: 'Available courses',
    emptyTitle: 'No courses registered',
    emptyMessage:
      'The product shell is ready, but no courses are available in this composition.',
    viewSubjectAction: 'View course',
    materialsBySubjectKicker: 'Materials by course',
    sourceDetails: 'Source details',
    historyLabel: 'Session history',
    historyTitle: 'Session history',
    historyDescription:
      'Review saved sessions without mixing them into course browsing.',
    sessionFallbackPrefix: 'Course',
  },
  transfer: {
    title: 'Your content',
    description:
      'Browse shared courses, flashcard sets, readings, and imported learning packs.',
    importTitle: 'Learning pack source',
    importDescription:
      'Choose a local directory to validate learning packs and keep active releases in this browser.',
    regionLabel: 'Course materials',
    emptyTitle: 'Nothing here yet',
    emptyMessage:
      'Your content space is empty. Install a learning pack or import a course someone shared with you. Both are portable files.',
    sourcePackKicker: 'Source pack',
    sourcePackUnavailable: 'No course material is currently browsable.',
    visualStyleLabel: 'Visual style',
    orderedContentLabel: 'Ordered course content',
    noCheckpointSets: 'No checkpoint flashcard sets are authored here.',
  },
  practice: {
    title: 'Flashcards',
    kicker: 'Flashcards',
    description:
      'Launch flashcards, quizzes, and recall practice from installed learning packs, courses, concepts, weak items, or recent mistakes.',
    loadingLabel: 'Loading flashcard options',
    retryLabel: 'Reload flashcard options',
    readinessAriaLabel: 'Flashcard readiness',
    noPacksTitle: 'No installed learning packs',
    noPacksMessage:
      'Install a learning pack before starting portable practice.',
    launcherAriaLabel: 'Flashcard launcher',
    scopeLabel: 'Scope',
    modeLabel: 'Mode',
    startLabel: 'Start practice',
    startingLabel: 'Starting...',
    libraryAction: 'Courses',
  },
  resource: {
    teachingKicker: 'Teaching resource',
    unsupportedKicker: 'Unsupported resource',
    openExternalTitle: 'Open outside Concourse',
    openExternalAction: 'Open external resource',
    leaveAction: 'Leave resource',
    markCompleteAction: 'Mark complete',
    completedAction: 'Completed',
    checkpointsTitle: 'Checkpoints',
    startCheckpointAction: 'Start Checkpoint',
    practiceSectionAction: 'Practice This Section',
    nextEntryTitle: 'Next course entry',
    returnToPractice: 'Return to practice',
    backToResource: 'Back to resource',
  },
}

export function getProductVocabulary(
  mode: ProductVocabularyMode,
): ProductVocabularyCopy {
  return mode === 'plain' ? plainVocabulary : brandedVocabulary
}

export function routeLabelForVocabulary(
  vocabulary: ProductVocabularyCopy,
  route: AppRoute,
): string {
  switch (route.kind) {
    case 'today':
      return vocabulary.routeLabels.today
    case 'library':
      return vocabulary.routeLabels.library
    case 'practice':
      return vocabulary.routeLabels.practice
    case 'transfer':
      return vocabulary.routeLabels.transfer
    case 'progress':
      return vocabulary.routeLabels.progress
    case 'profile':
      return vocabulary.routeLabels.profile
    case 'settings':
      return vocabulary.routeLabels.settings
    case 'subject':
      return vocabulary.routeLabels.subject
    case 'session':
      return vocabulary.routeLabels.session
    case 'session-concept':
      return vocabulary.routeLabels.sessionConcept
    case 'session-recap':
      return vocabulary.routeLabels.sessionRecap
    case 'resource':
      return vocabulary.routeLabels.resource
    case 'not-found':
      return vocabulary.routeLabels.notFound
  }
}
