'use client'

import { useEffect } from 'react'

export function useScrollAnimation() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((el) => {
          if (el.isIntersecting) el.target.classList.add('visible')
        }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}
