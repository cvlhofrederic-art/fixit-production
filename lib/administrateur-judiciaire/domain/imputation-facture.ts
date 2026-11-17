import { composerDateIso, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerTraitement, type Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Facture fournisseur d'une copropriété : lecture du texte, contrôles, codification et écriture au journal des achats.
 * Règles LOCALES, sans IA : rien n'est envoyé à l'extérieur. Montants en CENTIMES ENTIERS. Fonctions pures.
 *
 * Comptes de charge : plan comptable des copropriétés (classe 6), dont les codes 602 / 615 / 616 / 621 ont été vus
 * dans un plan Gestéam réel (tranche 25). Familles analytiques : plages relevées dans Gestéam (tranche 21).
 * La codification est une PROPOSITION, à valider par le gestionnaire : aucun compte n'est deviné hors des mots-clés.
 * Rubrique analytique : seulement pour les comptes dont le couple compte ↔ rubrique a été observé (tranche 27) ;
 * sinon null, à choisir par le gestionnaire.
 * Le syndicat n'étant pas assujetti à la TVA, la charge est comptabilisée TTC.
 */

export interface FactureLue {
  fournisseur: string | null
  siret: string | null
  numero: string | null
  date: string | null
  htCentimes: number | null
  tauxTva: number | null
  tvaCentimes: number | null
  ttcCentimes: number | null
  texte: string
}

const MONTANT = /(\d{1,3}(?:[ .  ]\d{3})+|\d+)[,.](\d{2})(?!\d)/g

/** Dernier montant décimal d'une ligne, en centimes (« 12 400,00 », « 2.480,00 », « 14880,00 »). */
function dernierMontant(ligne: string): number | null {
  const trouves = [...ligne.matchAll(MONTANT)]
  const dernier = trouves.at(-1)
  if (!dernier) return null
  return Number(dernier[1].replace(/[ .  ]/g, '')) * 100 + Number(dernier[2])
}

const sansAccent = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function lireFacture(texte: string): FactureLue {
  const lignes = texte.split(/\r?\n/).map((ligne) => ligne.trim()).filter(Boolean)
  const ligneOu = (motif: RegExp, exclure?: RegExp) => lignes.find((l) => motif.test(l) && !exclure?.test(l)) ?? null
  const montantDe = (ligne: string | null) => (ligne ? dernierMontant(ligne) : null)

  const siretBrut = /SIRET\s*:?\s*([\d  ]{14,20})/i.exec(texte)?.[1].replace(/\D/g, '') ?? null
  const date = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texte)
  const dateIso = date ? composerDateIso(Number(date[3]), Number(date[2]), Number(date[1])) : null
  const ligneTva = ligneOu(/\bTVA\b/i, /intra/i)
  const taux = ligneTva && /(\d{1,2}(?:[,.]\d)?)\s*%/.exec(ligneTva)

  return {
    fournisseur: lignes[0] ?? null,
    siret: siretBrut && siretBrut.length === 14 ? siretBrut : null,
    numero: /factur\w*\s*n\s*[°o]?\s*:?\s*([A-Z0-9][\w\-/]*)/i.exec(texte)?.[1] ?? null,
    date: dateIso && estDateIsoValide(dateIso) ? dateIso : null,
    htCentimes: montantDe(ligneOu(/\bHT\b/i, /TTC/i)),
    tauxTva: taux ? Number(taux[1].replace(',', '.')) : null,
    tvaCentimes: ligneTva ? dernierMontant(ligneTva.replace(/\(?\d{1,2}(?:[,.]\d)?\s*%\)?/, '')) : null,
    ttcCentimes: montantDe(ligneOu(/\bTTC\b|net [àa] payer/i)),
    texte,
  }
}

export interface AnomalieFacture {
  code:
    | 'total_incoherent'
    | 'taux_tva_inconnu'
    | 'tva_incoherente'
    | 'numero_manquant'
    | 'date_manquante'
    | 'siret_manquant'
    | 'montant_ht_manquant'
    | 'montant_ttc_manquant'
  message: string
}

const TAUX_TVA_FRANCE = [20, 10, 5.5, 2.1]
const euros = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'

