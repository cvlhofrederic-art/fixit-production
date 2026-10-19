// ── Lignes du syndic → vues du copropriétaire ─────────────────────────────────
//
// Fonctions pures (sans Supabase ni React), testées : elles reçoivent les lignes lues
// par GET /api/coproprietaire/espace et ne gardent que ce qu'un copropriétaire peut voir.
//
// Règles (loi du 10 juillet 1965 art. 18 et 18-1, décret du 17 mars 1967 art. 33-1-1
// — extranet, décret 2019-502 —, RGPD) :
//   - jamais les coordonnées, le solde ou les impayés d'un AUTRE lot ; jamais le locataire,
//     son téléphone ni l'accès au logement d'une mission ; jamais le téléphone personnel du
//     prestataire (le nom de l'entreprise suffit, le syndic est l'intermédiaire) : les numéros
//     et adresses e-mail sont masqués dans les textes libres, par précaution ;
//   - jamais les notes internes du cabinet ni ses échanges avec le prestataire (canal_messages) ;
//   - interventions : celles sur les parties communes de l'immeuble (dépense commune, avec
//     montants dès que le prestataire est désigné et compte rendu), celles issues des demandes du
//     copropriétaire, celles de SON lot ; une mission qui vise un lot privé (numéro de lot,
//     locataire, téléphone ou accès au logement renseignés) n'est montrée qu'à l'intéressé ;
//   - documents : seulement ceux que le syndic a publiés sur l'extranet (publie_extranet), de
//     l'espace commun ou de l'espace personnel du copropriétaire, d'un type consultable ;
//     jamais RIB, relevés bancaires ni factures du cabinet ;
//   - assemblées : celles de l'immeuble, jamais un brouillon, une annulée seulement si elle a été
//     convoquée ; résultats seulement en séance ou après ; votes par correspondance : les siens ;
//   - annonces : celles de l'immeuble ou de tous les immeubles, sans les notes internes.

import { documentDuMessage } from '@/lib/syndic/messagerie-pro'
import type { FicheCoproprio } from '@/lib/coproprietaire/acces'
import type {
  AnnonceCopro, AppelDeCharges, AssembleeCopro, AssuranceImmeuble, CategorieAnnonce, CategorieExtranet, ChoixVote,
  CompteRenduIntervention, ContratImmeuble, DemandeCopro, DocumentImmeuble, DocumentPrestataireVue, EspaceCopro,
  FactureCopro, ImmeubleCopro, ImpayeCopro, InterventionVue, LotCopro, MajoriteResolution, MessageDemande,
  NatureImpaye, PrioriteAnnonce, PrioriteIntervention, ProfilCopro, ResolutionCopro, RoleOccupant,
  StatutAppel, StatutAssemblee, StatutFacture, StatutImpaye, StatutIntervention, SyndicCopro,
  TypeDocumentImmeuble,
  FinancesCopro,
} from '@/lib/coproprietaire/types'

// ── Lignes lues (colonnes sélectionnées par la route) ─────────────────────────

export interface LigneImmeuble {
  id: string
  nom: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  nb_lots: number | null
  annee_construction: number | null
  type_immeuble: string | null
  gestionnaire: string | null
  budget_annuel: number | string | null
  depenses_annee: number | string | null
  reglement_texte: string | null
  reglement_pdf_nom: string | null
  reglement_date_maj: string | null
  reglement_charges_repartition: string | null
  reglement_majorite_ag: string | null
  reglement_fonds_travaux: boolean | null
  reglement_fonds_roulement_pct: number | string | null
}

export interface LigneCabinet {
  nom: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  telephone: string | null
  email: string | null
}

export interface LigneMessageSignalement {
  id: string
  auteur: string | null
  role: string | null
  texte: string | null
  created_at: string | null
}

export interface LigneSignalement {
  id: string
  type_intervention: string | null
  description: string | null
  priorite: string | null
  statut: string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
  artisan_assigne: string | null
  created_at: string | null
  updated_at: string | null
  /** 'portail' (compte rattaché à sa fiche) ou 'public' (formulaire sans compte) ; absent tant que la migration 20261017 n'est pas appliquée. */
  origine?: string | null
  syndic_signalement_messages?: LigneMessageSignalement[] | null
}

/**
 * Mission du syndic. `locataire`, `telephone_locataire` et `acces_logement` servent seulement à
 * décider si la mission vise un lot privé : ils ne sont jamais recopiés dans une vue.
 */
export interface LigneMission {
  id: string
  signalement_id: string | null
  immeuble: string | null
  artisan: string | null
  type: string | null
  description: string | null
  priorite: string | null
  statut: string | null
  date_creation: string | null
  date_intervention: string | null
  montant_devis: number | string | null
  montant_facture: number | string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  locataire?: string | null
  telephone_locataire?: string | null
  acces_logement?: string | null
  demandeur_email: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
  travail_effectue: string | null
  materiaux_utilises: string | null
  problemes_constates: string | null
  recommandations: string | null
  date_rapport: string | null
  duree_intervention: string | null
  created_at: string | null
}

