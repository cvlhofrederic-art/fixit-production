'use client'

import { useState, useCallback } from 'react'

// Hook for announcing dynamic content to screen readers
export function useAnnounce() {
  const [message, setMessage] = useState('')

  const announce = useCallback((text: string) => {
    setMessage('')
    // Small delay to ensure DOM update triggers screen reader announcement
    requestAnimationFrame(() => setMessage(text))
  }, [])

  return { message, announce }
}

// Invisible live region component — place once in layout
export default function LiveRegion({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}
