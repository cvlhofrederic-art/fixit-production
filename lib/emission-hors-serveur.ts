// Émission d'un devis ou d'une facture BTP (rôle pro_societe) quand le serveur ne donne pas de numéro ou que le
// navigateur ne peut plus rien enregistrer. Audit des fondations BTP du 11/11/2026 : constats documents-cycle-1,
// stockage-local-miroir-9 et documents-cycle-14.
//
// - Le numéro légal vient du serveur (route /api/doc-number, puis fonction next_doc_number), jamais d'un compteur du
//   navigateur : ce compteur, que le serveur ignore, pouvait donner le même numéro à deux factures. Sans numéro du
//   serveur, le document n'est pas émis (il reste un brouillon) et un message le dit.
// - La place dans le stockage du navigateur est vérifiée AVANT de demander un numéro au serveur : un stockage plein
//   faisait échouer l'enregistrement après coup, et le numéro consommé était perdu (trou dans la série).
//
// Utilisé par le formulaire BTP et par les émissions BTP en un clic (acompte, facture totale). Le formulaire artisan et
// les actions artisan n'appellent rien de ce fichier : leur comportement est inchangé.

/** Aucun numéro légal n'a pu être obtenu du serveur (route et fonction en échec, ou connexion coupée). */
export class NumerotationIndisponibleError extends Error {
  constructor() {
    super('Aucun numéro n\'a pu être obtenu du serveur')
    this.name = 'NumerotationIndisponibleError'
  }
}

/** Le stockage du navigateur ne peut pas recevoir le document (plein, ou inaccessible). */
export class StockageNavigateurPleinError extends Error {
  constructor() {
    super('Stockage du navigateur plein : le document ne peut pas y être enregistré')
    this.name = 'StockageNavigateurPleinError'
  }
}

/**
 * Numéro de gabarit, plus long que tout numéro réel (FACT-2026-012, AC-2026-0007…) : la place vérifiée avant de
 * demander le vrai numéro couvre donc le document tel qu'il sera écrit.
 */
const NUMERO_GABARIT = 'FACT-0000-0000000'

/** Clé de la sonde : hors du préfixe fixit_, donc jamais recopiée dans le miroir serveur ; retirée aussitôt écrite. */
const CLE_SONDE_PLACE = '__vitfix_sonde_place__'
/** Marge en caractères (horodatages, numéro réel d'une autre longueur que le gabarit). */
const MARGE_PLACE = 256

/**
 * Vrai si le stockage local peut remplacer la valeur de `cle` par `nouvelleValeur`. Seul l'agrandissement compte : un
 * navigateur plein accepte encore une réécriture qui ne l'agrandit pas. L'agrandissement est essayé sur une clé de
 * sonde, retirée aussitôt ; aucune clé de données n'est écrite ni supprimée. Ne lève jamais.
 */
export function placeSuffisante(cle: string, nouvelleValeur: string): boolean {
  try {
    const actuelle = localStorage.getItem(cle)
    // Une clé absente occupe, une fois écrite, son nom et sa valeur.
    const agrandissement = actuelle === null ? cle.length + nouvelleValeur.length : nouvelleValeur.length - actuelle.length
    if (agrandissement <= 0) return true
    localStorage.setItem(CLE_SONDE_PLACE, 'x'.repeat(agrandissement + MARGE_PLACE))
    localStorage.removeItem(CLE_SONDE_PLACE)
    return true
  } catch (erreur) {
    // Écriture refusée (QuotaExceededError) ou stockage bloqué : la sonde n'a pas pu être écrite.
    console.warn('[émission] place insuffisante dans le stockage du navigateur :', erreur)
    return false
  }
}

/**
 * Vrai si la liste des documents émis du navigateur (`cleDocs`) peut recevoir `document` une fois émis : numéro de
 * gabarit, statut et horodatages d'émission, en remplacement d'une entrée de même identifiant. À appeler AVANT de
 * demander le numéro au serveur. Ne lève jamais.
 */
export function placePourEmettre(cleDocs: string, document: Record<string, unknown>): boolean {
  let actuels: Array<Record<string, unknown>> = []
  try {
    const lus: unknown = JSON.parse(localStorage.getItem(cleDocs) || '[]')
    if (Array.isArray(lus)) actuels = lus.filter((d): d is Record<string, unknown> => d != null && typeof d === 'object')
  } catch (erreur) {
    // Liste illisible : la place est mesurée sur la seule valeur actuelle, comme une liste vide.
    console.warn('[émission] liste des documents émis illisible :', erreur)
  }
  const horodatage = new Date().toISOString()
  const essai = { ...document, docNumber: NUMERO_GABARIT, status: 'envoye', savedAt: horodatage, sentAt: horodatage }
  return placeSuffisante(cleDocs, JSON.stringify([...actuels.filter((d) => d.id !== document.id), essai]))
}

/** Document dont l'émission est arrêtée. */
export type DocumentArrete = 'facture' | 'devis' | 'acompte'
/** « validation » : bouton « Valider » du formulaire (le brouillon existe) ; « emission » : émission en un clic. */
export type CadreArret = 'validation' | 'emission'

const NON_FAIT: Record<CadreArret, Record<DocumentArrete, string>> = {
  validation: {
    facture: 'la facture n\'est pas validée',
    devis: 'le devis n\'est pas validé',
    acompte: 'la facture d\'acompte n\'est pas validée',
  },
  emission: {
    facture: 'la facture n\'est pas émise',
    devis: 'le devis n\'est pas émis',
    acompte: 'l\'acompte n\'est pas émis',
  },
}

/**
 * Message clair (français) quand l'émission est arrêtée avant d'avoir consommé un numéro : numéro introuvable sur le
 * serveur, ou stockage du navigateur plein. null pour toute autre erreur (l'appelant garde son message).
 */
export function messageEmissionArretee(erreur: unknown, document: DocumentArrete, cadre: CadreArret): string | null {
  const nonFait = NON_FAIT[cadre][document]
  if (erreur instanceof NumerotationIndisponibleError) {
    const suite = cadre === 'validation' ? `${nonFait} et reste en brouillon` : nonFait
    return `Aucun numéro n'a pu être obtenu du serveur (connexion ou serveur indisponible) : ${suite}. Réessayez quand la connexion sera rétablie.`
  }
  if (erreur instanceof StockageNavigateurPleinError) {
    return `Stockage du navigateur plein : ${nonFait} et aucun numéro n'a été utilisé. N'effacez pas les données du site : vos documents y sont enregistrés.`
  }
  return null
}
