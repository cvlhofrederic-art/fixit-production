// ── Espace copropriétaire tiré de l'Administrateur judiciaire (démonstration reliée) ─────────────────────────────
//
// Vue super admin du portail : l'espace d'un copropriétaire d'une copropriété de l'Administrateur judiciaire (AJ),
// construit à partir des mêmes données que l'AJ (son jeu de démonstration) et des échanges de la liaison
// (lib/liaison-copro-aj) : mêmes noms, mêmes lots, mêmes soldes, mêmes assemblées, mêmes ordres de service, mêmes
// avis que dans l'AJ. Rien n'est inventé au-delà de ce que l'AJ affiche, sauf le détail des appels de charges, réparti
// depuis le budget voté et les tantièmes du lot (comme l'avis d'appel de l'AJ), et l'IBAN, fictif.
//
// Règles du portail conservées : jamais l'intervention d'un lot privé d'autrui ; compteurs de vote masqués avant la
// séance (l'écran le fait) ; le locataire n'est pas servi (le portail est ouvert au nom du propriétaire).
// Module sans React ni navigateur : fonctions pures, testées seules.

import { FICHES_ASSEMBLEES_DEMO } from '@/components/administrateur-judiciaire/data/assemblees'
import { DEMO_AVIS_AFFICHAGE } from '@/components/administrateur-judiciaire/data/avis-affichage'
import { DEMO_CONTRATS_ASSURANCE } from '@/components/administrateur-judiciaire/data/contrats-assurance'
import { DEMO_COPROPRIETAIRES, type CoproprietaireDemo } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { DEMO_COPROPRIETES, FICHES_COPROPRIETES_DEMO, type CoproprieteDemo } from '@/components/administrateur-judiciaire/data/coproprietes'
import { DEMO_DOCUMENTS_GED } from '@/components/administrateur-judiciaire/data/documents-ged'
import { DEMO_ORDRES_DE_SERVICE, type OrdreDeServiceDemo } from '@/components/administrateur-judiciaire/data/ordres-de-service'
import { resultatsResolutions, type FicheAssemblee } from '@/lib/administrateur-judiciaire/domain/fiche-assemblee'
import { DATE_DEMO_ISO } from '@/lib/administrateur-judiciaire/mode'
import type { DemandeLiaison, EtatLiaison, VoteLiaison } from '@/lib/liaison-copro-aj/stockage'
import type {
  AnnonceCopro, AppelDeCharges, AssembleeCopro, AssuranceImmeuble, CategorieAnnonce, DemandeCopro, DocumentImmeuble,
  EspaceCopro, ImpayeCopro, InterventionVue, PrioriteIntervention, ResolutionCopro, StatutIntervention,
} from '@/lib/coproprietaire/types'

/** Cabinet de démonstration de l'AJ (tel que ses écrans le nomment). */
export const CABINET_AJ = { nom: 'Cabinet Delaunay', email: 'direction@cabinet-delaunay.fr' } as const

/** IBAN fictif (clé de contrôle fantaisiste) du compte séparé du syndicat, affiché sur les appels de démonstration. */
export const IBAN_SYNDICAT_AJ_DEMO = 'FR76 3000 4000 0312 3456 7890 143'

/** Date du jour de l'AJ en démonstration (date figée de son jeu de données). */
export const DATE_DU_JOUR_AJ_DEMO = DATE_DEMO_ISO

// ── Liste pour le sélecteur ──────────────────────────────────────────────────────────────────────────────────────

export interface PersonneAj {
  id: string
  nom: string
  lot: string
  /** Solde du compte dans l'AJ (négatif = dette). */
  solde: number
}

export interface CoproAj {
  code: string
  nom: string
  adresse: string
  /** Fondement du mandat (« art. 46 — carence »). */
  fondement: string
  coproprietaires: PersonneAj[]
}

/** Copropriétaires de démonstration d'une copropriété (rattachés par le nom, comme le seed de l'AJ). */
const coproprietairesDe = (copro: CoproprieteDemo): CoproprietaireDemo[] =>
  DEMO_COPROPRIETAIRES.filter((p) => p.copro === copro.nom)

