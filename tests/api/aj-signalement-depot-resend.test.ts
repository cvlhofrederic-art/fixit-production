// tests/api/aj-signalement-depot-resend.test.ts
//
// POST /api/aj-signalement/signalements (dépôt public) avec le VRAI lib/email.ts (sendBatchEmails → batch.send,
// sendEmail → emails.send) : seul le SDK resend est simulé. Les autres tests des routes simulent @/lib/email ; celui-ci
// vérifie ce que Resend reçoit vraiment, depuis que les destinataires passent de emails.send à batch.send :
//   - un message par adresse saisie (un seul `to` chacun : personne ne voit les autres), réponse au déclarant
//     (replyTo, que le SDK transmet en reply_to), étiquette « aj-signalement » ; le récapitulatif au déclarant part
//     par emails.send ;
//   - lot refusé par Resend (une adresse refusée suffit) : renvoi un par un, email_erreur résumé sans adresse ;
//   - copropriété sans adresse saisie : un message à ADMIN_EMAIL, avec le bouton du tableau.
// Base : la production d'avant la migration du 11/11/2026 (colonnes du 06/11 présentes, migrations appliquées le
// 11/11/2026 ; tables, colonnes et fonctions du 11/11 absentes). Données fictives (@exemple.test, @externe.test).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const resend = vi.hoisted(() => ({
  lots: [] as unknown[][],
  simples: [] as unknown[],
  cles: [] as Array<string | undefined>,
  /** Réponse de chaque appel de batch.send (dans l'ordre) ; vide : lot accepté. */
  reponsesLot: [] as Array<{ data: unknown; error: unknown }>,
}))

