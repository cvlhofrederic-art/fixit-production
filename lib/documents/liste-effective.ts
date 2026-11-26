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

/**
 * Type d'un document, quel que soit le champ qui le porte. La mise en forme du tableau de bord pose `docType` ;
 * `type` ne subsiste que sur des documents plus anciens, et `lib/types.ts` le marque déprécié. N'en tester qu'un
 * seul est le défaut qui a laissé le CA par chantier inerte huit mois et « Devis récents » vide depuis toujours.
 *
 * Un AVOIR porte `docType: 'facture'` et `factureSubType: 'avoir'` depuis le 05/06/2026 (`docType: 'avoir'`
 * cassait la synchronisation) : il répond donc `true` à `estDuType(doc, 'facture')`, et c'est voulu — ses lignes
 * sont négatives, il se soustrait du chiffre d'affaires de lui-même.
 *
 * Vient de `lib/btp/accueil.ts`, qui l'importe désormais d'ici : la question n'a rien de propre au BTP.
 */
export const estDuType = (
  doc: { docType?: string | null; type?: string | null } | null | undefined,
  type: 'devis' | 'facture' | 'avoir',
): boolean => (doc?.docType ?? doc?.type) === type

/**
 * Annulé : « annule » (navigateur) ou « cancelled » (base). Les listes Devis et Factures masquent ces documents.
 * Vient aussi de `lib/btp/accueil.ts`.
 *
 * À ne pas confondre avec `estDocumentEmis`, qui GARDE les annulés : ce filtre-là reproduit celui qui remplit
 * `fixit_documents_` depuis la base, et le changer déplacerait des chiffres déjà affichés. Tout calcul qui ne doit
 * pas compter un document annulé le dit donc explicitement.
 */
export const estAnnule = (doc: { status?: string | null } | null | undefined): boolean =>
  doc?.status === 'annule' || doc?.status === 'cancelled'

/**
 * Devis gagné : signé électroniquement par le client, ou marqué « ✓ Accepté » depuis la liste des devis
 * (« accepte » dans le navigateur, « accepted » en base, « signe » sur des documents plus anciens).
 *
 * MÊME RÈGLE POUR TOUS LES RÔLES. La PR #838 n'avait ouvert « Accepté » qu'aux sociétés BTP, au motif d'un usage
 * qui leur serait propre — mais `DevisSection` est partagé : son bouton « ✓ Accepté » vit dans la branche V5
 * (`isV5 = isArtisan || isBtp`), écrit les mêmes statuts pour les deux rôles, et son filtre « Acceptés » range ces
 * statuts avec les signés pour les deux. Un artisan voyait son devis accepté dans sa liste et compté zéro dans ses
 * statistiques.
 */
export const estDevisSigne = (statut: string | null | undefined): boolean =>
  statut === 'signed' || statut === 'signe' || statut === 'accepte' || statut === 'accepted'

/** Devis refusé par le client : « refuse » (navigateur) ou « rejected » (base) — cf. DevisSection. */
export const estDevisRefuse = (statut: string | null | undefined): boolean =>
  statut === 'refuse' || statut === 'rejected'

/** Facture réglée. Le seul statut écrit est « paid » ; « payée » accentué n'existe nulle part dans le dépôt. */
export const estFacturePayee = (statut: string | null | undefined): boolean => statut === 'paid'

/**
 * Factures qui entrent dans un chiffre d'affaires : émises, non annulées, et **sans les avoirs devenus
 * orphelins**.
 *
 * Ce dernier point est la raison d'être de cette fonction, et il a coûté une régression de plus en relecture.
 * Écarter une facture annulée semble évident ; mais un avoir porte `docType: 'facture'` et des lignes NÉGATIVES,
 * et il n'est jamais « annulé » lui-même. Pour une facture annulée que son avoir avait soldée — le parcours normal
 * d'une annulation après paiement —, écarter le parent seul laisse donc la seule ligne négative : le chiffre
 * d'affaires du mois pouvait devenir NÉGATIF, et `totalBilled` tombant à 0 ou moins, le taux de recouvrement
 * sautait à 100 %. Avant qu'on écarte les annulées, parent (+X) et avoir (−X) se neutralisaient et le total était
 * juste : la correction naïve était donc une régression, chez les sociétés déjà en production.
 *
 * Un avoir dont le parent n'est PAS annulé reste compté : il doit continuer de se soustraire.
 */
export function facturesDuChiffreAffaires<T extends DocumentLisible & {
  docType?: string | null
  type?: string | null
  parentInvoiceNumber?: string | null
}>(documents: readonly T[] | undefined): T[] {
  const liste = documents || []
  const numerosAnnules = new Set(
    liste
      .filter((doc) => estDuType(doc, 'facture') && estAnnule(doc))
      .map((doc) => String(doc.docNumber || '').trim())
      .filter((numero) => numero !== ''),
  )
  return liste.filter((doc) => {
    if (!estDuType(doc, 'facture') || estAnnule(doc)) return false
    const parent = String(doc.parentInvoiceNumber || '').trim()
    return parent === '' || !numerosAnnules.has(parent)
  })
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
