// app/api/aj-signalement/cabinets/[id]/logo/route.ts
//
// Logo d'un cabinet client (demande de Hugo du 13/11/2026 : « pouvoir ajouter le logo au cabinet et aux PDF »), super
// admin seul (rôle ET liste d'e-mails, jamais la « vue en tant que ») :
// PUT — envoi : { png } (base64 strict, logoCabinetQrSchema). L'image vient du navigateur, déjà convertie en PNG par un
//   canvas (SVG, PNG, JPEG, WebP acceptés à l'écran) ; elle est REVÉRIFIÉE ici (analyserPngQr : PNG tel qu'un canvas le
//   produit — forme : signature, morceaux, CRC, IHDR d'abord, RVB ou RVBA 8 bits sans entrelacement, accessoires sans
//   texte de longueur fixe, IDAT à la suite, IEND en dernier et rien après, 800 × 400 px et 200 Kio au plus ; contenu :
//   flux zlib conforme, de la taille exacte des pixels, rien après lui ; relecture de sécurité du 13/11/2026), puis par
//   la contrainte de la base (forme seule). Dimensions tirées de l'en-tête de l'image, jamais du corps. Jamais de SVG.
// DELETE — retrait.
// Les deux par signalements_qr_regler_logo_cabinet (migration 20261114), en une transaction avec le journal
// (cabinet.modifie, champs {logo} ; même image renvoyée ou retrait sans logo : rien d'écrit, modifie = false) ;
// p_acteur = la session, jamais le corps. 200 { logo: { version, largeur, hauteur } | null, modifie } ; cabinet inconnu
// ou id hors format → 404 ; image refusée → 400 invalide ; migration absente → 503 base_absente (journalisé une fois).
// Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logoCabinetQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { FORMAT_VERSION_LOGO_QR, LOGO_BASE64_MAX_QR, analyserPngQr, byteaDepuisOctetsQr, octetsDepuisBase64Qr } from '@/lib/aj-signalement/logo'
import {
  controlerAccesQr, estUuid, journaliserRepliLogoQr, lireCabinetQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr,
  structureAbsenteQr, type ControleAccesQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'

const CONTEXTE = '[AJ SIGNALEMENT]'
/** Corps annoncé au-delà duquel rien n'est lu : le PNG le plus lourd en base64, et la place de l'objet JSON. */
const CORPS_MAX_OCTETS = LOGO_BASE64_MAX_QR + 1024

type Contexte = { params: Promise<{ id: string }> }
type Controle = Extract<ControleAccesQr, { ok: true }>

/** Limites (adresse IP puis compte) et contrôle du super admin, communs à l'envoi et au retrait. */
async function controler(request: NextRequest): Promise<{ ok: true; controle: Controle } | { ok: false; reponse: Response }> {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`qr_cabinet_logo_${ip}`, 10, 60_000))) return { ok: false, reponse: rateLimitResponse() }
  const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
  if (!controle.ok) return { ok: false, reponse: controle.reponse }
  if (!(await checkRateLimit(`qr_cabinet_logo_${controle.user.id}`, 30, 3_600_000))) return { ok: false, reponse: rateLimitResponse() }
  return { ok: true, controle }
}

/** Erreur de la fonction : migration absente → 503 (repli journalisé) ; image refusée par la base → 400 ; sinon le code public. */
function reponseErreurLogo(erreur: ErreurBase, operation: string, cabinet: string): Response {
  if (structureAbsenteQr(erreur)) {
    journaliserRepliLogoQr(operation, erreur)
    return reponseErreur('base_absente', 503)
  }
  if (erreur.code === '23514') {
    // La route a déjà vérifié l'image : un refus de la contrainte signale un écart entre les deux contrôles.
    logger.warn(`${CONTEXTE} ${operation} : image refusée par la contrainte de la base`, { code: erreur.code, cabinet })
    return reponseInvalide('png: image refusée')
  }
  return reponseErreurSqlQr(erreur, operation, { cabinet })
}

/** Le cabinet existe-t-il ? 404 sinon ; erreur de la base → sa réponse. */
async function cabinetExistant(id: string): Promise<Response | null> {
  const existant = await lireCabinetQr({ id })
  if (!existant.ok) return reponseErreurSqlQr(existant.erreur, 'lecture du cabinet', { cabinet: id })
  return existant.cabinet ? null : reponseErreur('introuvable', 404)
}

const modifieDe = (data: unknown): boolean => (data as { modifie?: unknown } | null)?.modifie === true

export async function PUT(request: NextRequest, { params }: Contexte) {
  try {
    const acces = await controler(request)
    if (!acces.ok) return acces.reponse
    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)

    const annonce = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(annonce) && annonce > CORPS_MAX_OCTETS) return reponseInvalide('png: PNG trop lourd (200 Kio au plus)')
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(logoCabinetQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const png = octetsDepuisBase64Qr(validation.data.png)
    if (!png) return reponseInvalide('png: PNG en base64 attendu')
    const analyse = analyserPngQr(png)
    if (!analyse.ok) return reponseInvalide(`png: image refusée (${analyse.raison})`)

    const absent = await cabinetExistant(id)
    if (absent) return absent

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_regler_logo_cabinet', {
      p_cabinet: id, p_png: byteaDepuisOctetsQr(png), p_largeur: analyse.largeur, p_hauteur: analyse.hauteur, p_acteur: acces.controle.user.id,
    })
    if (error) return reponseErreurLogo(error, 'envoi du logo d’un cabinet', id)
    const version = (data as { version?: unknown } | null)?.version
    if (typeof version !== 'string' || !FORMAT_VERSION_LOGO_QR.test(version)) {
      logger.error(`${CONTEXTE} envoi du logo d’un cabinet : réponse de la base inattendue`, { cabinet: id })
      return reponseErreur('serveur', 500)
    }
    return reponsePriveeQr({ logo: { version, largeur: analyse.largeur, hauteur: analyse.hauteur }, modifie: modifieDe(data) })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} envoi du logo d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Contexte) {
  try {
    const acces = await controler(request)
    if (!acces.ok) return acces.reponse
    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const absent = await cabinetExistant(id)
    if (absent) return absent

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_regler_logo_cabinet', {
      p_cabinet: id, p_png: null, p_largeur: null, p_hauteur: null, p_acteur: acces.controle.user.id,
    })
    if (error) return reponseErreurLogo(error, 'retrait du logo d’un cabinet', id)
    return reponsePriveeQr({ logo: null, modifie: modifieDe(data) })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} retrait du logo d’un cabinet`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
