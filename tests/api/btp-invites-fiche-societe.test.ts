// @vitest-environment node
// tests/api/btp-invites-fiche-societe.test.ts — « Mon profil », logo, modes de paiement et envoi de fichier pour un
// compte INVITÉ dans une société BTP (26/11/2026, lot 2 des comptes invités).
//
// Avant : les quatre routes cherchaient la fiche par `user_id = user.id`. Un co-gérant, une secrétaire ou un salarié
// n'a pas de fiche à lui : 404 à chaque enregistrement, et les devis qu'il imprimait partaient sans les modes de
// paiement de la société.
//
// Ce que chaque cas protège :
//   - le co-gérant et la secrétaire (settings FULL) écrivent sur la fiche de LA SOCIÉTÉ, et seulement les champs
//     envoyés — jamais sur une fiche à leur nom, qui n'existe pas ;
//   - le comptable et les salariés de terrain (settings READ) sont refusés AVANT toute écriture et tout envoi dans
//     Storage : « Mon profil » s'ouvre pour leur mot de passe, rien de ce qu'ils y tapent ne touche l'entreprise ;
//   - un rattachement annoncé sans ligne d'équipe active, ou deux fiches pour la société, est refusé (409) au lieu
//     d'écrire sur une fiche arbitraire ;
//   - un sous-compte qui a SA fiche garde le chemin d'origine (c'est elle que son tableau de bord affiche) ;
//   - l'artisan et le gérant titulaire ne lisent même pas l'équipe : chemin d'origine, règle n° 1.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase, Ligne } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown> },
  envoisImage: 0,
  envoisFichier: 0,
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  const seau = {
    upload: async (chemin: string) => { h.envoisFichier += 1; return { data: { path: chemin }, error: null } },
    getPublicUrl: (chemin: string) => ({ data: { publicUrl: `https://exemple.supabase.co/storage/v1/object/public/profile-photos/${chemin}` } }),
    createSignedUrl: async (chemin: string) => ({ data: { signedUrl: `https://exemple.supabase.co/signe/${chemin}` } }),
  }
  // Compte de la société (titulaire) : son assurance est lue dans ses métadonnées par /api/artisan-company.
  const titulaire = { id: 'compte-titulaire', email: 'geral@exemplo.test', user_metadata: { insurance_name: 'Seguradora Exemplo', insurance_number: 'RC-0001' } }
  return {
    supabaseAdmin: {
      from: (t: string) => fauxSupabase(h.base).from(t),
      storage: { from: () => seau },
      auth: { admin: { getUserById: async () => ({ data: { user: titulaire }, error: null }) } },
    },
  }
})
vi.mock('@/lib/storage/images-artisan', () => ({
  lireImageDataUrl: () => ({ type: 'image/webp', octets: new Uint8Array([1, 2, 3]) }),
  envoyerImageArtisan: async () => {
    h.envoisImage += 1
    return { ok: true, url: 'https://exemple.supabase.co/storage/v1/object/public/profile-photos/logos/x.webp', chemin: 'logos/x.webp' }
  },
  supprimerImageArtisan: async () => null,
}))

