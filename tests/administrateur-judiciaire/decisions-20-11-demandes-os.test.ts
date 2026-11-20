import { describe, expect, it } from 'vitest'
import {
  alertesRattachementFacture,
  changerStade,
  contestationDeLaFacture,
  controlerCloture,
  creerDemande,
  marquerSansFacture,
  modeleDeNature,
  rattacherFacture,
  terminerDemande,
  type Demande,
  type FactureDeDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import {
  controlerAvantEnvoiOs,
  creerSortieOs,
  envoyerOs,
  type ConstatUrgence,
  type ContexteEnvoiOs,
  type OptionsMotifsVisa,
  type SaisieDiffusion,
  type SaisieSortieOs,
  type SortieOrdreService,
} from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import { TOLERANCE_PREVU_PCT, comparerPrevuFacture } from '@/lib/administrateur-judiciaire/domain/facture-demande'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  CAUSES_DELAI_NON_CALCULE,
  etablirFinDelaiHorsOutil,
  finDelaiContestationAgParDestinataire,
  type ResultatDelaiContestationAg,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import {
  changerStatutReglement,
  selectionnerFacturesAPayer,
  type FactureAPayer,
} from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import { LIBELLES_NATURES_SUIVI, NATURES_SUIVI, depuisVigilanceMarches } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import {
  QUALIFICATIONS_DECENNALE,
  TABLE_DECENNALE_PROPOSEE,
  controlerAvantOrdreService,
  controlerAvantReglement,
  qualifierDecennale,
  verificationVigilanceDue,
  type MarcheEnExecution,
  type PiecesEntreprise,
  type TableDecennaleParType,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import { TYPE_TRAVAUX } from '@/lib/data/referentiels-gesteam-judiciaire'
import { chaineLe, lreLe } from './donnees-delai-contestation'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C des questions ouvertes du code, thème « demandes, ordres de service, entreprises et
 * paiements ») : F71, F72, F77, F81, F82, F83, F84, F87, F88, F89, F90, F91, F92. Données fictives.
 */

const OS = modeleDeNature('OS Copro')
if (OS === null) throw new Error('Modèle « OS Copro » attendu.')

const saisie = (surcharge: Partial<SaisieDemande> = {}): SaisieDemande => ({
  id: 'dem-1',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  prestataireId: 'ent-1',
  demandeLe: '2026-10-01',
  numero: '12.3.456',
  objet: 'Recherche de fuite colonne',
  prix: { montantTtcCentimes: 120_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 109_091 },
  ...surcharge,
})

const realisee = (surcharge: Partial<SaisieDemande> = {}): Demande => changerStade(creerDemande(saisie(surcharge), OS), 'Réalisée', { date: '2026-10-10' })
const contestee = (surcharge: Partial<SaisieDemande> = {}): Demande => changerStade(realisee(surcharge), 'Contestée', { date: '2026-10-11' })
const comptabilisee = (id: string): FactureDeDemande => ({ id, statut: 'Comptabilisée' })
const codes = (anomalies: readonly { code: string }[]): string[] => anomalies.map((a) => a.code)

const facture = (surcharge: Partial<FactureAPayer> = {}): FactureAPayer => ({
  id: 'f-1',
  prestataireId: 'ent-1',
  mode: 'Virement',
  statutSaisie: 'Enregistrée',
  comptabilisee: true,
  statutReglement: 'En attente',
  priorite: 5,
  echeance: '2026-11-01',
  resteDuCentimes: 120_000,
  ...surcharge,
})

describe('F71 — intervention « Contestée » : facture saisie avec une alerte, ni bon à payer ni clôture', () => {
  it('la facture se rattache à une intervention contestée, avec l’alerte « intervention contestée »', () => {
    const d = rattacherFacture(contestee(), 'f-1')
    expect(d.factureIds).toEqual(['f-1'])
    const [alerte, ...autres] = alertesRattachementFacture(contestee())
    expect(autres).toEqual([])
    expect([alerte.code, alerte.gravite]).toEqual(['intervention_contestee', 'alerte'])
    expect(alerte.message).toContain('Décision du 20/11/2026 (partie C, F71)')
    expect(alerte.message).toContain('ni bon à payer ni clôture')
    expect(alertesRattachementFacture(realisee())).toEqual([])
  })

  it('la clôture reste refusée tant que la contestation n’est pas levée', () => {
    const d = rattacherFacture(contestee(), 'f-1')
    const [anomalie] = controlerCloture(d, [comptabilisee('f-1')])
    expect([anomalie.code, anomalie.gravite]).toEqual(['intervention_contestee', 'bloquant'])
    expect(anomalie.message).toContain('stade suivant, avec un motif')
    expect(() => terminerDemande(d, [comptabilisee('f-1')], '2026-10-20')).toThrow(/Intervention contestée/)
  })

  it('la contestation se lève par le stade suivant, avec un motif obligatoire, tracé', () => {
    const d = contestee()
    expect(() => changerStade(d, 'Validée', { date: '2026-10-15' })).toThrow(/motif/)
    expect(() => changerStade(d, 'Validée', { date: '2026-10-15', motif: '   ' })).toThrow(/motif/)
    const levee = changerStade(d, 'Validée', { date: '2026-10-15', motif: ' Reprise faite par l’entreprise ' })
    expect(levee.stade).toBe('Validée')
    expect(levee.leveesContestation).toEqual([{ le: '2026-10-15', motif: 'Reprise faite par l’entreprise', stade: 'Validée' }])
    // le motif n'est demandé qu'à la sortie de « Contestée »
    expect(changerStade(realisee(), 'Validée', { date: '2026-10-12' }).leveesContestation).toBeUndefined()
    expect(changerStade(d, 'Contestée', { date: '2026-10-12' }).stade).toBe('Contestée')
    expect(terminerDemande(rattacherFacture(levee, 'f-1'), [comptabilisee('f-1')], '2026-10-20').statut).toBe('Terminé')
  })

  it('contestationDeLaFacture : la demande contestée qui porte la facture', () => {
    const demandes = [rattacherFacture(contestee({ id: 'dem-2' }), 'f-2'), rattacherFacture(realisee({ id: 'dem-3' }), 'f-3')]
    expect(contestationDeLaFacture('f-2', demandes)).toEqual({ demandeId: 'dem-2' })
    expect(contestationDeLaFacture('f-3', demandes)).toBeNull()
    expect(contestationDeLaFacture('f-9', demandes)).toBeNull()
  })

  it('bon à payer refusé, et aucun nouvel ordre, tant que l’intervention est contestée', () => {
    const enCause = facture({ interventionContestee: { demandeId: 'dem-2' } })
    expect(() => changerStatutReglement(enCause, 'Bon à payer')).toThrow(/Bon à payer refusé : l'intervention de la demande dem-2 est contestée/)
    expect(() => changerStatutReglement({ ...enCause, acompteCentimes: 10_000 }, 'Acompte à régler')).toThrow(/contestée/)
    expect(changerStatutReglement(facture(), 'Bon à payer').statutReglement).toBe('Bon à payer')
    const dejaBap = facture({ statutReglement: 'Bon à payer', interventionContestee: { demandeId: 'dem-2' } })
    expect(() => changerStatutReglement(dejaBap, 'En règlement')).toThrow(/contestée/)
    expect(changerStatutReglement(dejaBap, 'En attente').statutReglement).toBe('En attente')
    const selection = selectionnerFacturesAPayer([dejaBap, facture({ id: 'f-2', statutReglement: 'Bon à payer' })], {
      date: '2026-11-02',
      soldeDisponibleCentimes: 1_000_000,
    })
    expect(selection.retenues.map((f) => f.id)).toEqual(['f-2'])
    expect(selection.ecartees).toEqual([{ factureId: 'f-1', motif: 'intervention_contestee' }])
  })

  it('en-tête : la question de l’intervention contestée est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('demandes')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('Une intervention « Contestée » bloque-t-elle la facturation et la clôture')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F71)')
    expect(texte).toContain('L. 1965 art. 14-3')
    expect(enTeteDuModule('statuts-facture').texte).toContain('Décision du 20/11/2026 (partie C, F71)')
  })
})

