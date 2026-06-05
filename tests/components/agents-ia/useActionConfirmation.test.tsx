// tests/components/agents-ia/useActionConfirmation.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useActionConfirmation } from '@/components/syndic-dashboard/agents-ia/hooks/useActionConfirmation'
import type { ToolCall } from '@/lib/syndic/agent-types'

const sampleToolCall: ToolCall = {
  tool_name: 'create_mission',
  arguments: { titre: 'Test' },
  status: 'pending',
}

describe('useActionConfirmation', () => {
  it('request expose pendingAction puis confirm résout true', async () => {
    const { result } = renderHook(() => useActionConfirmation())
    expect(result.current.pendingAction).toBeNull()

    let resolved: boolean | undefined
    act(() => {
      result.current.request(sampleToolCall).then(v => { resolved = v })
    })

    await act(async () => {
      expect(result.current.pendingAction).toEqual(sampleToolCall)
      result.current.confirm()
      await Promise.resolve()
    })

    expect(resolved).toBe(true)
    expect(result.current.pendingAction).toBeNull()
  })

  it('cancel résout false', async () => {
    const { result } = renderHook(() => useActionConfirmation())
    let resolved: boolean | undefined
    act(() => {
      result.current.request(sampleToolCall).then(v => { resolved = v })
    })
    await act(async () => {
      result.current.cancel()
      await Promise.resolve()
    })
    expect(resolved).toBe(false)
    expect(result.current.pendingAction).toBeNull()
  })
})
