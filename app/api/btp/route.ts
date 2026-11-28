import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { PLAFONDS_LECTURE_BTP } from '@/lib/btp/plafonds-lecture'
import { MESSAGE_FICHE_INTROUVABLE, traduireErreurBase, type ErreurBase } from '@/lib/btp/erreurs-base-btp'
import {
  BTP_TABLES_ECRIVABLES, COLONNES_SYSTEME, FORMAT_UUID, dejaEnregistre, memeValeur, referencesDeLigne, valeursHorsBornes,
  verifierLigne, type HorsBornes, type Reference, type TableCible, type TableEcrivable,
} from '@/lib/btp/schema-tables-btp'
import {
  lirePerimetreBtp, peutEcrireTable, projeter, visibiliteListe, type PerimetreBtp, type Visibilite,
} from '@/lib/btp/perimetre-compte'
import {
  chantiersAffectes, membreDuCompte,
  type ChantierBtp, type EquipeBtp, type MembreBtp, type ResolutionMembre,
} from '@/lib/btp/pointage-regles'

const btpBodySchema = z.object({
  table: z.enum(BTP_TABLES_ECRIVABLES),
  action: z.enum(['insert', 'update', 'delete', 'upsert_settings', 'import']),
  data: z.unknown().optional(),
  id: z.string().optional(),
})

// ── GET /api/btp — données BTP du compte connecté ───────────────────────────
// ?table=<clé de LECTURES>|settings|all (all : chantiers, membres, equipes, pointages, depenses, settings).
// ?chantier_id=<uuid> filtre aussi les pointages et les dépenses.

/** Une liste lue par la route : source en base, tri et nombre maximal de lignes renvoyées. */
interface LectureListe {
  /** Table ou vue lue en base. */
  source: string
  colonnes?: string
  /** Tri appliqué, dans l'ordre : [colonne, croissant]. */
  tri: Array<[string, boolean]>
  /** Nombre maximal de lignes renvoyées ; absent : la route ne pose pas de limite. */
  plafond?: number
  /** false pour une table de référence commune à tous les comptes (pas de filtre sur owner_id). */
  parProprietaire?: boolean
  /** Le paramètre chantier_id filtre aussi cette liste. */
  parChantier?: boolean
}

