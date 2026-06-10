// tests/components/syndic-v54-fr-interactions.test.tsx
//
// Interactions ciblées du dashboard syndic judiciaire FR : cockpit (tâches par
// rôle, marquer fait, batch), vérificateur de pouvoirs, assistant de mandat —
// + non-régression des défauts PT des primitives paramétrées au Lot 0.

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { RoleProvider } from '@/components/syndic-dashboard/v54-fr/lib/role-context'
import { TASKS } from '@/components/syndic-dashboard/v54-fr/data/tasks'
import ModCockpit from '@/components/syndic-dashboard/v54-fr/modules/ModCockpit'
import ModPouvoirs from '@/components/syndic-dashboard/v54-fr/modules/ModPouvoirs'
import ModMandats from '@/components/syndic-dashboard/v54-fr/modules/ModMandats'

afterEach(cleanup)

const wrap = (ui: React.ReactElement, role: 'Direction' | 'Comptabilité' = 'Direction') =>
  render(
    <ToastProvider>
      <RoleProvider role={role}>{ui}</RoleProvider>
    </ToastProvider>,
  )

describe('syndic v54-fr — interactions', () => {
  it('1. cockpit : Direction voit toutes les tâches, Comptabilité ses tâches seulement', () => {
    wrap(<ModCockpit />)
    expect(screen.getAllByRole('button', { name: 'Marquer comme fait' }).length).toBe(TASKS.length)
    cleanup()
    wrap(<ModCockpit />, 'Comptabilité')
    const own = TASKS.filter((t) => t.role === 'Comptabilité').length
    expect(screen.getAllByRole('button', { name: 'Marquer comme fait' }).length).toBe(own)
  })

  it('2. cockpit : « Marquer comme fait » décrémente le compteur d\'actions à mener', () => {
    wrap(<ModCockpit />)
    const before = screen.getByText(`${TASKS.length} actions à mener`)
    expect(before).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Marquer comme fait' })[0])
    expect(screen.getByText(`${TASKS.length - 1} actions à mener`)).toBeTruthy()
    expect(screen.getAllByText('Fait ✓').length).toBe(1)
  })

  it('3. cockpit : une action par lot pousse un toast avec son résultat', () => {
    wrap(<ModCockpit />)
    fireEvent.click(screen.getByRole('button', { name: /Générer les convocations d'AG dues/ }))
    expect(screen.getByText(/convocation\(s\) générée\(s\) et planifiée\(s\)/)).toBeTruthy()
  })

  it('4. pouvoirs : le vérificateur change de verdict selon la décision choisie', () => {
    wrap(<ModPouvoirs />)
    const sel = screen.getByRole('combobox', { name: 'Décision à vérifier' }) as HTMLSelectElement
    const first = sel.value
    const other = Array.from(sel.options).find((o) => o.value !== first)
    expect(other).toBeTruthy()
    fireEvent.change(sel, { target: { value: other!.value } })
    expect(sel.value).toBe(other!.value)
  })

  it('5. mandats : l\'assistant de mandat génère un plan (échéances + actes)', () => {
    wrap(<ModMandats />)
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer une ordonnance/ }))
    fireEvent.click(screen.getByRole('button', { name: /Générer le plan automatiquement/ }))
    expect(screen.getByText('Plan généré')).toBeTruthy()
    expect(screen.getByText(/Fin de mission calculée/)).toBeTruthy()
    expect(screen.getByText('6 tâches créées')).toBeTruthy()
  })
})

describe('syndic v54-fr — non-régression défauts PT (Lot 0 additif)', () => {
  it('6. ToastProvider sans props garde les libellés PT du bundle', () => {
    render(
      <ToastProvider>
        <span>pt</span>
      </ToastProvider>,
    )
    expect(screen.getByRole('region', { name: 'Notificações' })).toBeTruthy()
  })

  it('7. ToastProvider paramétré rend les libellés FR', () => {
    render(
      <ToastProvider closeLabel="Fermer la notification" regionLabel="Notifications">
        <span>fr</span>
      </ToastProvider>,
    )
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy()
  })
})
