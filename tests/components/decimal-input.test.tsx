import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { DecimalInput } from '@/components/common/DecimalInput'

// Audit 2026-06-10 (Vague 4) — DecimalInput extrait + partagé artisan/BTP, avec
// select() au focus harmonisé (autorisé par Frédéric). fireEvent (pas E2E) car
// l'hydratation clavier n'est fiable qu'en build prod (cf. .claude/rules/testing.md).

const fmt = (n: number) => (n ? n.toFixed(2).replace('.', ',') : '')
const parse = (s: string) => parseFloat(s.replace(',', '.')) || 0

afterEach(() => cleanup())

describe('DecimalInput', () => {
  it('affiche la valeur formatée FR au repos', () => {
    const { getByRole } = render(<DecimalInput value={90.91} onChangeNumber={() => {}} format={fmt} parse={parse} />)
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('90,91')
  })

  it('sélectionne le contenu au focus (UX harmonisée)', () => {
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, 'select')
    const { getByRole } = render(<DecimalInput value={10} onChangeNumber={() => {}} format={fmt} parse={parse} />)
    fireEvent.focus(getByRole('textbox'))
    expect(selectSpy).toHaveBeenCalledTimes(1)
    selectSpy.mockRestore()
  })

  it('tolère la virgule en cours de frappe et notifie le nombre parsé', () => {
    const onChange = vi.fn()
    const { getByRole } = render(<DecimalInput value={0} onChangeNumber={onChange} format={fmt} parse={parse} />)
    const input = getByRole('textbox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '90,' } })
    expect(input.value).toBe('90,')          // virgule conservée (buffer raw)
    expect(onChange).toHaveBeenLastCalledWith(90) // parse en parallèle
  })

  it('reprend le rendu formaté au blur', () => {
    const { getByRole } = render(<DecimalInput value={5} onChangeNumber={() => {}} format={fmt} parse={parse} />)
    const input = getByRole('textbox') as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '7,5' } })
    fireEvent.blur(input)
    expect(input.value).toBe('5,00') // raw libéré → format(value) (value prop inchangé ici)
  })

  it('transmet onFocus/onBlur optionnels (rétro-compat artisan)', () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    const { getByRole } = render(<DecimalInput value={1} onChangeNumber={() => {}} format={fmt} parse={parse} onFocus={onFocus} onBlur={onBlur} />)
    const input = getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})
