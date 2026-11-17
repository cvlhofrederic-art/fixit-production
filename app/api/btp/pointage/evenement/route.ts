import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  chantierPourTelephone,
  chantiersAffectes,
  fuseauValide,
  heureLocale,
  instantDepart,
  normaliserEmail,
  reperesArrivee,
  type ChantierBtp,
  type MembreBtp,
} from '@/lib/btp/pointage-regles'
import {
  TABLE_ABSENTE,
  changementsCloture,
  changementsSansHeures,
  clore,
  lireDonneesSociete,
  ouvrirPointage,
  pointagesOuverts,
  regulariserOublis,
  type DonneesSociete,
  type Ligne,
} from '@/lib/btp/pointage-serveur'
import {
  NOTE_PASSAGE_BREF,
  PASSAGE_BREF_MS,
  empreinteJeton,
  evenementSchema,
  instantEvenement,
  jetonDeLEnTete,
  noteArriveeTardive,
  type EvenementZone,
} from '@/lib/btp/pointage-arriere-plan'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/btp/pointage/evenement — arrivées et départs envoyés par le code natif de l'appli Vitfix Pro
// (@capgo/background-geolocation : géorepérage du système, téléphone en poche, appli ouverte ou fermée), avec le jeton
// du téléphone (Authorization: Bearer, enregistré par POST /api/btp/pointage { action: 'appareil' }).
// Corps lu : { identifier (= chantier), transition: 'enter' | 'exit', time (instant de détection) } ; le centre et le
// rayon de la zone, aussi envoyés, sont ignorés ; jamais la position du téléphone.
//
// Règles du pointage automatique : chantier en cours affecté à l'employé, mode automatique activé par le gérant, un
// pointage ouvert par employé, le téléphone ne termine jamais un pointage commencé à la main ou sur un autre chantier.
// Propres au téléphone en poche :
// - heure de détection retenue (la file du téléphone peut la livrer tard), bornée à 12 h ; arrivée reçue plus de
//   15 min après sa détection notée pour le gérant ; arrivée détectée un autre jour ignorée ; entrée puis sortie en
//   moins de 3 min refermée sans heures ;
// - envois traités un à un par téléphone et dans l'ordre de leurs heures de détection : le module Android les livre
//   dans le désordre et parfois deux fois. Un envoi plus ancien que le dernier traité ne s'applique pas, sauf une
//   arrivée dont la sortie est arrivée avant elle (le passage est alors enregistré en entier) ; une sortie datée
//   d'avant l'arrivée du pointage ouvert ne le termine pas ;
// - arrivée sur un chantier voisin pendant un pointage automatique (zones qui se chevauchent) : mise en attente, et
//   ouverte à la sortie du premier chantier ;
// - pointage terminé à la main (ou par la page ouverte) sur un chantier : les arrivées du téléphone sur ce chantier
//   sont ignorées ce jour-là jusqu'à ce qu'il en voie la sortie (le système renvoie une arrivée quand il repose ses
//   zones, téléphone sur place).
//
// Réponses : 200 pour tout événement lu, appliqué ou ignoré (`statut`). Le module retire de sa file tout envoi qui
// reçoit un 2xx, et Android réessaie le reste sans fin : un jeton inconnu ou retiré reçoit donc aussi 200 (« ignore »),
// ce qui vide la file d'un téléphone retiré. 429 (trop d'envois, ou un autre envoi du téléphone en cours) et 500
// (panne) seulement, pour réessayer plus tard ; 413 pour un corps démesuré (jamais envoyé par le module).
// ═══════════════════════════════════════════════════════════════════════════════

/** Taille maximale d'un envoi : le module en envoie quelques centaines d'octets. */
const TAILLE_MAX_CORPS = 4096
/** Main prise sur un téléphone le temps de traiter un envoi ; rendue d'office passé ce délai (traitement interrompu). */
const BAIL_MS = 15_000
/** Un autre envoi du même téléphone est en cours de traitement : 429, le téléphone réessaiera. */
const OCCUPE = 'occupe'

const repondre = (statut: string) => NextResponse.json({ statut })

interface Attente {
  chantier: string
  le: number
}

