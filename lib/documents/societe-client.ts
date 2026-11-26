// Côté navigateur : identité, documents et mutations de la société, pour un compte qui n'a pas de fiche à lui.
//
// Un salarié invité d'une société BTP ne peut pas lire lui-même ce qu'il lui faut, ni l'écrire : la RLS de
// `profiles_artisan` ne laisse passer la fiche de sa société que si elle est publique, et celle de `devis` /
// `factures` ne laisse passer que ses propres lignes — c'est-à-dire aucune. Pire, sur une écriture elle ne renvoie
// pas d'erreur : elle FILTRE, zéro ligne touchée, `error` à null, et l'écran annonce une réussite qui n'a pas eu
// lieu. Tout passe donc par le serveur, qui contrôle son rôle avant de répondre.
//
// Les trois fonctions rendent un résultat explicite : un échec n'est JAMAIS une liste vide ni un succès muet.

import { supabase } from '@/lib/supabase'
import { fetchDocumentsFromSupabase } from '@/lib/document-sync'

export interface TitulaireSociete {
  /** Compte sous lequel les documents de la société sont rangés (celui du gérant). */
  societeId: string
  /** Fiche `profiles_artisan` de la société : en-tête légal, gabarit du PDF, propriétaire des documents. */
  ficheId: string
  /** La fiche, secrets retirés par le serveur — réduite à l'en-tête d'écran si le compte ne voit aucun document. */
  fiche: Record<string, unknown>
  roleEquipe: string | null
  /** Familles de documents que ce compte peut voir ; vide pour un ouvrier ou un chef de chantier. */
  lisibles: Array<'devis' | 'factures'>
}

export type ResultatLecture<T> =
  | { ok: true; valeur: T }
  | { ok: false; message: string; code?: string }

const ECHEC_RESEAU = 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.'
const SESSION_EXPIREE = 'Session expirée. Reconnectez-vous.'

/** Jeton de la session courante, ou l'échec à rendre tel quel. */
async function jetonDeSession(): Promise<ResultatLecture<string>> {
  try {
    const { data } = await supabase.auth.getSession()
    const jeton = data.session?.access_token
    return jeton ? { ok: true, valeur: jeton } : { ok: false, message: SESSION_EXPIREE }
  } catch {
    return { ok: false, message: ECHEC_RESEAU }
  }
}

/** Appel authentifié ; rend le corps JSON, ou l'échec avec le code rendu par la route. */
async function appeler(
  chemin: string,
  corpsEnvoye?: Record<string, unknown>,
): Promise<ResultatLecture<Record<string, unknown>>> {
  const jeton = await jetonDeSession()
  if (!jeton.ok) return jeton

  try {
    const reponse = await fetch(chemin, {
      method: corpsEnvoye ? 'POST' : 'GET',
      headers: corpsEnvoye
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton.valeur}` }
        : { Authorization: `Bearer ${jeton.valeur}` },
      ...(corpsEnvoye ? { body: JSON.stringify(corpsEnvoye) } : {}),
    })
    const corps = (await reponse.json().catch(() => ({}))) as Record<string, unknown>
    if (!reponse.ok) {
      return {
        ok: false,
        message: typeof corps.error === 'string' ? corps.error : ECHEC_RESEAU,
        code: typeof corps.code === 'string' ? corps.code : undefined,
      }
    }
    return { ok: true, valeur: corps }
  } catch {
    return { ok: false, message: ECHEC_RESEAU }
  }
}

/** Identité de la société du compte connecté. */
export async function lireTitulaireSociete(): Promise<ResultatLecture<TitulaireSociete>> {
  const lu = await appeler('/api/pro/titulaire')
  if (!lu.ok) return lu

  const corps = lu.valeur
  const ficheId = typeof corps.ficheId === 'string' ? corps.ficheId : ''
  const societeId = typeof corps.societeId === 'string' ? corps.societeId : ''
  const fiche = corps.fiche && typeof corps.fiche === 'object' ? (corps.fiche as Record<string, unknown>) : null
  if (!ficheId || !societeId || !fiche) {
    return { ok: false, message: "La société n'a pas pu être identifiée. Réessayez dans un instant." }
  }

  const brutes = Array.isArray(corps.lisibles) ? corps.lisibles : []
  const lisibles = brutes.filter((f): f is 'devis' | 'factures' => f === 'devis' || f === 'factures')

  return {
    ok: true,
    valeur: {
      societeId,
      ficheId,
      fiche,
      roleEquipe: typeof corps.roleEquipe === 'string' ? corps.roleEquipe : null,
      lisibles,
    },
  }
}

/** Devis et factures de la société, mis en forme comme ceux que le navigateur lit pour un titulaire. */
export async function lireDocumentsSociete(): Promise<ResultatLecture<Record<string, unknown>[]>> {
  const lu = await appeler('/api/pro/documents')
  if (!lu.ok) return lu

  const lignes = (cle: string): Array<Record<string, unknown>> =>
    Array.isArray(lu.valeur[cle]) ? (lu.valeur[cle] as Array<Record<string, unknown>>) : []

  const documents = await fetchDocumentsFromSupabase({ devis: lignes('devis'), factures: lignes('factures') })
  return { ok: true, valeur: documents }
}

/**
 * Change l'état d'un document de la société : « payée » pour une facture, suppression d'un brouillon.
 *
 * Ces deux écritures étaient faites depuis le navigateur, où la RLS filtre sans renvoyer d'erreur : l'écran
 * annonçait « payée » avant que la facture ne redevienne impayée au rechargement.
 */
export async function changerEtatDocumentSociete(
  action: 'marquer_payee' | 'supprimer_brouillon',
  docType: 'devis' | 'facture',
  id: string,
): Promise<ResultatLecture<true>> {
  const envoye = await appeler('/api/pro/documents/etat', { action, docType, id })
  return envoye.ok ? { ok: true, valeur: true } : envoye
}

export interface DocumentsDesChantiers {
  /** Devis de la société, les plus récents d'abord, avec leur lieu d'intervention et leur chantier rattaché. */
  devis: Array<Record<string, unknown>>
  /** Factures de la société déjà rattachées à un chantier. */
  factures: Array<Record<string, unknown>>
}

/**
 * Devis et factures vus depuis l'écran Chantiers et la Météo (import d'une adresse, « Lier un devis »). Lus par le
 * serveur : la RLS ne rend à un compte invité aucune ligne de la société.
 */
export async function lireDocumentsDesChantiers(): Promise<ResultatLecture<DocumentsDesChantiers>> {
  const lu = await appeler('/api/pro/documents/chantiers')
  if (!lu.ok) return lu
  const liste = (cle: string) => (Array.isArray(lu.valeur[cle]) ? (lu.valeur[cle] as Array<Record<string, unknown>>) : [])
  return { ok: true, valeur: { devis: liste('devis'), factures: liste('factures') } }
}

/**
 * Lie un devis de la société à un chantier de la société. Depuis le navigateur, la RLS filtrait la mise à jour sans
 * erreur : l'écran annonçait la liaison et rien n'avait changé.
 */
export async function lierDevisAuChantierSociete(devisId: string, chantierId: string): Promise<ResultatLecture<true>> {
  const envoye = await appeler('/api/pro/documents/chantiers', { devisId, chantierId })
  return envoye.ok ? { ok: true, valeur: true } : envoye
}
