// tests/helpers/aj-signalement-base.ts — base Supabase simulée pour les routes AJ Signalement.
//
// Petit moteur en mémoire, au plus près de PostgREST pour ce que les routes utilisent : select (colonnes nommées
// ou '*', { count, head }), eq / neq / in / is / not.is / lt / lte / gt / gte / contains / or (arbre and(…) simple),
// order, limit, range, insert / update / delete suivis de select, single / maybeSingle ; rpc par fonctions simulées.
// maxLignes : plafond de lignes par réponse de PostgREST (max-rows de Supabase, 1 000), coupé SANS erreur comme lui.
// Une colonne déclarée absente donne 42703 en lecture et PGRST204 en écriture ; une table déclarée absente, 42P01 par
// défaut, ou PGRST205 (« Could not find the table … in the schema cache ») avec etat.codeTableAbsente = 'PGRST205' :
// c'est ce que répond la production (PostgREST 13) ; une fonction non simulée, PGRST202 (migration non appliquée).
// etat.tablesAbsentesLues garde chaque table absente qu'une requête a nommée : preuve que la branche a été prise.
// Aucune donnée réelle : exemples en @exemple.test.
// À utiliser dans une fabrique vi.mock asynchrone :
//   vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))

export type Ligne = Record<string, unknown>
export interface ErreurSimulee { code: string; message: string; details?: string }
export interface ReponseSimulee { data: unknown; error: ErreurSimulee | null; count?: number | null }
export type FonctionSimulee = (args: Record<string, unknown>) => { data?: unknown; error?: ErreurSimulee | null }

export interface EcritureSimulee {
  table: string
  op: 'insert' | 'update' | 'delete'
  valeurs: Ligne | Ligne[] | null
  filtres: string[]
}

type Comparateur = (ligne: Ligne) => boolean

const valeurBrute = (texte: string): unknown => {
  const t = texte.startsWith('"') && texte.endsWith('"') ? texte.slice(1, -1) : texte
  if (t === 'null') return null
  if (t === 'true') return true
  if (t === 'false') return false
  return t
}

/** Ordre de PostgreSQL pour ce que les tests comparent : nombres, ou textes ISO de même format (code par code). */
const ordreStrict = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const x = String(a ?? '')
  const y = String(b ?? '')
  if (x === y) return 0
  return x < y ? -1 : 1
}

function condition(colonne: string, operateur: string, valeur: unknown): Comparateur {
  return (l) => {
    const v = l[colonne]
    switch (operateur) {
      case 'eq': return v === valeur || (typeof v === 'number' && String(v) === valeur)
      case 'neq': return v !== valeur
      case 'lt': return v !== null && v !== undefined && ordreStrict(v, valeur) < 0
      case 'lte': return v !== null && v !== undefined && ordreStrict(v, valeur) <= 0
      case 'gt': return v !== null && v !== undefined && ordreStrict(v, valeur) > 0
      case 'gte': return v !== null && v !== undefined && ordreStrict(v, valeur) >= 0
      case 'is': return valeur === null ? v === null || v === undefined : v === valeur
      default: throw new Error(`opérateur simulé inconnu : ${operateur}`)
    }
  }
}

/** Découpe « a,b(c,d),e » au premier niveau de parenthèses (guillemets respectés). */
function decouper(texte: string): string[] {
  const parties: string[] = []
  let profondeur = 0
  let guillemets = false
  let courant = ''
  for (const c of texte) {
    if (c === '"') guillemets = !guillemets
    if (!guillemets && c === '(') profondeur += 1
    if (!guillemets && c === ')') profondeur -= 1
    if (!guillemets && profondeur === 0 && c === ',') { parties.push(courant); courant = ''; continue }
    courant += c
  }
  if (courant) parties.push(courant)
  return parties
}