describe('F72 — clôture : facture rattachée ou « Non facturé », « Réalisée » suffit', () => {
  it('(1) bloquant sans facture ni « Non facturé » ; (2) facture non comptabilisée : alerte ; (3) non validée : alerte', () => {
    expect(controlerCloture(realisee(), []).map((a) => [a.code, a.gravite])).toEqual([
      ['intervention_non_validee', 'alerte'],
      ['facture_absente', 'bloquant'],
    ])
    expect(() => terminerDemande(realisee(), [], '2026-10-20')).toThrow(/Aucune facture rattachée/)
    const nonComptabilisee = controlerCloture(rattacherFacture(realisee(), 'f-1'), [{ id: 'f-1', statut: 'À traiter' }])
    expect(nonComptabilisee.map((a) => [a.code, a.gravite])).toEqual([
      ['intervention_non_validee', 'alerte'],
      ['facture_non_comptabilisee', 'alerte'],
    ])
    // « Réalisée » suffit : la clôture passe avec ses alertes
    expect(terminerDemande(rattacherFacture(realisee(), 'f-1'), [{ id: 'f-1', statut: 'À traiter' }], '2026-10-20').statut).toBe('Terminé')
    expect(terminerDemande(marquerSansFacture(realisee(), true), [], '2026-10-20').statut).toBe('Terminé')
  })

  it('en-tête : la question « Terminé » est remplacée par la décision, la question du bouton « Non facturé » reste', () => {
    const { texte } = enTeteDuModule('demandes')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('« Terminé » exige-t-il une facture comptabilisée')
    expect(questions).toContain('« Non facturé »')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F72)')
    expect(texte).toContain('arrêté du 14/03/2005, art. 10')
  })
})

