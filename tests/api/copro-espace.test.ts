// tests/api/copro-espace.test.ts
//
// GET /api/coproprietaire/espace — tout l'espace du copropriétaire connecté en un appel.
//   - refus : 401 sans utilisateur, 403 rôle étranger ou accès non activé, 404 sans fiche ;
//   - copropriétaire : chaque table est lue sur SON cabinet (celui de sa fiche), les signalements sur
//     son e-mail en minuscules, les missions sur son immeuble, charges / factures / impayés sur sa fiche,
//     les documents seulement si l'immeuble est retrouvé et s'ils sont publiés, les votes sur ses fiches ;
//     rien de privé (locataire, téléphone, accès au logement, notes, e-mail d'un voisin) ; jamais de cache ;
//   - une table en erreur (colonne absente, migration non appliquée) est journalisée et rendue vide ;
//   - locataire : ni finances, ni assemblées, ni montants ;
//   - super admin avec ?email= : fiche de son cabinet, vueSuperAdmin ; ?lot= choisit le lot affiché.
// La route est testée par son GET exporté ; Supabase est simulé par un client en mémoire qui applique
// eq / neq / ilike / in / is / not / or / order / limit comme PostgREST, table par table.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  type LigneH = Record<string, unknown>
  type FiltreH = { op: string; colonne: string; valeur: unknown }
  type Requete = { table: string; filtres: FiltreH[]; colonnes: string; limite: number | null; tri: { colonne: string; croissant: boolean } | null }

  const etat = {
    user: null as null | LigneH,
    tables: {} as Record<string, LigneH[]>,
    /** `siColonnes` : l'erreur ne vaut que pour un select qui contient ce texte (colonne absente, repli attendu). */
    erreurs: {} as Record<string, { code: string; message: string; siColonnes?: string }>,
    requetes: [] as Requete[],
  }

  /** Motif LIKE de PostgREST → expression régulière (% et * = .*, _ = ., \x = x littéral). */
  const motifVersRegex = (motif: string): RegExp => {
    let source = ''
    for (let i = 0; i < motif.length; i++) {
      const c = motif[i]
      if (c === '\\' && i + 1 < motif.length) { source += motif[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
      if (c === '%' || c === '*') source += '.*'
      else if (c === '_') source += '.'
      else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    return new RegExp(`^${source}$`, 'i')
  }

  /** Valeur d'une colonne, chemins JSON compris (metadata->document, ordre_mission->>syndic_mission_id). */
  const lire = (ligne: LigneH, colonne: string): unknown => {
    let v: unknown = ligne
    for (const partie of colonne.split(/->>?/)) {
      if (v === null || typeof v !== 'object') return undefined
      v = (v as LigneH)[partie]
    }
    return v
  }

  const passe = (ligne: LigneH, f: FiltreH): boolean => {
    const v = lire(ligne, f.colonne)
    switch (f.op) {
      case 'eq': return v === f.valeur
      case 'neq': return v !== f.valeur
      case 'is': return f.valeur === null ? v === null || v === undefined : v === f.valeur
      case 'in': return Array.isArray(f.valeur) && f.valeur.includes(v)
      case 'ilike': return typeof v === 'string' && motifVersRegex(String(f.valeur)).test(v)
      case 'not': return !passe(ligne, f.valeur as FiltreH)
      case 'or': return String(f.valeur).split(',').some(cond => {
        const [colonne, op, ...reste] = cond.split('.')
        return passe(ligne, { op, colonne, valeur: reste.join('.') })
      })
      default: return true
    }
  }

  const comparer = (a: unknown, b: unknown): number =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''))

  const from = (table: string) => {
    const requete: Requete = { table, filtres: [], colonnes: '', limite: null, tri: null }
    etat.requetes.push(requete)
    let unique = false
    const resultat = () => {
      const erreur = etat.erreurs[table]
      if (erreur && (!erreur.siColonnes || requete.colonnes.includes(erreur.siColonnes))) return { data: null, error: { code: erreur.code, message: erreur.message } }
      let data = (etat.tables[table] ?? []).filter(l => requete.filtres.every(f => passe(l, f)))
      if (requete.tri) {
        const { colonne, croissant } = requete.tri
        data = [...data].sort((x, y) => comparer(lire(x, colonne), lire(y, colonne)) * (croissant ? 1 : -1))
      }
      if (requete.limite !== null) data = data.slice(0, requete.limite)
      return unique ? { data: data[0] ?? null, error: null } : { data, error: null }
    }
    const q: Record<string, unknown> = {}
    q.select = (colonnes = '*') => { requete.colonnes = colonnes; return q }
    for (const op of ['eq', 'neq', 'ilike', 'in', 'is']) {
      q[op] = (colonne: string, valeur: unknown) => { requete.filtres.push({ op, colonne, valeur }); return q }
    }
    q.not = (colonne: string, op: string, valeur: unknown) => { requete.filtres.push({ op: 'not', colonne, valeur: { op, colonne, valeur } }); return q }
    q.or = (expression: string) => { requete.filtres.push({ op: 'or', colonne: '', valeur: expression }); return q }
    q.order = (colonne: string, options?: { ascending?: boolean }) => { requete.tri = { colonne, croissant: options?.ascending !== false }; return q }
    q.limit = (n: number) => { requete.limite = n; return q }
    q.maybeSingle = () => { unique = true; return q }
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko)
    return q
  }

  return { etat, from, loggerError: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.etat.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))