/** Ce que le serveur retient des envois d'un téléphone d'un envoi à l'autre (colonnes de pointage_appareils_btp). */
interface EtatTelephone {
  /** Heure de détection du dernier envoi traité. */
  dernier: number | null
  /** Arrivée sur un chantier voisin, en attente de la sortie du pointage automatique en cours. */
  entree: Attente | null
  /** Sortie reçue sans pointage ouvert sur ce chantier : son arrivée peut arriver après elle. */
  sortie: Attente | null
  /** Pointage terminé sans sortie vue sur ce chantier : arrivées ignorées ce jour-là jusqu'à une sortie. */
  bloque: Attente | null
}

/** Ce dont le traitement d'un envoi a besoin : téléphone, société, employé. */
interface Contexte {
  appareil: Ligne
  etat: EtatTelephone
  donnees: DonneesSociete
  membre: MembreBtp
  societeId: string
  fuseau: string
  maintenant: number
}

const instantDe = (valeur: unknown): number | null => {
  if (typeof valeur !== 'string') return null
  const instant = Date.parse(valeur)
  return Number.isFinite(instant) ? instant : null
}

const attenteDe = (chantier: unknown, le: unknown): Attente | null => {
  const instant = instantDe(le)
  return typeof chantier === 'string' && instant !== null ? { chantier, le: instant } : null
}

const iso = (instant: number | null | undefined): string | null => (instant == null ? null : new Date(instant).toISOString())

function lireEtat(ligne: Ligne): EtatTelephone {
  return {
    dernier: instantDe(ligne.dernier_evenement_le),
    entree: attenteDe(ligne.entree_attente_chantier, ligne.entree_attente_le),
    sortie: attenteDe(ligne.sortie_attente_chantier, ligne.sortie_attente_le),
    bloque: attenteDe(ligne.bloque_chantier, ligne.bloque_le),
  }
}

function colonnesEtat(etat: EtatTelephone): Ligne {
  return {
    dernier_evenement_le: iso(etat.dernier),
    entree_attente_chantier: etat.entree?.chantier ?? null,
    entree_attente_le: iso(etat.entree?.le),
    sortie_attente_chantier: etat.sortie?.chantier ?? null,
    sortie_attente_le: iso(etat.sortie?.le),
    bloque_chantier: etat.bloque?.chantier ?? null,
    bloque_le: iso(etat.bloque?.le),
  }
}

/** Téléphone actif (non retiré) dont le jeton a cette empreinte ; table absente (migration 20261117) : aucun. */
async function appareilDuJeton(empreinte: string): Promise<Ligne | null> {
  const { data, error } = await supabaseAdmin
    .from('pointage_appareils_btp')
    .select('*')
    .eq('empreinte', empreinte)
    .is('retire_le', null)
    .limit(1)
  if (error) {
    if (TABLE_ABSENTE.has(String(error.code))) return null
    throw new Error(`lecture du téléphone : ${error.message}`)
  }
  return (data?.[0] as Ligne | undefined) ?? null
}

/** Le compte du téléphone appartient-il encore à la société (le gérant lui-même, ou un sous-compte actif) ? */
async function compteToujoursActif(userId: string, societeId: string): Promise<boolean> {
  if (userId === societeId) return true
  const { data, error } = await supabaseAdmin
    .from('pro_team_members')
    .select('is_active')
    .eq('company_id', societeId)
    .eq('user_id', userId)
    .limit(5)
  if (error) throw new Error(`lecture du compte : ${error.message}`)
  return ((data ?? []) as Ligne[]).some(compte => compte.is_active !== false)
}

/** Retire le téléphone : ses envois suivants seront ignorés. Une erreur n'empêche pas de répondre. */
async function retirerAppareil(id: unknown, maintenant: number): Promise<void> {
  const { error } = await supabaseAdmin.from('pointage_appareils_btp').update({ retire_le: new Date(maintenant).toISOString() }).eq('id', String(id))
  if (error) logger.warn('[btp/pointage/evenement] téléphone non retiré', { error: error.message })
}

/**
 * Prend la main sur le téléphone pour traiter un envoi (un à la fois) : seulement si personne ne la tient, ou si elle
 * a expiré, et si personne ne l'a prise depuis la lecture. Renvoie la ligne relue et le bail ; null si occupé.
 */