/** Message de la messagerie Pro (conversations prestataire ↔ cabinet) : ordre de mission ou document. */
export interface LigneMessagePro {
  id: string
  conversation_id: string
  type: string | null
  metadata: unknown
  ordre_mission: unknown
  created_at: string
}

export interface LigneAppel {
  id: string
  exercice: string | null
  periode_debut: string | null
  periode_fin: string | null
  montant_total: number | string | null
  montant_paye: number | string | null
  statut: string | null
  echeance: string | null
  iban: string | null
  reference_paiement: string | null
}

export interface LigneFacture {
  id: string
  numero_facture: string | null
  emise_le: string | null
  echeance: string | null
  montant_ht: number | string | null
  tva_taux: number | string | null
  montant_ttc: number | string | null
  description: string | null
  statut: string | null
  pdf_url: string | null
}

export interface LigneImpaye {
  id: string
  montant: number | string | null
  nature: string | null
  depuis: string | null
  nb_relances: number | null
  derniere_relance_at: string | null
  statut: string | null
}

/** Document du cabinet ; les colonnes de publication viennent de la migration 20261017 (absentes avant). */
export interface LigneDocument {
  id: string
  filename: string | null
  mime_type: string | null
  size_bytes: number | string | null
  type: string | null
  status: string | null
  tags: string[] | null
  uploaded_at: string | null
  publie_extranet?: boolean | null
  espace_extranet?: string | null
  coproprio_id?: string | null
  categorie_extranet?: string | null
}

export interface LigneContrat {
  id: string
  immeuble: string | null
  fornecedor: string | null
  categoria: string | null
  custo_mensal: number | string | null
  custo_anual: number | string | null
  data_inicio: string | null
  data_fim: string | null
  statut: string | null
}

export interface LigneAssurance {
  id: string
  immeuble: string | null
  seguradora: string | null
  tipo: string | null
  apolice: string | null
  premio_anual: number | string | null
  capital: number | string | null
  data_inicio: string | null
  data_fim: string | null
  statut: string | null
}

export interface LigneAssemblee {
  id: string
  titre: string | null
  immeuble: string | null
  date_ag: string | null
  lieu: string | null
  type_ag: string | null
  statut: string | null
  ordre_du_jour: unknown
  total_tantiemes: number | null
  pv_content: string | null
  convocation_sent_at: string | null
}

export interface LigneResolution {
  id: string
  assemblee_id: string
  titre: string | null
  description: string | null
  numero_ordre: number | null
  majorite: string | null
  vote_pour: number | null
  vote_contre: number | null
  vote_abstention: number | null
  statut: string | null
}

export interface LigneVote {
  resolution_id: string
  vote: string | null
  date_reception?: string | null
}

export interface LigneAviso {
  id: string
  immeuble: string | null
  titulo: string | null
  descricao: string | null
  categoria: string | null
  prioridade: string | null
  fixado: boolean | null
  created_at: string | null
}

// ── Outils ────────────────────────────────────────────────────────────────────

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Nombre lu d'une colonne numeric (PostgREST renvoie parfois une chaîne). */
export function nombre(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Nombre ou null (montants inconnus). */
function nombreOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = nombre(v)
  return Number.isFinite(n) ? n : null
}

/** Les deux valeurs désignent le même nom (immeuble, bâtiment, lot…) : casse et espaces ignorés. */
export function memeNom(a: unknown, b: unknown): boolean {
  const x = texte(a).toLowerCase()
  const y = texte(b).toLowerCase()
  return x !== '' && x === y
}

