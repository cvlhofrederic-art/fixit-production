// Listes Devis et Factures V5 (BTP pro_societe ET artisan, demande du 11/11/2026) :
//  - recherche dans tout ce qui est relié au document (client, objet, chantier, rue, lignes, devis d'origine…),
//    avec l'indice « trouvé dans… » quand le champ n'est pas une colonne de la liste ;
//  - cases à cocher (une par ligne, « tout sélectionner » en tête, Maj + clic pour une plage) ;
//  - « Tout télécharger (N) » (documents affichés) ou « Télécharger la sélection (k) », avec le modèle de PDF
//    du rôle (V3 pour le BTP, V2 pour l'artisan).
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react'

const role = vi.hoisted(() => ({ orgRole: 'pro_societe' as 'pro_societe' | 'artisan' }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/components/dashboard/useThemeVars', () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
  }),
}))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  useOrgRoleContext: () => ({ orgRole: role.orgRole, isV5: true, useBtpDesign: role.orgRole === 'pro_societe' }),
}))
vi.mock('@/components/DevisFactureForm', () => ({ default: () => null }))
vi.mock('@/components/DevisFactureFormBTP', () => ({ default: () => null }))
vi.mock('@/components/DocumentCancelModal', () => ({ default: () => null }))
vi.mock('@/components/ConfirmDraftDeleteDialog', () => ({ default: () => null }))
vi.mock('@/lib/pdf/download-saved-devis', () => ({ downloadSavedDevis: vi.fn(), produireFichierDocument: vi.fn() }))
vi.mock('@/lib/pdf/telechargement-groupe', () => ({
  telechargerDocumentsGroupes: vi.fn(async (docs: unknown[]) => ({
    telecharges: docs.length, echecs: [], raison: null, archive: docs.length > 1 ? 'archive.zip' : null,
  })),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn(() => 'tid') } }))

import DevisSection from '@/components/dashboard/DevisSection'
import FacturesSection from '@/components/dashboard/FacturesSection'
import { telechargerDocumentsGroupes } from '@/lib/pdf/telechargement-groupe'
import { toast } from 'sonner'

const ARTISAN = { id: 'art-1', user_id: 'u-1', company_name: 'SUD TRAVAUX', email: 's@test.fr', phone: '', bio: '' }
const ligne = (description: string, totalHT = 1000) => ({ id: 1, description, qty: 1, priceHT: totalHT, tvaRate: 20, totalHT })

// Trois devis, numéros croissants (la liste les affiche du plus récent au plus ancien : 003, 002, 001).
const DEVIS_1 = {
  id: 'd1', docType: 'devis', docNumber: 'DEV-2026-001', status: 'envoye', docDate: '2026-09-02',
  clientName: 'Jean Dupont', docTitle: 'Salle de bains', interventionAddress: '12 rue de la Paix, 42000 Saint-Étienne',
  lines: [ligne('Pose carrelage 30x60')],
}
const DEVIS_2 = {
  id: 'd2', docType: 'devis', docNumber: 'DEV-2026-002', status: 'envoye', docDate: '2026-10-05',
  clientName: 'SCI Martin', docTitle: 'Ravalement', clientCity: 'Lyon', clientStreet: '8 avenue Foch',
  lines: [ligne('Nettoyage façade', 3400)],
}
const DEVIS_3 = {
  id: 'd3', docType: 'devis', docNumber: 'DEV-2026-003', status: 'brouillon', docDate: '2026-11-03',
  clientName: 'Mme Bernard', docTitle: 'Cuisine', interventionAddress: '4 place Bellecour, Lyon',
  lines: [ligne('Plan de travail chêne', 900)],
}
const TOUS_DEVIS = [DEVIS_1, DEVIS_2, DEVIS_3]

const FACTURE = {
  id: 'f1', docType: 'facture', docNumber: 'FACT-2026-040', status: 'pending', sentAt: '2026-10-20T09:00:00.000Z',
  clientName: 'SCI Martin', docTitle: 'Ravalement', sourceDevisNumber: 'DEV-2026-002', tvaEnabled: true,
  lines: [ligne('Nettoyage façade')],
}
const ACOMPTE = {
  id: 'a1', docType: 'facture', docNumber: 'AC-2026-007', status: 'pending', sentAt: '2026-10-25T09:00:00.000Z',
  factureSubType: 'acompte', parentInvoiceNumber: 'DEV-2026-001', clientName: 'Jean Dupont', tvaEnabled: true,
  lines: [ligne('Acompte 30 %', 300)],
}

