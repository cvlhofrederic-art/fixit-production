// Chiffre d'affaires FACTURÉ, chantier par chantier, d'après les devis et factures chargés par le tableau de bord.
//
// POURQUOI CE MODULE
// Le calcul vivait dans `components/dashboard/RentabiliteChantierSection.tsx`, en une ligne de `filter`, et il
// était INERTE depuis la création de l'écran, le 28/03/2026 : il interrogeait `d.type` quand la mise en forme du
// tableau de bord ne pose que `docType`, et `d.status === 'signé'` accentué, qui n'est aucun des statuts écrits.
// Le CA de chaque chantier ne venait donc que des situations de travaux et du budget saisi. Personne ne l'avait vu
// parce qu'aucun test ne couvrait ce calcul.
//
// Sorti ici pour être prouvable : monter l'écran demande de simuler cinq routes `/api/btp`, alors que la question
// est arithmétique. Le reste de `lib/rentabilite/` suit déjà cette forme (charges, engine, repartition).
//
// DEUX CHOIX DE FOND, PRIS LE 26/11/2026
//
// 1. SEULES LES FACTURES COMPTENT, pas les devis gagnés. L'écran annonce « X € CA » et, en portugais,
//    « X € faturados » — littéralement « facturés ». Un devis signé de 50 000 € sans aucune facture ne doit donc
//    pas y figurer : il dirait au gérant qu'il a facturé ce qu'il n'a pas encore facturé, et la carte
//    « Ce chantier t'a rapporté… » calculerait un bénéfice sur de l'argent qui n'est pas dû. Le montant prévu a
//    déjà sa place : le budget du chantier, troisième terme du `Math.max` de l'appelant.
//
// 2. UN DOCUMENT N'EST IMPUTÉ QU'À UN SEUL CHANTIER, ou à aucun. C'est la raison d'être de la signature de
//    `caParChantier`, qui reçoit TOUS les chantiers d'un coup au lieu d'être appelée chantier par chantier.
//    Le rattachement se fait par `chantierId` quand le document en porte un ; sinon par le nom du client, mais
//    seulement si ce client n'a qu'un chantier. Un client qui en a deux — un promoteur, un syndic, une SCI : le
//    quotidien d'une société BTP — verrait sinon la MÊME facture comptée en entier sur chacun. Ce n'est pas une
//    imprécision locale : l'appelant somme ces montants dans son indicateur global (`caTotalPeriode`) et s'en sert
//    pour répartir les charges fixes au prorata du CA. Une facture de 20 000 € affichée sur deux chantiers donnerait
//    40 000 € de CA total et fausserait la rentabilité des deux.
//
// Conséquence assumée du point 2 : `DevisFactureFormBTP` ne pose jamais `chantierId` (seul `linkDevis` le fait, et
// sur les devis), donc une société dont un client a plusieurs chantiers gardera des CA à 0 € tant que ses factures
// ne seront pas rattachées. Mieux vaut un zéro franc qu'un chiffre faux, et le manque est signalé par
// `clientsAmbigus`, que l'appelant peut afficher.

import { estDocumentEmis, facturesDuChiffreAffaires } from '@/lib/documents/liste-effective'
import { docRevenueHT } from '@/lib/stats-doc-total'

/** Ce qu'un document doit porter pour entrer dans ce calcul. Les écrans en savent plus ; ici, rien d'autre ne sert. */
export interface DocumentDeChantier {
  clientName?: string
  status?: string
  docNumber?: string
  docType?: string
  type?: string
  /** Numéro de la facture qu'un avoir solde. Sert à ne pas laisser un avoir orphelin dans le chiffre d'affaires. */
  parentInvoiceNumber?: string | null
  /** Rattachement explicite (colonne `chantier_id` en base, `chantierId` dans le navigateur). Souvent absent. */
  chantierId?: string | null
}

/** Un chantier : son identifiant, et le nom du client tel que sa fiche le porte. */
export interface ChantierCible {
  id: string
  client?: string
}

export interface CaParChantier {
  /** CA facturé par identifiant de chantier. Un chantier sans facture rattachée n'y figure pas. */
  parChantier: ReadonlyMap<string, number>
  /**
   * Clients qui ont plusieurs chantiers ET au moins un document non rattaché : leur CA n'a pu être imputé à aucun
   * chantier, faute de savoir lequel. De quoi le dire à l'écran plutôt que d'afficher un zéro muet.
   */
  clientsAmbigus: ReadonlySet<string>
}

const nomNormalise = (valeur: string | null | undefined): string => (valeur || '').toLowerCase().trim()

/**
 * CA facturé de chaque chantier.
 *
 * Les montants passent par `docRevenueHT`, la primitive de chiffre d'affaires du dépôt — celle des écrans
 * Statistiques et Revenus. L'ancien calcul lisait `d.totalHT`, un champ que seule la forme sommaire de
 * `fetchDocumentsFromSupabase` porte, et rendait donc 0 € même quand un document franchissait le filtre.
 *
 * Les brouillons et les documents annulés sont écartés. `estDocumentEmis` garde les annulés — c'est le filtre qui
 * remplit le cache du navigateur depuis la base, et le changer déplacerait des chiffres déjà affichés — d'où le
 * `estAnnule` explicite. Un AVOIR, lui, compte : il porte `docType: 'facture'` et des lignes négatives, donc il se
 * soustrait de lui-même.
 */
export function caParChantier(
  documents: readonly DocumentDeChantier[] | undefined,
  chantiers: readonly ChantierCible[] | undefined,
): CaParChantier {
  const parChantier = new Map<string, number>()
  const clientsAmbigus = new Set<string>()
  const listeChantiers = chantiers || []
  if (listeChantiers.length === 0) return { parChantier, clientsAmbigus }

  const identifiants = new Set(listeChantiers.map((ch) => ch.id))
  // Chantiers par client : c'est ce décompte qui interdit d'imputer deux fois le même document.
  const chantiersDuClient = new Map<string, string[]>()
  for (const ch of listeChantiers) {
    const client = nomNormalise(ch.client)
    if (client === '') continue
    const deja = chantiersDuClient.get(client)
    if (deja) deja.push(ch.id)
    else chantiersDuClient.set(client, [ch.id])
  }

  // `facturesDuChiffreAffaires` écarte les annulées ET les avoirs qu'elles laissaient orphelins : sans cela,
  // une facture annulée que son avoir avait soldée laissait ici la seule ligne négative, et le CA du chantier
  // pouvait devenir négatif.
  for (const doc of facturesDuChiffreAffaires(documents)) {
    if (!estDocumentEmis(doc)) continue

    const rattachement = typeof doc.chantierId === 'string' ? doc.chantierId.trim() : ''
    let cible: string | null = null
    if (rattachement !== '') {
      // Rattaché explicitement : à ce chantier et à aucun autre, même si le client en a d'autres. Un rattachement
      // vers un chantier absent de la liste (chargée depuis une autre source) n'est imputé nulle part.
      cible = identifiants.has(rattachement) ? rattachement : null
    } else {
      const client = nomNormalise(doc.clientName)
      const candidats = client === '' ? undefined : chantiersDuClient.get(client)
      if (candidats && candidats.length === 1) cible = candidats[0]
      else if (candidats && candidats.length > 1) clientsAmbigus.add(client)
    }
    if (cible === null) continue

    parChantier.set(cible, (parChantier.get(cible) || 0) + docRevenueHT(doc))
  }

  return { parChantier, clientsAmbigus }
}
