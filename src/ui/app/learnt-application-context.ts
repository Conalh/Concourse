import { createContext, useContext } from 'react'

import type { LearntApplicationClient } from './learnt-application-client'

export const LearntApplicationContext =
  createContext<LearntApplicationClient | null>(null)

export function useLearntApplication(): LearntApplicationClient {
  const application = useContext(LearntApplicationContext)

  if (application === null) {
    throw new Error(
      'useLearntApplication must be used inside LearntApplicationProvider.',
    )
  }

  return application
}