/** Copropriétés de l'AJ et leurs copropriétaires, dans l'ordre de l'AJ. */
export function listeCoprosAj(): CoproAj[] {
  return DEMO_COPROPRIETES.map((copro) => ({
    code: copro.code,
    nom: copro.nom,
    adresse: copro.adresse,
    fondement: copro.fondement,
    coproprietaires: coproprietairesDe(copro).map((p) => ({ id: p.id, nom: p.nom, lot: p.lot, solde: p.solde })),
  }))
}

/** Choix valide (copropriété connue, personne de cette copropriété) le plus proche de celui demandé. */
export function choixValide(code: string | null | undefined, personneId: string | null | undefined): { code: string; personneId: string } | null {
  const copros = listeCoprosAj().filter((c) => c.coproprietaires.length > 0)
  const copro = copros.find((c) => c.code === code) ?? copros[0]
  if (!copro) return null
  const personne = copro.coproprietaires.find((p) => p.id === personneId) ?? copro.coproprietaires[0]
  return { code: copro.code, personneId: personne.id }
}

// ── Petits outils ────────────────────────────────────────────────────────────────────────────────────────────────

/** « JJ/MM/AAAA » → « AAAA-MM-JJ » ; '' si la date n'a pas cette forme (« — », « En continu »). */
export function dateFrVersIso(valeur: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valeur.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

const arrondiCentimes = (n: number): number => Math.round(n * 100) / 100

/** Nom court d'une copropriété dans les écrans de l'AJ (« Le Méridien » pour « Résidence Le Méridien »). */
const NOMS_COURTS: Record<string, string[]> = {
  LM: ['Résidence Le Méridien', 'Le Méridien'],
  CV: ['Le Clos des Vignes', 'Clos des Vignes'],
  TL: ['Copropriété Les Tilleuls', 'Les Tilleuls'],
  VM: ['Villa Montaigne'],
}
const estDeLaCopro = (code: string, nom: string): boolean => (NOMS_COURTS[code] ?? []).includes(nom.trim())

/** Numéro du lot dans un libellé de l'AJ : « Lot 12 — Apt B3 » → « 12 », « Lots 8-9 — Local » → « 8-9 ». */
export function numeroDeLot(libelle: string): string {
  const m = /^Lots?\s+([\w-]+)/i.exec(libelle.trim())
  return m ? m[1] : libelle.trim()
}

/** Bâtiment et étage tirés de la situation de la fiche (« Bât. B, 3e étage », « 4e étage », « Rez-de-chaussée »). */
export function batimentEtEtage(situation: string): { batiment: string; etage: string } {
  const batiment = /B[âa]t\.?\s*([A-Z0-9]+)/i.exec(situation)?.[1] ?? ''
  const etageNombre = /(\d+)\s*(?:e|er|ème)\s+étage/i.exec(situation)?.[1]
  const etage = etageNombre ?? (/rez-de-chauss/i.test(situation) ? '0' : '')
  return { batiment, etage }
}

/** Tantièmes « 412/10000 » → { lot: 412, total: 10000 } ; zéros si illisibles. */
export function lireTantiemes(texte: string): { lot: number; total: number } {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(texte.trim())
  return m ? { lot: Number(m[1]), total: Number(m[2]) } : { lot: 0, total: 0 }
}

/** Adresse « 14 rue de Verdun, 92000 Nanterre » découpée. */
function decouperAdresse(adresse: string): { adresse: string; codePostal: string; ville: string } {
  const m = /^(.*?),\s*(\d{5})\s+(.+)$/.exec(adresse.trim())
  return m ? { adresse: m[1], codePostal: m[2], ville: m[3] } : { adresse, codePostal: '', ville: '' }
}

/** Qualité du cabinet selon le fondement du mandat. */
const qualiteCabinet = (fondement: string): string =>
  /29-1|29-11|art\.\s*47/i.test(fondement) ? 'administrateur provisoire' : 'syndic judiciaire'

// ── Interventions : ordres de service de l'AJ ────────────────────────────────────────────────────────────────────

const STATUTS_OS: Record<string, StatutIntervention> = {
  'À valider': 'en_attente',
  Planifié: 'acceptee',
  'En cours': 'en_cours',
  Clôturé: 'terminee',
}

const PRIORITES_OS: Record<string, PrioriteIntervention> = { Urgence: 'urgente', Prioritaire: 'urgente', Normale: 'normale' }

/** Corps de métier déduit de l'objet de l'ordre de service (libellé affiché au copropriétaire). */
export function typeDepuisObjet(objet: string): string {
  const o = objet.toLowerCase()
  if (/fuite|colonne|plomb|canalisation|eau/.test(o)) return 'Plomberie'
  if (/minuterie|éclairage|eclairage|interphone|électri|electri/.test(o)) return 'Électricité'
  if (/élagage|elagage|arbre|jardin|espaces? verts?/.test(o)) return 'Espaces verts'
  if (/peinture/.test(o)) return 'Peinture'
  if (/toiture|couverture|étanchéité|etancheite/.test(o)) return 'Toiture'
  if (/ascenseur/.test(o)) return 'Ascenseur'
  return 'Travaux'
}

/** Fraction visée : « Lot 27 » (lot privé), sinon parties communes (« Hall », « Cage B », « Extérieur »…). */
function fractionDe(frac: string): { lot: string | null; zone: string; batiment: string } {
  const lot = /^Lots?\s+([\w-]+)/i.exec(frac.trim())?.[1] ?? null
  const batiment = /^Cage\s+([A-Z0-9]+)/i.exec(frac.trim())?.[1] ?? ''
  return { lot, zone: lot || /^parties communes$/i.test(frac.trim()) ? '' : frac.trim(), batiment }
}

function interventionDepuisOs(os: OrdreDeServiceDemo, numLot: string): InterventionVue {
  const { lot, zone, batiment } = fractionDe(os.frac)
  return {
    id: os.id,
    type: typeDepuisObjet(os.objet),
    description: os.objet,
    prestataire: os.presta,
    statut: STATUTS_OS[os.statut] ?? 'en_attente',
    priorite: PRIORITES_OS[os.urg] ?? 'normale',
    dateCreation: dateFrVersIso(os.date),
    datePrevue: '',
    partieCommune: lot === null,
    zone,
    batiment,
    etage: '',
    numLot: lot ?? '',
    montantDevis: null,
    montantFacture: null,
    compteRendu: null,
    documents: [],
    estLaMienne: lot !== null && lot === numLot,
    signalementId: null,
  }
}

/** Ordres de service de la copropriété visibles par ce copropriétaire : parties communes et son propre lot. */
export function interventionsDeLImmeuble(code: string, numLot: string): InterventionVue[] {
  return DEMO_ORDRES_DE_SERVICE.filter((os) => estDeLaCopro(code, os.copro))
    .map((os) => interventionDepuisOs(os, numLot))
    .filter((i) => i.partieCommune || i.numLot === numLot)
    .sort((a, b) => b.dateCreation.localeCompare(a.dateCreation))
}

// ── Demandes déposées depuis le portail (liaison) ────────────────────────────────────────────────────────────────

export function demandeDepuisLiaison(d: DemandeLiaison, batiment: string, etage: string, numLot: string): DemandeCopro {
  return {
    id: d.id,
    type: d.type,
    description: d.description,
    priorite: d.priorite,
    statut: d.statut,
    partieCommune: d.partieCommune,
    zone: d.zone,
    batiment,
    etage,
    numLot,
    prestataire: '',
    creeLe: d.creeLe,
    misAJourLe: d.misAJourLe,
    origine: 'portail',
    messages: d.messages.map((m) => ({
      id: m.id,
      auteur: m.nom,
      role: m.auteur === 'coproprietaire' ? 'coproprio' : 'syndic',
      texte: m.texte,
      date: m.date,
      deMoi: m.auteur === 'coproprietaire',
    })),
    intervention: null,
  }
}

// ── Charges : appels trimestriels répartis depuis le budget voté ────────────────────────────────────────────────

/** Trimestres remontés au plus pour porter une dette (quatre exercices) ; au-delà, le reste est un arriéré. */
const TRIMESTRES_MAX = 16

/** Échéance d'un trimestre (1er janvier, avril, juillet, octobre). */
const echeanceTrimestre = (annee: number, t: number): string => `${annee}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`

/**
 * Appels trimestriels du compte au jour de l'AJ, quote-part du lot sur le budget voté : ceux de l'exercice en cours
 * échus à `dateDuJour`, payés ou non. La dette du compte (solde négatif) est portée par les appels échus les plus
 * récents, en remontant aux trimestres des exercices précédents tant qu'il le faut (seuls ceux qui restent dus sont
 * montrés) ; au-delà de TRIMESTRES_MAX, le reste est rendu en arriéré. Le total des restes à payer est ainsi
 * exactement le solde affiché par l'AJ.
 */
export function appelsEtArriere(
  budget: number,
  tantiemes: { lot: number; total: number },
  solde: number,
  dateDuJour: string,
  reference: string,
): { appels: AppelDeCharges[]; arriere: number } {
  const annee = Number(dateDuJour.slice(0, 4))
  const trimestriel = tantiemes.total > 0 ? arrondiCentimes((budget * tantiemes.lot) / tantiemes.total / 4) : 0
  let dette = solde < 0 ? arrondiCentimes(-solde) : 0
  // Trimestres échus, du plus récent au plus ancien.
  const retenus: { a: number; t: number; reste: number }[] = []
  let a = annee
  let t = 4
  while (echeanceTrimestre(a, t) > dateDuJour) t -= 1
  for (let rang = 0; rang < TRIMESTRES_MAX && t >= 1; rang++) {
    const reste = arrondiCentimes(Math.min(trimestriel, dette))
    dette = arrondiCentimes(dette - reste)
    if (a === annee || reste > 0) retenus.push({ a, t, reste })
    if (a < annee && (dette === 0 || trimestriel === 0)) break
    t -= 1
    if (t === 0) {
      a -= 1
      t = 4
    }
  }
  const appels = retenus.reverse().map(({ a: an, t: trimestre, reste }): AppelDeCharges => {
    const paye = arrondiCentimes(trimestriel - reste)
    let statut: AppelDeCharges['statut'] = 'en_retard'
    if (reste === 0) statut = 'solde'
    else if (paye > 0) statut = 'partiellement_paye'
    const echeance = echeanceTrimestre(an, trimestre)
    return {
      id: `aj-appel-${reference}-${an}-T${trimestre}`,
      exercice: `${an}-T${trimestre}`,
      periodeDebut: echeance,
      periodeFin: new Date(Date.UTC(an, trimestre * 3, 0)).toISOString().slice(0, 10),
      montantTotal: trimestriel,
      montantPaye: paye,
      resteAPayer: reste,
      statut,
      echeance,
      iban: IBAN_SYNDICAT_AJ_DEMO,
      referencePaiement: `${reference}-${an}T${trimestre}`,
    }
  })
  return { appels, arriere: dette }
}

// ── Documents ────────────────────────────────────────────────────────────────────────────────────────────────────

const TYPES_GED: Record<string, Pick<DocumentImmeuble, 'type' | 'categorie'> | null> = {
  Juridique: { type: 'autre', categorie: 'autre' },
  Assemblée: { type: 'pv_assemblee', categorie: 'pv_ag' },
  Contrat: { type: 'contrat', categorie: 'contrat_entretien' },
  Technique: { type: 'devis', categorie: 'devis_approuve' },
  // État daté, pièces comptables : documents d'une vente ou du cabinet, pas de l'extranet.
  Comptabilité: null,
}

function documentsDeLaCopro(code: string, assemblees: FicheAssemblee[]): DocumentImmeuble[] {
  const ged = DEMO_DOCUMENTS_GED.filter(([, , copro]) => estDeLaCopro(code, copro)).flatMap(([nom, type, , , date], rang) => {
    const rangement = TYPES_GED[type]
    if (!rangement) return []
    return [{
      id: `aj-ged-${code}-${rang}`,
      nom,
      ...rangement,
      personnel: false,
      mimeType: 'application/pdf',
      tailleOctets: 0,
      ajouteLe: dateFrVersIso(date),
      tags: [type],
    }]
  })
  const pv = assemblees.filter((ag) => ag.pvSigneLe).map((ag): DocumentImmeuble => ({
    id: `aj-pv-${ag.id}`,
    nom: `Procès-verbal de l'assemblée du ${ag.date.split('-').reverse().join('/')}`,
    type: 'pv_assemblee',
    categorie: 'pv_ag',
    personnel: false,
    mimeType: 'application/pdf',
    tailleOctets: 0,
    ajouteLe: ag.pvSigneLe ?? '',
    tags: ['Assemblée'],
  }))
  return [...pv, ...ged].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe))
}

