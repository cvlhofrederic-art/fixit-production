// ── AJ Signalement, côté serveur : écritures d'un gestionnaire connecté sur les copropriétés (PR 2, lot 2) ────────
//
// Importé par POST /api/aj-signalement/coproprietes et PATCH /api/aj-signalement/coproprietes/[id] quand le profil de la
// session est un gestionnaire (controlerAccesQr : rôle app_metadata ET fiche active relue par user_id). Tout ce qui
// fonde un droit vient de la FICHE (cabinet, identifiant de fiche) et de la portée relue à chaque appel
// (porteeDuProfilQr), jamais du corps ni du repère de routage. Règles pures : lib/aj-signalement/ecritures-gestionnaire.ts.
// Règle de sûreté (fusion avant les migrations 20261111 et 20261112) : chaque lecture est STRICTE (structure absente →
// 503 base_absente, journalisé une fois ; autre échec → 500 avant d'écrire), jamais le repli silencieux du super admin.

import { NextResponse } from 'next/server'
import { doublonVuGestionnaireQr, refusAdressesAjouteesQr, saisiesEcritesGestionnaireQr } from '@/lib/aj-signalement/ecritures-gestionnaire'
import { coproprieteVueGestionnaireQr } from '@/lib/aj-signalement/minimisation'
import type { DoublonQr, PorteeQr, ProfilGestionnaireQr } from '@/lib/aj-signalement/types'
import {
  compterSignalementsQr, compteursVidesQr, coproprieteDepuisLigne, journaliserQr, lireContexteGestionStrictQr, lireDomainesCabinetQr,
  lireFichesParEmailsQr, lireLigneCoproprieteQr, porteeDuProfilQr, reponseInvalide, reponseStructureGestionnaireQr,
  type EcritureJournalQr, type LectureCoproprieteCompleteQr,
} from '@/lib/aj-signalement/serveur'

/** Auteur d'une ligne du journal écrite pour un gestionnaire : son compte, sa fiche, le cabinet DE LA FICHE. */
export const journalGestionnaireQr = (profil: ProfilGestionnaireQr): Pick<EcritureJournalQr, 'cabinetId' | 'acteurId' | 'profil' | 'acteurGestionnaireId'> => ({
  cabinetId: profil.cabinetId, acteurId: profil.userId, profil: 'gestionnaire', acteurGestionnaireId: profil.gestionnaireId,
})

export type AdressesEcritesQr = { ok: true; ecrites: string[] } | { ok: false; reponse: NextResponse }

/**
 * Destinataires écrits par un gestionnaire (RG-06 bis, RG-22, Q4) : `existantes` (saisies actuelles ; aucune à la
 * création), `envoyees` (ce qu'il voit, modifié). Fiches de ces adresses relues (masquage des adresses d'autres fiches,
 * refus d'une adresse de fiche ajoutée) ; domaines de SON cabinet relus seulement s'il ajoute une adresse. Liste écrite :
 * saisiesEcritesGestionnaireQr (adresses masquées conservées) ; refus → 400 invalide (message sans adresse).
 */
export async function adressesEcritesGestionnaireQr(
  profil: ProfilGestionnaireQr, existantes: readonly string[], envoyees: readonly string[],
): Promise<AdressesEcritesQr> {
  const ids = { gestionnaire: profil.gestionnaireId }
  const fiches = await lireFichesParEmailsQr([...existantes, ...envoyees], { strict: true })
  if (!fiches.ok) return { ok: false, reponse: reponseStructureGestionnaireQr(fiches.erreur, 'lecture des fiches (destinataires d’un gestionnaire)', ids) }
  const { ecrites, ajoutees } = saisiesEcritesGestionnaireQr(existantes, envoyees, fiches.valeur, profil.gestionnaireId)
  if (ajoutees.length === 0) return { ok: true, ecrites }
  const domaines = await lireDomainesCabinetQr(profil.cabinetId, { strict: true })
  if (!domaines.ok) return { ok: false, reponse: reponseStructureGestionnaireQr(domaines.erreur, 'lecture des domaines (gestionnaire)', ids) }
  const refus = refusAdressesAjouteesQr(ajoutees, domaines.valeur, fiches.valeur)
  return refus ? { ok: false, reponse: reponseInvalide(refus) } : { ok: true, ecrites }
}

