// app/api/aj-signalement/gestionnaires/[id]/export/route.ts
//
// GET (P1-R15) — export RGPD des données d'un gestionnaire (droit d'accès, demandé par le cabinet, responsable de
// traitement ; VitFix est sous-traitant) : fiche, envois (jamais le jeton), attributions, ses lignes du journal. Fichier
// JSON en pièce jointe, jamais en cache ; l'export lui-même est journalisé (gestionnaire.exporte). 10 par heure.

import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  TABLE_ATTRIBUTIONS_QR, TABLE_JOURNAL_QR, controlerAccesQr, estUuid, journaliserQr, reponseErreur, reponseErreurSqlQr,
} from '@/lib/aj-signalement/serveur'
import { COLONNES_JOURNAL_QR, envoiDepuisLigneQr, lireEnvoisQr, lireFicheQr } from '@/lib/aj-signalement/serveur-gestion'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`qr_gestionnaire_export_${ip}`, 10, 60_000))) return rateLimitResponse()
    const controle = await controlerAccesQr(request, { profils: ['super_admin'] })
    if (!controle.ok) return controle.reponse
    if (!(await checkRateLimit(`qr_gestionnaire_export_${controle.user.id}`, 10, 3_600_000))) return rateLimitResponse()

    const { id } = await params
    if (!estUuid(id)) return reponseErreur('introuvable', 404)
    const fiche = await lireFicheQr(id)
    if (!fiche.ok) return reponseErreurSqlQr(fiche.erreur, 'lecture du gestionnaire', { gestionnaire: id })
    const f = fiche.valeur
    if (!f) return reponseErreur('introuvable', 404)

    const [envois, attributions, journal] = await Promise.all([
      lireEnvoisQr([id]),
      supabaseAdmin.from(TABLE_ATTRIBUTIONS_QR).select('copropriete_id, origine, created_at').eq('gestionnaire_id', id),
      supabaseAdmin.from(TABLE_JOURNAL_QR).select(COLONNES_JOURNAL_QR).or(`gestionnaire_id.eq.${id},acteur_gestionnaire_id.eq.${id}`)
        .order('created_at', { ascending: true }),
    ])
    if (!envois.ok) return reponseErreurSqlQr(envois.erreur, 'export : envois', { gestionnaire: id })
    for (const r of [attributions, journal]) if (r.error) return reponseErreurSqlQr(r.error, 'export', { gestionnaire: id })

    await journaliserQr({ action: 'gestionnaire.exporte', cabinetId: f.cabinet_id, acteurId: controle.user.id, gestionnaireId: id })
    const contenu = {
      exporteLe: new Date().toISOString(),
      fiche: {
        id: f.id, cabinetId: f.cabinet_id, nom: f.nom, email: f.email, actif: f.actif === true, domaineForce: f.domaine_force === true,
        creeLe: f.created_at, adresseConfirmeeLe: f.adresse_confirmee_le, adresseContesteeLe: f.adresse_contestee_le,
        desactiveLe: f.desactive_le, pseudonymiseLe: f.pseudonymise_le,
      },
      envois: envois.valeur.map(envoiDepuisLigneQr),
      attributions: attributions.data ?? [],
      journal: journal.data ?? [],
    }
    const reponse = NextResponse.json(contenu)
    reponse.headers.set('Cache-Control', 'private, no-store')
    reponse.headers.set('Content-Disposition', `attachment; filename="gestionnaire-${id}.json"`)
    return reponse
  } catch (e: unknown) {
    logger.error('[AJ SIGNALEMENT] export d’un gestionnaire', { message: e instanceof Error ? e.name : 'inconnue' }, e)
    return reponseErreur('serveur', 500)
  }
}