/** « Lot 12 », « lot n°12 », « 012 » → « 12 » : même lot malgré une saisie libre. */
export function normaliserLot(v: unknown): string {
  return texte(v).toLowerCase().replace(/^(lot|appartement|appt|porte)\s*(n[°o]\s*)?/i, '').replace(/\s+/g, '').replace(/^0+(?=\d)/, '')
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// Suites de chiffres, séparés ou non par espaces, points ou tirets (expression linéaire, sans
// quantificateur imbriqué). Un numéro de téléphone = 9 à 14 chiffres, précédés ou non de « + ».
const SUITE_CHIFFRES = /\+?\d[\d\s.-]*\d/g
const SEPARATEUR_DOUBLE = /(\D{2,})/
const CHIFFRES_NUMERO_MIN = 9
const CHIFFRES_NUMERO_MAX = 14

/** Masque adresses e-mail et numéros de téléphone d'un texte libre (le syndic est l'intermédiaire). */
export function masquerCoordonnees(v: string): string {
  return v.replace(EMAIL, '[e-mail masqué]').replace(SUITE_CHIFFRES, suite =>
    // Deux séparateurs de suite coupent la suite : « 12 - 2026 » n'est pas un numéro, « 06 12 34 56 78  et 04 91… » en fait deux.
    suite.split(SEPARATEUR_DOUBLE).map(partie => {
      const chiffres = partie.replace(/\D/g, '').length
      return chiffres >= CHIFFRES_NUMERO_MIN && chiffres <= CHIFFRES_NUMERO_MAX ? '[numéro masqué]' : partie
    }).join(''))
}

const STATUTS_INTERVENTION: readonly StatutIntervention[] = ['en_attente', 'acceptee', 'en_cours', 'terminee', 'annulee']
export function statutIntervention(v: unknown): StatutIntervention {
  return STATUTS_INTERVENTION.includes(v as StatutIntervention) ? (v as StatutIntervention) : 'en_attente'
}

export function prioriteIntervention(v: unknown): PrioriteIntervention {
  if (v === 'urgente' || v === 'haute') return 'urgente'
  if (v === 'planifiee' || v === 'basse') return 'planifiee'
  return 'normale'
}

// ── Profil, immeuble, syndic ──────────────────────────────────────────────────

/**
 * Profil du lot affiché. La quote-part n'est calculée que si le syndic a saisi tous les lots de
 * l'immeuble (`nbFichesImmeuble` ≥ `nbLotsImmeuble`, nombre de lots connu) : sinon 0 = « non communiquée ».
 */
export function construireProfil(
  fiche: FicheCoproprio,
  role: RoleOccupant,
  totalTantiemes: number,
  nbFichesImmeuble = 0,
  nbLotsImmeuble = 0,
): ProfilCopro {
  const tantiemes = nombre(fiche.tantieme)
  const lotsComplets = nbLotsImmeuble > 0 && nbFichesImmeuble >= nbLotsImmeuble
  const quotePart = lotsComplets && totalTantiemes > 0 && tantiemes > 0 ? Math.round((tantiemes / totalTantiemes) * 10000) / 100 : 0
  const locataire = role === 'locataire'
  return {
    id: fiche.id,
    prenom: texte(locataire ? fiche.prenom_locataire : fiche.prenom_proprietaire),
    nom: texte(locataire ? fiche.nom_locataire : fiche.nom_proprietaire),
    email: texte(locataire ? fiche.email_locataire : fiche.email_proprietaire).toLowerCase(),
    telephone: texte(locataire ? fiche.tel_locataire : fiche.tel_proprietaire),
    role,
    immeuble: texte(fiche.immeuble),
    batiment: texte(fiche.batiment),
    etage: fiche.etage === null || fiche.etage === undefined ? '' : String(fiche.etage),
    numLot: texte(fiche.numero_porte),
    // Tantièmes, quote-part et solde sont ceux du propriétaire : un locataire ne les voit pas.
    tantiemes: locataire ? 0 : tantiemes,
    quotePart: locataire ? 0 : quotePart,
    totalTantiemes: !locataire && lotsComplets ? totalTantiemes : 0,
    solde: locataire ? 0 : nombre(fiche.solde),
    estOccupe: fiche.est_occupe === true,
  }
}

/** Autres lots du même compte, hors le lot affiché. */
export function construireAutresLots(fiches: FicheCoproprio[], ficheAffichee: FicheCoproprio): LotCopro[] {
  return fiches
    .filter(f => f.id !== ficheAffichee.id)
    .map(f => ({
      id: f.id,
      immeuble: texte(f.immeuble),
      batiment: texte(f.batiment),
      etage: f.etage === null || f.etage === undefined ? '' : String(f.etage),
      numLot: texte(f.numero_porte),
    }))
}

export function construireImmeuble(ligne: LigneImmeuble | null, nomFiche: string): ImmeubleCopro {
  if (!ligne) {
    return {
      id: null, nom: nomFiche, adresse: '', ville: '', codePostal: '', nbLots: 0, anneeConstruction: null,
      typeImmeuble: '', gestionnaire: '', budgetAnnuel: 0, depensesAnnee: 0, reglement: null,
    }
  }
  const reglement = texte(ligne.reglement_texte) || texte(ligne.reglement_pdf_nom) || texte(ligne.reglement_charges_repartition)
    || texte(ligne.reglement_majorite_ag) || ligne.reglement_fonds_travaux === true
    ? {
      texte: texte(ligne.reglement_texte),
      pdfNom: texte(ligne.reglement_pdf_nom),
      dateMaj: texte(ligne.reglement_date_maj),
      chargesRepartition: texte(ligne.reglement_charges_repartition),
      majoriteAg: texte(ligne.reglement_majorite_ag),
      fondsTravaux: ligne.reglement_fonds_travaux === true,
      fondsRoulementPct: nombre(ligne.reglement_fonds_roulement_pct),
    }
    : null
  return {
    id: ligne.id,
    nom: texte(ligne.nom) || nomFiche,
    adresse: texte(ligne.adresse),
    ville: texte(ligne.ville),
    codePostal: texte(ligne.code_postal),
    nbLots: nombre(ligne.nb_lots),
    anneeConstruction: ligne.annee_construction ?? null,
    typeImmeuble: texte(ligne.type_immeuble),
    gestionnaire: texte(ligne.gestionnaire),
    budgetAnnuel: nombre(ligne.budget_annuel),
    depensesAnnee: nombre(ligne.depenses_annee),
    reglement,
  }
}

export function construireSyndic(ligne: LigneCabinet | null): SyndicCopro {
  return {
    nom: texte(ligne?.nom),
    adresse: texte(ligne?.adresse),
    ville: texte(ligne?.ville),
    codePostal: texte(ligne?.code_postal),
    telephone: texte(ligne?.telephone),
    email: texte(ligne?.email).toLowerCase(),
  }
}

// ── Interventions ─────────────────────────────────────────────────────────────

/** Contexte du copropriétaire pour décider ce qu'il voit d'une mission. */
export interface ContexteLot {
  /** E-mail de rattachement des signalements (minuscules). */
  email: string
  /** E-mail du locataire de MON lot (propriétaire) : ses demandes sur mon lot me concernent. */
  emailLocataire?: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
}

/**
 * Documents (devis, rapport, facture) envoyés par les prestataires, par mission syndic.
 * Dans une conversation, chaque document est rattaché au dernier ordre de mission qui le précède
 * (le prestataire n'envoie pas de référence de mission avec un document).
 */
export function documentsParMission(messages: LigneMessagePro[]): Map<string, DocumentPrestataireVue[]> {
  const parConversation = new Map<string, LigneMessagePro[]>()
  for (const m of messages) {
    const liste = parConversation.get(m.conversation_id) ?? []
    liste.push(m)
    parConversation.set(m.conversation_id, liste)
  }
  const resultat = new Map<string, DocumentPrestataireVue[]>()
  for (const liste of parConversation.values()) {
    liste.sort((a, b) => a.created_at.localeCompare(b.created_at))
    let missionCourante = ''
    for (const m of liste) {
      if (m.type === 'ordre_mission') {
        const o = m.ordre_mission
        const id = o && typeof o === 'object' ? (o as Record<string, unknown>).syndic_mission_id : undefined
        missionCourante = typeof id === 'string' ? id : ''
        continue
      }
      const doc = documentDuMessage(m.metadata)
      if (!doc || !missionCourante) continue
      const liste2 = resultat.get(missionCourante) ?? []
      liste2.push({
        type: doc.type,
        reference: doc.reference,
        montantTtc: doc.montant_ttc ?? null,
        description: masquerCoordonnees(doc.description),
        date: doc.date || m.created_at.slice(0, 10),
      })
      resultat.set(missionCourante, liste2)
    }
  }
  return resultat
}

/**
 * Une mission vise-t-elle un lot privé ? Oui dès qu'un numéro de lot, un locataire, un téléphone
 * ou un accès au logement est renseigné sans la marque « partie commune ». Une mission sans aucun
 * de ces éléments concerne l'immeuble entier (dépense commune).
 */
export function missionPrivee(m: LigneMission): boolean {
  if (m.est_partie_commune === true) return false
  return texte(m.num_lot) !== '' || texte(m.locataire) !== '' || texte(m.telephone_locataire) !== '' || texte(m.acces_logement) !== ''
}

/** Mission issue d'une demande du copropriétaire (ou de son locataire), ou visant exactement son lot. */
function estMaMission(m: LigneMission, ctx: ContexteLot, mesSignalements: Set<string>): boolean {
  if (m.signalement_id && mesSignalements.has(m.signalement_id)) return true
  const demandeur = texte(m.demandeur_email).toLowerCase()
  if (demandeur && (demandeur === ctx.email || (ctx.emailLocataire && demandeur === ctx.emailLocataire))) return true
  // Lot saisi par le syndic (sans signalement) : bâtiment, étage et lot doivent tous correspondre.
  const lot = normaliserLot(m.num_lot)
  if (!lot || lot !== normaliserLot(ctx.numLot)) return false
  if (!memeNom(m.batiment, ctx.batiment) && !(texte(m.batiment) === '' && texte(ctx.batiment) === '')) return false
  return normaliserLot(m.etage) === normaliserLot(ctx.etage)
}

function compteRendu(m: LigneMission): CompteRenduIntervention | null {
  const cr = {
    travailEffectue: masquerCoordonnees(texte(m.travail_effectue)),
    materiauxUtilises: masquerCoordonnees(texte(m.materiaux_utilises)),
    problemesConstates: masquerCoordonnees(texte(m.problemes_constates)),
    recommandations: masquerCoordonnees(texte(m.recommandations)),
    dureeIntervention: texte(m.duree_intervention),
    dateRapport: texte(m.date_rapport),
  }
  return Object.values(cr).some(v => v !== '') ? cr : null
}

const STATUTS_AVEC_DEVIS: readonly StatutIntervention[] = ['acceptee', 'en_cours', 'terminee']

function versIntervention(m: LigneMission, mienne: boolean, documents: DocumentPrestataireVue[]): InterventionVue {
  const statut = statutIntervention(m.statut)
  const commune = m.est_partie_commune === true || !missionPrivee(m)
  return {
    id: m.id,
    type: texte(m.type),
    description: masquerCoordonnees(texte(m.description)),
    prestataire: texte(m.artisan),
    statut,
    priorite: prioriteIntervention(m.priorite),
    dateCreation: texte(m.date_creation) || texte(m.created_at).slice(0, 10),
    datePrevue: texte(m.date_intervention),
    partieCommune: commune,
    zone: texte(m.zone_signalee),
    batiment: texte(m.batiment),
    // Étage et lot d'une mission qui n'est pas la mienne identifieraient un voisin.
    etage: mienne ? texte(m.etage) : '',
    numLot: mienne ? texte(m.num_lot) : '',
    // Montants : dès qu'un prestataire est désigné (devis retenu) ; facture une fois terminée.
    montantDevis: STATUTS_AVEC_DEVIS.includes(statut) ? nombreOuNull(m.montant_devis) : null,
    montantFacture: statut === 'terminee' ? nombreOuNull(m.montant_facture) : null,
    compteRendu: compteRendu(m),
    documents: STATUTS_AVEC_DEVIS.includes(statut) ? documents : [],
    estLaMienne: mienne,
    signalementId: m.signalement_id || null,
  }
}

/**
 * Missions de l'immeuble visibles par le copropriétaire : parties communes et immeuble entier
 * (toutes), lot privé seulement si c'est le sien ou sa demande. Les champs privés (locataire,
 * téléphone, accès au logement, demandeur, échanges internes) ne sont jamais recopiés.
 */
export function filtrerInterventions(
  missions: LigneMission[],
  ctx: ContexteLot,
  mesSignalements: Set<string>,
  documents: Map<string, DocumentPrestataireVue[]>,
): InterventionVue[] {
  return missions
    .filter(m => memeNom(m.immeuble, ctx.immeuble))
    .map(m => ({ m, mienne: estMaMission(m, ctx, mesSignalements) }))
    .filter(({ m, mienne }) => mienne || !missionPrivee(m))
    .map(({ m, mienne }) => versIntervention(m, mienne, documents.get(m.id) ?? []))
    .sort((a, b) => (b.dateCreation || '').localeCompare(a.dateCreation || ''))
}

/** Rôles des messages du fil montrés au copropriétaire (les autres restent entre gestionnaires). */
const ROLES_FIL_VISIBLES: ReadonlySet<string> = new Set(['syndic', 'gestionnaire', 'system', 'coproprio', 'locataire'])

function versMessage(m: LigneMessageSignalement): MessageDemande {
  const role = texte(m.role) || 'syndic'
  return {
    id: m.id,
    auteur: texte(m.auteur),
    role,
    texte: masquerCoordonnees(texte(m.texte)),
    date: texte(m.created_at),
    deMoi: role === 'coproprio' || role === 'locataire',
  }
}

/**
 * Demandes (signalements) du copropriétaire — déjà sélectionnées sur son e-mail par la route —
 * avec leur fil et la mission liée, si le syndic en a créé une.
 */
export function construireDemandes(
  signalements: LigneSignalement[],
  missions: LigneMission[],
  documents: Map<string, DocumentPrestataireVue[]>,
): DemandeCopro[] {
  const missionParSignalement = new Map<string, LigneMission>()
  for (const m of missions) {
    if (!m.signalement_id || m.statut === 'annulee') continue
    const existante = missionParSignalement.get(m.signalement_id)
    // Plusieurs missions pour une même demande (mission refusée puis reconfiée) : la plus récente.
    if (!existante || (m.created_at || '').localeCompare(existante.created_at || '') > 0) missionParSignalement.set(m.signalement_id, m)
  }
  return signalements
    .map((s): DemandeCopro => {
      const mission = missionParSignalement.get(s.id)
      return {
        id: s.id,
        type: texte(s.type_intervention),
        description: texte(s.description),
        priorite: prioriteIntervention(s.priorite),
        statut: statutIntervention(s.statut),
        partieCommune: s.est_partie_commune === true,
        zone: texte(s.zone_signalee),
        batiment: texte(s.batiment),
        etage: texte(s.etage),
        numLot: texte(s.num_lot),
        prestataire: texte(s.artisan_assigne) || texte(mission?.artisan),
        creeLe: texte(s.created_at),
        misAJourLe: texte(s.updated_at),
        origine: s.origine === 'portail' ? 'portail' : s.origine === 'public' ? 'public' : null,
        messages: (s.syndic_signalement_messages || [])
          .filter(m => ROLES_FIL_VISIBLES.has(texte(m.role) || 'syndic'))
          .map(versMessage)
          .sort((a, b) => a.date.localeCompare(b.date)),
        intervention: mission ? versIntervention(mission, true, documents.get(mission.id) ?? []) : null,
      }
    })
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
}

// ── Charges et factures ───────────────────────────────────────────────────────

const STATUTS_APPEL: readonly StatutAppel[] = ['a_payer', 'partiellement_paye', 'solde', 'en_retard', 'annule']

export interface SommeDueHorsAppels {
  montant: number
  /** Échéance la plus ancienne (factures) ou début du retard (impayés) ; vide pour un solde. */
  date: string
  enRetard: boolean
  source: 'factures' | 'impayes' | 'solde'
}

/**
 * Somme due en dehors des appels de charges, quand aucun appel n'est à payer : factures du syndic
 * à régler (échéance la plus proche, en retard si elle est passée), sinon retards de paiement ouverts
 * (depuis la date la plus ancienne), sinon solde débiteur de la fiche — celui-ci seulement quand le
 * syndic n'a publié aucun appel (des appels tous payés font foi : le copropriétaire est à jour). Ainsi
 * « ce que vous devez » ne dit jamais « aucun appel » à un copropriétaire qui doit de l'argent. null sinon.
 */
export function sommeDueHorsAppels(finances: FinancesCopro, aujourdhui: Date): SommeDueHorsAppels | null {
  const jour = aujourdhui.toISOString().slice(0, 10)
  const factures = finances.factures.filter(f => f.statut === 'a_regler' || f.statut === 'partiellement_regle')
  if (factures.length > 0) {
    const echeances = factures.map(f => f.echeance).filter(e => e !== '').sort((a, b) => a.localeCompare(b))
    const date = echeances[0] ?? ''
    return { montant: factures.reduce((s, f) => s + f.montantTtc, 0), date, enRetard: date !== '' && date.slice(0, 10) < jour, source: 'factures' }
  }
  const impayes = finances.impayes.filter(i => i.statut === 'ouvert' || i.statut === 'en_recouvrement')
  if (impayes.length > 0) {
    const debuts = impayes.map(i => i.depuis).filter(d => d !== '').sort((a, b) => a.localeCompare(b))
    return { montant: impayes.reduce((s, i) => s + i.montant, 0), date: debuts[0] ?? '', enRetard: true, source: 'impayes' }
  }
  const sansAppel = finances.appels.every(a => a.statut === 'annule')
  if (finances.solde < 0 && sansAppel) return { montant: -finances.solde, date: '', enRetard: false, source: 'solde' }
  return null
}
const STATUTS_FACTURE: readonly StatutFacture[] = ['a_regler', 'partiellement_regle', 'reglee', 'contestee', 'annulee']
const NATURES_IMPAYE: readonly NatureImpaye[] = ['charges_courantes', 'travaux', 'fonds_reserve', 'interets_retard', 'frais_relance', 'autre']
/** Statuts d'impayé montrés au copropriétaire ; « passé en perte » reste une écriture interne. */
const STATUTS_IMPAYE_VISIBLES: readonly StatutImpaye[] = ['ouvert', 'en_recouvrement', 'solde']

export function construireAppels(lignes: LigneAppel[]): AppelDeCharges[] {
  return lignes
    .map(a => {
      const total = nombre(a.montant_total)
      const paye = nombre(a.montant_paye)
      return {
        id: a.id,
        exercice: texte(a.exercice),
        periodeDebut: texte(a.periode_debut),
        periodeFin: texte(a.periode_fin),
        montantTotal: total,
        montantPaye: paye,
        resteAPayer: Math.max(0, Math.round((total - paye) * 100) / 100),
        statut: STATUTS_APPEL.includes(a.statut as StatutAppel) ? (a.statut as StatutAppel) : 'a_payer',
        echeance: texte(a.echeance),
        iban: texte(a.iban),
        referencePaiement: texte(a.reference_paiement),
      }
    })
    .sort((a, b) => (b.periodeDebut || b.echeance).localeCompare(a.periodeDebut || a.echeance))
}

/** Un PDF archivé par le syndic est un chemin de stockage (jamais une URL brute relayée). */
export function pdfFactureDisponible(pdfUrl: unknown): boolean {
  const v = texte(pdfUrl)
  return v !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(v)
}

export function construireFactures(lignes: LigneFacture[]): FactureCopro[] {
  return lignes
    .map(f => ({
      id: f.id,
      numero: texte(f.numero_facture),
      emiseLe: texte(f.emise_le),
      echeance: texte(f.echeance),
      montantHt: nombre(f.montant_ht),
      tvaTaux: nombre(f.tva_taux),
      montantTtc: nombre(f.montant_ttc),
      description: texte(f.description),
      statut: STATUTS_FACTURE.includes(f.statut as StatutFacture) ? (f.statut as StatutFacture) : 'a_regler',
      pdfDisponible: pdfFactureDisponible(f.pdf_url),
    }))
    .sort((a, b) => b.emiseLe.localeCompare(a.emiseLe))
}

export function construireImpayes(lignes: LigneImpaye[]): ImpayeCopro[] {
  return lignes
    .filter(i => STATUTS_IMPAYE_VISIBLES.includes(i.statut as StatutImpaye))
    .map(i => ({
      id: i.id,
      montant: nombre(i.montant),
      nature: NATURES_IMPAYE.includes(i.nature as NatureImpaye) ? (i.nature as NatureImpaye) : 'autre',
      depuis: texte(i.depuis),
      nbRelances: nombre(i.nb_relances),
      derniereRelanceLe: texte(i.derniere_relance_at),
      statut: i.statut as StatutImpaye,
    }))
    .sort((a, b) => b.depuis.localeCompare(a.depuis))
}

// ── Documents ─────────────────────────────────────────────────────────────────

/** Types de syndic_documents consultables (jamais rib, releve_bancaire, facture_*), une fois publiés. */
export const TYPES_DOCUMENTS_VISIBLES: readonly TypeDocumentImmeuble[] = ['pv_assemblee', 'ata_ag', 'contrat', 'devis', 'autre']

const CATEGORIES_EXTRANET: readonly CategorieExtranet[] = [
  'reglement', 'edd', 'fiche_synthetique', 'carnet_entretien', 'diagnostic', 'assurance', 'contrat_marche',
  'contrat_entretien', 'pv_ag', 'devis_approuve', 'contrat_syndic', 'convocation', 'budget', 'compte_individuel',
  'appel_fonds', 'autre',
]

/**
 * Document consultable : type autorisé, traité sans erreur, PUBLIÉ par le syndic (publie_extranet),
 * de l'espace commun ou de l'espace personnel de l'une de mes fiches.
 */
export function documentVisible(
  d: Pick<LigneDocument, 'type' | 'status' | 'publie_extranet' | 'espace_extranet' | 'coproprio_id'>,
  mesFiches: ReadonlySet<string>,
): boolean {
  if (!TYPES_DOCUMENTS_VISIBLES.includes(d.type as TypeDocumentImmeuble) || d.status === 'error') return false
  if (d.publie_extranet !== true) return false
  if (d.espace_extranet === 'personnel') return typeof d.coproprio_id === 'string' && mesFiches.has(d.coproprio_id)
  return true
}

export function construireDocuments(lignes: LigneDocument[], mesFiches: ReadonlySet<string>): DocumentImmeuble[] {
  return lignes
    .filter(d => documentVisible(d, mesFiches))
    .map(d => ({
      id: d.id,
      nom: texte(d.filename),
      type: d.type as TypeDocumentImmeuble,
      categorie: CATEGORIES_EXTRANET.includes(d.categorie_extranet as CategorieExtranet) ? (d.categorie_extranet as CategorieExtranet) : null,
      personnel: d.espace_extranet === 'personnel',
      mimeType: texte(d.mime_type),
      tailleOctets: nombre(d.size_bytes),
      ajouteLe: texte(d.uploaded_at),
      tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [],
    }))
    .sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe))
}