describe('F91 — tolérance de 5 % : réglage propre aux demandes, au départ égal à celui des contrats', () => {
  it('5 % par défaut ; le réglage des demandes s’ajuste sans toucher aux contrats ; un écart au-delà reste signalé', () => {
    expect(TOLERANCE_PREVU_PCT).toBe(5)
    const d = realisee()
    expect(comparerPrevuFacture(d, [126_000]).anomalies).toEqual([])
    expect(codes(comparerPrevuFacture(d, [127_200]).anomalies)).toEqual(['facture_au_dessus_prevu'])
    expect(comparerPrevuFacture(d, [127_200], { tolerancePct: 6 }).anomalies).toEqual([])
    expect(codes(comparerPrevuFacture(d, [127_200], { tolerancePct: 5 }).anomalies)).toEqual(['facture_au_dessus_prevu'])
  })

  it('en-tête : la question de la tolérance est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('facture-demande')
    expect(texte).not.toContain('la tolérance de 5 % entre le prévu et le facturé (reprise des contrats) convient-elle')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F91)')
    expect(texte).not.toContain('🔴 Non établi')
  })
})

// ─── Ordres de service (F77, F81, F82) ──────────────────────────────────────────────────────

const PRETE: SaisieSortieOs = { signataireId: 'col-direction', canal: 'messagerie_vitfix', fondement: 'administration_courante', entrepriseLiee: false }
const demandeOs = (surcharge: Partial<SaisieDemande> = {}): Demande => creerDemande(saisie({ prevuLe: '2026-10-15', ...surcharge }), OS)
const sortie = (d: Demande, s: SaisieSortieOs = {}, options: OptionsMotifsVisa = {}): SortieOrdreService => creerSortieOs(d, { ...PRETE, ...s }, options)
const PIECES: PiecesEntreprise = {
  prestataireId: 'ent-1',
  etablieEnFrance: true,
  attestationUrssafLe: '2026-09-01',
  attestationUrssafVerifiee: true,
  immatriculation: { nature: 'kbis', le: '2026-09-01' },
}
const CONTEXTE: ContexteEnvoiOs = { date: '2026-10-03', pieces: PIECES, controle: { decennaleObligatoire: false }, prestataireAvecCompteVitfix: true }
const CONSTAT: ConstatUrgence = { constateLe: '2026-10-02', motif: 'Fuite active sur colonne', collaborateurId: 'col-direction' }
const ENVOI: SaisieDiffusion = {
  date: '2026-10-03',
  heure: '10:00',
  collaborateurId: 'col-gestion',
  canal: 'messagerie_vitfix',
  destinataire: creerRattachement('Entreprise', 'ent-1'),
  missionId: 'mission-1',
}
const bloquants = (anomalies: readonly { code: string; gravite: string }[]): string[] => anomalies.filter((a) => a.gravite === 'bloquant').map((a) => a.code)
const finConnue = (fin: string): ResultatDelaiContestationAg => ({
  etat: 'calcule',
  echeanceRetenue: fin,
  echeanceLaPlusTardive: fin,
  dernierDestinataire: 'id-1',
  destinataires: [],
  justification: `Fin du délai du seul opposant ou défaillant : le ${fin}.`,
  avertissements: [],
  aConfirmer: null,
})
const resolution = (d: Demande, s: SaisieSortieOs = {}): SortieOrdreService =>
  sortie(d, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution: 'art25', ...s })
/** Signataires habilités du cabinet : la direction seulement (réglage fictif). */
const HABILITES: ContexteEnvoiOs = { ...CONTEXTE, signatairesHabilites: new Set(['col-direction']) }
const parStagiaire: ConstatUrgence = { ...CONSTAT, collaborateurId: 'col-stagiaire' }
const PRIX_GROS = { montantTtcCentimes: 660_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 600_000 }

