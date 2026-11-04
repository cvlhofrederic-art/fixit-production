import { describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { surActivationClavier } from '@/lib/a11y/activation-clavier'

const touche = (key: string) => ({ key, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLElement> & { preventDefault: ReturnType<typeof vi.fn> }

describe('surActivationClavier', () => {
  it.each(['Enter', ' '])('« %s » déclenche l’action et empêche le comportement par défaut', (key) => {
    const action = vi.fn()
    const e = touche(key)
    surActivationClavier(action)(e)
    expect(action).toHaveBeenCalledTimes(1)
    expect(e.preventDefault).toHaveBeenCalledTimes(1)
  })

  it.each(['Tab', 'Escape', 'a', 'ArrowDown'])('« %s » ne déclenche rien', (key) => {
    const action = vi.fn()
    const e = touche(key)
    surActivationClavier(action)(e)
    expect(action).not.toHaveBeenCalled()
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
