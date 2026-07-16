import { logicBasicsSubjectAdapter } from './logic-basics'
import { machineLearningFoundationsSubjectAdapter } from './machine-learning-foundations'
import { movementPlanesSubjectAdapter } from './movement-planes'

export { logicBasicsSubject, logicBasicsSubjectAdapter } from './logic-basics'
export {
  machineLearningFoundationsSubject,
  machineLearningFoundationsSubjectAdapter,
} from './machine-learning-foundations'
export {
  movementPlanesSubject,
  movementPlanesSubjectAdapter,
} from './movement-planes'

export const productionSubjectAdapters = Object.freeze([
  logicBasicsSubjectAdapter,
  movementPlanesSubjectAdapter,
  machineLearningFoundationsSubjectAdapter,
] as const)
