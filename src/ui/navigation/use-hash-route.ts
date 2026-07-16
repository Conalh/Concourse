import { useEffect, useState } from 'react'

import { parseHashRoute, type AppRoute } from './app-route'

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseHashRoute(window.location.hash),
  )

  useEffect(() => {
    const updateRoute = () => {
      setRoute(parseHashRoute(window.location.hash))
    }

    window.addEventListener('hashchange', updateRoute)
    updateRoute()

    return () => {
      window.removeEventListener('hashchange', updateRoute)
    }
  }, [])

  return route
}