export function controlerFacture(facture: FactureLue): AnomalieFacture[] {
  const anomalies: AnomalieFacture[] = []
  const { htCentimes: ht, tvaCentimes: tva, ttcCentimes: ttc, tauxTva: taux } = facture
  if (ht !== null && tva !== null && ttc !== null && Math.abs(ht + tva - ttc) > 1)
    anomalies.push({ code: 'total_incoherent', message: `HT ${euros(ht)} + TVA ${euros(tva)} ≠ TTC ${euros(ttc)}.` })
  if (taux !== null && !TAUX_TVA_FRANCE.includes(taux))
    anomalies.push({ code: 'taux_tva_inconnu', message: `Taux de TVA ${taux} % : hors des taux français (20, 10, 5,5, 2,1 %).` })
  if (ht !== null && tva !== null && taux !== null && Math.abs(Math.round((ht * taux) / 100) - tva) > 1)
    anomalies.push({ code: 'tva_incoherente', message: `TVA ${euros(tva)} ≠ ${taux} % de ${euros(ht)}.` })
  if (!facture.numero) anomalies.push({ code: 'numero_manquant', message: 'Numéro de facture introuvable.' })
  if (!facture.date) anomalies.push({ code: 'date_manquante', message: 'Date de facture introuvable.' })
  if (!facture.siret) anomalies.push({ code: 'siret_manquant', message: 'SIRET du fournisseur introuvable.' })
  if (ht === null) anomalies.push({ code: 'montant_ht_manquant', message: 'Montant HT introuvable.' })
  if (ttc === null) anomalies.push({ code: 'montant_ttc_manquant', message: 'Montant TTC introuvable.' })
  return anomalies
}

interface RegleImputation {
  motsCles: RegExp
  comptePlan: string
  libelleCompte: string
  familleAnalytique: string
  decisionAgRequise: boolean
}

/**
 * Couples compte de charge ↔ rubrique analytique observés dans le plan Gestéam (tranche 27, libellés génériques).
 * 71600 est un compte de produit (intérêts sur répartition) : il figure ici pour la correspondance, jamais pour une facture.
 */
export const CORRESPONDANCES_COMPTE_RUBRIQUE = [
  { comptePlan: '60200', rubrique: '230', libelleRubrique: 'Électricité' },
  { comptePlan: '61500', rubrique: '460', libelleRubrique: 'Entretien, petites réparations' },
  { comptePlan: '61600', rubrique: '490', libelleRubrique: 'Contrat assurance' },
  { comptePlan: '62300', rubrique: '620', libelleRubrique: 'Honoraires avocat' },
  { comptePlan: '62220', rubrique: '660', libelleRubrique: 'Prestations particulières' },
  { comptePlan: '71600', rubrique: '889', libelleRubrique: 'Intérêts sur répartition' },
  { comptePlan: '62111', rubrique: '901', libelleRubrique: 'Honoraires administrateur provisoire' },
  { comptePlan: '62120', rubrique: '951', libelleRubrique: 'Débours' },
] as const

const rubriqueDuCompte = (comptePlan: string): string | null =>
  CORRESPONDANCES_COMPTE_RUBRIQUE.find((c) => c.comptePlan === comptePlan)?.rubrique ?? null

/**
 * Ordre significatif : la première règle reconnue l'emporte (honoraires d'avocat avant tout le reste, car la facture
 * cite souvent l'objet du litige ; travaux avant réparations, réparations avant eau…).
 */
const REGLES_IMPUTATION: RegleImputation[] = [
  { motsCles: /\bavocats?\b/, comptePlan: '62300', libelleCompte: "Honoraires d'avocat", familleAnalytique: '610-641', decisionAgRequise: false },
  { motsCles: /\bdebours\b/, comptePlan: '62120', libelleCompte: 'Débours', familleAnalytique: '901-999', decisionAgRequise: false },
  { motsCles: /ravalement|toiture|etancheite|refection|gros travaux/, comptePlan: '67100', libelleCompte: "Travaux décidés par l'assemblée générale", familleAnalytique: '510-563', decisionAgRequise: true },
  { motsCles: /assurance|multirisque|prime d.assurance/, comptePlan: '61600', libelleCompte: "Primes d'assurances", familleAnalytique: '490-499', decisionAgRequise: false },
  { motsCles: /electricite|\bedf\b|enedis/, comptePlan: '60200', libelleCompte: 'Électricité', familleAnalytique: '230-245', decisionAgRequise: false },
  { motsCles: /contrat|maintenance|abonnement/, comptePlan: '61400', libelleCompte: 'Contrats de maintenance', familleAnalytique: '401-449', decisionAgRequise: false },
  { motsCles: /nettoyage|menage|encombrants/, comptePlan: '61100', libelleCompte: 'Nettoyage des locaux', familleAnalytique: '450-456', decisionAgRequise: false },
  { motsCles: /reparation|depannage|fuite|plomberie|serrurerie|vitrerie|remplacement/, comptePlan: '61500', libelleCompte: 'Entretien et petites réparations', familleAnalytique: '460-469', decisionAgRequise: false },
  { motsCles: /fourniture d.eau|consommation d.eau|veolia|\bsaur\b/, comptePlan: '60100', libelleCompte: 'Eau', familleAnalytique: '230-245', decisionAgRequise: false },
]