describe('F77 — constat d’urgence par une personne hors des signataires habilités : l’urgence n’est pas retenue', () => {
  const cadreAj: SaisieSortieOs = {
    fondement: 'decision_aj_pouvoirs_ag',
    fondementReference: 'registre n° 7',
    decisionLe: '2026-10-02',
    delai: 'urgence',
    justificatifs: { modeFinancement: 'appel de fonds' },
  }

  it('le constat ne vaut pas constat : l’avis du conseil syndical reste exigé, le message dit de faire constater par un signataire habilité', () => {
    const d = demandeOs()
    const s = sortie(d, { ...cadreAj, constatUrgence: parStagiaire }, { signatairesHabilites: HABILITES.signatairesHabilites })
    expect(s.visa).toBe('Visa nécessaire')
    const anomalies = controlerAvantEnvoiOs(d, s, HABILITES)
    const auteur = anomalies.find((a) => a.code === 'constat_urgence_auteur_non_habilite')
    expect(auteur).toMatchObject({ gravite: 'alerte', aConfirmer: false, fondement: null })
    expect(auteur?.message).toBe(
      "Urgence constatée par col-stagiaire, qui n'est ni un signataire habilité du cabinet ni l'administrateur désigné : ce constat ne vaut pas constat, l'urgence n'est pas retenue : l'avis préalable du conseil syndical reste exigé (D. 1967 art. 62-7) ; faire constater l'urgence par un signataire habilité — Décision du 20/11/2026 (partie C, F77).",
    )
    expect(bloquants(anomalies)).toContain('avis_conseil_syndical_aj_absent')
    expect(() => envoyerOs(d, s, ENVOI, HABILITES)).toThrow(/non envoyé/)
  })

  it('l’OS reste soumis à la suspension de l’art. 42, al. 3 et au blocage de la vigilance', () => {
    const d = demandeOs({ prix: PRIX_GROS })
    const urgente = (constatUrgence: ConstatUrgence) => resolution(d, { delai: 'urgence', constatUrgence })
    const fin = { ...HABILITES, delaiContestationAg: finConnue('2026-11-20') }
    expect(bloquants(controlerAvantEnvoiOs(d, urgente(CONSTAT), fin))).toEqual([])
    expect(bloquants(controlerAvantEnvoiOs(d, urgente(parStagiaire), fin))).toEqual(['execution_suspendue_art42'])
    const sansPieces = { ...HABILITES, pieces: undefined }
    expect(bloquants(controlerAvantEnvoiOs(d, sortie(d, { delai: 'urgence', constatUrgence: CONSTAT }), sansPieces))).toEqual([])
    expect(bloquants(controlerAvantEnvoiOs(d, sortie(d, { delai: 'urgence', constatUrgence: parStagiaire }), sansPieces))).toEqual(['controle_declaratif_non_fait'])
  })

  it('liste du cabinet non fournie, ou auteur administrateur désigné : l’urgence est retenue', () => {
    const d = demandeOs()
    const fin = (contexte: ContexteEnvoiOs): ContexteEnvoiOs => ({ ...contexte, delaiContestationAg: finConnue('2026-11-20') })
    const urgente = resolution(d, { delai: 'urgence', constatUrgence: parStagiaire })
    expect(bloquants(controlerAvantEnvoiOs(d, urgente, fin(CONTEXTE)))).toEqual([])
    const designe = controlerAvantEnvoiOs(d, urgente, fin({ ...HABILITES, administrateurDesigneId: 'col-stagiaire' }))
    expect(bloquants(designe)).toEqual([])
    expect(designe.map((a) => a.code)).not.toContain('constat_urgence_auteur_non_habilite')
  })

  it('en-tête : la question de l’auteur du constat est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain("l'auteur du constat d'urgence doit-il être un signataire habilité")
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F77)')
    expect(texte).toContain('D. 1967 art. 62-7')
  })
})

describe('F81 — pièces de vigilance manquantes ou non saisies : blocage gardé avant l’OS, sauf urgence constatée', () => {
  it('pièces non saisies : bloquant, le message dit quelles pièces manquent et comment les saisir ; décidé, plus « à confirmer »', () => {
    const d = demandeOs({ prix: PRIX_GROS })
    const [anomalie] = controlerAvantEnvoiOs(d, sortie(d), { ...CONTEXTE, pieces: undefined })
    expect(anomalie).toMatchObject({ code: 'controle_declaratif_non_fait', gravite: 'bloquant', aConfirmer: false })
    expect(anomalie.message).toContain('attestation de vigilance (URSSAF, CGSS ou MSA)')
    expect(anomalie.message).toContain("pièce d'immatriculation")
    expect(anomalie.message).toContain('les saisir avec leur date de remise')
    expect(anomalie.message).toContain('Décision du 20/11/2026 (partie C, F81)')
    const petit = demandeOs()
    const [decennale] = controlerAvantEnvoiOs(petit, sortie(petit), { ...CONTEXTE, pieces: undefined, controle: { decennaleObligatoire: true } })
    expect(decennale.message).toContain("attestation d'assurance décennale")
  })

  it('pièce saisie absente : bloquant, avec la manière de la saisir ; sous urgence constatée, alerte forte, la décennale restant bloquante', () => {
    const d = demandeOs({ prix: PRIX_GROS })
    const sansUrssaf: ContexteEnvoiOs = { ...CONTEXTE, pieces: { ...PIECES, attestationUrssafLe: null } }
    const [absente] = controlerAvantEnvoiOs(d, sortie(d), sansUrssaf)
    expect([absente.code, absente.gravite]).toEqual(['vigilance_urssaf_absente', 'bloquant'])
    expect(absente.message).toContain('puis à saisir avec sa date de remise')
    const urgente = sortie(d, { delai: 'urgence', constatUrgence: CONSTAT })
    expect(bloquants(controlerAvantEnvoiOs(d, urgente, sansUrssaf))).toEqual([])
    expect(bloquants(controlerAvantEnvoiOs(d, urgente, { ...sansUrssaf, controle: { decennaleObligatoire: true } }))).toEqual(['decennale_absente'])
  })

  it('en-tête : la question de la vigilance avant l’OS est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('y compris quand les pièces ne sont pas fournies, à confirmer')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F81)')
    expect(texte).toContain('Cass. 2e civ., 05/12/2024, n° 22-21.152')
  })
})