function propsDevis(savedDocuments: object[] = TOUS_DEVIS) {
  return {
    artisan: ARTISAN, services: [], bookings: [], savedDocuments, setSavedDocuments: vi.fn(),
    showDevisForm: false, setShowDevisForm: vi.fn(), convertingDevis: null, setConvertingDevis: vi.fn(),
    openDevisForm: vi.fn(), convertDevisToFacture: vi.fn(),
  } as unknown as Parameters<typeof DevisSection>[0]
}
function propsFactures(savedDocuments: object[] = [FACTURE, ACOMPTE]) {
  return {
    artisan: ARTISAN, services: [], bookings: [], savedDocuments, setSavedDocuments: vi.fn(),
    showFactureForm: false, setShowFactureForm: vi.fn(), convertingDevis: null, setConvertingDevis: vi.fn(),
    openFactureForm: vi.fn(),
  } as unknown as Parameters<typeof FacturesSection>[0]
}

const T = 'proDash.documentsListe'
// Métacaractères échappés avant new RegExp (le « . » de la clé de traduction).
const echapper = (texte: string) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const T_REGEX = echapper(T)
const rechercherDevis = (texte: string) =>
  fireEvent.change(screen.getByPlaceholderText('proDash.devis.rechercher'), { target: { value: texte } })
const numerosAffiches = () =>
  screen.queryAllByRole('checkbox', { name: new RegExp(`^${T_REGEX}\\.selectionner `) })
    .map(c => (c.getAttribute('aria-label') || '').replace(`${T}.selectionner `, ''))
const caseDe = (numero: string) => screen.getByRole('checkbox', { name: `${T}.selectionner ${numero}` })
const telechargementAppele = () => vi.mocked(telechargerDocumentsGroupes).mock.calls

beforeEach(() => {
  role.orgRole = 'pro_societe'
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => { cleanup() })

describe('Liste Devis V5 — recherche dans tout ce qui est relié au devis', () => {
  it('par la rue du chantier, avec l\'indice « Chantier : … » (colonne absente de la liste)', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('rue de la paix')
    expect(numerosAffiches()).toEqual(['DEV-2026-001'])
    expect(screen.getByText(`${T}.champs.chantier : 12 rue de la Paix, 42000 Saint-Étienne`)).toBeInTheDocument()
  })

  it('plusieurs mots dans des champs différents (client + ville) ; sans accents', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('martin lyon')
    expect(numerosAffiches()).toEqual(['DEV-2026-002'])
    rechercherDevis('saint etienne')
    expect(numerosAffiches()).toEqual(['DEV-2026-001'])
  })

  it('par une ligne du devis, avec l\'indice « Ligne : … »', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('chene')
    expect(numerosAffiches()).toEqual(['DEV-2026-003'])
    expect(screen.getByText(`${T}.champs.lignes : Plan de travail chêne`)).toBeInTheDocument()
  })

  it('par le client (colonne affichée) : pas d\'indice', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('bernard')
    expect(numerosAffiches()).toEqual(['DEV-2026-003'])
    expect(screen.queryByText(new RegExp(`${T_REGEX}\\.champs\\.`))).not.toBeInTheDocument()
  })

  it('rien trouvé : le message habituel', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('introuvable')
    expect(numerosAffiches()).toEqual([])
    expect(screen.getByText('proDash.devis.aucunDevisTrouve')).toBeInTheDocument()
  })
})

