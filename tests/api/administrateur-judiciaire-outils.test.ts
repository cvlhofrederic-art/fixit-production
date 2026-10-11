// tests/api/administrateur-judiciaire-outils.test.ts
//
// Route des outils IA de la succursale Administrateur judiciaire (analyse de devis, projet de PV, lecture de facture) :
// authentification (rôle syndic ou super admin), validation du corps, contrôle du fichier (type, taille), prompts
// construits, données personnelles masquées puis rétablies, JSON de saisie normalisé. Claude, Supabase et l'auth
// sont simulés ; aucun appel réseau.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Message = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }
type ReponseIA = { choices: Array<{ message: { content: string }; finish_reason?: string }>; model: string }

const h = vi.hoisted(() => ({
  utilisateur: { id: 'u-aj', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } } as Record<string, unknown> | null,
  getSecret: vi.fn(async (cle: string): Promise<string> => (cle === 'ANTHROPIC_API_KEY' ? 'cle-factice' : '')),
  claude: vi.fn(
    async (_opts: { messages: Message[]; max_tokens?: number; response_format?: { type: string } }, _config?: unknown): Promise<ReponseIA> => ({
      choices: [{ message: { content: '## Verdict\n**Conforme**' }, finish_reason: 'stop' }],
      model: 'claude-sonnet-5-5',
    }),
  ),
  limite: vi.fn(async () => true),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/env', () => ({ getSecret: h.getSecret, getCfEnv: vi.fn(async () => ({})), validateEnv: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.limite,
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.utilisateur } }) } })),
}))
vi.mock('@/lib/claude', async (orig) => ({
  ...(await orig<typeof import('@/lib/claude')>()),
  callClaudeWithRetry: h.claude,
  hasAnthropicKey: vi.fn(async () => !!(await h.getSecret('ANTHROPIC_API_KEY'))),
}))
vi.mock('@/lib/langfuse', () => ({ traceAgent: (_p: unknown, fn: () => Promise<unknown>) => fn() }))

const { POST } = await import('@/app/api/administrateur-judiciaire/outils/route')

const requete = (corps: unknown) =>
  new NextRequest('http://localhost/api/administrateur-judiciaire/outils', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })

const texteDe = (contenu: Message['content']) => (typeof contenu === 'string' ? contenu : contenu.map((p) => p.text ?? '').join('\n'))

const DEVIS = [
  'DEVIS n° D-2026-118 — Toitures Nord SARL, SIRET 123 456 789 00012',
  'Contact : 06 12 34 56 78 · devis@toitures-nord.fr',
  'Réfection de la couverture : 120 m² × 95,00 € HT = 11 400,00 € HT',
  'TVA 20 % : 2 280,00 € — Total TTC : 13 680,00 €',
].join('\n')

