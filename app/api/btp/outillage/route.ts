import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { lirePerimetreBtp, niveauSur } from '@/lib/btp/perimetre-compte'
import { chantiersAffectes, fuseauValide, heureLocale, membreDuCompte, type ChantierBtp, type ResolutionMembre } from '@/lib/btp/pointage-regles'
import { TABLE_ABSENTE, lireDonneesSociete, type Ligne } from '@/lib/btp/pointage-serveur'
import {
  STATUT_CHANTIER_VERIFIE,
  decalerDate,
  etatVerification,
  lignesAEnregistrer,
  outilPourEcran,
  outilSchema,
  vendrediDeReference,
  verificationPourEcran,
  verificationSchema,
  type ChantierOutillage,
  type ContexteOutillage,
  type OutilEcran,
  type OutilSaisi,
  type VerificationEcran,
} from '@/lib/btp/outillage-regles'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/btp/outillage — outils et véhicules d'une société BTP, et vérification de chaque vendredi (26/11/2026).
//
// Deux usages, selon le niveau du compte sur le module `outillage` (lib/permissions.ts) :
//   - FULL (gérant, co-gérant, secrétaire, ou tout compte à qui le gérant l'a ouvert) : la « gestion » — tout le
//     répertoire, tous les chantiers en cours, l'historique de toutes les vérifications ; créer, modifier, retirer.
//   - READ (par défaut l'encarregado et le diretor de obra) : le responsable de chantier — les outils de SES chantiers
//     en cours (affectés par Pointage › Affectations ou par son équipe, comme pour le pointage), leurs vérifications,
//     et le droit de VALIDER la vérification de ces chantiers. Il ne touche pas au répertoire. Comme le pointage, une
//     validation n'est pas une écriture dans les données de la société : elle ajoute un constat signé, rien d'autre.
//   - NONE (par défaut l'ouvrier et le comptable) : 403.
//
// GET  ?fuseau= : ContexteOutillage (lib/btp/outillage-regles.ts). Aucune écriture.
// POST { action: 'creer' | 'modifier', outil } · { action: 'retirer', id } (gestion) ·
//      { action: 'valider', chantierId, lignes, observations } (gestion, ou responsable affecté au chantier).
//
// Toujours la société résolue côté serveur (lirePerimetreBtp), jamais une société désignée par l'écran. Un outil retiré
// garde sa ligne (retire_le) ; une vérification n'est jamais réécrite : une seconde de la même semaine s'ajoute.
// Tables de la migration 20261126 ; sans elle, GET rend `disponible: false` et toute écriture 409 migration_requise.
// ═══════════════════════════════════════════════════════════════════════════════

const SEMAINES_HISTORIQUE = 12
const MAX_OUTILS = 2000
const MAX_VERIFICATIONS = 300

const corpsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('creer'), outil: outilSchema }),
  z.object({ action: z.literal('modifier'), id: z.string().uuid(), outil: outilSchema }),
  z.object({ action: z.literal('retirer'), id: z.string().uuid() }),
  verificationSchema.extend({ action: z.literal('valider'), fuseau: z.string().max(64).optional() }),
])

const refus = (status: number, error: string) => NextResponse.json({ error }, { status })
const SANS_CACHE = { 'Cache-Control': 'private, no-store' }

class MigrationRequise extends Error {}

/** Erreur de lecture ou d'écriture : table absente (migration non appliquée) ou autre panne. */
function echec(error: { code?: unknown; message?: string }, quoi: string): Error {
  if (TABLE_ABSENTE.has(String(error.code))) return new MigrationRequise(quoi)
  return new Error(`${quoi} : ${error.message ?? 'erreur inconnue'}`)
}

interface Acces {
  user: User
  societeId: string
  /** Titulaire du compte de la société (son nom de compte vaut signature) ; faux pour tout sous-compte. */
  titulaire: boolean
  gestion: boolean
  resolution: ResolutionMembre
  /** Chantiers en cours que le compte vérifie : tous pour la gestion, ses chantiers affectés sinon. */
  verifiables: ChantierBtp[]
}