export function construireContrats(lignes: LigneContrat[], immeuble: string): ContratImmeuble[] {
  return lignes
    .filter(c => memeNom(c.immeuble, immeuble))
    .map(c => ({
      id: c.id,
      fournisseur: texte(c.fornecedor),
      categorie: texte(c.categoria) || 'outros',
      coutMensuel: nombre(c.custo_mensal),
      coutAnnuel: nombre(c.custo_anual),
      debut: texte(c.data_inicio),
      fin: texte(c.data_fim),
      statut: texte(c.statut) || 'ativo',
    }))
}

export function construireAssurances(lignes: LigneAssurance[], immeuble: string): AssuranceImmeuble[] {
  return lignes
    .filter(a => memeNom(a.immeuble, immeuble))
    .map(a => ({
      id: a.id,
      assureur: texte(a.seguradora),
      type: texte(a.tipo) || 'outros',
      police: texte(a.apolice),
      primeAnnuelle: nombre(a.premio_anual),
      capital: nombre(a.capital),
      debut: texte(a.data_inicio),
      fin: texte(a.data_fim),
      statut: texte(a.statut) || 'ativa',
    }))
}

// ── Assemblées ────────────────────────────────────────────────────────────────

/** Statut de syndic_assemblees (avec accents) → statut du portail ; null pour un brouillon ou une valeur inconnue. */
export function statutAssemblee(v: unknown): StatutAssemblee | null {
  const s = texte(v).toLowerCase()
  if (s === 'convoquée' || s === 'convoquee') return 'convoquee'
  if (s === 'en_cours') return 'en_cours'
  if (s === 'clôturée' || s === 'cloturee') return 'cloturee'
  if (s === 'annulée' || s === 'annulee') return 'annulee'
  return null
}

