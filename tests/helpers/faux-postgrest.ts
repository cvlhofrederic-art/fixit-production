// Faux client supabase-js (PostgREST) pour les tests de routes : tables en mémoire, colonnes réelles de production.
// Comme PostgREST, une colonne inconnue fait échouer la requête entière, et rien n'est écrit : lue (select) ou filtrée,
// erreur 42703 de PostgreSQL ; écrite (update, insert), erreur PGRST204 du cache de schéma de PostgREST.
// Couvre : select, update, insert, filtres eq / neq / lt / lte / gt / gte, single, maybeSingle et l'attente directe.

import { COLONNES_PROFILES_ARTISAN_PRODUCTION } from './colonnes-profiles-artisan'

type Ligne = Record<string, unknown>
export type ErreurPostgrest = { code: string; message: string }
type Resultat = { data: unknown; error: ErreurPostgrest | null }
type Operation = 'select' | 'update' | 'insert'
type Operateur = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'

/**
 * Colonnes de public.profiles_artisan en production (liste partagée, tests/helpers/colonnes-profiles-artisan.ts),
 * recomptées le 17/11/2026 : 90, ni first_name ni last_name.
 */
export const COLONNES_PROFILES_ARTISAN: ReadonlySet<string> = new Set(COLONNES_PROFILES_ARTISAN_PRODUCTION)

/** Requête reçue par le faux client, gardée pour les assertions (colonnes null : select('*') ou pas de relecture). */
export interface RequeteRecue {
  table: string
  operation: Operation
  colonnes: string[] | null
  filtres: string[]
  valeurs: Ligne | Ligne[] | null
  erreur: ErreurPostgrest | null
}

export interface FauxPostgrest {
  from: (table: string) => unknown
  /** Lignes de chaque table, modifiées en place par update et insert. */
  tables: Record<string, Ligne[]>
  requetes: RequeteRecue[]
  /** Panne simulée par opération : la requête échoue avec cette erreur, sans rien écrire. */
  pannes: Partial<Record<Operation, ErreurPostgrest>>
}

const vide = (v: unknown) => v === null || v === undefined

function comparer(operateur: Operateur, a: unknown, b: unknown): boolean {
  // SQL : une comparaison avec NULL n'est jamais vraie (NULL <> 'x' compris).
  if (operateur === 'eq') return !vide(a) && a === b
  if (vide(a)) return false
  if (operateur === 'neq') return a !== b
  const [x, y] = [a as string | number, b as string | number]
  if (operateur === 'lt') return x < y
  if (operateur === 'lte') return x <= y
  if (operateur === 'gt') return x > y
  return x >= y
}

export function creerFauxPostgrest(schema: Record<string, ReadonlySet<string>>): FauxPostgrest {
  const tables: Record<string, Ligne[]> = Object.fromEntries(Object.keys(schema).map((t) => [t, []]))
  const requetes: RequeteRecue[] = []
  const pannes: FauxPostgrest['pannes'] = {}

  function from(table: string) {
    const colonnesTable = schema[table]
    if (!colonnesTable) throw new Error(`table inattendue : ${table}`)
    let operation: Operation = 'select'
    let colonnes: string[] | null = null
    let relue = false
    let valeurs: Ligne | Ligne[] | null = null
    let mode: 'liste' | 'single' | 'maybeSingle' = 'liste'
    const filtres: Array<[string, Operateur, unknown]> = []

    const projeter = (ligne: Ligne): Ligne =>
      colonnes ? Object.fromEntries(colonnes.map((c) => [c, ligne[c] ?? null])) : { ...ligne }

    const executer = (): Resultat => {
      const echec = (erreur: ErreurPostgrest): Resultat => {
        requetes.push({ table, operation, colonnes, filtres: filtres.map(([c]) => c), valeurs, erreur })
        return { data: null, error: erreur }
      }
      let ecrites: Ligne[] = []
      if (Array.isArray(valeurs)) ecrites = valeurs
      else if (valeurs) ecrites = [valeurs]
      const inconnueEcrite = ecrites.flatMap((l) => Object.keys(l)).find((c) => !colonnesTable.has(c))
      if (inconnueEcrite) {
        return echec({ code: 'PGRST204', message: `Could not find the '${inconnueEcrite}' column of '${table}' in the schema cache` })
      }
      const inconnueLue = [...(colonnes ?? []), ...filtres.map(([c]) => c)].find((c) => !colonnesTable.has(c))
      if (inconnueLue) return echec({ code: '42703', message: `column ${table}.${inconnueLue} does not exist` })
      const panne = pannes[operation]
      if (panne) return echec(panne)

      let lignes: Ligne[]
      if (operation === 'insert') {
        lignes = ecrites.map((l) => ({ ...l }))
        tables[table].push(...lignes)
      } else {
        lignes = tables[table].filter((l) => filtres.every(([c, op, v]) => comparer(op, l[c], v)))
        if (operation === 'update' && mode === 'single' && lignes.length !== 1) {
          // PostgREST annule l'écriture quand l'objet unique demandé n'existe pas (ou n'est pas unique)
          return echec({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' })
        }
        if (operation === 'update') for (const l of lignes) Object.assign(l, valeurs)
      }
      requetes.push({ table, operation, colonnes, filtres: filtres.map(([c]) => c), valeurs, erreur: null })

      if (operation !== 'select' && !relue) return { data: null, error: null }
      const sortie = lignes.map(projeter)
      if (mode === 'liste') return { data: sortie, error: null }
      if (sortie.length === 1) return { data: sortie[0], error: null }
      if (sortie.length === 0 && mode === 'maybeSingle') return { data: null, error: null }
      return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }
    }

    const constructeur = {
      select(liste = '*') {
        colonnes = liste === '*' ? null : liste.split(',').map((c) => c.trim())
        if (operation !== 'select') relue = true
        return constructeur
      },
      update(v: Ligne) {
        operation = 'update'
        valeurs = v
        return constructeur
      },
      insert(v: Ligne | Ligne[]) {
        operation = 'insert'
        valeurs = v
        return constructeur
      },
      eq: (c: string, v: unknown) => { filtres.push([c, 'eq', v]); return constructeur },
      neq: (c: string, v: unknown) => { filtres.push([c, 'neq', v]); return constructeur },
      lt: (c: string, v: unknown) => { filtres.push([c, 'lt', v]); return constructeur },
      lte: (c: string, v: unknown) => { filtres.push([c, 'lte', v]); return constructeur },
      gt: (c: string, v: unknown) => { filtres.push([c, 'gt', v]); return constructeur },
      gte: (c: string, v: unknown) => { filtres.push([c, 'gte', v]); return constructeur },
      single() {
        mode = 'single'
        return Promise.resolve(executer())
      },
      maybeSingle() {
        mode = 'maybeSingle'
        return Promise.resolve(executer())
      },
      // Objet « thenable » voulu : supabase-js renvoie un constructeur de requête que l'on attend directement
      then<T1 = Resultat, T2 = never>(ok?: (r: Resultat) => T1 | PromiseLike<T1>, ko?: (e: unknown) => T2 | PromiseLike<T2>) { // NOSONAR typescript:S7739
        return Promise.resolve(executer()).then(ok, ko)
      },
    }
    return constructeur
  }

  return { from, tables, requetes, pannes }
}
