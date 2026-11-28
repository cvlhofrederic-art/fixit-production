// ═══════════════════════════════════════════════════════════════════════════════
// OUTILLAGE ET VÉHICULES BTP — règles pures (26/11/2026), partagées par /api/btp/outillage et par l'écran.
//
// Demande de Frédéric : un répertoire des outils et véhicules de la société, et chaque vendredi le responsable de son
// chantier (encarregado) valide ce qui s'y trouve et ce qui manque.
//
// « Chaque vendredi » : une vérification compte pour la semaine qui commence le vendredi et finit le jeudi suivant.
// Le vendredi la vérification est à faire ; faite le lundi, elle vaut pour le vendredi qui précède (en retard), et
// non pour le vendredi suivant. Les dates sont celles du fuseau du téléphone (Portugal ou France).
// Aucun accès au réseau ni à la base ici.
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod'

export const TYPES_OUTIL = ['outil', 'vehicule'] as const
export type TypeOutil = typeof TYPES_OUTIL[number]

export const ETATS_OUTIL = ['ok', 'en_panne'] as const
export type EtatOutil = typeof ETATS_OUTIL[number]

/**
 * Catégories d'un outil (demande de Frédéric du 28/11/2026 : « ferramentas de mão, andaimes, etc., qu'on s'y retrouve
 * plus facilement »), dans l'ordre d'affichage. Un véhicule n'en a pas : les véhicules forment leur propre groupe.
 * Colonne `categorie` de la migration 20261128d ; la base n'en contrôle que la forme, la liste est ici (une catégorie
 * de plus ne demande pas de migration). Une valeur inconnue lue en base vaut « sans catégorie ».
 */
export const CATEGORIES_OUTIL = ['main', 'electroportatif', 'echafaudage', 'coffrage', 'machines', 'mesure', 'securite', 'autre'] as const
export type CategorieOutil = typeof CATEGORIES_OUTIL[number]

/** Groupe d'affichage : la catégorie d'un outil, `vehicule` pour un véhicule, `sans` pour un outil pas encore classé. */
export type GroupeOutil = CategorieOutil | 'vehicule' | 'sans'
export const ORDRE_GROUPES: readonly GroupeOutil[] = [...CATEGORIES_OUTIL, 'vehicule', 'sans']

/** Bornes reprises des contraintes de la migration 20261126 : la route refuse ce que la base refuserait. */
export const LIMITES_OUTIL = { nom: 120, reference: 80, notes: 500, quantiteMax: 999 } as const
export const LIMITES_VERIFICATION = { observations: 1000, remarque: 200, lignes: 500 } as const

/** Statut d'un chantier qui se vérifie : seuls les chantiers en cours ont un responsable sur place. */
export const STATUT_CHANTIER_VERIFIE = 'En cours'

// ── Formulaires reçus par la route ──────────────────────────────────────────

/** Texte facultatif : espaces retirés, vide = absent (null en base). */
const texteFacultatif = (max: number) => z.string().trim().max(max).nullish().transform(v => v || null)

export const outilSchema = z.object({
  type: z.enum(TYPES_OUTIL),
  /**
   * Catégorie d'un outil ; ignorée pour un véhicule (enregistrée vide). Absente (écran ouvert avant le 28/11/2026) :
   * inchangée à la modification, vide à la création.
   */
  categorie: z.enum(CATEGORIES_OUTIL).nullable().optional(),
  nom: z.string().trim().min(1).max(LIMITES_OUTIL.nom),
  reference: texteFacultatif(LIMITES_OUTIL.reference),
  quantite: z.number().int().min(1).max(LIMITES_OUTIL.quantiteMax),
  /** Chantier où se trouve l'outil ; null = au dépôt. */
  chantierId: z.string().uuid().nullable(),
  etat: z.enum(ETATS_OUTIL),
  notes: texteFacultatif(LIMITES_OUTIL.notes),
})
export type OutilSaisi = z.infer<typeof outilSchema>

