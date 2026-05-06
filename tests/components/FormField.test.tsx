import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from '@/components/ui/FormField'

describe('FormField', () => {
  it('wires label.htmlFor to the child input id', () => {
    render(
      <FormField label="Email">
        <input type="email" data-testid="input" />
      </FormField>
    )
    const input = screen.getByTestId('input')
    const label = screen.getByText('Email')
    expect(input.id).toMatch(/^field/)
    expect(label).toHaveAttribute('for', input.id)
  })

  it('marks the field as required visually and exposes hint via aria-describedby', () => {
    render(
      <FormField label="Phone" required hint="Format E.164">
        <input data-testid="phone" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
    const input = screen.getByTestId('phone')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(screen.getByText('Format E.164')).toHaveAttribute('id', describedBy as string)
  })

  it('shows an error and sets aria-invalid on the child', () => {
    render(
      <FormField label="Postal" error="Code postal invalide">
        <input data-testid="postal" />
      </FormField>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Code postal invalide')
    expect(screen.getByTestId('postal')).toHaveAttribute('aria-invalid', 'true')
  })

  it('drops the hint when an error is present (error wins)', () => {
    render(
      <FormField label="X" hint="Helpful hint" error="Bad value">
        <input data-testid="x" />
      </FormField>
    )
    expect(screen.queryByText('Helpful hint')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
