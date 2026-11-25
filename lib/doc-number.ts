// Numérotation légale partagée (art. 242 nonies A I 2° CGI : séquence continue,
// sans rupture). Extrait de DevisFactureFormBTP pour réutilisation par le flux
// « Émettre l'acompte » (FacturesSection). Le form garde sa propre copie liée à
// son état — GARDER LES DEUX ALIGNÉS (même format, même API /api/doc-number).

import { supabase } from '@/lib/supabase'
import { NumerotationIndisponibleError } from '@/lib/emission-hors-serveur'
import { prefixeSerie } from '@/lib/numerotation-prefixes'

export type DocSeriesType = 'devis' | 'facture' | 'avoir' | 'acompte'

export interface OptionsNumerotation {
  /**
   * false (émissions des sociétés BTP) : sans réponse du serveur, aucun numéro n'est tiré du compteur du navigateur,
   * que le serveur ignore ; l'appel échoue avec NumerotationIndisponibleError et rien n'est émis. Par défaut (true) :
   * repli local d'origine des artisans.
   */
  repliLocal?: boolean
  /**
   * Repli local d'un artisan dont la fiche est en portugais (fichePortugaise) : mêmes préfixes que le serveur (ORC-,
   * FT-, FA-, NC-, migration 20261122b), au lieu de DEV-, FACT-, AC-, AV-.
   */
  portugais?: boolean
  /**
   * Compte titulaire de la SÉRIE, quand il diffère du compte connecté : celui de la société pour un salarié
   * invité (`artisan.user_id`). Sans lui, le repli RPC tirait un numéro de la série du salarié — une seconde
   * série ouverte en silence à côté de celle du gérant, ce que l'art. 242 nonies A I 2° du CGI interdit.
   * La route /api/doc-number, elle, résout la société côté serveur et ignore tout ce que le client propose.
   */
  uidSerie?: string
}

/**
 * Compteur localStorage — DERNIER recours (peut diverger entre devices).
 * Séries dédiées par type : DEV- (devis), FACT- (facture), AC- (acompte), AV- (avoir). Le serveur (next_doc_number) donne
 * ORC-, FT-, FA- et NC- à un compte dont une fiche est en portugais (migration 20261122b) ; ce repli, qui ne sert qu'aux
 * artisans, fait de même quand portugais est vrai (lib/numerotation-prefixes).
 */
export function localFallbackDocNumber(artisanId: string | undefined, docType: DocSeriesType, portugais = false): string {
  const year = new Date().getFullYear()
  const prefix = prefixeSerie(docType, portugais)
  try {
    const docs = JSON.parse(localStorage.getItem(`fixit_documents_${artisanId}`) || '[]')
    const drafts = JSON.parse(localStorage.getItem(`fixit_drafts_${artisanId}`) || '[]')
    const all = [...docs, ...drafts]
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)
    const maxSeq = all
      .map((d: { docNumber?: string }) => d.docNumber?.match(pattern)?.[1])
      .filter(Boolean)
      .map(Number)
      .reduce((a: number, b: number) => Math.max(a, b), 0)
    return `${prefix}-${year}-${String(maxSeq + 1).padStart(3, '0')}`
  } catch {
    return `${prefix}-${year}-001`
  }
}

/**
 * Prochain numéro légal via la séquence atomique serveur. 3 niveaux de fallback :
 *   1. API HTTP /api/doc-number (rate limit + auth Bearer)
 *   2. RPC Supabase next_doc_number (SECURITY DEFINER)
 *   3. Compteur localStorage (dernier recours) — sauf avec { repliLocal: false } (sociétés BTP) : l'appel échoue
 *      alors avec NumerotationIndisponibleError.
 * Ne renvoie JAMAIS de chaîne vide (un acompte émis a toujours un numéro légal).
 */
export async function fetchNextDocNumber(
  docType: DocSeriesType,
  artisanId: string | undefined,
  options: OptionsNumerotation = {},
): Promise<string> {
  const year = new Date().getFullYear()

  // Session récupérée UNE fois : l'access_token sert à l'API, l'uid d'auth
  // (session.user.id) au RPC. ⚠️ next_doc_number (SECURITY DEFINER) exige
  // auth.uid() = p_artisan_user_id : il faut donc l'UID D'AUTH, pas l'id PROFIL
  // `artisanId` (qui ne sert qu'à la clé localStorage). L'ancien code passait
  // `artisanId` → 'unauthorized' systématique → fallback local → collisions de
  // numéro selon l'ordinateur (cause racine du bug « doc qui disparaît »).
  let session: { access_token?: string; user?: { id?: string } } | null = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch { /* pas de session → on dégrade vers le fallback local */ }

  // 1) API HTTP avec Bearer token (source autoritaire : le serveur lit auth.uid)
  //
  // Un refus de la route (403 rôle insuffisant, 409 société non résolue) est DÉFINITIF : le RPC ci-dessous
  // n'inspecte aucun rôle et incrémenterait quand même le compteur de la société — un numéro consommé pour un
  // document qui ne sera jamais enregistré, donc un trou dans la série légale du gérant. Le refus est donc retenu
  // ici et relancé après le `try` (une exception levée dedans serait avalée par son `catch`).
  let refuseParLeServeur = false
  try {
    const authHeader: Record<string, string> = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}
    const res = await fetch('/api/doc-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ docType, year }),
    })
    if (res.ok) {
      const { number } = await res.json()
      if (number) return String(number)
    }
    if (res.status === 403 || res.status === 409) refuseParLeServeur = true
  } catch { /* fallthrough */ }

  if (refuseParLeServeur) throw new NumerotationIndisponibleError()

  // 2) RPC Supabase direct — AVEC L'UID D'AUTH (session.user.id), pas l'id profil
  try {
    const authUid = options.uidSerie || session?.user?.id
    if (authUid) {
      const { data, error } = await supabase.rpc('next_doc_number', {
        p_artisan_user_id: authUid,
        p_doc_type: docType,
        p_year: year,
      })
      if (!error && data) return String(data)
    }
  } catch { /* fallthrough */ }

  // 3) Fallback localStorage (clé = id profil `artisanId`). Société BTP : pas de numéro du navigateur.
  if (options.repliLocal === false) throw new NumerotationIndisponibleError()
  return localFallbackDocNumber(artisanId, docType, options.portugais === true)
}