describe('Liste Devis V5 — sélection et téléchargement groupé (BTP)', () => {
  it('« Tout télécharger (3) » : les devis affichés, dans l\'ordre de la liste, modèle BTP', async () => {
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    const [docs, ctx, options] = telechargementAppele()[0]
    expect(docs).toEqual([DEVIS_3, DEVIS_2, DEVIS_1])
    expect(ctx.useBtpDesign).toBe(true)
    expect(ctx.artisan).toEqual({ id: 'art-1', company_name: 'SUD TRAVAUX', logo_url: null, rm: null, rc_pro: null })
    expect(options.nomArchive).toMatch(new RegExp(`^${T_REGEX}\\.archiveDevis_\\d{4}-\\d{2}-\\d{2}$`))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`3 ${T}.telecharges (archive.zip)`))
  })

  it('après une recherche, « Tout télécharger » ne prend que les résultats', async () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('lyon')
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (2)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([DEVIS_3, DEVIS_2])
  })

  it('cases cochées : « Télécharger la sélection (2) », puis la sélection est vidée', async () => {
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-001'))
    fireEvent.click(caseDe('DEV-2026-003'))
    expect(caseDe('DEV-2026-001')).toBeChecked()
    expect(caseDe('DEV-2026-002')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (2)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([DEVIS_1, DEVIS_3])
    await waitFor(() => expect(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` })).toBeInTheDocument())
    expect(caseDe('DEV-2026-001')).not.toBeChecked()
  })

  it('« Tout sélectionner » coche les devis affichés ; un second clic les décoche', () => {
    render(<DevisSection {...propsDevis()} />)
    const entete = screen.getByRole('checkbox', { name: `${T}.toutSelectionner` })
    fireEvent.click(entete)
    expect(screen.getByRole('button', { name: `${T}.telechargerSelection (3)` })).toBeInTheDocument()
    expect(entete).toBeChecked()
    fireEvent.click(entete)
    expect(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` })).toBeInTheDocument()
  })

  it('« Tout sélectionner » pendant une recherche : seulement les résultats ; en-tête « partiel » ensuite', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('lyon')
    fireEvent.click(screen.getByRole('checkbox', { name: `${T}.toutSelectionner` }))
    rechercherDevis('')
    expect(numerosAffiches()).toHaveLength(3)
    expect(caseDe('DEV-2026-001')).not.toBeChecked()
    expect(caseDe('DEV-2026-002')).toBeChecked()
    const entete = screen.getByRole('checkbox', { name: `${T}.toutSelectionner` }) as HTMLInputElement
    expect(entete.checked).toBe(false)
    expect(entete.indeterminate).toBe(true)
  })

  it('la sélection survit à la recherche : on coche dans plusieurs recherches', async () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('dupont')
    fireEvent.click(caseDe('DEV-2026-001'))
    rechercherDevis('martin')
    fireEvent.click(caseDe('DEV-2026-002'))
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (2)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([DEVIS_1, DEVIS_2])
  })

  it('Maj + clic coche toute la plage depuis la case précédente', () => {
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-003'))
    fireEvent.click(caseDe('DEV-2026-001'), { shiftKey: true })
    expect(screen.getByRole('button', { name: `${T}.telechargerSelection (3)` })).toBeInTheDocument()
  })

  it('« Désélectionner » vide la sélection', () => {
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-002'))
    fireEvent.click(screen.getByRole('button', { name: `${T}.deselectionner` }))
    expect(caseDe('DEV-2026-002')).not.toBeChecked()
    expect(screen.queryByRole('button', { name: `${T}.deselectionner` })).not.toBeInTheDocument()
  })

  it('un document en échec : signalé, la sélection reste pour réessayer', async () => {
    vi.mocked(telechargerDocumentsGroupes).mockResolvedValueOnce({ telecharges: 1, echecs: ['DEV-2026-002'], raison: 'jsPDF', archive: 'archive.zip' })
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-001'))
    fireEvent.click(caseDe('DEV-2026-002'))
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (2)` }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${T}.unTelecharge. ${T}.echecsPartiels DEV-2026-002 — jsPDF`))
    expect(caseDe('DEV-2026-001')).toBeChecked()
  })

  it('beaucoup d\'échecs : cinq numéros au plus dans le message, puis « et N autres »', async () => {
    const echecs = ['D-1', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7']
    vi.mocked(telechargerDocumentsGroupes)
      .mockResolvedValueOnce({ telecharges: 2, echecs, raison: null, archive: 'archive.zip' })
      .mockResolvedValueOnce({ telecharges: 2, echecs: echecs.slice(0, 6), raison: null, archive: 'archive.zip' })
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`2 ${T}.telecharges. ${T}.echecsPartiels D-1, D-2, D-3, D-4, D-5 ${T}.etAutres`))
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`2 ${T}.telecharges. ${T}.echecsPartiels D-1, D-2, D-3, D-4, D-5 ${T}.etUnAutre`))
  })

  it('aucun PDF produit : la raison du générateur est affichée ; sans raison, « Réessayez »', async () => {
    vi.mocked(telechargerDocumentsGroupes)
      .mockResolvedValueOnce({ telecharges: 0, echecs: ['DEV-2026-001'], raison: 'Assurance RC Pro obligatoire', archive: null })
      .mockResolvedValueOnce({ telecharges: 0, echecs: ['DEV-2026-001'], raison: null, archive: null })
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${T}.aucunPdf — Assurance RC Pro obligatoire`))
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (3)` }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`${T}.aucunPdf. ${T}.reessayez`))
  })

  it('aucun devis : le bouton est désactivé', () => {
    render(<DevisSection {...propsDevis([])} />)
    expect(screen.getByRole('button', { name: `${T}.toutTelecharger (0)` })).toBeDisabled()
  })
})