const { GET } = await import('@/app/api/coproprietaire/espace/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ID_FICHE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const ID_FICHE_2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const ID_FICHE_VOISIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'
const ID_FICHE_AUTRE_CABINET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1'
const IMMEUBLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
const SIG_MOI = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const SIG_VOISIN = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
const AG_1 = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
const RES_1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'

const EMAIL_MOI = 'geraldine.xavier@email.com'
const EMAIL_VOISIN = 'voisin@exemple.fr'
const NOTE_INTERNE = 'Note interne du cabinet : procédure en cours'
const LOCATAIRE_MISSION = 'M. Voisin Locataire'
const TELEPHONE_LOCATAIRE = '06 99 99 99 99'
const ACCES_LOGEMENT = 'Clé sous le paillasson'

function fiche(surcharge: Ligne = {}): Ligne {
  return {
    id: ID_FICHE_1, cabinet_id: CABINET, immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
    nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
    tel_proprietaire: '06 12 34 56 78', nom_locataire: 'Durand', prenom_locataire: 'Paul', email_locataire: 'Paul.Durand@Exemple.fr',
    tel_locataire: '06 00 00 00 00', est_occupe: true, tantieme: 450, solde: -855, acces_portail: true,
    acces_portail_locataire: true, notes: NOTE_INTERNE,
    ...surcharge,
  }
}

function utilisateur(role: string, email = EMAIL_MOI, surcharge: Ligne = {}): Ligne {
  return { id: 'u-copro', email, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { role }, ...surcharge }
}

/** Base complète : un cabinet, un immeuble, deux lots (le mien et celui d'un voisin), des lignes de chaque table. */
function baseComplete(): Record<string, Ligne[]> {
  return {
    syndic_coproprios: [
      fiche(),
      fiche({ id: ID_FICHE_VOISIN, email_proprietaire: EMAIL_VOISIN, nom_proprietaire: 'Voisin', prenom_proprietaire: 'Victor', numero_porte: '7', tantieme: 550, solde: -2000 }),
      // Même nom d'immeuble dans un autre cabinet : jamais lu (filtre cabinet_id).
      fiche({ id: ID_FICHE_AUTRE_CABINET, cabinet_id: AUTRE_CABINET, immeuble: 'Résidence Le Prado', email_proprietaire: 'autre.personne@exemple.fr' }),
    ],
    syndic_immeubles: [
      { id: IMMEUBLE_ID, cabinet_id: CABINET, nom: 'Résidence Le Prado', adresse: '12 avenue du Prado', ville: 'Marseille', code_postal: '13008', nb_lots: 2, annee_construction: 1972, type_immeuble: 'copropriete', gestionnaire: 'A. Martin', budget_annuel: 48000, depenses_annee: 12000, reglement_texte: 'Règlement', reglement_pdf_nom: null, reglement_date_maj: '2025-01-01', reglement_charges_repartition: 'tantièmes', reglement_majorite_ag: 'art24', reglement_fonds_travaux: true, reglement_fonds_roulement_pct: 5 },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', cabinet_id: AUTRE_CABINET, nom: 'Résidence Le Prado', nb_lots: 9 },
    ],
    syndic_cabinets: [
      { id: CABINET, user_id: CABINET, nom: 'Cabinet Prado Gestion', adresse: '1 rue Paradis', ville: 'Marseille', code_postal: '13001', telephone: '04 91 00 00 00', email: 'Contact@Prado.fr' },
      { id: AUTRE_CABINET, user_id: AUTRE_CABINET, nom: 'Autre Cabinet' },
    ],
    syndic_signalements: [
      { id: SIG_MOI, cabinet_id: CABINET, demandeur_email: EMAIL_MOI, type_intervention: 'Plomberie', description: 'Fuite salle de bain', priorite: 'urgente', statut: 'acceptee', batiment: 'D', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: null, artisan_assigne: 'Plomberie du Vieux-Port', created_at: '2026-10-10T08:00:00Z', updated_at: '2026-10-11T08:00:00Z', deleted_at: null, origine: 'public',
        syndic_signalement_messages: [{ id: 'm1', auteur: 'Syndic', role: 'syndic', texte: 'Pris en charge', created_at: '2026-10-10T09:00:00Z' }] },
      { id: SIG_VOISIN, cabinet_id: CABINET, demandeur_email: EMAIL_VOISIN, type_intervention: 'Serrurerie', description: 'Porte bloquée', priorite: 'normale', statut: 'en_attente', created_at: '2026-10-09T08:00:00Z', deleted_at: null },
    ],
    syndic_missions: [
      // Partie commune : visible par tous, mais locataire / téléphone / accès ne sont jamais servis.
      { id: 'mis-commune', cabinet_id: CABINET, immeuble: 'Résidence Le Prado', signalement_id: null, artisan: 'Ascenseurs Sud', type: 'Ascenseur', description: 'Révision annuelle', priorite: 'normale', statut: 'en_cours', date_creation: '2026-10-05', date_intervention: '2026-10-20', montant_devis: 1200, montant_facture: null, batiment: null, etage: null, num_lot: null, locataire: LOCATAIRE_MISSION, telephone_locataire: TELEPHONE_LOCATAIRE, acces_logement: ACCES_LOGEMENT, demandeur_email: null, est_partie_commune: true, zone_signalee: 'Hall', travail_effectue: null, materiaux_utilises: null, problemes_constates: null, recommandations: null, date_rapport: null, duree_intervention: null, created_at: '2026-10-05T08:00:00Z', deleted_at: null },
      // Ma demande, devenue mission : la mienne.
      { id: 'mis-moi', cabinet_id: CABINET, immeuble: 'Résidence Le Prado', signalement_id: SIG_MOI, artisan: 'Plomberie du Vieux-Port', type: 'Plomberie', description: 'Fuite salle de bain', priorite: 'urgente', statut: 'acceptee', date_creation: '2026-10-11', date_intervention: '2026-10-15', montant_devis: 640, montant_facture: null, batiment: 'D', etage: '4', num_lot: '12', locataire: null, telephone_locataire: null, acces_logement: null, demandeur_email: EMAIL_MOI, est_partie_commune: false, zone_signalee: null, travail_effectue: null, materiaux_utilises: null, problemes_constates: null, recommandations: null, date_rapport: null, duree_intervention: null, created_at: '2026-10-11T08:00:00Z', deleted_at: null },
      // Lot privé d'un voisin : jamais montré.
      { id: 'mis-voisin', cabinet_id: CABINET, immeuble: 'Résidence Le Prado', signalement_id: SIG_VOISIN, artisan: 'Serrurerie Dupont', type: 'Serrurerie', description: 'Porte bloquée chez le voisin', priorite: 'normale', statut: 'en_cours', date_creation: '2026-10-09', date_intervention: null, montant_devis: 300, montant_facture: null, batiment: 'D', etage: '2', num_lot: '7', locataire: 'Mme Dupont', telephone_locataire: '06 77 77 77 77', acces_logement: 'Interphone 7', demandeur_email: EMAIL_VOISIN, est_partie_commune: false, zone_signalee: null, travail_effectue: null, materiaux_utilises: null, problemes_constates: null, recommandations: null, date_rapport: null, duree_intervention: null, created_at: '2026-10-09T08:00:00Z', deleted_at: null },
      // Autre immeuble du cabinet : hors périmètre.
      { id: 'mis-ailleurs', cabinet_id: CABINET, immeuble: 'Résidence Bellecour', signalement_id: null, artisan: 'X', type: 'Toiture', description: 'Ailleurs', priorite: 'normale', statut: 'en_cours', est_partie_commune: true, created_at: '2026-10-01T08:00:00Z', deleted_at: null },
    ],
    syndic_appels_charges: [
      { id: 'ap-moi', cabinet_id: CABINET, coproprio_id: ID_FICHE_1, exercice: '2026-T4', periode_debut: '2026-10-01', periode_fin: '2026-12-31', montant_total: 855, montant_paye: 0, statut: 'a_payer', echeance: '2026-10-31', iban: 'FR76 0000', reference_paiement: 'PRADO-12' },
      { id: 'ap-voisin', cabinet_id: CABINET, coproprio_id: ID_FICHE_VOISIN, exercice: '2026-T4', periode_debut: '2026-10-01', periode_fin: '2026-12-31', montant_total: 2000, montant_paye: 0, statut: 'en_retard', echeance: '2026-10-31' },
    ],
    syndic_factures_copro: [
      { id: 'fa-moi', cabinet_id: CABINET, coproprio_id: ID_FICHE_1, numero_facture: 'F-2026-001', emise_le: '2026-09-01', echeance: '2026-09-30', montant_ht: 100, tva_taux: 20, montant_ttc: 120, description: 'Frais', statut: 'a_regler', pdf_url: 'factures/F-2026-001.pdf' },
      { id: 'fa-voisin', cabinet_id: CABINET, coproprio_id: ID_FICHE_VOISIN, numero_facture: 'F-2026-002', emise_le: '2026-09-01', montant_ttc: 500, statut: 'a_regler', pdf_url: null },
    ],
    syndic_impayes: [
      { id: 'im-moi', cabinet_id: CABINET, coproprio_id: ID_FICHE_1, montant: 855, nature: 'charges_courantes', depuis: '2026-07-01', nb_relances: 1, derniere_relance_at: '2026-09-01', statut: 'ouvert' },
      { id: 'im-voisin', cabinet_id: CABINET, coproprio_id: ID_FICHE_VOISIN, montant: 2000, nature: 'travaux', depuis: '2026-01-01', nb_relances: 3, statut: 'en_recouvrement' },
    ],
    syndic_contrats: [
      { id: 'co-1', cabinet_id: CABINET, immeuble: 'Résidence Le Prado', fornecedor: 'Nettoyage Sud', categoria: 'limpezas', custo_mensal: 400, custo_anual: 4800, data_inicio: '2026-01-01', data_fim: '2026-12-31', statut: 'ativo' },
    ],
    syndic_seguros: [
      { id: 'se-1', cabinet_id: CABINET, immeuble: 'Résidence Le Prado', seguradora: 'AXA', tipo: 'multirriscos', apolice: 'P-1', premio_anual: 3000, capital: 2000000, data_inicio: '2026-01-01', data_fim: '2026-12-31', statut: 'ativa' },
    ],
    syndic_assemblees: [
      { id: AG_1, cabinet_id: CABINET, titre: 'AG ordinaire 2026', immeuble: 'Résidence Le Prado', date_ag: '2026-11-20T18:00:00Z', lieu: 'Salle commune', type_ag: 'ordinaire', statut: 'convoquée', ordre_du_jour: ['Budget 2027'], total_tantiemes: 1000, pv_content: null, convocation_sent_at: '2026-10-15T08:00:00Z' },
      { id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', cabinet_id: CABINET, titre: 'Brouillon', immeuble: 'Résidence Le Prado', date_ag: '2027-01-01', statut: 'brouillon' },
    ],
    syndic_resolutions: [
      { id: RES_1, cabinet_id: CABINET, assemblee_id: AG_1, titre: 'Ravalement', description: 'Façade nord', numero_ordre: 1, majorite: 'art25', vote_pour: 300, vote_contre: 0, vote_abstention: 0, statut: 'en_cours' },
    ],
    syndic_votes_correspondance: [
      { id: 'v-moi', cabinet_id: CABINET, resolution_id: RES_1, coproprio_id: ID_FICHE_1, vote: 'pour', date_reception: '2026-10-16' },
      { id: 'v-voisin', cabinet_id: CABINET, resolution_id: RES_1, coproprio_id: ID_FICHE_VOISIN, vote: 'contre', date_reception: '2026-10-16' },
    ],
    syndic_avisos: [
      { id: 'av-1', cabinet_id: CABINET, immeuble: null, titulo: 'Coupure d’eau', descricao: 'Mardi 9h-12h', categoria: 'manutencao', prioridade: 'importante', fixado: true, created_at: '2026-10-12T08:00:00Z' },
      { id: 'av-2', cabinet_id: CABINET, immeuble: 'Résidence Bellecour', titulo: 'Ailleurs', descricao: 'x', categoria: 'outro', prioridade: 'normal', fixado: false, created_at: '2026-10-12T08:00:00Z' },
    ],
    syndic_documents: [
      { id: 'doc-pv', cabinet_id: CABINET, immeuble_id: IMMEUBLE_ID, filename: 'PV AG 2025.pdf', mime_type: 'application/pdf', size_bytes: 1024, type: 'pv_assemblee', status: 'ready', tags: ['ag'], uploaded_at: '2026-10-01T08:00:00Z', publie_extranet: true, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: 'pv_ag' },
      { id: 'doc-non-publie', cabinet_id: CABINET, immeuble_id: IMMEUBLE_ID, filename: 'Devis brouillon.pdf', type: 'devis', status: 'ready', uploaded_at: '2026-10-02T08:00:00Z', publie_extranet: false, espace_extranet: 'commun' },
      { id: 'doc-rib', cabinet_id: CABINET, immeuble_id: IMMEUBLE_ID, filename: 'RIB cabinet.pdf', type: 'rib', status: 'ready', uploaded_at: '2026-10-03T08:00:00Z', publie_extranet: true, espace_extranet: 'commun' },
      { id: 'doc-perso-voisin', cabinet_id: CABINET, immeuble_id: IMMEUBLE_ID, filename: 'Relevé voisin.pdf', type: 'autre', status: 'ready', uploaded_at: '2026-10-04T08:00:00Z', publie_extranet: true, espace_extranet: 'personnel', coproprio_id: ID_FICHE_VOISIN },
    ],
    conversation_messages: [],
    conversations: [],
  }
}

// ── Outils ───────────────────────────────────────────────────────────────────

const lire = (url = 'https://vitfix.io/api/coproprietaire/espace') => GET(new NextRequest(url, { headers: { Authorization: 'Bearer jeton-test' } }))
const requetesSur = (table: string) => h.etat.requetes.filter(r => r.table === table)
const filtres = (table: string, n = 0): Array<[string, string, unknown]> =>
  (requetesSur(table)[n]?.filtres ?? []).map(f => [f.op, f.colonne, f.valeur] as [string, string, unknown])

/** Tables de l'espace qui doivent toutes être lues sur le cabinet de la fiche. */
const TABLES_CABINET = [
  'syndic_immeubles', 'syndic_signalements', 'syndic_missions', 'syndic_appels_charges', 'syndic_factures_copro',
  'syndic_impayes', 'syndic_contrats', 'syndic_seguros', 'syndic_assemblees', 'syndic_avisos', 'syndic_documents',
  'syndic_resolutions', 'syndic_votes_correspondance',
]
/** Tables réservées au propriétaire : jamais lues pour un locataire. */
const TABLES_PROPRIETAIRE = ['syndic_appels_charges', 'syndic_factures_copro', 'syndic_impayes', 'syndic_contrats', 'syndic_seguros', 'syndic_assemblees', 'syndic_documents']

beforeEach(() => {
  h.etat.user = null
  h.etat.tables = baseComplete()
  h.etat.erreurs = {}
  h.etat.requetes = []
  h.loggerError.mockClear()
})

describe('GET /api/coproprietaire/espace — refus', () => {
  it('sans utilisateur → 401 non_authentifie, aucune lecture', async () => {
    const res = await lire()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'non_authentifie' })
    expect(h.etat.requetes).toHaveLength(0)
  })

  it('rôle artisan → 403 role_interdit, aucune lecture', async () => {
    h.etat.user = utilisateur('artisan', 'artisan@exemple.fr')
    const res = await lire()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'role_interdit' })
    expect(h.etat.requetes).toHaveLength(0)
  })

  it('accès non activé par le syndic → 403 acces_non_active', async () => {
    h.etat.user = utilisateur('coproprio')
    h.etat.tables.syndic_coproprios = [fiche({ acces_portail: false })]
    const res = await lire()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'acces_non_active' })
    // Seule la fiche a été cherchée : rien de l'espace n'a été lu.
    expect(h.etat.requetes.map(r => r.table)).toEqual(['syndic_coproprios'])
  })

  it('aucune fiche à cet e-mail → 404 fiche_introuvable', async () => {
    h.etat.user = utilisateur('coproprio', 'inconnue@exemple.fr')
    const res = await lire()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'fiche_introuvable' })
  })
})

