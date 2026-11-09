// tests/components/devis-btp-selecteur-clients.test.tsx
//
// Sélecteur « Importer depuis la base client » du formulaire BTP (PR #577, lot 4 Sentry du 28/10/2026).
// Les clients saisis à la main (localStorage `fixit_manual_clients_<artisan.id>`) sont lus à part de l'appel
// /api/artisan-clients, par une lecture qui ne lève jamais :
//   - erreur HTTP autre que 403 (500, 429) ou exception : clients manuels proposés, toast d'erreur inchangé
//     (sur main, une réponse d'erreur les laissait affichés ; la première version de la PR les effaçait) ;
//   - 200 : clients du serveur puis clients manuels ; 403 (compte sans fiche artisan) : clients manuels seuls ;
//   - JSON illisible ou localStorage inaccessible : aucun client manuel, sans exception ni toast, les clients
//     du serveur restent proposés.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ArtisanBasic } from '@/lib/devis-types'

const h = vi.hoisted(() => ({ fetchAuthentifie: vi.fn(), toastErreur: vi.fn() }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'fr' }),
  useLocale: () => 'fr',
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock('@/lib/fetch-authentifie', () => ({ fetchAuthentifie: h.fetchAuthentifie }))
vi.mock('sonner', () => ({ toast: { error: h.toastErreur, success: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() } }))
vi.mock('@/lib/document-sync', () => ({ syncDocumentSafe: vi.fn() }))
vi.mock('@/components/dashboard/btp/RentabiliteDevisModal', () => ({ default: () => null }))

import DevisFactureFormBTP from '@/components/DevisFactureFormBTP'

const ARTISAN: ArtisanBasic = { id: 'art-btp-1', company_name: 'SUD TRAVAUX', email: 'contact@sud-travaux.test' }
const CLE_CLIENTS_MANUELS = `fixit_manual_clients_${ARTISAN.id}`
const CLIENT_MANUEL = { id: 'manuel-1', name: 'Client Manuel SARL', email: 'manuel@test.fr' }
const CLIENT_SERVEUR = { id: 'serveur-1', name: 'Client Serveur SAS', email: 'serveur@test.fr' }
const MESSAGE_ERREUR = 'Impossible de charger vos clients enregistrés'

const reponse = (status: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

/** Monte le formulaire et ouvre le sélecteur : l'appel est parti, la liste s'affiche à sa réponse. */
function ouvrirSelecteur() {
  render(<DevisFactureFormBTP artisan={ARTISAN} services={[]} bookings={[]} onBack={vi.fn()} />)
  fireEvent.click(screen.getByText('+ Importer depuis la base client'))
  expect(screen.getByText('Importer depuis la base client')).toBeInTheDocument()
  expect(h.fetchAuthentifie).toHaveBeenCalledWith(`/api/artisan-clients?artisan_id=${ARTISAN.id}`)
}

let avertissement: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  localStorage.clear()
  h.fetchAuthentifie.mockReset()
  h.toastErreur.mockClear()
  avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('formulaire BTP, sélecteur de clients : les clients manuels ne dépendent plus de l’appel réseau', () => {
  it.each([
    ['HTTP 500', () => Promise.resolve(reponse(500, { error: 'Erreur serveur' }))],
    ['HTTP 429', () => Promise.resolve(reponse(429, { error: 'Trop de requêtes' }))],
    ['exception réseau', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s : les clients manuels restent proposés, avec le toast d’erreur', async (_cas, appel) => {
    localStorage.setItem(CLE_CLIENTS_MANUELS, JSON.stringify([CLIENT_MANUEL]))
    h.fetchAuthentifie.mockImplementation(appel)

    ouvrirSelecteur()

    expect(await screen.findByText(CLIENT_MANUEL.name)).toBeInTheDocument()
    expect(screen.queryByText(/Aucun client trouvé/)).toBeNull()
    expect(h.toastErreur).toHaveBeenCalledWith(MESSAGE_ERREUR)
  })

  it('200 : clients du serveur puis clients manuels, sans toast', async () => {
    localStorage.setItem(CLE_CLIENTS_MANUELS, JSON.stringify([CLIENT_MANUEL]))
    h.fetchAuthentifie.mockResolvedValue(reponse(200, { clients: [CLIENT_SERVEUR] }))

    ouvrirSelecteur()

    expect(await screen.findByText(CLIENT_SERVEUR.name)).toBeInTheDocument()
    const noms = Array.from(document.querySelectorAll('.picker-item .nm')).map((n) => n.textContent)
    expect(noms).toEqual([CLIENT_SERVEUR.name, CLIENT_MANUEL.name])
    expect(h.toastErreur).not.toHaveBeenCalled()
  })

  it('403 (compte sans fiche artisan) : clients manuels seuls, sans toast', async () => {
    localStorage.setItem(CLE_CLIENTS_MANUELS, JSON.stringify([CLIENT_MANUEL]))
    h.fetchAuthentifie.mockResolvedValue(reponse(403, { error: 'Accès refusé' }))

    ouvrirSelecteur()

    expect(await screen.findByText(CLIENT_MANUEL.name)).toBeInTheDocument()
    expect(document.querySelectorAll('.picker-item')).toHaveLength(1)
    expect(h.toastErreur).not.toHaveBeenCalled()
  })

  it.each([
    ['JSON illisible', () => { localStorage.setItem(CLE_CLIENTS_MANUELS, '{pas du json') }],
    ['JSON qui n’est pas une liste', () => { localStorage.setItem(CLE_CLIENTS_MANUELS, 'null') }],
    ['localStorage inaccessible', () => {
      const lire = Storage.prototype.getItem
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, cle: string) {
        if (cle === CLE_CLIENTS_MANUELS) throw new DOMException('Accès refusé', 'SecurityError')
        return lire.call(this, cle)
      })
    }],
  ])('%s : aucun client manuel, sans exception ni toast, les clients du serveur restent proposés', async (_cas, preparer) => {
    preparer()
    h.fetchAuthentifie.mockResolvedValue(reponse(200, { clients: [CLIENT_SERVEUR] }))

    ouvrirSelecteur()

    expect(await screen.findByText(CLIENT_SERVEUR.name)).toBeInTheDocument()
    expect(document.querySelectorAll('.picker-item')).toHaveLength(1)
    expect(h.toastErreur).not.toHaveBeenCalled()
    expect(avertissement).toHaveBeenCalledWith('[DevisBTP] clients manuels illisibles :', expect.anything())
  })
})