/** Société, niveau et chantiers du compte ; une réponse de refus si le module lui est fermé. */
async function lireAcces(user: User): Promise<Acces | NextResponse> {
  const role = getUserRole(user)
  if (role !== 'pro_societe' && role !== 'super_admin') return refus(403, 'reserve_btp')
  const perimetre = await lirePerimetreBtp(user, supabaseAdmin)
  const niveau = niveauSur(perimetre, 'outillage')
  if (niveau === 'NONE') return refus(403, 'acces_refuse')
  const gestion = niveau === 'FULL'
  const donnees = await lireDonneesSociete(perimetre.societeId)
  const resolution = membreDuCompte(donnees.membres, user.email)
  const enCours = donnees.chantiersEnCours.filter(c => c.statut === STATUT_CHANTIER_VERIFIE)
  let verifiables: ChantierBtp[] = []
  if (gestion) verifiables = enCours
  else if (resolution.statut === 'relie') verifiables = chantiersAffectes(resolution.membre, enCours, donnees.equipes)
  return { user, societeId: perimetre.societeId, titulaire: perimetre.titulaire, gestion, resolution, verifiables }
}

/**
 * Ce que lit un responsable : les seuls chantiers donnés, filtrés par la base (avant les limites de lecture) ; une
 * liste vide ne lit rien, mais interroge tout de même la table, pour savoir si la migration est appliquée.
 */
function bornerAuxChantiers<T extends { in: (colonne: string, valeurs: string[]) => T; limit: (n: number) => T }>(
  requete: T, chantierIds: readonly string[] | null,
): T {
  if (chantierIds === null) return requete
  return chantierIds.length > 0 ? requete.in('chantier_id', [...chantierIds]) : requete.limit(0)
}

/** Outils non retirés de la société ; ceux des chantiers donnés seulement si `chantierIds` n'est pas null. */
async function lireOutils(societeId: string, chantierIds: readonly string[] | null = null): Promise<OutilEcran[]> {
  const { data, error } = await bornerAuxChantiers(supabaseAdmin
    .from('outillage_btp').select('*').eq('owner_id', societeId).is('retire_le', null)
    .order('created_at', { ascending: true }).limit(MAX_OUTILS), chantierIds)
  if (error) throw echec(error, 'lecture de l’outillage')
  return ((data ?? []) as Ligne[]).map(outilPourEcran).filter((o): o is OutilEcran => o !== null)
}

async function lireVerifications(societeId: string, depuis: string, chantierIds: readonly string[] | null): Promise<VerificationEcran[]> {
  const { data, error } = await bornerAuxChantiers(supabaseAdmin
    .from('verifications_outillage_btp').select('*').eq('owner_id', societeId).gte('vendredi', depuis)
    .order('vendredi', { ascending: false }).order('created_at', { ascending: false }).limit(MAX_VERIFICATIONS), chantierIds)
  if (error) throw echec(error, 'lecture des vérifications')
  return ((data ?? []) as Ligne[]).map(verificationPourEcran).filter((v): v is VerificationEcran => v !== null)
}

/** Tous les chantiers de la société (où se trouve un outil, où l'envoyer), pour la gestion. */
async function lireLieux(societeId: string): Promise<ContexteOutillage['lieux']> {
  const { data, error } = await supabaseAdmin.from('chantiers_btp').select('*').eq('owner_id', societeId)
    .order('created_at', { ascending: false }).limit(1000)
  if (error) throw new Error(`lecture des chantiers : ${error.message}`)
  return ((data ?? []) as Ligne[]).flatMap(c => (typeof c.id === 'string'
    ? [{ id: c.id, titre: typeof c.titre === 'string' ? c.titre : '', statut: typeof c.statut === 'string' ? c.statut : '' }]
    : []))
}

