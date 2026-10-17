// Signalements de l'espace copropriétaire : envoi au syndic (POST /api/coproprietaire/signalement)
// et suivi par le copropriétaire (GET /api/coproprietaire/signalement?email=).
// Module sans React ; fetch est injectable pour les tests.

import type { CoproProfile } from '@/lib/copro-demo-data'

/** Longueur minimale de la description (même règle que la route et coproSignalementSchema). */
export const DESCRIPTION_MIN_SIGNALEMENT = 10

const URL_SIGNALEMENT = '/api/coproprietaire/signalement'

export type PrioriteSignalement = 'urgente' | 'normale' | 'planifiee'

/** Corps lu par la route (champs vides omis : la validation Zod refuse un e-mail vide). */
export interface SignalementAEnvoyer {
  description: string
  demandeurNom: string
  demandeurRole: 'coproprio'
  immeuble: string
  typeIntervention: string
  priorite: PrioriteSignalement
  estPartieCommune: boolean
  demandeurEmail?: string
  demandeurTelephone?: string
  batiment?: string
  etage?: string
  numLot?: string
  zoneSignalee?: string
  /** Fiche syndic_coproprios affichée (compte rattaché à plusieurs lots) : la route s'y rattache. */
  lot?: string
}

/** Signalement tel que renvoyé par le suivi (GET). */
export interface SignalementSuivi {
  id: string
  immeuble: string
  typeIntervention: string
  description: string
  priorite: string
  statut: string
  artisanAssigne: string
  estPartieCommune: boolean
  zoneSignalee: string
  createdAt: string
  updatedAt: string
}

export type CodeErreurSignalement = 'invalide' | 'trop_de_demandes' | 'serveur' | 'reseau'

export type ResultatEnvoiSignalement =
  | { ok: true; id: string | null }
  | { ok: false; code: CodeErreurSignalement }

export type ResultatSuiviSignalements =
  | { ok: true; signalements: SignalementSuivi[] }
  | { ok: false; code: CodeErreurSignalement | 'email_absent' }

type Fetch = typeof fetch

// Même contrôle que strictEmail (lib/validation.ts) : domaine avec extension.
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/

/** E-mail exploitable par la route (minuscules), ou null. */
export function emailSignalement(email: string | undefined | null): string | null {
  const propre = (email || '').trim().toLowerCase()
  return EMAIL_VALIDE.test(propre) ? propre : null
}

/** « 🔧 Plomberie (fuite…) » → « Plomberie (fuite…) » : le syndic reçoit le libellé sans pictogramme. */
export function typeSansPictogramme(type: string): string {
  const propre = type.trim()
  const [premier, ...reste] = propre.split(/\s+/)
  if (reste.length > 0 && !/[\p{L}\p{N}]/u.test(premier)) return reste.join(' ')
  return propre
}

function texte(valeur: string | undefined | null, max: number): string | undefined {
  const propre = (valeur || '').trim()
  return propre ? propre.slice(0, max) : undefined
}

/** Construit le corps du POST à partir du profil et du formulaire de l'écran Signalement. */
export function construireSignalement(p: {
  profile: Pick<CoproProfile, 'prenom' | 'nom' | 'email' | 'telephone' | 'immeuble' | 'batiment' | 'etage' | 'numLot'>
  type: string
  description: string
  priorite: PrioriteSignalement
  partieCommune: boolean
  zone: string
}): SignalementAEnvoyer {
  const { profile } = p
  const corps: SignalementAEnvoyer = {
    description: p.description.trim().slice(0, 5000),
    demandeurNom: `${profile.prenom || ''} ${profile.nom || ''}`.trim().slice(0, 200),
    demandeurRole: 'coproprio',
    immeuble: (profile.immeuble || '').trim().slice(0, 500),
    typeIntervention: typeSansPictogramme(p.type).slice(0, 100) || 'Autre',
    priorite: p.priorite,
    estPartieCommune: p.partieCommune,
  }
  const email = emailSignalement(profile.email)
  if (email) corps.demandeurEmail = email
  const optionnels: Array<[keyof SignalementAEnvoyer, string | undefined]> = [
    ['demandeurTelephone', texte(profile.telephone, 20)],
    ['batiment', texte(profile.batiment, 100)],
    ['etage', texte(profile.etage, 20)],
    ['numLot', texte(profile.numLot, 20)],
    ['zoneSignalee', p.partieCommune ? texte(p.zone, 200) : undefined],
  ]
  for (const [cle, valeur] of optionnels) {
    if (valeur) (corps as unknown as Record<string, unknown>)[cle] = valeur
  }
  return corps
}

function codeDepuisStatut(status: number): CodeErreurSignalement {
  if (status === 429) return 'trop_de_demandes'
  if (status >= 400 && status < 500) return 'invalide'
  return 'serveur'
}