describe('F82 — majorité et fondement non saisis : bloquants ; assignation, aide juridictionnelle, fin du délai établie hors de l’outil', () => {
  it('(1) majorité non saisie : bloquant, comme une fin de délai inconnue (J51) ; sous urgence retenue, rien', () => {
    const d = demandeOs()
    const [majorite, ...autres] = controlerAvantEnvoiOs(d, resolution(d, { majoriteResolution: null }), { ...CONTEXTE, delaiContestationAg: finConnue('2026-09-30') })
    expect(autres).toEqual([])
    expect(majorite).toMatchObject({ code: 'majorite_resolution_non_renseignee', gravite: 'bloquant', aConfirmer: false, fondement: 'L. 1965 art. 42, al. 3' })
    expect(majorite.message).toContain('Décision du 20/11/2026 (partie C, F82)')
    expect(majorite.message).toContain('saisir la majorité de la résolution')
    expect(controlerAvantEnvoiOs(d, resolution(d, { majoriteResolution: null, delai: 'urgence', constatUrgence: CONSTAT }), CONTEXTE)).toEqual([])
  })

  it('(2) fondement non choisi : bloquant ; la liste est rappelée ; une demande de devis n’est pas contrôlée', () => {
    const d = demandeOs()
    const [fondement, ...autres] = controlerAvantEnvoiOs(d, sortie(d, { fondement: null }), CONTEXTE)
    expect(autres).toEqual([])
    expect(fondement).toMatchObject({ code: 'fondement_non_renseigne', gravite: 'bloquant', aConfirmer: false, fondement: null })
    expect(fondement.message).toContain("administration et entretien de l'immeuble")
    expect(fondement.message).toContain('Décision du 20/11/2026 (partie C, F82)')
    const DEVIS = modeleDeNature('Demande devis Copro')
    if (DEVIS === null) throw new Error('Modèle de devis attendu.')
    const devis = creerDemande(saisie({ id: 'dev-1' }), DEVIS)
    expect(controlerAvantEnvoiOs(devis, sortie(devis, { fondement: null }), CONTEXTE)).toEqual([])
  })

  it('(3) AG contestée par assignation : alerte sur tout OS qui exécute une de ses résolutions', () => {
    const d = demandeOs()
    const assignee: ContexteEnvoiOs = { ...CONTEXTE, assignationsContestationAg: [{ recueLe: '2026-10-01', reference: 'RG 26/01234' }] }
    const [alerte, ...autres] = controlerAvantEnvoiOs(d, resolution(d, { majoriteResolution: 'art24' }), assignee)
    expect(autres).toEqual([])
    expect(alerte).toMatchObject({ code: 'ag_contestee_par_assignation', gravite: 'alerte', aConfirmer: false })
    expect(alerte.message).toContain('assignation reçue le 01/10/2026 (RG 26/01234)')
    expect(alerte.message).toContain("l'exécution n'empêche pas l'annulation")
    expect(alerte.message).toContain('Décision du 20/11/2026 (partie C, F82)')
    // reçue après l'envoi, ou OS qui n'exécute pas une résolution : rien
    expect(controlerAvantEnvoiOs(d, resolution(d, { majoriteResolution: 'art24' }), { ...assignee, date: '2026-09-30' })).toEqual([])
    expect(controlerAvantEnvoiOs(d, sortie(d), assignee)).toEqual([])
    expect(() => controlerAvantEnvoiOs(d, sortie(d), { ...CONTEXTE, assignationsContestationAg: [{ recueLe: '01/10/2026', reference: null }] })).toThrow(/AAAA-MM-JJ/)
  })

  it('(4) demande d’aide juridictionnelle connue avant la fin du délai : fin inconnue pour ce copropriétaire, OS bloqué', () => {
    const calcul = (demandeAideJuridictionnelleLe: string | null) =>
      finDelaiContestationAgParDestinataire(chaineLe('2026-03-05'), [lreLe('2026-03-05')], 'ag-1', {
        opposantsOuDefaillants: 1,
        notifications: [{ identiteId: 'id-1', courrierId: 'k1', professionnel: true, demandeAideJuridictionnelleLe }],
      })
    const sans = calcul(null)
    if (sans.etat !== 'calcule') throw new Error(`Délai calculé attendu : ${JSON.stringify(sans)}`)
    expect(CAUSES_DELAI_NON_CALCULE).toContain('aide_juridictionnelle_demandee')
    const avant = calcul('2026-04-20')
    expect(avant).toMatchObject({ etat: 'refuse', cause: 'aide_juridictionnelle_demandee' })
    if (avant.etat !== 'refuse') throw new Error('refus attendu')
    expect(avant.motif).toContain("décret du 28/12/2020 relatif à l'aide juridictionnelle, art. 43")
    expect(avant.motif).toContain('Décision du 20/11/2026 (partie C, F82)')
    // déposée après la fin de son délai : sans effet sur le calcul
    expect(calcul('2026-06-01')).toMatchObject({ etat: 'calcule', echeanceLaPlusTardive: sans.echeanceLaPlusTardive })
    expect(() => calcul('20/04/2026')).toThrow(/AAAA-MM-JJ/)
    const d = demandeOs()
    const [bloque] = controlerAvantEnvoiOs(d, resolution(d), { ...CONTEXTE, delaiContestationAg: avant })
    expect([bloque.code, bloque.gravite]).toEqual(['delai_contestation_inconnu', 'bloquant'])
    expect(bloque.message).toContain("attendre la décision sur l'aide juridictionnelle")
  })

  it('(5) fin du délai établie hors de l’outil : motif et pièce obligatoires, tracée ; lue par le contrôle de l’OS', () => {
    const etablie = etablirFinDelaiHorsOutil({
      fin: '2025-06-30',
      motif: ' AG de 2025, notifications antérieures à la reprise ',
      pieceId: ' doc-cnr-1 ',
      collaborateurId: 'col-direction',
      saisieLe: '2026-10-01',
    })
    expect(etablie).toMatchObject({ etat: 'etablie_hors_outil', fin: '2025-06-30', motif: 'AG de 2025, notifications antérieures à la reprise', pieceId: 'doc-cnr-1' })
    expect(etablie.justification).toContain('Décision du 20/11/2026 (partie C, F82)')
    const d = demandeOs()
    expect(controlerAvantEnvoiOs(d, resolution(d), { ...CONTEXTE, delaiContestationAg: etablie })).toEqual([])
    const pendant = etablirFinDelaiHorsOutil({ fin: '2026-11-20', motif: 'Certificat du greffe', pieceId: 'doc-2', collaborateurId: 'col-direction', saisieLe: '2026-10-01' })
    expect(bloquants(controlerAvantEnvoiOs(d, resolution(d), { ...CONTEXTE, delaiContestationAg: pendant }))).toEqual(['execution_suspendue_art42'])
    const base = { fin: '2025-06-30', motif: 'AG ancienne', pieceId: 'doc-1', collaborateurId: 'col-direction', saisieLe: '2026-10-01' }
    expect(() => etablirFinDelaiHorsOutil({ ...base, motif: ' ' })).toThrow(/motif/)
    expect(() => etablirFinDelaiHorsOutil({ ...base, pieceId: '' })).toThrow(/pièce/)
    expect(() => etablirFinDelaiHorsOutil({ ...base, collaborateurId: '' })).toThrow(/collaborateur/)
    expect(() => etablirFinDelaiHorsOutil({ ...base, fin: '30/06/2025' })).toThrow(/AAAA-MM-JJ/)
  })

  it('en-têtes : les contournements et les trois ajouts ne sont plus des questions ; la décision est citée', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('deux contournements du blocage restent ouverts')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F82)')
    expect(texte).toContain('Cass. 3e civ., 24/11/2021, n° 20-22.487')
    expect(enTeteDuModule('statut-assemblee').texte).toContain('Décision du 20/11/2026 (partie C, F82)')
    expect(enTeteDuModule('statut-assemblee').texte).toContain("décret du 28/12/2020 relatif à l'aide juridictionnelle, art. 43")
  })
})