const MAJORITES: readonly MajoriteResolution[] = ['art24', 'art25', 'art26', 'unanimite']
const CHOIX: readonly ChoixVote[] = ['pour', 'contre', 'abstention']

function statutResolution(v: unknown): ResolutionCopro['statut'] {
  const s = texte(v).toLowerCase()
  if (s === 'adoptée' || s === 'adoptee') return 'adoptee'
  if (s === 'rejetée' || s === 'rejetee') return 'rejetee'
  return 'en_cours'
}

/**
 * Assemblées de l'immeuble (nom strict : une assemblée concerne un seul syndicat), sans brouillon ;
 * une annulée n'apparaît que si elle avait été convoquée. Les compteurs de voix ne sont montrés
 * qu'en séance ou après (avant, ils trahiraient le dépouillement partiel des votes par correspondance).
 */
export function construireAssemblees(
  assemblees: LigneAssemblee[],
  resolutions: LigneResolution[],
  mesVotes: LigneVote[],
  immeuble: string,
): AssembleeCopro[] {
  const voteParResolution = new Map<string, { choix: ChoixVote; le: string }>()
  for (const v of mesVotes) {
    if (CHOIX.includes(v.vote as ChoixVote)) voteParResolution.set(v.resolution_id, { choix: v.vote as ChoixVote, le: texte(v.date_reception) })
  }
  const resolutionsParAg = new Map<string, ResolutionCopro[]>()
  for (const r of resolutions) {
    const liste = resolutionsParAg.get(r.assemblee_id) ?? []
    liste.push({
      id: r.id,
      numero: nombre(r.numero_ordre),
      titre: texte(r.titre),
      description: texte(r.description),
      majorite: MAJORITES.includes(r.majorite as MajoriteResolution) ? (r.majorite as MajoriteResolution) : 'art24',
      votePour: nombre(r.vote_pour),
      voteContre: nombre(r.vote_contre),
      voteAbstention: nombre(r.vote_abstention),
      statut: statutResolution(r.statut),
      monVote: voteParResolution.get(r.id)?.choix ?? null,
      monVoteLe: voteParResolution.get(r.id)?.le ?? '',
    })
    resolutionsParAg.set(r.assemblee_id, liste)
  }
  return assemblees
    .filter(a => memeNom(a.immeuble, immeuble))
    .map(a => ({ a, statut: statutAssemblee(a.statut) }))
    .filter((x): x is { a: LigneAssemblee; statut: StatutAssemblee } => x.statut !== null)
    .filter(({ a, statut }) => statut !== 'annulee' || texte(a.convocation_sent_at) !== '')
    .map(({ a, statut }) => {
      const avantSeance = statut === 'convoquee'
      const resolutionsAg = (resolutionsParAg.get(a.id) ?? [])
        .map(r => (avantSeance ? { ...r, votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'en_cours' as const } : r))
        .sort((x, y) => x.numero - y.numero)
      return {
        id: a.id,
        titre: texte(a.titre),
        date: texte(a.date_ag),
        lieu: texte(a.lieu),
        type: a.type_ag === 'extraordinaire' ? 'extraordinaire' as const : 'ordinaire' as const,
        statut,
        ordreDuJour: Array.isArray(a.ordre_du_jour) ? a.ordre_du_jour.filter((p): p is string => typeof p === 'string') : [],
        resolutions: resolutionsAg,
        totalTantiemes: nombre(a.total_tantiemes) || 10000,
        pv: statut === 'cloturee' ? texte(a.pv_content) : '',
        convocationEnvoyeeLe: texte(a.convocation_sent_at),
      }
    })
    .sort((x, y) => y.date.localeCompare(x.date))
}