describe('GET /api/coproprietaire/espace — copropriétaire', () => {
  beforeEach(() => { h.etat.user = utilisateur('coproprio', 'Geraldine.Xavier@Email.com') })

  it('toutes les tables sont lues sur le cabinet de la fiche, le syndic par son id', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    for (const table of TABLES_CABINET) {
      expect(filtres(table), table).toContainEqual(['eq', 'cabinet_id', CABINET])
    }
    expect(filtres('syndic_cabinets')).toContainEqual(['or', '', `id.eq.${CABINET},user_id.eq.${CABINET}`])
    expect(filtres('syndic_coproprios', 1)).toContainEqual(['eq', 'cabinet_id', CABINET])
  })

  it('signalements sur mon e-mail en minuscules, missions sur mon immeuble, finances sur ma fiche, votes sur mes fiches', async () => {
    await lire()
    expect(filtres('syndic_signalements')).toContainEqual(['eq', 'demandeur_email', EMAIL_MOI])
    expect(filtres('syndic_signalements')).toContainEqual(['is', 'deleted_at', null])
    expect(filtres('syndic_missions')).toContainEqual(['ilike', 'immeuble', 'Résidence Le Prado'])
    for (const table of ['syndic_appels_charges', 'syndic_factures_copro', 'syndic_impayes']) {
      expect(filtres(table), table).toContainEqual(['eq', 'coproprio_id', ID_FICHE_1])
    }
    expect(filtres('syndic_votes_correspondance')).toContainEqual(['in', 'coproprio_id', [ID_FICHE_1]])
    expect(filtres('syndic_votes_correspondance')).toContainEqual(['in', 'resolution_id', [RES_1]])
  })

  it('documents : lus seulement sur l’immeuble retrouvé, publiés, d’un type consultable', async () => {
    const res = await lire()
    expect(filtres('syndic_documents')).toContainEqual(['eq', 'immeuble_id', IMMEUBLE_ID])
    expect(filtres('syndic_documents')).toContainEqual(['eq', 'publie_extranet', true])
    expect(filtres('syndic_documents')).toContainEqual(['neq', 'status', 'error'])
    const { espace } = await res.json()
    // Le PV publié ; ni le devis non publié, ni le RIB, ni l'espace personnel du voisin.
    expect(espace.documents.fichiers.map((d: { id: string }) => d.id)).toEqual(['doc-pv'])
    expect(espace.documents.fichiers[0]).toMatchObject({ nom: 'PV AG 2025.pdf', type: 'pv_assemblee', categorie: 'pv_ag', personnel: false })
  })

  it('immeuble non retrouvé : pas de lecture des documents, immeuble sans id, reste servi', async () => {
    h.etat.tables.syndic_immeubles = []
    const res = await lire()
    expect(res.status).toBe(200)
    expect(requetesSur('syndic_documents')).toHaveLength(0)
    const { espace } = await res.json()
    expect(espace.immeuble).toMatchObject({ id: null, nom: 'Résidence Le Prado' })
    expect(espace.documents.fichiers).toEqual([])
    expect(espace.finances.appels).toHaveLength(1)
    expect(espace.assemblees).toHaveLength(1)
  })

  it('la réponse ne contient aucun champ privé ; jamais de cache', async () => {
    const res = await lire()
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const texte = JSON.stringify(await res.json())
    expect(texte).not.toContain(LOCATAIRE_MISSION)
    expect(texte).not.toContain(TELEPHONE_LOCATAIRE)
    expect(texte).not.toContain(ACCES_LOGEMENT)
    expect(texte).not.toContain(NOTE_INTERNE)
    expect(texte).not.toContain(EMAIL_VOISIN)
    expect(texte).not.toContain('Mme Dupont')
    expect(texte).not.toContain('Interphone 7')
    // Finances du voisin : jamais.
    expect(texte).not.toContain('ap-voisin')
    expect(texte).not.toContain('fa-voisin')
    expect(texte).not.toContain('im-voisin')
    expect(texte).not.toContain('PRADO-7')
  })

  it('vue construite : profil et quote-part, syndic, mes demandes, missions visibles, finances, assemblée avec mon vote, annonces', async () => {
    const { espace } = await (await lire()).json()
    expect(espace).toMatchObject({ source: 'reel', vueSuperAdmin: false })
    expect(espace.profil).toMatchObject({
      id: ID_FICHE_1, prenom: 'Géraldine', nom: 'Xavier', email: EMAIL_MOI, role: 'proprietaire',
      immeuble: 'Résidence Le Prado', batiment: 'D', etage: '4', numLot: '12', tantiemes: 450, quotePart: 45, solde: -855, estOccupe: true,
    })
    expect(espace.autresLots).toEqual([])
    expect(espace.immeuble).toMatchObject({ id: IMMEUBLE_ID, nom: 'Résidence Le Prado', ville: 'Marseille', nbLots: 2 })
    expect(espace.syndic).toMatchObject({ nom: 'Cabinet Prado Gestion', email: 'contact@prado.fr' })

    // Mes demandes : la mienne seulement, avec le fil et la mission liée.
    expect(espace.interventions.mesDemandes.map((d: { id: string }) => d.id)).toEqual([SIG_MOI])
    expect(espace.interventions.mesDemandes[0].messages).toHaveLength(1)
    expect(espace.interventions.mesDemandes[0].intervention).toMatchObject({ id: 'mis-moi', estLaMienne: true, montantDevis: 640 })
    expect(espace.interventions.mesDemandes[0].origine).toBe('public')

    // Missions de l'immeuble : la partie commune et la mienne, jamais le lot privé du voisin ni l'autre immeuble.
    const ids = espace.interventions.immeuble.map((i: { id: string }) => i.id).sort()
    expect(ids).toEqual(['mis-commune', 'mis-moi'])
    const commune = espace.interventions.immeuble.find((i: { id: string }) => i.id === 'mis-commune')
    expect(commune).toMatchObject({ partieCommune: true, montantDevis: 1200, prestataire: 'Ascenseurs Sud', estLaMienne: false })

    expect(espace.finances).toMatchObject({ solde: -855 })
    expect(espace.finances.appels.map((a: { id: string }) => a.id)).toEqual(['ap-moi'])
    expect(espace.finances.factures[0]).toMatchObject({ id: 'fa-moi', pdfDisponible: true })
    expect(espace.finances.impayes.map((i: { id: string }) => i.id)).toEqual(['im-moi'])
    expect(espace.documents.contrats).toHaveLength(1)
    expect(espace.documents.assurances).toHaveLength(1)

    // Assemblée convoquée (pas le brouillon), résolution avec MON vote, compteurs masqués avant séance.
    expect(espace.assemblees.map((a: { id: string }) => a.id)).toEqual([AG_1])
    expect(espace.assemblees[0].resolutions[0]).toMatchObject({ id: RES_1, monVote: 'pour', monVoteLe: '2026-10-16', votePour: 0 })

    // Annonces : celles de tous les immeubles, pas celles d'un autre immeuble.
    expect(espace.annonces.map((a: { id: string }) => a.id)).toEqual(['av-1'])
  })

  it('une table en erreur (colonne absente) est journalisée et rendue vide, le reste est servi', async () => {
    h.etat.erreurs.syndic_documents = { code: '42703', message: 'column "publie_extranet" does not exist' }
    const res = await lire()
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.documents.fichiers).toEqual([])
    expect(espace.finances.appels).toHaveLength(1)
    expect(espace.assemblees).toHaveLength(1)
    expect(h.loggerError).toHaveBeenCalledTimes(1)
    expect(h.loggerError).toHaveBeenCalledWith('[COPRO ESPACE] documents', expect.objectContaining({ code: '42703' }))
  })

  it('colonne origine absente (migration 20261017 non appliquée) : les demandes sont relues sans elle, provenance inconnue', async () => {
    h.etat.erreurs.syndic_signalements = { code: '42703', message: 'column "origine" does not exist', siColonnes: 'origine' }
    // Le simulateur rend toutes les colonnes de la ligne : sans la colonne en base, la ligne n'en a pas.
    for (const s of h.etat.tables.syndic_signalements) delete s.origine
    const res = await lire()
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.interventions.mesDemandes.map((d: { id: string }) => d.id)).toEqual([SIG_MOI])
    expect(espace.interventions.mesDemandes[0].origine).toBeNull()
    expect(h.loggerError).not.toHaveBeenCalled()
    expect(h.etat.requetes.filter(r => r.table === 'syndic_signalements')).toHaveLength(2)
  })

  it('?lot= choisit la fiche affichée parmi mes lots ; les finances suivent ce lot', async () => {
    h.etat.tables.syndic_coproprios.push(fiche({ id: ID_FICHE_2, immeuble: 'Résidence Bellecour', batiment: 'A', etage: 1, numero_porte: '3', tantieme: 100 }))
    const res = await lire(`https://vitfix.io/api/coproprietaire/espace?lot=${ID_FICHE_2}`)
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.profil).toMatchObject({ id: ID_FICHE_2, immeuble: 'Résidence Bellecour', numLot: '3' })
    expect(espace.autresLots).toEqual([{ id: ID_FICHE_1, immeuble: 'Résidence Le Prado', batiment: 'D', etage: '4', numLot: '12' }])
    expect(filtres('syndic_appels_charges')).toContainEqual(['eq', 'coproprio_id', ID_FICHE_2])
    expect(filtres('syndic_missions')).toContainEqual(['ilike', 'immeuble', 'Résidence Bellecour'])
    expect(espace.finances.appels).toEqual([])
  })
})

