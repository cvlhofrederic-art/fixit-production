import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  NOTE_A_REGULARISER,
  ajouterNote,
  chantierPourTelephone,
  chantiersAffectes,
  cloture,
  fuseauValide,
  heureLocale,
  normaliserEmail,
  reperesArrivee,
  type ChantierBtp,
  type MembreBtp,
} from '@/lib/btp/pointage-regles'
import {
  TABLE_ABSENTE,
  lireDonneesSociete,
  pointagesOuverts,
  regulariserOublis,
  type DonneesSociete,
  type Ligne,
} from '@/lib/btp/pointage-serveur'
import {
  empreinteJeton,
  evenementSchema,
  instantEvenement,
  jetonDeLEnTete,
  noteArriveeTardive,
  type EvenementZone,
} from '@/lib/btp/pointage-arriere-plan'
import {
  CHAMPS_ECRITS,
  instantMural,
  memeContenu,
  rejouerJournee,
  type EnvoiJournal,
  type PlageAutre,
  type Presence,
} from '@/lib/btp/pointage-rejeu'

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/btp/pointage/evenement — arrivées et départs envoyés par le code natif de l'appli Vitfix Pro
// (@capgo/background-geolocation : géorepérage du système, téléphone en poche, appli ouverte ou fermée), avec le jeton
// du téléphone (Authorization: Bearer, enregistré par POST /api/btp/pointage { action: 'appareil' }).
// Corps lu : { identifier (= chantier), transition: 'enter' | 'exit', time (instant de détection) } ; le centre et le
// rayon de la zone, aussi envoyés, sont ignorés ; jamais la position du téléphone.
//
// Le module Android livre ses envois dans le désordre et parfois deux fois. Chaque envoi est donc gardé au journal
// (pointage_evenements_btp, un par téléphone, chantier, sens et heure de détection : un doublon n'y entre pas), puis
// la journée est rejouée dans l'ordre des heures de détection (lib/btp/pointage-rejeu.ts) et les pointages du
// téléphone pour ce jour sont réécrits en conséquence : le résultat ne dépend pas de l'ordre de réception.
// - Une arrivée n'entre au journal que sur un chantier en cours affecté à l'employé et localisé, à sa réception ; une
//   sortie y entre toujours (elle ne compte que si l'arrivée y est). Mode automatique coupé par le gérant : rien.
// - Le téléphone ne réécrit que ses propres pointages (pointage_lignes_appareil_btp garde ce qu'il y a écrit) et
//   seulement s'ils n'ont pas été modifiés depuis : un pointage modifié par l'employé ou le gérant, ou commencé à la
//   main, prime sur ses envois.
// - Heure de détection retenue (bornée à 12 h, heure future ramenée à la réception) ; arrivée reçue plus de 15 min
//   après sa détection notée pour le gérant ; journée finie sans sortie vue : refermée sans heures, à régulariser.
// - Envois d'un même téléphone traités un à la fois (main prise sur sa ligne) ; le jeton d'une fiche changée
//   d'adresse e-mail, ou d'un compte retiré de la société, est retiré.
//
// Réponses : 200 pour tout envoi lu, gardé ou ignoré (`statut`) : le module retire de sa file tout envoi qui reçoit
// un 2xx, et Android réessaie le reste sans fin (un jeton inconnu ou retiré reçoit donc aussi 200). 429 (trop d'envois,
// ou un autre envoi du téléphone en cours) et 500 (panne, lecture impossible) seulement, pour réessayer plus tard ;
// 413 pour un corps démesuré (jamais envoyé par le module).
// ═══════════════════════════════════════════════════════════════════════════════

/** Taille maximale d'un envoi : le module en envoie quelques centaines d'octets. */
const TAILLE_MAX_CORPS = 4096
/** Main prise sur un téléphone le temps de traiter un envoi ; rendue d'office passé ce délai (traitement interrompu). */
const BAIL_MS = 15_000
/** Fenêtre de lecture du journal autour de l'envoi : la journée locale entière, quel que soit le fuseau. */
const FENETRE_JOURNAL_MS = 36 * 3_600_000
/** Un autre envoi du même téléphone est en cours de traitement : 429, le téléphone réessaiera. */
const OCCUPE = 'occupe'

const TABLE_JOURNAL = 'pointage_evenements_btp'
const TABLE_LIENS = 'pointage_lignes_appareil_btp'