/** D'où vient un doublon refusé à un gestionnaire (journal). */
export type ContexteDoublonQr = { operation: 'creation' } | { operation: 'modification'; coproprieteId: string }

/**
 * 409 doublon d'un gestionnaire (SPEC § 1.6, § 2.5) : jamais forçable ; la copropriété en doublon n'est nommée que si elle
 * est dans sa portée. Un doublon CERTAIN est journalisé (doublon.refuse : copropriété existante, critère, portée) ; un
 * doublon probable est une question (confirmation), non journalisée.
 */
export async function refusDoublonGestionnaireQr(
  doublon: DoublonQr, profil: ProfilGestionnaireQr, portee: PorteeQr, contexte: ContexteDoublonQr,
): Promise<NextResponse> {
  if (doublon.certitude === 'certain') {
    await journaliserQr({
      ...journalGestionnaireQr(profil),
      action: 'doublon.refuse',
      coproprieteId: doublon.copropriete.id,
      details: {
        critere: doublon.critere, dansPortee: portee.visibles.has(doublon.copropriete.id), contexte: contexte.operation,
        ...(contexte.operation === 'modification' ? { coproprieteModifiee: contexte.coproprieteId } : {}),
      },
    })
  }
  return NextResponse.json({ error: 'doublon', doublon: doublonVuGestionnaireQr(doublon, portee.visibles) }, { status: 409 })
}

/**
 * Doublon probable confirmé par un gestionnaire (« Oui, créer » : ce n'est pas un doublon) : journalisé
 * { critere, doublonProbableConfirme } (SPEC § 1.6), sur la copropriété créée ou modifiée.
 */
export async function journaliserProbableConfirmeQr(profil: ProfilGestionnaireQr, coproprieteId: string, doublons: readonly DoublonQr[]): Promise<void> {
  const probable = doublons.find((d) => d.certitude === 'probable')
  if (!probable) return
  await journaliserQr({
    ...journalGestionnaireQr(profil), action: 'doublon.force', coproprieteId, details: { critere: probable.critere, doublonProbableConfirme: true },
  })
}

/**
 * Une copropriété sous la forme qu'un GESTIONNAIRE reçoit (réponse de sa création ou de sa modification) : relue, dans
 * SON cabinet et dans sa portée (relue ici, ou celle que l'appelant vient de lire), puis minimisée comme le tableau
 * (coproprieteVueGestionnaireQr : ni collègue, adresses d'autres fiches masquées, jeton vide si désactivée).
 * null : inconnue, d'un autre cabinet ou hors de sa portée.
 */
export async function lireCoproprieteGestionnaireQr(
  id: string, profil: ProfilGestionnaireQr, options: { nouvelle?: boolean; portee?: PorteeQr } = {},
): Promise<LectureCoproprieteCompleteQr> {
  const lecture = await lireLigneCoproprieteQr(id)
  if (!lecture.ok) return { ok: false, erreur: lecture.erreur }
  const ligne = lecture.ligne
  if (!ligne || ligne.cabinet_id !== profil.cabinetId) return { ok: true, copropriete: null }
  let portee = options.portee
  if (!portee) {
    const lue = await porteeDuProfilQr(profil)
    if (!lue.ok) return { ok: false, erreur: lue.erreur }
    portee = lue.valeur
  }
  if (!portee.visibles.has(id)) return { ok: true, copropriete: null }
  const [compteurs, lu] = await Promise.all([
    options.nouvelle ? Promise.resolve(compteursVidesQr()) : compterSignalementsQr(id),
    // Strict (relecture 3 du lot 6) : sans les fiches des saisies, rien ne serait masqué.
    lireContexteGestionStrictQr([ligne]),
  ])
  if (!lu.ok) return { ok: false, erreur: lu.erreur }
  const contexte = lu.valeur
  return {
    ok: true,
    copropriete: coproprieteVueGestionnaireQr(coproprieteDepuisLigne(ligne, compteurs, null, contexte), {
      userId: profil.userId, gestionnaireId: profil.gestionnaireId, nom: profil.nom, portee, fichesSaisies: contexte.emailsFiches,
    }),
  }
}