// ─── Entreprises (F89, F90) ─────────────────────────────────────────────────────────────────

describe('F89 — décennale obligatoire : VitFix propose une valeur par type de travaux, l’utilisateur décide', () => {
  const VALIDEE: TableDecennaleParType = { ...TABLE_DECENNALE_PROPOSEE, valideeLe: '2026-11-25' }

  it('une valeur proposée (« oui », « non », « à qualifier ») pour chacun des types de travaux', () => {
    expect(QUALIFICATIONS_DECENNALE).toEqual(['oui', 'non', 'a_qualifier'])
    expect(Object.keys(TABLE_DECENNALE_PROPOSEE.valeurs).sort((a, b) => a.localeCompare(b))).toEqual([...TYPE_TRAVAUX].sort((a, b) => a.localeCompare(b)))
    for (const type of TYPE_TRAVAUX) expect(QUALIFICATIONS_DECENNALE).toContain(TABLE_DECENNALE_PROPOSEE.valeurs[type])
    expect(TABLE_DECENNALE_PROPOSEE.valeurs.Diagnostic).toBe('non')
    expect(TABLE_DECENNALE_PROPOSEE.valeurs.Expertise).toBe('non')
    expect(TABLE_DECENNALE_PROPOSEE.valeurs.Procédures).toBe('non')
    expect(TABLE_DECENNALE_PROPOSEE.valeurs.Etanchéité).toBe('oui')
    // proposition de VitFix : à valider une fois par le responsable du projet
    expect(TABLE_DECENNALE_PROPOSEE.valideeLe).toBeNull()
  })

  it('la demande reprend la valeur de la table validée ; tant qu’elle n’est pas validée, l’alerte « à qualifier » reste', () => {
    expect(qualifierDecennale('Etanchéité', VALIDEE)).toMatchObject({ decennaleObligatoire: true, proposee: 'oui', origine: 'table', choix: null })
    expect(qualifierDecennale('Diagnostic', VALIDEE)).toMatchObject({ decennaleObligatoire: false, proposee: 'non' })
    expect(qualifierDecennale('Travaux', VALIDEE)).toMatchObject({ decennaleObligatoire: null, proposee: 'a_qualifier' })
    expect(qualifierDecennale(null, VALIDEE)).toMatchObject({ decennaleObligatoire: null, proposee: 'a_qualifier' })
    const nonValidee = qualifierDecennale('Etanchéité', TABLE_DECENNALE_PROPOSEE)
    expect(nonValidee).toMatchObject({ decennaleObligatoire: null, proposee: 'oui', tableValidee: false })
    expect(nonValidee.justification).toContain('à valider')
  })

  it('l’utilisateur change la valeur : son choix l’emporte et il est tracé (collaborateur, date) ; à qualifier, l’alerte reste', () => {
    const choix = { valeur: 'non' as const, collaborateurId: 'col-gestion', le: '2026-11-26', motif: ' Pose d’un équipement dissociable ' }
    const q = qualifierDecennale('Etanchéité', VALIDEE, choix)
    expect(q).toMatchObject({ decennaleObligatoire: false, proposee: 'oui', origine: 'choix', choix: { ...choix, motif: 'Pose d’un équipement dissociable' } })
    expect(q.justification).toContain('col-gestion')
    expect(q.justification).toContain('Décision du 20/11/2026 (partie C, F89)')
    expect(qualifierDecennale('Etanchéité', TABLE_DECENNALE_PROPOSEE, { ...choix, valeur: 'oui' }).decennaleObligatoire).toBe(true)
    expect(qualifierDecennale('Etanchéité', VALIDEE, { ...choix, valeur: 'a_qualifier' }).decennaleObligatoire).toBeNull()
    expect(() => qualifierDecennale('Etanchéité', VALIDEE, { ...choix, collaborateurId: ' ' })).toThrow(/collaborateur/)
    expect(() => qualifierDecennale('Etanchéité', VALIDEE, { ...choix, le: '26/11/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => qualifierDecennale('Etanchéité', VALIDEE, { ...choix, valeur: 'peut-etre' as never })).toThrow(/oui, non ou a_qualifier/)
    // la valeur retenue nourrit le contrôle avant l'OS : à qualifier, l'alerte decennale_a_qualifier
    const operation = { date: '2026-11-26', montantHtCentimes: 100_000, decennaleObligatoire: qualifierDecennale('Travaux', VALIDEE).decennaleObligatoire }
    expect(controlerAvantOrdreService(PIECES, operation).map((a) => a.code)).toEqual(['decennale_a_qualifier'])
  })

  it('en-tête : la qualification de la décennale n’est plus une question ouverte', () => {
    const { texte } = enTeteDuModule('vigilance-entreprises')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F89)')
    expect(texte).not.toContain('laissée à l\'utilisateur (`decennaleObligatoire: null` → alerte à qualifier)')
    expect(texte).toContain('C. ass. art. L. 241-1')
  })
})

describe('F90 — avant un paiement : alerte sans blocage ; élément « à faire » tous les six mois pendant l’exécution', () => {
  const MARCHE: MarcheEnExecution = {
    id: 'dem-7',
    prestataireId: 'ent-1',
    mandatId: 'mandat-1',
    concluLe: '2026-01-15',
    finExecutionLe: null,
    montantHtCentimes: 600_000,
    attestationLe: '2026-01-10',
    assigneId: 'col-gestion',
  }

  it('l’élément est dû six mois après la conclusion, puis tous les six mois ; une attestation à jour le reporte', () => {
    expect(verificationVigilanceDue(MARCHE)).toMatchObject({ id: 'vigilance:semestrielle:dem-7', date: '2026-07-15', rang: 1 })
    // attestation du 10/07/2026 : de moins de six mois au 15/07/2026, plus au 15/01/2027
    expect(verificationVigilanceDue({ ...MARCHE, attestationLe: '2026-07-10' })).toMatchObject({ date: '2027-01-15', rang: 2 })
    // datée après l'échéance, elle la couvre, et la suivante tant qu'elle a moins de six mois (D. 8222-5)
    expect(verificationVigilanceDue({ ...MARCHE, attestationLe: '2026-07-20' })).toMatchObject({ date: '2027-07-15', rang: 3 })
    expect(verificationVigilanceDue({ ...MARCHE, attestationLe: null })?.date).toBe('2026-07-15')
    const due = verificationVigilanceDue(MARCHE)
    expect(due?.justification).toContain('C. trav. art. L. 8222-1')
    expect(due?.justification).toContain('Décision du 20/11/2026 (partie C, F90)')
  })

  it('rien sous le seuil de vigilance, ni après la fin de l’exécution', () => {
    expect(verificationVigilanceDue({ ...MARCHE, montantHtCentimes: 499_999 })).toBeNull()
    expect(verificationVigilanceDue({ ...MARCHE, finExecutionLe: '2026-06-30' })).toBeNull()
    expect(verificationVigilanceDue({ ...MARCHE, finExecutionLe: '2026-07-15' })?.date).toBe('2026-07-15')
    expect(() => verificationVigilanceDue({ ...MARCHE, concluLe: '15/01/2026' })).toThrow(/AAAA-MM-JJ/)
  })

  it('suivi « à faire » : famille « demandes », nature « vigilance_semestrielle », assignée au collaborateur du marché', () => {
    expect(NATURES_SUIVI.demandes).toContain('vigilance_semestrielle')
    expect(LIBELLES_NATURES_SUIVI.vigilance_semestrielle).toBeTruthy()
    expect(depuisVigilanceMarches([MARCHE, { ...MARCHE, id: 'dem-8', montantHtCentimes: 10_000 }])).toEqual([
      {
        id: 'demandes:vigilance_semestrielle:dem-7',
        famille: 'demandes',
        nature: 'vigilance_semestrielle',
        libelle: "Demander à l'entreprise son attestation de vigilance à jour (marché dem-7 en cours d'exécution, vérification n° 1)",
        date: '2026-07-15',
        mandatId: 'mandat-1',
        objetId: 'dem-7',
        assigneId: 'col-gestion',
        aConfirmer: false,
      },
    ])
  })

  it('avant le règlement : alerte seulement ; l’alerte rappelle l’élément « à faire » quand il est en retard', () => {
    const pieces: PiecesEntreprise = { ...PIECES, attestationUrssafLe: '2026-01-10', immatriculation: { nature: 'kbis', le: '2026-01-10' } }
    const reglement = { date: '2026-09-01', montantHtCentimes: 600_000, execution: { marcheId: 'dem-7', concluLe: '2026-01-15', finExecutionLe: null } }
    const anomalies = controlerAvantReglement(pieces, reglement)
    expect(anomalies.every((a) => a.gravite === 'alerte')).toBe(true)
    const rappel = anomalies.find((a) => a.code === 'verification_semestrielle_en_retard')
    expect(rappel).toMatchObject({ gravite: 'alerte', fondement: 'C. trav. art. L. 8222-1, D. 8222-5' })
    expect(rappel?.message).toContain('élément « à faire » du 15/07/2026')
    expect(rappel?.message).toContain("aucun texte n'impose de suspendre le paiement")
    // pas encore en retard, ou sans le marché : pas de rappel
    expect(controlerAvantReglement(pieces, { ...reglement, date: '2026-07-15' }).map((a) => a.code)).not.toContain('verification_semestrielle_en_retard')
    expect(controlerAvantReglement(pieces, { date: '2026-09-01', montantHtCentimes: 600_000 }).map((a) => a.code)).not.toContain(
      'verification_semestrielle_en_retard',
    )
  })

  it('en-têtes : l’alerte avant règlement n’est plus une question ; suivi-a-faire.ts cite la décision', () => {
    const { texte } = enTeteDuModule('vigilance-entreprises')
    expect(texte).not.toContain('🔴 Non établi')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F90)')
    expect(texte).toContain('D. 8222-5')
    expect(enTeteDuModule('suivi-a-faire').texte).toContain('Décision du 20/11/2026 (partie C, F90)')
  })
})

describe('Décisions du 20/11/2026 (partie C) — relecture indépendante : F77 et F82', () => {
  it('F77 — un constat hors des signataires habilités ne vaut pas constat : il ne tient pas non plus lieu de l’avis (pas d’alerte « constat postérieur »)', () => {
    const d = demandeOs()
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      delai: 'urgence',
      justificatifs: { modeFinancement: 'appel de fonds' },
    }
    const codesDuConstat = (constat: ConstatUrgence): string[] =>
      controlerAvantEnvoiOs(d, sortie(d, { ...cadre, constatUrgence: { ...constat, constateLe: '2026-10-03' } }), HABILITES).map((a) => a.code)
    // constat d'un signataire habilité, daté après la décision au registre : l'alerte de J46 reste
    expect(codesDuConstat(CONSTAT)).toContain('constat_urgence_posterieur')
    // hors des habilités : le constat ne vaut rien, l'avis du conseil syndical reste dû
    const horsListe = codesDuConstat(parStagiaire)
    expect(horsListe).not.toContain('constat_urgence_posterieur')
    expect(horsListe).toContain('constat_urgence_auteur_non_habilite')
    expect(horsListe).toContain('avis_conseil_syndical_aj_absent')
  })

  it('F82 (5) — une fin du délai « établie hors de l’outil » reprise d’ailleurs sans motif, sans pièce ou sans auteur n’est pas lue', () => {
    const d = demandeOs()
    const etablie = etablirFinDelaiHorsOutil({ fin: '2025-06-30', motif: 'AG ancienne', pieceId: 'doc-1', collaborateurId: 'col-direction', saisieLe: '2026-10-01' })
    const controler = (delaiContestationAg: ResultatDelaiContestationAg) => controlerAvantEnvoiOs(d, resolution(d), { ...CONTEXTE, delaiContestationAg })
    expect(controler(etablie)).toEqual([])
    expect(() => controler({ ...etablie, motif: ' ' })).toThrow(/motif obligatoire/)
    expect(() => controler({ ...etablie, pieceId: '' })).toThrow(/pièce obligatoire/)
    expect(() => controler({ ...etablie, collaborateurId: '' })).toThrow(/collaborateur/)
    expect(() => controler({ ...etablie, fin: '30/06/2025' })).toThrow(/AAAA-MM-JJ/)
  })
})