export const ligneVerifieeSchema = z.object({
  outilId: z.string().uuid(),
  /** Nombre présent sur le chantier (0 = manquant) ; jamais plus que la quantité attendue (contrôlé par la route). */
  presents: z.number().int().min(0).max(LIMITES_OUTIL.quantiteMax),
  enPanne: z.boolean(),
  remarque: texteFacultatif(LIMITES_VERIFICATION.remarque),
})
export type LigneVerifieeSaisie = z.infer<typeof ligneVerifieeSchema>

/** Vérification envoyée par le responsable : une ligne par outil du chantier, et ce qu'il veut signaler en plus. */
export const verificationSchema = z.object({
  chantierId: z.string().uuid(),
  lignes: z.array(ligneVerifieeSchema).max(LIMITES_VERIFICATION.lignes),
  observations: texteFacultatif(LIMITES_VERIFICATION.observations),
})

// ── Ce que la route rend à l'écran ──────────────────────────────────────────

export interface OutilEcran {
  id: string
  type: TypeOutil
  /** Catégorie d'un outil ; toujours null pour un véhicule, et pour un outil pas encore classé. */
  categorie: CategorieOutil | null
  nom: string
  reference: string | null
  quantite: number
  chantierId: string | null
  etat: EtatOutil
  notes: string | null
  /** Date (AAAA-MM-JJ, UTC) d'arrivée à son emplacement actuel (chantier ou dépôt). */
  surPlaceDepuis: string
}

/** Une ligne de la liste vérifiée, figée au moment de la vérification. */
export interface LigneVerifiee {
  outilId: string
  nom: string
  type: TypeOutil
  reference: string | null
  attendus: number
  presents: number
  enPanne: boolean
  remarque: string | null
}

export interface VerificationEcran {
  id: string
  chantierId: string
  chantierTitre: string
  vendredi: string
  /** Instant de la validation (ISO). */
  le: string
  par: string
  lignes: LigneVerifiee[]
  manquants: number
  enPanne: number
  observations: string | null
}

/**
 * faite : vérifiée pour le vendredi en cours ; a_faire : c'est vendredi et elle ne l'est pas ; en_retard : le vendredi
 * est passé sans vérification ; prochaine : rien à vérifier avant le prochain vendredi (outils arrivés depuis) ;
 * sans_outils : aucun outil n'est enregistré sur ce chantier.
 */
export type EtatVerification = 'faite' | 'a_faire' | 'en_retard' | 'prochaine' | 'sans_outils'

/** Chantier à vérifier (en cours, et affecté au compte s'il n'a pas la gestion) : le compte peut le valider. */
export interface ChantierOutillage {
  id: string
  titre: string
  adresse: string
  etat: EtatVerification
  /** Dernière vérification du vendredi en cours, s'il y en a une. */
  derniere: VerificationEcran | null
}

export interface ContexteOutillage {
  /** Faux tant que la migration 20261126 n'est pas appliquée : l'écran l'explique et n'écrit rien. */
  disponible: boolean
  /** Gérant, ou compte en accès complet : tient le répertoire et voit tous les chantiers. */
  gestion: boolean
  /** Fiche employé du compte (même adresse e-mail que dans Équipes) : nécessaire au responsable qui n'a pas la gestion. */
  rattachement: 'relie' | 'aucun' | 'ambigu'
  aujourdhui: string
  /** Vendredi de la semaine en cours (AAAA-MM-JJ) : celui que la vérification du jour couvre. */
  vendredi: string
  chantiers: ChantierOutillage[]
  /** Gestion seulement : tous les chantiers de la société (où se trouve un outil, où l'envoyer) ; vide sinon. */
  lieux: Array<{ id: string; titre: string; statut: string }>
  outils: OutilEcran[]
  verifications: VerificationEcran[]
}

// ── Dates ──────────────────────────────────────────────────────────────────

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/
const JOUR_MS = 86_400_000

function versUtc(date: string): number {
  if (!FORMAT_DATE.test(date)) throw new RangeError(`date invalide : ${date}`)
  const [a, m, j] = date.split('-').map(Number)
  return Date.UTC(a, m - 1, j)
}

const versTexte = (instant: number) => new Date(instant).toISOString().slice(0, 10)

