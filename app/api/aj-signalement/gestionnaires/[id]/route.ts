// app/api/aj-signalement/gestionnaires/[id]/route.ts
//
// GET (P1-R10) — page profil d'un gestionnaire vue par le super admin : fiche, historique des envois (dates, objet,
//   accepté le, refus ; jamais le jeton), copropriétés attribuées avec leur origine, copropriétés qu'il a créées (PR 2),
//   extrait du journal (50 dernières lignes où il est concerné ou auteur). Jamais en cache.
// PATCH (P1-R11) — une seule action : `nom` · `actif: true` (réactivation, même fiche ; fiche pseudonymisée → 409
//   fiche_effacee) · `pseudonymiser: true` (RGPD : fiche DÉSACTIVÉE seulement, sinon 409 fiche_active — faire d'abord le
//   départ ; nom et e-mail effacés, envois supprimés, journal). La désactivation passe par POST …/depart.
//   PR 2, lot 6 (SPEC § 2.6) : la réactivation débloque le compte VitFix relié (ban_duration none, date de blocage
//   effacée, journal gestionnaire.modifie [connexion_bloquee_le]) ; l'effacement supprime ce compte (deleteUser). L'action
//   de la PR 1 est toujours faite d'abord ; si celle du compte échoue : 207 { gestionnaire, error:
//   'connexion_non_debloquee' | 'compte_non_supprime' }, et le même bouton la relance. Migration 20261112 absente ou
//   fiche sans compte : la réponse de la PR 1, sans appel à l'authentification.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { modificationGestionnaireQrSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import type { AttributionVueQr, FicheGestionnaireDetailQr } from '@/lib/aj-signalement/types'
import {
  TABLE_ATTRIBUTIONS_QR, TABLE_COPROPRIETES_QR, TABLE_GESTIONNAIRES_QR, TABLE_INVITATIONS_QR, TABLE_JOURNAL_QR, controlerAccesQr, estUuid,
  journaliserQr, reponseErreur, reponseErreurSqlQr, reponseInvalide, reponsePriveeQr,
} from '@/lib/aj-signalement/serveur'
import {
  COLONNES_JOURNAL_QR, envoiDepuisLigneQr, evenementsDepuisLignesQr, gestionnairesDepuisFichesQr, lireEnvoisQr, lireFicheQr, origineAttributionQr,
  type LigneFicheQr, type LigneJournalQr,
} from '@/lib/aj-signalement/serveur-gestion'
import { debloquerConnexionQr, lireCompteFicheQr, supprimerCompteFicheQr } from '@/lib/aj-signalement/serveur-compte'

const CONTEXTE = '[AJ SIGNALEMENT]'
const EXTRAIT_JOURNAL = 50

type Contexte = { params: Promise<{ id: string }> }

/** Suite d'une action sur le compte relié (PR 2) : null si faite ou sans objet, sinon le code de la réponse 207. */
type Suite = { incomplet: 'connexion_non_debloquee' | 'compte_non_supprime' | null }

/**
 * Réactivation (même fiche ; pseudonymisée → 409 fiche_effacee), puis, PR 2, déblocage du compte relié : juste après la
 * réactivation, ou à la relance d'un déblocage qui avait échoué (date de blocage encore posée). Migration 20261112
 * absente ou fiche sans compte : la PR 1, sans appel à l'authentification.
 */
async function reactiver(fiche: LigneFicheQr, acteurId: string): Promise<NextResponse | Suite> {
  if (fiche.pseudonymise_le) return reponseErreur('fiche_effacee', 409)
  const reactivee = fiche.actif !== true
  if (reactivee) {
    const { data, error } = await supabaseAdmin.rpc('signalements_qr_reactiver_gestionnaire', { p_id: fiche.id, p_acteur: acteurId })
    if (error) return reponseErreurSqlQr(error, 'réactivation d’un gestionnaire', { gestionnaire: fiche.id })
    if (data !== true) return reponseErreur('a_reverifier', 409)
  }
  const compte = await lireCompteFicheQr(fiche.id, 'réactivation : compte de la fiche')
  if (compte.etat === 'migration_absente') return { incomplet: null }
  if (compte.etat === 'erreur') return { incomplet: 'connexion_non_debloquee' }
  if (!compte.userId || (!reactivee && !compte.connexionBloqueeLe)) return { incomplet: null }
  const debloquee = await debloquerConnexionQr({
    gestionnaireId: fiche.id, cabinetId: fiche.cabinet_id, userId: compte.userId, connexionBloqueeLe: compte.connexionBloqueeLe, acteurId,
  })
  return { incomplet: debloquee ? null : 'connexion_non_debloquee' }
}

/**
 * Effacement RGPD (fiche DÉSACTIVÉE seulement ; nom et e-mail effacés, envois supprimés, journal), puis, PR 2,
 * suppression du compte relié ; la relance (même bouton, fiche déjà pseudonymisée) ne rejoue que la suppression du compte.
 */
async function effacer(fiche: LigneFicheQr, journal: { cabinetId: string; acteurId: string; gestionnaireId: string }): Promise<NextResponse | Suite> {
  if (fiche.actif === true) return reponseErreur('fiche_active', 409)
  if (!fiche.pseudonymise_le) {
    const { error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR)
      .update({ nom: null, email: null, pseudonymise_le: new Date().toISOString() }).eq('id', fiche.id).eq('actif', false)
    if (error) return reponseErreurSqlQr(error, 'pseudonymisation d’un gestionnaire', { gestionnaire: fiche.id })
    const envois = await supabaseAdmin.from(TABLE_INVITATIONS_QR).delete().eq('gestionnaire_id', fiche.id)
    if (envois.error) logger.warn(`${CONTEXTE} envois d’une fiche pseudonymisée non supprimés`, { code: envois.error.code, gestionnaire: fiche.id })
    await journaliserQr({ ...journal, action: 'gestionnaire.pseudonymise' })
  }
  const compte = await lireCompteFicheQr(fiche.id, 'effacement : compte de la fiche')
  if (compte.etat === 'migration_absente') return { incomplet: null }
  if (compte.etat === 'erreur') return { incomplet: 'compte_non_supprime' }
  if (!compte.userId) return { incomplet: null }
  return { incomplet: (await supprimerCompteFicheQr(fiche.id, compte.userId)) ? null : 'compte_non_supprime' }
}

