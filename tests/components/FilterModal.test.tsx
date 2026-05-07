import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterModal, type FilterState } from '@/components/recherche/FilterModal'

const baseFilters: FilterState = {
  disponibilite: '',
  typeIntervention: '',
  verifiedOnly: false,
}

describe('FilterModal', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(
      <FilterModal isOpen={false} onClose={vi.fn()} filters={baseFilters} setFilters={vi.fn()} locale="fr" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders content when isOpen=true', () => {
    render(
      <FilterModal isOpen onClose={vi.fn()} filters={baseFilters} setFilters={vi.fn()} locale="fr" />
    )
    // At least one role=dialog or one form-control surfaced.
    expect(document.querySelectorAll('button, input, select').length).toBeGreaterThan(0)
  })

  it('renders without throwing in PT locale', () => {
    expect(() =>
      render(
        <FilterModal isOpen onClose={vi.fn()} filters={baseFilters} setFilters={vi.fn()} locale="pt" />
      )
    ).not.toThrow()
  })

  it('invokes onClose when the X dismiss control is clicked', () => {
    const onClose = vi.fn()
    render(
      <FilterModal isOpen onClose={onClose} filters={baseFilters} setFilters={vi.fn()} locale="fr" />
    )
    // The close affordance is the X icon inside a button (lucide-react X).
    // Click the first button — it is conventionally the dismiss in this UI.
    const firstButton = screen.getAllByRole('button')[0]
    fireEvent.click(firstButton)
    expect(onClose).toHaveBeenCalled()
  })
})
