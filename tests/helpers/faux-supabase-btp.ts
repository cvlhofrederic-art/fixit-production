// tests/helpers/faux-supabase-btp.ts — faux client Supabase (service role) pour les tests de app/api/btp/route.ts.
//
// Simule ce que la route appelle : from(table) puis select / insert / update / upsert / delete, filtres eq, neq, in,
// is et les comparaisons gte / gt / lte / lt, order (sans effet), limit, single / maybeSingle, et l'attente directe
// de la requête (then). Les lignes vivent
// dans `base.lignes` ; une erreur PostgREST se programme par table et par opération (`base.erreurs`), au besoin
// seulement quand une colonne donnée est demandée (`siColonne`, pour éprouver un repli qui relit la même table avec
// moins de colonnes). Chaque requête est notée dans `base.journal` (table, opération, valeur écrite, filtres, dont
// les filtres `is` dans `estNul`, limite) pour vérifier ce qui part en base.
//
// Comportements de PostgREST reproduits parce que la route en dépend :
//   - `.single()` sans exactement une ligne → erreur PGRST116 ; `.maybeSingle()` sans ligne → data null ;
//   - un UPDATE sans aucune colonne ne renvoie aucune ligne ;
//   - `select(..., { count: 'exact', head: true })` → data null et le nombre de lignes dans `count` ;
//   - lecture d'une équipe avec `equipe_membres_btp(membre_id)` → liens de la table equipe_membres_btp.
// Aucune donnée réelle : identifiants et libellés inventés par chaque test.

export type Ligne = Record<string, unknown>
export type OperationFaux = 'select' | 'insert' | 'update' | 'upsert' | 'delete'
export interface ErreurFaux { code: string; message: string; details?: string | null; hint?: string | null }

export interface EntreeJournal {
  table: string
  operation: OperationFaux
  valeur?: unknown
  filtres: Record<string, unknown>
  dans: Record<string, unknown[]>
  /** Filtres `.is(colonne, null | true | false)` : `null` couvre aussi une ligne sans la colonne, comme en base. */
  estNul: Record<string, unknown>
  /** Comparaisons `.gte` / `.gt` / `.lte` / `.lt`, dans l'ordre où elles ont été posées. */
  bornes: Array<{ colonne: string; operateur: 'gte' | 'gt' | 'lte' | 'lt'; valeur: unknown }>
  /** Exclusions `.neq(colonne, valeur)`. */
  differentDe: Record<string, unknown>
  limite?: number
  /** Colonnes demandées au `select`, pour les cas qui vérifient ce qui est lu (ou pas) en base. */
  colonnes?: string
}

export interface FauxBase {
  lignes: Record<string, Ligne[]>
  /** `siColonne` : l'erreur ne porte que si le `select` demande cette colonne (PostgREST 42703). */
  erreurs: Array<{ table: string; operation: OperationFaux; erreur: ErreurFaux; siColonne?: string }>
  journal: EntreeJournal[]
}

export function nouvelleBase(lignes: Record<string, Ligne[]> = {}): FauxBase {
  return { lignes, erreurs: [], journal: [] }
}

/** Requêtes notées pour une table (et une opération si précisée). */
export function requetes(base: FauxBase, table: string, operation?: OperationFaux): EntreeJournal[] {
  return base.journal.filter(e => e.table === table && (operation === undefined || e.operation === operation))
}

let compteurIds = 0
/** Identifiant au format UUID, différent à chaque appel. */
export function nouvelId(): string {
  compteurIds += 1
  return `00000000-0000-4000-8000-${String(compteurIds).padStart(12, '0')}`
}

interface Resultat { data: unknown; error: ErreurFaux | null; count?: number | null }

const TABLES_SANS_ID = new Set(['equipe_membres_btp', 'settings_btp'])