// Nombres maximaux de lignes : lib/btp/plafonds-lecture.ts (les écrans en tirent le message d'une liste coupée).
const LECTURES: Record<string, LectureListe> = {
  chantiers: { source: 'chantiers_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.chantiers },
  membres: { source: 'membres_btp', tri: [['nom', true]], plafond: PLAFONDS_LECTURE_BTP.membres },
  equipes: { source: 'equipes_btp', colonnes: '*, equipe_membres_btp(membre_id)', tri: [['created_at', false]] },
  pointages: { source: 'pointages_btp', tri: [['date', false]], plafond: PLAFONDS_LECTURE_BTP.pointages, parChantier: true },
  depenses: { source: 'depenses_btp', tri: [['date', false]], plafond: PLAFONDS_LECTURE_BTP.depenses, parChantier: true },
  situations: { source: 'situations_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.situations },
  retenues: { source: 'retenues_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.retenues },
  dc4: { source: 'dc4_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dc4 },
  dce_analyses: { source: 'dce_analyses_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dce_analyses },
  dpgf: { source: 'dpgf_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.dpgf },
  ref_taux: { source: 'ref_taux', tri: [['juridiction', true], ['regime', true], ['type_charge', true]], parProprietaire: false },
  charges_fixes: { source: 'charges_fixes', tri: [['categorie', true], ['label', true]] },
  rapports: { source: 'rapports_btp', tri: [['created_at', false]], plafond: PLAFONDS_LECTURE_BTP.rapports },
  rentabilite: { source: 'v_rentabilite_chantier', tri: [], plafond: PLAFONDS_LECTURE_BTP.rentabilite },
}

const MESSAGE_LECTURE_IMPOSSIBLE = 'Les données n\'ont pas pu être chargées. Réessayez dans un instant.'

/** La base a répondu en erreur : la route le dit (500) au lieu de renvoyer une liste vide. */
class ErreurLecture extends Error {
  constructor(readonly source: string, readonly erreurBase: { code?: string; message?: string }) {
    super(`lecture de ${source} en erreur`)
  }
}

interface ListeLue {
  lignes: Record<string, unknown>[]
  /** Nombre maximal de lignes atteint : d'autres lignes existent au-delà (null : liste complète). */
  plafondAtteint: number | null
}

async function lireListe(cle: string, userId: string, chantierId: string | null): Promise<ListeLue> {
  const lecture = LECTURES[cle]
  let requete = supabaseAdmin.from(lecture.source).select(lecture.colonnes ?? '*')
  if (lecture.parProprietaire !== false) requete = requete.eq('owner_id', userId)
  if (lecture.parChantier && chantierId) requete = requete.eq('chantier_id', chantierId)
  for (const [colonne, croissant] of lecture.tri) requete = requete.order(colonne, { ascending: croissant })
  // Une ligne de plus que le maximum : sa présence dit que la liste est coupée (constat donnees-btp-10). Les lignes
  // renvoyées restent les mêmes qu'avant : les `plafond` premières dans le même ordre.
  if (lecture.plafond) requete = requete.limit(lecture.plafond + 1)
  const { data, error } = await requete
  if (error) throw new ErreurLecture(lecture.source, error)
  const lignes = (data ?? []) as unknown as Record<string, unknown>[]
  if (lecture.plafond && lignes.length > lecture.plafond) {
    return { lignes: lignes.slice(0, lecture.plafond), plafondAtteint: lecture.plafond }
  }
  return { lignes, plafondAtteint: null }
}

/**
 * Chantiers que le salarié voit en vue restreinte : ceux « En cours » qui lui sont affectés, directement ou par une
 * de ses équipes (même règle que le pointage, `chantiersAffectes`). Sa fiche employé est retrouvée par son adresse
 * e-mail : sans fiche, ou avec deux fiches actives à la même adresse, il ne voit aucun chantier — c'est au gérant de
 * relier le compte à la fiche, et la réponse le dit par `rattachement`.
 */
async function chantiersDuSalarie(
  perimetre: PerimetreBtp,
  chantiers: readonly Record<string, unknown>[],
): Promise<{ lignes: Record<string, unknown>[]; rattachement: ResolutionMembre['statut'] }> {
  const [membres, equipes] = await Promise.all([
    lireListe('membres', perimetre.societeId, null),
    lireListe('equipes', perimetre.societeId, null),
  ])
  const resolution = membreDuCompte(membres.lignes as unknown as MembreBtp[], perimetre.email)
  if (resolution.statut !== 'relie') return { lignes: [], rattachement: resolution.statut }
  const siens = chantiersAffectes(
    resolution.membre,
    chantiers as unknown as ChantierBtp[],
    equipes.lignes as unknown as EquipeBtp[],
  )
  return { lignes: siens as unknown as Record<string, unknown>[], rattachement: 'relie' }
}

/** État du rattachement du compte à sa fiche employé, renseigné seulement quand une vue restreinte l'a cherché. */
type Rattachement = ResolutionMembre['statut'] | null

/**
 * Lecture d'une liste pour le compte connecté : rien si son rôle n'y a pas accès, tout s'il a FULL (ou READ sur une
 * liste montrée en entier en lecture, comme les rapports), sinon la vue restreinte (moins de lignes ET moins de
 * colonnes, voir lib/btp/perimetre-compte.ts).
 */
async function lireListePour(
  perimetre: PerimetreBtp,
  cle: string,
  chantierId: string | null,
): Promise<{ liste: ListeLue; rattachement: Rattachement; visibilite: Visibilite }> {
  const visibilite = visibiliteListe(perimetre, cle)
  if (visibilite === 'aucune') return { liste: { lignes: [], plafondAtteint: null }, rattachement: null, visibilite }

  const brute = await lireListe(cle, perimetre.societeId, chantierId)
  if (visibilite === 'tout') return { liste: brute, rattachement: null, visibilite }

  if (cle === 'chantiers') {
    const { lignes, rattachement } = await chantiersDuSalarie(perimetre, brute.lignes)
    return { liste: { lignes: projeter(cle, lignes), plafondAtteint: brute.plafondAtteint }, rattachement, visibilite }
  }
  return { liste: { lignes: projeter(cle, brute.lignes), plafondAtteint: brute.plafondAtteint }, rattachement: null, visibilite }
}

/**
 * Ce que la réponse dit d'une lecture restreinte, pour que l'écran n'affiche pas « aucun chantier » sans raison.
 * `restreint` ne se dit que si quelque chose l'a vraiment été : un rôle d'équipe qui a FULL partout (la secrétaire,
 * ou un salarié à qui le gérant a tout ouvert) reçoit la même réponse que le gérant.
 */
function etatRestriction(visibilites: readonly Visibilite[], rattachement: Rattachement): Record<string, unknown> {
  if (visibilites.every(v => v === 'tout')) return {}
  return { restreint: true, ...(rattachement === null ? {} : { rattachement }) }
}

/** `plafondsAtteints` de la réponse : seulement les listes coupées ; absent si toutes sont complètes. */
function plafondsAtteints(listes: Record<string, ListeLue>): { plafondsAtteints?: Record<string, number> } {
  const atteints = Object.fromEntries(
    Object.entries(listes).flatMap(([cle, liste]) => (liste.plafondAtteint === null ? [] : [[cle, liste.plafondAtteint]])),
  )
  return Object.keys(atteints).length > 0 ? { plafondsAtteints: atteints } : {}
}

/** Réglages du compte ; null s'ils n'ont jamais été enregistrés (ce n'est pas une erreur). */
async function lireReglages(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.from('settings_btp').select('*').eq('owner_id', userId).maybeSingle()
  if (error) throw new ErreurLecture('settings_btp', error)
  return (data ?? null) as Record<string, unknown> | null
}

/** Équipes avec la liste de leurs membres (`membreIds`), lue dans equipe_membres_btp. */
function avecMembreIds(equipes: Record<string, unknown>[]): Record<string, unknown>[] {
  return equipes.map(e => ({
    ...e,
    membreIds: ((e.equipe_membres_btp as { membre_id: string }[] | undefined) || []).map(m => m.membre_id),
  }))
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const url = new URL(request.url)
  const table = url.searchParams.get('table') || 'all'
  const chantierId = url.searchParams.get('chantier_id')
  if (chantierId && !FORMAT_UUID.test(chantierId)) {
    return NextResponse.json({ error: 'Identifiant de chantier invalide' }, { status: 400 })
  }

  try {
    // Société du compte, rôle d'équipe et permissions : une seule résolution, serveur, pour la lecture comme pour
    // l'écriture. Pour un titulaire, societeId vaut user.id et rien ne change par rapport à avant ce lot.
    const perimetre = await lirePerimetreBtp(user, supabaseAdmin)
    // Ligne d'équipe du compte illisible (panne, délai dépassé) : son périmètre vide n'est pas un refus. Répondre des
    // listes vides montrait « aucun chantier » sans erreur, liste que le tableau de bord gardait 5 minutes en cache
    // (signalement du 27/11/2026). Erreur, comme toute autre lecture en échec.
    if (perimetre.illisible) return reponseLectureImpossible(new Error('périmètre du compte illisible (ligne d’équipe)'))

    if (table === 'all') {
      const visibiliteReglages = visibiliteListe(perimetre, 'settings')
      const [chantiers, membres, equipes, pointages, depenses, settings] = await Promise.all([
        lireListePour(perimetre, 'chantiers', chantierId),
        lireListePour(perimetre, 'membres', chantierId),
        lireListePour(perimetre, 'equipes', chantierId),
        lireListePour(perimetre, 'pointages', chantierId),
        lireListePour(perimetre, 'depenses', chantierId),
        visibiliteReglages === 'tout' ? lireReglages(perimetre.societeId) : Promise.resolve(null),
      ])
      return NextResponse.json({
        chantiers: chantiers.liste.lignes, membres: membres.liste.lignes, equipes: avecMembreIds(equipes.liste.lignes),
        pointages: pointages.liste.lignes, depenses: depenses.liste.lignes, settings,
        ...plafondsAtteints({
          chantiers: chantiers.liste, membres: membres.liste, equipes: equipes.liste,
          pointages: pointages.liste, depenses: depenses.liste,
        }),
        ...etatRestriction(
          [chantiers, membres, equipes, pointages, depenses].map(l => l.visibilite).concat(visibiliteReglages),
          chantiers.rattachement,
        ),
      })
    }

    if (table === 'settings') {
      const visibilite = visibiliteListe(perimetre, 'settings')
      const reglages = visibilite === 'tout' ? await lireReglages(perimetre.societeId) : null
      return NextResponse.json({ settings: reglages, ...etatRestriction([visibilite], null) })
    }

    // Nom de la liste pris dans la liste blanche elle-même : la valeur reçue ne sert jamais de nom de propriété.
    const cle = Object.keys(LECTURES).find((nom) => nom === table)
    if (!cle) {
      return NextResponse.json({ error: 'Table invalide' }, { status: 400 })
    }
    const { liste, rattachement, visibilite } = await lireListePour(perimetre, cle, chantierId)
    return NextResponse.json({
      [cle]: cle === 'equipes' ? avecMembreIds(liste.lignes) : liste.lignes,
      ...plafondsAtteints({ [cle]: liste }),
      ...etatRestriction([visibilite], rattachement),
    })
  } catch (err) {
    return reponseLectureImpossible(err)
  }
}

/** Panne, délai dépassé, table ou colonne absente : jamais une liste vide inventée (constat api-coeur-6). */
function reponseLectureImpossible(err: unknown): NextResponse {
  if (err instanceof ErreurLecture) {
    logger.error('[btp] GET : la base a répondu en erreur', { source: err.source, code: err.erreurBase.code, error: err.erreurBase.message })
  } else {
    logger.error('[btp] GET error', { error: err instanceof Error ? err.message : err })
  }
  return NextResponse.json({ error: MESSAGE_LECTURE_IMPOSSIBLE }, { status: 500 })
}

// ── POST /api/btp — créer, modifier, supprimer, reprendre les anciennes données du navigateur ───────────────
// Corps : { table, action: 'insert'|'update'|'delete'|'upsert_settings'|'import', data, id? }.
// Ce que chaque table accepte (colonnes du relevé de production, types, bornes) : lib/btp/schema-tables-btp.ts.

type Ligne = Record<string, unknown>

// Comptes qui écrivent ici : ceux du tableau de bord professionnel. L'artisan aussi, parce que l'accueil partagé
// reprend par cette route ses anciennes données du navigateur ; et le compte sans rôle, que le tableau de bord traite
// en artisan (rôle pas encore attribué à l'inscription). Un client, un copropriétaire ou un syndic n'a rien à écrire
// dans ces tables (constat donnees-btp-9). La lecture (GET) ne change pas : chacun ne lit que ses propres lignes.
const ROLES_ECRITURE = new Set(['pro_societe', 'super_admin', 'artisan', 'pro_conciergerie', 'pro_gestionnaire'])

function peutEcrire(user: User): boolean {
  const role: unknown = user.app_metadata?.role
  return role === undefined || role === null || role === '' || (typeof role === 'string' && ROLES_ECRITURE.has(role))
}

const CONTRATS_PAR_ROLE: Record<string, string[]> = {
  gerant: ['independant'],
  ouvrier: ['cdi', 'cdd', 'interim', 'apprenti'],
  chef_chantier: ['cdi', 'cdd', 'interim'],
  conducteur_travaux: ['cdi', 'cdd'],
  secretaire: ['cdi', 'cdd', 'apprenti', 'stage'],
}

const MESSAGE_LISTE_MEMBRES_INVALIDE = 'Enregistrement refusé : la liste des membres de l\'équipe est invalide.'

/** La base a répondu en erreur pendant une écriture ; `messageUtilisateur` remplace alors « Erreur serveur ». */
class ErreurEcriture extends Error {
  constructor(readonly erreurBase: ErreurBase, readonly messageUtilisateur?: string, readonly statut = 500) {
    super('écriture en erreur')
  }
}

// ── Rattachements (constat api-coeur-9) : chantier_id, membre_id, equipe_id, les membres d'une équipe et les employés
// affectés à un chantier (membres_ids) ne désignent que des fiches du compte. Une valeur déjà enregistrée sur la fiche,
// renvoyée telle quelle, reste acceptée.
const INTROUVABLE: Record<TableCible, string> = {
  chantiers_btp: 'chantier introuvable dans votre compte',
  membres_btp: 'membre de l\'équipe introuvable dans votre compte',
  equipes_btp: 'équipe introuvable dans votre compte',
}

const messageReferences = (references: Reference[]) => [...new Set(references.map(r => INTROUVABLE[r.cible]))].join(', ')

/** Membres d'une équipe, sans doublon ; undefined si la requête n'en parle pas, null si la liste est invalide. */
function membresDeLEquipe(membreIds: unknown): string[] | null | undefined {
  if (membreIds === undefined || membreIds === null) return undefined
  if (!Array.isArray(membreIds) || !membreIds.every(m => typeof m === 'string' && FORMAT_UUID.test(m))) return null
  return [...new Set(membreIds.map(m => String(m).toLowerCase()))]
}

const versReferences = (membres: string[] | undefined): Reference[] =>
  (membres ?? []).map(id => ({ colonne: 'membreIds', cible: 'membres_btp' as const, id }))

/** Fiches désignées qui n'appartiennent pas au compte (autre société, ou fiche supprimée). Une requête par table. */
async function referencesEtrangeres(userId: string, references: Reference[]): Promise<Reference[]> {
  const parCible = new Map<TableCible, Set<string>>()
  for (const r of references) parCible.set(r.cible, (parCible.get(r.cible) ?? new Set<string>()).add(r.id.toLowerCase()))
  const etrangeres: Reference[] = []
  for (const [cible, ids] of parCible) {
    const { data, error } = await supabaseAdmin.from(cible).select('id').eq('owner_id', userId).in('id', [...ids])
    if (error) throw new ErreurEcriture(error)
    const duCompte = new Set(((data ?? []) as { id: unknown }[]).map(l => String(l.id).toLowerCase()))
    etrangeres.push(...references.filter(r => r.cible === cible && !duCompte.has(r.id.toLowerCase())))
  }
  return etrangeres
}

/** Rattachements de la ligne, et membres de l'équipe, qui ne désignent pas une fiche du compte. */
async function rattachementsEtrangers(userId: string, table: TableEcrivable, ligne: Ligne, membres: string[] | undefined): Promise<Reference[]> {
  const references = [...referencesDeLigne(table, ligne), ...versReferences(membres)]
  return references.length > 0 ? referencesEtrangeres(userId, references) : []
}

/** Membres liés à l'équipe (identifiants en minuscules). `messageUtilisateur` : ce que l'écran lit si la lecture échoue. */
async function lireMembresLies(equipeId: string, messageUtilisateur?: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('equipe_membres_btp').select('membre_id').eq('equipe_id', equipeId)
  if (error) throw new ErreurEcriture(error, messageUtilisateur)
  return new Set(((data ?? []) as { membre_id: unknown }[]).map(l => String(l.membre_id).toLowerCase()))
}

const MESSAGE_MEMBRES_NON_MIS_A_JOUR = 'L\'équipe est enregistrée, mais la liste de ses membres n\'a pas pu être mise à jour. Réessayez dans un instant.'

/**
 * Membres d'une équipe ramenés à la liste reçue, en n'écrivant que la différence avec les liens enregistrés : seuls les
 * liens retirés sont supprimés, seuls les nouveaux sont ajoutés (relecture adverse du 15/11/2026). Un lien inchangé
 * n'est jamais réécrit, même un lien ancien que la base refuserait aujourd'hui d'écrire, et un échec ne retire jamais
 * un membre que la liste garde. Sans transaction possible ici : un échec est dit (500) au lieu d'un succès, et l'écran
 * peut renvoyer la liste. Appelée une fois l'équipe reconnue comme appartenant au compte.
 */
async function mettreAJourMembres(equipeId: string, membres: string[]): Promise<void> {
  const lies = await lireMembresLies(equipeId, MESSAGE_MEMBRES_NON_MIS_A_JOUR)
  const gardes = new Set(membres)
  const retires = [...lies].filter(membre => !gardes.has(membre))
  const ajoutes = membres.filter(membre => !lies.has(membre))
  if (retires.length > 0) {
    const { error } = await supabaseAdmin.from('equipe_membres_btp').delete().eq('equipe_id', equipeId).in('membre_id', retires)
    if (error) throw new ErreurEcriture(error, MESSAGE_MEMBRES_NON_MIS_A_JOUR)
  }
  if (ajoutes.length > 0) {
    const { error } = await supabaseAdmin
      .from('equipe_membres_btp')
      .insert(ajoutes.map(membre => ({ equipe_id: equipeId, membre_id: membre })))
    if (error) throw new ErreurEcriture(error, MESSAGE_MEMBRES_NON_MIS_A_JOUR)
  }
}

/** Liens d'une équipe que la requête vient de créer ; s'ils ne s'écrivent pas, l'équipe est retirée (pas de doublon au nouvel essai). */
async function lierMembresDeLaNouvelleEquipe(userId: string, equipeId: string, membres: string[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from('equipe_membres_btp')
    .insert(membres.map(membre => ({ equipe_id: equipeId, membre_id: membre })))
  if (!error) return
  const { error: erreurRetrait } = await supabaseAdmin.from('equipes_btp').delete().eq('id', equipeId).eq('owner_id', userId)
  if (erreurRetrait) logger.error('[btp] équipe créée sans ses membres, retrait impossible', { id: equipeId, code: erreurRetrait.code })
  throw new ErreurEcriture(error, 'L\'équipe n\'a pas été créée : ses membres n\'ont pas pu être enregistrés. Réessayez dans un instant.')
}

/**
 * Rattachements hors du compte que la modification CHANGE. Ceux déjà enregistrés sur la fiche (ou déjà liés à
 * l'équipe, ou déjà dans la liste des employés du chantier), renvoyés tels quels par un formulaire complet, restent
 * acceptés : refuser bloquerait la fiche existante. membres_ids n'a pas de clé étrangère : un employé supprimé depuis
 * reste dans la liste, et l'écran la renvoie entière.
 */
async function rattachementsNouveaux(etrangeres: Reference[], enBase: Ligne, equipeId: string): Promise<Reference[]> {
  if (etrangeres.length === 0) return []
  const lies = etrangeres.some(r => r.colonne === 'membreIds') ? await lireMembresLies(equipeId) : new Set<string>()
  return etrangeres.filter(r => (r.colonne === 'membreIds' ? !lies.has(r.id.toLowerCase()) : !dejaEnregistre(r.id, enBase[r.colonne])))
}

const refus = (message: string, status = 400) => NextResponse.json({ error: message }, { status })
const estObjet = (valeur: unknown): valeur is Ligne => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

/** Fiche envoyée par l'écran, sans les colonnes système ni les champs que la route traite à part. */
function preparer(donnees: Ligne): { ligne: Ligne; membreIds: unknown } {
  const ligne: Ligne = { ...donnees }
  for (const colonne of COLONNES_SYSTEME) delete ligne[colonne]
  // Relation lue par GET avec les équipes, renvoyée telle quelle par certains écrans : jamais une colonne.
  delete ligne.equipe_membres_btp
  const membreIds = ligne.membreIds
  delete ligne.membreIds
  return { ligne, membreIds }
}

/** Contrat incompatible avec le rôle d'un membre de l'équipe : le refus (400), sinon null. */
function verifierContrat(table: TableEcrivable, donnees: Ligne): NextResponse | null {
  if (table !== 'membres_btp') return null
  const role = donnees.type_compte
  const contrat = donnees.type_contrat
  if (typeof role !== 'string' || typeof contrat !== 'string' || !Object.prototype.hasOwnProperty.call(CONTRATS_PAR_ROLE, role)) return null
  if (CONTRATS_PAR_ROLE[role].includes(contrat)) return null
  return refus(`Contrat "${contrat}" invalide pour le rôle "${role}". Contrats autorisés : ${CONTRATS_PAR_ROLE[role].join(', ')}`)
}

/**
 * Bornes d'une modification : seules les valeurs qui CHANGENT la valeur enregistrée sont refusées. Une valeur déjà en
 * base, renvoyée telle quelle par un formulaire complet, ne doit pas empêcher d'enregistrer la fiche.
 */
function refusBornes(hors: HorsBornes[], ligne: Ligne, enBase: Ligne | null): string | null {
  const nouvelles = hors.filter(h => !enBase || !memeValeur(ligne[h.colonne], enBase[h.colonne]))
  return nouvelles.length > 0 ? nouvelles.map(h => h.message).join(' ') : null
}

async function lireFiche(table: TableEcrivable, id: string, userId: string): Promise<Ligne | null> {
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('id', id).eq('owner_id', userId).maybeSingle()
  if (error) throw new ErreurEcriture(error)
  return (data ?? null) as Ligne | null
}

/**
 * Colonnes récentes de chantiers_btp, qu'une base pas encore migrée n'a pas : PostgREST répond PGRST204 (écriture) ou
 * 42703 en nommant la colonne. Le chantier s'enregistre alors sans elle au lieu d'échouer.
 * - membres_ids (employés affectés, migration 20261116) : déjà contrôlés (format, même compte), le second essai
 *   n'écrit que des colonnes contrôlées ;
 * - alerte_meteo (alerte météo par notification, migration 20261126b) : décochée (valeur par défaut de la colonne),
 *   elle est retirée et le reste de la fiche est enregistré ; cochée, toute l'écriture est refusée (409) et rien n'est
 *   enregistré (ecrireSansColonnesAbsentes).
 */
const COLONNES_RECENTES_CHANTIER: Readonly<Record<string, string>> = {
  membres_ids: 'chantier enregistré sans ses employés (migration 20261116 à appliquer)',
  alerte_meteo: 'chantier enregistré sans son alerte météo (migration 20261126b à appliquer)',
}

/** Colonne récente absente de la base que nomme l'erreur, si la ligne la porte ; sinon null. */
function colonneRecenteAbsente(table: TableEcrivable, ligne: Ligne, error: ErreurBase | null): string | null {
  if (!error || table !== 'chantiers_btp' || (error.code !== 'PGRST204' && error.code !== '42703')) return null
  const message = error.message ?? ''
  return Object.keys(COLONNES_RECENTES_CHANTIER).find(col => col in ligne && message.includes(col)) ?? null
}

/** Case « Alerte météo » cochée alors que la colonne manque : toute l'écriture est refusée, plutôt que perdue en silence. */
const MESSAGE_ALERTE_METEO_EN_ATTENTE = 'Chantier non enregistré : l’alerte météo attend une mise à jour de la base. Décochez-la pour '
  + 'enregistrer le reste, ou réessayez plus tard. — Obra não guardada: o alerta meteorológico aguarda uma atualização da '
  + 'base de dados. Desmarque-o para guardar o resto, ou tente mais tarde.'

/**
 * Rejoue l'écriture sans chaque colonne récente absente de la base (une à la fois, deux au plus). Exception : une
 * alerte météo demandée (case cochée) n'est jamais retirée en silence, l'écriture est refusée (409) et la fiche reste
 * ouverte ; décochée, elle vaut la valeur par défaut de la colonne et peut être retirée.
 */
async function ecrireSansColonnesAbsentes<R extends { error: ErreurBase | null }>(
  table: TableEcrivable, ligne: Ligne, ecrire: () => PromiseLike<R>,
): Promise<R> {
  let resultat = await ecrire()
  for (let essai = 0; essai < Object.keys(COLONNES_RECENTES_CHANTIER).length; essai++) {
    const absente = colonneRecenteAbsente(table, ligne, resultat.error)
    if (!absente) break
    if (absente === 'alerte_meteo' && ligne.alerte_meteo === true) {
      throw new ErreurEcriture(resultat.error as ErreurBase, MESSAGE_ALERTE_METEO_EN_ATTENTE, 409)
    }
    logger.warn(`[btp] chantiers_btp.${absente} absente : ${COLONNES_RECENTES_CHANTIER[absente]}`)
    delete ligne[absente]
    resultat = await ecrire()
  }
  return resultat
}

async function creer(userId: string, table: TableEcrivable, donnees: unknown): Promise<NextResponse> {
  if (!estObjet(donnees)) return refus('Données invalides')
  const contrat = verifierContrat(table, donnees)
  if (contrat) return contrat
  const { ligne, membreIds } = preparer(donnees)
  const raison = verifierLigne(table, ligne, 'creation')
  if (raison) return refus(`Enregistrement refusé : ${raison}.`)
  const hors = valeursHorsBornes(table, ligne)
  if (hors.length > 0) return refus(hors.map(h => h.message).join(' '))

  const membres = table === 'equipes_btp' ? membresDeLEquipe(membreIds) : undefined
  if (membres === null) return refus(MESSAGE_LISTE_MEMBRES_INVALIDE)
  const etrangeres = await rattachementsEtrangers(userId, table, ligne, membres)
  if (etrangeres.length > 0) return refus(`Enregistrement refusé : ${messageReferences(etrangeres)}.`)

  const inserer = () => supabaseAdmin.from(table).insert({ ...ligne, owner_id: userId }).select().single()
  const { data: inseree, error } = await ecrireSansColonnesAbsentes(table, ligne, inserer)
  if (error) throw new ErreurEcriture(error)
  if (membres && membres.length > 0) await lierMembresDeLaNouvelleEquipe(userId, inseree.id, membres)
  return NextResponse.json({ row: inseree }, { status: 201 })
}

/**
 * Modification qui porte une valeur hors bornes ou un rattachement hors du compte : acceptée seulement si cette valeur
 * est déjà celle de la fiche (ou si ce membre est déjà lié à l'équipe, ou cet employé déjà dans la liste du chantier),
 * et alors signalée au journal.
 * Renvoie le refus à répondre, sinon null.
 */
async function refusFaceALaFiche(
  userId: string, table: TableEcrivable, id: string, ligne: Ligne, hors: HorsBornes[], etrangeres: Reference[],
): Promise<NextResponse | null> {
  const enBase = await lireFiche(table, id, userId)
  if (!enBase) return refus(MESSAGE_FICHE_INTROUVABLE, 404)
  const message = refusBornes(hors, ligne, enBase)
  if (message) return refus(message)
  const nouveaux = await rattachementsNouveaux(etrangeres, enBase, id)
  if (nouveaux.length > 0) return refus(`Enregistrement refusé : ${messageReferences(nouveaux)}.`)
  if (hors.length > 0) {
    logger.warn('[btp] valeur hors bornes déjà en base, renvoyée telle quelle : acceptée', { table, id, colonnes: hors.map(h => h.colonne) })
  }
  if (etrangeres.length > 0) {
    logger.warn('[btp] rattachement déjà en base hors du compte, renvoyé tel quel : accepté', { table, id, colonnes: [...new Set(etrangeres.map(r => r.colonne))] })
  }
  return null
}

async function modifier(userId: string, table: TableEcrivable, id: string, donnees: unknown): Promise<NextResponse> {
  if (!estObjet(donnees)) return refus('Données invalides')
  const contrat = verifierContrat(table, donnees)
  if (contrat) return contrat
  const { ligne, membreIds } = preparer(donnees)
  const raison = verifierLigne(table, ligne, 'modification')
  if (raison) return refus(`Enregistrement refusé : ${raison}.`)

  const membres = table === 'equipes_btp' ? membresDeLEquipe(membreIds) : undefined
  if (membres === null) return refus(MESSAGE_LISTE_MEMBRES_INVALIDE)
  const etrangeres = await rattachementsEtrangers(userId, table, ligne, membres)
  const hors = valeursHorsBornes(table, ligne)
  if (hors.length > 0 || etrangeres.length > 0) {
    const refusEnBase = await refusFaceALaFiche(userId, table, id, ligne, hors, etrangeres)
    if (refusEnBase) return refusEnBase
  }

  if (table === 'chantiers_btp') ligne.updated_at = new Date().toISOString()

  // Aucune colonne à écrire (seuls les membres d'une équipe changent) : PostgREST ne renvoie aucune ligne pour
  // un UPDATE vide, et la modification échouerait. On lit alors la ligne, ce qui vérifie qu'elle appartient
  // bien à l'appelant avant de toucher à ses membres.
  const ecrire = () => Object.keys(ligne).length === 0
    ? supabaseAdmin.from(table).select().eq('id', id).eq('owner_id', userId).single()
    : supabaseAdmin.from(table).update(ligne).eq('id', id).eq('owner_id', userId).select().single()
  const { data: modifiee, error } = await ecrireSansColonnesAbsentes(table, ligne, ecrire)
  if (error) throw new ErreurEcriture(error)

  if (membres !== undefined) await mettreAJourMembres(id, membres)
  return NextResponse.json({ row: modifiee })
}

async function supprimer(userId: string, table: TableEcrivable, id: string): Promise<NextResponse> {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id).eq('owner_id', userId)
  if (error) throw new ErreurEcriture(error)
  return NextResponse.json({ deleted: true })
}

async function enregistrerReglages(userId: string, donnees: unknown): Promise<NextResponse> {
  if (donnees !== undefined && donnees !== null && !estObjet(donnees)) return refus('Données invalides')
  const ligne: Ligne = estObjet(donnees) ? { ...donnees } : {}
  for (const colonne of COLONNES_SYSTEME) delete ligne[colonne]
  const raison = verifierLigne('settings_btp', ligne, 'modification')
  if (raison) return refus(`Enregistrement refusé : ${raison}.`)

  const hors = valeursHorsBornes('settings_btp', ligne)
  if (hors.length > 0) {
    const { data: enBase, error } = await supabaseAdmin.from('settings_btp').select('*').eq('owner_id', userId).maybeSingle()
    if (error) throw new ErreurEcriture(error)
    const message = refusBornes(hors, ligne, (enBase ?? null) as Ligne | null)
    if (message) return refus(message)
    logger.warn('[btp] valeur hors bornes déjà en base, renvoyée telle quelle : acceptée', { table: 'settings_btp', colonnes: hors.map(h => h.colonne) })
  }

  const { data: reglages, error } = await supabaseAdmin
    .from('settings_btp')
    .upsert({ ...ligne, updated_at: new Date().toISOString(), owner_id: userId })
    .select()
    .single()
  if (error) throw new ErreurEcriture(error)
  return NextResponse.json({ settings: reglages })
}

/** Lignes d'une reprise, prêtes à insérer au nom du compte ; sinon la raison du refus (rien n'est alors ajouté). */
function preparerReprise(userId: string, table: TableEcrivable, donnees: unknown[]): { lignes: Ligne[] } | { refus: string } {
  const lignes: Ligne[] = []
  for (const [rang, brute] of donnees.entries()) {
    if (!estObjet(brute)) return { refus: `Import refusé, ligne ${rang + 1} : données invalides. Rien n'a été ajouté.` }
    const ligne: Ligne = { ...brute }
    for (const colonne of COLONNES_SYSTEME) delete ligne[colonne]
    const raison = verifierLigne(table, ligne, 'reprise')
    if (raison) return { refus: `Import refusé, ligne ${rang + 1} : ${raison}. Rien n'a été ajouté.` }
    const hors = valeursHorsBornes(table, ligne)
    if (hors.length > 0) {
      logger.warn('[btp] reprise : valeur hors bornes acceptée (anciennes données du navigateur)', { table, ligne: rang + 1, colonnes: hors.map(h => h.colonne) })
    }
    lignes.push({ ...ligne, owner_id: userId })
  }
  return { lignes }
}

/**
 * Reprise des anciennes données du navigateur (import automatique du tableau de bord, table vide en base).
 * Refusée si le compte a déjà des lignes dans la table : deux onglets, ou une lecture en erreur prise pour une table
 * vide, ajoutaient sinon les mêmes fiches une seconde fois. Colonnes et types contrôlés comme ailleurs ; les bornes
 * seulement signalées au journal, car ce sont des données déjà saisies.
 * `membreIds` n'est pas une colonne : la reprise d'anciennes équipes locales échoue comme avant (les identifiants de
 * membres du navigateur ne désignent aucun membre en base) ; la faire aboutir reprendrait d'anciennes données.
 */
async function reprendre(userId: string, table: TableEcrivable, donnees: unknown): Promise<NextResponse> {
  if (!Array.isArray(donnees)) return refus('Action invalide')
  if (donnees.length > 500) return refus('Import limité à 500 lignes max')
  if (donnees.length === 0) return NextResponse.json({ imported: 0 })

  const { count, error: erreurCompte } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if (erreurCompte) throw new ErreurEcriture(erreurCompte)
  if ((count ?? 0) > 0) {
    return refus('Import refusé : votre compte contient déjà des données dans cette liste. Rien n\'a été ajouté.', 409)
  }

  const preparation = preparerReprise(userId, table, donnees)
  if ('refus' in preparation) return refus(preparation.refus)
  const { lignes } = preparation

  const references = lignes.flatMap(ligne => referencesDeLigne(table, ligne))
  if (references.length > 0) {
    const etrangeres = await referencesEtrangeres(userId, references)
    if (etrangeres.length > 0) return refus(`Import refusé : ${messageReferences(etrangeres)}. Rien n'a été ajouté.`)
  }

  const { data: inserees, error } = await supabaseAdmin.from(table).insert(lignes).select()
  if (error) throw new ErreurEcriture(error)
  logger.info(`[btp] Import ${table}`, { count: lignes.length, userId })
  return NextResponse.json({ imported: inserees?.length || 0 })
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`btp_post_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!peutEcrire(user)) return refus('Action réservée aux comptes professionnels.', 403)

  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const parsed = btpBodySchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  const { table, action, data, id } = parsed.data

  // Réglages : une seule ligne par compte, écrite seulement par upsert_settings.
  if (table === 'settings_btp' && action !== 'upsert_settings') {
    return refus('Les réglages s\'enregistrent avec l\'action upsert_settings.')
  }

  try {
    // Avant ce lot, un sous-compte écrivait sous son PROPRE owner_id : ses lignes n'étaient vues de personne, et la
    // borne `owner_id = user.id` était tout ce qui l'empêchait de modifier ou de supprimer celles de la société.
    // Maintenant les écritures portent sur la société — donc seul un rôle d'équipe qui a FULL sur le module de la
    // table y touche. Un titulaire garde exactement ce qu'il avait.
    const perimetre = await lirePerimetreBtp(user, supabaseAdmin)
    if (!peutEcrireTable(perimetre, table)) {
      return refus('Votre rôle dans l\'entreprise ne permet pas de modifier ces données.', 403)
    }
    if (action === 'import' && !perimetre.titulaire) {
      return refus('La reprise des anciennes données est réservée au compte de l\'entreprise.', 403)
    }
    const societeId = perimetre.societeId

    switch (action) {
      case 'import': return await reprendre(societeId, table, data)
      case 'upsert_settings': return await enregistrerReglages(societeId, data)
      case 'insert': return await creer(societeId, table, data)
      case 'update': return id ? await modifier(societeId, table, id, data) : refus('Action invalide')
      case 'delete': return id ? await supprimer(societeId, table, id) : refus('Action invalide')
      default: return refus('Action invalide')
    }
  } catch (err) {
    return reponseEchecEcriture(err, table, action)
  }
}

/** Ce que le journal du serveur garde d'un échec d'écriture : le message de la base, sinon celui de l'erreur. */
function detailPourLeJournal(err: unknown, erreurBase: ErreurBase | null): unknown {
  if (erreurBase) return erreurBase.message
  return err instanceof Error ? err.message : err
}

/**
 * Réponse à une écriture qui a échoué : le message prévu par la route, sinon le refus de la base traduit en message
 * clair (fiche rattachée, fiche introuvable, contrainte, format), jamais le détail brut de la base (constats
 * donnees-btp-12, base-de-donnees-13, api-coeur-15).
 */
function reponseEchecEcriture(err: unknown, table: TableEcrivable, action: string): NextResponse {
  const erreurBase = err instanceof ErreurEcriture ? err.erreurBase : null
  logger.error(`[btp] POST ${table} ${action} error`, { code: erreurBase?.code, error: detailPourLeJournal(err, erreurBase) })
  if (err instanceof ErreurEcriture && err.messageUtilisateur) {
    return NextResponse.json({ error: err.messageUtilisateur }, { status: err.statut })
  }
  const { status, message } = traduireErreurBase(erreurBase, action, table)
  return NextResponse.json({ error: message }, { status })
}
