// app/api/aj-signalement/coproprietes/route.ts
//
// POST — nouvelle copropriété dotée d'un QR code (espace AJ Signalement, super admin), P1-R3. Toute création passe par
// la fonction SQL unique signalements_qr_creer_coproprietes (lot d'une ligne) : jeton tiré par la base, attributions
// et journal dans la même transaction, operationId contre le double clic (facultatif : l'écran actuel ne l'envoie pas,
// la route en tire un, sans idempotence). Avant l'appel :
//   - gestionnaires ou « attribuée à tous » sans cabinet → 409 sans_cabinet ;
//   - adresse d'une fiche gestionnaire dans les destinataires → 400 (RG-06 bis : attribuez-lui la copropriété) ;
//   - adresse hors des domaines du cabinet (liste renseignée) → 409 hors_domaine, sauf confirmerHorsDomaine (RG-02) ;
//   - doublons avec les copropriétés du même cabinet (ou du groupe « sans cabinet ») → 409 doublon (SPEC § 1.6).
// La fiche renvoyée porte le jeton : l'écran en dessine le QR code. Migration du 11/11/2026 absente (fonction
// PGRST202) : insertion d'origine pour le corps actuel de l'écran { nom, adresse, emailsDestinataires } ; 503
// base_absente si le corps demande un cabinet, des gestionnaires ou des champs nouveaux. p_acteur = la session.
//
// Gestionnaire connecté (PR 2, SPEC § 2.5, RG-20) : corps strict coproprieteGestionnaireQrSchema (ni cabinet, ni
// gestionnaires, ni « à tous », ni forçage : 400) ; limites 5 / 10 min et 20 / 24 h par compte ; création dans le cabinet
// de SA FICHE, attribuée d'office (origine « creation », fonction SQL p_profil 'gestionnaire'), QR code immédiat ;
// destinataires dans les domaines de son cabinet, jamais l'adresse d'une fiche (400) ; doublons comparés à TOUT le
// cabinet, jamais forçables, la copropriété existante nommée seulement si elle est dans sa portée (doublon.refuse
// journalisé), probable à confirmer (confirmation journalisée) ; réponse minimisée. Aucune insertion d'origine : toute
// structure absente répond 503 base_absente.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { coproprieteGestionnaireQrSchema, coproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import { cleNomCoproQr, decisionDoublonsQr, doublonsCoproprieteQr } from '@/lib/aj-signalement/doublons'
import { emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { ProfilGestionnaireQr } from '@/lib/aj-signalement/types'
import {
  adressesEcritesGestionnaireQr, journaliserProbableConfirmeQr, lireCoproprieteGestionnaireQr, refusDoublonGestionnaireQr,
} from '@/lib/aj-signalement/serveur-gestionnaire'
import {
  COLONNES_COPROPRIETE_QR, TABLE_COPROPRIETES_QR, contexteGestionVideQr, controlerAccesQr, coproprieteDepuisLigne, fonctionAbsenteQr,
  genererJetonQr, journaliserRepliGestionQr, lireCabinetQr, lireCoproprieteCompleteQr, lireCoproprietesDoublonsQr, lireDomainesCabinetQr,
  lireFichesDesAdressesQr, porteeDuProfilQr, reponseErreur, reponseErreurBase, reponseErreurSqlQr, reponseInvalide, reponseLectureGestionnaireQr,
  reponsePriveeQr, reponseStructureGestionnaireQr, type LigneCoproprieteQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Adresses canoniques (rognées, minuscules), dédoublonnées, dans l'ordre saisi. */
const canoniques = (emails: readonly string[]): string[] =>
  [...new Set(emails.map(emailCanoniqueQr).filter((e): e is string => e !== null))]

interface ResultatCreationSqlQr { creees?: Array<{ id?: unknown }>; rejeu?: unknown }

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_copropriete_post_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin', 'gestionnaire'] })
    if (!controle.ok) return controle.reponse
    if (controle.profil.type === 'gestionnaire') return await creationParGestionnaire(request, controle.profil)
    if (!(await checkRateLimit(`qr_copropriete_post_${controle.user.id}`, 60, 3_600_000))) return rateLimitResponse()

    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(coproprieteQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const s = validation.data
    const cabinetId = s.cabinetId ?? null
    if (!cabinetId && (s.gestionnaireIds.length > 0 || s.attribueeATous)) return reponseErreur('sans_cabinet', 409)

    let domaines: string[] = []
    if (cabinetId) {
      const cabinet = await lireCabinetQr({ id: cabinetId })
      if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet')
      if (!cabinet.cabinet) return reponseErreur('a_reverifier', 409)
      const lus = await lireDomainesCabinetQr(cabinetId)
      // Lecture en échec (autre que la table absente) : 500 avant d'écrire, jamais un contrôle sauté (relecture 4).
      if (!lus.ok) return reponseErreurSqlQr(lus.erreur, 'lecture des domaines', { cabinet: cabinetId })
      domaines = lus.valeur
    }

    const emails = canoniques(s.emailsDestinataires)
    // RG-06 bis-1 : même boîte, ou même partie locale sur un autre domaine du cabinet de la fiche (corrections, tour 2).
    const fiches = await lireFichesDesAdressesQr(emails)
    if (!fiches.ok) return reponseErreurSqlQr(fiches.erreur, 'lecture des fiches (destinataires)')
    if (adressesDeFichesQr(emails, fiches.valeur.fiches, fiches.valeur.cabinetsDesDomaines).length > 0) {
      return reponseInvalide('emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété')
    }
    if (domaines.length > 0 && !s.confirmerHorsDomaine && emails.some((e) => !emailDansDomainesQr(e, domaines))) {
      return NextResponse.json({ error: 'hors_domaine', champ: 'emailsDestinataires' }, { status: 409 })
    }

    const existantes = await lireCoproprietesDoublonsQr(cabinetId, { ignorerOperation: s.operationId })
    if (!existantes.ok) return reponseErreurSqlQr(existantes.erreur, 'lecture des doublons')
    const decision = decisionDoublonsQr(
      doublonsCoproprieteQr(
        { nom: s.nom, adresse: s.adresse, codePostal: s.codePostal, immatriculation: s.immatriculation || null, referenceCabinet: s.referenceCabinet || null },
        existantes.coproprietes,
      ),
      { profil: 'super_admin', forcerDoublon: s.forcerDoublon, confirmerDoublonProbable: s.confirmerDoublonProbable },
    )
    if (!decision.ok) {
      const { certitude, critere, copropriete } = decision.doublon
      return NextResponse.json({ error: 'doublon', doublon: { certitude, critere, copropriete } }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_creer_coproprietes', {
      p_operation: s.operationId ?? globalThis.crypto.randomUUID(),
      p_acteur: controle.user.id,
      p_profil: 'super_admin',
      p_gestionnaire: null,
      p_cabinet: cabinetId,
      p_lignes: [{
        numeroLigne: 1, action: 'creer', nom: s.nom, cleNom: cleNomCoproQr(s.nom), adresse: s.adresse, codePostal: s.codePostal, ville: s.ville,
        immatriculation: s.immatriculation, referenceCabinet: s.referenceCabinet, batiments: s.batiments, emails,
        gestionnaireIds: s.gestionnaireIds, forcerDoublon: decision.doublonForce,
      }],
    })
    if (error) {
      if (!fonctionAbsenteQr(error)) return reponseErreurSqlQr(error, 'création de copropriété')
      return creationDOrigine(s, emails, controle.user.id, error)
    }

    const resultat = (data ?? {}) as ResultatCreationSqlQr
    const id = typeof resultat.creees?.[0]?.id === 'string' ? (resultat.creees[0].id as string) : null
    if (!id) return reponseErreur('a_reverifier', 409)
    const rejeu = resultat.rejeu === true
    if (s.attribueeATous && !rejeu) {
      const tous = await supabaseAdmin.rpc('signalements_qr_remplacer_attributions', {
        p_copropriete: id, p_gestionnaires: s.gestionnaireIds, p_tous: true, p_acteur: controle.user.id,
      })
      // La copropriété est créée : la fiche renvoyée dira « à tous » non posé, l'écran le montre.
      if (tous.error) logger.error(`${CONTEXTE} « attribuée à tous » non posé après la création`, { code: tous.error.code, copropriete: id })
    }
    const lecture = await lireCoproprieteCompleteQr(id, { nouvelle: !rejeu })
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'relecture de la copropriété créée', { copropriete: id })
    if (!lecture.copropriete) return reponseErreur('a_reverifier', 409)
    return NextResponse.json({ copropriete: lecture.copropriete }, { status: rejeu ? 200 : 201 })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} création de copropriété`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

/**
 * Création par un gestionnaire connecté (RG-20) : tout vient de sa fiche (cabinet, identifiant) et de sa portée, relues
 * par le contrôle d'accès et ici ; aucun repli silencieux (structure absente → 503 base_absente).
 */
async function creationParGestionnaire(request: NextRequest, profil: ProfilGestionnaireQr): Promise<Response> {
  if (!(await checkRateLimit(`qr_copropriete_post_${profil.userId}`, 5, 600_000))) return rateLimitResponse()
  if (!(await checkRateLimit(`qr_copropriete_post_jour_${profil.userId}`, 20, 86_400_000))) return rateLimitResponse()
  const ids = { gestionnaire: profil.gestionnaireId }

  const body: unknown = await request.json().catch(() => null)
  const validation = validateBody(coproprieteGestionnaireQrSchema, body)
  if (!validation.success) return reponseInvalide(validation.error)
  const s = validation.data

  const adresses = await adressesEcritesGestionnaireQr(profil, [], s.emailsDestinataires)
  if (!adresses.ok) return adresses.reponse

  const portee = await porteeDuProfilQr(profil)
  if (!portee.ok) return reponseLectureGestionnaireQr(portee.erreur, 'portée d’un gestionnaire', ids)
  // Tout le cabinet, copropriétés désactivées et hors de sa portée comprises (SPEC § 1.6).
  const existantes = await lireCoproprietesDoublonsQr(profil.cabinetId, { ignorerOperation: s.operationId, strict: true })
  if (!existantes.ok) return reponseStructureGestionnaireQr(existantes.erreur, 'lecture des doublons (gestionnaire)', ids)
  const doublons = doublonsCoproprieteQr(
    { nom: s.nom, adresse: s.adresse, codePostal: s.codePostal, immatriculation: s.immatriculation || null, referenceCabinet: s.referenceCabinet || null },
    existantes.coproprietes,
  )
  const decision = decisionDoublonsQr(doublons, { profil: 'gestionnaire', forcerDoublon: false, confirmerDoublonProbable: s.confirmerDoublonProbable })
  if (!decision.ok) return refusDoublonGestionnaireQr(decision.doublon, profil, portee.valeur, { operation: 'creation' })

  const { data, error } = await supabaseAdmin.rpc('signalements_qr_creer_coproprietes', {
    p_operation: s.operationId,
    p_acteur: profil.userId,
    p_profil: 'gestionnaire',
    p_gestionnaire: profil.gestionnaireId,
    p_cabinet: profil.cabinetId,
    p_lignes: [{
      numeroLigne: 1, action: 'creer', nom: s.nom, cleNom: cleNomCoproQr(s.nom), adresse: s.adresse, codePostal: s.codePostal, ville: s.ville,
      immatriculation: s.immatriculation, referenceCabinet: s.referenceCabinet, batiments: s.batiments, emails: adresses.ecrites,
      gestionnaireIds: [], forcerDoublon: false,
    }],
  })
  if (error) return reponseStructureGestionnaireQr(error, 'création de copropriété (gestionnaire)', ids)

  const resultat = (data ?? {}) as ResultatCreationSqlQr
  const id = typeof resultat.creees?.[0]?.id === 'string' ? (resultat.creees[0].id as string) : null
  if (!id) return reponseErreur('a_reverifier', 409)
  const rejeu = resultat.rejeu === true
  if (decision.probableConfirme && !rejeu) await journaliserProbableConfirmeQr(profil, id, doublons)

  const lecture = await lireCoproprieteGestionnaireQr(id, profil, { nouvelle: !rejeu })
  if (!lecture.ok) return reponseStructureGestionnaireQr(lecture.erreur, 'relecture de la copropriété créée (gestionnaire)', { ...ids, copropriete: id })
  if (!lecture.copropriete) {
    // Attribution « creation » absente (base incohérente) ou retirée avant un rejeu : rien n'est rendu, c'est signalé.
    logger.error(`${CONTEXTE} copropriété créée hors de la portée de son auteur`, { ...ids, copropriete: id })
    return reponseErreur('a_reverifier', 409)
  }
  return reponsePriveeQr({ copropriete: lecture.copropriete }, rejeu ? 200 : 201)
}

/**
 * Migration du 11/11/2026 non appliquée : insertion d'origine (nom, adresse, destinataires), comme avant la PR, pour
 * le seul corps de l'écran actuel ; un corps qui demande davantage répond 503 base_absente (rien n'est perdu en silence).
 */
async function creationDOrigine(
  s: { cabinetId?: string; gestionnaireIds: string[]; attribueeATous: boolean; codePostal: string; ville: string; immatriculation: string; referenceCabinet: string; batiments: string[]; nom: string; adresse: string },
  emails: string[], acteur: string, erreur: { code?: string },
): Promise<NextResponse> {
  const nouveaux = Boolean(s.cabinetId) || s.gestionnaireIds.length > 0 || s.attribueeATous
    || [s.codePostal, s.ville, s.immatriculation, s.referenceCabinet].some(Boolean) || s.batiments.length > 0
  if (nouveaux) {
    journaliserRepliGestionQr('création de copropriété refusée, 503', erreur)
    return reponseErreur('base_absente', 503)
  }
  journaliserRepliGestionQr('création de copropriété', erreur)
  const { data, error } = await supabaseAdmin
    .from(TABLE_COPROPRIETES_QR)
    .insert({ nom: s.nom, adresse: s.adresse, emails_destinataires: emails, jeton: genererJetonQr(), cree_par: acteur })
    .select(COLONNES_COPROPRIETE_QR)
    .single()
  if (error || !data) {
    logger.error(`${CONTEXTE} création de copropriété refusée`, { code: error?.code })
    return reponseErreurBase(error)
  }
  return NextResponse.json({ copropriete: coproprieteDepuisLigne(data as LigneCoproprieteQr, undefined, null, contexteGestionVideQr()) }, { status: 201 })
}
