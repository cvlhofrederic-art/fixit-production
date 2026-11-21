// tests/helpers/faux-supabase-marches.ts — faux client Supabase « service role » pour les routes de la Bourse aux
// marchés et de ses modules voisins.
//
// Il ne connaît que les tables qui existent en production et, pour celles dont les colonnes sont connues, il refuse
// comme PostgREST toute colonne absente, en lecture comme en écriture : un nom de table ou de colonne erroné échoue
// ici comme il échoue en production, au lieu de passer inaperçu dans un faux trop complaisant.
//
// À construire dans vi.hoisted (la fabrique de vi.mock est remontée en tête de fichier) :
//   const h = vi.hoisted(() => ({ base: null as null | FauxSupabase }))
//   vi.mock('@/lib/supabase-server', async () => {
//     const { creerFauxSupabase } = await import('../helpers/faux-supabase-marches')
//     h.base = creerFauxSupabase()
//     return { supabaseAdmin: h.base.client }
//   })

import { COLONNES_PROFILES_ARTISAN_PRODUCTION } from './colonnes-profiles-artisan'

export type Operation = 'select' | 'insert' | 'update' | 'delete' | 'rpc'
export type Filtre = [string, string, unknown]
export interface Appel {
  table: string
  operation: Operation
  /** Colonnes demandées par select() (en lecture, ou en retour d'une écriture). */
  colonnes?: string
  /** Ligne(s) écrite(s) par insert() / update(), ou arguments d'un rpc(). */
  donnees?: unknown
  filtres: Filtre[]
  /** Nombre de lignes demandé par limit() : comme PostgREST, une réponse en liste n'en rend pas davantage. */
  limite?: number
}
export interface ErreurBase { code?: string; message: string }
export interface Reponse { data: unknown; error: ErreurBase | null }

/**
 * Colonnes réelles des tables vérifiées.
 * - marches_candidatures : relevé de production du 11/11/2026 (information_schema.columns).
 * - artisan_notifications : script de création de la table en production (supabase/archive/supabase-notifications.sql),
 *   le seul jeu de colonnes qu'écrivent les routes qui fonctionnent (réservations, messagerie, devis signés).
 * - profiles_artisan : relevé de production du 31/10/2026, partagé avec le test du sitemap (colonnes-profiles-artisan.ts).
 * Les autres tables connues (TABLES_REELLES) n'ont pas de relevé : leurs colonnes ne sont pas contrôlées.
 */
export const COLONNES_REELLES: Record<string, readonly string[]> = {
  profiles_artisan: COLONNES_PROFILES_ARTISAN_PRODUCTION,
  marches_candidatures: [
    'id', 'marche_id', 'artisan_id', 'artisan_user_id', 'price', 'timeline', 'description', 'materials_included',
    'guarantee', 'status', 'created_at', 'updated_at', 'publisher_evaluated', 'artisan_evaluated',
    'artisan_company_name', 'artisan_rating', 'artisan_rating_count', 'artisan_distance_km', 'artisan_work_mode',
    'artisan_tarif_journalier', 'artisan_tarif_horaire', 'artisan_rc_pro_valid', 'artisan_decennale_valid',
    'artisan_rge_valid', 'artisan_qualibat_valid', 'artisan_disponibilite',
  ],
  artisan_notifications: ['id', 'artisan_id', 'type', 'title', 'body', 'read', 'data_json', 'created_at'],
}

/** Tables qui existent en production (les autres répondent comme PostgREST : table introuvable). */
export const TABLES_REELLES = new Set([
  'marches', 'marches_candidatures', 'marches_messages', 'marches_evaluations', 'artisan_notifications',
  'profiles_artisan', 'subscriptions', 'pro_team_members', 'marketplace_listings', 'marketplace_demandes',
  'rfqs', 'rfq_items', 'offers', 'offer_items', 'suppliers', 'referrals',
])

/** Découpe une liste de colonnes au premier niveau (les relations embarquées « table(…) » restent entières). */
function colonnesDeSelect(liste: string): string[] {
  const morceaux: string[] = []
  let profondeur = 0
  let courant = ''
  for (const caractere of liste) {
    if (caractere === '(') profondeur++
    if (caractere === ')') profondeur--
    if (caractere === ',' && profondeur === 0) { morceaux.push(courant.trim()); courant = '' } else courant += caractere
  }
  if (courant.trim()) morceaux.push(courant.trim())
  return morceaux
}

/** Colonne réellement lue par une expression de select : « alias:colonne » et « colonne::type » lisent « colonne ». */
function colonneLue(expression: string): string {
  const sansConversion = expression.split('::')[0]
  const deuxPoints = sansConversion.indexOf(':')
  return (deuxPoints === -1 ? sansConversion : sansConversion.slice(deuxPoints + 1)).trim()
}