function arbre(expression: string, mode: 'and' | 'or'): Comparateur {
  const termes = decouper(expression).map((terme): Comparateur => {
    const m = /^(and|or)\((.*)\)$/.exec(terme)
    if (m) return arbre(m[2], m[1] as 'and' | 'or')
    const premier = terme.indexOf('.')
    const second = terme.indexOf('.', premier + 1)
    return condition(terme.slice(0, premier), terme.slice(premier + 1, second), valeurBrute(terme.slice(second + 1)))
  })
  return mode === 'and' ? (l) => termes.every((t) => t(l)) : (l) => termes.some((t) => t(l))
}

const colonnesDe = (selection: string): string[] => selection.split(',').map((c) => c.trim()).filter(Boolean)

let compteurIds = 0
const nouvelId = (): string => {
  compteurIds += 1
  return `d0000000-0000-4000-8000-${String(compteurIds).padStart(12, '0')}`
}

/** Code d'une table absente : 42P01 (PostgreSQL) ou PGRST205 (PostgREST 12 et suivants, dont la production). */
export type CodeTableAbsente = '42P01' | 'PGRST205'

/** Erreur rendue pour une table absente, au format de PostgreSQL (42P01) ou du cache de schéma de PostgREST (PGRST205). */
export const erreurTableAbsente = (nomTable: string, code: CodeTableAbsente): ErreurSimulee => (code === 'PGRST205'
  ? { code, message: `Could not find the table 'public.${nomTable}' in the schema cache` }
  : { code, message: `relation "public.${nomTable}" does not exist` })