// Statut juridique verrouillé, « défini à l'inscription ». Le formulaire réenregistre un brouillon 1,5 s après
// son ouverture : un document déjà enregistré doit ressortir avec exactement son statut, même quand le profil
// a désormais une autre forme juridique. Seul un nouveau document (avoir sans identifiant, duplicata marqué
// isDuplicate) prend la forme du profil.
describe('formulaire BTP, statut juridique : un document enregistré n’est jamais modifié', () => {
  const EI = 'Entreprise Individuelle (EI)'
  const CONTENU = {
    docType: 'facture', docNumber: '', status: 'brouillon', companyStatus: EI, clientName: 'Client Pro SAS',
    lines: [{ id: 1, description: 'Pose de menuiseries', qty: 1, unit: 'u', priceHT: 1000, tvaRate: 20, totalHT: 1000 }],
  }

  async function enregistrementAutomatique(initialData: Record<string, unknown>) {
    const onSave = vi.fn()
    render(<DevisFactureFormBTP artisan={{ ...ARTISAN, legal_form: 'SAS' } as ArtisanBasic} services={[]} bookings={[]}
      onBack={vi.fn()} onSave={onSave} initialData={initialData as never} />)
    await waitFor(() => expect(onSave).toHaveBeenCalled(), { timeout: 4000 })
    return onSave.mock.calls.at(-1)?.[0] as { companyStatus?: string }
  }

  it('un brouillon déjà enregistré garde son statut après l’enregistrement automatique', async () => {
    const doc = await enregistrementAutomatique({ ...CONTENU, id: '6f1c2a34-0000-4000-8000-0000000000b1', savedAt: '2026-11-09T20:00:00.000Z' })
    expect(doc.companyStatus).toBe(EI)
    const brouillons = JSON.parse(localStorage.getItem(`fixit_drafts_${ARTISAN.id}`) || '[]') as Array<{ companyStatus?: string }>
    expect(brouillons.map((b) => b.companyStatus)).toEqual([EI])
  })

  it('un nouveau document sans identifiant ni enregistrement (avoir) prend la forme du profil', async () => {
    const doc = await enregistrementAutomatique({ ...CONTENU })
    expect(doc.companyStatus).toBe('SAS')
  })

  it('un duplicata d’un devis resté en EI (nouvel identifiant, isDuplicate) prend la forme du profil', async () => {
    const doc = await enregistrementAutomatique({ ...CONTENU, docType: 'devis', id: '6f1c2a34-0000-4000-8000-0000000000d2', isDuplicate: true })
    expect(doc.companyStatus).toBe('SAS')
  })
})