/** Erreur que rendrait PostgREST pour cet appel (table ou colonne absente), ou null. */
export function erreurDeSchema(appel: Appel): ErreurBase | null {
  if (appel.operation === 'rpc') return null
  if (!TABLES_REELLES.has(appel.table)) {
    return { code: 'PGRST205', message: `Could not find the table 'public.${appel.table}' in the schema cache` }
  }
  const relation = erreurDeRelation(appel)
  if (relation) return relation
  const colonnes = COLONNES_REELLES[appel.table]
  if (!colonnes) return null
  const lignes = Array.isArray(appel.donnees) ? appel.donnees : appel.donnees ? [appel.donnees] : []
  for (const ligne of lignes) {
    for (const cle of Object.keys(ligne as Record<string, unknown>)) {
      if (!colonnes.includes(cle)) {
        return { code: 'PGRST204', message: `Could not find the '${cle}' column of '${appel.table}' in the schema cache` }
      }
    }
  }
  for (const expression of appel.colonnes ? colonnesDeSelect(appel.colonnes) : []) {
    if (expression === '*' || expression.includes('(')) continue
    const colonne = colonneLue(expression)
    if (!colonnes.includes(colonne)) return { code: '42703', message: `column ${appel.table}.${colonne} does not exist` }
  }
  for (const [, colonne] of appel.filtres) {
    if (colonne.includes('.')) continue
    if (!colonnes.includes(colonne)) return { code: '42703', message: `column ${appel.table}.${colonne} does not exist` }
  }
  return null
}

/** Colonnes d'une relation embarquée (« table(col, …) » ou « table!inner(col, …) ») absentes de cette table. */
function erreurDeRelation(appel: Appel): ErreurBase | null {
  for (const colonne of appel.colonnes ? colonnesDeSelect(appel.colonnes) : []) {
    const embarquee = /^([a-z_]+)(?:![a-z_]+)?\(([\s\S]*)\)$/.exec(colonne)
    const colonnesRelation = embarquee ? COLONNES_REELLES[embarquee[1]] : undefined
    if (!embarquee || !colonnesRelation) continue
    for (const expression of colonnesDeSelect(embarquee[2])) {
      if (expression === '*' || expression.includes('(')) continue
      const sousColonne = colonneLue(expression)
      if (!colonnesRelation.includes(sousColonne)) {
        return { code: '42703', message: `column ${embarquee[1]}_1.${sousColonne} does not exist` }
      }
    }
  }
  return null
}

export interface FauxSupabase {
  client: { from: (table: string) => unknown; rpc: (nom: string, args?: unknown) => unknown }
  appels: Appel[]
  /** Réponse de la base à un appel qui a passé le contrôle du schéma (à redéfinir dans chaque test). */
  repondre: (appel: Appel) => Reponse
  vider: () => void
  /** Appels faits sur une table (et, si précisé, pour une opération). */
  sur: (table: string, operation?: Operation) => Appel[]
}

export function creerFauxSupabase(): FauxSupabase {
  const base: FauxSupabase = {
    client: { from: () => null, rpc: () => null },
    appels: [],
    repondre: () => ({ data: null, error: null }),
    vider: () => { base.appels.length = 0; base.repondre = () => ({ data: null, error: null }) },
    sur: (table, operation) => base.appels.filter(a => a.table === table && (!operation || a.operation === operation)),
  }
  const resultat = (appel: Appel): Promise<Reponse> => {
    const erreur = erreurDeSchema(appel)
    if (erreur) return Promise.resolve({ data: null, error: erreur })
    const reponse = base.repondre(appel)
    // limit() borne la liste rendue, comme en production : une route qui demande trop peu de lignes le montre ici.
    if (appel.limite !== undefined && Array.isArray(reponse.data)) {
      return Promise.resolve({ ...reponse, data: reponse.data.slice(0, appel.limite) })
    }
    return Promise.resolve(reponse)
  }
  const constructeur = (appel: Appel) => {
    const b: Record<string, unknown> = {}
    b.select = (colonnes?: string) => { appel.colonnes = colonnes; return b }
    b.insert = (donnees: unknown) => { appel.operation = 'insert'; appel.donnees = donnees; return b }
    b.update = (donnees: unknown) => { appel.operation = 'update'; appel.donnees = donnees; return b }
    b.delete = () => { appel.operation = 'delete'; return b }
    for (const m of ['eq', 'neq', 'gte', 'lte', 'in', 'ilike', 'or', 'is', 'contains', 'not']) {
      b[m] = (colonne: string, valeur: unknown) => { appel.filtres.push([m, colonne, valeur]); return b }
    }
    b.order = () => b
    b.range = () => b
    b.limit = (nombre: number) => { appel.limite = nombre; return b }
    b.single = () => resultat(appel)
    b.maybeSingle = () => resultat(appel)
    b.then = (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => resultat(appel).then(ok, ko)
    return b
  }
  base.client = {
    from: (table: string) => {
      const appel: Appel = { table, operation: 'select', filtres: [] }
      base.appels.push(appel)
      return constructeur(appel)
    },
    rpc: (nom: string, args?: unknown) => {
      const appel: Appel = { table: nom, operation: 'rpc', donnees: args, filtres: [] }
      base.appels.push(appel)
      return constructeur(appel)
    },
  }
  return base
}
