// app/api/aj-signalement/coproprietes/[id]/diffusions/route.ts
//
// POST (D-R3, cahier PR 3 § 4.1, § 5, § 9) — diffuser un message d'exploitation aux déclarants d'une copropriété :
//   - contrôle du texte (§ 5.3 : liens, adresses, téléphones non déclarés par le cabinet, termes commerciaux) sur l'objet,
//     le texte et le libellé saisi d'un bâtiment ou d'un étage → 400 texte_refuse { champ, motif } ; message d'annonce
//     (H1 = C) : objet et texte EXACTEMENT ceux du texte figé, sinon 400 ;
//   - super admin : instruction écrite du cabinet exigée (référence et date de réception, non future) → 400 sinon
//     (HF4, J29) ; gardée dans la diffusion ;
//   - clé de signature des liens de désinscription absente → 503 configuration_incomplete (aucun lien ne peut être émis) ;
//   - création atomique en base (signalements_qr_diffusion_creer : verrou de la copropriété, rejeu d'un double clic,
//     destinataires calculés à l'instant de l'aperçu, nombre réel jamais au-dessus de l'annoncé, valeurs figées, journal
//     diffusion.envoyee) → 409 diffusion_inactive / aucun_destinataire / perimetre_change ;
//   - copie au contact du cabinet (§ 5.6 ; échec journalisé, l'envoi continue), puis jusqu'à 5 lots (§ 5.5).
//   201 { diffusionId, nbDestinataires, envoyes, refuses, reste, arret } ; 200 (même corps, rejeu: true) pour un double
//   clic : la diffusion déjà créée, sans nouvel envoi (l'écran reprend tant que reste > 0).
// GET (D-R5) — historique d'une copropriété (20 par page, curseur BRUT de PostgREST) et compteur du mois ; nombres par
// état agrégés en base ; auteur réduit à « administrateur » / « gestionnaire » ; aucune adresse. Purge de conservation
// (H10) lancée au plus une fois par jour.
// Super admin seul en PR 3 (partie gestionnaire H11 ensuite). Migration 20261113 absente → 503 base_absente. Jamais en cache.