function constructeur(base: FauxBase, table: string) {
  const entree: EntreeJournal = { table, operation: 'select', filtres: {}, dans: {}, estNul: {}, bornes: [], differentDe: {} }
  base.journal.push(entree)
  let colonnes = '*'
  let enTete = false

  // Une colonne absente de la ligne vaut NULL en base : `.is(colonne, null)` doit la retenir.
  const nulEnBase = (valeur: unknown) => valeur === null || valeur === undefined

  // Comparaison des dates ISO et des nombres : l'ordre naturel des chaînes suffit pour « 2026-11-10 », et les
  // nombres se comparent entre eux. Une colonne absente ne satisfait aucune borne, comme NULL en base.
  const dansLesBornes = (ligne: Ligne) =>
    entree.bornes.every(({ colonne, operateur, valeur }) => {
      const v = ligne[colonne]
      if (nulEnBase(v)) return false
      if (operateur === 'gte') return (v as never) >= (valeur as never)
      if (operateur === 'gt') return (v as never) > (valeur as never)
      if (operateur === 'lte') return (v as never) <= (valeur as never)
      return (v as never) < (valeur as never)
    })

  const correspond = (ligne: Ligne) =>
    Object.entries(entree.filtres).every(([colonne, valeur]) => ligne[colonne] === valeur)
    && Object.entries(entree.dans).every(([colonne, valeurs]) => valeurs.includes(ligne[colonne]))
    && Object.entries(entree.estNul).every(([colonne, attendu]) =>
      attendu === null ? nulEnBase(ligne[colonne]) : ligne[colonne] === attendu)
    && Object.entries(entree.differentDe).every(([colonne, valeur]) => ligne[colonne] !== valeur)
    && dansLesBornes(ligne)

  const executer = (): Resultat => {
    const programmee = base.erreurs.find(e =>
      e.table === table && e.operation === entree.operation
      && (e.siColonne === undefined || colonnes.includes(e.siColonne)))
    if (programmee) return { data: null, error: programmee.erreur, count: null }
    const lignes = (base.lignes[table] ??= [])
    switch (entree.operation) {
      case 'select': {
        let trouvees = lignes.filter(correspond).map(l => ({ ...l }))
        if (table === 'equipes_btp' && colonnes.includes('equipe_membres_btp')) {
          const liens = base.lignes.equipe_membres_btp ?? []
          trouvees = trouvees.map(l => ({ ...l, equipe_membres_btp: liens.filter(m => m.equipe_id === l.id).map(m => ({ membre_id: m.membre_id })) }))
        }
        const count = trouvees.length
        if (entree.limite !== undefined) trouvees = trouvees.slice(0, entree.limite)
        return enTete ? { data: null, error: null, count } : { data: trouvees, error: null, count }
      }
      case 'insert': {
        const valeurs = (Array.isArray(entree.valeur) ? entree.valeur : [entree.valeur]) as Ligne[]
        // Tables sans colonne id (table de liens, réglages par compte) : rien n'est ajouté à la ligne.
        const inserees = valeurs.map(v => (TABLES_SANS_ID.has(table) ? { ...v } : { id: nouvelId(), ...v }))
        lignes.push(...inserees)
        return { data: inserees.map(l => ({ ...l })), error: null }
      }
      case 'update': {
        const valeur = (entree.valeur ?? {}) as Ligne
        if (Object.keys(valeur).length === 0) return { data: [], error: null }
        const cibles = lignes.filter(correspond)
        cibles.forEach(l => Object.assign(l, valeur))
        return { data: cibles.map(l => ({ ...l })), error: null }
      }
      case 'upsert': {
        const valeur = (entree.valeur ?? {}) as Ligne
        const existante = lignes.find(l => l.owner_id === valeur.owner_id)
        if (existante) Object.assign(existante, valeur)
        else lignes.push({ ...valeur })
        return { data: [{ ...(existante ?? valeur) }], error: null }
      }
      case 'delete': {
        base.lignes[table] = lignes.filter(l => !correspond(l))
        return { data: null, error: null }
      }
    }
  }

  const unique = (permettreAucune: boolean): Resultat => {
    const r = executer()
    if (r.error) return r
    const lignes = (r.data ?? []) as Ligne[]
    if (lignes.length === 1) return { data: lignes[0], error: null }
    if (lignes.length === 0 && permettreAucune) return { data: null, error: null }
    return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
  }

  const b: Record<string, unknown> = {}
  b.select = (cols?: string, options?: { count?: string; head?: boolean }) => {
    if (cols) { colonnes = cols; entree.colonnes = cols }
    if (options?.head) enTete = true
    return b
  }
  b.insert = (valeur: unknown) => { entree.operation = 'insert'; entree.valeur = valeur; return b }
  b.update = (valeur: unknown) => { entree.operation = 'update'; entree.valeur = valeur; return b }
  b.upsert = (valeur: unknown) => { entree.operation = 'upsert'; entree.valeur = valeur; return b }
  b.delete = () => { entree.operation = 'delete'; return b }
  b.eq = (colonne: string, valeur: unknown) => { entree.filtres[colonne] = valeur; return b }
  b.in = (colonne: string, valeurs: unknown[]) => { entree.dans[colonne] = valeurs; return b }
  b.is = (colonne: string, valeur: unknown) => { entree.estNul[colonne] = valeur; return b }
  b.neq = (colonne: string, valeur: unknown) => { entree.differentDe[colonne] = valeur; return b }
  for (const operateur of ['gte', 'gt', 'lte', 'lt'] as const) {
    b[operateur] = (colonne: string, valeur: unknown) => { entree.bornes.push({ colonne, operateur, valeur }); return b }
  }
  b.order = () => b
  b.limit = (n: number) => { entree.limite = n; return b }
  b.single = async () => unique(false)
  b.maybeSingle = async () => unique(true)
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(executer()).then(ok, ko)
  return b
}

/** Client à donner comme `supabaseAdmin` : `{ from }` branché sur la base. */
export function fauxSupabase(base: FauxBase) {
  return { from: (table: string) => constructeur(base, table) }
}