// ── Annonces ──────────────────────────────────────────────────────────────────

const CATEGORIES: readonly CategorieAnnonce[] = ['manutencao', 'assembleia', 'financeiro', 'seguranca', 'social', 'outro']
const PRIORITES_ANNONCE: readonly PrioriteAnnonce[] = ['normal', 'importante', 'urgente']

export function construireAnnonces(lignes: LigneAviso[], immeuble: string): AnnonceCopro[] {
  return lignes
    .filter(a => texte(a.immeuble) === '' || memeNom(a.immeuble, immeuble))
    .map(a => ({
      id: a.id,
      titre: texte(a.titulo),
      contenu: texte(a.descricao),
      categorie: CATEGORIES.includes(a.categoria as CategorieAnnonce) ? (a.categoria as CategorieAnnonce) : 'outro',
      priorite: PRIORITES_ANNONCE.includes(a.prioridade as PrioriteAnnonce) ? (a.prioridade as PrioriteAnnonce) : 'normal',
      epinglee: a.fixado === true,
      date: texte(a.created_at),
      immeuble: texte(a.immeuble),
    }))
    .sort((x, y) => Number(y.epinglee) - Number(x.epinglee) || y.date.localeCompare(x.date))
}

// ── Locataire ─────────────────────────────────────────────────────────────────

