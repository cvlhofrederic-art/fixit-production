// tests/components/syndic-v54-batch3.test.tsx
//
// Primitives batch 3 : Toggle, Field, FormRow, SegmentedControl.
// CSS Modules mockés en identité par Vitest — on teste la logique, l'a11y et la
// composition (classes/attributs), pas les valeurs calculées (couvertes par Playwright).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import Toggle from '@/components/syndic-dashboard/v54/primitives/toggle/Toggle'
import Field from '@/components/syndic-dashboard/v54/primitives/field/Field'
import FormRow from '@/components/syndic-dashboard/v54/primitives/form-row/FormRow'
import SegmentedControl from '@/components/syndic-dashboard/v54/primitives/segmented-control/SegmentedControl'

afterEach(cleanup)

describe('syndic v54 — Toggle', () => {
  it('renders a native checkbox inside a label, aria-label forwarded', () => {
    const { container, getByLabelText } = render(<Toggle on={false} onToggle={() => {}} aria-label="Notifs" />)
    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(getByLabelText('Notifs')).toBe(input)
    expect(container.querySelector('label')).toBeTruthy()
  })

  it('reflects on/off in the class + checked state', () => {
    const { container } = render(<Toggle on onToggle={() => {}} aria-label="x" />)
    expect(container.querySelector('label')!.className).toMatch(/on/)
    expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true)
    cleanup()
    const { container: c2 } = render(<Toggle on={false} onToggle={() => {}} aria-label="x" />)
    expect((c2.querySelector('input') as HTMLInputElement).checked).toBe(false)
  })

  it('disabled sets the input disabled + disabled class', () => {
    const { container } = render(<Toggle on disabled onToggle={() => {}} aria-label="x" />)
    expect((container.querySelector('input') as HTMLInputElement).disabled).toBe(true)
    expect(container.querySelector('label')!.className).toMatch(/disabled/)
  })

  it('calls onToggle on change', () => {
    const fn = vi.fn()
    const { container } = render(<Toggle on={false} onToggle={fn} aria-label="x" />)
    fireEvent.click(container.querySelector('input')!)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('syndic v54 — Field', () => {
  it('links label htmlFor to the cloned child id (= name) — anti-bug V5.2', () => {
    const { container } = render(
      <Field label="Nom" name="f1">
        <input type="text" />
      </Field>,
    )
    expect(container.querySelector('label')!.getAttribute('for')).toBe('f1')
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.id).toBe('f1')
    expect(input.getAttribute('name')).toBe('f1')
  })

  it('required → astérisque + aria-required', () => {
    const { container } = render(
      <Field label="Nom" name="f2" required>
        <input type="text" />
      </Field>,
    )
    expect(container.querySelector('label')!.textContent).toContain('*')
    expect(container.querySelector('input')!.getAttribute('aria-required')).toBe('true')
  })

  it('suffix → rendu dans le wrapper input-suffix', () => {
    const { container, getByText } = render(
      <Field label="Quota" name="f3" suffix="€">
        <input type="number" />
      </Field>,
    )
    expect(getByText('€')).toBeTruthy()
    expect(container.querySelector('input')!.parentElement!.className).toMatch(/inputSuffix/)
  })

  it('hint → id + aria-describedby sur le champ', () => {
    const { container, getByText } = render(
      <Field label="Nom" name="f4" hint="Aide">
        <input type="text" />
      </Field>,
    )
    expect(getByText('Aide')).toBeTruthy()
    expect(container.querySelector('input')!.getAttribute('aria-describedby')).toContain('f4-hint')
  })

  it('error → role alert + aria-invalid + has-err', () => {
    const { container, getByRole } = render(
      <Field label="Nom" name="f5" error="Erreur">
        <input type="text" />
      </Field>,
    )
    expect(getByRole('alert').textContent).toBe('Erreur')
    expect(container.querySelector('input')!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('div')!.className).toMatch(/hasErr/)
  })
})

describe('syndic v54 — FormRow', () => {
  it('renders a grid wrapper with its children', () => {
    const { container, getByText } = render(
      <FormRow>
        <span>a</span>
        <span>b</span>
      </FormRow>,
    )
    expect(container.querySelector('div')!.className).toMatch(/fieldRow/)
    expect(getByText('a')).toBeTruthy()
    expect(getByText('b')).toBeTruthy()
  })
})

describe('syndic v54 — SegmentedControl', () => {
  const opts = [
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hora' },
    { value: 120, label: '2 horas' },
  ] as const

  it('renders a radiogroup with native radios sharing the name', () => {
    const { container, getByRole } = render(
      <SegmentedControl name="slot" ariaLabel="Durée" value={60} onChange={() => {}} options={opts} />,
    )
    expect(getByRole('radiogroup').getAttribute('aria-label')).toBe('Durée')
    const radios = container.querySelectorAll('input[type="radio"]')
    expect(radios.length).toBe(3)
    radios.forEach((r) => expect(r.getAttribute('name')).toBe('slot'))
  })

  it('marks the selected option active + checks its radio', () => {
    const { getByText, container } = render(
      <SegmentedControl name="slot" ariaLabel="Durée" value={60} onChange={() => {}} options={opts} />,
    )
    expect(getByText('1 hora').closest('label')!.className).toMatch(/active/)
    expect((container.querySelector('input:checked') as HTMLInputElement).value).toBe('60')
  })

  it('calls onChange with the option value', () => {
    const fn = vi.fn()
    const { getByText } = render(
      <SegmentedControl name="slot" ariaLabel="Durée" value={60} onChange={fn} options={opts} />,
    )
    fireEvent.click(getByText('2 horas').closest('label')!.querySelector('input')!)
    expect(fn).toHaveBeenCalledWith(120)
  })
})