function assurancesDeLaCopro(code: string): AssuranceImmeuble[] {
  return DEMO_CONTRATS_ASSURANCE.filter(([, , , , copros]) => copros.includes(code)).map(([intitule, assureurEtReference, echeance], rang) => {
    const [assureur, ...reste] = assureurEtReference.split('·').map((s) => s.trim())
    const fin = dateFrVersIso(echeance.replace(/^Échéance\s+/i, ''))
    const type: AssuranceImmeuble['type'] = /multirisque/i.test(intitule) ? 'multirriscos' : /^RC\b|responsabilit/i.test(intitule) ? 'responsabilidade_civil' : 'outros'
    return {
      id: `aj-assurance-${code}-${rang}`,
      assureur: `${assureur} — ${intitule}`,
      type,
      police: reste.join(' · '),
      primeAnnuelle: 0,
      capital: 0,
      debut: '',
      fin,
      statut: fin ? 'ativa' : 'renovacao',
    }
  })
}

// ── Assemblées ───────────────────────────────────────────────────────────────────────────────────────────────────

/** « 10 h 00 » → « 10:00 » (« 00:00 » si illisible). */
const heureIso = (heure: string): string => {
  const m = /(\d{1,2})\s*h\s*(\d{2})?/i.exec(heure)
  return m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : '00:00'
}

