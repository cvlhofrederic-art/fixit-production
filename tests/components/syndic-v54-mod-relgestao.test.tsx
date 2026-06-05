// tests/components/syndic-v54-mod-relgestao.test.tsx
//
// Module d19 : ModRelGestao (Alert + formulaire période + aperçu PDF).

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import ModRelGestao from '@/components/syndic-dashboard/v54/modules/ModRelGestao'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import type { Mission, Immeuble } from '@/components/syndic-dashboard/types'

afterEach(cleanup)

describe('syndic v54 — ModRelGestao', () => {
  it('rend titre, formulaire période et aperçu', () => {
    render(<ModRelGestao />)
    expect(screen.getByRole('heading', { name: 'Relatório de Gestão' })).toBeTruthy()
    expect(screen.getByText('Dados do período — Abril 2026')).toBeTruthy()
    expect(screen.getByLabelText('Edifícios geridos')).toBeTruthy()
    expect(screen.getByLabelText('Observações')).toBeTruthy()
    expect(screen.getByText('Preencha os dados acima para gerar o relatório de gestão de Abril 2026')).toBeTruthy()
  })
})

// ── Phase 3 : agrégats réels (lecture seule) depuis immeubles + missions ──
const base = (): SyndicData => ({
  authenticated: true, loading: false, missions: [], immeubles: [], artisans: [], team: [], coproprios: [], contratos: [], seguros: [], signalements: [], elevadores: [], sinistros: [], vistorias: [], prazos: [], avisos: [], reembolsos: [], procuracoes: [], segEdificios: [], caderneta: [], certificados: [], declaracoes: [], fcrEdificios: [], fcrMovimentos: [], assembleias: [], contab: { fracoes: [], chamadas: [], diario: [], orcamentos: [] }, impayes: [], recouvrements: [], faturas: [],
})
const imm = (over: Partial<Immeuble>): Immeuble => ({
  id: 'b1', nom: 'EDIF', adresse: '', ville: 'Porto', codePostal: '4000', nbLots: 10,
  anneeConstruction: 2000, typeImmeuble: 'habitacional', gestionnaire: '', nbInterventions: 0,
  budgetAnnuel: 10000, depensesAnnee: 5000, ...over,
})
const mission = (over: Partial<Mission>): Mission => ({
  id: 'm1', immeuble: 'EDIF', artisan: '', type: 'X', description: '',
  priorite: 'normale', statut: 'terminee', dateCreation: '2026-01-01', montantFacture: 1000, ...over,
})

describe('syndic v54 — ModRelGestao (Phase 3)', () => {
  it('anonyme : champs à zéro', () => {
    render(<ModRelGestao />)
    expect((screen.getByLabelText('Edifícios geridos') as HTMLInputElement).value).toBe('0')
  })

  it('pré-remplit le formulaire et le preview avec les agrégats réels', () => {
    const d: SyndicData = {
      ...base(),
      immeubles: [imm({ id: 'a' }), imm({ id: 'b' })], // 2 édifices · budget 20000 · dépenses 10000 → 50%
      missions: [mission({ id: 'm1', montantFacture: 1000 }), mission({ id: 'm2', montantFacture: 1000 })], // montant 2000
    }
    render(<SyndicDataContext.Provider value={d}><ModRelGestao /></SyndicDataContext.Provider>)
    expect((screen.getByLabelText('Edifícios geridos') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('Orçamento anual (€)') as HTMLInputElement).value).toBe('20000')
    expect((screen.getByLabelText('Despesas do ano (€)') as HTMLInputElement).value).toBe('10000')
    expect((screen.getByLabelText('Montante obras (€)') as HTMLInputElement).value).toBe('2000')
    expect((screen.getByLabelText('Orçamento consumido') as HTMLInputElement).value).toBe('50%')
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0) // preview STAT
    cleanup()
  })
})
