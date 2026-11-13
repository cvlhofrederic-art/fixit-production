// app/api/aj-signalement/cabinets/[id]/route.ts
//
// PATCH (P1-R22) — modification d'un cabinet client (super admin) : nom, identifiant, langue, domaines (liste remplacée
// en entier). Par signalements_qr_enregistrer_cabinet (paramètre absent = inchangé ; journal cabinet.modifie { champs } /
// cabinet.domaines_modifies { nombre }). Identifiant d'un cabinet qui a déjà une copropriété ou un gestionnaire →
// 409 identifiant_fige (trigger : QR codes imprimés, liens envoyés). Une fiche existante hors des nouveaux domaines
// n'est pas touchée : elle est signalée dans la réponse (fichesHorsDomaines) pour que le super admin décide.
//
// PR 3, lot 5 (D-R8, cahier § 4.1, § 7.4) — réglages de diffusion du cabinet, envoyés SEULS (jamais mêlés aux champs
// ci-dessus → 400) : adresse de contact (Reply-To des messages), politique de confidentialité (https) et déclaration
// qu'elle décrit la diffusion (datée par la base), référence et date du contrat de sous-traitance (non future), numéros
// de téléphone autorisés dans les messages (H2 ; normalisés, 10 au plus), activation ou suspension. Par
// signalements_qr_diffusion_regler_cabinet, en une transaction avec son journal (noms des champs seulement ;
// cabinet.diffusion_activee / _suspendue). Activation refusée : 409 cabinet_incomplet { manque } (liste de ce qui manque)
// ou 409 langue_non_ouverte (cabinet d'une langue hors LANGUES_DIFFUSION_OUVERTES_QR, H9). Changer ensuite la langue d'un
// cabinet activé reste permis (P1-R22 inchangée) : la base ne le fait plus diffuser (langue_non_ouverte à l'aperçu).
// 200 { cabinet, diffusion } ; migration 20261113 absente → 503 base_absente.
// GET (lot 5) — le cabinet et ses réglages de diffusion (diffusion null tant que la migration 20261113 manque).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { CHAMPS_REGLAGES_DIFFUSION_QR, modificationCabinetQrSchema, reglagesDiffusionCabinetQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { emailDansDomainesQr } from '@/lib/aj-signalement/gestionnaires'
import { normaliserTelephoneDeclareQr } from '@/lib/aj-signalement/diffusion-texte'
import {
  langueDiffusionOuverteQr, manqueActivationDiffusionQr, reglagesDiffusionDepuisLigneQr,
} from '@/lib/aj-signalement/diffusion-formes'
import {
  TABLE_GESTIONNAIRES_QR, controlerAccesQr, estUuid, journaliserRepliDiffusionQr, lireCabinetQr, reponseErreur, reponseErreurDiffusionQr,
  reponseErreurSqlQr, reponseInvalide, reponsePriveeQr, structureAbsenteQr,
} from '@/lib/aj-signalement/serveur'
import { lireCabinetsCompletsQr } from '@/lib/aj-signalement/serveur-gestion'
import { aujourdhuiParisQr, lireCabinetDiffusionQr } from '@/lib/aj-signalement/serveur-diffusion'

const CONTEXTE = '[AJ SIGNALEMENT]'

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Le corps porte-t-il un réglage de diffusion (D-R8) ? */
const porteReglagesDiffusion = (body: unknown): body is Record<string, unknown> =>
  estObjet(body) && Object.keys(body).some((cle) => (CHAMPS_REGLAGES_DIFFUSION_QR as readonly string[]).includes(cle))

