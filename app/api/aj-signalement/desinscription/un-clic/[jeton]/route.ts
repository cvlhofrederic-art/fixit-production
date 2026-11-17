// app/api/aj-signalement/desinscription/un-clic/[jeton]/route.ts
//
// Adresse de l'en-tête List-Unsubscribe de chaque message de diffusion (cahier PR 3 § 4.1, § 5.1, § 8.1 ; RFC 8058).
// Son jeton est dans le CHEMIN (la RFC l'exige) : il circule en clair (journaux du Worker, service d'e-mail), il ne
// permet donc QUE de s'opposer, jamais de « Recevoir à nouveau » ni de voir l'adresse (lib/aj-signalement/diffusion-lien.ts).
//
// POST (D-P5, messagerie) — corps exact « List-Unsubscribe=One-Click » (application/x-www-form-urlencoded, ou
// multipart/form-data, les deux formes de la RFC), sinon 400. Signature un clic vérifiée D'ABORD (clé courante ou
// précédente) ; honoré même après un an (H5 : il vient de la messagerie de la personne, l'ignorer laisserait partir des
// messages après une opposition exprimée) → signalements_qr_diffusion_opposer(…, 'un_clic'). Réponse 200 sans corps,
// identique pour un lien valable, expiré, purgé ou à la signature fausse. Limites : par lien, 5 par heure (429, la
// messagerie réessaie : jamais un faux succès) ; par IP, 300 par minute comptées sur les SEULES signatures fausses (une
// messagerie envoie des milliers d'oppositions depuis la même adresse IP : aucune opposition valable n'est perdue).
// Erreur de la base → 503 et logger.error (code seul) ; migration absente → 200 (aucune diffusion n'a pu partir) ; clé
// absente → 503. Exempté du contrôle d'Origin du middleware (décision F3, lib/aj-signalement/chemin-desinscription.ts).
//
// GET (D-P5b) — messagerie sans un clic, ou personne qui ouvre l'adresse dans un navigateur : AUCUN effet. Jeton un clic
// bien signé → 303 vers /<identifiant>/desinscription/#<jeton un clic> (identifiant lu en base) : la page s'ouvre en mode
// réduit (opposition seulement, au clic). Sinon page générique, sans script ni lien. 60 par minute et par IP.
// Jamais en cache ; jamais le jeton dans le journal du serveur (Sentry l'efface aussi, lib/aj-signalement/sentry-desinscription.ts).

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { cheminDesinscriptionCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import { identifiantCabinetLienValideQr, verifierJetonDiffusionQr } from '@/lib/aj-signalement/diffusion-lien'
import { journaliserRepliDiffusionQr, structureAbsenteQr } from '@/lib/aj-signalement/serveur'
import {
  CACHE_PRIVE_DESINSCRIPTION_QR, journaliserCleAbsenteDesinscriptionQr, relireLigneLienQr, reponseVideDesinscriptionQr,
} from '@/lib/aj-signalement/serveur-desinscription'

const CONTEXTE = '[AJ SIGNALEMENT]'
const UNE_HEURE_MS = 60 * 60 * 1000
/** Taille au-delà de laquelle le corps n'est pas lu (le corps attendu fait 26 octets). */
const TAILLE_MAX_CORPS = 4096

type Contexte = { params: Promise<{ jeton: string }> }

/** Un seul champ, « List-Unsubscribe », de valeur exacte « One-Click » (RFC 8058, § 3.1). */
const champsExacts = (champs: ReadonlyArray<readonly [string, unknown]>): boolean =>
  champs.length === 1 && champs[0][0] === 'List-Unsubscribe' && champs[0][1] === 'One-Click'

/** Corps du POST un clic : application/x-www-form-urlencoded ou multipart/form-data, rien d'autre. */
async function corpsUnClicExact(request: NextRequest): Promise<boolean> {
  const type = (request.headers.get('content-type') ?? '').toLowerCase()
  const longueur = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(longueur) && longueur > TAILLE_MAX_CORPS) return false
  if (type.startsWith('application/x-www-form-urlencoded')) {
    const texte = await request.text()
    return texte.length <= TAILLE_MAX_CORPS && champsExacts([...new URLSearchParams(texte).entries()])
  }
  if (type.startsWith('multipart/form-data')) {
    try {
      const formulaire = await request.formData()
      return champsExacts([...formulaire.entries()])
    } catch {
      // Corps multipart illisible : refusé comme tout autre corps inexact (aucune donnée à journaliser).
      return false
    }
  }
  return false
}

