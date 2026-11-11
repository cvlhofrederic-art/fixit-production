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

const estDuType = (doc: DocumentAccueil, type: 'devis' | 'facture') => (doc.docType ?? doc.type) === type

/** Nom du client d'un document, sous la forme comparable (minuscules, sans espaces autour). */
export function clientDuDocument(doc: DocumentAccueil): string {
  return (doc.clientName || doc.client_name || doc.client || '').toLowerCase().trim()
}

/** Jour local au format AAAA-MM-JJ (les dates de chantier sont saisies en jours, sans heure). */
export function jourLocal(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}

export interface AlertesChantiers {
  /** Date de fin dépassée (le dernier jour n'est pas en retard), ni terminé ni annulé. */
  enRetard: ChantierAccueil[]
  /** Terminés dont le client n'a aucune facture enregistrée. */
  terminesSansFacture: ChantierAccueil[]
  /** Devis encore à l'état de brouillon. */
  devisBrouillon: DocumentAccueil[]
}

export function alertesChantiers(
  chantiers: readonly ChantierAccueil[],
  documents: readonly DocumentAccueil[],
  maintenant: Date,
): AlertesChantiers {
  const aujourdHui = jourLocal(maintenant)
  const enRetard = chantiers.filter(c =>
    !!c.dateFin && c.statut !== 'Terminé' && c.statut !== 'Annulé' && String(c.dateFin).slice(0, 10) < aujourdHui)

  const clientsFactures = new Set(documents.filter(d => estDuType(d, 'facture')).map(clientDuDocument).filter(Boolean))
  const terminesSansFacture = chantiers.filter(c => {
    const client = (c.client || '').toLowerCase().trim()
    return c.statut === 'Terminé' && client !== '' && !clientsFactures.has(client)
  })

  const devisBrouillon = documents.filter(d => estDuType(d, 'devis') && (d.status === 'brouillon' || d.status === 'draft'))
  return { enRetard, terminesSansFacture, devisBrouillon }
}

/** Clients (forme comparable) qui ont au moins un devis enregistré, brouillon compris. */
export function clientsAvecDevis(documents: readonly DocumentAccueil[]): Set<string> {
  return new Set(documents.filter(d => estDuType(d, 'devis')).map(clientDuDocument).filter(Boolean))
}
