/**
 * « Mon profil » d'une société BTP (`pro_societe`) : hooks/dashboard/useSettings.ts, partagé avec l'artisan.
 *
 * Défaut corrigé (constat inscription-profil-5 de l'audit du 11/11/2026) : le formulaire, chargé une seule fois à
 * l'ouverture du tableau de bord, renvoyait à chaque « Enregistrer » ses 18 champs. Il réécrivait ainsi :
 * - l'e-mail des devis et factures par l'e-mail de connexion, que le champ affichait à chaque session à la place de
 *   celui de la fiche ;
 * - l'assureur, le numéro de contrat et la couverture enregistrés entre-temps (dépôt d'une attestation dans
 *   Conformité), par les valeurs vides du chargement.
 * Contrat vérifié ici : pour une société française, le champ e-mail montre celui de la fiche, et seuls les champs que
 * la société a changés depuis le chargement (ou depuis son dernier enregistrement) partent vers POST
 * /api/artisan-settings. L'artisan et la société inscrite au Portugal (fiche en portugais, hors de ce correctif)
 * gardent exactement l'envoi d'avant (les 18 champs). Pour tous les comptes, le champ e-mail part de celui de la fiche
 * depuis #713 (celui de connexion seulement si la fiche n'en a pas : tests/pro-dashboard/reglages-email-profil.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authFetch: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('@/lib/api-client', () => ({ authFetch: mocks.authFetch }))
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, warning: vi.fn(), error: vi.fn() } }))

import { useSettings } from '@/hooks/dashboard/useSettings'

type Profil = Record<string, unknown>

const CHAMPS_DU_FORMULAIRE = [
  'company_name', 'bio', 'phone', 'email', 'auto_reply_message', 'auto_block_duration_minutes', 'zone_radius_km',
  'rcs_number', 'ape_code', 'share_capital', 'tva_intra', 'insurance_name', 'insurance_number', 'insurance_coverage',
  'insurance_type', 'insurance_expiry', 'mediator_name', 'mediator_url',
]

const FICHE_SOCIETE: Profil = {
  id: 'fiche-de-test',
  language: 'fr',
  company_name: 'Bâtiment Exemple',
  email: 'contact@exemple.fr',
  phone: '01 02 03 04 05',
  bio: 'Gros œuvre et rénovation',
  rcs_number: 'RCS Exempleville 000 000 000',
  insurance_name: '',
  insurance_number: '',
}

const t = (cle: string) => cle

function monter(profil: Profil, role?: string) {
  const setArtisan = vi.fn()
  const rendu = renderHook(() => useSettings(profil, setArtisan, {}, false, t))
  act(() => {
    // Troisième argument : rôle du compte (absent avant le correctif, ignoré alors)
    ;(rendu.result.current.initSettingsForm as (p: Profil, e: string, r?: string) => void)(profil, 'connexion@exemple.fr', role)
  })
  return { ...rendu, setArtisan }
}

function modifier(rendu: ReturnType<typeof monter>, champs: Record<string, unknown>) {
  act(() => { rendu.result.current.setSettingsForm({ ...rendu.result.current.settingsForm, ...champs }) })
}

async function enregistrer(rendu: ReturnType<typeof monter>) {
  await act(async () => { await rendu.result.current.saveSettings() })
}

/** Corps JSON des appels à /api/artisan-settings, dans l'ordre. */
function corpsEnvoyes(): Array<Record<string, unknown>> {
  return mocks.authFetch.mock.calls
    .filter(([url]) => url === '/api/artisan-settings')
    .map(([, , options]) => JSON.parse((options as { body: string }).body) as Record<string, unknown>)
}

beforeEach(() => {
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'jeton-de-test' } } })
  mocks.authFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  mocks.toastSuccess.mockReset()
})