/** D-R8 : réglages de diffusion et activation ou suspension, en une transaction (fonction SQL), puis la fiche relue. */
async function reglerDiffusion(id: string, acteur: string, body: Record<string, unknown>): Promise<NextResponse> {
  const autres = Object.keys(body).filter((cle) => !(CHAMPS_REGLAGES_DIFFUSION_QR as readonly string[]).includes(cle))
  if (autres.length > 0) return reponseInvalide(`${autres.join(', ')}: les réglages de diffusion s’envoient seuls`)
  const validation = validateBody(reglagesDiffusionCabinetQrSchema, body)
  if (!validation.success) return reponseInvalide(validation.error)
  const r = validation.data
  if (r.contratSigneLe && r.contratSigneLe > aujourdhuiParisQr()) return reponseInvalide('contratSigneLe: date future')
  let telephones: string[] | null = null
  if (r.telephonesAutorises) {
    const normalises = r.telephonesAutorises.map(normaliserTelephoneDeclareQr)
    const refuse = normalises.findIndex((t) => t === null)
    if (refuse >= 0) return reponseInvalide(`telephonesAutorises.${refuse}: numéro non reconnu (6 à 15 chiffres)`)
    telephones = [...new Set(normalises as string[])]
  }

  const lecture = await lireCabinetDiffusionQr(id)
  if (!lecture.ok) return reponseErreurDiffusionQr(lecture.erreur, 'réglages de diffusion du cabinet', { cabinet: id })
  if (!lecture.valeur) return reponseErreur('introuvable', 404)
  const avant = reglagesDiffusionDepuisLigneQr(lecture.valeur.ligne)

  // État après la requête (même règle que la fonction SQL, qui reste juge) : pour nommer ce qui manque.
  const politique = r.diffusionPolitiqueUrl ?? avant.politiqueUrl
  const apres = {
    contactEmail: r.diffusionContactEmail ?? avant.contactEmail,
    politiqueUrl: politique,
    politiqueDeclareeLe: r.politiqueDecritDiffusion ? 'maintenant' : (politique === avant.politiqueUrl ? avant.politiqueDeclareeLe : null),
    contratReference: r.contratReference ?? avant.contratReference,
    contratSigneLe: r.contratSigneLe ?? avant.contratSigneLe,
  }
  const activeApres = r.diffusionActivee ?? avant.active
  if (r.diffusionActivee === true && !langueDiffusionOuverteQr(lecture.valeur.langue)) return reponseErreur('langue_non_ouverte', 409)
  const manque = manqueActivationDiffusionQr(apres)
  if (activeApres && manque.length > 0) return reponsePriveeQr({ error: 'cabinet_incomplet', manque }, 409)

  const { error } = await supabaseAdmin.rpc('signalements_qr_diffusion_regler_cabinet', {
    p_cabinet: id, p_acteur: acteur, p_contact: r.diffusionContactEmail ?? null, p_politique: r.diffusionPolitiqueUrl ?? null,
    p_politique_declaree: r.politiqueDecritDiffusion ?? null, p_contrat_reference: r.contratReference ?? null,
    p_contrat_signe_le: r.contratSigneLe ?? null, p_telephones: telephones, p_activer: r.diffusionActivee ?? null,
  })
  if (error) return reponseErreurDiffusionQr(error, 'réglages de diffusion du cabinet', { cabinet: id })

  const [cabinet, relu] = await Promise.all([lireCabinetsCompletsQr([id]), lireCabinetDiffusionQr(id)])
  if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'relecture du cabinet', { cabinet: id })
  if (!relu.ok) return reponseErreurDiffusionQr(relu.erreur, 'relecture des réglages de diffusion', { cabinet: id })
  return reponsePriveeQr({ cabinet: cabinet.valeur[0] ?? null, diffusion: relu.valeur ? reglagesDiffusionDepuisLigneQr(relu.valeur.ligne) : null })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_cabinet_lecture_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_cabinet_lecture_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const cabinet = await lireCabinetsCompletsQr([id])
    if (!cabinet.ok) return reponseErreurSqlQr(cabinet.erreur, 'lecture du cabinet', { cabinet: id })
    if (!cabinet.valeur[0]) return reponseErreur('introuvable', 404)
    const reglages = await lireCabinetDiffusionQr(id)
    if (!reglages.ok) {
      if (!structureAbsenteQr(reglages.erreur)) return reponseErreurSqlQr(reglages.erreur, 'lecture des réglages de diffusion', { cabinet: id })
      journaliserRepliDiffusionQr('réglages de diffusion du cabinet', reglages.erreur)
    }
    const diffusion = reglages.ok && reglages.valeur ? reglagesDiffusionDepuisLigneQr(reglages.valeur.ligne) : null
    return reponsePriveeQr({ cabinet: cabinet.valeur[0], diffusion })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} lecture d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_cabinet_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_cabinet_patch_${controle.user.id}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    if (porteReglagesDiffusion(body)) return await reglerDiffusion(id, controle.user.id, body)
    const validation = validateBody(modificationCabinetQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const m = validation.data

    const existant = await lireCabinetQr({ id })
    if (!existant.ok) return reponseErreurSqlQr(existant.erreur, 'lecture du cabinet', { cabinet: id })
    if (!existant.cabinet) return reponseErreur('introuvable', 404)

    const { error } = await supabaseAdmin.rpc('signalements_qr_enregistrer_cabinet', {
      p_id: id, p_nom: m.nom ?? null, p_identifiant: m.identifiant ?? null, p_langue: m.langue ?? null, p_domaines: m.domaines ?? null,
      p_acteur: controle.user.id,
    })
    if (error) return reponseErreurSqlQr(error, 'modification d’un cabinet', { cabinet: id })

    let fichesHorsDomaines: Array<{ id: string; nom: string | null }> = []
    if (m.domaines) {
      const domaines = m.domaines
      const fiches = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('id, nom, email').eq('cabinet_id', id)
      if (fiches.error) logger.warn(`${CONTEXTE} fiches du cabinet non relues`, { code: fiches.error.code, cabinet: id })
      fichesHorsDomaines = ((fiches.data ?? []) as Array<{ id: string; nom: string | null; email: string | null }>)
        .filter((f) => f.email && !emailDansDomainesQr(f.email, domaines))
        .map((f) => ({ id: f.id, nom: f.nom ?? null }))
    }
    const lecture = await lireCabinetsCompletsQr([id])
    if (!lecture.ok) return reponseErreurSqlQr(lecture.erreur, 'relecture du cabinet', { cabinet: id })
    return NextResponse.json({ cabinet: lecture.valeur[0] ?? null, fichesHorsDomaines })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