const repondre = (statut: string) => NextResponse.json({ statut })
const iso = (instant: number) => new Date(instant).toISOString()
const instantDe = (valeur: unknown): number => (typeof valeur === 'string' ? Date.parse(valeur) : Number.NaN)

/** Ce dont le traitement d'un envoi a besoin : téléphone, société, employé. */
interface Contexte {
  appareil: Ligne
  donnees: DonneesSociete
  membre: MembreBtp
  societeId: string
  fuseau: string
  maintenant: number
}

/** Pointage du jour écrit par ce téléphone et que personne n'a modifié depuis, avec ce qui y a été écrit. */
interface LignePossedee {
  ligne: Ligne
  ecrit: Ligne
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
  const { error } = await supabaseAdmin.from('pointage_appareils_btp').update({ retire_le: iso(maintenant) }).eq('id', String(id))
  if (error) logger.warn('[btp/pointage/evenement] téléphone non retiré', { error: error.message })
}

/**
 * Prend la main sur le téléphone pour traiter un envoi (un à la fois) : seulement si personne ne la tient, ou si elle
 * a expiré, et si personne ne l'a prise depuis la lecture. Renvoie le bail ; null si occupé.
 */
async function prendreLaMain(appareil: Ligne, maintenant: number): Promise<string | null> {
  const tenue = instantDe(appareil.traite_jusqu_au)
  if (Number.isFinite(tenue) && tenue > maintenant) return null
  const bail = iso(maintenant + BAIL_MS)
  const prise = supabaseAdmin
    .from('pointage_appareils_btp')
    .update({ traite_jusqu_au: bail })
    .eq('id', String(appareil.id))
    .is('retire_le', null)
  const conditionnelle = appareil.traite_jusqu_au == null
    ? prise.is('traite_jusqu_au', null)
    : prise.eq('traite_jusqu_au', String(appareil.traite_jusqu_au))
  const { data, error } = await conditionnelle.select('id')
  if (error) throw new Error(`prise du téléphone : ${error.message}`)
  return (data ?? []).length > 0 ? bail : null
}

/** Rend la main (et note le dernier envoi reçu) ; sans effet si le bail a expiré et qu'un autre envoi l'a reprise. */
async function rendreLaMain(id: unknown, bail: string, maintenant: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('pointage_appareils_btp')
    .update({ traite_jusqu_au: null, vu_le: iso(maintenant) })
    .eq('id', String(id))
    .eq('traite_jusqu_au', bail)
  if (error) logger.warn('[btp/pointage/evenement] téléphone non rendu (il le sera à l’échéance)', { error: error.message })
}

/** Société et fiche du téléphone ; sinon la raison d'ignorer l'envoi (fiche changée d'adresse : téléphone retiré). */
async function contexteDuTelephone(appareil: Ligne, maintenant: number): Promise<Contexte | string> {
  const societeId = String(appareil.owner_id)
  const donnees = await lireDonneesSociete(societeId)
  // Réglage illisible (panne passagère) : rien n'est décidé, le téléphone réessaiera (500).
  if (!donnees.reglageLu) throw new Error('réglage du pointage automatique illisible')
  if (!donnees.pointageAutoActive) return 'pointage_auto_desactive'
  const membre = donnees.membres.find(m => m.id === appareil.membre_id && m.actif !== false)
  if (!membre) return 'fiche_absente'
  // Le compte est relié à sa fiche par l'adresse e-mail : une fiche passée à une autre adresse n'est plus la sienne.
  if (normaliserEmail(membre.email) !== appareil.email_fiche) {
    await retirerAppareil(appareil.id, maintenant)
    return 'fiche_changee'
  }
  return { appareil, donnees, membre, societeId, fuseau: fuseauValide(appareil.fuseau), maintenant }
}

/** Chantier en cours affecté à l'employé et localisé ; sinon la raison d'ignorer l'arrivée. */
function chantierPointable(ctx: Contexte, chantierId: string): ChantierBtp | string {
  const chantier = chantiersAffectes(ctx.membre, ctx.donnees.chantiersEnCours, ctx.donnees.equipes).find(c => c.id === chantierId)
  if (!chantier) return 'chantier_non_affecte'
  if (chantierPourTelephone(chantier).latitude === null) return 'chantier_sans_position'
  return chantier
}