describe('GET /api/coproprietaire/espace — locataire', () => {
  beforeEach(() => { h.etat.user = utilisateur('locataire', 'paul.durand@exemple.fr') })

  it('finances vides, assemblées vides, documents vides, montants null ; tables du propriétaire jamais lues', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.profil).toMatchObject({ id: ID_FICHE_1, prenom: 'Paul', nom: 'Durand', role: 'locataire', tantiemes: 0, quotePart: 0, solde: 0 })
    expect(espace.finances).toEqual({ solde: 0, appels: [], factures: [], impayes: [] })
    expect(espace.assemblees).toEqual([])
    expect(espace.documents).toEqual({ fichiers: [], contrats: [], assurances: [] })
    expect(espace.immeuble).toMatchObject({ budgetAnnuel: 0, depensesAnnee: 0 })
    expect(espace.interventions.immeuble.length).toBeGreaterThan(0)
    for (const i of espace.interventions.immeuble) {
      expect(i).toMatchObject({ montantDevis: null, montantFacture: null, documents: [] })
    }
    for (const table of TABLES_PROPRIETAIRE) expect(requetesSur(table), table).toHaveLength(0)
    // Les signalements sont ceux de l'e-mail du locataire.
    expect(filtres('syndic_signalements')).toContainEqual(['eq', 'demandeur_email', 'paul.durand@exemple.fr'])
  })
})

