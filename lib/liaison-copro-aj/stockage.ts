// ── Liaison de démonstration portail copropriétaire ↔ Administrateur judiciaire ─────────────────────────────────
//
// Le portail copropriétaire (vue super admin) et l'Administrateur judiciaire (AJ) tournent sur le même domaine et,
// pour une démonstration, dans le même navigateur : ils partagent ce stockage local. Ce que le copropriétaire fait
// sur le portail (signalement, message, vote par correspondance) arrive dans l'AJ ; ce que l'AJ répond (statut,
// message, avis d'affichage) revient sur le portail. Un autre onglet est prévenu par l'événement « storage », le même
// onglet par un événement dédié.
//
// Aucune donnée réelle : ces échanges ne concernent que les copropriétés de l'AJ (démonstration ou base locale du
// navigateur). Rien n'est envoyé au serveur. Module sans React ; le stockage est injectable pour les tests.

export const CLE_LIAISON_COPRO_AJ = 'vitfix.liaison.copro-aj'
export const EVENEMENT_LIAISON_COPRO_AJ = 'vitfix:liaison-copro-aj'

export type AuteurLiaison = 'coproprietaire' | 'administrateur'
export type StatutDemandeLiaison = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
export type PrioriteDemandeLiaison = 'urgente' | 'normale' | 'planifiee'
export type ChoixVoteLiaison = 'pour' | 'contre' | 'abstention'
export type ImportanceAvisLiaison = '' | 'Importante' | 'Urgente'

/** Message du fil d'une demande, écrit par le copropriétaire (portail) ou par le cabinet (AJ). */
export interface MessageLiaison {
  id: string
  auteur: AuteurLiaison
  /** Nom affiché : celui du copropriétaire, ou du cabinet. */
  nom: string
  texte: string
  /** Horodatage ISO. */
  date: string
}

/** Demande déposée depuis le portail, suivie par l'AJ (écran Doléances). */
export interface DemandeLiaison {
  id: string
  /** Code de la copropriété dans l'AJ (« LM »). */
  codeCopro: string
  /** Nom de la copropriété (« Résidence Le Méridien »), pour l'affichage côté AJ. */
  nomCopro: string
  coproprietaireId: string
  nomCoproprietaire: string
  /** Lot tel que l'AJ le libelle (« Lot 12 — Apt B3 »). */
  lot: string
  type: string
  description: string
  priorite: PrioriteDemandeLiaison
  partieCommune: boolean
  zone: string
  /** Horodatages ISO. */
  creeLe: string
  misAJourLe: string
  statut: StatutDemandeLiaison
  messages: MessageLiaison[]
  /** L'AJ a vu la demande et son dernier message (pastille de la cloche). */
  vueParAj: boolean
}

/** Vote par correspondance transmis depuis le portail (un par résolution et par copropriétaire, modifiable). */
export interface VoteLiaison {
  agId: string
  resolutionNumero: number
  codeCopro: string
  coproprietaireId: string
  nomCoproprietaire: string
  choix: ChoixVoteLiaison
  /** Horodatage ISO. */
  date: string
  vueParAj: boolean
}

/** Avis publié par l'AJ (tableau d'affichage), lu par les copropriétaires de la copropriété sur le portail. */
export interface AvisLiaison {
  id: string
  codeCopro: string
  nomCopro: string
  /** Rubrique de l'AJ (Convocation, Travaux, Finances…). */
  categorie: string
  importance: ImportanceAvisLiaison
  titre: string
  contenu: string
  /** Horodatage ISO. */
  date: string
}

export interface EtatLiaison {
  version: 1
  demandes: DemandeLiaison[]
  votes: VoteLiaison[]
  avis: AvisLiaison[]
}

type Stockage = Pick<Storage, 'getItem' | 'setItem'>

export const etatLiaisonVide = (): EtatLiaison => ({ version: 1, demandes: [], votes: [], avis: [] })

function stockageParDefaut(): Stockage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch (e) {
    // Accès refusé (navigation privée, stockage bloqué) : la liaison fonctionne sans mémoire.
    console.warn('[liaison copro-aj] stockage local inaccessible', e)
    return null
  }
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const tableau = <T>(v: unknown, garde: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(garde) : [])

const estMessage = (v: unknown): v is MessageLiaison =>
  estObjet(v) && typeof v.id === 'string' && (v.auteur === 'coproprietaire' || v.auteur === 'administrateur') &&
  typeof v.texte === 'string' && typeof v.date === 'string'

const estDemande = (v: unknown): v is DemandeLiaison =>
  estObjet(v) && typeof v.id === 'string' && typeof v.codeCopro === 'string' && typeof v.coproprietaireId === 'string' &&
  typeof v.statut === 'string' && Array.isArray(v.messages)