/** Garde l'envoi au journal ; faux s'il y était déjà (même téléphone, chantier, sens et heure de détection). */
async function journaliser(ctx: Contexte, evenement: EvenementZone, nom: string | null, instant: number): Promise<boolean> {
  const { error } = await supabaseAdmin.from(TABLE_JOURNAL).insert({
    appareil_id: String(ctx.appareil.id),
    chantier_id: evenement.identifier,
    chantier_nom: nom,
    sens: evenement.transition,
    detecte_le: iso(instant),
    recu_le: iso(ctx.maintenant),
  })
  if (!error) return true
  if (String(error.code) === '23505') return false
  throw new Error(`journal du téléphone : ${error.message}`)
}

/** Envois du téléphone détectés ce jour-là (heure murale de son fuseau). */
async function envoisDuJour(ctx: Contexte, jour: string, autour: number): Promise<EnvoiJournal[]> {
  const { data, error } = await supabaseAdmin
    .from(TABLE_JOURNAL)
    .select('*')
    .eq('appareil_id', String(ctx.appareil.id))
    .gte('detecte_le', iso(autour - FENETRE_JOURNAL_MS))
    .lte('detecte_le', iso(autour + FENETRE_JOURNAL_MS))
    .limit(1000)
  if (error) throw new Error(`lecture du journal du téléphone : ${error.message}`)
  return ((data ?? []) as Ligne[])
    .map(e => ({
      chantier: String(e.chantier_id),
      nom: typeof e.chantier_nom === 'string' ? e.chantier_nom : null,
      sens: e.sens === 'exit' ? 'exit' as const : 'enter' as const,
      detecte: instantDe(e.detecte_le),
      recu: instantDe(e.recu_le),
    }))
    .filter(e => Number.isFinite(e.detecte) && heureLocale(e.detecte, ctx.fuseau).date === jour)
}

/** Plage d'un pointage qui ne vient pas du téléphone (ou modifié depuis) : il prime sur les envois. */
function plageDe(ligne: Ligne): PlageAutre {
  const { instant, fuseau } = reperesArrivee(ligne)
  if (!ligne.heure_depart) return { chantier: String(ligne.chantier_id ?? ''), debut: instant, fin: null }
  const fin = instantMural(String(ligne.date), String(ligne.heure_depart), fuseau)
  return { chantier: String(ligne.chantier_id ?? ''), debut: instant, fin: Number.isFinite(fin) ? Math.max(fin, instant) : instant }
}

async function oublierLien(pointageId: unknown): Promise<void> {
  const { error } = await supabaseAdmin.from(TABLE_LIENS).delete().eq('pointage_id', String(pointageId))
  if (error) throw new Error(`lien du téléphone : ${error.message}`)
}

/**
 * Pointages de l'employé ce jour-là : ceux du téléphone que personne n'a modifiés (dans l'ordre), et les autres (à la
 * main, page ouverte, ou modifiés depuis : le téléphone les laisse et ne compte pas leur durée).
 */
async function lignesDuJour(ctx: Contexte, jour: string): Promise<{ possedees: LignePossedee[]; autres: PlageAutre[] }> {
  const [lignesRes, liensRes] = await Promise.all([
    supabaseAdmin.from('pointages_btp').select('*').eq('owner_id', ctx.societeId).eq('membre_id', ctx.membre.id).eq('date', jour).limit(200),
    supabaseAdmin.from(TABLE_LIENS).select('*').eq('appareil_id', String(ctx.appareil.id)).eq('date', jour).limit(200),
  ])
  const erreur = lignesRes.error || liensRes.error
  if (erreur) throw new Error(`lecture des pointages du jour : ${erreur.message}`)
  const lignes = (lignesRes.data ?? []) as Ligne[]
  const possedees: LignePossedee[] = []
  for (const lien of (liensRes.data ?? []) as Ligne[]) {
    const ligne = lignes.find(l => String(l.id) === String(lien.pointage_id))
    const ecrit = (lien.ecrit ?? {}) as Ligne
    if (ligne && memeContenu(ligne, ecrit)) possedees.push({ ligne, ecrit })
    else await oublierLien(lien.pointage_id)
  }
  const siennes = new Set(possedees.map(p => String(p.ligne.id)))
  possedees.sort((a, b) => reperesArrivee(a.ligne).instant - reperesArrivee(b.ligne).instant)
  return { possedees, autres: lignes.filter(l => !siennes.has(String(l.id))).map(plageDe) }
}