const STATUTS_AG: Record<FicheAssemblee['statut'], AssembleeCopro['statut'] | null> = {
  Projet: null,
  Convoquée: 'convoquee',
  Tenue: 'en_cours',
  'PV signé': 'cloturee',
  Notifiée: 'cloturee',
}

/** Identifiant de résolution du portail pour une assemblée de l'AJ (« ag-lm-2026-2:2 »), et son décodage. */
export const idResolutionAj = (agId: string, numero: number): string => `${agId}:${numero}`
export function decoderIdResolutionAj(id: string): { agId: string; numero: number } | null {
  const i = id.lastIndexOf(':')
  const numero = Number(id.slice(i + 1))
  return i > 0 && Number.isInteger(numero) ? { agId: id.slice(0, i), numero } : null
}

function assembleeDepuisFiche(fiche: FicheAssemblee, personneId: string, votes: VoteLiaison[]): AssembleeCopro | null {
  const statut = STATUTS_AG[fiche.statut]
  if (!statut) return null
  const resultats = resultatsResolutions(fiche)
  const resolutions = fiche.resolutions.map((r, rang): ResolutionCopro => {
    const { resolution, vote } = resultats[rang]
    const voteLiaison = votes.find((v) => v.agId === fiche.id && v.resolutionNumero === r.numero && v.coproprietaireId === personneId)
    const bulletin = r.bulletins?.[personneId] ?? null
    let etat: ResolutionCopro['statut'] = 'en_cours'
    if (resolution.etat === 'adoptee') etat = 'adoptee'
    else if (resolution.etat === 'rejetee') etat = 'rejetee'
    return {
      id: idResolutionAj(fiche.id, r.numero),
      numero: r.numero,
      titre: r.intitule,
      description: '',
      majorite: r.majorite,
      votePour: vote?.pour ?? 0,
      voteContre: vote?.contre ?? 0,
      voteAbstention: vote?.abstention ?? 0,
      statut: etat,
      monVote: voteLiaison?.choix ?? bulletin,
      monVoteLe: voteLiaison ? voteLiaison.date.slice(0, 10) : bulletin ? fiche.date : '',
    }
  })
  const nature = fiche.nature === 'Annuelle' ? 'annuelle' : fiche.nature === 'Spéciale' ? 'spéciale' : 'judiciaire'
  return {
    id: fiche.id,
    titre: `Assemblée générale ${nature} (n° ${fiche.numero})`,
    date: `${fiche.date}T${heureIso(fiche.heureDebut)}:00`,
    lieu: fiche.visio ? `${fiche.lieu} — également en visioconférence` : fiche.lieu,
    type: fiche.nature === 'Annuelle' ? 'ordinaire' : 'extraordinaire',
    statut,
    ordreDuJour: fiche.resolutions.map((r) => r.intitule),
    resolutions,
    totalTantiemes: fiche.feuille.reduce((total, ligne) => total + ligne.tantiemes, 0),
    pv: fiche.pvSigneLe ? [`Procès-verbal signé le ${fiche.pvSigneLe.split('-').reverse().join('/')}.`, fiche.notes].filter(Boolean).join(' ') : '',
    convocationEnvoyeeLe: fiche.convocationEnvoyeeLe ?? '',
  }
}