/** Le vendredi le plus récent, ce jour compris (AAAA-MM-JJ). */
export function vendrediDeReference(date: string): string {
  const instant = versUtc(date)
  const ecart = (new Date(instant).getUTCDay() - 5 + 7) % 7
  return versTexte(instant - ecart * JOUR_MS)
}

/** Date décalée de `jours` jours (AAAA-MM-JJ). */
export function decalerDate(date: string, jours: number): string {
  return versTexte(versUtc(date) + jours * JOUR_MS)
}

// ── Vérification ───────────────────────────────────────────────────────────

/**
 * État de la vérification d'un chantier pour la semaine du vendredi `vendredi`.
 * `outilsDuChantier` : ses outils non retirés ; « en retard » seulement si l'un d'eux y était déjà ce vendredi-là
 * (arrivé sur le chantier ce jour ou avant) : la première semaine, ou pour un outil déplacé depuis, rien n'est en retard.
 */
export function etatVerification(params: {
  aujourdhui: string
  vendredi: string
  faite: boolean
  outilsDuChantier: readonly Pick<OutilEcran, 'surPlaceDepuis'>[]
}): EtatVerification {
  const { aujourdhui, vendredi, faite, outilsDuChantier } = params
  if (faite) return 'faite'
  if (outilsDuChantier.length === 0) return 'sans_outils'
  if (aujourdhui === vendredi) return 'a_faire'
  return outilsDuChantier.some(o => o.surPlaceDepuis <= vendredi) ? 'en_retard' : 'prochaine'
}

export type RefusLignes = 'liste_changee' | 'quantite_invalide' | 'observations_requises'

/**
 * Lignes reçues confrontées aux outils actuellement sur le chantier : chaque outil une fois et une seule, aucun autre,
 * jamais plus de présents que la quantité attendue. Rend la liste figée à enregistrer, ou le motif du refus (la liste
 * a changé depuis que l'écran l'a chargée : il faut la recharger).
 */
export function lignesAEnregistrer(
  outils: readonly OutilEcran[],
  recues: readonly LigneVerifieeSaisie[],
  observations: string | null = null,
): { lignes: LigneVerifiee[]; manquants: number; enPanne: number } | { refus: RefusLignes } {
  // Chantier sans outil : la vérification n'a de sens que si elle signale quelque chose.
  if (outils.length === 0 && recues.length === 0 && !observations) return { refus: 'observations_requises' }
  const parId = new Map(outils.map(o => [o.id, o]))
  const vues = new Set<string>()
  const lignes: LigneVerifiee[] = []
  for (const recue of recues) {
    const outil = parId.get(recue.outilId)
    if (!outil || vues.has(recue.outilId)) return { refus: 'liste_changee' }
    if (recue.presents > outil.quantite) return { refus: 'quantite_invalide' }
    vues.add(recue.outilId)
    lignes.push({
      outilId: outil.id, nom: outil.nom, type: outil.type, reference: outil.reference,
      attendus: outil.quantite, presents: recue.presents, enPanne: recue.enPanne,
      remarque: recue.presents < outil.quantite || recue.enPanne ? recue.remarque : null,
    })
  }
  if (vues.size !== outils.length) return { refus: 'liste_changee' }
  return {
    lignes,
    manquants: lignes.filter(l => l.presents < l.attendus).length,
    enPanne: lignes.filter(l => l.enPanne).length,
  }
}

const dateDuJour = (instant: unknown): string | null => (typeof instant === 'string' && instant.length >= 10 ? instant.slice(0, 10) : null)

