// tests/components/agents-ia/useVoiceInput.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceInput } from '@/components/syndic-dashboard/agents-ia/hooks/useVoiceInput'

describe('useVoiceInput', () => {
  it('reporte supported=false si Web Speech absent (jsdom)', () => {
    const { result } = renderHook(() => useVoiceInput({
      locale: 'fr', onTranscript: vi.fn(),
    }))
    expect(result.current.supported).toBe(false)
  })

  it('start sans support définit error voice_unsupported', () => {
    const { result } = renderHook(() => useVoiceInput({
      locale: 'fr', onTranscript: vi.fn(),
    }))
    act(() => result.current.start())
    expect(result.current.error).toBe('voice_unsupported')
  })

  it('stop est idempotent (peut être appelé sans listening)', () => {
    const { result } = renderHook(() => useVoiceInput({
      locale: 'fr', onTranscript: vi.fn(),
    }))
    act(() => result.current.stop())
    expect(result.current.listening).toBe(false)
  })
})
