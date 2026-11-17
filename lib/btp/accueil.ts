/**
 * Chiffres et alertes de l'accueil du tableau de bord BTP pro (pro_societe). Logique pure, sans React.
 *
 * Audit des fondations BTP du 11/11/2026 :
 * - le « CA total chantiers » additionnait des budgets livrés en TEXTE par useBTPData (« 15000 » + « 8000 » donnait
 *   150 008 000) ;
 * - la marge et les acomptes affichaient 0 pour toute société, les colonnes lues n'étant alimentées par aucun
 *   écran : l'absence de donnée se dit maintenant « — » au lieu d'un zéro trompeur ;
 * - les alertes lisaient une clé du navigateur que plus rien n'écrit (`fixit_docs_<id>`) : elles se calculent sur les
 *   documents réellement chargés par la page.
 * Relecture adverse du 14/11/2026 : les alertes lisent le statut des documents comme les listes Devis et Factures
 * (un brouillon ou une facture annulée ne vaut pas facture, un devis annulé ne vaut pas devis), un brouillon sans
 * numéro est nommé sans référence, et le retard d'un chantier se calcule à un seul endroit (`finDepassee`).
 * Lecture seule : rien ici n'écrit ni ne modifie un chantier ou un document.
 */

export interface ChantierAccueil {
  id: string
  titre?: string | null
  client?: string | null
  statut?: string | null
  /** Livré en texte par le hook (valeur de formulaire), en nombre par la base. */
  budget?: number | string | null
  montant_facture?: number | string | null
  acompte_recu?: number | string | null
  marge_prevue_pct?: number | string | null
  dateFin?: string | null
}

/** Un devis ou une facture tel qu'enregistré par les formulaires (`docType`) ou par d'anciens écrans (`type`). */
export interface DocumentAccueil {
  id?: string
  docType?: string
  type?: string
  status?: string
  clientName?: string
  client_name?: string
  client?: string
  docNumber?: string
  ref?: string
  number?: string
}

export interface ChiffresChantiers {
  /** Somme des chantiers non annulés : montant facturé s'il est renseigné, sinon budget. */
  caTotal: number
  /** Acomptes reçus, ou null si aucun chantier n'en porte. */
  acomptes: number | null
  /** Moyenne des marges prévues renseignées (arrondie), ou null si aucune ne l'est. */
  margeMoyenne: number | null
}