vi.mock('resend', () => ({
  Resend: class {
    constructor(cle?: string) { resend.cles.push(cle) }
    emails = {
      send: async (message: unknown) => {
        resend.simples.push(message)
        return { data: { id: 'simple' }, error: null }
      },
    }
    batch = {
      send: async (lot: unknown[]) => {
        resend.lots.push(lot)
        return resend.reponsesLot.shift() ?? { data: { data: lot.map((_, i) => ({ id: `lot-${i}` })) }, error: null }
      },
    }
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST } = await import('@/app/api/aj-signalement/signalements/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const JETON = '0123456789abcdef0123456789abcdef'
const JETON_SANS_ADRESSE = 'ffffffffffffffffffffffffffffffff'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const CORPS = {
  jeton: JETON, prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'Declarant@Exemple.test',
  batiment: 'A', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'normale', langue: 'fr', qualiteDeclarant: 'locataire',
}
/** Structure de la migration du 11/11/2026, absente de la production tant qu'elle n'est pas appliquée. */
const TABLES_1111 = [
  'signalements_qr_cabinets', 'signalements_qr_domaines_autorises', 'signalements_qr_gestionnaires', 'signalements_qr_invitations',
  'signalements_qr_attributions', 'signalements_qr_journal', 'signalements_qr_operations',
]
const COLONNES_1111 = {
  signalements_qr_coproprietes: ['cabinet_id', 'code_postal', 'ville', 'immatriculation', 'reference_cabinet', 'batiments', 'attribuee_a_tous', 'cle_nom', 'cree_par_gestionnaire_id', 'operation_id'],
  signalements_qr: ['statut_modifie_le', 'statut_modifie_par', 'statut_modifie_profil', 'nb_emails_envoyes', 'email_retenu'],
}

type MessageResend = {
  from?: string; to: string[]; subject: string; html: string; replyTo?: string; cc?: unknown; bcc?: unknown
  tags?: Array<{ name: string; value: string }>
}

beforeEach(() => {
  resend.lots = []
  resend.simples = []
  resend.reponsesLot = []
  reinitialiserSimulQr()
  simulQr.user = null
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('RESEND_API_KEY', 're_test_simule')
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  baseQr.etat.tables.signalements_qr_coproprietes = [
    { id: COPRO, nom: 'Résidence Test', adresse: '1 rue Exemple', jeton: JETON, actif: true, created_at: '2026-11-01T09:00:00+00:00', emails_destinataires: ['cs@externe.test', 'gestion@exemple.test'] },
    { id: 'c0000000-0000-4000-8000-000000000002', nom: 'Les Tilleuls', adresse: '', jeton: JETON_SANS_ADRESSE, actif: true, created_at: '2026-11-02T09:00:00+00:00', emails_destinataires: [] },
  ]
  baseQr.etat.tables.signalements_qr = []
  baseQr.etat.tablesAbsentes = [...TABLES_1111]
  baseQr.etat.colonnesAbsentes = { ...COLONNES_1111 }
})

const deposer = (corps: Record<string, unknown> = CORPS) => POST(requeteQr('/api/aj-signalement/signalements', 'POST', corps))
const etatFinal = () => baseQr.ecrituresDe('signalements_qr', 'update').map((e) => e.valeurs as Record<string, unknown>).find((v) => 'email_envoye_le' in v)

describe('dépôt public, vrai lib/email.ts, SDK Resend simulé', () => {
  it('lot : un message par adresse saisie, réponse au déclarant, étiquette ; récapitulatif au déclarant par emails.send', async () => {
    const res = await deposer()
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true, confirmationEnvoyee: true })
    expect(resend.cles.at(-1)).toBe('re_test_simule')

    expect(resend.lots).toHaveLength(1)
    const lot = resend.lots[0] as MessageResend[]
    expect(lot.map((m) => m.to)).toEqual([['cs@externe.test'], ['gestion@exemple.test']])
    for (const m of lot) {
      expect(m.replyTo).toBe('declarant@exemple.test')
      expect(m.tags).toEqual([{ name: 'type', value: 'aj-signalement' }])
      expect(m.cc).toBeUndefined()
      expect(m.bcc).toBeUndefined()
      expect(m.from).toEqual(expect.any(String))
      // Adresse saisie : pas de bouton vers l'espace ; aucune autre adresse destinataire dans le message.
      expect(m.html).not.toContain('Ouvrir le tableau des signalements')
      for (const autre of lot.filter((x) => x !== m)) expect(m.html).not.toContain(autre.to[0])
    }

    expect(resend.simples).toHaveLength(1)
    expect((resend.simples[0] as MessageResend).to).toEqual(['declarant@exemple.test'])
    expect((resend.simples[0] as MessageResend).tags).toEqual([{ name: 'type', value: 'aj-signalement-confirmation' }])
    expect(etatFinal()).toMatchObject({ email_envoye_le: expect.any(String), email_erreur: null, confirmation_envoyee_le: expect.any(String) })
  })

  it('lot refusé par Resend (validation stricte) : renvoi un par un, tout part, email_erreur vide', async () => {
    resend.reponsesLot = [{ data: null, error: { message: 'Invalid `to` field: gestion@exemple.test', name: 'validation_error' } }]
    expect((await deposer()).status).toBe(200)
    expect(resend.lots.map((l) => l.length)).toEqual([2, 1, 1])
    expect(resend.lots.slice(1).map((l) => (l[0] as MessageResend).to)).toEqual([['cs@externe.test'], ['gestion@exemple.test']])
    expect(etatFinal()).toMatchObject({ email_envoye_le: expect.any(String), email_erreur: null })
  })

  it('lot refusé puis une adresse refusée seule : les autres partent ; email_erreur résumé, sans adresse ni texte du service', async () => {
    resend.reponsesLot = [
      { data: null, error: { message: 'Invalid `to` field: gestion@exemple.test', name: 'validation_error' } },
      { data: { data: [{ id: 'lot-0' }] }, error: null },
      { data: null, error: { message: 'Invalid `to` field: gestion@exemple.test', name: 'validation_error' } },
    ]
    const res = await deposer()
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true })
    const final = etatFinal() as Record<string, unknown>
    expect(final.email_erreur).toBe('1 envoi(s) sur 2 refusé(s) par le service d’e-mail')
    expect(JSON.stringify(final)).not.toContain('gestion@exemple.test')
    expect(texteJournalServeurQr()).not.toMatch(/gestion@exemple|Invalid/)
  })

  it('copropriété sans adresse saisie : un message à ADMIN_EMAIL, avec le bouton du tableau', async () => {
    expect((await deposer({ ...CORPS, jeton: JETON_SANS_ADRESSE })).status).toBe(200)
    const lot = resend.lots[0] as MessageResend[]
    expect(lot.map((m) => m.to)).toEqual([['admin@exemple.test']])
    expect(lot[0].replyTo).toBe('declarant@exemple.test')
    expect(lot[0].html).toContain('Ouvrir le tableau des signalements')
    expect(lot[0].html).toContain('https://vitfix.io/fr/aj-signalement/#signalements')
  })
})