// ── Annonces : tableau d'affichage de l'AJ ───────────────────────────────────────────────────────────────────────

const CATEGORIES_AVIS: Record<string, CategorieAnnonce> = {
  Convocation: 'assembleia',
  Travaux: 'manutencao',
  Finances: 'financeiro',
  Juridique: 'outro',
  Sécurité: 'seguranca',
  Vie: 'social',
}

const prioriteAvis = (importance: string): AnnonceCopro['priorite'] => {
  if (importance === 'Urgente') return 'urgente'
  if (importance === 'Importante') return 'importante'
  return 'normal'
}

function annoncesDeLaCopro(copro: CoproprieteDemo, liaison: EtatLiaison, dateDuJour: string): AnnonceCopro[] {
  const publiees = liaison.avis.filter((a) => a.codeCopro === copro.code).map((a): AnnonceCopro => ({
    id: a.id,
    titre: a.titre,
    contenu: a.contenu,
    categorie: CATEGORIES_AVIS[a.categorie] ?? 'outro',
    priorite: prioriteAvis(a.importance),
    epinglee: a.importance !== '',
    date: a.date,
    immeuble: copro.nom,
  }))
  const affichees = DEMO_AVIS_AFFICHAGE.filter((avis) => estDeLaCopro(copro.code, avis[3])).map(([categorie, , importance, , titre, contenu], rang): AnnonceCopro => ({
    id: `aj-avis-${copro.code}-${rang}`,
    titre,
    contenu,
    categorie: CATEGORIES_AVIS[categorie] ?? 'outro',
    priorite: prioriteAvis(importance),
    epinglee: importance !== '',
    date: dateDuJour,
    immeuble: copro.nom,
  }))
  return [...publiees, ...affichees]
}