const aujourdhuiDans = (fuseau: unknown) => heureLocale(Date.now(), fuseauValide(fuseau)).date
const adresseDe = (c: ChantierBtp) => [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')

const contexteVide = (acces: Acces, aujourdhui: string, vendredi: string, disponible: boolean): ContexteOutillage => ({
  disponible, gestion: acces.gestion, rattachement: acces.resolution.statut, aujourdhui, vendredi,
  chantiers: [], lieux: [], outils: [], verifications: [],
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return refus(401, 'Non autorisé')
  if (!(await checkRateLimit(`btp_outillage_get_${user.id}`, 60, 60_000))) return rateLimitResponse()

  try {
    const acces = await lireAcces(user)
    if (acces instanceof NextResponse) return acces
    const aujourdhui = aujourdhuiDans(request.nextUrl.searchParams.get('fuseau'))
    const vendredi = vendrediDeReference(aujourdhui)

    // Un responsable ne lit que ses chantiers : leurs outils et leurs vérifications, rien du dépôt ni des autres.
    const siens = acces.gestion ? null : acces.verifiables.map(c => c.id)
    let outils: OutilEcran[]
    let verifications: VerificationEcran[]
    try {
      ;[outils, verifications] = await Promise.all([
        lireOutils(acces.societeId, siens),
        lireVerifications(acces.societeId, decalerDate(vendredi, -7 * SEMAINES_HISTORIQUE), siens),
      ])
    } catch (err) {
      if (err instanceof MigrationRequise) return NextResponse.json(contexteVide(acces, aujourdhui, vendredi, false), { headers: SANS_CACHE })
      throw err
    }

    // Second filet, si la base ignorait le filtre : jamais une ligne d'un autre chantier.
    if (siens !== null) {
      const ensemble = new Set(siens)
      outils = outils.filter(o => o.chantierId !== null && ensemble.has(o.chantierId))
      verifications = verifications.filter(v => ensemble.has(v.chantierId))
    }

    const chantiers: ChantierOutillage[] = acces.verifiables.map(c => {
      const derniere = verifications.find(v => v.chantierId === c.id && v.vendredi === vendredi) ?? null
      return {
        id: c.id,
        titre: c.titre ?? '',
        adresse: adresseDe(c),
        etat: etatVerification({ aujourdhui, vendredi, faite: derniere !== null, outilsDuChantier: outils.filter(o => o.chantierId === c.id) }),
        derniere,
      }
    })

    const corps: ContexteOutillage = {
      ...contexteVide(acces, aujourdhui, vendredi, true),
      chantiers,
      lieux: acces.gestion ? await lireLieux(acces.societeId) : [],
      outils,
      verifications,
    }
    return NextResponse.json(corps, { headers: SANS_CACHE })
  } catch (err) {
    logger.error('[btp/outillage] GET', { error: err instanceof Error ? err.message : err })
    return refus(500, 'Erreur serveur')
  }
}

/** Le chantier désigné appartient-il à la société (quel que soit son statut) ? */
async function chantierDeLaSociete(societeId: string, chantierId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('chantiers_btp').select('id').eq('id', chantierId).eq('owner_id', societeId).maybeSingle()
  if (error) throw new Error(`lecture du chantier : ${error.message}`)
  return data !== null
}

const colonnesOutil = (outil: OutilSaisi) => ({
  type: outil.type, nom: outil.nom, reference: outil.reference, quantite: outil.quantite,
  chantier_id: outil.chantierId, etat: outil.etat, notes: outil.notes,
})

/**
 * Modification d'un outil de la société encore au répertoire ; null s'il n'existe pas (ou plus). Un changement
 * d'emplacement remet à maintenant la date d'arrivée sur place (chantier_depuis) : la vérification du chantier qu'il
 * rejoint n'est pas « en retard » pour un vendredi où il n'y était pas.
 */
async function modificationsDeLOutil(acces: Acces, id: string, outil: OutilSaisi): Promise<Ligne | null> {
  const { data, error } = await supabaseAdmin.from('outillage_btp').select('chantier_id')
    .eq('id', id).eq('owner_id', acces.societeId).is('retire_le', null).maybeSingle()
  if (error) throw echec(error, 'lecture de l’outil')
  if (!data) return null
  const maintenant = new Date().toISOString()
  const deplace = ((data as Ligne).chantier_id ?? null) !== outil.chantierId
  return { ...colonnesOutil(outil), updated_at: maintenant, ...(deplace ? { chantier_depuis: maintenant } : {}) }
}

async function enregistrerOutil(acces: Acces, outil: OutilSaisi, id: string | null): Promise<NextResponse> {
  if (outil.chantierId && !(await chantierDeLaSociete(acces.societeId, outil.chantierId))) return refus(422, 'chantier_inconnu')
  let requete
  if (id === null) {
    requete = supabaseAdmin.from('outillage_btp').insert({ owner_id: acces.societeId, ...colonnesOutil(outil) })
  } else {
    const changements = await modificationsDeLOutil(acces, id, outil)
    if (!changements) return refus(404, 'outil_introuvable')
    requete = supabaseAdmin.from('outillage_btp').update(changements).eq('id', id).eq('owner_id', acces.societeId).is('retire_le', null)
  }
  const { data, error } = await requete.select('*')
  if (error) throw echec(error, 'enregistrement de l’outil')
  const ligne = ((data ?? []) as Ligne[])[0]
  if (!ligne) return refus(404, 'outil_introuvable')
  return NextResponse.json({ outil: outilPourEcran(ligne) }, { status: id === null ? 201 : 200 })
}

async function retirerOutil(acces: Acces, id: string): Promise<NextResponse> {
  const maintenant = new Date().toISOString()
  const { data, error } = await supabaseAdmin.from('outillage_btp').update({ retire_le: maintenant, updated_at: maintenant })
    .eq('id', id).eq('owner_id', acces.societeId).is('retire_le', null).select('id')
  if (error) throw echec(error, 'retrait de l’outil')
  if ((data ?? []).length === 0) return refus(404, 'outil_introuvable')
  return NextResponse.json({ retire: id })
}

/**
 * Nom qui signe la vérification, montré aux responsables : sa fiche employé, sinon le nom posé par le serveur à
 * l'invitation (pro_team_members), sinon, pour le seul titulaire, le nom de son compte. Jamais l'adresse e-mail, et
 * jamais le nom qu'un sous-compte peut changer lui-même (user_metadata) : valide_par garde de toute façon le compte.
 */
async function nomDuValidateur(acces: Acces): Promise<string> {
  if (acces.resolution.statut === 'relie') {
    const { prenom, nom } = acces.resolution.membre
    const complet = [prenom, nom].filter(Boolean).join(' ').trim()
    if (complet) return complet
  }
  const { data, error } = await supabaseAdmin.from('pro_team_members').select('full_name')
    .eq('company_id', acces.societeId).eq('user_id', acces.user.id).eq('is_active', true).limit(1)
  if (error) logger.warn('[btp/outillage] nom du compte illisible', { error: error.message })
  const nomEquipe = (data as Ligne[] | null)?.[0]?.full_name
  if (typeof nomEquipe === 'string' && nomEquipe.trim()) return nomEquipe.trim()
  const meta = acces.user.user_metadata as Record<string, unknown> | undefined
  return acces.titulaire && typeof meta?.full_name === 'string' ? meta.full_name.trim() : ''
}

async function valider(acces: Acces, corps: z.infer<typeof verificationSchema> & { fuseau?: string }): Promise<NextResponse> {
  // Un responsable sans fiche employé n'a aucun chantier affecté : le dire plutôt qu'un « chantier non affecté ».
  if (!acces.gestion && acces.resolution.statut !== 'relie') {
    return refus(409, acces.resolution.statut === 'ambigu' ? 'fiche_ambigue' : 'fiche_absente')
  }
  const chantier = acces.verifiables.find(c => c.id === corps.chantierId)
  if (!chantier) return refus(403, 'chantier_non_affecte')

  const surLeChantier = (await lireOutils(acces.societeId, [chantier.id])).filter(o => o.chantierId === chantier.id)
  const resultat = lignesAEnregistrer(surLeChantier, corps.lignes, corps.observations)
  if ('refus' in resultat) return refus(resultat.refus === 'liste_changee' ? 409 : 422, resultat.refus)

  const { data, error } = await supabaseAdmin.from('verifications_outillage_btp').insert({
    owner_id: acces.societeId,
    chantier_id: chantier.id,
    chantier_titre: chantier.titre ?? '',
    vendredi: vendrediDeReference(aujourdhuiDans(corps.fuseau)),
    membre_id: acces.resolution.statut === 'relie' ? acces.resolution.membre.id : null,
    valide_par: acces.user.id,
    valide_par_nom: await nomDuValidateur(acces),
    lignes: resultat.lignes,
    manquants: resultat.manquants,
    en_panne: resultat.enPanne,
    observations: corps.observations,
  }).select('*')
  if (error) throw echec(error, 'enregistrement de la vérification')
  const ligne = ((data ?? []) as Ligne[])[0]
  return NextResponse.json({ verification: ligne ? verificationPourEcran(ligne) : null }, { status: 201 })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return refus(401, 'Non autorisé')
  if (!(await checkRateLimit(`btp_outillage_post_${user.id}`, 30, 60_000))) return rateLimitResponse()

  let brut: unknown
  try { brut = await request.json() } catch {
    return refus(400, 'Corps invalide')
  }
  const lu = corpsSchema.safeParse(brut)
  if (!lu.success) return refus(400, 'Données invalides')
  const corps = lu.data

  try {
    const acces = await lireAcces(user)
    if (acces instanceof NextResponse) return acces
    if (corps.action === 'valider') return await valider(acces, corps)
    if (!acces.gestion) return refus(403, 'reserve_a_la_gestion')
    if (corps.action === 'retirer') return await retirerOutil(acces, corps.id)
    return await enregistrerOutil(acces, corps.outil, corps.action === 'modifier' ? corps.id : null)
  } catch (err) {
    if (err instanceof MigrationRequise) return refus(409, 'migration_requise')
    logger.error('[btp/outillage] POST', { action: corps.action, error: err instanceof Error ? err.message : err })
    return refus(500, 'Erreur serveur')
  }
}