const estVote = (v: unknown): v is VoteLiaison =>
  estObjet(v) && typeof v.agId === 'string' && typeof v.resolutionNumero === 'number' &&
  typeof v.coproprietaireId === 'string' && (v.choix === 'pour' || v.choix === 'contre' || v.choix === 'abstention')

const estAvis = (v: unknown): v is AvisLiaison =>
  estObjet(v) && typeof v.id === 'string' && typeof v.codeCopro === 'string' && typeof v.titre === 'string'

/** État lu dans un texte JSON ; état vide si le texte est absent ou illisible. */
export function analyserLiaison(brut: string | null): EtatLiaison {
  if (!brut) return etatLiaisonVide()
  try {
    const donnees: unknown = JSON.parse(brut)
    if (!estObjet(donnees)) return etatLiaisonVide()
    return {
      version: 1,
      demandes: tableau(donnees.demandes, estDemande).map((d) => ({ ...d, messages: tableau(d.messages, estMessage) })),
      votes: tableau(donnees.votes, estVote),
      avis: tableau(donnees.avis, estAvis),
    }
  } catch (e) {
    console.warn('[liaison copro-aj] contenu illisible, ignoré', e)
    return etatLiaisonVide()
  }
}

export function lireLiaison(stockage: Stockage | null = stockageParDefaut()): EtatLiaison {
  if (!stockage) return etatLiaisonVide()
  try {
    return analyserLiaison(stockage.getItem(CLE_LIAISON_COPRO_AJ))
  } catch (e) {
    console.warn('[liaison copro-aj] lecture impossible', e)
    return etatLiaisonVide()
  }
}

/** Prévient les abonnés du même onglet (les autres onglets reçoivent l'événement « storage »). */
function prevenir(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new Event(EVENEMENT_LIAISON_COPRO_AJ))
}

export function ecrireLiaison(etat: EtatLiaison, stockage: Stockage | null = stockageParDefaut()): boolean {
  if (!stockage) return false
  try {
    stockage.setItem(CLE_LIAISON_COPRO_AJ, JSON.stringify(etat))
  } catch (e) {
    console.warn('[liaison copro-aj] écriture impossible', e)
    return false
  }
  prevenir()
  return true
}

/** Lecture, modification, écriture : `modifier` reçoit une copie et rend le nouvel état. */
export function modifierLiaison(modifier: (etat: EtatLiaison) => EtatLiaison, stockage: Stockage | null = stockageParDefaut()): EtatLiaison {
  const suivant = modifier(lireLiaison(stockage))
  ecrireLiaison(suivant, stockage)
  return suivant
}

/** Identifiant unique d'un élément de la liaison (« portail-… », « aj-… »). */
export function identifiantLiaison(prefixe: string): string {
  const aleatoire = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Date.now().toString(36)
  return `${prefixe}-${Date.now().toString(36)}-${aleatoire}`
}

// ── Actions du portail (copropriétaire) ──────────────────────────────────────────────────────────────────────────

export type SaisieDemandeLiaison = Pick<
  DemandeLiaison,
  'codeCopro' | 'nomCopro' | 'coproprietaireId' | 'nomCoproprietaire' | 'lot' | 'type' | 'description' | 'priorite' | 'partieCommune' | 'zone'
>

export function deposerDemande(saisie: SaisieDemandeLiaison, maintenant: Date = new Date(), stockage?: Stockage | null): DemandeLiaison {
  const date = maintenant.toISOString()
  const demande: DemandeLiaison = {
    ...saisie,
    // « sig-… » : le portail affiche le numéro de la demande sans ce préfixe (8 caractères).
    id: identifiantLiaison('sig'),
    creeLe: date,
    misAJourLe: date,
    statut: 'en_attente',
    messages: [],
    vueParAj: false,
  }
  modifierLiaison((etat) => ({ ...etat, demandes: [demande, ...etat.demandes] }), stockage)
  return demande
}

/**
 * Ajoute un message au fil d'une demande. Un message du copropriétaire remet la pastille « non lu » côté AJ ;
 * un message du cabinet la laisse vue. null si la demande n'existe plus.
 */
export function ajouterMessage(
  demandeId: string,
  message: Pick<MessageLiaison, 'auteur' | 'nom' | 'texte'>,
  maintenant: Date = new Date(),
  stockage?: Stockage | null,
): MessageLiaison | null {
  const date = maintenant.toISOString()
  const nouveau: MessageLiaison = { ...message, id: identifiantLiaison('message'), date }
  let trouve = false
  modifierLiaison((etat) => ({
    ...etat,
    demandes: etat.demandes.map((d) => {
      if (d.id !== demandeId) return d
      trouve = true
      return { ...d, messages: [...d.messages, nouveau], misAJourLe: date, vueParAj: message.auteur === 'administrateur' }
    }),
  }), stockage)
  return trouve ? nouveau : null
}