describe('Mon profil d’une société BTP : seuls les champs changés sont enregistrés', () => {
  it('le champ e-mail montre celui de la fiche (devis et factures), pas celui de connexion', () => {
    const rendu = monter(FICHE_SOCIETE, 'pro_societe')
    expect(rendu.result.current.settingsForm.email).toBe('contact@exemple.fr')
  })

  it('un enregistrement fait pour autre chose ne renvoie ni l’e-mail, ni le téléphone, ni l’assurance', async () => {
    const rendu = monter(FICHE_SOCIETE, 'pro_societe')
    modifier(rendu, { tva_intra: 'FR00 000000000' })
    await enregistrer(rendu)

    expect(corpsEnvoyes()).toEqual([{ tva_intra: 'FR00 000000000' }])
    // L'état du tableau de bord ne reçoit que ce qui a été enregistré
    expect(rendu.setArtisan).toHaveBeenCalledWith({ ...FICHE_SOCIETE, tva_intra: 'FR00 000000000' })
  })

  it('assurance enregistrée par un dépôt d’attestation pendant la session : « Enregistrer » ne l’efface pas', async () => {
    const rendu = monter(FICHE_SOCIETE, 'pro_societe')
    // Le dépôt écrit assureur et contrat dans la fiche (côté serveur) ; le formulaire, lui, garde ses champs vides.
    modifier(rendu, { bio: 'Gros œuvre, rénovation et extensions' })
    await enregistrer(rendu)

    const [corps] = corpsEnvoyes()
    expect(corps).toEqual({ bio: 'Gros œuvre, rénovation et extensions' })
    expect(Object.keys(corps).filter((cle) => cle.startsWith('insurance_'))).toEqual([])
  })

  it('un champ enregistré n’est pas renvoyé au clic suivant ; sans changement, aucun envoi et le profil est dit à jour', async () => {
    const rendu = monter(FICHE_SOCIETE, 'pro_societe')
    modifier(rendu, { insurance_name: 'Assureur Exemple' })
    await enregistrer(rendu)
    await enregistrer(rendu)

    expect(corpsEnvoyes()).toEqual([{ insurance_name: 'Assureur Exemple' }])
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2)
  })

  it('fiche sans e-mail : l’e-mail de connexion affiché est enregistré au premier clic, comme avant', async () => {
    const rendu = monter({ ...FICHE_SOCIETE, email: null }, 'pro_societe')
    expect(rendu.result.current.settingsForm.email).toBe('connexion@exemple.fr')
    modifier(rendu, { ape_code: '4399C' })
    await enregistrer(rendu)

    expect(corpsEnvoyes()).toEqual([{ email: 'connexion@exemple.fr', ape_code: '4399C' }])
  })

  // Une fiche dont la langue n'est pas posée est celle d'une société française : seul le portugais en sort
  it.each([
    ['nulle', { ...FICHE_SOCIETE, language: null }],
    ['absente', Object.fromEntries(Object.entries(FICHE_SOCIETE).filter(([cle]) => cle !== 'language'))],
  ])('fiche sans langue posée (langue %s) : e-mail de la fiche, et seuls les champs changés partent', async (_cas, fiche) => {
    const rendu = monter(fiche, 'pro_societe')
    expect(rendu.result.current.settingsForm.email).toBe('contact@exemple.fr')
    modifier(rendu, { tva_intra: 'FR00 000000000' })
    await enregistrer(rendu)

    expect(corpsEnvoyes()).toEqual([{ tva_intra: 'FR00 000000000' }])
  })
})

describe('Mon profil d’un artisan : envoi inchangé', () => {
  it('les 18 champs du formulaire partent à chaque enregistrement, e-mail de la fiche compris', async () => {
    const rendu = monter(FICHE_SOCIETE, 'artisan')
    expect(rendu.result.current.settingsForm.email).toBe('contact@exemple.fr')
    await enregistrer(rendu)

    const [corps] = corpsEnvoyes()
    // Mêmes champs, dans le même ordre qu'avant le correctif
    expect(Object.keys(corps)).toEqual(CHAMPS_DU_FORMULAIRE)
    expect(corps.email).toBe('contact@exemple.fr')
  })

  it('sans rôle transmis (appel d’avant le correctif) : même envoi complet', async () => {
    const rendu = monter(FICHE_SOCIETE)
    await enregistrer(rendu)

    expect(Object.keys(corpsEnvoyes()[0])).toEqual(CHAMPS_DU_FORMULAIRE)
  })
})

describe('Mon profil d’une société inscrite au Portugal : envoi inchangé (Portugal hors de ce correctif)', () => {
  it('fiche en portugais : e-mail de la fiche affiché, et les 18 champs partent comme avant', async () => {
    const rendu = monter({ ...FICHE_SOCIETE, language: 'pt', email: 'contacto@exemplo.pt' }, 'pro_societe')
    expect(rendu.result.current.settingsForm.email).toBe('contacto@exemplo.pt')
    modifier(rendu, { tva_intra: 'PT000000000' })
    await enregistrer(rendu)

    const [corps] = corpsEnvoyes()
    expect(Object.keys(corps)).toEqual(CHAMPS_DU_FORMULAIRE)
    expect(corps).toMatchObject({ email: 'contacto@exemplo.pt', tva_intra: 'PT000000000' })
  })
})
