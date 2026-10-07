import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModAlertas from '@/components/syndic-dashboard/v54/modules/ModAlertas'
import { SyndicDataContext, type SyndicData } from '@/lib/syndic/v54/data-context'
import { V54LocaleProvider } from '@/lib/syndic/v54/i18n'
import type { Artisan, Immeuble } from '@/components/syndic-dashboard/types'

/** Phase 2 — ModAlertas : alertes dérivées des vraies données (authentifié) vs « tout traité » (preview). */

afterEach(cleanup)

const realData: SyndicData = {
  authenticated: true,
  loading: false,
  missions: [],
  coproprios: [],
  team: [],
  artisans: [
    { id: 'a', nom: 'Costa', metier: 'Canalizador', rcProValide: false, decennaleValide: true, statut: 'actif', vitfixCertifie: false, note: 4, nbInterventions: 0, telephone: '', email: '' } as unknown as Artisan,
  ],
  immeubles: [
    { id: 'i', nom: 'Edifício Sem Regulamento', nbLots: 1, anneeConstruction: 2000, nbInterventions: 0, budgetAnnuel: 0, depensesAnnee: 0 } as unknown as Immeuble,
  ],
}

describe('ModAlertas (Phase 2)', () => {
  it('affiche « tout traité » par défaut (preview)', () => {
    render(<ModAlertas />)
    expect(screen.getByText('Todos os alertas foram tratados!')).toBeInTheDocument()
    cleanup()
  })

  it('dérive les alertes des vraies données (RC invalide + regulamento em falta)', () => {
    render(
      <SyndicDataContext.Provider value={realData}>
        <ModAlertas />
      </SyndicDataContext.Provider>,
    )
    expect(screen.getByText('Seguro RC Pro inválido ou em falta')).toBeInTheDocument()
    expect(screen.getByText('Regulamento de condomínio em falta')).toBeInTheDocument()
    expect(screen.queryByText('Todos os alertas foram tratados!')).toBeNull()
    cleanup()
  })
})

describe('ModAlertas — nom du prestataire (colonne nom = « Prénom Nom »)', () => {
  /** Artisan sans RC ni décennale, nom tel que l'écrit POST /api/syndic/artisans. */
  const sansAssurances = (nom: string, prenom: string, nomFamille: string): SyndicData => ({
    ...realData,
    immeubles: [],
    artisans: [{ ...realData.artisans[0], nom, prenom, nom_famille: nomFamille, rcProValide: false, decennaleValide: false }],
  })

  it('PT : « João Silva » sous les alertas Seguro RC et decenal, sans prénom doublé', () => {
    render(<SyndicDataContext.Provider value={sansAssurances('João Silva', 'João', 'Silva')}><ModAlertas /></SyndicDataContext.Provider>)
    expect(screen.getByText('Seguro RC Pro inválido ou em falta')).toBeInTheDocument()
    expect(screen.getByText('Garantia decenal em falta')).toBeInTheDocument()
    expect(screen.getAllByText('João Silva')).toHaveLength(2)
    expect(screen.queryByText(/João João/)).toBeNull()
  })

  it('FR : « Jean Dupont » sous les alertes RC Pro et décennale, sans prénom doublé', () => {
    render(
      <V54LocaleProvider locale="fr-FR">
        <SyndicDataContext.Provider value={sansAssurances('Jean Dupont', 'Jean', 'Dupont')}><ModAlertas /></SyndicDataContext.Provider>
      </V54LocaleProvider>,
    )
    expect(screen.getByText('Assurance RC Pro invalide ou manquante')).toBeInTheDocument()
    expect(screen.getByText('Assurance décennale manquante')).toBeInTheDocument()
    expect(screen.getAllByText('Jean Dupont')).toHaveLength(2)
    expect(screen.queryByText(/Jean Jean/)).toBeNull()
  })
})