// ── Espace complet ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Espace du copropriétaire `personneId` de la copropriété `code` de l'AJ ; null si l'un ou l'autre est inconnu ou si
 * la personne n'appartient pas à cette copropriété.
 */
export function espaceDepuisAj(
  code: string,
  personneId: string,
  liaison: EtatLiaison,
  options: { dateDuJour?: string; maintenant?: Date } = {},
): EspaceCopro | null {
  const dateDuJour = options.dateDuJour ?? DATE_DU_JOUR_AJ_DEMO
  const copro = DEMO_COPROPRIETES.find((c) => c.code === code)
  const personne = copro ? coproprietairesDe(copro).find((p) => p.id === personneId) : undefined
  if (!copro || !personne) return null

  const ficheCopro = FICHES_COPROPRIETES_DEMO[copro.code]
  const tantiemes = lireTantiemes(personne.tantiemes)
  const { batiment, etage } = batimentEtEtage(personne.fiche.situation)
  const numLot = numeroDeLot(personne.lot)
  const adresse = decouperAdresse(copro.adresse)
  const assembleesAj = FICHES_ASSEMBLEES_DEMO.filter((ag) => ag.coproCode === copro.code)
  const votes = liaison.votes.filter((v) => v.codeCopro === copro.code)
  const reference = `${copro.code}${personne.fiche.numeroCompte}`
  const { appels, arriere } = appelsEtArriere(copro.budget, tantiemes, personne.solde, dateDuJour, reference)

  const impayes: ImpayeCopro[] = arriere > 0
    ? [{
        id: `aj-arriere-${personne.id}`,
        montant: arriere,
        nature: 'charges_courantes',
        depuis: `${Number(dateDuJour.slice(0, 4)) - 1}-10-01`,
        nbRelances: personne.statut === 'Contentieux' ? 3 : 1,
        derniereRelanceLe: '',
        statut: personne.statut === 'Contentieux' ? 'en_recouvrement' : 'ouvert',
      }]
    : []

  const mesDemandes = liaison.demandes
    .filter((d) => d.codeCopro === copro.code && d.coproprietaireId === personne.id)
    .map((d) => demandeDepuisLiaison(d, batiment, etage, numLot))

  return {
    source: 'aj',
    vueSuperAdmin: true,
    chargeLe: (options.maintenant ?? new Date()).toISOString(),
    dateDuJour,
    profil: {
      id: personne.id,
      prenom: personne.fiche.prenom ?? '',
      nom: personne.fiche.prenom ? personne.fiche.nomFamille : personne.nom,
      email: personne.mail,
      telephone: personne.tel,
      role: 'proprietaire',
      immeuble: copro.nom,
      batiment,
      etage,
      numLot,
      tantiemes: tantiemes.lot,
      quotePart: tantiemes.total > 0 ? arrondiCentimes((tantiemes.lot / tantiemes.total) * 100) : 0,
      totalTantiemes: tantiemes.total,
      solde: personne.solde,
      estOccupe: personne.locataire !== null,
    },
    autresLots: [],
    immeuble: {
      id: copro.id,
      nom: copro.nom,
      adresse: adresse.adresse,
      ville: adresse.ville,
      codePostal: adresse.codePostal,
      nbLots: copro.lots,
      anneeConstruction: null,
      typeImmeuble: ficheCopro?.lots.usage ?? '',
      gestionnaire: `${CABINET_AJ.nom}, ${qualiteCabinet(copro.fondement)} (${copro.tribunal}, RG ${copro.rg})`,
      budgetAnnuel: copro.budget,
      depensesAnnee: copro.depense,
      reglement: null,
    },
    syndic: {
      nom: `${CABINET_AJ.nom} — ${qualiteCabinet(copro.fondement)}`,
      adresse: '',
      ville: '',
      codePostal: '',
      telephone: '',
      email: CABINET_AJ.email,
    },
    interventions: {
      mesDemandes,
      immeuble: interventionsDeLImmeuble(copro.code, numLot),
    },
    finances: { solde: personne.solde, appels, factures: [], impayes },
    documents: { fichiers: documentsDeLaCopro(copro.code, assembleesAj), contrats: [], assurances: assurancesDeLaCopro(copro.code) },
    assemblees: assembleesAj
      .map((fiche) => assembleeDepuisFiche(fiche, personne.id, votes))
      .filter((ag): ag is AssembleeCopro => ag !== null),
    annonces: annoncesDeLaCopro(copro, liaison, dateDuJour),
  }
}