export function creerBaseQr() {
  const etat = {
    tables: {} as Record<string, Ligne[]>,
    tablesAbsentes: [] as string[],
    /** Code rendu pour une table de tablesAbsentes ; 'PGRST205' : comme la production (PostgREST 13). */
    codeTableAbsente: '42P01' as CodeTableAbsente,
    /** Tables absentes nommées par une requête, dans l'ordre (chaque requête refusée en ajoute une). */
    tablesAbsentesLues: [] as string[],
    colonnesAbsentes: {} as Record<string, string[]>,
    /** Erreur forcée à la prochaine requête sur la table (puis effacée). */
    erreursPonctuelles: {} as Record<string, ErreurSimulee>,
    fonctions: {} as Record<string, FonctionSimulee>,
    appelsRpc: [] as Array<{ nom: string; args: Record<string, unknown> }>,
    ecritures: [] as EcritureSimulee[],
    lectures: [] as Array<{ table: string; colonnes: string; filtres: string[] }>,
    /** Plafond de lignes par réponse (null : aucun) ; une réponse plus longue est tronquée en silence, comme PostgREST. */
    maxLignes: null as number | null,
  }

  const table = (nom: string): Ligne[] => {
    etat.tables[nom] ??= []
    return etat.tables[nom]
  }

  function from(nomTable: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let selection: string | null = null
    let options: { count?: string; head?: boolean } = {}
    let valeurs: Ligne | Ligne[] | null = null
    const filtres: Comparateur[] = []
    const textesFiltres: string[] = []
    const ordres: Array<{ colonne: string; croissant: boolean }> = []
    let limite: number | null = null
    let debut = 0
    let unique: 'single' | 'maybe' | null = null

    const filtrer = (texte: string, f: Comparateur) => { filtres.push(f); textesFiltres.push(texte); return q }

    const executer = (): ReponseSimulee => {
      const ponctuelle = etat.erreursPonctuelles[nomTable]
      if (ponctuelle) {
        delete etat.erreursPonctuelles[nomTable]
        return { data: null, error: ponctuelle }
      }
      if (etat.tablesAbsentes.includes(nomTable)) {
        etat.tablesAbsentesLues.push(nomTable)
        return { data: null, error: erreurTableAbsente(nomTable, etat.codeTableAbsente) }
      }
      const absentes = etat.colonnesAbsentes[nomTable] ?? []
      if (op === 'insert' || op === 'update') {
        const lignes = Array.isArray(valeurs) ? valeurs : [valeurs ?? {}]
        const absente = lignes.flatMap((l) => Object.keys(l)).find((c) => absentes.includes(c))
        if (absente) return { data: null, error: { code: 'PGRST204', message: `Could not find the '${absente}' column of '${nomTable}' in the schema cache` } }
      }
      if (selection && selection !== '*') {
        const absente = colonnesDe(selection).find((c) => absentes.includes(c))
        if (absente) return { data: null, error: { code: '42703', message: `column ${nomTable}.${absente} does not exist` } }
      }
      if (op === 'select') etat.lectures.push({ table: nomTable, colonnes: selection ?? '*', filtres: [...textesFiltres] })

      let resultat: Ligne[]
      const lignes = table(nomTable)
      if (op === 'insert') {
        const aInserer = (Array.isArray(valeurs) ? valeurs : [valeurs ?? {}]).map((l) => ({
          id: nouvelId(), created_at: new Date().toISOString(), ...l,
        }))
        etat.ecritures.push({ table: nomTable, op, valeurs, filtres: [] })
        lignes.push(...aInserer)
        resultat = aInserer
      } else {
        resultat = lignes.filter((l) => filtres.every((f) => f(l)))
        if (op === 'update') {
          etat.ecritures.push({ table: nomTable, op, valeurs, filtres: [...textesFiltres] })
          for (const l of resultat) Object.assign(l, valeurs)
        } else if (op === 'delete') {
          etat.ecritures.push({ table: nomTable, op, valeurs: null, filtres: [...textesFiltres] })
          etat.tables[nomTable] = lignes.filter((l) => !resultat.includes(l))
        }
      }
      if (op === 'select' || selection !== null) {
        for (const o of [...ordres].reverse()) {
          resultat = [...resultat].sort((a, b) => (o.croissant ? 1 : -1) * ordreStrict(a[o.colonne], b[o.colonne]))
        }
      }
      const total = resultat.length
      if (debut > 0 || limite !== null) resultat = resultat.slice(debut, limite === null ? undefined : debut + limite)
      if (etat.maxLignes !== null && op === 'select' && !options.head) resultat = resultat.slice(0, etat.maxLignes)
      const projetees = selection && selection !== '*'
        ? resultat.map((l) => Object.fromEntries(colonnesDe(selection as string).map((c) => [c, l[c] === undefined ? null : l[c]])))
        : resultat.map((l) => ({ ...l }))
      if (options.head) return { data: null, error: null, count: total }
      if (op !== 'select' && selection === null) return { data: null, error: null, count: options.count ? total : null }
      if (unique === 'single') {
        return projetees.length === 1
          ? { data: projetees[0], error: null }
          : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
      }
      if (unique === 'maybe') {
        return projetees.length > 1
          ? { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
          : { data: projetees[0] ?? null, error: null }
      }
      return { data: projetees, error: null, count: options.count ? total : null }
    }

    const q: Record<string, unknown> = {
      select(colonnes = '*', opts: { count?: string; head?: boolean } = {}) { selection = colonnes; options = opts; return q },
      insert(v: Ligne | Ligne[]) { op = 'insert'; valeurs = v; return q },
      update(v: Ligne) { op = 'update'; valeurs = v; return q },
      delete() { op = 'delete'; return q },
      eq: (c: string, v: unknown) => filtrer(`${c}=eq.${String(v)}`, condition(c, 'eq', v)),
      neq: (c: string, v: unknown) => filtrer(`${c}=neq.${String(v)}`, condition(c, 'neq', v)),
      lt: (c: string, v: unknown) => filtrer(`${c}=lt.${String(v)}`, condition(c, 'lt', v)),
      lte: (c: string, v: unknown) => filtrer(`${c}=lte.${String(v)}`, condition(c, 'lte', v)),
      gt: (c: string, v: unknown) => filtrer(`${c}=gt.${String(v)}`, condition(c, 'gt', v)),
      gte: (c: string, v: unknown) => filtrer(`${c}=gte.${String(v)}`, condition(c, 'gte', v)),
      is: (c: string, v: unknown) => filtrer(`${c}=is.${String(v)}`, condition(c, 'is', v)),
      not: (c: string, o: string, v: unknown) => {
        const f = condition(c, o, v)
        return filtrer(`${c}=not.${o}.${String(v)}`, (l) => !f(l))
      },
      in: (c: string, v: unknown[]) => filtrer(`${c}=in.(${v.join(',')})`, (l) => v.includes(l[c])),
      contains: (c: string, v: unknown[]) => filtrer(`${c}=cs.{${v.join(',')}}`, (l) => Array.isArray(l[c]) && v.every((x) => (l[c] as unknown[]).includes(x))),
      or: (expression: string) => filtrer(`or=(${expression})`, arbre(expression, 'or')),
      order(c: string, o: { ascending?: boolean } = {}) { ordres.push({ colonne: c, croissant: o.ascending !== false }); return q },
      limit(n: number) { limite = n; return q },
      range(de: number, a: number) { debut = de; limite = a - de + 1; return q },
      single() { unique = 'single'; return Promise.resolve(executer()) },
      maybeSingle() { unique = 'maybe'; return Promise.resolve(executer()) },
      // NOSONAR typescript:S7739 - « thenable » VOULU : le constructeur de requête de Supabase s'attend sans être une
      // promesse (`await supabase.from(…).select(…)`) ; le simulacre doit l'imiter, sinon le code testé ne peut pas
      // s'exécuter. La requête ne part qu'à l'attente, comme chez Supabase.
      then(ok: (v: ReponseSimulee) => unknown, ko?: (e: unknown) => unknown) { return Promise.resolve(executer()).then(ok, ko) },
    }
    return q
  }

  async function rpc(nom: string, args: Record<string, unknown> = {}): Promise<ReponseSimulee> {
    etat.appelsRpc.push({ nom, args })
    const fonction = etat.fonctions[nom]
    if (!fonction) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${nom} in the schema cache` } }
    const r = fonction(args)
    return { data: r.data ?? null, error: r.error ?? null }
  }

  function reinitialiser(): void {
    etat.tables = {}
    etat.tablesAbsentes = []
    etat.codeTableAbsente = '42P01'
    etat.tablesAbsentesLues = []
    etat.colonnesAbsentes = {}
    etat.erreursPonctuelles = {}
    etat.fonctions = {}
    etat.appelsRpc = []
    etat.ecritures = []
    etat.lectures = []
    etat.maxLignes = null
  }

  /** Écritures d'une table (insert, update ou delete), dans l'ordre. */
  const ecrituresDe = (nomTable: string, op?: EcritureSimulee['op']) =>
    etat.ecritures.filter((e) => e.table === nomTable && (op === undefined || e.op === op))

  return { etat, client: { from, rpc }, table, reinitialiser, ecrituresDe }
}

/** Instance partagée par la fabrique vi.mock et le fichier de test (même module). */
export const baseQr = creerBaseQr()

// ── La production avant la migration du 11/11/2026 ───────────────────────────
// Structure de supabase/migrations/20261111_signalements_qr_gestionnaires.sql (tables, colonnes ajoutées, fonctions) :
// tant qu'elle n'est pas appliquée, la production répond PGRST205 (tables), 42703 / PGRST204 (colonnes) et PGRST202
// (fonctions). Les migrations du 06/11/2026 sont appliquées (11/11/2026) : leurs colonnes restent présentes.

export const TABLES_MIGRATION_1111_QR: readonly string[] = [
  'signalements_qr_cabinets', 'signalements_qr_domaines_autorises', 'signalements_qr_gestionnaires', 'signalements_qr_invitations',
  'signalements_qr_attributions', 'signalements_qr_journal', 'signalements_qr_operations',
]
export const COLONNES_MIGRATION_1111_QR: Readonly<Record<string, readonly string[]>> = {
  signalements_qr_coproprietes: [
    'cabinet_id', 'code_postal', 'ville', 'immatriculation', 'reference_cabinet', 'batiments', 'attribuee_a_tous', 'cle_nom',
    'cree_par_gestionnaire_id', 'operation_id',
  ],
  signalements_qr: ['statut_modifie_le', 'statut_modifie_par', 'statut_modifie_profil', 'nb_emails_envoyes', 'email_retenu'],
}
export const FONCTIONS_MIGRATION_1111_QR: readonly string[] = [
  'signalements_qr_identifiant_fige', 'signalements_qr_cabinet_copro_fige', 'signalements_qr_creer_coproprietes', 'signalements_qr_compteurs',
  'signalements_qr_remplacer_attributions', 'signalements_qr_attribuer_au_gestionnaire', 'signalements_qr_desactiver_gestionnaire',
  'signalements_qr_reactiver_gestionnaire', 'signalements_qr_inviter_gestionnaire', 'signalements_qr_confirmer_adresse',
  'signalements_qr_contester_adresse', 'signalements_qr_emails_gestionnaires', 'signalements_qr_reserver_emails',
  'signalements_qr_purger_journal', 'signalements_qr_enregistrer_cabinet', 'signalements_qr_rattacher_coproprietes',
]

/**
 * Met la base simulée dans l'état de la production avant la migration du 11/11/2026 : tables absentes (PGRST205 par
 * défaut, comme PostgREST 13 ; 42P01 sur demande), colonnes absentes, fonctions retirées. À appeler après avoir posé les
 * lignes du test (les lignes des tables absentes restent en mémoire mais ne sont plus lisibles).
 */
export function simulerProductionAvant1111Qr(base: ReturnType<typeof creerBaseQr> = baseQr, code: CodeTableAbsente = 'PGRST205'): void {
  base.etat.codeTableAbsente = code
  base.etat.tablesAbsentes = [...new Set([...base.etat.tablesAbsentes, ...TABLES_MIGRATION_1111_QR])]
  for (const [table, colonnes] of Object.entries(COLONNES_MIGRATION_1111_QR)) {
    base.etat.colonnesAbsentes[table] = [...new Set([...(base.etat.colonnesAbsentes[table] ?? []), ...colonnes])]
  }
  for (const fonction of FONCTIONS_MIGRATION_1111_QR) delete base.etat.fonctions[fonction]
}

// ── La production avant la migration du 12/11/2026 (accès des gestionnaires, PR 2) ──
// Structure de supabase/migrations/20261112_signalements_qr_acces_gestionnaires.sql : 4 colonnes sur la fiche, une
// fonction nouvelle (les corps remplacés gardent leur signature : ils répondent comme en PR 1). Tant qu'elle n'est pas
// appliquée, la production répond 42703 / PGRST204 (colonnes) et PGRST202 (fonction).

export const COLONNES_MIGRATION_1112_QR: Readonly<Record<string, readonly string[]>> = {
  signalements_qr_gestionnaires: ['user_id', 'acces_ouvert_le', 'connexion_bloquee_le', 'effacement_demande_le'],
}
export const FONCTIONS_MIGRATION_1112_QR: readonly string[] = ['signalements_qr_envoyer_acces']

/**
 * Met la base simulée dans l'état de la production avant la migration du 12/11/2026 (la 20261111 appliquée) : colonnes
 * de la fiche absentes, fonction retirée. Combinable avec simulerProductionAvant1111Qr (aucune des deux migrations).
 */
export function simulerProductionAvant1112Qr(base: ReturnType<typeof creerBaseQr> = baseQr): void {
  for (const [table, colonnes] of Object.entries(COLONNES_MIGRATION_1112_QR)) {
    base.etat.colonnesAbsentes[table] = [...new Set([...(base.etat.colonnesAbsentes[table] ?? []), ...colonnes])]
  }
  for (const fonction of FONCTIONS_MIGRATION_1112_QR) delete base.etat.fonctions[fonction]
}