describe('Liste Devis V5 — filtre par statut, montant, annulation', () => {
  const puce = (cle: string, nombre: number) => screen.getByRole('button', { name: `${T}.filtresDevis.${cle} (${nombre})` })

  it('puces Tous / Brouillons / Envoyés / Acceptés / Refusés, comptées sur toute la liste', () => {
    render(<DevisSection {...propsDevis()} />)
    expect(puce('tous', 3)).toHaveAttribute('aria-pressed', 'true')
    expect(puce('brouillons', 1)).toHaveAttribute('aria-pressed', 'false')
    expect(puce('envoyes', 2)).toBeInTheDocument()
    expect(puce('acceptes', 0)).toBeInTheDocument()
    expect(puce('refuses', 0)).toBeInTheDocument()
  })

  it('« Envoyés » : la liste et « Tout télécharger » ne prennent que les devis envoyés', async () => {
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(puce('envoyes', 2))
    expect(numerosAffiches()).toEqual(['DEV-2026-002', 'DEV-2026-001'])
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (2)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([DEVIS_2, DEVIS_1])
  })

  it('un devis signé compte comme accepté ; filtre sans résultat : « aucun devis trouvé »', () => {
    render(<DevisSection {...propsDevis([...TOUS_DEVIS, { ...DEVIS_1, id: 'd4', docNumber: 'DEV-2026-004', status: 'signed' }])} />)
    fireEvent.click(puce('acceptes', 1))
    expect(numerosAffiches()).toEqual(['DEV-2026-004'])
    fireEvent.click(puce('refuses', 0))
    expect(numerosAffiches()).toEqual([])
    expect(screen.getByText('proDash.devis.aucunDevisTrouve')).toBeInTheDocument()
  })

  it('montant HT affiché : « 3400 » et « 3 400 » trouvent le devis', () => {
    render(<DevisSection {...propsDevis()} />)
    rechercherDevis('3400')
    expect(numerosAffiches()).toEqual(['DEV-2026-002'])
    rechercherDevis('3 400')
    expect(numerosAffiches()).toEqual(['DEV-2026-002'])
  })

  it('« Annuler » pendant la préparation : demande transmise, rien ne part, la sélection reste', async () => {
    let terminer: (resultat: Awaited<ReturnType<typeof telechargerDocumentsGroupes>>) => void = () => undefined
    let estAnnule: (() => boolean) | undefined
    vi.mocked(telechargerDocumentsGroupes).mockImplementationOnce((_docs, _ctx, options) => new Promise(resolve => {
      estAnnule = options.estAnnule
      options.onProgression?.(1, 2)
      terminer = resolve
    }))
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-001'))
    fireEvent.click(caseDe('DEV-2026-002'))
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (2)` }))
    expect(screen.getByRole('button', { name: `${T}.preparation 1/2` })).toBeDisabled()
    expect(estAnnule?.()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: `${T}.annuler` }))
    expect(estAnnule?.()).toBe(true)
    await act(async () => { terminer({ telecharges: 0, echecs: [], raison: null, archive: null, annule: true }) })
    expect(toast.info).toHaveBeenCalledWith(`${T}.annule`)
    expect(toast.success).not.toHaveBeenCalled()
    expect(caseDe('DEV-2026-001')).toBeChecked()
    expect(screen.queryByRole('button', { name: `${T}.annuler` })).not.toBeInTheDocument()
  })
})

describe('Liste Devis V5 — artisan', () => {
  it('téléchargement groupé avec le modèle artisan (V2)', async () => {
    role.orgRole = 'artisan'
    render(<DevisSection {...propsDevis()} />)
    fireEvent.click(caseDe('DEV-2026-002'))
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (1)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([DEVIS_2])
    expect(telechargementAppele()[0][1].useBtpDesign).toBe(false)
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${T}.unTelecharge`))
  })
})