/** Statut d'une demande, changé par l'AJ (prise en charge, résolution). */
export function changerStatutDemande(demandeId: string, statut: StatutDemandeLiaison, maintenant: Date = new Date(), stockage?: Stockage | null): void {
  const date = maintenant.toISOString()
  modifierLiaison((etat) => ({
    ...etat,
    demandes: etat.demandes.map((d) => (d.id === demandeId ? { ...d, statut, misAJourLe: date, vueParAj: true } : d)),
  }), stockage)
}

/** Vote par correspondance : remplace le vote précédent du même copropriétaire sur la même résolution. */
export function enregistrerVote(vote: Omit<VoteLiaison, 'date' | 'vueParAj'>, maintenant: Date = new Date(), stockage?: Stockage | null): VoteLiaison {
  const enregistre: VoteLiaison = { ...vote, date: maintenant.toISOString(), vueParAj: false }
  const meme = (v: VoteLiaison) =>
    v.agId === vote.agId && v.resolutionNumero === vote.resolutionNumero && v.coproprietaireId === vote.coproprietaireId
  modifierLiaison((etat) => ({ ...etat, votes: [enregistre, ...etat.votes.filter((v) => !meme(v))] }), stockage)
  return enregistre
}

// ── Actions de l'AJ ──────────────────────────────────────────────────────────────────────────────────────────────

export function publierAvis(avis: Omit<AvisLiaison, 'id' | 'date'>, maintenant: Date = new Date(), stockage?: Stockage | null): AvisLiaison {
  const publie: AvisLiaison = { ...avis, id: identifiantLiaison('aj-avis'), date: maintenant.toISOString() }
  modifierLiaison((etat) => ({ ...etat, avis: [publie, ...etat.avis] }), stockage)
  return publie
}

/** Marque vus par l'AJ les demandes et votes reçus (ouverture de la cloche ou de l'écran Doléances). */
export function marquerVuParAj(stockage?: Stockage | null): void {
  const etat = lireLiaison(stockage ?? stockageParDefaut())
  if (etat.demandes.every((d) => d.vueParAj) && etat.votes.every((v) => v.vueParAj)) return
  modifierLiaison((e) => ({
    ...e,
    demandes: e.demandes.map((d) => (d.vueParAj ? d : { ...d, vueParAj: true })),
    votes: e.votes.map((v) => (v.vueParAj ? v : { ...v, vueParAj: true })),
  }), stockage)
}

/** Marque vue par l'AJ une demande (ouverture de sa fiche dans l'écran Doléances). */
export function marquerDemandeVue(demandeId: string, stockage?: Stockage | null): void {
  const etat = lireLiaison(stockage ?? stockageParDefaut())
  if (!etat.demandes.some((d) => d.id === demandeId && !d.vueParAj)) return
  modifierLiaison((e) => ({ ...e, demandes: e.demandes.map((d) => (d.id === demandeId ? { ...d, vueParAj: true } : d)) }), stockage)
}

/**
 * Marque vu l'échange d'une notification de la cloche (identifiant de vues-aj.notificationsLiaison :
 * « liaison:demande:<id>:… » ou « liaison:vote:<ag>|<n°>|<personne>:… »).
 */
export function marquerNotificationLiaisonVue(id: string, stockage?: Stockage | null): void {
  const [prefixe, nature, cle] = id.split(':')
  if (prefixe !== 'liaison' || !cle) return
  if (nature === 'demande') {
    marquerDemandeVue(cle, stockage)
    return
  }
  if (nature !== 'vote') return
  const [agId, numero, personne] = cle.split('|')
  modifierLiaison((e) => ({
    ...e,
    votes: e.votes.map((v) =>
      v.agId === agId && String(v.resolutionNumero) === numero && v.coproprietaireId === personne ? { ...v, vueParAj: true } : v,
    ),
  }), stockage)
}

/** Efface toute la liaison (remise à zéro de la démonstration). */
export function effacerLiaison(stockage?: Stockage | null): void {
  ecrireLiaison(etatLiaisonVide(), stockage ?? stockageParDefaut())
}

// ── Abonnement ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Appelle `rappel` à chaque changement de la liaison (cet onglet ou un autre). Rend la fonction de désabonnement. */
export function abonnerLiaison(rappel: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE_LIAISON_COPRO_AJ || e.key === null) rappel()
  }
  window.addEventListener('storage', surStockage)
  window.addEventListener(EVENEMENT_LIAISON_COPRO_AJ, rappel)
  return () => {
    window.removeEventListener('storage', surStockage)
    window.removeEventListener(EVENEMENT_LIAISON_COPRO_AJ, rappel)
  }
}