/** Champs du pointage d'une présence ; journée finie sans sortie vue : refermé sans heures, à régulariser. */
function champsPresence(ctx: Contexte, presence: Presence, jourFini: boolean): Ligne {
  const arrivee = heureLocale(presence.debut, ctx.fuseau)
  const note = noteArriveeTardive(presence.arrivee.detecte, presence.arrivee.recu)
  const base: Ligne = {
    chantier_id: presence.chantier,
    chantier_nom: presence.arrivee.nom ?? null,
    date: arrivee.date,
    heure_arrivee: arrivee.heure,
    created_at: iso(presence.debut),
    notes: note,
  }
  if (presence.fin === null) {
    if (!jourFini) return { ...base, heure_depart: null, heures_travaillees: null }
    return { ...base, heure_depart: arrivee.heure, heures_travaillees: 0, notes: ajouterNote(note, NOTE_A_REGULARISER) }
  }
  const { heureDepart, heuresTravaillees, aRegulariser } = cloture({ ...base, pause_minutes: 0 }, presence.fin)
  return {
    ...base,
    heure_depart: heureDepart,
    heures_travaillees: heuresTravaillees,
    notes: aRegulariser ? ajouterNote(note, NOTE_A_REGULARISER) : note,
  }
}

/** Ce que le téléphone a écrit dans un pointage (comparé ensuite pour savoir si quelqu'un l'a modifié). */
const ecritDe = (champs: Ligne): Ligne => Object.fromEntries(CHAMPS_ECRITS.map(c => [c, champs[c] ?? null]))

/** Index « un pointage ouvert par employé » : ouvert entre-temps à la main ; l'envoi suivant refera la journée. */
const conflitDOuverture = (code: unknown) => String(code) === '23505'

async function creerLigne(ctx: Contexte, champs: Ligne): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('pointages_btp')
    .insert({
      owner_id: ctx.societeId,
      membre_id: ctx.membre.id,
      employe: [ctx.membre.prenom, ctx.membre.nom].filter(Boolean).join(' ') || normaliserEmail(ctx.membre.email),
      poste: ctx.membre.type_compte ?? null,
      pause_minutes: 0,
      mode: 'geo_auto',
      ...champs,
    })
    .select()
    .single()
  if (error) {
    if (conflitDOuverture(error.code)) return
    throw new Error(`création du pointage : ${error.message}`)
  }
  const lien = await supabaseAdmin.from(TABLE_LIENS).insert({
    pointage_id: String((data as Ligne).id), appareil_id: String(ctx.appareil.id), date: champs.date, ecrit: ecritDe(champs),
  })
  if (lien.error) throw new Error(`lien du téléphone : ${lien.error.message}`)
}

/** Modifie un pointage du téléphone, seulement s'il porte encore ce que le téléphone y a écrit. */
async function mettreAJourLigne(ctx: Contexte, possedee: LignePossedee, champs: Ligne): Promise<void> {
  if (memeContenu(champs, possedee.ecrit)) return
  let requete = supabaseAdmin.from('pointages_btp').update(champs).eq('id', String(possedee.ligne.id)).eq('owner_id', ctx.societeId)
  for (const champ of CHAMPS_ECRITS) {
    const valeur = possedee.ecrit[champ]
    requete = valeur === null || valeur === undefined ? requete.is(champ, null) : requete.eq(champ, valeur)
  }
  const { data, error } = await requete.select('id')
  if (error) {
    if (conflitDOuverture(error.code)) return
    throw new Error(`mise à jour du pointage : ${error.message}`)
  }
  // Modifié entre-temps par quelqu'un : il n'est plus au téléphone.
  if ((data ?? []).length === 0) return oublierLien(possedee.ligne.id)
  const lien = await supabaseAdmin.from(TABLE_LIENS).update({ date: champs.date, ecrit: ecritDe(champs) }).eq('pointage_id', String(possedee.ligne.id))
  if (lien.error) throw new Error(`lien du téléphone : ${lien.error.message}`)
}

/** Retire un pointage du téléphone qui n'a plus lieu d'être, seulement s'il porte encore ce qu'il y a écrit. */
async function supprimerLigne(ctx: Contexte, possedee: LignePossedee): Promise<void> {
  let requete = supabaseAdmin.from('pointages_btp').delete().eq('id', String(possedee.ligne.id)).eq('owner_id', ctx.societeId)
  for (const champ of CHAMPS_ECRITS) {
    const valeur = possedee.ecrit[champ]
    requete = valeur === null || valeur === undefined ? requete.is(champ, null) : requete.eq(champ, valeur)
  }
  const { error } = await requete
  if (error) throw new Error(`retrait du pointage : ${error.message}`)
  await oublierLien(possedee.ligne.id)
}

