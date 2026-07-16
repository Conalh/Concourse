import { defineLearnerProfile } from './define-learner-profile'

export const demoLearnerProfile = defineLearnerProfile({
  schemaVersion: '0.1',
  id: 'demo-learner-v1',
  learnerId: 'demo-learner',
  displayName: 'Demo learner',
  reportedTraits: [
    'prefers compact explanations',
    'strong pattern recognition',
    'strong systems thinking',
    'prefers nonlinear exploration',
    'benefits from explicit attention anchors',
  ],
  presentation: {
    explanationDensity: 'compact',
    signalPriority: 'high',
    concreteBeforeAbstract: true,
    examplesBeforeExtendedTheory: true,
    visualModelsPreferred: true,
    systemMapsPreferred: true,
    avoidLongPassiveReading: true,
    avoidRedundantExplanation: true,
  },
  instruction: {
    defaultChunkSize: 'small',
    teachThroughBuilding: true,
    connectConceptsToSystemBehavior: true,
    checkpointAtConceptualBoundaries: true,
    permitNonlinearExploration: true,
    preserveCurrentThreadDuringDigressions: true,
    requestPredictionWhenInformative: true,
    requireMeaningfulLearnerAction: true,
  },
  errorHandling: {
    feedbackStyle: 'direct',
    explainDifferenceBriefly: true,
    offerImmediateRetry: true,
    avoidShamingLanguage: true,
    avoidGenericPraise: true,
  },
  defaultOutputSequence: ['concept', 'build', 'why', 'try'],
  constraints: {
    doNotInferNeedsBeyondExplicitProfile: true,
    doNotTreatDiagnosticLabelsAsRules: true,
    doNotInferMasteryFromSelfReport: true,
    doNotModifyProfileAutomatically: true,
  },
})
