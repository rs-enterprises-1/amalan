'use client'

import { useEffect, type ReactNode } from 'react'

interface RootClientProps {
  children: ReactNode
}

export function RootClient({ children }: RootClientProps) {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const activeElement = document.activeElement as HTMLInputElement | null

      if (
        activeElement &&
        activeElement.tagName === 'INPUT' &&
        activeElement.type === 'number'
      ) {
        // Prevent scroll from changing the number input value
        event.preventDefault()
      }
    }

    // Use non-passive listener so preventDefault works
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel as EventListener)
    }
  }, [])

  return <>{children}</>
}