/** Rejoue la journée du téléphone et réécrit ses pointages de ce jour-là. */
async function rejouer(ctx: Contexte, jour: string, autour: number): Promise<void> {
  const envois = await envoisDuJour(ctx, jour, autour)
  const { possedees, autres } = await lignesDuJour(ctx, jour)
  const jourFini = jour < heureLocale(ctx.maintenant, ctx.fuseau).date
  const voulus = rejouerJournee(envois, autres).map(p => champsPresence(ctx, p, jourFini))
  if (voulus.some(v => v.heure_depart === null)) {
    // Un seul pointage ouvert par employé : les départs oubliés des jours précédents sont d'abord refermés.
    await regulariserOublis(ctx.societeId, await pointagesOuverts(ctx.societeId, ctx.membre.id), ctx.maintenant)
  }
  // Pointages en trop d'abord, puis ceux qui se ferment, enfin celui qui reste ouvert (un seul ouvert à la fois).
  for (const possedee of possedees.slice(voulus.length)) await supprimerLigne(ctx, possedee)
  const ecritures = voulus
    .map((champs, i) => ({ champs, possedee: possedees.at(i) }))
    .sort((a, b) => Number(a.champs.heure_depart === null) - Number(b.champs.heure_depart === null))
  for (const { champs, possedee } of ecritures) {
    if (possedee) await mettreAJourLigne(ctx, possedee, champs)
    else await creerLigne(ctx, champs)
  }
}

/** Traite un envoi, téléphone tenu : le garde au journal (s'il compte) et rejoue sa journée. */
async function traiter(appareil: Ligne, evenement: EvenementZone, instant: number, maintenant: number): Promise<string> {
  const ctx = await contexteDuTelephone(appareil, maintenant)
  if (typeof ctx === 'string') return ctx
  let nom: string | null = null
  if (evenement.transition === 'enter') {
    const chantier = chantierPointable(ctx, evenement.identifier)
    if (typeof chantier === 'string') return chantier
    nom = typeof chantier.titre === 'string' ? chantier.titre : null
  }
  const nouveau = await journaliser(ctx, evenement, nom, instant)
  await rejouer(ctx, heureLocale(instant, ctx.fuseau).date, instant)
  return nouveau ? 'enregistre' : 'doublon'
}

/** Applique un envoi reçu ; renvoie son statut (gardé, raison de l'ignorer, ou OCCUPE). */
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
  const bail = await prendreLaMain(appareil, maintenant)
  if (bail === null) return OCCUPE
  try {
    return await traiter(appareil, evenement, instant, maintenant)
  } finally {
    await rendreLaMain(appareil.id, bail, maintenant)
  }
}

/** Corps de la requête, lu morceau par morceau jusqu'à TAILLE_MAX_CORPS ; null au-delà. */
async function lireCorps(request: NextRequest): Promise<string | null> {
  const lecteur = request.body?.getReader()
  if (!lecteur) return ''
  const morceaux: Uint8Array[] = []
  let taille = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    taille += value.byteLength
    if (taille > TAILLE_MAX_CORPS) {
      await lecteur.cancel()
      return null
    }
    morceaux.push(value)
  }
  const tout = new Uint8Array(taille)
  let position = 0
  for (const morceau of morceaux) {
    tout.set(morceau, position)
    position += morceau.byteLength
  }
  return new TextDecoder().decode(tout)
}

export async function POST(request: NextRequest) {
  // Limite par adresse avant toute lecture en base (jetons inventés), puis par téléphone.
  if (!(await checkRateLimit(`btp_pointage_evenement_ip_${getClientIP(request)}`, 120, 60_000))) return rateLimitResponse()
  const jeton = jetonDeLEnTete(request.headers.get('authorization'))
  if (!jeton) return repondre('jeton_absent')
  const empreinte = await empreinteJeton(jeton)
  if (!(await checkRateLimit(`btp_pointage_evenement_${empreinte.slice(0, 32)}`, 30, 60_000))) return rateLimitResponse()

  const trop = () => NextResponse.json({ error: 'Corps trop volumineux' }, { status: 413 })
  if (Number(request.headers.get('content-length') ?? 0) > TAILLE_MAX_CORPS) return trop()
  let brut: unknown
  try {
    const texte = await lireCorps(request)
    if (texte === null) return trop()
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