async function prendreLaMain(appareil: Ligne, maintenant: number): Promise<{ ligne: Ligne; bail: string } | null> {
  const tenue = instantDe(appareil.traite_jusqu_au)
  if (tenue !== null && tenue > maintenant) return null
  const bail = new Date(maintenant + BAIL_MS).toISOString()
  const prise = supabaseAdmin
    .from('pointage_appareils_btp')
    .update({ traite_jusqu_au: bail })
    .eq('id', String(appareil.id))
    .is('retire_le', null)
  const conditionnelle = appareil.traite_jusqu_au == null
    ? prise.is('traite_jusqu_au', null)
    : prise.eq('traite_jusqu_au', String(appareil.traite_jusqu_au))
  const { data, error } = await conditionnelle.select('*')
  if (error) throw new Error(`prise du téléphone : ${error.message}`)
  const ligne = (data as Ligne[] | null)?.[0]
  return ligne ? { ligne, bail } : null
}

/** Rend la main en écrivant l'état ; sans effet si le bail a expiré et qu'un autre envoi l'a reprise. */
async function rendreLaMain(id: unknown, bail: string, changements: Ligne): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pointage_appareils_btp')
    .update({ ...changements, traite_jusqu_au: null })
    .eq('id', String(id))
    .eq('traite_jusqu_au', bail)
  if (error) logger.warn('[btp/pointage/evenement] téléphone non rendu (il le sera à l’échéance)', { error: error.message })
}

const memeJour = (a: number, b: number, fuseau: string) => heureLocale(a, fuseau).date === heureLocale(b, fuseau).date

/** Société et fiche du téléphone ; sinon la raison d'ignorer l'envoi (fiche changée d'adresse : téléphone retiré). */
async function contexteDuTelephone(appareil: Ligne, etat: EtatTelephone, maintenant: number): Promise<Contexte | string> {
  const societeId = String(appareil.owner_id)
  const donnees = await lireDonneesSociete(societeId)
  if (!donnees.pointageAutoActive) return 'pointage_auto_desactive'
  const membre = donnees.membres.find(m => m.id === appareil.membre_id && m.actif !== false)
  if (!membre) return 'fiche_absente'
  // Le compte est relié à sa fiche par l'adresse e-mail : une fiche passée à une autre adresse n'est plus la sienne.
  if (normaliserEmail(membre.email) !== appareil.email_fiche) {
    await retirerAppareil(appareil.id, maintenant)
    return 'fiche_changee'
  }
  return { appareil, etat, donnees, membre, societeId, fuseau: fuseauValide(appareil.fuseau), maintenant }
}

/** Chantier en cours affecté à l'employé et localisé ; sinon la raison de l'ignorer. */
function chantierPointable(ctx: Contexte, chantierId: string): ChantierBtp | string {
  const chantier = chantiersAffectes(ctx.membre, ctx.donnees.chantiersEnCours, ctx.donnees.equipes).find(c => c.id === chantierId)
  if (!chantier) return 'chantier_non_affecte'
  if (chantierPourTelephone(chantier).latitude === null) return 'chantier_sans_position'
  return chantier
}

const bloqueIci = (ctx: Contexte, chantierId: string, instant: number) =>
  ctx.etat.bloque?.chantier === chantierId && memeJour(ctx.etat.bloque.le, instant, ctx.fuseau)

/** Ouvre un pointage automatique ; faux si un autre envoi l'avait déjà ouvert. */
async function ouvrir(ctx: Contexte, chantier: ChantierBtp, instant: number): Promise<{ ligne: Ligne; ouvert: boolean }> {
  const { ligne, deja } = await ouvrirPointage({
    societeId: ctx.societeId, membre: ctx.membre, chantier, instant, fuseau: ctx.fuseau, mode: 'geo_auto',
    notes: noteArriveeTardive(instant, ctx.maintenant),
  })
  return { ligne, ouvert: !deja }
}

/** Referme un pointage automatique à la sortie vue ; sans heures (avec une note) pour un passage de moins de 3 min. */
async function fermer(ctx: Contexte, ouvert: Ligne, sortie: number): Promise<'depart' | 'passage_bref'> {
  const arrivee = reperesArrivee(ouvert).instant
  const depart = instantDepart('geo_auto', sortie, ctx.maintenant, arrivee)
  const bref = depart - arrivee < PASSAGE_BREF_MS
  await clore(ctx.societeId, ouvert, bref ? changementsSansHeures(ouvert, NOTE_PASSAGE_BREF) : changementsCloture(ouvert, depart))
  return bref ? 'passage_bref' : 'depart'
}

