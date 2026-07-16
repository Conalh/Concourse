import type { ReactNode } from 'react'

import type { LearntApplicationClient } from './learnt-application-client'
import { LearntApplicationContext } from './learnt-application-context'

export function LearntApplicationProvider({
  application,
  children,
}: Readonly<{
  application: LearntApplicationClient
  children: ReactNode
}>) {
  return (
    <LearntApplicationContext.Provider value={application}>
      {children}
    </LearntApplicationContext.Provider>
  )
}