/** Nombre lu dans une valeur de base (nombre) ou de formulaire (texte, virgule acceptée) ; null si absent ou illisible. */
export function nombreOuNul(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = typeof valeur === 'number' ? valeur : Number.parseFloat(String(valeur).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function chiffresChantiers(chantiers: readonly ChantierAccueil[]): ChiffresChantiers {
  let caTotal = 0
  let acomptes = 0
  let sommeMarges = 0
  let nbMarges = 0
  for (const chantier of chantiers) {
    if (chantier.statut === 'Annulé') continue
    caTotal += nombreOuNul(chantier.montant_facture) || nombreOuNul(chantier.budget) || 0
    acomptes += nombreOuNul(chantier.acompte_recu) ?? 0
    const marge = nombreOuNul(chantier.marge_prevue_pct)
    if (marge !== null && marge !== 0) { sommeMarges += marge; nbMarges += 1 }
  }
  return {
    caTotal: Math.round(caTotal * 100) / 100,
    acomptes: acomptes === 0 ? null : Math.round(acomptes * 100) / 100,
    margeMoyenne: nbMarges === 0 ? null : Math.round(sommeMarges / nbMarges),
  }
}

/** Liste reçue de la page : elle vient en partie du navigateur et peut contenir une entrée qui n'est pas un document. */
export type DocumentsAccueil = ReadonlyArray<DocumentAccueil | null | undefined>

/** Les seules entrées exploitables : des objets. Une entrée nulle ou d'un autre type est ignorée, sans erreur. */
function documentsLisibles(documents: DocumentsAccueil): DocumentAccueil[] {
  return documents.filter((doc): doc is DocumentAccueil => typeof doc === 'object' && doc !== null)
}

const estDuType = (doc: DocumentAccueil, type: 'devis' | 'facture') => (doc.docType ?? doc.type) === type

/**
 * Jamais émis : statut vide, « brouillon » (navigateur) ou « draft » (base). C'est la lecture des listes Devis et
 * Factures, qui affichent « Brouillon » dans ces trois cas.
 */
const estBrouillon = (doc: DocumentAccueil) => ['', 'brouillon', 'draft'].includes(String(doc.status ?? ''))

/** Annulé : « annule » (navigateur) ou « cancelled » (base). Les listes Devis et Factures masquent ces documents. */
const estAnnule = (doc: DocumentAccueil) => doc.status === 'annule' || doc.status === 'cancelled'

/** Nom du client d'un document, sous la forme comparable (minuscules, sans espaces autour). */
export function clientDuDocument(doc: DocumentAccueil): string {
  return String(doc.clientName || doc.client_name || doc.client || '').toLowerCase().trim()
}

/** Jour local au format AAAA-MM-JJ (les dates de chantier sont saisies en jours, sans heure). */
export function jourLocal(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}

/**
 * Date de fin dépassée : strictement antérieure au jour local, le dernier jour d'un chantier n'étant pas un retard.
 * Seule règle de retard de l'accueil, pour l'alerte comme pour la ligne du tableau « Chantiers en cours ».
 * Une date absente ou qui n'est pas au format AAAA-MM-JJ n'est jamais dépassée.
 */
export function finDepassee(dateFin: string | null | undefined, maintenant: Date): boolean {
  const jour = String(dateFin ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) && jour < jourLocal(maintenant)
}

export interface AlertesChantiers {
  /** Date de fin dépassée (le dernier jour n'est pas en retard), ni terminé ni annulé. */
  enRetard: ChantierAccueil[]
  /** Terminés dont le client n'a aucune facture émise : un brouillon ou une facture annulée ne compte pas. */
  terminesSansFacture: ChantierAccueil[]
  /** Devis encore à l'état de brouillon (statut vide compris). */
  devisBrouillon: DocumentAccueil[]
}

export function alertesChantiers(
  chantiers: readonly ChantierAccueil[],
  documents: DocumentsAccueil,
  maintenant: Date,
): AlertesChantiers {
  const lisibles = documentsLisibles(documents)
  const enRetard = chantiers.filter(c => c.statut !== 'Terminé' && c.statut !== 'Annulé' && finDepassee(c.dateFin, maintenant))

  // Facturé = une facture émise et non annulée porte ce client. Une facture d'acompte ou un avoir comptent comme
  // une facture : règle inchangée, laissée à la décision du propriétaire.
  const clientsFactures = new Set(
    lisibles.filter(d => estDuType(d, 'facture') && !estBrouillon(d) && !estAnnule(d)).map(clientDuDocument).filter(Boolean),
  )
  const terminesSansFacture = chantiers.filter(c => {
    const client = String(c.client || '').toLowerCase().trim()
    return c.statut === 'Terminé' && client !== '' && !clientsFactures.has(client)
  })

  const devisBrouillon = lisibles.filter(d => estDuType(d, 'devis') && estBrouillon(d))
  return { enRetard, terminesSansFacture, devisBrouillon }
}

/** Clients (forme comparable) qui ont au moins un devis enregistré, brouillon compris ; un devis annulé ne compte pas. */
export function clientsAvecDevis(documents: DocumentsAccueil): Set<string> {
  return new Set(documentsLisibles(documents).filter(d => estDuType(d, 'devis') && !estAnnule(d)).map(clientDuDocument).filter(Boolean))
}

/**
 * Texte de l'alerte « devis en brouillon ». Un brouillon BTP n'a pas de numéro avant sa validation : sans numéro,
 * aucune référence n'est affichée (l'identifiant technique du document n'apparaît nulle part dans l'application).
 * Avec un numéro, par exemple le numéro provisoire d'un ancien brouillon, c'est celui que montre la liste des devis.
 */
export function libelleDevisBrouillon(doc: DocumentAccueil, portugais: boolean): string {
  const numero = String(doc.docNumber || doc.ref || doc.number || '').trim()
  const reference = numero === '' ? '' : ` ${numero}`
  const client = String(doc.clientName || doc.client || doc.client_name || '').trim()
  return portugais
    ? `Orçamento${reference} em rascunho, por enviar (${client || 'cliente'})`
    : `Devis${reference} en brouillon — à envoyer (${client || 'client'})`
}