/** Arrivée détectée : ouvre un pointage automatique, si rien ne s'y oppose. */
async function entrer(ctx: Contexte, chantierId: string, instant: number): Promise<string> {
  // La file du téléphone peut livrer le lendemain une entrée de la veille : elle ne pointe plus.
  if (!memeJour(instant, ctx.maintenant, ctx.fuseau)) return 'jour_passe'
  const chantier = chantierPointable(ctx, chantierId)
  if (typeof chantier === 'string') return chantier
  if (bloqueIci(ctx, chantierId, instant)) return 'bloque'
  const duJour = await regulariserOublis(ctx.societeId, await pointagesOuverts(ctx.societeId, ctx.membre.id), ctx.maintenant)
  if (duJour.some(o => o.chantier_id === chantierId)) return 'deja'
  if (duJour.length > 0) {
    // Le téléphone ne termine jamais un autre pointage. Pointage automatique sur un chantier voisin (zones qui se
    // chevauchent) : cette arrivée attend sa sortie ; un pointage commencé à la main reste à l'employé.
    if (!duJour.every(o => o.mode === 'geo_auto')) return 'pointage_different'
    ctx.etat.entree = { chantier: chantierId, le: instant }
    return 'en_attente'
  }
  ctx.etat.entree = null
  return (await ouvrir(ctx, chantier, instant)).ouvert ? 'arrivee' : 'deja'
}

/** Après la sortie d'un chantier : ouvre l'arrivée en attente sur un chantier voisin, à l'heure de cette sortie au plus tôt. */
async function ouvrirEntreeEnAttente(ctx: Contexte, chantierQuitte: string, sortie: number): Promise<void> {
  const enAttente = ctx.etat.entree
  ctx.etat.entree = null
  if (!enAttente || enAttente.chantier === chantierQuitte || !memeJour(enAttente.le, ctx.maintenant, ctx.fuseau)) return
  const chantier = chantierPointable(ctx, enAttente.chantier)
  if (typeof chantier === 'string' || bloqueIci(ctx, enAttente.chantier, sortie)) return
  if ((await pointagesOuverts(ctx.societeId, ctx.membre.id)).length > 0) return
  // Jamais avant la sortie du chantier précédent : aucune heure comptée deux fois.
  await ouvrir(ctx, chantier, Math.max(enAttente.le, sortie))
}

/** Départ détecté : referme le pointage automatique ouvert sur ce chantier, daté de la sortie vue par le téléphone. */
async function sortir(ctx: Contexte, chantierId: string, instant: number): Promise<string> {
  // Sortie vue : l'arrivée automatique reprend sur ce chantier.
  if (ctx.etat.bloque?.chantier === chantierId) ctx.etat.bloque = null
  // Le plus ancien pointage ouvert sur ce chantier, même d'un jour précédent : la sortie vue en donne la vraie fin.
  const ouvert = (await pointagesOuverts(ctx.societeId, ctx.membre.id)).find(o => o.chantier_id === chantierId)
  if (!ouvert) {
    // Arrivée encore en attente sur ce chantier : parti avant qu'elle ne compte. Sinon, son arrivée peut encore venir
    // (envois livrés dans le désordre) : la sortie est gardée pour elle.
    if (ctx.etat.entree?.chantier === chantierId) ctx.etat.entree = null
    else ctx.etat.sortie = { chantier: chantierId, le: instant }
    return 'aucun_pointage_en_cours'
  }
  if (ouvert.mode !== 'geo_auto') return 'pointage_different'
  // Sortie d'un passage précédent livrée tard : elle ne termine pas le pointage ouvert depuis.
  if (instant < reperesArrivee(ouvert).instant) return 'sortie_anterieure'
  const statut = await fermer(ctx, ouvert, instant)
  await ouvrirEntreeEnAttente(ctx, chantierId, instant)
  return statut
}

