import { useEffect, useRef } from 'react'

export function useRouteFocus<TElement extends HTMLElement>(routeKey: string) {
  const headingRef = useRef<TElement | null>(null)

  useEffect(() => {
    const handle = window.requestAnimationFrame(() => {
      headingRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(handle)
    }
  }, [routeKey])

  return headingRef
}
