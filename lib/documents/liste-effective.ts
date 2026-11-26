// Quelle liste de documents un écran de synthèse doit-il lire ?
//
// LE PROBLÈME
// Les écrans de synthèse (statistiques, revenus, rentabilité, rapports) lisaient les devis et les factures
// directement dans le stockage du navigateur, sous `fixit_documents_<artisan.id>`. Pour le titulaire d'un compte
// c'est la bonne source : c'est là que ses documents vivent. Pour un salarié invité d'une société BTP, non — depuis
// le 25/11/2026 les documents qu'il voit sont ceux de la SOCIÉTÉ, lus par le serveur (/api/pro/documents) et tenus
// dans l'état du tableau de bord. Son propre stockage ne contient que ses brouillons à lui.
//
// Et ce stockage ne doit PAS être rempli pour lui : y recopier les documents de la société mettrait toute la
// comptabilité de l'entreprise dans son navigateur et dans son espace `user_storage`, et `/api/user/delete-account`
// lui refuserait l'effacement de son compte (RGPD art. 17) au nom de documents qui ne sont pas les siens.
//
// LE CHOIX
// La liste du tableau de bord si elle est fournie et non vide, le stockage du navigateur sinon. C'est déjà le choix
// de `PipelineSection` depuis longtemps, pour les deux côtés : ce module ne fait que le nommer une fois au lieu de
// le recopier dans chaque écran. Le repli garantit qu'un écran dont la prop n'est pas branchée, ou un écran monté
// avant que la liste arrive, se comporte exactement comme avant.

/**
 * Ce qu'un document porte d'utile ICI, et rien de plus : chaque écran lit ensuite ses propres champs.
 *
 * Pas de signature d'index : les écrans décrivent leurs documents par des types partiels à eux
 * (`LocalDoc`, `SavedDocument`, `DevisFactureRef`…), qui n'en ont aucune et ne satisferaient pas la contrainte.
 */
export interface DocumentLisible {
  docNumber?: string | null
  status?: string | null
}

/**
 * Numéro définitif : présent, et pas un numéro provisoire de brouillon (« BR-… »).
 *
 * Vient de `lib/facture-depuis-devis.ts`, qui l'importe désormais d'ici : ce module-ci n'a aucune dépendance, et
 * les écrans de synthèse n'ont pas à tirer `devis-totals` ni `tva-calculator` pour poser cette seule question.
 */
export const aNumeroDefinitif = (doc: { docNumber?: unknown }): boolean => {
  const numero = String(doc.docNumber || '').trim()
  return numero !== '' && !numero.toUpperCase().startsWith('BR-')
}

/**
 * Document ÉMIS, par opposition à un brouillon. Deux conditions, et les deux sont nécessaires.
 *
 * STATUT émis, au sens du filtre que le dépôt appelle canonique (`isEmittedDoc`, lib/document-sync.ts) : non vide,
 * ni « brouillon » (navigateur) ni « draft » (base). Ce filtre est celui qui REMPLIT `fixit_documents_` depuis la
 * base, donc le reproduire est la seule façon d'obtenir la même liste qu'avant. Il n'exige aucun numéro : `numero`
 * est NULLABLE en base depuis la migration 20260602, et une ligne émise sans numéro doit compter.
 *
 * NUMÉRO non provisoire : le tableau de bord attribue des « BR-… » aux brouillons de facture, et le bouton
 * « Marquer envoyée » de la liste les passe à « envoyé » SANS tirer de numéro légal. Au statut seul, un tel
 * brouillon entrerait dans le chiffre d'affaires en attente, le taux de recouvrement et le CA par chantier.
 */
export function estDocumentEmis(doc: DocumentLisible | null | undefined): boolean {
  if (!doc) return false
  const statut = typeof doc.status === 'string' ? doc.status : ''
  if (statut === '' || statut === 'brouillon' || statut === 'draft') return false
  // Un numéro absent est accepté (ligne émise sans numéro) ; un numéro « BR-… » ne l'est pas.
  const numero = String(doc.docNumber || '').trim()
  return numero === '' || !numero.toUpperCase().startsWith('BR-')
}

function lireCle<T>(cle: string): T[] {
  try {
    const brut = localStorage.getItem(cle)
    const valeur = brut ? JSON.parse(brut) : []
    return Array.isArray(valeur) ? (valeur as T[]) : []
  } catch {
    // Navigation privée, quota, ou JSON abîmé : une liste vide, jamais une exception qui démonterait l'écran.
    return []
  }
}

/**
 * Liste à lire par un écran de synthèse.
 *
 * `fournis` : la liste du tableau de bord (`savedDocuments`), qui contient déjà, pour un salarié, les documents de
 * la société. `idStockage` : l'identifiant sous lequel CE compte range ses documents dans le navigateur — pour un
 * salarié, son propre compte, et c'est voulu.
 *
 * `avecBrouillons` est obligatoire, et c'est délibéré : un écran qui compte des devis pour un taux de
 * transformation n'a pas le droit d'inclure les brouillons, alors qu'un sélecteur « lier à un document » doit les
 * proposer. Le défaut implicite aurait changé des chiffres sans que personne le voie.
 *
 * Quand il vaut `false`, le filtre s'applique AUX DEUX BRANCHES — la liste fournie comme le stockage. Un même
 * document doit recevoir une seule réponse : le filtrer d'un côté et le garder de l'autre faisait dépendre un
 * chiffre de l'état d'une prop, et comme la liste est remplie dès qu'un compte a un document, c'est la branche qui
 * écarte qui aurait gagné. Conséquence assumée : un brouillon à numéro provisoire qui traînait dans
 * `fixit_documents_` cesse de compter, ce qu'il n'aurait jamais dû faire.
 */
export function documentsPourSynthese<T extends DocumentLisible>(
  fournis: readonly T[] | undefined,
  idStockage: string | undefined,
  avecBrouillons: boolean,
): T[] {
  if (fournis && fournis.length > 0) {
    return avecBrouillons ? [...fournis] : fournis.filter(estDocumentEmis)
  }
  if (!idStockage) return []
  const emis = lireCle<T>(`fixit_documents_${idStockage}`)
  if (!avecBrouillons) return emis.filter(estDocumentEmis)
  return [...emis, ...lireCle<T>(`fixit_drafts_${idStockage}`)]
}