/** Arrivée plus ancienne que le dernier envoi traité : enregistrée en entier si sa sortie est arrivée avant elle. */
async function apparierEntreeTardive(ctx: Contexte, chantierId: string, instant: number): Promise<string> {
  const sortie = ctx.etat.sortie
  if (!sortie || sortie.chantier !== chantierId || instant >= sortie.le || !memeJour(instant, sortie.le, ctx.fuseau)) return 'perime'
  const chantier = chantierPointable(ctx, chantierId)
  if (typeof chantier === 'string') return chantier
  const duJour = await regulariserOublis(ctx.societeId, await pointagesOuverts(ctx.societeId, ctx.membre.id), ctx.maintenant)
  if (duJour.length > 0) return 'perime'
  const { ligne, ouvert } = await ouvrir(ctx, chantier, instant)
  if (!ouvert) return 'perime'
  ctx.etat.sortie = null
  return (await fermer(ctx, ligne, sortie.le)) === 'passage_bref' ? 'passage_bref' : 'arrivee_et_depart'
}

/** Traite un envoi, téléphone tenu : met à jour `etat` et renvoie le statut. */
async function traiter(appareil: Ligne, etat: EtatTelephone, evenement: EvenementZone, instant: number, maintenant: number): Promise<string> {
  const ancien = etat.dernier !== null && instant <= etat.dernier
  // Envoi plus ancien que le dernier traité (doublon d'un envoi appliqué, ou livré dans le désordre) : une sortie ne
  // s'applique plus ; une arrivée peut encore compléter la sortie reçue avant elle.
  if (ancien && evenement.transition === 'exit') return 'perime'
  const ctx = await contexteDuTelephone(appareil, etat, maintenant)
  if (typeof ctx === 'string') return ctx
  if (ancien) return apparierEntreeTardive(ctx, evenement.identifier, instant)
  etat.dernier = instant
  return evenement.transition === 'enter' ? entrer(ctx, evenement.identifier, instant) : sortir(ctx, evenement.identifier, instant)
}

/** Applique un envoi reçu ; renvoie son statut (appliqué, raison de l'ignorer, ou OCCUPE). */
async function appliquerEvenement(empreinte: string, evenement: EvenementZone, maintenant: number): Promise<string> {
  const appareil = await appareilDuJeton(empreinte)
  if (!appareil) return 'appareil_inconnu'
  if (!(await compteToujoursActif(String(appareil.user_id), String(appareil.owner_id)))) {
    // Compte retiré de la société : ce téléphone ne pointe plus pour personne.
    await retirerAppareil(appareil.id, maintenant)
    return 'compte_inactif'
  }
  const instant = instantEvenement(evenement.time, maintenant)
  if (instant === null) return 'horodatage_refuse'
  const main = await prendreLaMain(appareil, maintenant)
  if (!main) return OCCUPE
  const etat = lireEtat(main.ligne)
  let statut: string
  try {
    statut = await traiter(main.ligne, etat, evenement, instant, maintenant)
  } catch (err) {
    // Rendu sans toucher à l'état : l'envoi sera refait (500).
    await rendreLaMain(appareil.id, main.bail, {})
    throw err
  }
  await rendreLaMain(appareil.id, main.bail, { ...colonnesEtat(etat), vu_le: new Date(maintenant).toISOString() })
  return statut
}

export async function POST(request: NextRequest) {
  // Limite par adresse avant toute lecture en base (jetons inventés), puis par téléphone.
  if (!(await checkRateLimit(`btp_pointage_evenement_ip_${getClientIP(request)}`, 120, 60_000))) return rateLimitResponse()
  const jeton = jetonDeLEnTete(request.headers.get('authorization'))
  if (!jeton) return repondre('jeton_absent')
  const empreinte = await empreinteJeton(jeton)
  if (!(await checkRateLimit(`btp_pointage_evenement_${empreinte.slice(0, 32)}`, 30, 60_000))) return rateLimitResponse()

  if (Number(request.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) {
    return NextResponse.json({ error: 'Corps trop volumineux' }, { status: 413 })
  }
  let brut: unknown
  try {
    const texte = await request.text()
    if (texte.length > TAILLE_MAX_CORPS) return NextResponse.json({ error: 'Corps trop volumineux' }, { status: 413 })
    brut = JSON.parse(texte)
  } catch {
    return repondre('corps_invalide')
  }
  const lu = evenementSchema.safeParse(brut)
  if (!lu.success) return repondre('corps_invalide')

  try {
    const statut = await appliquerEvenement(empreinte, lu.data, Date.now())
    if (statut === OCCUPE) return NextResponse.json({ statut }, { status: 429, headers: { 'Retry-After': '5' } })
    return repondre(statut)
  } catch (err) {
    logger.error('[btp/pointage/evenement] POST', { error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