describe('Liste Factures V5', () => {
  it('par le devis d\'origine : la facture et l\'indice « Document lié »', () => {
    render(<FacturesSection {...propsFactures()} />)
    fireEvent.change(screen.getByPlaceholderText('proDash.factures.rechercher'), { target: { value: 'DEV-2026-002' } })
    expect(numerosAffiches()).toEqual(['FACT-2026-040'])
    expect(screen.getByText(`${T}.champs.documentLie : DEV-2026-002`)).toBeInTheDocument()
  })

  it('par le montant TTC affiché (1 000 € HT à 20 % → 1 200 €)', () => {
    render(<FacturesSection {...propsFactures()} />)
    const champ = screen.getByPlaceholderText('proDash.factures.rechercher')
    fireEvent.change(champ, { target: { value: '1200' } })
    expect(numerosAffiches()).toEqual(['FACT-2026-040'])
    fireEvent.change(champ, { target: { value: '360' } })
    expect(numerosAffiches()).toEqual(['AC-2026-007'])
  })

  it('le filtre par statut garde son rendu (puces « Toutes », « Émises »…) et filtre toujours', () => {
    render(<FacturesSection {...propsFactures([FACTURE, ACOMPTE, { ...FACTURE, id: 'f2', docNumber: '', status: 'brouillon' }])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Brouillons (1)' }))
    expect(numerosAffiches()).toEqual(['SCI Martin']) // brouillon sans numéro : case nommée par le client
    expect(screen.getByRole('button', { name: 'Brouillons (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: `${T}.toutTelecharger (1)` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Émises (2)' }))
    expect(numerosAffiches()).toEqual(['AC-2026-007', 'FACT-2026-040'])
  })

  it('cocher une facture n\'ouvre pas le formulaire ; cliquer la ligne l\'ouvre toujours', () => {
    const props = propsFactures()
    render(<FacturesSection {...props} />)
    fireEvent.click(caseDe('FACT-2026-040'))
    expect(caseDe('FACT-2026-040')).toBeChecked()
    expect(props.setShowFactureForm).not.toHaveBeenCalled()
    const ligneFacture = caseDe('FACT-2026-040').closest('tr') as HTMLElement
    fireEvent.click(within(ligneFacture).getByText('FACT-2026-040'))
    expect(props.setShowFactureForm).toHaveBeenCalledWith(true)
  })

  it('« Tout télécharger » suit les filtres (Acomptes) — artisan : modèle V2', async () => {
    role.orgRole = 'artisan'
    render(<FacturesSection {...propsFactures()} />)
    fireEvent.click(screen.getByRole('button', { name: /^Acomptes/ }))
    fireEvent.click(screen.getByRole('button', { name: `${T}.toutTelecharger (1)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([ACOMPTE])
    expect(telechargementAppele()[0][1].useBtpDesign).toBe(false)
    expect(telechargementAppele()[0][2].nomArchive).toMatch(new RegExp(`^${T_REGEX}\\.archiveFactures_`))
  })

  it('BTP : la sélection part avec le modèle V3', async () => {
    render(<FacturesSection {...propsFactures()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: `${T}.toutSelectionner` }))
    fireEvent.click(screen.getByRole('button', { name: `${T}.telechargerSelection (2)` }))
    await waitFor(() => expect(telechargementAppele()).toHaveLength(1))
    expect(telechargementAppele()[0][0]).toEqual([FACTURE, ACOMPTE])
    expect(telechargementAppele()[0][1].useBtpDesign).toBe(true)
  })
})