async function formePublique(fiche: LigneFicheQr): Promise<NextResponse | { gestionnaire: FicheGestionnaireDetailQr['gestionnaire'] }> {
  const forme = await gestionnairesDepuisFichesQr([fiche])
  if (!forme.ok) return reponseErreurSqlQr(forme.erreur, 'lecture du gestionnaire', { gestionnaire: fiche.id })
  return { gestionnaire: forme.valeur[0] }
}

export async function GET(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_gestionnaire_${ip}`, 60, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_gestionnaire_${controle.user.id}`, 60, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const fiche = await lireFicheQr(id)
    if (!fiche.ok) return reponseErreurSqlQr(fiche.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    if (!fiche.valeur) return reponseErreur('introuvable', 404)

    const [forme, envois, attributions, creations, journal] = await Promise.all([
      formePublique(fiche.valeur),
      lireEnvoisQr([id]),
      supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id, origine, created_at').eq('gestionnaire_id', id),
      supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, nom').eq('cree_par_gestionnaire_id', id),
      supabaseAdmin.from(TABLE_JOURNAL_QR).select(COLONNES_JOURNAL_QR).or(`gestionnaire_id.eq.${id},acteur_gestionnaire_id.eq.${id}`)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(EXTRAIT_JOURNAL),
    ])
    if (forme instanceof NextResponse) return forme
    if (!envois.ok) return reponseErreurSqlQr(envois.erreur, 'lecture des envois', { gestionnaire: id })
    for (const r of [attributions, creations, journal]) {
      if (r.error) return reponseErreurSqlQr(r.error, 'lecture de la page profil', { gestionnaire: id })
    }
    const lignesAttributions = (attributions.data ?? []) as Array<{ copropriete_id: string; origine: string | null; created_at: string | null }>
    const noms = new Map<string, string>()
    if (lignesAttributions.length > 0) {
      const copros = await supabaseAdmin.from(TABLE_COPROPRIETES_QR).select('id, nom').in('id', lignesAttributions.map((a) => a.copropriete_id))
      if (copros.error) logger.warn(`${CONTEXTE} noms des copropriétés non lus`, { code: copros.error.code, gestionnaire: id })
      for (const c of (copros.data ?? []) as Array<{ id: string; nom: string | null }>) noms.set(c.id, c.nom ?? '')
    }
    const detail: FicheGestionnaireDetailQr = {
      gestionnaire: forme.gestionnaire,
      envois: envois.valeur.map(envoiDepuisLigneQr),
      attributions: lignesAttributions.map((a): AttributionVueQr => ({
        coproprieteId: a.copropriete_id, nom: noms.get(a.copropriete_id) ?? '', origine: origineAttributionQr(a.origine), creeLe: a.created_at ?? '',
      })),
      creations: ((creations.data ?? []) as Array<{ id: string; nom: string | null }>).map((c) => ({ id: c.id, nom: c.nom ?? '' })),
      journal: await evenementsDepuisLignesQr((journal.data ?? []) as unknown as LigneJournalQr[]),
    }
    return reponsePriveeQr(detail)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} page profil d’un gestionnaire`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Contexte) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_gestionnaire_patch_${ip}`, 30, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_gestionnaire_patch_${controle.user.id}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const body: unknown = await request.json().catch(() => null)
    const validation = validateBody(modificationGestionnaireQrSchema, body)
    if (!validation.success) return reponseInvalide(validation.error)
    const action = validation.data

    const lue = await lireFicheQr(id)
    if (!lue.ok) return reponseErreurSqlQr(lue.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    const fiche = lue.valeur
    if (!fiche) return reponseErreur('introuvable', 404)
    const journal = { cabinetId: fiche.cabinet_id, acteurId: controle.user.id, gestionnaireId: id }

    let suite: Suite = { incomplet: null }
    if ('nom' in action) {
      if (fiche.pseudonymise_le) return reponseErreur('fiche_effacee', 409)
      const { error } = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).update({ nom: action.nom }).eq('id', id).is('pseudonymise_le', null)
      if (error) return reponseErreurSqlQr(error, 'modification d’un gestionnaire', { gestionnaire: id })
      await journaliserQr({ ...journal, action: 'gestionnaire.modifie', champs: ['nom'] })
    } else if ('actif' in action) {
      const r = await reactiver(fiche, controle.user.id)
      if (r instanceof NextResponse) return r
      suite = r
    } else {
      const r = await effacer(fiche, journal)
      if (r instanceof NextResponse) return r
      suite = r
    }

    const relue = await lireFicheQr(id)
    if (!relue.ok || !relue.valeur) return reponseErreur('a_reverifier', 409)
    const forme = await formePublique(relue.valeur)
    if (forme instanceof NextResponse) return forme
    // PR 2 : l'action de la PR 1 est faite, mais pas celle du compte relié (207, même bouton pour la relancer).
    return suite.incomplet ? NextResponse.json({ ...forme, error: suite.incomplet }, { status: 207 }) : NextResponse.json(forme)
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} modification d’un gestionnaire`, { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
