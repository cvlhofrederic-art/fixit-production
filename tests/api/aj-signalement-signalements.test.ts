// tests/api/aj-signalement-signalements.test.ts
//
// POST /api/aj-signalement/signalements — dépôt public après scan du QR code :
//   - corps validé (coordonnées obligatoires, bâtiment et qualité compris), jeton inconnu → 404, migration absente → 503 ;
//   - enregistrement dans signalements_qr (e-mail en minuscules, zone seulement pour les parties communes, qualité,
//     adresse proposée seulement pour une copropriété sans adresse, lien vers un signalement semblable résolu par le
//     serveur dans la même copropriété) ;
//   - e-mail aux destinataires de la copropriété, sinon ADMIN_EMAIL, réponse directe au déclarant ;
//   - l'échec de l'e-mail n'annule pas le dépôt (email_erreur conservé) ; limites de débit ;
//   - e-mail de confirmation au seul déclarant, dans la langue de la page, sans adresse de réponse ; son échec
//     ou la limite par adresse (clé hachée) n'annulent pas le dépôt ; un seul update final des quatre états ;
//     les variantes d'une même boîte (« + », points Gmail, googlemail.com) partagent la limite ;
//   - repli tant que les migrations du 06/11/2026 ne sont pas appliquées : insertion sans les nouvelles colonnes,
//     état des e-mails réduit à email_*, journalisé une fois ;
//   - PR 3, lot 7 (cahier § 6, droit § 5.4) : l'accusé porte les deux phrases EXACTES du droit § 5.4 seulement quand
//     signalements_qr_diffusion_annonce est vraie (annonce_faite appelée seulement après l'envoi accepté ; fonction
//     absente → sans phrases, dépôt 200) ; la ligne vers la politique du cabinet quand il en a une (seul href) ; aucun
//     bouton, aucun en-tête List-Unsubscribe ; structure figée (liste exacte des blocs visibles) ; information du
//     formulaire public (informationFormulaireQr) : politique du cabinet, partie « diffusion » seulement si elle est
//     possible.
// Seuls Supabase (petit moteur qui applique les filtres eq / in / gte et refuse les colonnes « absentes » ; lignes et
// erreurs par table pour maybeSingle ; fonctions SQL simulées par nom, PGRST202 sinon), le limiteur (un compteur par
// clé, remis à zéro avant chaque test), le logger et sendEmail sont simulés.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  type Ligne = Record<string, unknown>
  type Erreur = { code: string; message: string }
  const etat = {
    copropriete: null as null | Ligne,
    erreurLecture: null as null | Erreur,
    erreurInsertion: null as null | Erreur,
    insertions: [] as Ligne[],
    misesAJour: [] as Ligne[],
    limites: [] as string[],
    parametresLimites: [] as Array<[string, number | undefined, number | undefined]>,
    refuser: [] as string[],
    compteurs: new Map<string, number>(),
    // Signalements déjà en base (recherche des semblables) et colonnes que la base n'a pas encore.
    signalements: [] as Ligne[],
    lecturesSignalements: [] as string[],
    colonnesAbsentes: [] as string[],
    codeColonneAbsente: 'PGRST204',
    // PR 3, lot 7 : ligne ou erreur rendue par maybeSingle sur une table donnée (sinon la copropriété, comme avant) ;
    // fonctions SQL simulées (une fonction absente répond PGRST202, comme la production avant la migration 20261113).
    lignesTables: {} as Record<string, Ligne | null>,
    erreursTables: {} as Record<string, Erreur>,
    fonctions: {} as Record<string, (args: Record<string, unknown>) => { data?: unknown; error?: Erreur | null }>,
  }
  const erreurColonne = (ligne: Ligne): Erreur | null => {
    const absente = Object.keys(ligne).find((c) => etat.colonnesAbsentes.includes(c))
    return absente ? { code: etat.codeColonneAbsente, message: `Could not find the '${absente}' column of 'signalements_qr' in the schema cache` } : null
  }
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    const filtres: Array<[string, string, unknown]> = []
    let ecriture: null | { erreur: Erreur | null } = null
    q.select = (colonnes?: string) => {
      if (!ecriture && table === 'signalements_qr') etat.lecturesSignalements.push(String(colonnes))
      return q
    }
    for (const m of ['order', 'limit']) q[m] = () => q
    q.eq = (col: string, val: unknown) => { filtres.push(['eq', col, val]); return q }
    q.in = (col: string, val: unknown[]) => { filtres.push(['in', col, val]); return q }
    q.gte = (col: string, val: unknown) => { filtres.push(['gte', col, val]); return q }
    q.insert = (ligne: Ligne) => { etat.insertions.push({ table, ...ligne }); ecriture = { erreur: erreurColonne(ligne) }; return q }
    q.update = (ligne: Ligne) => { etat.misesAJour.push({ table, ...ligne }); ecriture = { erreur: erreurColonne(ligne) }; return q }
    q.maybeSingle = async () => {
      if (etat.erreurLecture) return { data: null, error: etat.erreurLecture }
      if (table in etat.erreursTables) return { data: null, error: etat.erreursTables[table] }
      if (table in etat.lignesTables) return { data: etat.lignesTables[table], error: null }
      return { data: etat.copropriete, error: null }
    }
    q.single = async () => {
      if (ecriture?.erreur) return { data: null, error: ecriture.erreur }
      return etat.erreurInsertion
        ? { data: null, error: etat.erreurInsertion }
        : { data: { id: 'b1c2d3e4-0000-4000-8000-000000000000', created_at: '2026-11-04T14:05:00.000Z', updated_at: '2026-11-04T14:05:00.000Z' }, error: null }
    }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      if (ecriture) return Promise.resolve({ data: null, error: ecriture.erreur }).then(ok, ko)
      const lignes = etat.signalements.filter((l) => filtres.every(([op, col, val]) => {
        if (op === 'eq') return l[col] === val
        if (op === 'in') return (val as unknown[]).includes(l[col])
        return String(l[col]) >= String(val)
      }))
      return Promise.resolve({ data: lignes, error: null }).then(ok, ko)
    }
    return q
  }
  type ResultatEnvoi = { success: boolean; id?: string; error?: string }
  const rpc = vi.fn(async (nom: string, args: Record<string, unknown> = {}) => {
    const fonction = etat.fonctions[nom]
    if (!fonction) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${nom}` } }
    const r = fonction(args)
    return { data: r.data ?? null, error: r.error ?? null }
  })
  return {
    etat, from, rpc, sendEmail: vi.fn<(charge: unknown) => Promise<ResultatEnvoi>>(async () => ({ success: true, id: 'mail-1' })),
    loggerError: vi.fn(), loggerWarn: vi.fn(), loggerInfo: vi.fn(),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: h.loggerInfo, debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string, limite?: number, fenetre?: number) => {
    h.etat.limites.push(cle)
    h.etat.parametresLimites.push([cle, limite, fenetre])
    if (h.etat.refuser.some((prefixe) => cle.startsWith(prefixe))) return false
    // Comme le vrai limiteur dans sa fenêtre : au plus `limite` passages par clé (20 par défaut).
    const passages = (h.etat.compteurs.get(cle) ?? 0) + 1
    h.etat.compteurs.set(cle, passages)
    return passages <= (limite ?? 20)
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
// Production avant la migration du 11/11/2026 : ses fonctions (gestionnaires destinataires, budget d'e-mails) sont
// absentes (PGRST202) ; l'envoi se fait alors aux adresses saisies, sans budget (repli, journalisé une fois).
// tests/api/aj-signalement-depot-gestionnaires.test.ts couvre la base migrée.
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => h.from(table),
    rpc: h.rpc,
  },
}))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => null) }))
// Depuis le 11/11/2026, l'e-mail du signalement part en UN message par destinataire (sendBatchEmails) ; le lot est
// simulé message par message par le même espion que sendEmail (confirmation au déclarant), dans l'ordre d'envoi.
vi.mock('@/lib/email', () => ({
  sendEmail: h.sendEmail,
  sendBatchEmails: async (lot: unknown[]) => {
    let sent = 0
    for (const message of lot) if ((await h.sendEmail(message)).success) sent += 1
    return { sent, failed: lot.length - sent, errors: [] }
  },
}))

const { POST } = await import('@/app/api/aj-signalement/signalements/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { informationFormulaireQr, reinitialiserReplisInformationQr } = await import('@/lib/aj-signalement/serveur-information')
const { templateConfirmationQr } = await import('@/lib/aj-signalement/email')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = {
  id: 'c0000000-0000-4000-8000-000000000001', nom: 'Parc Belle Ombre', adresse: '12 allée des Pins, 13009 Marseille',
  jeton: JETON, emails_destinataires: ['cabinet@example.com'], actif: true, created_at: '2026-11-04T10:00:00.000Z',
}
const CORPS = {
  jeton: JETON, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'Marie.Durand@Example.com',
  batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: 'Escalier',
  typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente', langue: 'fr',
  qualiteDeclarant: 'proprietaire',
}

function poster(corps: unknown) {
  return POST(new NextRequest('https://vitfix.io/api/aj-signalement/signalements', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps),
  }))
}

beforeEach(() => {
  h.etat.copropriete = { ...COPRO }
  h.etat.erreurLecture = null
  h.etat.erreurInsertion = null
  h.etat.insertions = []
  h.etat.misesAJour = []
  h.etat.limites = []
  h.etat.parametresLimites = []
  h.etat.refuser = []
  h.etat.compteurs = new Map()
  h.etat.signalements = []
  h.etat.lecturesSignalements = []
  h.etat.colonnesAbsentes = []
  h.etat.codeColonneAbsente = 'PGRST204'
  h.etat.lignesTables = {}
  h.etat.erreursTables = {}
  h.etat.fonctions = {}
  h.rpc.mockClear()
  reinitialiserReplisQr()
  reinitialiserReplisInformationQr()
  h.loggerWarn.mockClear()
  h.loggerInfo.mockClear()
  h.sendEmail.mockClear()
  h.sendEmail.mockResolvedValue({ success: true, id: 'mail-1' })
  h.loggerError.mockClear()
  vi.unstubAllEnvs()
})

describe('validation et copropriété', () => {
  it('400 sans téléphone (coordonnées obligatoires) ; rien n’est écrit ni envoyé', async () => {
    const { telephone: _t, ...sans } = CORPS
    const res = await poster(sans)
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })

  it('404 quand le jeton ne désigne aucune copropriété active', async () => {
    h.etat.copropriete = null
    const res = await poster(CORPS)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
  })

  it('503 base_absente tant que la migration n’est pas appliquée (42P01)', async () => {
    h.etat.erreurLecture = { code: '42P01', message: 'relation "signalements_qr_coproprietes" does not exist' }
    const res = await poster(CORPS)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('429 au-delà de 5 dépôts par minute et par adresse IP, et au-delà de 30 par copropriété', async () => {
    h.etat.refuser = ['qr_signalement_post_']
    expect((await poster(CORPS)).status).toBe(429)
    h.etat.refuser = ['qr_signalement_copro_']
    expect((await poster(CORPS)).status).toBe(429)
    expect(h.etat.insertions).toHaveLength(0)
  })
})

describe('dépôt', () => {
  it('enregistre le signalement, envoie l’e-mail aux destinataires de la copropriété et répond le numéro', async () => {
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signalement: {
        id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true, confirmationEnvoyee: true,
      },
    })
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.insertions[0]).toMatchObject({
      table: 'signalements_qr', copropriete_id: COPRO.id, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78',
      email: 'marie.durand@example.com', batiment: 'B', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: '',
      type_intervention: 'Plomberie (fuite, colonne, robinetterie)', priorite: 'urgente', statut: 'en_attente', langue: 'fr',
      qualite_declarant: 'proprietaire', adresse_proposee: null, signalement_lie_id: null,
    })
    // L'e-mail de l'administrateur part d'abord, la confirmation au déclarant ensuite.
    expect(h.sendEmail).toHaveBeenCalledTimes(2)
    // Un message par destinataire : un seul `to` (11/11/2026).
    const email = h.sendEmail.mock.calls[0][0] as { to: string; subject: string; replyTo: string; html: string }
    expect(email.to).toBe('cabinet@example.com')
    expect(email.replyTo).toBe('marie.durand@example.com')
    expect(email.subject).toBe('[AJ Signalement] URGENT — Plomberie (fuite, colonne, robinetterie) — Parc Belle Ombre — lot 12')
    expect(email.html).toContain('12 allée des Pins')
    expect(h.etat.misesAJour).toHaveLength(1)
    expect(h.etat.misesAJour[0]).toMatchObject({ table: 'signalements_qr', email_erreur: null, confirmation_erreur: null })
    expect(h.etat.misesAJour[0].email_envoye_le).toEqual(expect.any(String))
    expect(h.etat.misesAJour[0].confirmation_envoyee_le).toEqual(expect.any(String))
  })

  it('parties communes : la zone est gardée', async () => {
    await poster({ ...CORPS, estPartieCommune: true })
    expect(h.etat.insertions[0]).toMatchObject({ est_partie_commune: true, zone_signalee: 'Escalier' })
  })

  it('sans destinataire sur la copropriété : ADMIN_EMAIL et ADMIN_EMAIL_2 reçoivent l’e-mail', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'Admin@Vitfix.io')
    vi.stubEnv('ADMIN_EMAIL_2', 'second@vitfix.io')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    await poster(CORPS)
    // Un message chacun : l'un ne voit pas l'adresse de l'autre.
    expect(h.sendEmail.mock.calls.slice(0, 2).map((c) => (c[0] as { to: string }).to)).toEqual(['admin@vitfix.io', 'second@vitfix.io'])
  })

  it('aucun destinataire du tout : le dépôt est gardé, l’erreur conservée et journalisée ; seul le déclarant reçoit sa confirmation', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    vi.stubEnv('ADMIN_EMAIL_2', '')
    h.etat.copropriete = { ...COPRO, emails_destinataires: [] }
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(false)
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect((h.sendEmail.mock.calls[0][0] as { to: string[] }).to).toEqual(['marie.durand@example.com'])
    expect(h.etat.misesAJour[0]).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    expect(h.loggerError).toHaveBeenCalled()
  })

  it('e-mail refusé par Resend : 200, emailEnvoye false, erreur résumée (sans le texte du service ni adresse)', async () => {
    h.sendEmail.mockResolvedValue({ success: false, error: 'RESEND_API_KEY not configured' })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: false, confirmationEnvoyee: false })
    expect(h.etat.misesAJour[0]).toMatchObject({
      email_envoye_le: null, email_erreur: '1 envoi(s) sur 1 refusé(s) par le service d’e-mail',
      confirmation_envoyee_le: null, confirmation_erreur: 'RESEND_API_KEY not configured',
    })
  })

  it('insertion refusée : 500 journalisé, aucun e-mail', async () => {
    h.etat.erreurInsertion = { code: '23514', message: 'check violation' }
    const res = await poster(CORPS)
    expect(res.status).toBe(500)
    expect(h.sendEmail).not.toHaveBeenCalled()
    expect(h.loggerError).toHaveBeenCalled()
  })
})

describe('confirmation au déclarant', () => {
  type Charge = { to: string[]; subject: string; html: string; replyTo?: string; tags?: Array<{ name: string; value: string }> }
  const charge = (n: number) => h.sendEmail.mock.calls[n][0] as Charge
  const CLE_MARIE = `qr_confirmation_${createHash('sha256').update('marie.durand@example.com').digest('hex')}`
  const versDeclarant = (c: unknown) => (c as Charge).to.includes('marie.durand@example.com')

  it('part après l’e-mail de l’administrateur, au seul déclarant, sans adresse de réponse, en français', async () => {
    await poster(CORPS)
    expect(charge(0).to).toBe('cabinet@example.com')
    const confirmation = charge(1)
    expect(confirmation.to).toEqual(['marie.durand@example.com'])
    expect(confirmation).not.toHaveProperty('replyTo')
    expect(confirmation.subject).toBe('Votre signalement n° B1C2D3E4 a bien été enregistré — Parc Belle Ombre')
    expect(confirmation.html).toContain('4 novembre 2026 à 15:05 (heure de Paris)')
    expect(confirmation.html).not.toContain('cabinet@example.com')
    expect(confirmation.tags).toEqual([{ name: 'type', value: 'aj-signalement-confirmation' }])
  })

  it('page en portugais : confirmation en portugais', async () => {
    await poster({ ...CORPS, langue: 'pt', typeIntervention: 'Canalização (fuga, coluna, torneiras)' })
    const confirmation = charge(1)
    expect(confirmation.subject).toBe('A sua ocorrência n.º B1C2D3E4 foi registada — Parc Belle Ombre')
    expect(confirmation.html).toContain('<html lang="pt">')
    expect(confirmation.html).toContain('Canalização (fuga, coluna, torneiras)')
  })

  it('le contenu saisi est échappé dans la confirmation', async () => {
    await poster({ ...CORPS, description: 'Fuite <img src=x onerror=alert(1)> sous l’évier' })
    expect(charge(1).html).not.toContain('<img')
    expect(charge(1).html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('confirmation refusée par Resend : 200, dépôt et e-mail de l’administrateur intacts, erreur conservée', async () => {
    h.sendEmail.mockImplementation(async (c: unknown) => (versDeclarant(c)
      ? { success: false, error: 'The marie.durand@example.com address bounced' }
      : { success: true, id: 'mail-admin' }))
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.etat.insertions).toHaveLength(1)
    expect(h.etat.misesAJour).toHaveLength(1)
    expect(h.etat.misesAJour[0]).toMatchObject({ email_erreur: null, confirmation_envoyee_le: null, confirmation_erreur: 'The marie.durand@example.com address bounced' })
    expect(h.etat.misesAJour[0].email_envoye_le).toEqual(expect.any(String))
    expect(h.loggerError).toHaveBeenCalled()
    // L'adresse citée par Resend est masquée dans ce que la route écrit au logger (la ligne garde l'erreur brute pour
    // le super admin). sendEmail est simulé ici : sa propre console.error (lib/email.ts) n'est pas couverte.
    expect(JSON.stringify(h.loggerError.mock.calls)).not.toContain('marie.durand@example.com')
  })

  it('exception pendant la confirmation : le dépôt reste acquis (200) et l’erreur est conservée', async () => {
    h.sendEmail.mockImplementation(async (c: unknown) => {
      if (versDeclarant(c)) throw new Error('boom')
      return { success: true, id: 'mail-admin' }
    })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.etat.misesAJour[0]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.any(String) })
  })

  it('limite par adresse (3 par heure, clé hachée) atteinte : pas de confirmation, dépôt et e-mail admin gardés, raison conservée', async () => {
    h.etat.refuser = ['qr_confirmation_']
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: false })
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
    expect(charge(0).to).toBe('cabinet@example.com')
    expect(h.etat.parametresLimites).toContainEqual([CLE_MARIE, 3, 3_600_000])
    expect(h.etat.limites.some((cle) => cle.includes('@') || cle.includes('marie'))).toBe(false)
    expect(h.etat.misesAJour[0]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.stringContaining('limite') })
  })

  it('l’adresse saisie en majuscules donne la même clé de limite', async () => {
    await poster({ ...CORPS, email: 'MARIE.DURAND@EXAMPLE.COM' })
    expect(h.etat.limites).toContain(CLE_MARIE)
  })

  it.each([
    ['sous-adresses « + »', ['victime@example.com', 'victime+1@example.com', 'victime+2@example.com', 'victime+3@example.com']],
    ['points et googlemail.com chez Gmail', ['victime@gmail.com', 'v.ictime@gmail.com', 'victime+1@gmail.com', 'vic.time@googlemail.com']],
  ])('variantes d’une même boîte (%s) : le 4e dépôt est enregistré sans confirmation', async (_cas, variantes) => {
    const confirmees: boolean[] = []
    for (const email of variantes) {
      const res = await poster({ ...CORPS, email })
      expect(res.status).toBe(200)
      confirmees.push((await res.json()).signalement.confirmationEnvoyee)
    }
    expect(confirmees).toEqual([true, true, true, false])
    expect(h.etat.insertions).toHaveLength(4)
    // Chaque confirmation part à l'adresse saisie : la forme canonique sert seulement à la clé du limiteur.
    const envoyees = h.sendEmail.mock.calls.map((c) => c[0] as Charge).filter((c) => c.tags?.[0]?.value === 'aj-signalement-confirmation')
    expect(envoyees.map((c) => c.to)).toEqual(variantes.slice(0, 3).map((v) => [v]))
    expect(h.etat.misesAJour[3]).toMatchObject({ confirmation_envoyee_le: null, confirmation_erreur: expect.stringContaining('limite') })
  })
})

// ── Demandes de Hugo du 06/11/2026 : champs obligatoires, qualité, adresse proposée, même problème ──

type ChargeEmail = { to: string[]; html: string; tags?: Array<{ name: string; value: string }> }
const emailAdmin = () => h.sendEmail.mock.calls.map((c) => c[0] as ChargeEmail).find((c) => c.tags?.[0]?.value === 'aj-signalement')
const emailConfirmation = () => h.sendEmail.mock.calls.map((c) => c[0] as ChargeEmail).find((c) => c.tags?.[0]?.value === 'aj-signalement-confirmation')
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
const NOUVELLES_INSEREES = ['qualite_declarant', 'adresse_proposee', 'signalement_lie_id']

describe('tous les champs obligatoires', () => {
  const { qualiteDeclarant: _q, ...sansQualite } = CORPS
  const { zoneSignalee: _z, ...sansZone } = CORPS
  it.each([
    ['sans bâtiment', { ...CORPS, batiment: '' }],
    ['bâtiment fait d’espaces', { ...CORPS, batiment: '   ' }],
    ['sans qualité', sansQualite],
    ['qualité inconnue', { ...CORPS, qualiteDeclarant: 'syndic' }],
    ['numéro lié mal formé', { ...CORPS, estPartieCommune: true, signalementLieNumero: '1a2b' }],
    ['adresse proposée de plus de 300 caractères', { ...CORPS, adresseProposee: 'x'.repeat(301) }],
    ['parties communes sans zone', { ...CORPS, estPartieCommune: true, zoneSignalee: '' }],
    ['parties communes, zone faite d’espaces', { ...CORPS, estPartieCommune: true, zoneSignalee: '   ' }],
    ['parties communes, zone absente', { ...sansZone, estPartieCommune: true }],
  ])('400 %s : rien n’est écrit ni envoyé', async (_cas, corps) => {
    const res = await poster(corps)
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toHaveLength(0)
    expect(h.sendEmail).not.toHaveBeenCalled()
  })
})

describe('qualité du déclarant', () => {
  it('locataire : enregistrée, dans l’e-mail de l’administrateur et dans la confirmation', async () => {
    expect((await poster({ ...CORPS, qualiteDeclarant: 'locataire' })).status).toBe(200)
    expect(h.etat.insertions[0]).toMatchObject({ qualite_declarant: 'locataire' })
    expect(emailAdmin()?.html).toContain('Qualité')
    expect(emailAdmin()?.html).toContain('Locataire')
    expect(emailConfirmation()?.html).toContain('Vous êtes')
    expect(emailConfirmation()?.html).toContain('Locataire')
  })

  it('page en portugais : « Proprietário » dans la confirmation', async () => {
    await poster({ ...CORPS, langue: 'pt' })
    expect(emailConfirmation()?.html).toContain('Proprietário')
  })
})

describe('adresse proposée d’après la position', () => {
  it('copropriété sans adresse : l’adresse proposée (texte) part avec le signalement, échappée dans l’e-mail', async () => {
    h.etat.copropriete = { ...COPRO, adresse: '' }
    await poster({ ...CORPS, adresseProposee: '  1 Quai du Port <b>13002</b> Marseille ' })
    expect(h.etat.insertions[0]).toMatchObject({ adresse_proposee: '1 Quai du Port <b>13002</b> Marseille' })
    expect(Object.keys(h.etat.insertions[0]).some((c) => /lat|lon/.test(c))).toBe(false)
    expect(emailAdmin()?.html).toContain('1 Quai du Port &lt;b&gt;13002&lt;/b&gt; Marseille')
    expect(emailAdmin()?.html).not.toContain('<b>13002')
  })

  it('copropriété dont l’adresse est renseignée : l’adresse proposée est ignorée', async () => {
    await poster({ ...CORPS, adresseProposee: '1 Quai du Port 13002 Marseille' })
    expect(h.etat.insertions[0]).toMatchObject({ adresse_proposee: null })
    expect(emailAdmin()?.html).not.toContain('Quai du Port')
  })

  it('aucune adresse proposée (refus de la position, géocodage en échec) : null, le dépôt est accepté', async () => {
    h.etat.copropriete = { ...COPRO, adresse: '' }
    expect((await poster(CORPS)).status).toBe(200)
    expect(h.etat.insertions[0]).toMatchObject({ adresse_proposee: null })
  })
})

describe('même problème qu’un signalement déjà fait au même endroit', () => {
  const ID_LIE = '1a2b3c4d-0000-4000-8000-000000000001'
  const AUTRE_COPRO = 'c0000000-0000-4000-8000-000000000002'
  const semblable = (id: string, sur: Record<string, unknown> = {}) => ({
    id, copropriete_id: COPRO.id, prenom: 'Paul', nom: 'Martin', batiment: 'b', zone_signalee: 'Escadas', type_intervention: 'Ascenseur',
    statut: 'acceptee', est_partie_commune: true, created_at: ilYa(2), ...sur,
  })
  const COMMUNES = { ...CORPS, estPartieCommune: true, zoneSignalee: 'Escalier', batiment: 'Bât. B' }

  beforeEach(() => {
    h.etat.signalements = [
      semblable(ID_LIE),
      semblable('7a8b9c0d-0000-4000-8000-000000000002', { copropriete_id: AUTRE_COPRO }),
      semblable('9f8e7d6c-0000-4000-8000-000000000003', { statut: 'terminee' }),
      semblable('5a5a5a5a-0000-4000-8000-000000000004', { created_at: ilYa(61) }),
      semblable('6b6b6b6b-0000-4000-8000-000000000005', { batiment: 'A' }),
      semblable('8c8c8c8c-0000-4000-8000-000000000006', { est_partie_commune: false }),
    ]
  })

  it('numéro d’un signalement ouvert semblable de la même copropriété : lien enregistré, « même problème » dans les deux e-mails', async () => {
    const res = await poster({ ...COMMUNES, signalementLieNumero: '1A2B3C4D' })
    expect(res.status).toBe(200)
    expect(h.etat.insertions[0]).toMatchObject({ signalement_lie_id: ID_LIE, est_partie_commune: true, zone_signalee: 'Escalier' })
    expect(emailAdmin()?.html).toContain('Même problème que le signalement n° 1A2B3C4D')
    expect(emailConfirmation()?.html).toContain('Même problème que le signalement n° 1A2B3C4D')
    // La recherche ne nomme que des colonnes d'origine.
    expect(h.etat.lecturesSignalements).toHaveLength(1)
    for (const colonne of ['confirmation_envoyee_le', 'confirmation_erreur', ...NOUVELLES_INSEREES]) {
      expect(h.etat.lecturesSignalements[0]).not.toContain(colonne)
    }
  })

  it.each([
    ['numéro inconnu', 'FFFFFFFF'],
    ['signalement d’une autre copropriété', '7A8B9C0D'],
    ['signalement résolu', '9F8E7D6C'],
    ['signalement de plus de 60 jours', '5A5A5A5A'],
    ['autre bâtiment', '6B6B6B6B'],
    ['signalement d’un logement', '8C8C8C8C'],
  ])('%s : aucun lien, le dépôt reste acquis (200)', async (_cas, numero) => {
    const res = await poster({ ...COMMUNES, signalementLieNumero: numero })
    expect(res.status).toBe(200)
    expect(h.etat.insertions[0]).toMatchObject({ signalement_lie_id: null })
    expect(emailAdmin()?.html).not.toContain('Même problème')
  })

  it('« c’est un autre problème » (numéro vide) ou signalement dans un logement : aucune recherche, aucun lien', async () => {
    await poster({ ...COMMUNES, signalementLieNumero: '' })
    await poster({ ...CORPS, estPartieCommune: false, signalementLieNumero: '1A2B3C4D' })
    expect(h.etat.lecturesSignalements).toHaveLength(0)
    expect(h.etat.insertions.map((l) => l.signalement_lie_id)).toEqual([null, null])
  })
})

describe('repli tant que les migrations du 06/11/2026 ne sont pas appliquées en production', () => {
  // Replis des migrations du 06/11/2026 seulement (ceux de la migration du 11/11/2026 sont comptés à part).
  const avertissementsRepli = () => h.loggerWarn.mock.calls.filter((c) => String(c[0]).includes('repli') && String(c[0]).includes('06/11/2026'))

  it.each([
    ['qualite_declarant', 'PGRST204'], ['adresse_proposee', 'PGRST204'], ['signalement_lie_id', 'PGRST204'],
    ['qualite_declarant', '42703'], ['adresse_proposee', '42703'], ['signalement_lie_id', '42703'],
  ])('colonne %s absente (%s) : second insert avec les seules colonnes d’origine, 200, e-mails complets, journalisé une fois', async (colonne, code) => {
    h.etat.colonnesAbsentes = [colonne]
    h.etat.codeColonneAbsente = code
    h.etat.copropriete = { ...COPRO, adresse: '' }
    const res = await poster({ ...CORPS, adresseProposee: '1 Quai du Port 13002 Marseille' })
    expect(res.status).toBe(200)
    expect(h.etat.insertions).toHaveLength(2)
    expect(h.etat.insertions[0]).toHaveProperty(colonne)
    for (const nouvelle of NOUVELLES_INSEREES) expect(h.etat.insertions[1]).not.toHaveProperty(nouvelle)
    expect(h.etat.insertions[1]).toMatchObject({ prenom: 'Marie', batiment: 'B', statut: 'en_attente', email: 'marie.durand@example.com' })
    // La qualité et l'adresse proposée, gardées en mémoire, restent dans l'e-mail de l'administrateur.
    expect(emailAdmin()?.html).toContain('Propriétaire')
    expect(emailAdmin()?.html).toContain('1 Quai du Port 13002 Marseille')
    expect(avertissementsRepli()).toHaveLength(1)
    expect(JSON.stringify(avertissementsRepli())).toContain('20261106_signalements_qr_geoloc_qualite.sql')
    await poster(CORPS)
    expect(avertissementsRepli()).toHaveLength(1)
  })

  it.each(['confirmation_envoyee_le', 'confirmation_erreur'])('colonne %s absente : état des e-mails réduit à email_envoye_le et email_erreur', async (colonne) => {
    h.etat.colonnesAbsentes = [colonne]
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: true })
    expect(h.etat.misesAJour).toHaveLength(2)
    expect(h.etat.misesAJour[0]).toHaveProperty('confirmation_envoyee_le')
    expect(Object.keys(h.etat.misesAJour[1]).sort((a, b) => a.localeCompare(b))).toEqual(['email_envoye_le', 'email_erreur', 'table'])
    expect(h.etat.misesAJour[1].email_envoye_le).toEqual(expect.any(String))
    expect(avertissementsRepli()).toHaveLength(1)
    expect(JSON.stringify(avertissementsRepli())).toContain('20261106_signalements_qr_confirmation.sql')
  })

  it('production actuelle (aucune des cinq colonnes) : dépôt, deux e-mails et état de l’e-mail de l’administrateur ; un avertissement par opération', async () => {
    h.etat.colonnesAbsentes = ['confirmation_envoyee_le', 'confirmation_erreur', ...NOUVELLES_INSEREES]
    h.etat.codeColonneAbsente = 'PGRST204'
    for (let i = 0; i < 2; i += 1) expect((await poster(CORPS)).status).toBe(200)
    expect(h.etat.insertions).toHaveLength(4)
    expect(h.etat.misesAJour).toHaveLength(4)
    expect(h.sendEmail).toHaveBeenCalledTimes(4)
    expect(h.etat.misesAJour[3]).toEqual({ table: 'signalements_qr', email_envoye_le: expect.any(String), email_erreur: null })
    expect(avertissementsRepli()).toHaveLength(2)
  })

  it('autre erreur d’insertion (contrainte) : pas de second insert, 500', async () => {
    h.etat.erreurInsertion = { code: '23514', message: 'check violation' }
    expect((await poster(CORPS)).status).toBe(500)
    expect(h.etat.insertions).toHaveLength(1)
  })
})

// ── PR 3, lot 7 : accusé de réception (cahier § 6, droit § 5.4) et information du formulaire public ──

describe('accusé de réception : annonce de la diffusion et politique du cabinet (PR 3, lot 7)', () => {
  type Envoi = { to: string[] | string; subject: string; html: string; headers?: Record<string, string>; tags?: Array<{ name: string; value: string }> }
  const ID = 'b1c2d3e4-0000-4000-8000-000000000000'
  const CABINET_ID = 'a0000000-0000-4000-8000-00000000000a'
  const POLITIQUE = 'https://cabinet-exemple.test/confidentialite?v=1&l=fr'
  // Les deux phrases EXACTES du droit § 5.4 (note juridique, « Dans l'accusé de réception (a) — pas de bouton »).
  const PHRASE_CHAQUE_DEPOT = 'Ce message confirme votre signalement. Vous le recevrez à chaque fois que vous en déposez un.'
  const PHRASE_ANNONCE = 'Vous recevrez aussi les informations sur votre immeuble (fuite, coupure, intervention) ; chacune de ces informations comporte un bouton pour ne plus les recevoir.'
  const estAccuse = (c: unknown) => (c as Envoi).tags?.[0]?.value === 'aj-signalement-confirmation'
  const accuse = () => h.sendEmail.mock.calls.map((c) => c[0] as Envoi).find(estAccuse)
  const appelsRpc = (nom: string) => h.rpc.mock.calls.filter((c) => c[0] === nom)
  /** Copropriété rattachée au cabinet, qui a (ou non) une politique ; annonce SQL rendue telle quelle. */
  const preparer = (o: { annonce?: boolean | 'absente'; politique?: string | null } = {}) => {
    h.etat.copropriete = { ...COPRO, cabinet_id: CABINET_ID }
    h.etat.lignesTables.signalements_qr_cabinets = { id: CABINET_ID, nom: 'Cabinet Exemple', diffusion_politique_url: o.politique === undefined ? POLITIQUE : o.politique }
    if (o.annonce !== 'absente') {
      const annonce = o.annonce ?? true
      h.etat.fonctions.signalements_qr_diffusion_annonce = () => ({ data: annonce })
      h.etat.fonctions.signalements_qr_diffusion_annonce_faite = () => ({ data: true })
    }
  }

  it('diffusion annoncée : les deux phrases exactes du droit § 5.4, après « Gardez ce numéro », puis annonce_faite APRÈS l’envoi accepté', async () => {
    preparer()
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    const html = accuse()?.html ?? ''
    expect(html).toContain(PHRASE_CHAQUE_DEPOT)
    expect(html).toContain(PHRASE_ANNONCE)
    expect(html.indexOf(PHRASE_CHAQUE_DEPOT)).toBeGreaterThan(html.indexOf('Gardez ce numéro'))
    expect(html.indexOf(PHRASE_ANNONCE)).toBeGreaterThan(html.indexOf(PHRASE_CHAQUE_DEPOT))
    expect(appelsRpc('signalements_qr_diffusion_annonce')).toEqual([['signalements_qr_diffusion_annonce', { p_signalement: ID }]])
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toEqual([['signalements_qr_diffusion_annonce_faite', { p_signalement: ID }]])
    // Ordre : la date de l'annonce n'est posée qu'une fois l'accusé accepté par le service d'e-mail.
    const ordreEnvoi = h.sendEmail.mock.invocationCallOrder[h.sendEmail.mock.calls.findIndex((c) => estAccuse(c[0]))]
    const ordreFaite = h.rpc.mock.invocationCallOrder[h.rpc.mock.calls.findIndex((c) => c[0] === 'signalements_qr_diffusion_annonce_faite')]
    expect(ordreFaite).toBeGreaterThan(ordreEnvoi)
  })

  it('diffusion non annoncée (cabinet non activé, opposition, langue…) : aucune des deux phrases, annonce_faite jamais appelée', async () => {
    preparer({ annonce: false })
    expect((await poster(CORPS)).status).toBe(200)
    const html = accuse()?.html ?? ''
    expect(html).not.toContain('Ce message confirme votre signalement')
    expect(html).not.toContain('Vous recevrez aussi')
    expect(appelsRpc('signalements_qr_diffusion_annonce')).toHaveLength(1)
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toHaveLength(0)
  })

  it('fonction absente (migration 20261113 non appliquée, PGRST202) : accusé sans les phrases, dépôt 200, repli journalisé une fois par isolat', async () => {
    preparer({ annonce: 'absente' })
    for (let i = 0; i < 2; i += 1) {
      const res = await poster(CORPS)
      expect(res.status).toBe(200)
      expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: true })
    }
    const accuses = h.sendEmail.mock.calls.map((c) => c[0] as Envoi).filter(estAccuse)
    expect(accuses).toHaveLength(2)
    for (const envoi of accuses) expect(envoi.html).not.toContain('Vous recevrez aussi')
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toHaveLength(0)
    const replis = h.loggerWarn.mock.calls.filter((c) => String(c[0]).includes('20261113'))
    expect(replis).toHaveLength(1)
    expect(h.loggerError).not.toHaveBeenCalled()
  })

  it('erreur de la base sur l’annonce (autre que l’absence) : sans les phrases, dépôt 200, avertissement sans message de la base', async () => {
    preparer()
    h.etat.fonctions.signalements_qr_diffusion_annonce = () => ({ error: { code: 'XX000', message: 'erreur interne marie.durand@example.com' } })
    expect((await poster(CORPS)).status).toBe(200)
    expect(accuse()?.html).not.toContain('Vous recevrez aussi')
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toHaveLength(0)
    expect(JSON.stringify(h.loggerWarn.mock.calls)).toContain('XX000')
    expect(JSON.stringify([...h.loggerWarn.mock.calls, ...h.loggerError.mock.calls])).not.toContain('marie.durand')
  })

  it('accusé refusé par le service d’e-mail : annonce_faite jamais appelée (la date n’annonce pas un message non parti)', async () => {
    preparer()
    h.sendEmail.mockImplementation(async (c: unknown) => (estAccuse(c) ? { success: false, error: 'refus' } : { success: true, id: 'mail-admin' }))
    expect((await poster(CORPS)).status).toBe(200)
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toHaveLength(0)
  })

  it('limite par adresse atteinte : aucun accusé, ni lecture de l’annonce ni annonce_faite', async () => {
    preparer()
    h.etat.refuser = ['qr_confirmation_']
    expect((await poster(CORPS)).status).toBe(200)
    expect(appelsRpc('signalements_qr_diffusion_annonce')).toHaveLength(0)
    expect(appelsRpc('signalements_qr_diffusion_annonce_faite')).toHaveLength(0)
  })

  it('annonce_faite en erreur : le dépôt et l’accusé restent acquis (200, confirmation datée), avertissement', async () => {
    preparer()
    h.etat.fonctions.signalements_qr_diffusion_annonce_faite = () => ({ error: { code: '40001', message: 'serialization' } })
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ confirmationEnvoyee: true })
    expect(h.etat.misesAJour[0].confirmation_envoyee_le).toEqual(expect.any(String))
    expect(JSON.stringify(h.loggerWarn.mock.calls)).toContain('40001')
  })

  it('cabinet avec politique : la ligne « Vos coordonnées sont traitées par … » et son lien, SEUL href de l’accusé ; aucun bouton, aucun en-tête de désinscription', async () => {
    preparer({ annonce: false })
    await poster(CORPS)
    const envoi = accuse() as Envoi
    expect(envoi.html).toContain('Vos coordonnées sont traitées par Cabinet Exemple : <a href="https://cabinet-exemple.test/confidentialite?v=1&amp;l=fr"')
    expect(envoi.html).toContain('>Politique de confidentialité</a>')
    expect(envoi.html.match(/href=/g)).toHaveLength(1)
    expect(envoi.html.match(/<a\b/g)).toHaveLength(1)
    expect(envoi.html).not.toMatch(/<button|display:inline-block|Ne plus recevoir/i)
    expect(envoi).not.toHaveProperty('headers')
    expect(JSON.stringify(envoi)).not.toMatch(/List-Unsubscribe/i)
  })

  it('les deux phrases ET la politique : toujours un seul href, aucun bouton, aucun en-tête de désinscription', async () => {
    preparer()
    await poster(CORPS)
    const envoi = accuse() as Envoi
    expect(envoi.html).toContain(PHRASE_ANNONCE)
    expect(envoi.html.match(/href=/g)).toHaveLength(1)
    expect(envoi.html).not.toMatch(/<button|display:inline-block|Ne plus recevoir/i)
    expect(JSON.stringify(envoi)).not.toMatch(/List-Unsubscribe/i)
  })

  it.each([
    ['cabinet sans politique', { politique: null }],
    ['politique hors format (défense en profondeur : jamais recopiée dans un href)', { politique: 'javascript:alert(1)' }],
  ])('%s : aucune ligne d’information, aucun href', async (_cas, o) => {
    preparer({ annonce: false, ...o })
    await poster(CORPS)
    const html = accuse()?.html ?? ''
    expect(html).not.toContain('Vos coordonnées sont traitées')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('javascript:')
  })

  it('copropriété sans cabinet : accusé d’origine (ni phrases, ni ligne), dépôt 200', async () => {
    h.etat.fonctions.signalements_qr_diffusion_annonce = () => ({ data: false })
    expect((await poster(CORPS)).status).toBe(200)
    const html = accuse()?.html ?? ''
    expect(html).not.toContain('Vos coordonnées sont traitées')
    expect(html).not.toContain('Vous recevrez aussi')
    expect(html).not.toContain('href=')
  })

  it('colonne de la politique absente (migration 20261113, 42703) : aucune ligne, dépôt 200, replis journalisés une fois chacun', async () => {
    preparer({ annonce: 'absente' })
    h.etat.erreursTables.signalements_qr_cabinets = { code: '42703', message: 'column signalements_qr_cabinets.diffusion_politique_url does not exist' }
    for (let i = 0; i < 2; i += 1) expect((await poster(CORPS)).status).toBe(200)
    expect(accuse()?.html).not.toContain('Vos coordonnées sont traitées')
    // Deux opérations en repli (annonce, politique), chacune journalisée une seule fois malgré les deux dépôts.
    expect(h.loggerWarn.mock.calls.filter((c) => String(c[0]).includes('20261113'))).toHaveLength(2)
    expect(h.loggerError).not.toHaveBeenCalled()
  })

  it('PT : les deux phrases proposées (H4) et la ligne d’information en portugais', async () => {
    preparer()
    await poster({ ...CORPS, langue: 'pt', typeIntervention: 'Canalização (fuga, coluna, torneiras)' })
    const html = accuse()?.html ?? ''
    expect(html).toContain('Esta mensagem confirma a sua ocorrência. Receberá uma confirmação como esta sempre que registar uma.')
    expect(html).toContain('Receberá também as informações sobre o seu prédio (fuga, corte, intervenção); cada uma destas informações inclui um botão para deixar de as receber.')
    expect(html).toContain('Os seus dados são tratados por Cabinet Exemple: <a href=')
    expect(html).toContain('>Política de privacidade</a>')
  })

  it('le nom du cabinet est échappé dans la ligne d’information', async () => {
    preparer({ annonce: false })
    h.etat.lignesTables.signalements_qr_cabinets = { id: CABINET_ID, nom: 'Cabinet <b>Exemple</b> & fils', diffusion_politique_url: POLITIQUE }
    await poster(CORPS)
    const html = accuse()?.html ?? ''
    expect(html).toContain('Cabinet &lt;b&gt;Exemple&lt;/b&gt; &amp; fils')
    expect(html).not.toContain('<b>Exemple')
  })
})

describe('accusé de réception : structure figée (droit § 5.4, « à verrouiller dans le code »)', () => {
  // Toute modification de l'accusé (bloc ajouté, texte changé, lien) fait échouer ce test : relire alors la note
  // juridique (droit § 5.4, conditions 1 à 3 : l'accusé reste un accusé, un par dépôt, la diffusion y est annoncée).
  const ENTITES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }
  /** Blocs visibles, dans l'ordre : balises de mise en ligne retirées, toute autre balise sépare deux blocs. */
  const blocs = (html: string): string[] => html
    .replace(/<\/?(?:strong|a|b|em)(?:\s[^>]*)?>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITES[e] ?? e)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const s: Parameters<typeof templateConfirmationQr>[0]['signalement'] = {
    id: 'b1c2d3e4-0000-4000-8000-000000000000', coproprieteId: COPRO.id, coproprieteNom: 'Parc Belle Ombre',
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com',
    batiment: 'B', etage: '4', numLot: '12', estPartieCommune: false, zoneSignalee: '',
    typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', priorite: 'urgente',
    statut: 'en_attente', langue: 'fr', emailEnvoyeLe: null, emailErreur: null, confirmationEnvoyeeLe: null, confirmationErreur: null,
    qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
    creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
  }

  const DEBUT = [
    'AJ SIGNALEMENT',
    'Votre signalement est enregistré',
    'Bonjour,',
    'Votre signalement pour la copropriété Parc Belle Ombre a bien été enregistré sous le numéro B1C2D3E4.',
    'Ce que vous avez déclaré',
    'Numéro', 'B1C2D3E4',
    'Copropriété', 'Parc Belle Ombre',
    'Déposé le', '4 novembre 2026 à 15:05 (heure de Paris)',
    'Vous êtes', 'Propriétaire',
    'Lieu du problème', 'Votre logement (bât. B · étage 4 · lot 12)',
    'Type de problème', 'Plomberie (fuite, colonne, robinetterie)',
    'Urgence', 'Urgent',
    'Description', 'Fuite sous l’évier de la cuisine',
    'Et maintenant ?',
    'Votre signalement a été transmis à l’administrateur de la copropriété, qui pourra vous recontacter au téléphone ou à l’adresse e-mail que vous avez indiqués.',
    'Gardez ce numéro : il permet de retrouver votre signalement si vous en reparlez avec l’administrateur.',
  ]
  const ANNONCE = [
    'Ce message confirme votre signalement. Vous le recevrez à chaque fois que vous en déposez un.',
    'Vous recevrez aussi les informations sur votre immeuble (fuite, coupure, intervention) ; chacune de ces informations comporte un bouton pour ne plus les recevoir.',
  ]
  const AUTOMATIQUE = ['Message automatique : ne répondez pas à cet e-mail.', 'Si vous n’êtes pas à l’origine de ce signalement, ignorez ce message.']
  const INFORMATION = ['Vos coordonnées sont traitées par Cabinet Exemple : Politique de confidentialité']
  const PIED = ['AJ Signalement — un service VITFIX. Cet e-mail a été envoyé automatiquement.']
  const POLITIQUE = { cabinet: 'Cabinet Exemple', url: 'https://cabinet-exemple.test/confidentialite' }

  it.each([
    ['accusé d’origine (ni annonce, ni politique)', {}, [...DEBUT, ...AUTOMATIQUE, ...PIED]],
    ['annonce seule', { annoncerDiffusion: true }, [...DEBUT, ...ANNONCE, ...AUTOMATIQUE, ...PIED]],
    ['politique seule', { politique: POLITIQUE }, [...DEBUT, ...AUTOMATIQUE, ...INFORMATION, ...PIED]],
    ['annonce et politique', { annoncerDiffusion: true, politique: POLITIQUE }, [...DEBUT, ...ANNONCE, ...AUTOMATIQUE, ...INFORMATION, ...PIED]],
  ])('%s : liste exacte des blocs', (_cas, options, attendu) => {
    const { html } = templateConfirmationQr({ copropriete: { nom: 'Parc Belle Ombre' }, signalement: s, ...options })
    expect(blocs(html)).toEqual(attendu)
    // Au plus un lien (la politique), jamais de bouton ni d'image.
    expect((html.match(/href=/g) ?? []).length).toBe('politique' in options ? 1 : 0)
    if ('politique' in options) expect(html).toContain('href="https://cabinet-exemple.test/confidentialite"')
    expect(html).not.toMatch(/<button|<img|display:inline-block/i)
  })
})

describe('formulaire public : information à la collecte (cahier § 6, HF3)', () => {
  const COPRO_ID = COPRO.id
  const CABINET_ID = 'a0000000-0000-4000-8000-00000000000a'
  const POLITIQUE = 'https://cabinet-exemple.test/confidentialite'
  const cabinet = (sur: Record<string, unknown> = {}) => {
    h.etat.lignesTables.signalements_qr_cabinets = { id: CABINET_ID, nom: 'Cabinet Exemple', diffusion_politique_url: POLITIQUE, ...sur }
  }

  it('cabinet avec politique, diffusion possible (raison d’inactivité NULL) : mention avec la partie « diffusion »', async () => {
    cabinet()
    h.etat.fonctions.signalements_qr_diffusion_raison_inactive = () => ({ data: null })
    expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toEqual({ cabinet: 'Cabinet Exemple', politiqueUrl: POLITIQUE, diffusion: true })
    expect(h.rpc).toHaveBeenCalledWith('signalements_qr_diffusion_raison_inactive', { p_copropriete: COPRO_ID })
  })

  it.each(['diffusion_non_activee', 'langue_non_ouverte', 'fin_gestion', 'copropriete_inactive'])(
    'diffusion impossible (%s) : mention sans la partie « diffusion »', async (raison) => {
      cabinet()
      h.etat.fonctions.signalements_qr_diffusion_raison_inactive = () => ({ data: raison })
      expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toEqual({ cabinet: 'Cabinet Exemple', politiqueUrl: POLITIQUE, diffusion: false })
    },
  )

  it('fonction de la règle absente ou en erreur : jamais de promesse de diffusion (diffusion false), mention gardée', async () => {
    cabinet()
    expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toMatchObject({ diffusion: false })
    h.etat.fonctions.signalements_qr_diffusion_raison_inactive = () => ({ error: { code: 'XX000', message: 'boom' } })
    expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toMatchObject({ diffusion: false })
  })

  it.each([
    ['cabinet sans politique', () => cabinet({ diffusion_politique_url: null })],
    ['politique hors format', () => cabinet({ diffusion_politique_url: 'http://exemple.test/p' })],
    ['cabinet introuvable', () => { h.etat.lignesTables.signalements_qr_cabinets = null }],
    ['colonne absente (migration 20261113 non appliquée)', () => {
      h.etat.erreursTables.signalements_qr_cabinets = { code: '42703', message: 'column signalements_qr_cabinets.diffusion_politique_url does not exist' }
    }],
    ['erreur de lecture', () => { h.etat.erreursTables.signalements_qr_cabinets = { code: 'XX000', message: 'boom' } }],
  ])('%s : aucune information (formulaire inchangé), jamais d’exception', async (_cas, poser) => {
    poser()
    h.etat.fonctions.signalements_qr_diffusion_raison_inactive = () => ({ data: null })
    expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toBeNull()
  })

  it('nom du cabinet nettoyé (retours, contrôles) ; nom vide : aucune information', async () => {
    cabinet({ nom: ' Cabinet\nExemple\u0007 ' })
    h.etat.fonctions.signalements_qr_diffusion_raison_inactive = () => ({ data: null })
    expect((await informationFormulaireQr(COPRO_ID, CABINET_ID))?.cabinet).toBe('Cabinet Exemple')
    cabinet({ nom: '  ' })
    expect(await informationFormulaireQr(COPRO_ID, CABINET_ID)).toBeNull()
  })
})
