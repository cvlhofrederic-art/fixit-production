// ═══════════════════════════════════════════════════════════════════════════════
// FICHE DE LA SOCIÉTÉ POUR UN COMPTE INVITÉ (26/11/2026)
//
// « Mon profil », le logo, les modes de paiement et l'envoi de fichiers cherchaient la fiche `profiles_artisan` par
// `user_id = user.id`. Un compte invité dans une société BTP — co-gérant, secrétaire, salarié — n'a pas de fiche à
// lui : chaque enregistrement répondait 404, et les modes de paiement de la société n'arrivaient pas sur les devis
// qu'il imprimait.
//
// Ce module désigne, pour un SOUS-COMPTE seulement, la fiche de sa société et dit s'il a le droit demandé. Pour tout
// autre compte — artisan, gérant titulaire, super_admin, conciergerie, gestionnaire — il rend `null` : la route garde
// alors son chemin d'origine, octet pour octet (règle n° 1, le côté artisan n'est pas touché).
//
// Qui écrit la fiche de la société : le module `settings` en FULL, soit par défaut le co-gérant et la secrétaire
// (lib/permissions.ts). Le comptable et les salariés de terrain l'ont en lecture : « Mon profil » s'ouvre pour leur mot
// de passe, mais rien de ce qu'ils y tapent ne part sur la fiche de l'entreprise.
//
// Un sous-compte qui a SA PROPRE fiche (compte invité qui avait déjà un profil) garde le chemin d'origine : le tableau
// de bord lui affiche cette fiche-là (app/(commun)/pro/dashboard/page.tsx ne passe par la société que sans fiche), et
// écrire ce qu'il y voit sur la fiche de la société mélangerait deux entreprises.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/auth-helpers'
import { lirePerimetreBtp, niveauSur, type PerimetreBtp } from '@/lib/btp/perimetre-compte'
import { famillesLisibles, societeNonResolue } from '@/lib/btp/titulaire-documents'
import { messageRefusFr, type CodeRefusDocuments } from '@/lib/documents/messages-refus'
import { logger } from '@/lib/logger'

export type FicheDuSousCompte =
  | { ok: true; ficheId: string; fiche: Record<string, unknown>; perimetre: PerimetreBtp }
  | { ok: false; status: 403 | 409 | 500; code: CodeRefusDocuments; message: string }

/** Modifier la fiche de la société (nom, coordonnées, mentions légales, logo, modes de paiement) : settings en FULL. */
export function peutModifierFicheSociete(perimetre: PerimetreBtp): boolean {
  return niveauSur(perimetre, 'settings') === 'FULL'
}

/**
 * Lire les modes de paiement de la société (IBAN compris) : il les modifie, ou il imprime des devis ou des factures,
 * qui les portent. Un salarié de terrain n'a ni l'un ni l'autre : l'IBAN fait partie de l'identité légale qu'il
 * n'imprime jamais (ficheEnTeteSeulement, lib/btp/titulaire-documents.ts).
 */
export function peutLireModesPaiement(perimetre: PerimetreBtp): boolean {
  return peutModifierFicheSociete(perimetre) || famillesLisibles(perimetre).length > 0
}

function refus(status: 403 | 409 | 500, code: CodeRefusDocuments): FicheDuSousCompte {
  return { ok: false, status, code, message: messageRefusFr(code) }
}

/**
 * Fiche de la société d'un sous-compte, si son rôle lui donne le droit demandé ; `null` si le compte n'est pas un
 * sous-compte sans fiche à lui (la route garde alors son chemin d'origine).
 *
 * `colonnes` : ce que la route lit de la fiche (`id` suffit pour écrire ; `*` pour l'adresse publique).
 * `codeRefus` : motif rendu quand le rôle n'a pas le droit (par défaut : modifier la fiche).
 */
export async function ficheSocieteDuSousCompte(
  user: User,
  admin: SupabaseClient,
  droit: (perimetre: PerimetreBtp) => boolean,
  colonnes = 'id',
  codeRefus: CodeRefusDocuments = 'aucun_droit_fiche',
): Promise<FicheDuSousCompte | null> {
  const perimetre = await lirePerimetreBtp(user, admin)
  if (perimetre.titulaire) return null

  // Sa propre fiche d'abord : c'est elle que son tableau de bord affiche, et c'est elle que la route modifiait.
  const { data: siennes, error: erreurSiennes } = await admin
    .from('profiles_artisan').select('id').eq('user_id', user.id).limit(1)
  if (erreurSiennes) {
    logger.error('[fiche-societe] fiche du compte illisible', { error: erreurSiennes.message })
    return refus(500, 'lecture_impossible')
  }
  if ((siennes ?? []).length > 0) return null

  if (societeNonResolue(user, perimetre)) {
    logger.warn('[fiche-societe] rattachement annoncé mais société non résolue', { compte: user.id.slice(0, 8) })
    return refus(409, 'societe_non_resolue')
  }
  if (!droit(perimetre)) return refus(403, codeRefus)

  const { data, error } = await admin.from('profiles_artisan').select(colonnes).eq('user_id', perimetre.societeId)
  if (error) {
    logger.error('[fiche-societe] fiche de la société illisible', { error: error.message })
    return refus(500, 'lecture_impossible')
  }
  const fiches = (data ?? []) as unknown as Record<string, unknown>[]
  // `profiles_artisan.user_id` n'est pas unique : prendre « la première » écrirait sur une fiche arbitraire.
  if (fiches.length === 0) return refus(409, 'fiche_societe_absente')
  if (fiches.length > 1) return refus(409, 'fiche_societe_multiple')

  const fiche = fiches[0]
  const ficheId = typeof fiche.id === 'string' ? fiche.id : ''
  if (!ficheId) return refus(409, 'fiche_societe_absente')
  return { ok: true, ficheId, fiche, perimetre }
}

/**
 * Raccourci des routes : `null` pour tout compte qui garde son chemin d'origine (pas une société BTP, titulaire, ou
 * sous-compte qui a sa propre fiche), la fiche de la société si le rôle a le droit, sinon la réponse de refus à rendre
 * telle quelle (code et texte français ; l'écran traduit par le code).
 */
export async function ficheSocieteOuRefus(
  user: User,
  admin: SupabaseClient,
  droit: (perimetre: PerimetreBtp) => boolean,
  colonnes = 'id',
  codeRefus: CodeRefusDocuments = 'aucun_droit_fiche',
): Promise<Extract<FicheDuSousCompte, { ok: true }> | NextResponse | null> {
  if (getUserRole(user) !== 'pro_societe') return null
  const fiche = await ficheSocieteDuSousCompte(user, admin, droit, colonnes, codeRefus)
  if (!fiche) return null
  if (!fiche.ok) return NextResponse.json({ error: fiche.message, code: fiche.code }, { status: fiche.status })
  return fiche
}
