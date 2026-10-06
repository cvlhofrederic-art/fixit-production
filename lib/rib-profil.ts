// RIB courant du profil, pour les documents BTP émis sans passer par le formulaire.
//
// Le formulaire BTP écrit dans chaque document le RIB du profil au moment de l'enregistrement
// (DevisFactureFormBTP.buildPayload). Une facture ou un acompte émis en un clic depuis un devis
// recopierait sinon le RIB figé dans ce devis : après un changement de banque, le client
// paierait sur l'ancien compte. Même source que le formulaire : /api/artisan-payment-info,
// premier mode « virement » actif avec IBAN.

import { supabase } from '@/lib/supabase'

export interface RibProfil {
  iban: string
  bic: string
}

async function lireRibProfil(signal: AbortSignal): Promise<RibProfil | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token || signal.aborted) return null
    const reponse = await fetch('/api/artisan-payment-info', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal,
    })
    if (!reponse.ok) return null
    const donnees = await reponse.json() as { paiement_modes?: Array<{ type?: string; iban?: string; bic?: string; actif?: boolean }> }
    const virement = (donnees.paiement_modes || []).find(
      (m) => m.type === 'virement' && m.actif !== false && (m.iban || '').trim().length > 0,
    )
    return virement ? { iban: (virement.iban || '').trim(), bic: (virement.bic || '').trim() } : null
  } catch (erreur) {
    console.warn('[rib-profil] lecture du RIB impossible', erreur)
    return null
  }
}

/**
 * RIB courant du profil, ou null s'il n'a pas pu être lu (hors ligne, aucun virement, délai
 * dépassé). Le délai borne toute la lecture, session comprise : l'émission n'attend jamais plus.
 */
export async function chargerRibProfil(delaiMs = 4000): Promise<RibProfil | null> {
  const controleur = new AbortController()
  let minuterie: ReturnType<typeof setTimeout> | undefined
  const delai = new Promise<null>((resolve) => {
    minuterie = setTimeout(() => { controleur.abort(); resolve(null) }, delaiMs)
  })
  try {
    return await Promise.race([lireRibProfil(controleur.signal), delai])
  } finally {
    clearTimeout(minuterie)
  }
}

/**
 * Pose le RIB courant sur un document prêt à émettre. S'il n'a pas pu être lu, le RIB hérité du
 * devis est retiré : le téléchargement du PDF relit alors le profil (download-saved-devis).
 */
export function appliquerRibCourant<T extends Record<string, unknown>>(doc: T, rib: RibProfil | null): T {
  const { iban: _iban, bic: _bic, ...reste } = doc
  return (rib?.iban ? { ...reste, iban: rib.iban, bic: rib.bic } : reste) as T
}
