// tests/components/btp-devis-chantier.test.tsx
//
// Rattachement d'un devis ou d'une facture BTP à un chantier (colonne `chantier_id`, migration 060).
//
// Tout existait déjà dans le dépôt — la colonne pour les devis ET les factures, la validation Zod, l'écriture
// dans /api/devis/sync, la lecture, le calcul d'imputation de l'écran Rentabilité, et le sélecteur
// `ChantierSelect` employé par trois autres écrans BTP. Il manquait trois maillons, dont un défaut qui vivait
// en production : `buildPayload` du formulaire BTP est une liste EXPLICITE de champs, et `chantierId` n'y était
// pas. Comme l'upsert de la route écrit la ligne entière, un devis rattaché depuis l'écran Chantiers
// (`linkDevis`) était SILENCIEUSEMENT délié dès qu'on le rouvrait et l'enregistrait — et le CA par chantier,
// qui n'impute que les documents rattachés, restait à 0 €.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const h = vi.hoisted(() => ({ chantiers: [] as unknown[], appels: [] as Record<string, unknown>[] }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: vi.fn().mockResolvedValue({ ok: false, status: 403 }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

// La liste des chantiers vient de la base. On simule le hook plutôt que le réseau : `ChantierSelect`, lui, est
// le VRAI composant — c'est tout l'intérêt, puisqu'on veut prouver que le formulaire le pose et le lit.
vi.mock('@/lib/hooks/use-btp-data', () => ({
  useBTPData: (options: { table: string }) => {
    h.appels.push(options as Record<string, unknown>)
    return { items: options.table === 'chantiers' ? h.chantiers : [], loading: false, error: null }
  },
  signalerPlafondsAtteints: () => {},
  signalerChargementImpossible: () => {},
}))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const ARTISAN = {
  id: 'fiche-societe', user_id: 'compte-gerant', company_name: 'BATIR TEST SAS',
} as unknown as ArtisanBasic

const CH_A = { id: 'ch-a', titre: 'Ravalement Les Acacias', client: 'SCI Les Tilleuls' }
const CH_B = { id: 'ch-b', titre: 'Toiture Les Lilas', client: 'SCI Les Tilleuls' }

function monter(initialData?: Record<string, unknown>, onSave = vi.fn()) {
  const rendu = render(
    <DevisFactureFormBTP
      artisan={ARTISAN}
      services={[]}
      bookings={[]}
      initialDocType="devis"
      initialData={initialData as never}
      onBack={vi.fn()}
      onSave={onSave}
    />,
  )
  return { ...rendu, onSave }
}

/** Le sélecteur de chantier, trouvé par son nom accessible. */
const selecteur = () => screen.getByRole('combobox', { name: 'Chantier' }) as HTMLSelectElement

beforeEach(() => {
  h.chantiers = [CH_A, CH_B]
  h.appels = []
  localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formulaire BTP — rattachement à un chantier', () => {
  it('le sélecteur propose les chantiers de la société, avec leur client', () => {
    monter()
    const options = [...selecteur().options].map((o) => o.textContent)
    expect(options).toEqual([
      'Sélectionner un chantier...',
      'Ravalement Les Acacias — SCI Les Tilleuls',
      'Toiture Les Lilas — SCI Les Tilleuls',
    ])
  })

  it('ce champ ne doit ni écrire en base ni alerter au milieu d\'une saisie', () => {
    // Deux options passées au hook, pour deux raisons distinctes.
    //
    // `autoImport: false` : par défaut, `useBTPData` peut envoyer un POST d'import des anciens chantiers du
    // navigateur vers la base. Un formulaire de document ne doit que LIRE.
    //
    // `annoncerEchecs: false` : par défaut, un échec de chargement affiche un toast rouge « les données n'ont
    // pas pu être chargées ». Au milieu de la saisie d'un devis, l'utilisateur le lit « mon devis ne s'est pas
    // chargé » et risque de recommencer une saisie qui n'a rien perdu. Les écrans dont les chantiers SONT le
    // sujet gardent l'alerte. L'option vient de la PR #850 ; ce champ est le premier à en avoir besoin.
    monter()
    const chantiers = h.appels.filter((a) => a.table === 'chantiers')
    expect(chantiers.length).toBeGreaterThan(0)
    for (const appel of chantiers) {
      expect(appel.autoImport).toBe(false)
      expect(appel.annoncerEchecs).toBe(false)
    }
  })

  it('un document déjà rattaché rouvre sur SON chantier', () => {
    // L'état est initialisé depuis `initialData` : sans cela, rouvrir un devis rattaché afficherait
    // « Sélectionner un chantier... », et l'enregistrement effacerait la liaison.
    monter({ chantierId: 'ch-b' })
    expect(selecteur().value).toBe('ch-b')
  })

  it('aucun chantier : le sélecteur reste vide, sans erreur', () => {
    h.chantiers = []
    monter()
    expect([...selecteur().options].map((o) => o.value)).toEqual([''])
  })

  it('LE DÉFAUT CENTRAL : le rattachement survit à l\'enregistrement', async () => {
    // `buildPayload` est une liste explicite de champs. Tant que `chantierId` n'y était pas, l'enregistrement
    // renvoyait un document SANS chantier, et l'upsert de /api/devis/sync — qui écrit la ligne entière —
    // effaçait la liaison posée depuis l'écran Chantiers.
    const { onSave } = monter({ chantierId: 'ch-a', docTitle: 'Ravalement' })
    fireEvent.click(screen.getByText('Enregistrer brouillon'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const enregistre = onSave.mock.calls[0][0] as { chantierId?: string }
    expect(enregistre.chantierId).toBe('ch-a')
  })

  it('choisir un chantier le place dans le document enregistré', async () => {
    const { onSave } = monter({ docTitle: 'Toiture' })
    fireEvent.change(selecteur(), { target: { value: 'ch-b' } })
    expect(selecteur().value).toBe('ch-b')
    fireEvent.click(screen.getByText('Enregistrer brouillon'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect((onSave.mock.calls[0][0] as { chantierId?: string }).chantierId).toBe('ch-b')
  })

  it('le choix vide délie, sans laisser l\'ancien chantier', async () => {
    const { onSave } = monter({ chantierId: 'ch-a', docTitle: 'Ravalement' })
    fireEvent.change(selecteur(), { target: { value: '' } })
    fireEvent.click(screen.getByText('Enregistrer brouillon'))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    // A CHANGÉ DE SENS après la relecture adverse : ce cas FIGEAIT le bloquant. Il affirmait que la clé était
    // absente — donc que la route ne touchait pas la colonne, donc que « Sélectionner un chantier… » ne déliait
    // RIEN. Or aucun autre écran ne sait délier, et la clé étrangère sans ON DELETE rend le chantier impossible à
    // supprimer : un mauvais rattachement était définitif. La chaîne vide part maintenant telle quelle, et la
    // route la traduit en `chantier_id: null`.
    expect((onSave.mock.calls[0][0] as { chantierId?: string }).chantierId).toBe('')
  })
})
