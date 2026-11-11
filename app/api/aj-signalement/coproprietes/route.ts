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

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { coproprieteQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { adressesDeFichesQr } from '@/lib/aj-signalement/destinataires'
import { cleNomCoproQr, decisionDoublonsQr, doublonsCoproprieteQr } from '@/lib/aj-signalement/doublons'
import { emailCanoniqueQr, emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import {
  COLONNES_COPROPRIETE_QR, TABLE_COPROPRIETES_QR, contexteGestionVideQr, controlerAccesQr, coproprieteDepuisLigne, fonctionAbsenteQr,
  genererJetonQr, journaliserRepliGestionQr, lireCabinetQr, lireCoproprieteCompleteQr, lireCoproprietesDoublonsQr, lireDomainesCabinetQr,
  lireEmailsFichesQr, reponseErreur, reponseErreurBase, reponseErreurSqlQr, reponseInvalide, type LigneCoproprieteQr,
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
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
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
      domaines = await lireDomainesCabinetQr(cabinetId)
    }

    const emails = canoniques(s.emailsDestinataires)
    if (adressesDeFichesQr(emails, await lireEmailsFichesQr()).length > 0) {
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
 * Migration du 11/11/2026 non appliquée : insertion d'origine (nom, adresse, destinataires), comme avant la PR, pour
 * le seul corps de l'écran actuel ; un corps qui demande davantage répond 503 base_absente (rien n'est perdu en silence).
 */
async function creationDOrigine(
  s: { cabinetId?: string; gestionnaireIds: string[]; attribueeATous: boolean; codePostal: string; ville: string; immatriculation: string; referenceCabinet: string; batiments: string[]; nom: string; adresse: string },
  emails: string[], acteur: string, erreur: { code?: string },
): Promise<NextResponse> {
  const nouveaux = Boolean(s.cabinetId) || s.gestionnaireIds.length > 0 || s.attribueeATous
    || [s.codePostal, s.ville, s.immatriculation, s.referenceCabinet].some(Boolean) || s.batiments.length > 0
  if (nouveaux) return reponseErreur('base_absente', 503)
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