/**
 * Envoie le signalement au syndic. Avec le jeton de session, la route rattache le signalement
 * au cabinet du compte connecté ; sans jeton, elle le rattache par le nom de l'immeuble.
 * Ne lève jamais : l'appelant affiche le message correspondant au code d'erreur.
 */
export async function envoyerSignalementCopro(
  corps: SignalementAEnvoyer,
  jeton: string | null,
  fetchImpl: Fetch = fetch,
): Promise<ResultatEnvoiSignalement> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (jeton) headers.Authorization = `Bearer ${jeton}`
  try {
    const res = await fetchImpl(URL_SIGNALEMENT, { method: 'POST', headers, body: JSON.stringify(corps) })
    if (!res.ok) return { ok: false, code: codeDepuisStatut(res.status) }
    const data = (await res.json().catch(() => null)) as { signalement?: { id?: string } } | null
    return { ok: true, id: data?.signalement?.id ?? null }
  } catch (e) {
    console.warn('[copro] envoi du signalement impossible', e)
    return { ok: false, code: 'reseau' }
  }
}

// ── Suivi ────────────────────────────────────────────────────────────────────
// La route limite les recherches par e-mail (5 par minute et par adresse IP) : la liste est gardée
// 30 s en mémoire, pour qu'un aller-retour entre les onglets ne relance pas la requête.

const MEMOIRE_MS = 30_000
const memoire = new Map<string, { a: number; signalements: SignalementSuivi[] }>()

/** Vide la mémoire du suivi (tests). */
export function oublierSuiviSignalements(): void {
  memoire.clear()
}

function chaine(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function normaliser(brut: Record<string, unknown>): SignalementSuivi {
  return {
    id: chaine(brut.id),
    immeuble: chaine(brut.immeuble),
    typeIntervention: chaine(brut.typeIntervention),
    description: chaine(brut.description),
    priorite: chaine(brut.priorite) || 'normale',
    statut: chaine(brut.statut) || 'en_attente',
    artisanAssigne: chaine(brut.artisanAssigne),
    estPartieCommune: brut.estPartieCommune === true,
    zoneSignalee: chaine(brut.zoneSignalee),
    createdAt: chaine(brut.createdAt),
    updatedAt: chaine(brut.updatedAt),
  }
}

/**
 * Signalements envoyés avec cet e-mail, du plus récent au plus ancien.
 * `forcer` ignore la mémoire (bouton « Actualiser », après un envoi).
 */
export async function chargerMesSignalements(
  email: string,
  options: { forcer?: boolean; fetchImpl?: Fetch; maintenant?: number } = {},
): Promise<ResultatSuiviSignalements> {
  const cle = emailSignalement(email)
  if (!cle) return { ok: false, code: 'email_absent' }
  const maintenant = options.maintenant ?? Date.now()
  const enMemoire = memoire.get(cle)
  if (!options.forcer && enMemoire && maintenant - enMemoire.a < MEMOIRE_MS) {
    return { ok: true, signalements: enMemoire.signalements }
  }
  try {
    const res = await (options.fetchImpl ?? fetch)(`${URL_SIGNALEMENT}?email=${encodeURIComponent(cle)}`)
    if (!res.ok) return { ok: false, code: codeDepuisStatut(res.status) }
    const data = (await res.json()) as { signalements?: unknown }
    const signalements = Array.isArray(data?.signalements)
      ? data.signalements.filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null).map(normaliser)
      : []
    memoire.set(cle, { a: maintenant, signalements })
    return { ok: true, signalements }
  } catch (e) {
    console.warn('[copro] suivi des signalements indisponible', e)
    return { ok: false, code: 'reseau' }
  }
}

/** Libellé du statut vu par le copropriétaire (statuts de syndic_signalements). */
export function libelleStatutSignalement(statut: string, artisanAssigne: string, langue: 'fr' | 'pt' = 'fr'): string {
  const artisan = artisanAssigne.trim()
  if (langue === 'pt') {
    switch (statut) {
      case 'acceptee': return artisan ? `Intervenção confiada a ${artisan}` : 'Intervenção confiada a um prestador'
      case 'en_cours': return artisan ? `Intervenção em curso — ${artisan}` : 'Intervenção em curso'
      case 'terminee': return 'Intervenção concluída'
      case 'annulee': return 'Cancelada pelo administrador'
      default: return 'Recebida pelo administrador'
    }
  }
  switch (statut) {
    case 'acceptee': return artisan ? `Mission confiée à ${artisan}` : 'Mission confiée à un prestataire'
    case 'en_cours': return artisan ? `Intervention en cours — ${artisan}` : 'Intervention en cours'
    case 'terminee': return 'Intervention terminée'
    case 'annulee': return 'Annulé par le syndic'
    default: return 'Reçu par le syndic'
  }
}