export async function POST(request: NextRequest, { params }: Contexte) {
  try {
    if (!(await corpsUnClicExact(request))) return reponseVideDesinscriptionQr(400)
    const { jeton } = await params
    const verification = await verifierJetonDiffusionQr(jeton, ['un_clic'])
    if (verification.statut === 'configuration_incomplete') {
      journaliserCleAbsenteDesinscriptionQr()
      return reponseVideDesinscriptionQr(503)
    }
    if (verification.statut !== 'signe') {
      // Seules les signatures fausses comptent pour la limite par IP ; même réponse qu'un lien valable.
      const ip = getClientIP(request)
      if (!(await checkRateLimit(`qr_desinscription_un_clic_ip_${ip}`, 300, 60_000))) return reponseVideDesinscriptionQr(429)
      return reponseVideDesinscriptionQr(200)
    }
    if (!(await checkRateLimit(`qr_desinscription_un_clic_${verification.destinataireId}`, 5, UNE_HEURE_MS))) {
      return reponseVideDesinscriptionQr(429)
    }
    const { error } = await supabaseAdmin.rpc('signalements_qr_diffusion_opposer', {
      p_destinataire: verification.destinataireId, p_origine: 'un_clic',
    })
    if (error) {
      if (structureAbsenteQr(error)) {
        journaliserRepliDiffusionQr('opposition un clic', error)
        return reponseVideDesinscriptionQr(200)
      }
      logger.error(`${CONTEXTE} opposition un clic refusée par la base`, { code: error.code })
      return reponseVideDesinscriptionQr(503)
    }
    return reponseVideDesinscriptionQr(200)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} opposition un clic`, { message: e instanceof Error ? e.name : 'inconnue' })
    return reponseVideDesinscriptionQr(503)
  }
}

// ── D-P5b : page générique (sans script, sans lien, sans ressource) ──

type CasPageGenerique = 'non_valable' | 'indisponible' | 'limite'

const TEXTES_PAGE_GENERIQUE: Readonly<Record<CasPageGenerique, { status: number; titre: string; fr: string; pt: string }>> = {
  non_valable: {
    status: 404,
    titre: 'Lien non valable',
    fr: 'Ce lien n’est pas valable. Utilisez le bouton « Ne plus recevoir les informations sur cet immeuble » d’un message plus récent, ou écrivez au cabinet qui gère votre immeuble.',
    pt: 'Esta ligação não é válida. Utilize o botão « Deixar de receber as informações sobre este prédio » de uma mensagem mais recente ou escreva ao administrador do seu prédio.',
  },
  indisponible: {
    status: 503,
    titre: 'Service indisponible',
    fr: 'Le service est momentanément indisponible. Réessayez dans quelques instants.',
    pt: 'O serviço está temporariamente indisponível. Tente novamente dentro de instantes.',
  },
  limite: {
    status: 429,
    titre: 'Trop de demandes',
    fr: 'Trop de demandes en peu de temps. Réessayez dans quelques minutes.',
    pt: 'Demasiados pedidos em pouco tempo. Tente novamente dentro de alguns minutos.',
  },
}

function pageGenerique(cas: CasPageGenerique): NextResponse {
  const t = TEXTES_PAGE_GENERIQUE[cas]
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">'
    + `<title>${t.titre}</title></head>`
    + '<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1F2D3D;line-height:1.5">'
    + `<h1 style="font-size:1.5rem;color:#0D1B2E">${t.titre}</h1><p>${t.fr}</p><p lang="pt">${t.pt}</p></body></html>`
  const reponse = new NextResponse(html, {
    status: t.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': CACHE_PRIVE_DESINSCRIPTION_QR,
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
    },
  })
  if (cas === 'limite') reponse.headers.set('Retry-After', '60')
  return reponse
}

export async function GET(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_desinscription_un_clic_get_${ip}`, 60, 60_000))) return pageGenerique('limite')
    const { jeton } = await params
    const verification = await verifierJetonDiffusionQr(jeton, ['un_clic'])
    if (verification.statut === 'configuration_incomplete') journaliserCleAbsenteDesinscriptionQr()
    if (verification.statut !== 'signe') return pageGenerique('non_valable')
    const relecture = await relireLigneLienQr(verification.destinataireId)
    if (relecture.statut === 'erreur') return pageGenerique('indisponible')
    const identifiant = relecture.statut === 'lue' ? relecture.ligne?.cabinet_identifiant : undefined
    if (!identifiant || !identifiantCabinetLienValideQr(identifiant)) return pageGenerique('non_valable')
    // Jeton dans le FRAGMENT de la page (jamais renvoyé au serveur ni dans le Referer) ; la page l'efface aussitôt.
    // (jeton déjà vérifié : 32 hex, un point, 64 hex ; rien d'autre n'entre dans l'adresse.)
    const reponse = NextResponse.redirect(new URL(`${cheminDesinscriptionCabinetQr(identifiant)}#${jeton}`, request.url), 303)
    reponse.headers.set('Cache-Control', CACHE_PRIVE_DESINSCRIPTION_QR)
    reponse.headers.set('Referrer-Policy', 'no-referrer')
    return reponse
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} ouverture de l’adresse un clic`, { message: e instanceof Error ? e.name : 'inconnue' })
    return pageGenerique('indisponible')
  }
}