const reglages = await import('@/app/api/artisan-settings/route')
const logo = await import('@/app/api/save-logo/route')
const paiement = await import('@/app/api/artisan-payment-info/route')
const envoi = await import('@/app/api/upload/route')
const identite = await import('@/app/api/artisan-company/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const FICHE = '7cfb1e10-0000-4000-8000-000000000001'

// resolveCompanyId garde la société d'un compte 60 s en mémoire, sans purge : un compte NEUF par cas.
let compteur = 0
const nouveauCompte = () => {
  compteur += 1
  return `00000000-0000-4000-9000-${String(compteur).padStart(12, '0')}`
}

const ficheDeLaSociete = (): Ligne => ({
  id: FICHE, user_id: SOCIETE, company_name: 'Construções Exemplo, Lda', company_city: 'Porto',
  slug: 'construcoes-exemplo-porto', email: 'geral@exemplo.test', phone: '+351 200 000 000',
  rcs_number: 'CRC Porto 000000', insurance_name: 'Seguradora Exemplo', language: 'pt',
  legal_form: 'Lda', company_address: 'Rua Exemplo 1', company_postal_code: '4000-000', siret: '500000000',
  paiement_modes: [{ type: 'virement', iban: 'PT50000000000000000000000', actif: true }],
  paiement_mention_devis: true, paiement_mention_facture: false,
})

/** Compte invité : ligne d'équipe active et fiche de la société. `sansLigneEquipe` simule un rattachement désactivé. */
function invite(role: string, options: { sansLigneEquipe?: boolean } = {}): string {
  const id = nouveauCompte()
  h.user = { id, email: `${role.toLowerCase()}@exemplo.test`, app_metadata: { role: 'pro_societe', pro_team_role: role, company_id: SOCIETE } }
  h.base.lignes.pro_team_members = options.sansLigneEquipe
    ? []
    : [{ id: `membre-${id}`, user_id: id, company_id: SOCIETE, is_active: true, role }]
  h.base.lignes.profiles_artisan = [ficheDeLaSociete()]
  return id
}

const fiche = () => (h.base.lignes.profiles_artisan ?? []).find(l => l.id === FICHE) as Ligne

const ecrituresProfils = () => requetes(h.base, 'profiles_artisan', 'update')

const appeler = async (route: { POST?: unknown; GET?: unknown }, methode: 'GET' | 'POST', url: string, corps?: unknown) => {
  const gestionnaire = route[methode] as (r: NextRequest) => Promise<Response>
  const res = await gestionnaire(new NextRequest(`https://vitfix.io${url}`, {
    method: methode,
    headers: { Authorization: 'Bearer jeton', ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const enregistrerProfil = (corps: Record<string, unknown>) => appeler(reglages, 'POST', '/api/artisan-settings', corps)
const enregistrerLogo = () => appeler(logo, 'POST', '/api/save-logo', { base64: 'data:image/webp;base64,AAAAAAAAAAAA', field: 'logo_url' })
const lirePaiement = () => appeler(paiement, 'GET', '/api/artisan-payment-info')
const enregistrerPaiement = () => appeler(paiement, 'POST', '/api/artisan-payment-info', {
  paiement_modes: [{ type: 'cheque', ordre: 'Construções Exemplo', actif: true }],
})

/** Envoi d'un PNG avec mise à jour du profil (artisan_id + field), comme useSettings.uploadDocument. */
const envoyerFichier = async (artisanId: string, champ: string) => {
  const fd = new FormData()
  // Signature PNG : la route vérifie le contenu réel, pas le type annoncé.
  fd.append('file', new File([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])], 'logo.png', { type: 'image/png' }))
  fd.append('bucket', 'profile-photos')
  fd.append('folder', 'logos')
  fd.append('artisan_id', artisanId)
  fd.append('field', champ)
  const res = await envoi.POST(new NextRequest('https://vitfix.io/api/upload', {
    method: 'POST', headers: { Authorization: 'Bearer jeton' }, body: fd,
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = null
  h.envoisImage = 0
  h.envoisFichier = 0
})

describe('« Mon profil » d’un compte invité : la fiche est celle de la société', () => {
  it.each(['GERANT', 'SECRETAIRE'])('%s invité écrit sur la fiche de la société, seulement les champs envoyés', async (role) => {
    invite(role)

    const { status } = await enregistrerProfil({ phone: '+351 299 999 999' })

    expect(status).toBe(200)
    expect(ecrituresProfils()).toHaveLength(1)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: FICHE })
    expect(ecrituresProfils()[0].valeur).toEqual({ phone: '+351 299 999 999' })
    // Le reste de la fiche est intact, adresse publique comprise.
    expect(fiche()).toMatchObject({ company_name: 'Construções Exemplo, Lda', slug: 'construcoes-exemplo-porto', rcs_number: 'CRC Porto 000000' })
  })

  it.each(['COMPTABLE', 'OUVRIER', 'CHEF_CHANTIER', 'CONDUCTEUR_TRAVAUX'])('%s (réglages en lecture) est refusé sans rien écrire', async (role) => {
    invite(role)

    const { status, json } = await enregistrerProfil({ company_name: '' })

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_fiche')
    expect(ecrituresProfils()).toHaveLength(0)
    expect(fiche().company_name).toBe('Construções Exemplo, Lda')
  })

  it('une dérogation du gérant ouvre l’écriture à un salarié', async () => {
    const id = invite('OUVRIER')
    h.base.lignes.pro_role_permissions = [{ member_id: `membre-${id}`, company_id: SOCIETE, module_id: 'settings', access_level: 'FULL' }]

    const { status } = await enregistrerProfil({ bio: 'Reabilitação de fachadas.' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: FICHE })
  })

  it('un rattachement sans ligne d’équipe active est refusé (409), sans écrire nulle part', async () => {
    invite('GERANT', { sansLigneEquipe: true })

    const { status, json } = await enregistrerProfil({ phone: '+351 299 999 999' })

    expect(status).toBe(409)
    expect(json.code).toBe('societe_non_resolue')
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('deux fiches pour la société : refus plutôt qu’une fiche prise au hasard', async () => {
    invite('GERANT')
    h.base.lignes.profiles_artisan.push({ ...ficheDeLaSociete(), id: 'fiche-doublon' })

    const { status, json } = await enregistrerProfil({ phone: '+351 299 999 999' })

    expect(status).toBe(409)
    expect(json.code).toBe('fiche_societe_multiple')
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('un compte invité qui a SA fiche garde le chemin d’origine (celle que son tableau de bord affiche)', async () => {
    const id = invite('SECRETAIRE')
    h.base.lignes.profiles_artisan.push({ id: 'fiche-personnelle', user_id: id, company_name: 'Atelier personnel', slug: 'atelier-personnel' })

    const { status } = await enregistrerProfil({ phone: '+351 211 111 111' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: 'fiche-personnelle' })
    expect(fiche().phone).toBe('+351 200 000 000')
  })

  it.each([
    ['artisan', {}],
    ['gérant titulaire', { role: 'pro_societe' }],
  ])('%s : chemin d’origine, sans lecture de l’équipe', async (_cas, metadonnees) => {
    const id = nouveauCompte()
    h.user = { id, app_metadata: { role: 'artisan', ...metadonnees } }
    h.base.lignes.profiles_artisan = [{ id: 'fiche-du-compte', user_id: id, company_name: 'Exemple', slug: 'exemple' }, ficheDeLaSociete()]

    const { status } = await enregistrerProfil({ phone: '+33 600 000 000' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: 'fiche-du-compte' })
    expect(requetes(h.base, 'pro_team_members')).toHaveLength(0)
  })
})

describe('Logo d’un compte invité', () => {
  it('le co-gérant change le logo de la société', async () => {
    invite('GERANT')

    const { status } = await enregistrerLogo()

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: FICHE })
    expect(ecrituresProfils()[0].valeur).toMatchObject({ logo_url: expect.stringContaining('/profile-photos/') })
  })

  it('un salarié de terrain est refusé avant tout envoi dans Storage', async () => {
    invite('OUVRIER')

    const { status, json } = await enregistrerLogo()

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_fiche')
    expect(h.envoisImage).toBe(0)
    expect(ecrituresProfils()).toHaveLength(0)
  })
})

describe('Modes de paiement d’un compte invité', () => {
  it.each(['GERANT', 'SECRETAIRE', 'COMPTABLE'])('%s lit ceux de la société (ils sont sur les documents qu’il imprime)', async (role) => {
    invite(role)

    const { status, json } = await lirePaiement()

    expect(status).toBe(200)
    expect(json.paiement_modes).toEqual(ficheDeLaSociete().paiement_modes)
    expect(json.paiement_mention_facture).toBe(false)
  })

  it('un salarié de terrain ne reçoit pas l’IBAN de la société', async () => {
    invite('OUVRIER')

    const { status, json } = await lirePaiement()

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_paiement')
    expect(JSON.stringify(json)).not.toContain('PT50')
  })

  it('la secrétaire les enregistre sur la fiche de la société', async () => {
    invite('SECRETAIRE')

    const { status } = await enregistrerPaiement()

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: FICHE })
  })

  it('le comptable les lit mais ne les modifie pas', async () => {
    invite('COMPTABLE')

    const { status } = await enregistrerPaiement()

    expect(status).toBe(403)
    expect(ecrituresProfils()).toHaveLength(0)
  })
})

describe('Envoi de fichier avec mise à jour du profil, compte invité', () => {
  it('le co-gérant envoie le logo : la fiche de la société le reçoit', async () => {
    const id = invite('GERANT')

    // L'écran envoie `artisan.id`, qui est le compte du salarié invité.
    const { status } = await envoyerFichier(id, 'logo_url')

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].filtres).toEqual({ id: FICHE })
  })

  it.each([
    ['un salarié de terrain, pour le logo', 'OUVRIER', 'logo_url'],
    ['le co-gérant, pour le Kbis du titulaire', 'GERANT', 'kbis_url'],
    ['la secrétaire, pour la pièce d’identité du titulaire', 'SECRETAIRE', 'id_document_url'],
  ])('refus avant tout envoi dans Storage : %s', async (_cas, role, champ) => {
    const id = invite(role)

    const { status } = await envoyerFichier(id, champ)

    expect(status).toBe(403)
    expect(h.envoisFichier).toBe(0)
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('une fiche désignée qui n’est ni la société ni le compte est refusée', async () => {
    invite('GERANT')

    const { status } = await envoyerFichier('fiche-d-une-autre-entreprise', 'logo_url')

    expect(status).toBe(403)
    expect(h.envoisFichier).toBe(0)
  })
})

describe('Identité entreprise d’un rapport de chantier, compte invité (/api/artisan-company)', () => {
  const lireIdentite = () => appeler(identite, 'GET', `/api/artisan-company?artisan_id=${FICHE}`)
  afterEach(() => { vi.restoreAllMocks() })

  // Fiche avec un numéro d'entreprise mais sans forme juridique ni adresse : la route interroge l'annuaire des
  // entreprises et, pour le propriétaire de la fiche, la complète. Un compte invité ne fait que la lire.
  const ANNUAIRE = {
    results: [{
      nom_complet: 'CONSTRUCOES EXEMPLO', siren: '500000000', nature_juridique: '5499', activite_principale: '41.20A',
      etat_administratif: 'A', siege: { siret: '500000000', libelle_commune: 'PORTO', code_postal: '4000-000' },
    }],
  }
  const ficheACompleter = () => {
    Object.assign(fiche(), { legal_form: null, company_address: null })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(ANNUAIRE), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }

  it('fiche à compléter depuis l’annuaire : un invité la lit sans jamais l’écrire', async () => {
    const id = invite('OUVRIER')
    h.base.lignes.pro_role_permissions = [{ member_id: `membre-${id}`, company_id: SOCIETE, module_id: 'rapports', access_level: 'FULL' }]
    ficheACompleter()

    const { status, json } = await lireIdentite()

    expect(status).toBe(200)
    expect(json.source).toBe('api_gouv')
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('fiche à compléter depuis l’annuaire : le gérant titulaire la complète, comme avant', async () => {
    h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
    h.base.lignes.profiles_artisan = [ficheDeLaSociete()]
    ficheACompleter()

    const { status } = await lireIdentite()

    expect(status).toBe(200)
    expect(ecrituresProfils()).toHaveLength(1)
    expect(ecrituresProfils()[0]).toMatchObject({ filtres: { id: FICHE } })
  })

  it('un salarié à qui le gérant a ouvert les rapports reçoit l’identité de la société, assurance comprise', async () => {
    const id = invite('OUVRIER')
    h.base.lignes.pro_role_permissions = [{ member_id: `membre-${id}`, company_id: SOCIETE, module_id: 'rapports', access_level: 'FULL' }]

    const { status, json } = await lireIdentite()

    expect(status).toBe(200)
    expect(json.company).toMatchObject({ name: 'Construções Exemplo, Lda', address: 'Rua Exemplo 1', insuranceName: 'Seguradora Exemplo' })
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('sans rapports (fermés par défaut) ni devis ni factures : refus', async () => {
    invite('OUVRIER')

    const { status } = await lireIdentite()

    expect(status).toBe(403)
  })
})

describe('Mon profil d’un compte invité : ce que la route protège d’elle-même (relecture adverse du 26/11/2026)', () => {
  // Formulaire jamais chargé depuis la fiche, ouvert avant la correction : les 18 champs vides (l'e-mail valide, sinon
  // la validation le refusait déjà).
  const FORMULAIRE_VIDE = {
    company_name: '', bio: '', phone: '', email: 'tatiana@exemplo.test', auto_reply_message: '',
    auto_block_duration_minutes: 240, zone_radius_km: 30, rcs_number: '', ape_code: '', share_capital: '', tva_intra: '',
    insurance_name: '', insurance_number: '', insurance_coverage: '', insurance_type: '', insurance_expiry: '',
    mediator_name: '', mediator_url: '',
  }

  it('un formulaire vide (onglet d’avant la correction) est refusé : rien n’est écrit sur la fiche', async () => {
    invite('SECRETAIRE')

    const { status, json } = await enregistrerProfil(FORMULAIRE_VIDE)

    expect(status).toBe(409)
    expect(json.code).toBe('formulaire_perime')
    expect(ecrituresProfils()).toHaveLength(0)
    expect(fiche()).toMatchObject({ company_name: 'Construções Exemplo, Lda', rcs_number: 'CRC Porto 000000' })
  })

  it('vider un seul champ reste possible', async () => {
    invite('SECRETAIRE')

    const { status } = await enregistrerProfil({ insurance_name: '' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].valeur).toEqual({ insurance_name: null })
  })

  // Le formulaire corrigé n'envoie que les champs changés : un médiateur, c'est deux champs (nom et site), une assurance
  // jusqu'à cinq. Les vider ensemble était refusé comme « formulaire périmé », et recharger la page n'y changeait rien.
  it('retirer le médiateur (nom et site) en un seul enregistrement', async () => {
    invite('GERANT')
    Object.assign(fiche(), { mediator_name: 'Centro de Arbitragem Exemplo', mediator_url: 'https://arbitragem.exemplo.test' })

    const { status } = await enregistrerProfil({ mediator_name: '', mediator_url: '' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].valeur).toEqual({ mediator_name: null, mediator_url: null })
  })

  it('retirer toute l’assurance en un seul enregistrement', async () => {
    invite('SECRETAIRE')
    Object.assign(fiche(), { insurance_number: 'RC-0001', insurance_coverage: 'Portugal', insurance_type: 'RC', insurance_expiry: '2027-01-31' })

    const { status } = await enregistrerProfil({ insurance_name: '', insurance_number: '', insurance_coverage: '', insurance_type: '', insurance_expiry: '' })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0].valeur).toEqual({
      insurance_name: null, insurance_number: null, insurance_coverage: null, insurance_type: null, insurance_expiry: null,
    })
  })

  it('un corps complet qui ne vide qu’un seul champ rempli est refusé aussi', async () => {
    invite('SECRETAIRE')
    const f = fiche()

    const { status, json } = await enregistrerProfil({
      ...FORMULAIRE_VIDE, company_name: String(f.company_name), email: String(f.email), phone: String(f.phone),
      rcs_number: String(f.rcs_number), insurance_name: '',
    })

    expect(status).toBe(409)
    expect(json.code).toBe('formulaire_perime')
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('un formulaire complet qui ne vide aucun champ rempli passe', async () => {
    invite('SECRETAIRE')
    const fichePleine = fiche()

    const { status } = await enregistrerProfil({ ...FORMULAIRE_VIDE, company_name: String(fichePleine.company_name), rcs_number: String(fichePleine.rcs_number), insurance_name: String(fichePleine.insurance_name), phone: String(fichePleine.phone) })

    expect(status).toBe(200)
  })

  it('la bio modifiée garde le marqueur des services par jour de la société', async () => {
    invite('GERANT')
    fiche().bio = 'Reabilitação de fachadas. <!--DS:{"1":["s1"]}-->'

    await enregistrerProfil({ bio: 'Reabilitação e pintura de fachadas.' })

    expect(ecrituresProfils()[0].valeur).toEqual({ bio: 'Reabilitação e pintura de fachadas. <!--DS:{"1":["s1"]}-->' })
  })

  it('« Validation automatique » : la secrétaire la change sur la fiche de la société', async () => {
    invite('SECRETAIRE')

    const { status } = await enregistrerProfil({ auto_accept: true })

    expect(status).toBe(200)
    expect(ecrituresProfils()[0]).toMatchObject({ filtres: { id: FICHE }, valeur: { auto_accept: true } })
  })

  it('« Validation automatique » : un salarié de terrain ne la change pas', async () => {
    invite('OUVRIER')
    expect((await enregistrerProfil({ auto_accept: true })).status).toBe(403)
    expect(ecrituresProfils()).toHaveLength(0)
  })

  it('artisan : la route ignore auto_accept, comme avant (son interrupteur écrit depuis le navigateur)', async () => {
    const id = nouveauCompte()
    h.user = { id, app_metadata: { role: 'artisan' } }
    h.base.lignes.profiles_artisan = [{ id: 'fiche-artisan', user_id: id, company_name: 'Exemple', slug: 'exemple' }]

    await enregistrerProfil({ phone: '+33 600 000 000', auto_accept: true })

    expect(ecrituresProfils()[0].valeur).toEqual({ phone: '+33 600 000 000' })
  })
})
