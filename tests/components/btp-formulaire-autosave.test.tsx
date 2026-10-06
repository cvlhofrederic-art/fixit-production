// tests/components/btp-formulaire-autosave.test.tsx
//
// Non-régression du « formulaire qui se vide » côté BTP. L'enregistrement automatique du
// formulaire BTP appelle onSave 1,5 s après l'ouverture d'un brouillon. Les écrans Devis et
// Factures remettaient alors convertingDevis à null : la key du formulaire changeait, React le
// remontait vide (« Facturer » → facture pré-remplie puis effacée, brouillon impossible à
// rouvrir). onSave ne doit plus refermer le document ouvert ; il en garde la dernière version
// enregistrée, pour qu'un remontage ultérieur (retour arrière du navigateur) ne réaffiche pas
// puis ne réenregistre pas l'ancienne.

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({ useThemeVars: () => ({}) }))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: 'pro_societe', isV5: true, useBtpDesign: true }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => 'tid') } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))

// Faux formulaire BTP : compte ses montages et rejoue l'enregistrement automatique (onSave
// appelé après le montage avec le document enregistré, comme saveDraft en mode silencieux).
// Au premier montage, l'utilisateur a modifié le titre avant l'enregistrement.
const montages = vi.fn()
vi.mock('@/components/DevisFactureFormBTP', () => {
  function FauxFormulaireBTP(p: { initialData?: { id?: string; docTitle?: string } | null; onSave?: (d: unknown) => void }) {
    React.useEffect(() => {
      montages(p.initialData?.docTitle ?? null)
      const titre = p.initialData?.docTitle === 'Rénovation appartement' ? 'Rénovation appartement (modifié)' : p.initialData?.docTitle
      const minuterie = setTimeout(() => p.onSave?.({ ...p.initialData, docTitle: titre }), 10)
      return () => clearTimeout(minuterie)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <div data-testid="formulaire-btp">{p.initialData?.docTitle ?? 'formulaire vide'}</div>
  }
  return { default: FauxFormulaireBTP }
})

import DevisSection from '@/components/dashboard/DevisSection'
import FacturesSection from '@/components/dashboard/FacturesSection'

const ARTISAN = { id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '' }

const BROUILLON_FACTURE = {
  id: '6f1c2a34-0000-4000-8000-0000000000f1', docType: 'facture', docNumber: '', status: 'brouillon',
  docTitle: 'Rénovation appartement', clientName: 'A & W SAS', sourceDevisNumber: 'DEV-2026-009',
  lines: [{ id: 1, description: 'Rénovation', qty: 1, priceHT: 10000, tvaRate: 20, totalHT: 10000 }],
}
const BROUILLON_DEVIS = { ...BROUILLON_FACTURE, id: '6f1c2a34-0000-4000-8000-0000000000d1', docType: 'devis' }

/**
 * Hôte minimal : tient convertingDevis comme la page du tableau de bord, et peut démonter puis
 * remonter l'écran (changement de page puis retour par l'historique du navigateur).
 */
function Hote({ ecran }: { ecran: 'factures' | 'devis' }) {
  const [document, setDocument] = React.useState<Record<string, unknown> | null>(ecran === 'factures' ? BROUILLON_FACTURE : BROUILLON_DEVIS)
  const [documents, setDocuments] = React.useState<unknown[]>([])
  const [affiche, setAffiche] = React.useState(true)
  const communs = { artisan: ARTISAN, services: [], bookings: [], savedDocuments: documents, setSavedDocuments: setDocuments, convertingDevis: document, setConvertingDevis: setDocument }
  return (
    <>
      <button onClick={() => setAffiche((v) => !v)}>changer de page</button>
      {affiche && (ecran === 'factures'
        ? <FacturesSection {...(communs as unknown as Parameters<typeof FacturesSection>[0])} showFactureForm setShowFactureForm={vi.fn()} openFactureForm={vi.fn()} />
        : <DevisSection {...(communs as unknown as Parameters<typeof DevisSection>[0])} showDevisForm setShowDevisForm={vi.fn()} openDevisForm={vi.fn()} convertDevisToFacture={vi.fn()} />)}
    </>
  )
}

describe('formulaire BTP — l\'enregistrement automatique ne vide plus le document ouvert', () => {
  beforeEach(() => { localStorage.clear(); montages.mockClear(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it.each(['factures', 'devis'] as const)('écran %s : le brouillon reste affiché après onSave, sans remontage', (ecran) => {
    render(<Hote ecran={ecran} />)
    expect(screen.getByTestId('formulaire-btp')).toHaveTextContent('Rénovation appartement')
    act(() => { vi.advanceTimersByTime(50) }) // l'enregistrement automatique appelle onSave
    expect(screen.getByTestId('formulaire-btp')).toBeInTheDocument()
    expect(montages).toHaveBeenCalledTimes(1)
    expect(montages).toHaveBeenCalledWith('Rénovation appartement')
  })

  it.each(['factures', 'devis'] as const)('écran %s : après un changement de page, le formulaire rouvre la dernière version enregistrée', (ecran) => {
    render(<Hote ecran={ecran} />)
    act(() => { vi.advanceTimersByTime(50) }) // version modifiée enregistrée
    fireEvent.click(screen.getByText('changer de page')) // l'écran est démonté
    expect(screen.queryByTestId('formulaire-btp')).toBeNull()
    fireEvent.click(screen.getByText('changer de page')) // retour : remontage
    expect(screen.getByTestId('formulaire-btp')).toHaveTextContent('Rénovation appartement (modifié)')
    expect(montages).toHaveBeenLastCalledWith('Rénovation appartement (modifié)')
  })
})
