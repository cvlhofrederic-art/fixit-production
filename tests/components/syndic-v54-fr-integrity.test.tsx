// tests/components/syndic-v54-fr-integrity.test.tsx
//
// Intégrité du dashboard syndic judiciaire FR : chaque entrée de la sidebar a
// son module dans le registre (et réciproquement), et la racine rend bien le
// module enregistré (pas le placeholder).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { SIDEBAR_FR, SIDE_TITLES_FR, isItem } from '@/components/syndic-dashboard/v54-fr/shell/sidebar-config'
import { MODULES_FR } from '@/components/syndic-dashboard/v54-fr/modules'
import SyndicDashboardV54FR from '@/components/syndic-dashboard/v54-fr/SyndicDashboardV54FR'

afterEach(cleanup)

const sidebarIds = SIDEBAR_FR.flatMap((s) => s.entries.filter(isItem).map((i) => i.id)).filter((id) => id !== 'logout')

describe('syndic v54-fr — intégrité sidebar ↔ registre', () => {
  it('1. chaque item de la sidebar (hors logout) a un module enregistré', () => {
    const missing = sidebarIds.filter((id) => !MODULES_FR[id])
    expect(missing, `routes sans module : ${missing.join(', ')}`).toEqual([])
  })

  it('2. chaque module enregistré correspond à un item de la sidebar', () => {
    const orphans = Object.keys(MODULES_FR).filter((id) => !sidebarIds.includes(id))
    expect(orphans, `modules orphelins : ${orphans.join(', ')}`).toEqual([])
  })

  it('3. 69 modules enregistrés, ids uniques, titres complets', () => {
    expect(Object.keys(MODULES_FR).length).toBe(69)
    expect(new Set(sidebarIds).size).toBe(sidebarIds.length)
    for (const id of sidebarIds) expect(SIDE_TITLES_FR[id], `titre manquant pour ${id}`).toBeTruthy()
  })

  it('4. la racine rend le cockpit par défaut (module réel, pas le placeholder)', () => {
    render(<SyndicDashboardV54FR />)
    expect(screen.queryByText('Contenu de ce module en cours de portage.')).toBeNull()
    expect(screen.getAllByText(/Aujourd'hui/).length).toBeGreaterThan(0)
  })
})