/** Clé de répartition suggérée par l'équipement nommé ; sinon les charges communes générales. */
const CLES_PAR_EQUIPEMENT: [RegExp, RegExp][] = [
  [/ascenseur/, /ascenseur/i],
  [/chauffage|chaudiere/, /chauffage/i],
]

export interface ImputationProposee {
  comptePlan: string | null
  libelleCompte: string | null
  familleAnalytique: string | null
  /** Rubrique du couple compte ↔ rubrique observé ; null si aucun couple connu pour ce compte. */
  rubriqueAnalytique: string | null
  cleRepartition: string | null
  decisionAgRequise: boolean
  /** `mots_cles` : proposée d'après le texte ; `contrat` : reprise de la codification du contrat (contrats-facturation) ;
   *  `demande` : reprise de la ventilation de la demande d'intervention (facture-demande) ;
   *  `a_completer` : aucun compte reconnu, à choisir par le gestionnaire. */
  certitude: 'mots_cles' | 'a_completer' | 'contrat' | 'demande'
}

export function proposerImputation(facture: FactureLue, clesDisponibles: string[]): ImputationProposee {
  const corps = sansAccent(facture.texte.split(/\r?\n/).slice(1).join(' ').toLowerCase())
  const regle = REGLES_IMPUTATION.find((r) => r.motsCles.test(corps))
  const equipement = CLES_PAR_EQUIPEMENT.find(([motif]) => motif.test(corps))
  const cleEquipement = equipement ? clesDisponibles.find((cle) => equipement[1].test(cle)) : undefined
  const cleGenerale = clesDisponibles.find((cle) => /g[ée]n[ée]rales?/i.test(cle)) ?? clesDisponibles[0] ?? null
  return {
    comptePlan: regle?.comptePlan ?? null,
    libelleCompte: regle?.libelleCompte ?? null,
    familleAnalytique: regle?.familleAnalytique ?? null,
    rubriqueAnalytique: regle ? rubriqueDuCompte(regle.comptePlan) : null,
    cleRepartition: cleEquipement ?? cleGenerale,
    decisionAgRequise: regle?.decisionAgRequise ?? false,
    certitude: regle ? 'mots_cles' : 'a_completer',
  }
}

/** Segment auxiliaire du compte fournisseur : 5 caractères majuscules sans accent, complété par des 0. */
export function codeFournisseur(nom: string): string {
  return sansAccent(nom).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5).padEnd(5, '0')
}

/**
 * Écriture de la facture au journal des achats (famille « Saisie de factures ») : débit du compte de charge, crédit du
 * compte fournisseur (401), montant TTC. Refuse une facture sans compte de charge choisi, sans TTC ou sans date.
 */
export function ecritureFacture({
  id,
  facture,
  imputation,
}: {
  id: string
  facture: FactureLue
  imputation: ImputationProposee
}): { traitement: Traitement; cleRepartition: string | null; familleAnalytique: string | null } {
  if (!imputation.comptePlan) throw new Error('Écriture refusée : choisir le compte de charge.')
  if (facture.ttcCentimes === null) throw new Error('Écriture refusée : montant TTC introuvable.')
  if (!facture.date) throw new Error('Écriture refusée : date de facture introuvable.')
  const fournisseur = `____.40100.${codeFournisseur(facture.fournisseur ?? 'FOURN')}.0`
  const traitement = creerTraitement({
    id,
    famille: 'Saisie de factures',
    date: facture.date,
    mouvements: [
      { compte: `____.${imputation.comptePlan}.00000.0`, sens: 'debit', montantCentimes: facture.ttcCentimes },
      { compte: fournisseur, sens: 'credit', montantCentimes: facture.ttcCentimes },
    ],
  })
  return { traitement, cleRepartition: imputation.cleRepartition, familleAnalytique: imputation.familleAnalytique }
}

/** Comptes de charge proposables au gestionnaire (mêmes comptes que les règles de mots-clés). */
export const COMPTES_CHARGE_PROPOSES = REGLES_IMPUTATION.map(({ comptePlan, libelleCompte, familleAnalytique, decisionAgRequise }) => ({
  comptePlan,
  libelleCompte,
  familleAnalytique,
  decisionAgRequise,
}))