describe('GET /api/coproprietaire/espace — super admin (démo)', () => {
  const superAdmin = () => ({ id: CABINET, email: 'admin@exemple.fr', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { role: 'super_admin' } })

  it('?email= : fiche de SON cabinet (jamais celle du même e-mail dans un autre cabinet), vueSuperAdmin', async () => {
    h.etat.user = superAdmin()
    // Le même e-mail existe aussi dans un autre cabinet : il ne doit jamais être retenu.
    h.etat.tables.syndic_coproprios.push(fiche({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', cabinet_id: AUTRE_CABINET }))
    const res = await lire('https://vitfix.io/api/coproprietaire/espace?email=Geraldine.Xavier%40Email.com')
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.vueSuperAdmin).toBe(true)
    expect(espace.profil).toMatchObject({ id: ID_FICHE_1, email: EMAIL_MOI })
    expect(filtres('syndic_coproprios', 0)).toContainEqual(['eq', 'cabinet_id', CABINET])
    for (const table of TABLES_CABINET) expect(filtres(table), table).toContainEqual(['eq', 'cabinet_id', CABINET])
    expect(filtres('syndic_signalements')).toContainEqual(['eq', 'demandeur_email', EMAIL_MOI])
  })

  it('?email= inconnu du cabinet → 404, jamais une autre fiche', async () => {
    h.etat.user = superAdmin()
    const res = await lire('https://vitfix.io/api/coproprietaire/espace?email=inconnue%40exemple.fr')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'fiche_introuvable' })
  })

  it('super admin en « vue copropriétaire » (rôle d’emprunt) : même comportement', async () => {
    h.etat.user = { ...superAdmin(), app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }
    const res = await lire(`https://vitfix.io/api/coproprietaire/espace?lot=${ID_FICHE_1}`)
    expect(res.status).toBe(200)
    const { espace } = await res.json()
    expect(espace.vueSuperAdmin).toBe(true)
    expect(espace.profil.id).toBe(ID_FICHE_1)
  })
})