/** Petite image PNG (en-tête seul) en data URL. */
const PNG = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('facture')]).toString('base64')}`

/** JPEG de `octets` octets (signature FF D8 FF, reste à zéro) en data URL. */
const jpeg = (octets: number) => {
  const tampon = Buffer.alloc(octets)
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(tampon)
  return `data:image/jpeg;base64,${tampon.toString('base64')}`
}

const CONTEXTE_PV = {
  dateDuJour: '2026-06-04',
  mode: 'démonstration (données fictives)',
  copropriete: {
    code: 'CV',
    nom: 'Le Clos des Vignes',
    adresse: '8 rue des Vendanges, 69000 Lyon',
    lots: 48,
    mandat: { fondement: 'art. 29-1 — administration provisoire', tribunal: 'TJ Lyon', rg: '25/01234', ordonnance: '2025-11-03' },
  },
}

describe('/api/administrateur-judiciaire/outils', () => {
  beforeEach(() => {
    h.utilisateur = { id: 'u-aj', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } }
    h.claude.mockClear()
    h.limite.mockClear()
    h.getSecret.mockImplementation(async (cle: string) => (cle === 'ANTHROPIC_API_KEY' ? 'cle-factice' : ''))
  })

  describe('garde et validation', () => {
    it('refuse un visiteur non connecté ou sans rôle syndic', async () => {
      h.utilisateur = null
      expect((await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).status).toBe(401)
      h.utilisateur = { id: 'u-x', email: 'client@exemple.fr', app_metadata: { role: 'client' } }
      expect((await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).status).toBe(401)
      expect(h.claude).not.toHaveBeenCalled()
    })

    it('applique une limite de débit propre aux outils', async () => {
      h.limite.mockResolvedValueOnce(false)
      expect((await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).status).toBe(429)
      expect(h.limite).toHaveBeenCalledWith('aj-outils:127.0.0.1', 20, 60_000)
      expect(h.claude).not.toHaveBeenCalled()
    })

    it('refuse un corps invalide (tâche inconnue, texte vide ou trop long, aucune résolution, fichier absent)', async () => {
      expect((await POST(requete({ tache: 'inconnue', texte: DEVIS }))).status).toBe(400)
      expect((await POST(requete({ tache: 'analyse-devis', texte: '   ' }))).status).toBe(400)
      expect((await POST(requete({ tache: 'analyse-devis', texte: 'x'.repeat(30_001) }))).status).toBe(400)
      expect((await POST(requete({ tache: 'redaction-pv', copropriete: 'Le Clos des Vignes', resolutions: [] }))).status).toBe(400)
      expect((await POST(requete({ tache: 'saisie-facture' }))).status).toBe(400)
      expect(h.claude).not.toHaveBeenCalled()
    })

    it('503 si aucune clé IA n’est configurée ; la lecture de facture exige Claude (pas de secours Groq)', async () => {
      h.getSecret.mockImplementation(async () => '')
      expect((await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).status).toBe(503)
      h.getSecret.mockImplementation(async (cle: string) => (cle === 'GROQ_API_KEY' ? 'cle-groq' : ''))
      expect((await POST(requete({ tache: 'saisie-facture', fichier: PNG }))).status).toBe(503)
      expect((await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).status).toBe(200)
    })

    it('502 si l’appel IA échoue (le client affiche alors un toast, sans résultat fictif)', async () => {
      h.claude.mockRejectedValueOnce(new Error('Claude 500'))
      const res = await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'ia_indisponible' })
    })
  })

  describe('analyse de devis', () => {
    it('envoie le texte collé comme donnée, avec les contrôles demandés, et masque les données personnelles', async () => {
      const res = await POST(requete({ tache: 'analyse-devis', texte: DEVIS, dateDuJour: '2026-06-04' }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ text: '## Verdict\n**Conforme**', modele: 'claude-sonnet-5-5' })

      const [opts, config] = h.claude.mock.calls[0]
      const systeme = texteDe(opts.messages[0].content)
      expect(opts.messages[0].role).toBe('system')
      for (const attendu of ['Cohérence des prix', 'N\'invente aucun référentiel chiffré', '20 %', '10 %', '5,5 %', 'SIRET', 'assurance décennale', 'durée de validité', 'pénalités de retard', '## Points à négocier', '## Verdict', '2026-06-04']) {
        expect(systeme).toContain(attendu)
      }
      const utilisateur = texteDe(opts.messages[1].content)
      expect(utilisateur).toContain('<document>')
      expect(utilisateur).toContain('120 m² × 95,00 € HT')
      expect(utilisateur).not.toContain('06 12 34 56 78')
      expect(utilisateur).not.toContain('devis@toitures-nord.fr')
      expect(opts.max_tokens).toBe(2500)
      expect(opts.response_format).toBeUndefined()
      expect(config).toEqual({ effort: 'medium' })
    })

    it('SIRET d’un bloc et lignes « 25 chemin de câble… » restent lisibles (contrôles du devis)', async () => {
      const texte = 'SIRET 41203456789012\nFourniture et pose 25 chemin de câble 100 mm : 25 ml x 18,00 € HT'
      await POST(requete({ tache: 'analyse-devis', texte }))
      const utilisateur = texteDe(h.claude.mock.calls[0][0].messages[1].content)
      expect(utilisateur).toContain('SIRET 41203456789012')
      expect(utilisateur).toContain('25 chemin de câble 100 mm : 25 ml x 18,00 € HT')
    })

    it('rétablit une donnée masquée recopiée par le modèle et signale une réponse tronquée', async () => {
      h.claude.mockImplementationOnce(async (opts) => {
        const jeton = /<email:[0-9a-f]{8}>/.exec(texteDe(opts.messages[1].content))?.[0] ?? ''
        return { choices: [{ message: { content: `Écrire à ${jeton}` }, finish_reason: 'length' }], model: 'claude-sonnet-5-5' }
      })
      const { text } = await (await POST(requete({ tache: 'analyse-devis', texte: DEVIS }))).json()
      expect(text).toMatch(/^Écrire à devis@toitures-nord\.fr/)
      expect(text).toContain('longueur maximale atteinte')
    })
  })

  describe('projet de procès-verbal', () => {
    it('construit le PV pour la copropriété et les résolutions choisies, avec le mandat, et des marqueurs [À COMPLÉTER]', async () => {
      const res = await POST(requete({
        tache: 'redaction-pv',
        copropriete: 'Le Clos des Vignes',
        resolutions: ['Vote des travaux de toiture', 'Approbation des comptes 2025'],
        dateDuJour: '2026-06-04',
        contexte: CONTEXTE_PV,
      }))
      expect(res.status).toBe(200)

      const [opts, config] = h.claude.mock.calls[0]
      const systeme = texteDe(opts.messages[0].content)
      expect(systeme).toContain('procès-verbal')
      expect(systeme).toContain('[À COMPLÉTER]')
      expect(systeme).toContain('TJ Lyon')
      expect(systeme).toContain('25/01234')
      expect(systeme).toContain('article 42, alinéa 2')
      expect(systeme).toContain('relu')
      // Adresse de l'immeuble masquée avant le modèle.
      expect(systeme).not.toContain('8 rue des Vendanges')
      expect(systeme).not.toContain('Résidence Le Méridien')
      const demande = texteDe(opts.messages[1].content)
      expect(demande).toContain('Copropriété : Le Clos des Vignes')
      expect(demande.indexOf('1. Vote des travaux de toiture')).toBeLessThan(demande.indexOf('2. Approbation des comptes 2025'))
      expect(opts.max_tokens).toBe(4000)
      expect(config).toEqual({ effort: 'medium' })
    })

    it('rétablit l’adresse masquée que le modèle recopie dans le PV', async () => {
      h.claude.mockImplementationOnce(async (opts) => {
        const jeton = /<address:[0-9a-f]{8}>/.exec(texteDe(opts.messages[0].content))?.[0] ?? ''
        return { choices: [{ message: { content: `Immeuble sis ${jeton}` } }], model: 'claude-sonnet-5-5' }
      })
      const res = await POST(requete({ tache: 'redaction-pv', copropriete: 'Le Clos des Vignes', resolutions: ['Quitus au syndic'], contexte: CONTEXTE_PV }))
      expect((await res.json()).text).toBe('Immeuble sis 8 rue des Vendanges')
    })

    it('413 si le contexte envoyé est trop volumineux', async () => {
      const res = await POST(requete({ tache: 'redaction-pv', copropriete: 'X', resolutions: ['Quitus au syndic'], contexte: { bourrage: 'x'.repeat(20_001) } }))
      expect(res.status).toBe(413)
      expect(h.claude).not.toHaveBeenCalled()
    })
  })

  describe('lecture de facture', () => {
    it('fichier refusé par Claude (400) : 422 fichier_illisible, pas « réessayez »', async () => {
      const { ErreurClaude } = await import('@/lib/claude')
      h.claude.mockRejectedValueOnce(new ErreurClaude(400, 'image dimensions exceed'))
      const res = await POST(requete({ tache: 'saisie-facture', fichier: PNG }))
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({ error: 'fichier_illisible' })
    })

    it('plus de 50 copropriétés : liste tronquée, requête acceptée', async () => {
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: REPONSE_JSON } }], model: 'claude-sonnet-5-5' })
      const coproprietes = Array.from({ length: 60 }, (_, i) => ({ nom: `Copro ${i}`, adresse: `${i} rue X` }))
      const res = await POST(requete({ tache: 'saisie-facture', fichier: PNG, coproprietes }))
      expect(res.status).toBe(200)
      const systeme = texteDe(h.claude.mock.calls[0][0].messages[0].content)
      expect(systeme).toContain('Copro 49')
      expect(systeme).not.toContain('Copro 50')
    })

    const REPONSE_JSON = JSON.stringify({
      fournisseur: 'Plomberie Centrale',
      siret: '12345678900012',
      numero: 'FAC-2026-077',
      date: '2026-05-28',
      montant_ht: '1 000,00',
      tva: 100,
      montant_ttc: 1100,
      copropriete_probable: 'Le Clos des Vignes',
      compte_charge_suggere: '615 — Entretien et petites réparations',
      libelle: 'Remplacement colonne EF bât. B',
      inattendu: 'ignoré',
    })

    it('accepte une image, la transmet intacte à Claude (vision) en mode JSON et renvoie la facture normalisée', async () => {
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: REPONSE_JSON }, finish_reason: 'stop' }], model: 'claude-sonnet-5-5' })
      const res = await POST(requete({
        tache: 'saisie-facture',
        fichier: PNG,
        nomFichier: 'facture-plomberie.png',
        coproprietes: [{ nom: 'Le Clos des Vignes', adresse: '8 rue des Vendanges, 69000 Lyon' }],
      }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        facture: {
          fournisseur: 'Plomberie Centrale',
          siret: '12345678900012',
          numero: 'FAC-2026-077',
          date: '2026-05-28',
          montant_ht: 1000,
          tva: 100,
          montant_ttc: 1100,
          copropriete_probable: 'Le Clos des Vignes',
          compte_charge_suggere: '615 — Entretien et petites réparations',
          libelle: 'Remplacement colonne EF bât. B',
        },
        modele: 'claude-sonnet-5-5',
      })

      const [opts, config] = h.claude.mock.calls[0]
      const contenu = opts.messages[1].content as Array<{ type: string; text?: string; image_url?: { url: string } }>
      expect(contenu[0]).toEqual({ type: 'image_url', image_url: { url: PNG } })
      expect(contenu[1].text).toContain('facture-plomberie.png')
      const systeme = texteDe(opts.messages[0].content)
      for (const cle of ['fournisseur', 'siret', 'numero', 'montant_ht', 'tva', 'montant_ttc', 'copropriete_probable', 'compte_charge_suggere', 'libelle']) {
        expect(systeme).toContain(`"${cle}"`)
      }
      expect(systeme).toContain('Le Clos des Vignes')
      // Adresse de l'immeuble en clair : elle sert à reconnaître la copropriété sur la facture.
      expect(systeme).toContain('8 rue des Vendanges, 69000 Lyon')
      expect(opts.response_format).toEqual({ type: 'json_object' })
      expect(config).toEqual({ effort: 'low', disableGroqFallback: true })
    })

    it('accepte un PDF', async () => {
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: REPONSE_JSON } }], model: 'claude-sonnet-5-5' })
      const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.7 facture').toString('base64')}`
      const res = await POST(requete({ tache: 'saisie-facture', fichier: pdf }))
      expect(res.status).toBe(200)
      expect((h.claude.mock.calls[0][0].messages[1].content as Array<{ image_url?: { url: string } }>)[0].image_url?.url).toBe(pdf)
    })

    it('400 pour un format non pris en charge ou une data URL mal formée', async () => {
      const gif = `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`
      for (const fichier of [gif, 'https://exemple.fr/facture.png', 'data:image/png;base64,@@@', 'data:application/pdf;base64,']) {
        const res = await POST(requete({ tache: 'saisie-facture', fichier }))
        expect(res.status).toBe(400)
        expect(await res.json()).toEqual({ error: 'format_non_pris_en_charge' })
      }
      expect(h.claude).not.toHaveBeenCalled()
    })

    it('413 au-delà de 4 Mo décodés', async () => {
      const lourd = jpeg(4 * 1024 * 1024 + 3)
      const res = await POST(requete({ tache: 'saisie-facture', fichier: lourd }))
      expect(res.status).toBe(413)
      expect(await res.json()).toEqual({ error: 'fichier_trop_volumineux' })
      // Exactement 4 Mo : accepté.
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: REPONSE_JSON } }], model: 'claude-sonnet-5-5' })
      const limite = jpeg(4 * 1024 * 1024)
      expect((await POST(requete({ tache: 'saisie-facture', fichier: limite }))).status).toBe(200)
    })

    it('413 dès l’en-tête Content-Length quand le corps dépasse la taille admise', async () => {
      const req = new NextRequest('http://localhost/api/administrateur-judiciaire/outils', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(7_000_000) },
        body: JSON.stringify({ tache: 'saisie-facture', fichier: PNG }),
      })
      expect((await POST(req)).status).toBe(413)
      expect(h.claude).not.toHaveBeenCalled()
    })

    it('502 si la réponse n’est pas un JSON exploitable', async () => {
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: 'Je ne peux pas lire ce document.' } }], model: 'claude-sonnet-5-5' })
      const res = await POST(requete({ tache: 'saisie-facture', fichier: PNG }))
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ error: 'reponse_invalide' })
      h.claude.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ fournisseur: null, montant_ttc: null }) } }], model: 'claude-sonnet-5-5' })
      expect((await POST(requete({ tache: 'saisie-facture', fichier: PNG }))).status).toBe(502)
    })
  })
})
