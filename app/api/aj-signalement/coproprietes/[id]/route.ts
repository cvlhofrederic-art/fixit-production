// app/api/aj-signalement/coproprietes/[id]/route.ts
//
// PATCH — modification d'une copropriété QR (espace AJ Signalement, super admin), P1-R4 : nom, adresse, code postal,
// ville, immatriculation, référence, bâtiments, e-mails destinataires, activation (un QR code désactivé répond 404 à qui
// le scanne, l'historique reste), nouveau jeton (regenererJeton : l'ancien QR code imprimé ne répond plus),
// « attribuée à tous » (par la fonction d'attribution). Corps actuels de l'écran acceptés tels quels. Le cabinet ne se
// change pas ici (rattachement par POST /cabinets/[id]/rattachement, définitif).
//   - doublons revérifiés si nom, code postal, immatriculation ou référence changent (forçage du super admin) ;
//   - une adresse AJOUTÉE aux destinataires est refusée si c'est celle d'une fiche gestionnaire (400), et soumise à
//     confirmerHorsDomaine si elle est hors des domaines du cabinet (409) ; une adresse déjà présente ne bloque rien ;
//   - journal : NOMS des champs modifiés, jamais leurs valeurs ; désactivation, réactivation, jeton remplacé.
// DELETE — suppression (P1-R5) : seulement sans aucun signalement (la CASCADE effacerait des données de déclarants) et
// sur le nom exact ; la copropriété est d'abord désactivée (plus aucun dépôt), le compte refait, le journal écrit,
// puis la ligne supprimée. Sinon 409 signalements_presents (désactiver plutôt).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { modificationCoproprieteQrSchema, suppressionCoproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import { cleNomCoproQr, decisionDoublonsQr, doublonsCoproprieteQr } from '@/lib/aj-signalement/doublons'
import { emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import type { DecisionDoublonsQr } from '@/lib/aj-signalement/types'
import {
  COLONNES_COPROPRIETE_QR, TABLE_ATTRIBUTIONS_QR, TABLE_COPROPRIETES_QR, TABLE_SIGNALEMENTS_QR, colonneInconnue, controlerAccesQr, estUuid,
  genererJetonQr, journaliserQr, journaliserRepliGestionQr, lireCoproprieteCompleteQr, lireCoproprietesDoublonsQr, lireDomainesCabinetQr,
  lireEmailsFichesQr, lireLigneCoproprieteQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, type LigneCoproprieteQr,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'

type Contexte = { params: Promise<{ id: string }> }

const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')
const canoniques = (emails: readonly unknown[]): string[] =>
  [...new Set(emails.map(emailCanoniqueQr).filter((e): e is string => e !== null))]

/** Colonnes d'origine (migration 20261104) : seules modifiables tant que la migration du 11/11/2026 manque. */
const COLONNES_ORIGINE: readonly string[] = ['nom', 'adresse', 'emails_destinataires', 'actif', 'jeton']

type Modification = {
  nom?: string; adresse?: string; codePostal?: string; ville?: string; immatriculation?: string; referenceCabinet?: string
  batiments?: string[]; emailsDestinataires?: string[]; actif?: boolean; regenererJeton?: true; attribueeATous?: boolean
  forcerDoublon?: boolean; confirmerDoublonProbable?: boolean; confirmerHorsDomaine?: boolean
}

/** Valeurs à écrire (colonnes de la base) et NOMS des champs réellement changés (journal). */
function ecritures(m: Modification, avant: LigneCoproprieteQr): { valeurs: Record<string, unknown>; champs: string[] } {
  const valeurs: Record<string, unknown> = {}
  const champs: string[] = []
  const poser = (champ: string, colonne: string, valeur: unknown, ancienne: unknown) => {
    valeurs[colonne] = valeur
    if (JSON.stringify(valeur) !== JSON.stringify(ancienne)) champs.push(champ)
  }
  if (m.nom !== undefined) {
    poser('nom', 'nom', m.nom, chaine(avant.nom))
    valeurs.cle_nom = cleNomCoproQr(m.nom)
  }
  if (m.adresse !== undefined) poser('adresse', 'adresse', m.adresse, chaine(avant.adresse))
  if (m.codePostal !== undefined) poser('codePostal', 'code_postal', m.codePostal, chaine(avant.code_postal))
  if (m.ville !== undefined) poser('ville', 'ville', m.ville, chaine(avant.ville))
  if (m.immatriculation !== undefined) poser('immatriculation', 'immatriculation', m.immatriculation || null, avant.immatriculation ?? null)
  if (m.referenceCabinet !== undefined) poser('referenceCabinet', 'reference_cabinet', m.referenceCabinet || null, avant.reference_cabinet ?? null)
  if (m.batiments !== undefined) poser('batiments', 'batiments', m.batiments, avant.batiments ?? [])
  if (m.emailsDestinataires !== undefined) {
    poser('emailsDestinataires', 'emails_destinataires', canoniques(m.emailsDestinataires), canoniques(avant.emails_destinataires ?? []))
  }
  if (m.actif !== undefined) valeurs.actif = m.actif
  if (m.regenererJeton) valeurs.jeton = genererJetonQr()
  return { valeurs, champs }
}

/** Doublons revérifiés quand un champ comparé change (SPEC § 1.6) ; la copropriété elle-même est ignorée. */
async function controlerDoublons(id: string, m: Modification, avant: LigneCoproprieteQr): Promise<DecisionDoublonsQr | { erreur: NextResponse }> {
  const change = (m.nom !== undefined && m.nom !== chaine(avant.nom))
    || (m.codePostal !== undefined && m.codePostal !== chaine(avant.code_postal))
    || (m.immatriculation !== undefined && (m.immatriculation || null) !== (avant.immatriculation ?? null))
    || (m.referenceCabinet !== undefined && (m.referenceCabinet || null) !== (avant.reference_cabinet ?? null))
  if (!change) return { ok: true, doublonForce: false, probableConfirme: false }
  const existantes = await lireCoproprietesDoublonsQr(avant.cabinet_id ?? null)
  if (!existantes.ok) return { erreur: reponseErreurSqlQr(existantes.erreur, 'lecture des doublons', { copropriete: id }) }
  const fiche = {
    nom: m.nom ?? chaine(avant.nom),
    adresse: m.adresse ?? chaine(avant.adresse),
    codePostal: m.codePostal ?? chaine(avant.code_postal),
    immatriculation: m.immatriculation !== undefined ? m.immatriculation || null : avant.immatriculation ?? null,
    referenceCabinet: m.referenceCabinet !== undefined ? m.referenceCabinet || null : avant.reference_cabinet ?? null,
  }
  return decisionDoublonsQr(doublonsCoproprieteQr(fiche, existantes.coproprietes, { ignorerId: id }), {
    profil: 'super_admin', forcerDoublon: m.forcerDoublon === true, confirmerDoublonProbable: m.confirmerDoublonProbable === true,
  })
}

/** RG-06 bis-1 et RG-02, sur les seules adresses AJOUTÉES (une adresse déjà présente ne bloque pas la modification). */
async function controlerAdressesAjoutees(m: Modification, avant: LigneCoproprieteQr): Promise<NextResponse | null> {
  if (m.emailsDestinataires === undefined) return null
  const anciennes = new Set(canoniques(avant.emails_destinataires ?? []))
  const ajoutees = canoniques(m.emailsDestinataires).filter((e) => !anciennes.has(e))
  if (ajoutees.length === 0) return null
  if (adressesDeFichesQr(ajoutees, await lireEmailsFichesQr()).length > 0) {
    return reponseInvalide('emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété')
  }
  const domaines = avant.cabinet_id ? await lireDomainesCabinetQr(avant.cabinet_id) : []
  if (domaines.length > 0 && m.confirmerHorsDomaine !== true && ajoutees.some((e) => !emailDansDomainesQr(e, domaines))) {
    return NextResponse.json({ error: 'hors_domaine', champ: 'emailsDestinataires' }, { status: 409 })
  }
  return null
}

/** Mise à jour ; colonnes du 11/11/2026 absentes : rejouée avec les colonnes d'origine si elles suffisent, sinon 503. */
async function mettreAJour(id: string, valeurs: Record<string, unknown>): Promise<NextResponse | null> {
  if (Object.keys(valeurs).length === 0) return null
  const ecrire = (v: Record<string, unknown>) =>
    supabaseAdmin.from(TABLE_COPROPRIETES_QR).update(v).eq('id', id).select(COLONNES_COPROPRIETE_QR).maybeSingle()
  let r = await ecrire(valeurs)
  if (colonneInconnue(r.error)) {
    const nouvelles = Object.keys(valeurs).filter((c) => !COLONNES_ORIGINE.includes(c) && c !== 'cle_nom')
    if (nouvelles.length > 0) return reponseErreur('base_absente', 503)
    journaliserRepliGestionQr('modification de copropriété', r.error)
    r = await ecrire(Object.fromEntries(Object.entries(valeurs).filter(([c]) => COLONNES_ORIGINE.includes(c))))
  }
  if (r.error) return reponseErreurSqlQr(r.error, 'modification de copropriété', { copropriete: id })
  if (!r.data) return reponseErreur('introuvable', 404)
  return null
}

/** « Attribuée à tous » : par la fonction d'attribution, gestionnaires actuels gardés (insertion avant suppression). */
async function poserATous(id: string, aTous: boolean, acteur: string): Promise<NextResponse | null> {
  const actuelles = await supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('gestionnaire_id').eq('copropriete_id', id)
  if (actuelles.error) return reponseErreurSqlQr(actuelles.error, 'lecture des attributions', { copropriete: id })
  const ids = ((actuelles.data ?? []) as Array<{ gestionnaire_id: string }>).map((a) => a.gestionnaire_id)
  const r = await supabaseAdmin.rpc('signalements_qr_remplacer_attributions', { p_copropriete: id, p_gestionnaires: ids, p_tous: aTous, p_acteur: acteur })
  return r.error ? reponseErreurSqlQr(r.error, 'attribution à tous', { copropriete: id }) : null
}

export async function PATCH(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_copropriete_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_copropriete_patch_${controle.user.id}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(modificationCoproprieteQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const m: Modification = validation.data

    const lecture = await lireLigneCoproprieteQr(id)
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'lecture de la copropriété', { copropriete: id })
    const avant = lecture.ligne
    if (!avant) return reponseErreur('introuvable', 404)
    const cabinetId = avant.cabinet_id ?? null
    if (m.attribueeATous !== undefined && !cabinetId) return reponseErreur('sans_cabinet', 409)

    const decision = await controlerDoublons(id, m, avant)
    if ('erreur' in decision) return decision.erreur
    if (!decision.ok) {
      const { certitude, critere, copropriete } = decision.doublon
      return NextResponse.json({ error: 'doublon', doublon: { certitude, critere, copropriete } }, { status: 409 })
    }
    const refusAdresses = await controlerAdressesAjoutees(m, avant)
    if (refusAdresses) return refusAdresses

    const { valeurs, champs } = ecritures(m, avant)
    const refusEcriture = await mettreAJour(id, valeurs)
    if (refusEcriture) return refusEcriture
    if (m.attribueeATous !== undefined) {
      const refusTous = await poserATous(id, m.attribueeATous, controle.user.id)
      if (refusTous) return refusTous
    }

    const base = { cabinetId, acteurId: controle.user.id, coproprieteId: id }
    if (champs.length > 0) await journaliserQr({ ...base, action: 'copropriete.modifiee', champs })
    if (m.actif !== undefined && m.actif !== (avant.actif !== false)) {
      await journaliserQr({ ...base, action: m.actif ? 'copropriete.reactivee' : 'copropriete.desactivee' })
    }
    if (m.regenererJeton) await journaliserQr({ ...base, action: 'copropriete.jeton_remplace' })
    if (decision.doublonForce) await journaliserQr({ ...base, action: 'doublon.force', details: { critere: 'nom_code_postal' } })

    const complete = await lireCoproprieteCompleteQr(id)
    if (!complete.ok) return reponseErreurSqlQr(complete.erreur, 'relecture de la copropriété', { copropriete: id })
    if (!complete.copropriete) return reponseErreur('introuvable', 404)
    return NextResponse.json({ copropriete: complete.copropriete })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification de copropriété`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

/** Nombre de signalements de la copropriété (sans les lire). */
async function compterSignalements(id: string): Promise<{ ok: true; nombre: number } | { ok: false; reponse: NextResponse }> {
  const { count, error } = await supabaseAdmin.from(TABLE_SIGNALEMENTS_QR).select('id', { count: 'exact', head: true }).eq('copropriete_id', id)
  if (error) return { ok: false, reponse: reponseErreurSqlQr(error, 'compte des signalements', { copropriete: id }) }
  return { ok: true, nombre: count ?? 0 }
}

const reactiver = async (id: string): Promise<void> => {
  const { error } = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).update({ actif: true }).eq('id', id)
  if (error) logger.error(`${CONTEXTE} copropriété non réactivée après une suppression refusée`, { code: error.code, copropriete: id })
}

export async function DELETE(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_copropriete_delete_${ip}`, 10, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_copropriete_delete_${controle.user.id}`, 10, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(suppressionCoproprieteQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)

    const lecture = await lireLigneCoproprieteQr(id)
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'lecture de la copropriété', { copropriete: id })
    const copro = lecture.ligne
    if (!copro) return reponseErreur('introuvable', 404)
    const nom = chaine(copro.nom).trim()
    if (validation.data.nomConfirmation !== nom) return reponseInvalide('nomConfirmation: le nom saisi n’est pas celui de la copropriété')

    const premier = await compterSignalements(id)
    if (!premier.ok) return premier.reponse
    if (premier.nombre > 0) return reponseErreur('signalements_presents', 409)

    // Plus aucun dépôt possible pendant la suppression : la copropriété est désactivée, puis le compte refait.
    const etaitActive = copro.actif !== false
    if (etaitActive) {
      const { error } = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).update({ actif: false }).eq('id', id)
      if (error) return reponseErreurSqlQr(error, 'désactivation avant suppression', { copropriete: id })
    }
    const second = await compterSignalements(id)
    if (!second.ok || second.nombre > 0) {
      if (etaitActive) await reactiver(id)
      return second.ok ? reponseErreur('signalements_presents', 409) : second.reponse
    }

    // Trace AVANT la suppression (le nom d'un immeuble n'est pas une donnée personnelle).
    await journaliserQr({ action: 'copropriete.supprimee', cabinetId: copro.cabinet_id ?? null, acteurId: controle.user.id, coproprieteId: id, details: { nom } })
    const { error } = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).delete().eq('id', id)
    if (error) {
      if (etaitActive) await reactiver(id)
      return reponseErreurSqlQr(error, 'suppression de copropriété', { copropriete: id })
    }
    return new NextResponse(null, { status: 204 })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} suppression de copropriété`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