import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { diffusionQrSchema, diffusionsQrQuerySchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { estAnnonceFigeeQr } from '@/lib/aj-signalement/affichage-diffusion'
import { cleLiensDiffusionConfigureeQr } from '@/lib/aj-signalement/diffusion-lien'
import { controlerTexteDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import type { CoupleValeursQr } from '@/lib/aj-signalement/diffusion-valeurs'
import { resoudrePerimetreDiffusionQr, resumeDiffusionDepuisLigneQr } from '@/lib/aj-signalement/diffusion-formes'
import { envoyerCopieCabinetDiffusionQr, expediteurDiffusionQr } from '@/lib/aj-signalement/email'
import {
  controlerAccesQr, estUuid, parametresQr, reponseErreur, reponseErreurDiffusionQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  PROFILS_DIFFUSION_QR, TABLE_DIFFUSIONS_QR, aujourdhuiParisQr, couplesDiffusionQr, diffusionFigeeQr, envoyerEtCompterDiffusionQr,
  lireContexteDiffusionQr, lireDiffusionQr, moisDiffusionQr, nombresDiffusionQr, parametresAuteurDiffusionQr,
  purgerDiffusionsSiBesoinQr, signalementDeLaCoproprieteQr,
} from '@/lib/aj-signalement/serveur-diffusion'

const CONTEXTE = '[AJ SIGNALEMENT]'
const PAGE_HISTORIQUE = 20

/** 400 texte_refuse : le champ et le motif (et un conseil), jamais le texte reçu. */
const refusTexte = (champ: string, motif: string, conseil?: string) =>
  reponsePriveeQr({ error: 'texte_refuse', champ, motif, ...(conseil ? { conseil } : {}) }, 400)

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_envoi_ip_${ip}`, 20, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_envoi_${controle.user.id}`, 10, 10 * 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(diffusionQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const d = validation.data
    const profil = controle.profil

    // Super admin : le cabinet décide d'envoyer ; son instruction écrite est exigée et gardée (HF4).
    if (profil.type === 'super_admin') {
      if (!d.instruction) return reponseInvalide('instruction: référence et date de l’instruction écrite du cabinet requises')
      if (d.instruction.recueLe > aujourdhuiParisQr()) return reponseInvalide('instruction.recueLe: date future')
    }
    if (!cleLiensDiffusionConfigureeQr()) {
      logger.error(`${CONTEXTE} diffusion : clé de signature des liens absente (AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION)`, { copropriete: id })
      return reponseErreur('configuration_incomplete', 503)
    }

    const contexte = await lireContexteDiffusionQr(id)
    if (!contexte.ok) return reponseErreurDiffusionQr(contexte.erreur, 'création d’une diffusion', { copropriete: id })
    if (!contexte.valeur) return reponseErreur('introuvable', 404)
    const { copropriete, cabinet } = contexte.valeur
    if (!cabinet) return reponseErreur('diffusion_inactive', 409)
    const telephonesAutorises = cabinet.telephones

    if (d.modele === 'annonce') {
      if (!estAnnonceFigeeQr(cabinet.langue, cabinet.nom, { objet: d.objet, texte: d.texte })) {
        return reponseInvalide('annonce: objet et texte du message d’annonce figés')
      }
    } else {
      for (const [champ, valeur, nature] of [['objet', d.objet, 'objet'], ['texte', d.texte, 'texte']] as const) {
        const c = controlerTexteDiffusionQr(valeur, { nature, telephonesAutorises })
        if (!c.ok) return refusTexte(champ, c.motif, c.conseil)
      }
    }

    if (d.perimetre.portee === 'signalement') {
      const lien = await signalementDeLaCoproprieteQr(d.perimetre.signalementId, id)
      if (!lien.ok) return reponseErreurDiffusionQr(lien.erreur, 'création d’une diffusion', { copropriete: id })
      if (!lien.valeur) return reponseErreur('introuvable', 404)
    }
    let couples: CoupleValeursQr[] = []
    if (d.perimetre.portee === 'batiment' || d.perimetre.portee === 'etage') {
      const lus = await couplesDiffusionQr(id)
      if (!lus.ok) return reponseErreurDiffusionQr(lus.erreur, 'création d’une diffusion', { copropriete: id })
      couples = lus.valeur
    }
    const perimetre = resoudrePerimetreDiffusionQr({
      perimetre: d.perimetre, couples, batimentsFiche: copropriete.batiments, langue: cabinet.langue, telephonesAutorises,
      libelleBatimentSaisi: d.libelleBatimentSaisi, libelleEtageSaisi: d.libelleEtageSaisi,
    })
    if (!perimetre.ok) {
      if (perimetre.code === 'perimetre_change') return reponseErreur('perimetre_change', 409)
      return refusTexte(perimetre.champ, perimetre.motif, perimetre.conseil)
    }
    if (perimetre.libelle === null) return reponseInvalide('libelleBatimentSaisi: nom du bâtiment ou de l’étage à écrire dans le message requis')

    const { data, error } = await supabaseAdmin.rpc('signalements_qr_diffusion_creer', {
      p_operation: d.operationId, p_copropriete: id, ...parametresAuteurDiffusionQr(profil),
      p_instruction_reference: profil.type === 'super_admin' ? d.instruction?.reference ?? null : null,
      p_instruction_recue_le: profil.type === 'super_admin' ? d.instruction?.recueLe ?? null : null,
      p_modele: d.modele, p_objet: d.objet, p_texte: d.texte,
      p_portee: perimetre.sql.p_portee, p_cle_batiment: perimetre.sql.p_cle_batiment, p_cle_etage: perimetre.sql.p_cle_etage,
      p_batiments: perimetre.sql.p_batiments, p_etages: perimetre.sql.p_etages, p_signalement: perimetre.sql.p_signalement,
      p_libelle: perimetre.libelle, p_jusqu_au: d.perimetreJusquAu, p_attendu: d.nbDestinatairesAttendu,
      p_expediteur: expediteurDiffusionQr(cabinet.nom),
    })
    if (error) return reponseErreurDiffusionQr(error, 'création d’une diffusion', { copropriete: id })
    const cree = (Array.isArray(data) ? data[0] : null) as { diffusion_id?: unknown; nb_destinataires?: unknown; rejeu?: unknown } | null
    if (!cree || typeof cree.diffusion_id !== 'string') {
      logger.error(`${CONTEXTE} création d’une diffusion : aucune ligne rendue`, { copropriete: id })
      return reponseErreur('serveur', 500)
    }
    const diffusionId = cree.diffusion_id
    const rejeu = cree.rejeu === true
    const nbDestinataires = Number(cree.nb_destinataires ?? 0)

    if (rejeu) {
      const nombres = await nombresDiffusionQr(diffusionId)
      if (!nombres.ok) return reponseErreurDiffusionQr(nombres.erreur, 'rejeu d’une diffusion', { diffusion: diffusionId })
      const n = nombres.valeur
      return reponsePriveeQr({ diffusionId, nbDestinataires, envoyes: n.envoyes, refuses: n.refuses, reste: n.attente, arret: null, rejeu: true })
    }

    const lecture = await lireDiffusionQr(diffusionId)
    if (!lecture.ok || !lecture.valeur) {
      logger.error(`${CONTEXTE} diffusion créée mais non relue`, { diffusion: diffusionId, code: lecture.ok ? 'absente' : lecture.erreur.code })
      return reponseErreur('serveur', 500)
    }
    // Copie au cabinet (responsable du traitement) : documente chaque envoi ; son échec n'arrête pas l'envoi.
    const figee = diffusionFigeeQr(lecture.valeur)
    if (figee && (await envoyerCopieCabinetDiffusionQr(figee))) {
      const copie = await supabaseAdmin.from(TABLE_DIFFUSIONS_QR).update({ copie_cabinet_le: new Date().toISOString() }).eq('id', diffusionId)
      if (copie.error) logger.warn(`${CONTEXTE} date de la copie au cabinet non écrite`, { diffusion: diffusionId, code: copie.error.code })
    }
    const envoi = await envoyerEtCompterDiffusionQr(lecture.valeur)
    if (!envoi) return reponseErreur('serveur', 500)
    return reponsePriveeQr({ diffusionId, nbDestinataires, ...envoi, rejeu: false }, 201)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} création d’une diffusion`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_diffusion_liste_ip_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: PROFILS_DIFFUSION_QR })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_diffusion_liste_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const validation = validateBody(diffusionsQrQuerySchema, parametresQr(request))
    if (!validation.success) return reponseInvalide(validation.error)

    const contexte = await lireContexteDiffusionQr(id)
    if (!contexte.ok) return reponseErreurDiffusionQr(contexte.erreur, 'historique des diffusions', { copropriete: id })
    if (!contexte.valeur) return reponseErreur('introuvable', 404)
    await purgerDiffusionsSiBesoinQr()

    const [liste, mois] = await Promise.all([
      supabaseAdmin.rpc('signalements_qr_diffusions_liste', { p_copropriete: id, p_avant: validation.data.avant ?? null, p_limite: PAGE_HISTORIQUE + 1 }),
      moisDiffusionQr(id),
    ])
    if (liste.error) return reponseErreurDiffusionQr(liste.error, 'historique des diffusions', { copropriete: id })
    if (!mois.ok) return reponseErreurDiffusionQr(mois.erreur, 'compteur du mois', { copropriete: id })
    const lignes = (Array.isArray(liste.data) ? liste.data : []) as Array<Record<string, unknown>>
    const page = lignes.slice(0, PAGE_HISTORIQUE).map(resumeDiffusionDepuisLigneQr)
    const suivant = lignes.length > PAGE_HISTORIQUE ? page.at(-1)?.creeLe ?? null : null
    return reponsePriveeQr({ diffusions: page, ceMois: mois.valeur, suivant })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} historique des diffusions`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