/** Ligne d'outillage_btp telle que lue en base, pour l'écran ; null si elle ne ressemble pas à un outil. */
export function outilPourEcran(ligne: Record<string, unknown>): OutilEcran | null {
  const { id, type, nom, quantite } = ligne
  if (typeof id !== 'string' || typeof nom !== 'string') return null
  if (!(TYPES_OUTIL as readonly unknown[]).includes(type)) return null
  const categorie = type === 'outil' && (CATEGORIES_OUTIL as readonly unknown[]).includes(ligne.categorie) ? ligne.categorie as CategorieOutil : null
  return {
    id,
    type: type as TypeOutil,
    categorie,
    nom,
    reference: typeof ligne.reference === 'string' && ligne.reference ? ligne.reference : null,
    quantite: typeof quantite === 'number' && quantite >= 1 ? quantite : 1,
    chantierId: typeof ligne.chantier_id === 'string' ? ligne.chantier_id : null,
    etat: ligne.etat === 'en_panne' ? 'en_panne' : 'ok',
    notes: typeof ligne.notes === 'string' && ligne.notes ? ligne.notes : null,
    surPlaceDepuis: dateDuJour(ligne.chantier_depuis) ?? dateDuJour(ligne.created_at) ?? '1970-01-01',
  }
}

// ── Catégories et recherche (écran) ─────────────────────────────────────────

export const groupeDe = (o: Pick<OutilEcran, 'type' | 'categorie'>): GroupeOutil =>
  (o.type === 'vehicule' ? 'vehicule' : o.categorie ?? 'sans')

/** Outils rangés par groupe (ordre de ORDRE_GROUPES, groupes vides omis), par nom dans chaque groupe. */
export function parGroupe<T extends Pick<OutilEcran, 'type' | 'categorie' | 'nom'>>(outils: readonly T[]): Array<{ groupe: GroupeOutil; outils: T[] }> {
  return ORDRE_GROUPES
    .map(groupe => ({ groupe, outils: outils.filter(o => groupeDe(o) === groupe).sort((a, b) => a.nom.localeCompare(b.nom, 'pt')) }))
    .filter(g => g.outils.length > 0)
}

/** Texte sans accents ni majuscules : « maquina » trouve « Máquina », « cofragem » trouve « COFRAGEM ». */
export const sansAccents = (texte: string): string => texte.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase()

/** Chaque mot de la recherche se trouve dans l'un des textes donnés (nom, référence, notes, catégorie…). */
export function correspondRecherche(recherche: string, textes: ReadonlyArray<string | null | undefined>): boolean {
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean)
  if (mots.length === 0) return true
  const dans = sansAccents(textes.filter(Boolean).join(' '))
  return mots.every(m => dans.includes(m))
}

function lignesFigees(brut: unknown): LigneVerifiee[] {
  if (!Array.isArray(brut)) return []
  return brut.flatMap((l): LigneVerifiee[] => {
    if (!l || typeof l !== 'object') return []
    const x = l as Record<string, unknown>
    if (typeof x.outilId !== 'string' || typeof x.nom !== 'string') return []
    return [{
      outilId: x.outilId,
      nom: x.nom,
      type: x.type === 'vehicule' ? 'vehicule' : 'outil',
      reference: typeof x.reference === 'string' ? x.reference : null,
      attendus: typeof x.attendus === 'number' ? x.attendus : 1,
      presents: typeof x.presents === 'number' ? x.presents : 0,
      enPanne: x.enPanne === true,
      remarque: typeof x.remarque === 'string' ? x.remarque : null,
    }]
  })
}

/** Ligne de verifications_outillage_btp telle que lue en base, pour l'écran ; null si elle est illisible. */
export function verificationPourEcran(ligne: Record<string, unknown>): VerificationEcran | null {
  const { id, chantier_id: chantierId, vendredi, created_at: le } = ligne
  if (typeof id !== 'string' || typeof chantierId !== 'string' || typeof vendredi !== 'string' || typeof le !== 'string') return null
  return {
    id,
    chantierId,
    chantierTitre: typeof ligne.chantier_titre === 'string' ? ligne.chantier_titre : '',
    vendredi: vendredi.slice(0, 10),
    le,
    par: typeof ligne.valide_par_nom === 'string' ? ligne.valide_par_nom : '',
    lignes: lignesFigees(ligne.lignes),
    manquants: typeof ligne.manquants === 'number' ? ligne.manquants : 0,
    enPanne: typeof ligne.en_panne === 'number' ? ligne.en_panne : 0,
    observations: typeof ligne.observations === 'string' && ligne.observations ? ligne.observations : null,
  }
}