/**
 * Vue d'un locataire (loi de 1965 art. 1 et 14 : il n'est pas membre du syndicat ; loi 89-462
 * art. 3 : extraits du règlement) : ses demandes et les travaux de l'immeuble sans montant ni
 * document, compte rendu réduit au travail effectué ; règlement et annonces ; ni finances, ni
 * documents du syndicat, ni contrats, ni assemblées.
 */
export function restreindrePourLocataire(espace: EspaceCopro): EspaceCopro {
  const sansMontants = (i: InterventionVue): InterventionVue => ({
    ...i,
    montantDevis: null,
    montantFacture: null,
    documents: [],
    compteRendu: i.compteRendu && (i.compteRendu.travailEffectue || i.compteRendu.dateRapport)
      ? { travailEffectue: i.compteRendu.travailEffectue, materiauxUtilises: '', problemesConstates: '', recommandations: '', dureeIntervention: '', dateRapport: i.compteRendu.dateRapport }
      : null,
  })
  return {
    ...espace,
    profil: { ...espace.profil, solde: 0, tantiemes: 0, quotePart: 0, totalTantiemes: 0 },
    immeuble: { ...espace.immeuble, budgetAnnuel: 0, depensesAnnee: 0 },
    interventions: {
      mesDemandes: espace.interventions.mesDemandes.map(d => ({ ...d, intervention: d.intervention ? sansMontants(d.intervention) : null })),
      immeuble: espace.interventions.immeuble.map(sansMontants),
    },
    finances: { solde: 0, appels: [], factures: [], impayes: [] },
    documents: { fichiers: [], contrats: [], assurances: [] },
    assemblees: [],
  }
}
