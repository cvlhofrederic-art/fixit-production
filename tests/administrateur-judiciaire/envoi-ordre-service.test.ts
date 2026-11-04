import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CourrierSuivi } from '@/lib/administrateur-judiciaire/domain/courriers'
import type { DecisionAnnuelle, TypeDecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import {
  codificationFacture,
  creerDemande,
  modeleDeNature,
  verifierSansBloquant,
  type Demande,
  type ModeleDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import {
  CANAUX_ENVOI_OS,
  FORME_ENVOI_PAR_CANAL,
  LONGUEUR_MAX_NUMERO_OS,
  LONGUEUR_MAX_OBJET_OS,
  REGLES_VISA_PAR_DEFAUT,
  VISAS_PERMETTANT_ENVOI,
  VISAS_SORTIE,
  anomaliesCircuitVisa,
  appliquerActionVisa,
  attendusOs,
  autorisationConvention,
  circuitVisaInitial,
  controlerAvantEnvoiOs,
  creerSortieOs,
  demandeEnvoiDepuisOs,
  demanderVisa,
  devisCaducALaReception,
  donnerVisa,
  ecartArCourrier,
  enregistrerRapport,
  enregistrerReception,
  envoyerOs,
  estEnvoye,
  estRecu,
  exigerVisa,
  fixerRelance,
  formaterNumeroOs,
  lireNumeroOs,
  marquerDiffusable,
  modifierSortieOs,
  motifsVisa,
  numeroterDemande,
  premierEnvoi,
  preuveDeDiffusion,
  preuveDeReception,
  preuveReceptionOs,
  rangOsSuivant,
  refuserVisa,
  relancerOs,
  relancesOsDues,
  revoirCircuitVisa,
  revoirVisa,
  visaPermetSortie,
  type CircuitVisa,
  type ConstatUrgence,
  type ContexteEnvoiOs,
  type EvenementDiffusion,
  type OptionsVisa,
  type PieceVisee,
  type ReglesVisaOs,
  type SaisieDiffusion,
  type SaisieEvenementVisa,
  type SaisieReception,
  type SaisieSortieOs,
  type SortieOrdreService,
} from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'
import type { PiecesEntreprise } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import { FORME_ENVOI_COURRIER } from '@/lib/data/referentiels-gesteam-judiciaire'
import { ajOrdrePrestataireSchema } from '@/lib/validation'

/**
 * Ordres de service : numérotation, visa de sortie, envoi et journal de diffusion (point 44 du bilan 2 ; Gestéam, tranche
 * 34 : N° <mandat>.<plan>.<n°>, Signature, Délai, Envoi, Relance, Diffuser, journal de diffusion ; tranche 40 : référentiel
 * Visa de sortie). Droit relu le 30/10/2026 : L. 1965 art. 18, 18-1 A, 21, 21-1 à 21-3, 25, 29-1, 42 ; D. 1967 art. 19-2,
 * 37, 39, 62-7, 62-8 ; C. civ. art. 1117, 1118, 1121, 1126, 1127, 1127-4 ; loi n° 2004-575 art. 1er, IV ; L. 1965
 * art. 18, IV, 29-1, I et 42, al. 2 et 3 relus le 04/11/2026 (versions en vigueur au 03/11/2026). Décisions de Hugo du
 * 03/11/2026 : J11 à J19.
 */

const modele = (nature: string): ModeleDemande => {
  const trouve = modeleDeNature(nature)
  if (!trouve) throw new Error(`Modèle absent du test : ${nature}`)
  return trouve
}

const OS = modele('OS Copro')
const DEVIS = modele('Demande devis Copro')
const HUISSIER = modele('Huissier - exécution forcée')

const saisieDemande = (surcharge: Partial<SaisieDemande> = {}): SaisieDemande => ({
  id: 'dem-1',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  prestataireId: 'ent-1',
  demandeLe: '2026-10-01',
  numero: '12.3.456',
  objet: 'Recherche de fuite colonne',
  prix: { montantTtcCentimes: 120_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 109_091 },
  prevuLe: '2026-10-15',
  ...surcharge,
})

const demande = (surcharge: Partial<SaisieDemande> = {}, m: ModeleDemande = OS): Demande => creerDemande(saisieDemande(surcharge), m)

/** Sortie prête : signataire, canal, fondement et lien de l'entreprise renseignés. */
const PRETE: SaisieSortieOs = {
  signataireId: 'col-direction',
  canal: 'messagerie_vitfix',
  fondement: 'administration_courante',
  entrepriseLiee: false,
}

const sortie = (d: Demande = demande(), saisie: SaisieSortieOs = {}, options: OptionsVisa = {}): SortieOrdreService =>
  creerSortieOs(d, { ...PRETE, ...saisie }, options)

const PIECES: PiecesEntreprise = {
  prestataireId: 'ent-1',
  etablieEnFrance: true,
  attestationUrssafLe: '2026-09-01',
  attestationUrssafVerifiee: true,
  immatriculation: { nature: 'kbis', le: '2026-09-01' },
}

const CONTEXTE: ContexteEnvoiOs = {
  date: '2026-10-03',
  pieces: PIECES,
  controle: { decennaleObligatoire: false },
  prestataireAvecCompteVitfix: true,
}

const evenement = (collaborateurId: string, role: RoleCabinet, heure: string, motif?: string): SaisieEvenementVisa => ({
  date: '2026-10-02',
  heure,
  collaborateurId,
  role,
  motif,
})

const DEMANDE_GESTION = evenement('col-gestion', 'Gestion', '09:00')
const VISA_DIRECTION = evenement('col-direction', 'Direction', '10:00')

const ENVOI: SaisieDiffusion = {
  date: '2026-10-03',
  heure: '10:00',
  collaborateurId: 'col-gestion',
  canal: 'messagerie_vitfix',
  destinataire: creerRattachement('Entreprise', 'ent-1'),
  missionId: 'mission-1',
}

const SEUIL_100 = { ...REGLES_VISA_PAR_DEFAUT, seuilPrevuTtcCentimes: 100_000 } satisfies ReglesVisaOs

const decisionSeuil = (type: TypeDecisionAnnuelle, montantCentimes: number | null): DecisionAnnuelle => ({
  id: `dec-${type}`,
  coproprieteId: 'copro-1',
  type,
  date: '2026-04-01',
  source: { origine: 'assemblee', agId: 'ag-1', resolutionId: `res-${type}` },
  exerciceId: null,
  montantCentimes,
  autorisee: null,
  delegataire: null,
  objet: null,
  autoriseDepenses: null,
  dureeMois: null,
  prendEffetLe: null,
  terme: null,
  designesIds: [],
})

/** Seuils de l'art. 21 décidés par l'assemblée : consultation du conseil syndical à 1 000 €, mise en concurrence à 5 000 € (TTC). */
const SEUILS_ART21 = [decisionSeuil('seuil_consultation_cs', 100_000), decisionSeuil('seuil_mise_en_concurrence', 500_000)]

const codes = (liste: readonly { code: string }[]) => liste.map((a) => a.code)
const bloquants = (liste: readonly { code: string; gravite: string }[]) => liste.filter((a) => a.gravite === 'bloquant').map((a) => a.code)

/** Visa demandé par la gestion puis donné par la direction, sur la demande `d`. */
const viser = (s: SortieOrdreService, d: Demande = demande()) => donnerVisa(demanderVisa(s, d, DEMANDE_GESTION), d, VISA_DIRECTION)

/** OS visé : visa nécessaire (seuil du cabinet), demandé par la gestion, donné par la direction. */
const viseeParDirection = (d: Demande = demande(), saisie: SaisieSortieOs = {}) => viser(sortie(d, saisie, { regles: SEUIL_100 }), d)

const envoyee = (s: SortieOrdreService = sortie(), d: Demande = demande()) => envoyerOs(d, s, ENVOI, CONTEXTE)

const PRIX_6600_TTC = { montantTtcCentimes: 660_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 600_000 }

/** Constat de l'urgence par l'administrateur provisoire (décision de Hugo du 03/11/2026) : daté, motivé, attribué. */
const CONSTAT: ConstatUrgence = { constateLe: '2026-10-02', motif: 'Fuite active sur colonne', collaborateurId: 'col-direction' }

describe('référentiels du point 44', () => {
  it('Visa de sortie : les 5 valeurs de la tranche 40 ; seuls « Visa donné » et « Sortie libre » laissent partir l’OS', () => {
    expect([...VISAS_SORTIE]).toEqual(['Demande de visa', 'Visa refusé', 'Visa nécessaire', 'Visa donné', 'Sortie libre'])
    expect(VISAS_SORTIE.filter((v) => VISAS_PERMETTANT_ENVOI.has(v))).toEqual(['Visa donné', 'Sortie libre'])
  })

  it('chaque canal hors messagerie VitFix correspond à une forme d’envoi Gestéam (courriers.ts)', () => {
    const formes = new Set<string>(FORME_ENVOI_COURRIER)
    expect(CANAUX_ENVOI_OS).toContain('messagerie_vitfix')
    expect(Object.values(FORME_ENVOI_PAR_CANAL).every((f) => formes.has(f))).toBe(true)
    expect(FORME_ENVOI_PAR_CANAL.courrier_ar).toBe('AR')
    expect(FORME_ENVOI_PAR_CANAL.courriel).toBe('Email')
  })
})

describe('numérotation <mandat>.<plan>.<rang> (tranche 34)', () => {
  it('formate et relit un N° ; un N° libre ou repris d’ailleurs n’est pas lu', () => {
    expect(formaterNumeroOs({ mandat: '12', plan: '3', rang: 457 })).toBe('12.3.457')
    expect(lireNumeroOs('12.3.456')).toEqual({ mandat: '12', plan: '3', rang: 456 })
    expect(lireNumeroOs(' 12.3.7 ')).toEqual({ mandat: '12', plan: '3', rang: 7 })
    expect(lireNumeroOs('OS-2026-051')).toBeNull()
    expect(lireNumeroOs('12.3.0')).toBeNull()
    expect(lireNumeroOs(null)).toBeNull()
  })

  it('refuse un segment vide, à point ou à espace, un rang non entier ou nul, un N° trop long', () => {
    expect(() => formaterNumeroOs({ mandat: '12.1', plan: '3', rang: 1 })).toThrow(/mandat/)
    expect(() => formaterNumeroOs({ mandat: '12', plan: '', rang: 1 })).toThrow(/plan/)
    expect(() => formaterNumeroOs({ mandat: '12', plan: 'a b', rang: 1 })).toThrow(/plan/)
    expect(() => formaterNumeroOs({ mandat: '12', plan: '3', rang: 0 })).toThrow(/rang/i)
    expect(() => formaterNumeroOs({ mandat: '12', plan: '3', rang: 1.5 })).toThrow(/rang/i)
    expect(() => formaterNumeroOs({ mandat: 'm'.repeat(LONGUEUR_MAX_NUMERO_OS), plan: '3', rang: 1 })).toThrow(/50/)
  })

  it('rang suivant : le plus grand rang du mandat + 1, tous plans confondus ; les autres mandats et N° libres sont ignorés', () => {
    expect(rangOsSuivant(['12.3.456', '12.4.12', '13.3.900', 'OS-2026-051', null], '12')).toBe(457)
    expect(rangOsSuivant([], '12')).toBe(1)
  })

  it('numérote une demande dans la séquence de son mandat, une seule fois', () => {
    const sansNumero = demande({ id: 'dem-2', numero: null })
    const numerotee = numeroterDemande(sansNumero, [demande(), sansNumero], { mandat: '12', plan: '3' })
    expect(numerotee.numero).toBe('12.3.457')
    expect(sansNumero.numero).toBeNull()
    expect(() => numeroterDemande(numerotee, [demande(), numerotee], { mandat: '12', plan: '3' })).toThrow(/figé/)
  })

  it('refuse une demande sans mandat ou terminée, et une liste qui mêle un autre mandat', () => {
    const sansNumero = demande({ id: 'dem-2', numero: null })
    expect(() => numeroterDemande({ ...sansNumero, mandatId: null }, [], { mandat: '12', plan: '3' })).toThrow(/mandat/)
    expect(() => numeroterDemande({ ...sansNumero, statut: 'Terminé' }, [], { mandat: '12', plan: '3' })).toThrow(/terminée/)
    const autreMandat = demande({ id: 'dem-3', mandatId: 'mandat-2' })
    expect(() => numeroterDemande(sansNumero, [autreMandat], { mandat: '12', plan: '3' })).toThrow(/autre mandat/)
  })
})

describe('visa de sortie : motifs et création', () => {
  it('sans règle ni déclencheur : sortie libre, aucun motif, aucun historique', () => {
    const s = sortie()
    expect(s.visa).toBe('Sortie libre')
    expect(s.motifsVisa).toEqual([])
    expect(s.historiqueVisa).toEqual([])
    expect(s.journal).toEqual([])
    expect(s.delai).toBe('normale')
    expect(s.diffusable).toBe(true)
  })

  it('seuil du cabinet (règle de gestion) : prévu TTC égal ou supérieur → visa nécessaire ; prévu inconnu → visa nécessaire', () => {
    expect(sortie(demande(), {}, { regles: { ...SEUIL_100, seuilPrevuTtcCentimes: 120_000 } }).visa).toBe('Visa nécessaire')
    expect(sortie(demande(), {}, { regles: { ...SEUIL_100, seuilPrevuTtcCentimes: 120_001 } }).visa).toBe('Sortie libre')
    const sansPrix = demande({ prix: null })
    expect(sortie(sansPrix, {}, { regles: SEUIL_100 }).motifsVisa).toEqual(['prevu_inconnu'])
  })

  it('nature soumise (sans casse ni accents) et exécution forcée soumise : règles de gestion', () => {
    const regles: ReglesVisaOs = { ...REGLES_VISA_PAR_DEFAUT, naturesSoumises: new Set(['os copro']), executionForceeSoumise: true }
    expect(motifsVisa(demande(), sortie(), { regles }).map((m) => [m.code, m.fondement])).toEqual([['nature_soumise', null]])
    const huissier = demande({ dossier: creerRattachement('Contentieux', 'cx-1') }, HUISSIER)
    expect(codes(motifsVisa(huissier, sortie(huissier), { regles }))).toEqual(['execution_forcee'])
  })

  it('seuils de l’art. 21 décidés par l’assemblée, comparés au prévu TTC (décision J6)', () => {
    const consultation = motifsVisa(demande(), sortie(), { decisionsAgEnVigueur: SEUILS_ART21 })
    expect(codes(consultation)).toEqual(['consultation_conseil_syndical'])
    expect(consultation[0].fondement).toMatch(/L\. 1965 art\. 21, al\. 2/)
    const gros = demande({ prix: { montantTtcCentimes: 600_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 545_455 } })
    expect(codes(motifsVisa(gros, sortie(gros), { decisionsAgEnVigueur: SEUILS_ART21 }))).toEqual(['consultation_conseil_syndical', 'mise_en_concurrence'])
    expect(codes(motifsVisa(demande(), sortie(), { decisionsAgEnVigueur: [] }))).toEqual([])
    expect(codes(motifsVisa(demande({ prix: null }), sortie(), { decisionsAgEnVigueur: SEUILS_ART21 }))).toEqual(['prevu_inconnu'])
  })

  it('convention avec une entreprise liée au syndic (L. 1965 art. 18-1 A, II ; D. 1967 art. 39)', () => {
    const motifs = motifsVisa(demande(), sortie(demande(), { entrepriseLiee: true }))
    expect(codes(motifs)).toEqual(['convention_liee'])
    expect(motifs[0].fondement).toMatch(/18-1 A/)
    expect(motifs[0].fondement).toMatch(/D\. 1967 art\. 39/)
  })

  it('administrateur provisoire au titre des pouvoirs de l’assemblée : avis du conseil syndical, sauf urgence constatée par l’administrateur provisoire (D. 1967 art. 62-7)', () => {
    const aj = sortie(demande(), { fondement: 'decision_aj_pouvoirs_ag' })
    expect(aj.visa).toBe('Visa nécessaire')
    expect(aj.motifsVisa).toEqual(['avis_conseil_syndical_aj'])
    const urgente = sortie(demande(), { fondement: 'decision_aj_pouvoirs_ag', delai: 'urgence', constatUrgence: CONSTAT })
    expect(urgente.visa).toBe('Sortie libre')
  })

  it('une demande de devis ne conclut aucun marché : pas de déclencheur légal, mais les règles de gestion s’appliquent', () => {
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    expect(codes(motifsVisa(devis, sortie(devis, { entrepriseLiee: true }), { decisionsAgEnVigueur: SEUILS_ART21 }))).toEqual([])
    const regles: ReglesVisaOs = { ...REGLES_VISA_PAR_DEFAUT, naturesSoumises: new Set(['Demande devis Copro']) }
    expect(codes(motifsVisa(devis, sortie(devis), { regles }))).toEqual(['nature_soumise'])
  })

  it('refuse une demande terminée ou refusée, un délai, un canal, un fondement ou une majorité inconnus, des dates et nombres invalides', () => {
    expect(() => sortie({ ...demande(), statut: 'Terminé' })).toThrow(/terminée ou refusée/)
    expect(() => sortie({ ...demande(), stade: 'Refusée' })).toThrow(/terminée ou refusée/)
    expect(() => sortie(demande(), { delai: 'immediate' as never })).toThrow(/Délai/)
    expect(() => sortie(demande(), { canal: 'fax' as never })).toThrow(/Canal/)
    expect(() => sortie(demande(), { fondement: 'autre' as never })).toThrow(/Fondement/)
    expect(() => sortie(demande(), { majoriteResolution: 'art99' as never })).toThrow(/Majorité/)
    expect(() => sortie(demande(), { relanceLe: '2026-02-30' })).toThrow(/relance/)
    expect(() => sortie(demande(), { decisionLe: '01/10/2026' })).toThrow(/décision/)
    expect(() => sortie(demande(), { justificatifs: { avisConseilSyndicalLe: '01/10/2026' } })).toThrow(/conseil syndical/)
    expect(() => sortie(demande(), { justificatifs: { devisDemandes: -1 } })).toThrow(/devis/)
    expect(() => sortie(demande(), { justificatifs: { devisExigesParAssemblee: 0 } })).toThrow(/assemblée/)
  })
})

describe('visa de sortie : circuit, viseur et historique', () => {
  it('nécessaire → demandé (gestion) → donné (direction, autre collaborateur), avec l’historique', () => {
    const s = viseeParDirection()
    expect(s.visa).toBe('Visa donné')
    expect(s.historiqueVisa.map((e) => [e.action, e.role, e.collaborateurId])).toEqual([
      ['demande', 'Gestion', 'col-gestion'],
      ['donne', 'Direction', 'col-direction'],
    ])
  })

  it('le viseur a un rôle de viseur (Direction par défaut) et n’est pas celui qui a demandé le visa', () => {
    const d = demande()
    const demandee = demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, DEMANDE_GESTION)
    expect(() => donnerVisa(demandee, d, evenement('col-gestion-2', 'Gestion', '10:00'))).toThrow(/non habilité/)
    const juridique: ReglesVisaOs = { ...SEUIL_100, rolesViseurs: new Set<RoleCabinet>(['Juridique']) }
    expect(donnerVisa(demandee, d, evenement('col-juriste', 'Juridique', '10:00'), juridique).visa).toBe('Visa donné')
    const parDirection = demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, evenement('col-direction', 'Direction', '09:00'))
    expect(() => donnerVisa(parDirection, d, VISA_DIRECTION)).toThrow(/autre collaborateur/)
  })

  it('refus motivé obligatoire, puis nouvelle demande', () => {
    const d = demande()
    const demandee = demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, DEMANDE_GESTION)
    expect(() => refuserVisa(demandee, d, VISA_DIRECTION)).toThrow(/motif/)
    const refuse = refuserVisa(demandee, d, evenement('col-direction', 'Direction', '10:00', 'Prix à renégocier'))
    expect(refuse.visa).toBe('Visa refusé')
    expect(refuse.historiqueVisa.at(-1)?.motif).toBe('Prix à renégocier')
    expect(demanderVisa(refuse, d, evenement('col-gestion', 'Gestion', '11:00')).visa).toBe('Demande de visa')
  })

  it('transitions impossibles refusées ; un collaborateur peut exiger un visa sur une sortie libre', () => {
    const d = demande()
    const libre = sortie()
    expect(() => demanderVisa(libre, d, DEMANDE_GESTION)).toThrow(/impossible/)
    expect(() => donnerVisa(sortie(d, {}, { regles: SEUIL_100 }), d, VISA_DIRECTION)).toThrow(/impossible/)
    const exigee = exigerVisa(libre, d, evenement('col-direction', 'Direction', '08:00'))
    expect(exigee.visa).toBe('Visa nécessaire')
    expect(exigee.historiqueVisa.map((e) => e.action)).toEqual(['exige'])
  })

  it('horodatage contrôlé : heure HH:MM, jamais antérieur au dernier événement, rôle connu', () => {
    const d = demande()
    const demandee = demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, DEMANDE_GESTION)
    expect(() => donnerVisa(demandee, d, evenement('col-direction', 'Direction', '08:59'))).toThrow(/antérieur/)
    expect(() => donnerVisa(demandee, d, evenement('col-direction', 'Direction', '9h'))).toThrow(/heure/)
    expect(() => donnerVisa(demandee, d, evenement('col-direction', 'Stagiaire' as RoleCabinet, '10:00'))).toThrow(/Rôle/)
  })

  it('après le premier envoi, le visa est figé', () => {
    const envoye = envoyee(viseeParDirection())
    expect(() => exigerVisa(envoye, demande(), evenement('col-direction', 'Direction', '12:00'))).toThrow(/déjà envoyé/)
    expect(() => revoirVisa(envoye, demande(), evenement('col-direction', 'Direction', '12:00'))).toThrow(/offre nouvelle/)
  })

  it('revue : un visa donné tombe si le prévu, l’entreprise, l’objet, la nature ou le devis associé changent, sans « avant » ; sinon il reste', () => {
    const avant = demande()
    const visee = viseeParDirection(avant)
    const changements: Partial<Demande>[] = [
      { prix: { montantTtcCentimes: 180_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 163_636 } },
      { prestataireId: 'ent-2' },
      { objet: 'Remplacement complet de la colonne' },
      { nature: 'OS Copro (variante agence)' },
      { devisAssocie: { devisId: 'devis-2', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } },
    ]
    for (const changement of changements) {
      const apres: Demande = { ...avant, ...changement }
      const revue = revoirVisa(visee, apres, evenement('col-gestion', 'Gestion', '11:00'), { regles: SEUIL_100 })
      expect(revue.visa, JSON.stringify(changement)).toBe('Visa nécessaire')
      expect(revue.historiqueVisa.at(-1)?.action).toBe('revu')
    }
    expect(revoirVisa(visee, avant, evenement('col-gestion', 'Gestion', '11:00'), { regles: SEUIL_100 }).visa).toBe('Visa donné')
  })

  it('revue : une sortie libre devient « Visa nécessaire » quand un motif apparaît', () => {
    const libre = sortie()
    const liee = modifierSortieOs(libre, demande(), { entrepriseLiee: true })
    const revue = revoirVisa(liee, demande(), evenement('col-gestion', 'Gestion', '11:00'))
    expect(revue.visa).toBe('Visa nécessaire')
    expect(revue.motifsVisa).toEqual(['convention_liee'])
  })
})

describe('contrôle avant l’envoi', () => {
  it('OS prêt : aucune anomalie', () => {
    expect(controlerAvantEnvoiOs(demande(), sortie(), CONTEXTE)).toEqual([])
  })

  it('N°, entreprise, signataire, canal et diffusion manquants : bloquants', () => {
    const d = demande({ numero: null, prestataireId: null })
    const s = creerSortieOs(d, { fondement: 'administration_courante', entrepriseLiee: false, diffusable: false })
    expect(bloquants(controlerAvantEnvoiOs(d, s, { date: '2026-10-03' }))).toEqual([
      'numero_absent',
      'entreprise_absente',
      'signataire_absent',
      'canal_absent',
      'non_diffusable',
    ])
  })

  it('demande refusée : close ; N° hors séquence : alerte', () => {
    const d = demande()
    const s = sortie(d)
    expect(bloquants(controlerAvantEnvoiOs({ ...d, statut: 'Refusé' }, s, CONTEXTE))).toEqual(['demande_close'])
    const libre = { ...d, numero: 'OS-2026-051' }
    const anomalies = controlerAvantEnvoiOs(libre, s, CONTEXTE)
    expect(codes(anomalies)).toEqual(['numero_hors_sequence'])
    expect(anomalies[0].gravite).toBe('alerte')
  })

  it('visa nécessaire non demandé, en attente ou refusé : envoi impossible (message selon l’état)', () => {
    const d = demande()
    const necessaire = sortie(d, {}, { regles: SEUIL_100 })
    const contexte = { ...CONTEXTE, regles: SEUIL_100 }
    const message = (s: SortieOrdreService) => controlerAvantEnvoiOs(d, s, contexte).find((a) => a.code === 'visa_manquant')?.message
    expect(message(necessaire)).toMatch(/non demandé/)
    const demandee = demanderVisa(necessaire, d, DEMANDE_GESTION)
    expect(message(demandee)).toMatch(/attente/)
    expect(message(refuserVisa(demandee, d, evenement('col-direction', 'Direction', '10:00', 'Prix à renégocier')))).toMatch(/refusé.*Prix à renégocier/)
    expect(controlerAvantEnvoiOs(d, viseeParDirection(), contexte)).toEqual([])
  })

  it('sortie libre devenue soumise, ou motif nouveau après le visa : à revoir (bloquant)', () => {
    const libre = modifierSortieOs(sortie(), demande(), { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: 'AG du 12/05/2026, résolution 14' } })
    expect(bloquants(controlerAvantEnvoiOs(demande(), libre, CONTEXTE))).toEqual(['visa_devenu_necessaire'])
    const visee = viseeParDirection()
    const contexte = { ...CONTEXTE, regles: SEUIL_100, decisionsAgEnVigueur: SEUILS_ART21 }
    expect(bloquants(controlerAvantEnvoiOs(demande(), visee, contexte))).toEqual(['visa_a_revoir'])
  })

  it('messagerie VitFix sans compte ; courriel sans adresse communiquée (C. civ. art. 1127, al. 1)', () => {
    expect(bloquants(controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, prestataireAvecCompteVitfix: false }))).toEqual(['sans_compte_vitfix'])
    const courriel = sortie(demande(), { canal: 'courriel' })
    expect(bloquants(controlerAvantEnvoiOs(demande(), courriel, { ...CONTEXTE, courrielCommunique: false }))).toEqual(['courriel_non_communique'])
    const inconnu = controlerAvantEnvoiOs(demande(), courriel, CONTEXTE)
    expect(codes(inconnu)).toEqual(['courriel_a_verifier'])
    expect(inconnu[0].fondement).toMatch(/1127/)
    expect(controlerAvantEnvoiOs(demande(), courriel, { ...CONTEXTE, courrielCommunique: true })).toEqual([])
  })

  it('signataire hors de la liste des habilités par le cabinet : bloquant, règle de gestion (décision 8 : plus « à confirmer », aucun texte cité)', () => {
    const anomalies = controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, signatairesHabilites: new Set(['col-aj']) })
    expect(bloquants(anomalies)).toEqual(['signataire_non_habilite'])
    expect(anomalies[0]).toMatchObject({ fondement: null, aConfirmer: false })
    expect(controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, signatairesHabilites: new Set(['col-direction']) })).toEqual([])
  })

  it('convention liée : visa donné mais sans autorisation de l’assemblée → bloquant ; lien non renseigné → alerte', () => {
    const liee = viser(sortie(demande(), { entrepriseLiee: true }))
    expect(bloquants(controlerAvantEnvoiOs(demande(), liee, CONTEXTE))).toEqual(['convention_liee_non_autorisee'])
    const autorisee = viser(sortie(demande(), { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: 'résolution 14' } }))
    expect(controlerAvantEnvoiOs(demande(), autorisee, CONTEXTE)).toEqual([])
    const inconnu = controlerAvantEnvoiOs(demande(), sortie(demande(), { entrepriseLiee: null }), CONTEXTE)
    expect(codes(inconnu)).toEqual(['lien_entreprise_non_renseigne'])
    expect(inconnu[0].gravite).toBe('alerte')
  })

  it('avis du conseil syndical de l’administrateur provisoire : comparé à la date de la décision au registre (D. 1967 art. 62-7, 62-8)', () => {
    const d = demande()
    const aj = (avisConseilSyndicalLe: string | null, decisionLe: string | null = '2026-10-02') =>
      viser(
        sortie(d, {
          fondement: 'decision_aj_pouvoirs_ag',
          fondementReference: 'registre n° 7',
          decisionLe,
          justificatifs: { avisConseilSyndicalLe, modeFinancement: 'appel de fonds travaux' },
        }),
        d,
      )
    expect(bloquants(controlerAvantEnvoiOs(d, aj(null), CONTEXTE))).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(controlerAvantEnvoiOs(d, aj('2026-10-02'), CONTEXTE)).toEqual([])
    // décision inscrite le 01/10, avis le 02/10, envoi le 03/10 : l'avis suit la décision → bloquant
    expect(bloquants(controlerAvantEnvoiOs(d, aj('2026-10-02', '2026-10-01'), CONTEXTE))).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(controlerAvantEnvoiOs(d, aj('2026-10-01', '2026-10-01'), CONTEXTE)).toEqual([])
    // décision non datée : l'envoi sert de borne, signalé à confirmer
    const sansDate = controlerAvantEnvoiOs(d, aj('2026-10-02', null), CONTEXTE)
    expect(codes(sansDate)).toEqual(['date_decision_non_renseignee'])
    expect(sansDate[0]).toMatchObject({ gravite: 'alerte', aConfirmer: true })
    expect(sansDate[0].fondement).toMatch(/62-8/)
    expect(bloquants(controlerAvantEnvoiOs(d, aj('2026-10-04', null), CONTEXTE))).toEqual(['avis_conseil_syndical_aj_absent'])
  })

  it('seuils de l’art. 21 : avis du conseil syndical et mise en concurrence (au moins deux devis demandés) signalés à confirmer', () => {
    const gros = demande({ prix: { montantTtcCentimes: 600_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 545_455 } })
    const options = { decisionsAgEnVigueur: SEUILS_ART21 }
    const contexte: ContexteEnvoiOs = { ...CONTEXTE, ...options, controle: { decennaleObligatoire: false, montantHtOperationCentimes: 400_000 } }
    const visee = (justificatifs: SaisieSortieOs['justificatifs']) => viser(sortie(gros, { justificatifs }, options), gros)
    const sansPiece = controlerAvantEnvoiOs(gros, visee({ devisDemandes: 1 }), contexte)
    expect(codes(sansPiece)).toEqual(['avis_conseil_syndical_non_enregistre', 'mise_en_concurrence_non_justifiee'])
    expect(sansPiece.every((a) => a.gravite === 'alerte' && a.aConfirmer)).toBe(true)
    expect(controlerAvantEnvoiOs(gros, visee({ devisDemandes: 2, avisConseilSyndicalLe: '2026-10-02' }), contexte)).toEqual([])
  })

  it('fondement : non renseigné, sans référence, urgence non constatée, suites de l’urgence (D. 1967 art. 37)', () => {
    expect(codes(controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: null }), CONTEXTE))).toEqual(['fondement_non_renseigne'])
    const sansReference = sortie(demande(), { fondement: 'execution_resolution_ag', majoriteResolution: 'art24' })
    expect(codes(controlerAvantEnvoiOs(demande(), sansReference, CONTEXTE))).toEqual(['fondement_sans_reference'])
    const urgence = controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: 'urgence_sauvegarde', delai: 'urgence' }), CONTEXTE)
    expect(codes(urgence)).toEqual(['urgence_non_constatee', 'urgence_suites'])
    expect(urgence[1].fondement).toMatch(/D\. 1967 art\. 37/)
    expect(urgence.every((a) => a.gravite === 'alerte')).toBe(true)
  })

  it('devis associé échu à la date de l’envoi : alerte (C. civ. art. 1117)', () => {
    const d = demande({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } })
    const anomalies = controlerAvantEnvoiOs(d, sortie(d), { ...CONTEXTE, validiteDevisAu: '2026-10-02' })
    expect(codes(anomalies)).toEqual(['devis_caduc'])
    expect(anomalies[0].fondement).toMatch(/1117/)
    expect(controlerAvantEnvoiOs(d, sortie(d), { ...CONTEXTE, validiteDevisAu: '2026-10-03' })).toEqual([])
  })

  it('contrôle déclaratif (point 37) : non fait sous le seuil → alerte ; vigilance manquante au-delà du seuil → bloquant ; pièces d’une autre entreprise → bloquant', () => {
    expect(codes(controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, pieces: undefined }))).toEqual(['controle_declaratif_non_fait'])
    const sansAttestation: PiecesEntreprise = { ...PIECES, attestationUrssafLe: null }
    const gros = { ...CONTEXTE, pieces: sansAttestation, controle: { decennaleObligatoire: false, montantHtOperationCentimes: 600_000 } }
    expect(bloquants(controlerAvantEnvoiOs(demande(), sortie(), gros))).toContain('vigilance_urssaf_absente')
    const autre = controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, pieces: { ...PIECES, prestataireId: 'ent-2' } })
    expect(bloquants(autre)).toEqual(['controle_declaratif_impossible'])
    expect(autre[0].message).toMatch(/autre entreprise/)
  })

  it('demande de devis : pas de contrôle déclaratif ni de cadre légal du marché', () => {
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    expect(controlerAvantEnvoiOs(devis, sortie(devis, { fondement: null, entrepriseLiee: null }), { date: '2026-10-03', prestataireAvecCompteVitfix: true })).toEqual([])
  })

  it('date de l’envoi invalide, sortie d’une autre demande : erreur', () => {
    expect(() => controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, date: '03/10/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerAvantEnvoiOs(demande({ id: 'dem-9' }), sortie(), CONTEXTE)).toThrow(/autre demande/)
  })
})

describe('envoi et journal de diffusion (preuve)', () => {
  it('premier envoi : journal « envoi » horodaté, l’objet reçu n’est pas modifié', () => {
    const s = sortie()
    const envoye = envoyerOs(demande(), s, ENVOI, CONTEXTE)
    expect(estEnvoye(envoye)).toBe(true)
    expect(premierEnvoi(envoye)).toMatchObject({ nature: 'envoi', date: '2026-10-03', heure: '10:00', canal: 'messagerie_vitfix', missionId: 'mission-1' })
    expect(s.journal).toEqual([])
    expect(estEnvoye(s)).toBe(false)
    expect(premierEnvoi(s)).toBeNull()
  })

  it('refuse l’envoi tant qu’un bloquant demeure, en les listant', () => {
    const necessaire = sortie(demande(), {}, { regles: SEUIL_100 })
    expect(() => envoyerOs(demande(), necessaire, ENVOI, { ...CONTEXTE, regles: SEUIL_100 })).toThrow(/non envoyé.*Visa nécessaire non demandé/)
  })

  it('premier envoi : à l’entreprise de la demande, par le canal choisi, avec la preuve du canal', () => {
    const copie = { ...ENVOI, destinataire: creerRattachement('Identité', 'id-occupant') }
    expect(() => envoyerOs(demande(), sortie(), copie, CONTEXTE)).toThrow(/entreprise de la demande/)
    const courriel = { ...ENVOI, canal: 'courriel' as const }
    expect(() => envoyerOs(demande(), sortie(), courriel, CONTEXTE)).toThrow(/canal choisi/)
    expect(() => envoyerOs(demande(), sortie(), { ...ENVOI, missionId: null }, CONTEXTE)).toThrow(/missionId/)
    const ar = sortie(demande(), { canal: 'courrier_ar' })
    expect(() => envoyerOs(demande(), ar, { ...ENVOI, canal: 'courrier_ar', missionId: null }, CONTEXTE)).toThrow(/courrierId/)
    expect(() => envoyerOs(demande(), sortie(), { ...ENVOI, destinataire: { type: 'Contentieux', id: 'cx-1' } }, CONTEXTE)).toThrow(/fiche porteuse/)
  })

  it('chronologie : pas d’envoi avant la demande, ni avant la dernière diffusion', () => {
    expect(() => envoyerOs(demande(), sortie(), { ...ENVOI, date: '2026-09-30' }, { ...CONTEXTE })).toThrow(/antérieur/)
    const envoye = envoyee()
    expect(() => envoyerOs(demande(), envoye, { ...ENVOI, heure: '09:59' }, CONTEXTE)).toThrow(/antérieur/)
  })

  it('envois suivants : rediffusion (copie à une fiche porteuse, par un autre canal)', () => {
    const copie: SaisieDiffusion = { ...ENVOI, heure: '11:00', canal: 'courriel', destinataire: creerRattachement('Identité', 'id-occupant'), missionId: null }
    const rediffuse = envoyerOs(demande(), envoyee(), copie, CONTEXTE)
    expect(rediffuse.journal.map((e) => e.nature)).toEqual(['envoi', 'rediffusion'])
    expect(() => envoyerOs(demande(), marquerDiffusable(envoyee(), false), copie, CONTEXTE)).toThrow(/diffusable/)
  })

  it('après l’envoi, la sortie ne se modifie plus', () => {
    expect(() => modifierSortieOs(envoyee(), demande(), { canal: 'courriel' })).toThrow(/déjà envoyé/)
  })

  it('relance : après un envoi, à l’entreprise ; la date de relance est vidée', () => {
    expect(() => relancerOs(sortie(), { ...ENVOI, heure: '12:00' })).toThrow(/jamais envoyé/)
    const aRelancer = fixerRelance(envoyee(), '2026-10-10')
    expect(aRelancer.relanceLe).toBe('2026-10-10')
    const relance = relancerOs(aRelancer, { ...ENVOI, date: '2026-10-10', heure: '09:00' })
    expect(relance.journal.map((e) => e.nature)).toEqual(['envoi', 'relance'])
    expect(relance.relanceLe).toBeNull()
    expect(() => relancerOs(aRelancer, { ...ENVOI, date: '2026-10-10', destinataire: creerRattachement('Entreprise', 'ent-2') })).toThrow(/entreprise/)
  })

  it('date de relance : jamais avant le premier envoi ; effaçable', () => {
    expect(() => fixerRelance(envoyee(), '2026-10-02')).toThrow(/premier envoi/)
    expect(() => fixerRelance(envoyee(), '10/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(fixerRelance(fixerRelance(envoyee(), '2026-10-10'), null).relanceLe).toBeNull()
    expect(fixerRelance(sortie(), '2026-10-10').relanceLe).toBe('2026-10-10')
  })

  it('réception (accusé) distincte de l’envoi (C. civ. art. 1121, 1127-4)', () => {
    expect(() => enregistrerReception(sortie(), ENVOI)).toThrow(/jamais envoyé/)
    const envoye = envoyee()
    expect(estRecu(envoye)).toBe(false)
    const recu = enregistrerReception(envoye, { ...ENVOI, heure: '14:00' })
    expect(estRecu(recu)).toBe(true)
    expect(recu.journal.map((e) => e.nature)).toEqual(['envoi', 'reception'])
  })

  it('preuve d’une diffusion : trace interne, ou état de notification du courrier AR lié (courriers.ts)', () => {
    const envoye = envoyee()
    expect(preuveDeDiffusion(envoye, envoye.journal[0])).toBe('trace_interne')
    const ar = { ...envoye.journal[0], canal: 'courrier_ar' as const, courrierId: 'courrier-1' }
    const parAr = { ...envoye, journal: [ar] }
    const notifie: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: null }
    expect(preuveDeDiffusion(parAr, ar, notifie)).toBe('notifie')
    expect(preuveDeDiffusion(parAr, ar, { ...notifie, datePremierePresentation: null })).toBe('envoye_non_notifie')
    expect(() => preuveDeDiffusion(parAr, ar)).toThrow(/courrier lié/)
    expect(() => preuveDeDiffusion(parAr, ar, { ...notifie, formeEnvoi: 'Normal' })).toThrow(/AR/)
  })
})

describe('adaptateurs (branchements à faire plus tard)', () => {
  it('relances dues pour le suivi « à faire » : OS envoyés, ni terminés ni refusés, avec une date de relance et un élément encore attendu (attendusOs)', () => {
    const d1 = demande()
    const d2 = demande({ id: 'dem-2', numero: '12.3.457' })
    const d3 = demande({ id: 'dem-3', numero: '12.3.458' })
    const s1 = fixerRelance(envoyee(sortie(d1), d1), '2026-10-12')
    const s2 = fixerRelance(envoyerOs(d2, sortie(d2), ENVOI, CONTEXTE), '2026-10-08')
    const s3 = fixerRelance(sortie(d3), '2026-10-09')
    const relances = relancesOsDues([
      { demande: d1, sortie: s1 },
      { demande: d2, sortie: s2 },
      { demande: d3, sortie: s3 },
      { demande: { ...d1, id: 'dem-4', statut: 'Terminé' }, sortie: { ...s1, demandeId: 'dem-4' } },
      { demande: { ...d1, id: 'dem-5', statut: 'Refusé' }, sortie: { ...s1, demandeId: 'dem-5' } },
      { demande: { ...d1, id: 'dem-6', stade: 'Refusée' }, sortie: { ...s1, demandeId: 'dem-6' } },
      // réponse reçue (OS accepté) : rien n'est dû, malgré la date de relance
      { demande: { ...d1, id: 'dem-7', statut: 'Accepté' }, sortie: { ...s1, demandeId: 'dem-7' } },
    ])
    expect(relances.map((r) => [r.id, r.date])).toEqual([
      ['demandes:relance_os:dem-2', '2026-10-08'],
      ['demandes:relance_os:dem-1', '2026-10-12'],
    ])
    expect(relances[0]).toMatchObject({ famille: 'demandes', nature: 'relance_os', mandatId: 'mandat-1', objetId: 'dem-2', assigneId: 'col-gestion', aConfirmer: false })
  })

  it('corps de la route « envoyer » pour la messagerie VitFix : N° d’OS, délai, date prévue', () => {
    const s = sortie(demande(), { delai: 'prioritaire' })
    expect(demandeEnvoiDepuisOs(demande(), s, { syndicArtisanId: 'artisan-1', copropriete: 'Résidence test' })).toMatchObject({
      syndic_artisan_id: 'artisan-1',
      copropriete: 'Résidence test',
      objet: 'Recherche de fuite colonne',
      urgence: 'prioritaire',
      reference_aj: '12.3.456',
      date_intervention: '2026-10-15',
    })
    expect(() => demandeEnvoiDepuisOs(demande(), sortie(demande(), { canal: 'courriel' }), { syndicArtisanId: 'a', copropriete: 'c' })).toThrow(/messagerie/)
    const sansNumero = demande({ numero: null })
    expect(() => demandeEnvoiDepuisOs(sansNumero, sortie(sansNumero), { syndicArtisanId: 'a', copropriete: 'c' })).toThrow(/N°/)
  })
})

describe('retours de relecture du point 44 (tour 1)', () => {
  it('convention liée : la question couvre le champ de D. 1967 art. 39 (préposés, proches, entreprises où ils ont une part, une fonction ou un emploi)', () => {
    const [inconnu] = controlerAvantEnvoiOs(demande(), sortie(demande(), { entrepriseLiee: null }), CONTEXTE)
    expect(inconnu.code).toBe('lien_entreprise_non_renseigne')
    for (const attendu of [/préposés/, /conjoint/, /pacte civil de solidarité/, /concubin/, /deuxième degré/, /direction ou de contrôle/, /salariées ou préposées/, /participation dans son capital/])
      expect(inconnu.message).toMatch(attendu)
    expect(inconnu.fondement).toMatch(/D\. 1967 art\. 39/)
    // un collaborateur du cabinet (préposé) salarié de l'entreprise : convention liée, autorisation exigée
    const prepose = sortie(demande(), { entrepriseLiee: true })
    const [motif] = motifsVisa(demande(), prepose)
    expect(motif.message).toMatch(/préposé/)
    expect(bloquants(controlerAvantEnvoiOs(demande(), viser(prepose), CONTEXTE))).toEqual(['convention_liee_non_autorisee'])
  })

  it('D. 1967 art. 62-7, al. 3 : mode de financement non précisé lors de la consultation → alerte à confirmer', () => {
    const d = demande()
    const aj = (modeFinancement: string | null) =>
      viser(
        sortie(d, {
          fondement: 'decision_aj_pouvoirs_ag',
          fondementReference: 'registre n° 7',
          decisionLe: '2026-10-02',
          justificatifs: { avisConseilSyndicalLe: '2026-10-01', modeFinancement },
        }),
        d,
      )
    const sansFinancement = controlerAvantEnvoiOs(d, aj(null), CONTEXTE)
    expect(codes(sansFinancement)).toEqual(['mode_financement_non_precise'])
    expect(sansFinancement[0]).toMatchObject({ gravite: 'alerte', aConfirmer: true })
    expect(sansFinancement[0].fondement).toMatch(/62-7, al\. 3/)
    expect(controlerAvantEnvoiOs(d, aj('emprunt collectif'), CONTEXTE)).toEqual([])
  })

  it('L. 1965 art. 42, al. 3 : travaux votés aux art. 25 ou 26, exécution suspendue pendant le délai de contestation, sauf urgence', () => {
    const d = demande()
    const resolution = (saisie: SaisieSortieOs = {}) =>
      sortie(d, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution: 'art25', ...saisie })
    const pendant = { ...CONTEXTE, finDelaiContestationAg: '2026-11-20' }
    const suspendu = controlerAvantEnvoiOs(d, resolution(), pendant)
    expect(bloquants(suspendu)).toEqual(['execution_suspendue_art42'])
    expect(suspendu[0].fondement).toMatch(/L\. 1965 art\. 42, al\. 3/)
    expect(bloquants(controlerAvantEnvoiOs(d, resolution({ majoriteResolution: 'art26' }), pendant))).toEqual(['execution_suspendue_art42'])
    // sans date prévue : la date de l'envoi
    const sansDate = demande({ prevuLe: null })
    expect(bloquants(controlerAvantEnvoiOs(sansDate, creerSortieOs(sansDate, { ...PRETE, fondement: 'execution_resolution_ag', fondementReference: 'résolution 7', majoriteResolution: 'art25' }), pendant))).toEqual(['execution_suspendue_art42'])
    expect(controlerAvantEnvoiOs(d, resolution(), { ...CONTEXTE, finDelaiContestationAg: '2026-10-14' })).toEqual([])
    expect(controlerAvantEnvoiOs(d, resolution({ majoriteResolution: 'art24' }), pendant)).toEqual([])
    expect(bloquants(controlerAvantEnvoiOs(d, resolution({ delai: 'urgence', constatUrgence: { ...CONSTAT, motif: 'Infiltrations actives' } }), pendant))).toEqual([])
    expect(codes(controlerAvantEnvoiOs(d, resolution(), CONTEXTE))).toEqual(['delai_contestation_inconnu'])
    expect(codes(controlerAvantEnvoiOs(d, resolution({ majoriteResolution: null }), CONTEXTE))).toEqual(['majorite_resolution_non_renseignee'])
  })

  it('mise en concurrence (D. 1967 art. 19-2) : devis DEMANDÉS ; à défaut de conditions de l’assemblée, au moins deux ; sinon le nombre fixé par l’assemblée', () => {
    const gros = demande({ prix: { montantTtcCentimes: 600_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 545_455 } })
    const options = { decisionsAgEnVigueur: SEUILS_ART21 }
    const contexte: ContexteEnvoiOs = { ...CONTEXTE, ...options, controle: { decennaleObligatoire: false, montantHtOperationCentimes: 400_000 } }
    const concurrence = (justificatifs: SaisieSortieOs['justificatifs']) =>
      controlerAvantEnvoiOs(gros, viser(sortie(gros, { justificatifs: { avisConseilSyndicalLe: '2026-10-02', ...justificatifs } }, options), gros), contexte)
    expect(concurrence({ devisDemandes: 2 })).toEqual([])
    const [un] = concurrence({ devisDemandes: 1 })
    expect(un.code).toBe('mise_en_concurrence_non_justifiee')
    expect(un.message).toMatch(/demandés/)
    expect(un.message).toMatch(/devis descriptif/)
    expect(un.message).not.toMatch(/comparés/)
    const ag = concurrence({ devisDemandes: 2, devisExigesParAssemblee: 3 })
    expect(codes(ag)).toEqual(['mise_en_concurrence_non_justifiee'])
    expect(ag[0].message).toMatch(/3 devis/)
    expect(ag[0].fondement).toBe('L. 1965 art. 21, al. 2')
    expect(concurrence({ devisDemandes: 3, devisExigesParAssemblee: 3 })).toEqual([])
  })

  it('seuils de l’art. 21 : « à partir du seuil » (montant égal compris), jamais « au-delà »', () => {
    const egal = demande({ prix: { montantTtcCentimes: 500_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 454_545 } })
    const options = { decisionsAgEnVigueur: SEUILS_ART21 }
    const motifs = motifsVisa(egal, sortie(egal), options)
    expect(codes(motifs)).toEqual(['consultation_conseil_syndical', 'mise_en_concurrence'])
    const anomalies = controlerAvantEnvoiOs(egal, viser(sortie(egal, {}, options), egal), { ...CONTEXTE, ...options })
    expect(codes(anomalies)).toEqual(['avis_conseil_syndical_non_enregistre', 'mise_en_concurrence_non_justifiee'])
    for (const message of [...motifs, ...anomalies].map((m) => m.message)) {
      expect(message).not.toMatch(/au-delà/)
      expect(message).toMatch(/à partir du seuil/)
    }
  })

  it('devis associé : échu avant que le courrier parvienne à l’entreprise (C. civ. art. 1117, 1121), et à la réception enregistrée', () => {
    const d = demande({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } })
    const jourMeme = { ...CONTEXTE, validiteDevisAu: '2026-10-03' }
    for (const canal of ['courrier', 'courrier_ar'] as const) {
      const anomalies = controlerAvantEnvoiOs(d, sortie(d, { canal }), jourMeme)
      expect(codes(anomalies), canal).toEqual(['devis_caduc'])
      expect(anomalies[0].message).toMatch(/parvien/)
      expect(anomalies[0].aConfirmer).toBe(true)
    }
    expect(controlerAvantEnvoiOs(d, sortie(d), jourMeme)).toEqual([])
    expect(controlerAvantEnvoiOs(d, sortie(d, { canal: 'courrier' }), { ...CONTEXTE, validiteDevisAu: '2026-10-04' })).toEqual([])
    const envoye = envoyerOs(d, sortie(d), ENVOI, CONTEXTE)
    const recu = enregistrerReception(envoye, { ...ENVOI, date: '2026-10-05', heure: '09:00' })
    const tardive = devisCaducALaReception(d, recu, '2026-10-04')
    expect(codes(tardive)).toEqual(['devis_caduc'])
    expect(tardive[0].fondement).toMatch(/1121/)
    expect(devisCaducALaReception(d, recu, '2026-10-05')).toEqual([])
    expect(devisCaducALaReception(d, envoye, '2026-10-04')).toEqual([])
  })

  it('C. civ. art. 1127-4 cité avec son exception (art. 1125 et 1126), jamais pour le courrier papier', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'envoi-ordre-service.ts'), 'utf8')
    expect(source).toMatch(/[Hh]ors les cas prévus aux art(icle)?s?\.? 1125 et 1126/)
    expect(source).not.toMatch(/n'est effective que si/)
    expect(source).not.toContain('C. civ. art. 1121, 1127-4')
  })

  it('D. 1967 art. 37 : la provision d’urgence rappelle son objet, l’avis du conseil syndical et le devis estimatif', () => {
    const urgence = controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: 'urgence_sauvegarde', delai: 'urgence', constatUrgence: CONSTAT }), CONTEXTE)
    const suites = urgence.find((a) => a.code === 'urgence_suites')
    expect(suites?.message).toMatch(/ouverture du chantier/)
    expect(suites?.message).toMatch(/avis du conseil syndical/)
    expect(suites?.message).toMatch(/devis estimatif/)
  })

  it('fondement « décision du conseil syndical délégataire » : délégation en vigueur attendue (L. 1965 art. 21-1, 21-3, 25 a)', () => {
    const s = sortie(demande(), { fondement: 'decision_conseil_syndical', fondementReference: 'PV CS du 01/09/2026' })
    const sans = controlerAvantEnvoiOs(demande(), s, { ...CONTEXTE, decisionsAgEnVigueur: [] })
    expect(codes(sans)).toEqual(['delegation_cs_absente'])
    expect(sans[0]).toMatchObject({ gravite: 'alerte', aConfirmer: true })
    expect(sans[0].fondement).toMatch(/21-3/)
    const generale = decisionSeuil('delegation_generale_cs', null)
    expect(controlerAvantEnvoiOs(demande(), s, { ...CONTEXTE, decisionsAgEnVigueur: [generale] })).toEqual([])
    const art25a: DecisionAnnuelle = { ...decisionSeuil('delegation_art25a', 300_000), delegataire: 'conseil_syndical' }
    expect(controlerAvantEnvoiOs(demande(), s, { ...CONTEXTE, decisionsAgEnVigueur: [art25a] })).toEqual([])
    const auSyndic: DecisionAnnuelle = { ...art25a, delegataire: 'syndic' }
    expect(codes(controlerAvantEnvoiOs(demande(), s, { ...CONTEXTE, decisionsAgEnVigueur: [auSyndic] }))).toEqual(['delegation_cs_absente'])
    expect(controlerAvantEnvoiOs(demande(), s, CONTEXTE)).toEqual([])
  })

  it('canal SMS : même contrôle que le courriel (C. civ. art. 1126, 1127 ; loi n° 2004-575, art. 1er, IV)', () => {
    const sms = sortie(demande(), { canal: 'sms' })
    const non = controlerAvantEnvoiOs(demande(), sms, { ...CONTEXTE, smsCommunique: false })
    expect(bloquants(non)).toEqual(['sms_non_communique'])
    expect(non[0].fondement).toMatch(/2004-575/)
    expect(codes(controlerAvantEnvoiOs(demande(), sms, CONTEXTE))).toEqual(['sms_a_verifier'])
    expect(controlerAvantEnvoiOs(demande(), sms, { ...CONTEXTE, smsCommunique: true })).toEqual([])
  })

  it('un visa donné tombe quand la demande change après le visa : contrôle avant l’envoi et envoi le voient', () => {
    const avant = demande()
    const visee = viseeParDirection(avant)
    const apres: Demande = { ...avant, prestataireId: 'ent-2', objet: 'Remplacement complet de la colonne' }
    const pieces = { ...CONTEXTE, pieces: { ...PIECES, prestataireId: 'ent-2' } }
    // l'entreprise a changé : la réponse sur le lien, donnée pour ent-1, est aussi périmée (tour 2)
    expect(bloquants(controlerAvantEnvoiOs(apres, visee, pieces))).toEqual(['visa_a_revoir', 'lien_entreprise_perime'])
    expect(() => envoyerOs(apres, visee, { ...ENVOI, destinataire: creerRattachement('Entreprise', 'ent-2') }, pieces)).toThrow(/revoir le visa/)
    const plusCher: Demande = { ...avant, prix: { montantTtcCentimes: 4_900_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 400_000 } }
    expect(bloquants(controlerAvantEnvoiOs(plusCher, visee, CONTEXTE))).toEqual(['visa_a_revoir'])
    expect(controlerAvantEnvoiOs(avant, visee, CONTEXTE)).toEqual([])
  })

  it('premier envoi daté avant le dernier événement du visa : refusé ; visa daté avant la demande : refusé', () => {
    const d = demande()
    const le5 = (s: SaisieEvenementVisa): SaisieEvenementVisa => ({ ...s, date: '2026-10-05' })
    const visee = donnerVisa(demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, le5(DEMANDE_GESTION)), d, le5(VISA_DIRECTION))
    expect(() => envoyerOs(d, visee, ENVOI, CONTEXTE)).toThrow(/antérieur au dernier événement du visa/)
    expect(envoyerOs(d, visee, { ...ENVOI, date: '2026-10-05', heure: '10:00' }, CONTEXTE).journal).toHaveLength(1)
    const libre = sortie(d)
    expect(() => exigerVisa(libre, d, { ...DEMANDE_GESTION, date: '2026-09-30' })).toThrow(/antérieur à la demande/)
    expect(() => demanderVisa(sortie(d, {}, { regles: SEUIL_100 }), d, { ...DEMANDE_GESTION, date: '2020-01-01' })).toThrow(/antérieur à la demande/)
  })

  it('pièces de l’entreprise non fournies : bloquant au-delà du seuil de vigilance, montant inconnu ou décennale obligatoire', () => {
    const d = demande({ prix: PRIX_6600_TTC })
    const sansPieces = { ...CONTEXTE, pieces: undefined }
    const gros = controlerAvantEnvoiOs(d, sortie(d), sansPieces)
    expect(bloquants(gros)).toEqual(['controle_declaratif_non_fait'])
    expect(gros[0].fondement).toMatch(/L\. 8222-1/)
    expect(() => envoyerOs(d, sortie(d), ENVOI, { prestataireAvecCompteVitfix: true })).toThrow(/Contrôle déclaratif/)
    const inconnu = demande({ prix: null })
    expect(bloquants(controlerAvantEnvoiOs(inconnu, sortie(inconnu), sansPieces))).toEqual(['controle_declaratif_non_fait'])
    expect(bloquants(controlerAvantEnvoiOs(demande(), sortie(), { ...sansPieces, controle: { decennaleObligatoire: true } }))).toEqual(['controle_declaratif_non_fait'])
    const petit = controlerAvantEnvoiOs(demande(), sortie(), sansPieces)
    expect(petit.map((a) => [a.code, a.gravite])).toEqual([['controle_declaratif_non_fait', 'alerte']])
  })

  it('date de relance antérieure à l’envoi : envoi refusé ; antérieure à la demande : refusée à la création', () => {
    const d = demande()
    expect(() => creerSortieOs(d, { ...PRETE, relanceLe: '2026-09-01' })).toThrow(/antérieure à la demande/)
    const tropTot = fixerRelance(sortie(d), '2026-10-02')
    const anomalies = controlerAvantEnvoiOs(d, tropTot, CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['relance_avant_envoi'])
    expect(() => envoyerOs(d, tropTot, ENVOI, CONTEXTE)).toThrow(/relance/)
    expect(envoyerOs(d, fixerRelance(sortie(d), '2026-10-03'), ENVOI, CONTEXTE).relanceLe).toBe('2026-10-03')
  })

  it('« Diffusable » se règle encore après le premier envoi (marquerDiffusable) ; non diffusable avant l’envoi : bloquant', () => {
    const copie: SaisieDiffusion = { ...ENVOI, heure: '11:00', canal: 'courriel', destinataire: creerRattachement('Identité', 'id-occupant'), missionId: null }
    const arretee = marquerDiffusable(envoyee(), false)
    expect(arretee.diffusable).toBe(false)
    expect(() => envoyerOs(demande(), arretee, copie, CONTEXTE)).toThrow(/non diffusable/)
    expect(envoyerOs(demande(), marquerDiffusable(arretee, true), copie, CONTEXTE).journal).toHaveLength(2)
    expect(bloquants(controlerAvantEnvoiOs(demande(), marquerDiffusable(sortie(), false), CONTEXTE))).toEqual(['non_diffusable'])
  })

  it('N° : segment d’un autre mandat ou N° en double signalés ; au-delà de 50 caractères, bloquant pour la messagerie VitFix', () => {
    const autreMandat = { ...demande(), numero: '13.3.900' }
    const contexte = { ...CONTEXTE, segmentMandat: '12' }
    const etranger = controlerAvantEnvoiOs(autreMandat, sortie(autreMandat), contexte)
    expect(codes(etranger)).toEqual(['numero_hors_sequence'])
    expect(etranger[0].message).toMatch(/13/)
    expect(controlerAvantEnvoiOs(demande(), sortie(), contexte)).toEqual([])
    const doublon = controlerAvantEnvoiOs(demande(), sortie(), { ...contexte, numerosDuMandat: [{ id: 'dem-9', numero: '12.3.456' }, { id: 'dem-1', numero: '12.3.456' }] })
    expect(codes(doublon)).toEqual(['numero_en_double'])
    expect(doublon[0].message).toMatch(/dem-9/)
    const long = { ...demande(), numero: 'x'.repeat(LONGUEUR_MAX_NUMERO_OS + 1) }
    expect(bloquants(controlerAvantEnvoiOs(long, sortie(long), CONTEXTE))).toEqual(['numero_trop_long'])
    expect(bloquants(controlerAvantEnvoiOs(long, sortie(long, { canal: 'courriel' }), { ...CONTEXTE, courrielCommunique: true }))).toEqual([])
    expect(() => demandeEnvoiDepuisOs(long, sortie(long), { syndicArtisanId: 'a', copropriete: 'c' })).toThrow(/50/)
  })

  it('constat d’urgence sans délai « urgence » : l’urgence n’est pas retenue, l’avis de D. 1967 art. 62-7 reste exigé, alerte', () => {
    const d = demande()
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      justificatifs: { modeFinancement: 'appel de fonds' },
    }
    const s = sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, motif: 'à voir' } })
    expect(s.visa).toBe('Visa nécessaire')
    expect(s.motifsVisa).toEqual(['avis_conseil_syndical_aj'])
    const anomalies = controlerAvantEnvoiOs(d, viser(s, d), CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(anomalies.find((a) => a.code === 'constat_urgence_sans_urgence')?.gravite).toBe('alerte')
    // OS créé en urgence constatée, puis ramené au délai « normale » : l'avis redevient exigé
    const rabaissee = modifierSortieOs(sortie(d, { ...cadre, delai: 'urgence', constatUrgence: CONSTAT }), d, { delai: 'normale' })
    expect(bloquants(controlerAvantEnvoiOs(d, rabaissee, CONTEXTE))).toEqual(['visa_devenu_necessaire', 'avis_conseil_syndical_aj_absent'])
  })
})

describe('retours de relecture du point 44 (tour 2)', () => {
  const pourEnt2: ContexteEnvoiOs = { ...CONTEXTE, pieces: { ...PIECES, prestataireId: 'ent-2' } }
  const envoiEnt2: SaisieDiffusion = { ...ENVOI, destinataire: creerRattachement('Entreprise', 'ent-2') }

  it('lien avec le syndic (D. 1967 art. 39) : la réponse vaut pour l’entreprise de la demande ; l’entreprise changée, elle est périmée (bloquant)', () => {
    const avant = demande()
    const libre = sortie(avant)
    expect(libre.visa).toBe('Sortie libre')
    const apres: Demande = { ...avant, prestataireId: 'ent-2' }
    const anomalies = controlerAvantEnvoiOs(apres, libre, pourEnt2)
    expect(bloquants(anomalies)).toEqual(['lien_entreprise_perime'])
    expect(libre.entrepriseLieeDeclareePour).toBe('ent-1')
    expect(anomalies[0].message).toMatch(/ent-1.*ent-2/)
    expect(anomalies[0].fondement).toMatch(/D\. 1967 art\. 39/)
    expect(() => envoyerOs(apres, libre, envoiEnt2, pourEnt2)).toThrow(/redire si la convention/)
    // revue du visa puis nouveau visa : la réponse reste périmée
    const revue = revoirVisa(viseeParDirection(avant), apres, evenement('col-gestion', 'Gestion', '11:00'), { regles: SEUIL_100 })
    const revisee = donnerVisa(demanderVisa(revue, apres, evenement('col-gestion', 'Gestion', '12:00')), apres, evenement('col-direction', 'Direction', '13:00'))
    expect(revisee.visa).toBe('Visa donné')
    expect(bloquants(controlerAvantEnvoiOs(apres, revisee, { ...pourEnt2, regles: SEUIL_100 }))).toEqual(['lien_entreprise_perime'])
    // redite pour ent-2 : l'envoi repart
    const redite = modifierSortieOs(libre, apres, { entrepriseLiee: false })
    expect(redite.entrepriseLieeDeclareePour).toBe('ent-2')
    expect(controlerAvantEnvoiOs(apres, redite, pourEnt2)).toEqual([])
    expect(envoyerOs(apres, redite, envoiEnt2, pourEnt2).journal).toHaveLength(1)
  })

  it('lien périmé : ni motif de visa ni autorisation tirés de la réponse donnée pour l’entreprise précédente', () => {
    const avant = demande()
    const apres: Demande = { ...avant, prestataireId: 'ent-2' }
    const liee = sortie(avant, { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: 'AG du 12/05/2026, résolution 14' } })
    expect(codes(motifsVisa(avant, liee))).toEqual(['convention_liee'])
    expect(codes(motifsVisa(apres, liee))).toEqual([])
    // même entreprise : l'autorisation demeure ; autre entreprise : elle est effacée (elle visait la convention avec ent-1)
    expect(modifierSortieOs(liee, avant, { entrepriseLiee: true }).justificatifs.autorisationConventionLiee).toBe('AG du 12/05/2026, résolution 14')
    const lieeEnt2 = modifierSortieOs(liee, apres, { entrepriseLiee: true })
    expect(lieeEnt2.justificatifs.autorisationConventionLiee).toBeNull()
    expect(bloquants(controlerAvantEnvoiOs(apres, viser(lieeEnt2, apres), pourEnt2))).toEqual(['convention_liee_non_autorisee'])
    const autoriseeEnt2 = modifierSortieOs(liee, apres, { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: 'AG du 12/05/2026, résolution 15' } })
    expect(controlerAvantEnvoiOs(apres, viser(autoriseeEnt2, apres), pourEnt2)).toEqual([])
    // une autorisation saisie avant toute réponse sur le lien n'est pas effacée par la première réponse
    const autoriseeAvant = sortie(avant, { entrepriseLiee: null, justificatifs: { autorisationConventionLiee: 'résolution 14' } })
    expect(modifierSortieOs(autoriseeAvant, avant, { entrepriseLiee: true }).justificatifs.autorisationConventionLiee).toBe('résolution 14')
  })

  it('décision qui fonde l’OS datée après l’envoi (decisionLe) : bloquant, l’OS ne part pas avant elle (D. 1967 art. 62-8)', () => {
    const d = demande()
    const aj = viser(
      sortie(d, {
        fondement: 'decision_aj_pouvoirs_ag',
        fondementReference: 'registre n° 7',
        decisionLe: '2026-10-20',
        justificatifs: { avisConseilSyndicalLe: '2026-10-02', modeFinancement: 'appel de fonds travaux' },
      }),
      d,
    )
    const anomalies = controlerAvantEnvoiOs(d, aj, CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['decision_posterieure_envoi'])
    expect(anomalies[0].message).toMatch(/20\/10\/2026.*03\/10\/2026/)
    expect(anomalies[0].fondement).toMatch(/62-8/)
    expect(() => envoyerOs(d, aj, ENVOI, CONTEXTE)).toThrow(/avant la décision qui le fonde/)
    // exécution d'une résolution d'assemblée tenue après l'envoi
    const resolution = sortie(d, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 01/12/2026, résolution 3', decisionLe: '2026-12-01', majoriteResolution: 'art24' })
    expect(bloquants(controlerAvantEnvoiOs(d, resolution, CONTEXTE))).toEqual(['decision_posterieure_envoi'])
    // décision du jour de l'envoi, ou antérieure : acceptée
    const duJour = modifierSortieOs(resolution, d, { decisionLe: '2026-10-03' })
    expect(controlerAvantEnvoiOs(d, duJour, CONTEXTE)).toEqual([])
    expect(envoyerOs(d, duJour, ENVOI, CONTEXTE).journal).toHaveLength(1)
    // OS sans fondement renseigné : la date saisie est contrôlée aussi
    const sansFondement = controlerAvantEnvoiOs(d, sortie(d, { fondement: null, decisionLe: '2026-10-04' }), CONTEXTE)
    expect(bloquants(sansFondement)).toEqual(['decision_posterieure_envoi'])
  })

  it('objet : requis et de 200 caractères au plus pour la messagerie VitFix, comme dans le corps de la route (ajOrdrePrestataireSchema)', () => {
    const vitfix = { syndicArtisanId: '00000000-0000-4000-8000-000000000001', copropriete: 'Résidence test' }
    const corps = (d: Demande) => ({ action: 'envoyer' as const, ...demandeEnvoiDepuisOs(d, sortie(d), vitfix) })
    // 201 caractères : le contrôle bloque l'envoi, et le schéma refuserait le corps
    const long = demande({ objet: 'o'.repeat(201) })
    const anomalies = controlerAvantEnvoiOs(long, sortie(long), CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['objet_trop_long'])
    expect(LONGUEUR_MAX_OBJET_OS).toBe(200)
    const limite = demande({ objet: 'o'.repeat(LONGUEUR_MAX_OBJET_OS) })
    expect(controlerAvantEnvoiOs(limite, sortie(limite), CONTEXTE)).toEqual([])
    expect(ajOrdrePrestataireSchema.safeParse(corps(limite)).success).toBe(true)
    expect(ajOrdrePrestataireSchema.safeParse({ ...corps(limite), objet: long.objet }).success).toBe(false)
    expect(anomalies[0].message).toMatch(/201 caractères.*200 au plus \(objet\)/)
    expect(() => envoyerOs(long, sortie(long), ENVOI, CONTEXTE)).toThrow(/Objet de 201 caractères/)
    expect(() => demandeEnvoiDepuisOs(long, sortie(long), vitfix)).toThrow(/200 au plus \(objet\)/)
    // autre canal : pas de borne
    expect(bloquants(controlerAvantEnvoiOs(long, sortie(long, { canal: 'courriel' }), { ...CONTEXTE, courrielCommunique: true }))).toEqual([])
    // espaces de début et de fin : retirés avant la borne, comme dans le schéma
    const entoure: Demande = { ...demande(), objet: ` ${'o'.repeat(LONGUEUR_MAX_OBJET_OS)} ` }
    expect(controlerAvantEnvoiOs(entoure, sortie(entoure), CONTEXTE)).toEqual([])
    expect(ajOrdrePrestataireSchema.safeParse(corps(entoure)).success).toBe(true)
    // objet vide : requis par le schéma
    const vide: Demande = { ...demande(), objet: '  ' }
    expect(ajOrdrePrestataireSchema.safeParse({ ...corps(limite), objet: vide.objet }).success).toBe(false)
    expect(bloquants(controlerAvantEnvoiOs(vide, sortie(vide), CONTEXTE))).toEqual(['objet_absent'])
    expect(() => demandeEnvoiDepuisOs(vide, sortie(vide), vitfix)).toThrow(/Objet absent/)
    // N° et objet trop longs : les deux sont signalés
    const lesDeux: Demande = { ...long, numero: 'x'.repeat(LONGUEUR_MAX_NUMERO_OS + 1) }
    expect(bloquants(controlerAvantEnvoiOs(lesDeux, sortie(lesDeux), CONTEXTE))).toEqual(['numero_trop_long', 'objet_trop_long'])
    expect(() => demandeEnvoiDepuisOs(lesDeux, sortie(lesDeux), vitfix)).toThrow(/reference_aj.*objet/)
  })
})

describe('retours de relecture du point 44 (tour 3)', () => {
  const avant = demande()
  const apres: Demande = { ...avant, prestataireId: 'ent-2' }
  const pourEnt2: ContexteEnvoiOs = { ...CONTEXTE, pieces: { ...PIECES, prestataireId: 'ent-2' } }
  const envoiEnt2: SaisieDiffusion = { ...ENVOI, destinataire: creerRattachement('Entreprise', 'ent-2') }
  const AUTORISATION_ENT1 = 'AG du 12/05/2026, résolution 14 (ent-1)'
  const AUTORISATION_ENT2 = 'AG du 12/05/2026, résolution 15 (ent-2)'

  it('autorisation de l’assemblée (D. 1967 art. 39) : elle vaut pour l’entreprise de la demande au moment où elle est saisie', () => {
    const s = sortie(avant, { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: AUTORISATION_ENT1 } })
    expect(s.autorisationConventionLieePour).toBe('ent-1')
    expect(autorisationConvention(avant, s)).toBe(AUTORISATION_ENT1)
    expect(autorisationConvention(apres, s)).toBeNull()
    // effacée à la saisie : elle ne vaut plus pour aucune entreprise
    const effacee = modifierSortieOs(s, avant, { justificatifs: { autorisationConventionLiee: ' ' } })
    expect(effacee.justificatifs.autorisationConventionLiee).toBeNull()
    expect(effacee.autorisationConventionLieePour).toBeNull()
    // une autre pièce saisie ne déplace pas l'autorisation vers l'entreprise actuelle
    expect(modifierSortieOs(s, apres, { justificatifs: { modeFinancement: 'fonds travaux' } }).autorisationConventionLieePour).toBe('ent-1')
  })

  it('réponse sur le lien remise à « inconnu », puis entreprise changée : l’autorisation donnée pour ent-1 ne vaut pas pour ent-2', () => {
    const s = sortie(avant, { entrepriseLiee: true, justificatifs: { autorisationConventionLiee: AUTORISATION_ENT1 } })
    const inconnu = modifierSortieOs(s, avant, { entrepriseLiee: null })
    expect(inconnu.justificatifs.autorisationConventionLiee).toBe(AUTORISATION_ENT1)
    const lieeEnt2 = modifierSortieOs(inconnu, apres, { entrepriseLiee: true })
    expect(lieeEnt2.entrepriseLieeDeclareePour).toBe('ent-2')
    expect(lieeEnt2.justificatifs.autorisationConventionLiee).toBeNull()
    expect(lieeEnt2.autorisationConventionLieePour).toBeNull()
    const visee = viser(lieeEnt2, apres)
    expect(bloquants(controlerAvantEnvoiOs(apres, visee, pourEnt2))).toEqual(['convention_liee_non_autorisee'])
    expect(() => envoyerOs(apres, visee, envoiEnt2, pourEnt2)).toThrow(/autorisation spéciale/)
  })

  it('autorisation saisie avant toute réponse sur le lien, puis entreprise changée : elle ne vaut pas pour ent-2', () => {
    const s = sortie(avant, { entrepriseLiee: null, justificatifs: { autorisationConventionLiee: AUTORISATION_ENT1 } })
    const lieeEnt2 = modifierSortieOs(s, apres, { entrepriseLiee: true })
    expect(lieeEnt2.justificatifs.autorisationConventionLiee).toBeNull()
    const revue = revoirVisa(lieeEnt2, apres, evenement('col-gestion', 'Gestion', '08:00'))
    expect(revue.motifsVisa).toEqual(['convention_liee'])
    const visee = viser(revue, apres)
    expect(bloquants(controlerAvantEnvoiOs(apres, visee, pourEnt2))).toEqual(['convention_liee_non_autorisee'])
    expect(() => envoyerOs(apres, visee, envoiEnt2, pourEnt2)).toThrow(/autorisation spéciale/)
  })

  it('autorisation saisie pour une autre entreprise que celle de l’envoi, sans que le lien soit redit : le contrôle avant l’envoi l’écarte', () => {
    // lien dit pour ent-1 ; la demande passe à ent-2, l'autorisation est saisie pour ent-2 ; la demande revient à ent-1
    const liee = sortie(avant, { entrepriseLiee: true })
    const autoriseeEnt2 = modifierSortieOs(liee, apres, { justificatifs: { autorisationConventionLiee: AUTORISATION_ENT2 } })
    expect(autoriseeEnt2.autorisationConventionLieePour).toBe('ent-2')
    const visee = viser(autoriseeEnt2, avant)
    const anomalies = controlerAvantEnvoiOs(avant, visee, CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['convention_liee_non_autorisee'])
    expect(anomalies.find((a) => a.code === 'convention_liee_non_autorisee')?.message).toMatch(/ent-2.*ent-1/)
    expect(() => envoyerOs(avant, visee, ENVOI, CONTEXTE)).toThrow(/ne vaut pas/)
  })

  it('autorisation saisie pour ent-2 pendant que la réponse est périmée : redire la réponse pour ent-2 la garde', () => {
    const liee = sortie(avant, { entrepriseLiee: true })
    const autorisee = modifierSortieOs(liee, apres, { justificatifs: { autorisationConventionLiee: AUTORISATION_ENT2 } })
    const redite = modifierSortieOs(autorisee, apres, { entrepriseLiee: true })
    expect(redite.justificatifs.autorisationConventionLiee).toBe(AUTORISATION_ENT2)
    expect(controlerAvantEnvoiOs(apres, viser(redite, apres), pourEnt2)).toEqual([])
  })
})

describe('décisions de Hugo du 03/11/2026', () => {
  /** OS envoyé le 03/10/2026, relance fixée au 10/10/2026. */
  const aRelancer = () => fixerRelance(envoyee(), '2026-10-10')
  const avec = (changement: Partial<Demande>): Demande => ({ ...demande(), ...changement })
  const dues = (d: Demande, s: SortieOrdreService) => relancesOsDues([{ demande: d, sortie: s }])

  it('3. relance : due tant que la réponse à l’OS manque ; reçue (statut « Accepté », stade de l’acceptation ou au-delà, réalisation, devis d’une demande de devis), plus rien n’est dû', () => {
    const s = aRelancer()
    // changement de comportement : la date de relance seule ne suffit plus, l'OS accepté n'est plus à relancer
    expect(dues(avec({ statut: 'Accepté' }), s)).toEqual([])
    expect(attendusOs(demande(), s)).toEqual(['reponse'])
    expect(dues(demande(), s).map((r) => [r.id, r.date, r.attendus])).toEqual([['demandes:relance_os:dem-1', '2026-10-10', ['reponse']]])
    // bornes de l'étape « Demandée » : une proposition n'est pas une réponse
    expect(attendusOs(avec({ stade: 'Proposition en cours' }), s)).toEqual(['reponse'])
    expect(attendusOs(avec({ stade: 'Proposition résident' }), s)).toEqual(['reponse'])
    // réponse reçue : plus de relance due, même avec une date de relance fixée
    const recues: Partial<Demande>[] = [
      { statut: 'Accepté' },
      { stade: 'Acceptée' },
      { stade: 'Programmée' },
      { stade: 'Réalisée', realiseeLe: '2026-10-15' },
      { realiseeLe: '2026-10-15' },
    ]
    for (const changement of recues) {
      expect(attendusOs(avec(changement), s), JSON.stringify(changement)).toEqual([])
      expect(dues(avec(changement), s), JSON.stringify(changement)).toEqual([])
    }
    // demande de devis : le devis associé est la réponse ; pour une intervention, il précède l'OS et n'en est pas la réponse
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    const sDevis = fixerRelance(envoyerOs(devis, sortie(devis), ENVOI, CONTEXTE), '2026-10-10')
    expect(attendusOs(devis, sDevis)).toEqual(['reponse'])
    expect(attendusOs({ ...devis, devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000 } }, sDevis)).toEqual([])
    expect(attendusOs(avec({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000 } }), s)).toEqual(['reponse'])
    // OS jamais envoyé, demande terminée ou refusée : rien n'est attendu ; sortie d'une autre demande : erreur
    expect(attendusOs(demande(), sortie())).toEqual([])
    expect(attendusOs(avec({ statut: 'Terminé' }), s)).toEqual([])
    expect(attendusOs(avec({ stade: 'Refusée' }), s)).toEqual([])
    expect(() => attendusOs(avec({ id: 'dem-2' }), s)).toThrow(/autre demande/)
  })

  it('3. relance : « Accusé demandé » → l’accusé est attendu jusqu’à la ligne « reception » du journal (enregistrerReception)', () => {
    const s = aRelancer()
    const accuse = avec({ statut: 'Accusé demandé', stade: 'Acceptée' })
    expect(attendusOs(accuse, s)).toEqual(['accuse'])
    const [relance] = dues(accuse, s)
    expect(relance.attendus).toEqual(['accuse'])
    expect(relance.libelle).toMatch(/accusé de réception/)
    // réception enregistrée à l'heure même de l'envoi (borne) : reçu
    const recu = enregistrerReception(s, { ...ENVOI, heure: '10:00' })
    expect(attendusOs(accuse, recu)).toEqual([])
    expect(dues(accuse, recu)).toEqual([])
    // sans « Accusé demandé », la réception n'est pas attendue
    expect(attendusOs(avec({ stade: 'Acceptée' }), s)).toEqual([])
  })

  it('3. relance : « Rapport demandé » → le rapport est attendu jusqu’à son enregistrement (enregistrerRapport), au plus tôt le jour du premier envoi', () => {
    const s = aRelancer()
    const rapport = avec({ statut: 'Rapport demandé', stade: 'Réalisée', realiseeLe: '2026-10-15' })
    expect(attendusOs(rapport, s)).toEqual(['rapport'])
    expect(dues(rapport, s).map((r) => r.attendus)).toEqual([['rapport']])
    // bornes : la veille du premier envoi, refusé ; le jour même, reçu
    expect(() => enregistrerRapport(rapport, s, { recuLe: '2026-10-02' })).toThrow(/premier envoi/)
    const recu = enregistrerRapport(rapport, s, { recuLe: '2026-10-03', documentId: ' doc-7 ' })
    expect(recu.rapportRecu).toEqual({ recuLe: '2026-10-03', documentId: 'doc-7' })
    expect(s.rapportRecu).toBeNull()
    expect(attendusOs(rapport, recu)).toEqual([])
    expect(dues(rapport, recu)).toEqual([])
    // une seule fois ; jamais sur un OS non envoyé ; date contrôlée ; sortie d'une autre demande refusée
    expect(() => enregistrerRapport(rapport, recu, { recuLe: '2026-10-20' })).toThrow(/déjà enregistré/)
    expect(() => enregistrerRapport(rapport, sortie(), { recuLe: '2026-10-20' })).toThrow(/jamais envoyé/)
    expect(() => enregistrerRapport(rapport, s, { recuLe: '20/10/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => enregistrerRapport({ ...rapport, id: 'dem-2' }, s, { recuLe: '2026-10-20' })).toThrow(/autre demande/)
  })

  it('3. relance : plusieurs éléments manquants → UN élément par OS, à la date de relance, qui liste ce qui manque', () => {
    const s = aRelancer()
    const accuse = avec({ statut: 'Accusé demandé' })
    expect(attendusOs(accuse, s)).toEqual(['reponse', 'accuse'])
    const relances = dues(accuse, s)
    expect(relances).toHaveLength(1)
    expect(relances[0]).toMatchObject({ id: 'demandes:relance_os:dem-1', date: '2026-10-10', attendus: ['reponse', 'accuse'], assigneId: 'col-gestion' })
    expect(relances[0].libelle).toMatch(/réponse à l'ordre de service, accusé de réception/)
    expect(attendusOs(avec({ statut: 'Rapport demandé' }), s)).toEqual(['reponse', 'rapport'])
    // après la relance, la date est vidée : la suivante se fixe par fixerRelance (l'OS reste dû entre-temps : tour 1 ci-dessous)
    const relancee = relancerOs(s, { ...ENVOI, date: '2026-10-10', heure: '09:00' })
    expect(relancee.relanceLe).toBeNull()
    expect(dues(accuse, fixerRelance(relancee, '2026-10-17')).map((r) => [r.date, r.attendus, r.relanceAFixer])).toEqual([['2026-10-17', ['reponse', 'accuse'], false]])
  })

  it('4. courriers : le visa suit le même circuit (CircuitVisa), réutilisable pour une autre pièce de sortie', () => {
    type MotifCourrier = 'mise_en_demeure'
    interface CourrierVise extends CircuitVisa<MotifCourrier> {
      courrierId: string
    }
    const lettre = (objet: string): PieceVisee => ({
      designation: 'le courrier',
      sortie: 'le dépôt',
      datee: '2026-10-01',
      empreinte: JSON.stringify([objet, 'id-1']),
      champsVises: 'objet, destinataire',
    })
    const avant = lettre('Mise en demeure de payer')
    const prepare: CourrierVise = { courrierId: 'courrier-1', ...circuitVisaInitial<MotifCourrier>(['mise_en_demeure']) }
    expect(prepare).toMatchObject({ visa: 'Visa nécessaire', motifsVisa: ['mise_en_demeure'], empreinteVisee: null, historiqueVisa: [] })
    expect(circuitVisaInitial([]).visa).toBe('Sortie libre')
    expect(visaPermetSortie(prepare)).toBe(false)
    // messages : la sortie du courrier est son dépôt (controlerDepot), pas un envoi
    expect(anomaliesCircuitVisa(prepare, avant, [])).toEqual([{ code: 'visa_manquant', message: 'Visa nécessaire non demandé : demander le visa avant le dépôt.' }])
    const demandee = appliquerActionVisa(prepare, avant, 'demande', DEMANDE_GESTION)
    expect(demandee.courrierId).toBe('courrier-1')
    expect(demandee.empreinteVisee).toBe(avant.empreinte)
    expect(anomaliesCircuitVisa(demandee, avant, [])).toEqual([{ code: 'visa_manquant', message: 'Visa demandé, en attente du viseur : dépôt impossible.' }])
    const refuse = appliquerActionVisa(demandee, avant, 'refuse', evenement('col-direction', 'Direction', '10:00', 'Ton trop vif'))
    expect(anomaliesCircuitVisa(refuse, avant, [])).toEqual([
      { code: 'visa_manquant', message: 'Visa refusé : revoir le courrier, puis demander de nouveau le visa. Motif du refus : Ton trop vif' },
    ])
    // mêmes règles que pour l'OS : viseur habilité, autre que le demandeur, refus motivé, horodatage, transitions
    expect(() => appliquerActionVisa(demandee, avant, 'donne', evenement('col-gestion-2', 'Gestion', '10:00'))).toThrow(/non habilité/)
    expect(() => appliquerActionVisa(demandee, avant, 'donne', evenement('col-gestion', 'Direction', '10:00'))).toThrow(/autre collaborateur/)
    expect(() => appliquerActionVisa(demandee, avant, 'refuse', VISA_DIRECTION)).toThrow(/motif/)
    expect(() => appliquerActionVisa(prepare, { ...avant, datee: '2026-10-05' }, 'demande', DEMANDE_GESTION)).toThrow(/antérieur au courrier du 05\/10\/2026/)
    expect(() => appliquerActionVisa(prepare, avant, 'donne', VISA_DIRECTION)).toThrow(/impossible/)
    const vise = appliquerActionVisa(demandee, avant, 'donne', VISA_DIRECTION)
    expect(vise.visa).toBe('Visa donné')
    expect(visaPermetSortie(vise)).toBe(true)
    expect(anomaliesCircuitVisa(vise, avant, [])).toEqual([])
    // le courrier change après le visa : à revoir, puis la revue le ramène à « Visa nécessaire »
    const apres = lettre('Mise en demeure de payer sous huit jours')
    expect(anomaliesCircuitVisa(vise, apres, [])).toEqual([
      { code: 'visa_a_revoir', message: 'Le courrier a changé depuis le visa (objet, destinataire) : revoir le visa.' },
    ])
    const revu = revoirCircuitVisa(vise, apres, ['mise_en_demeure'], evenement('col-gestion', 'Gestion', '11:00'))
    expect(revu).toMatchObject({ courrierId: 'courrier-1', visa: 'Visa nécessaire', empreinteVisee: null })
    expect(revu.historiqueVisa.map((e) => e.action)).toEqual(['demande', 'donne', 'revu'])
    expect(revoirCircuitVisa(vise, avant, ['mise_en_demeure'], evenement('col-gestion', 'Gestion', '11:00')).visa).toBe('Visa donné')
    // un motif nouveau sur une sortie libre : visa devenu nécessaire
    const libre: CourrierVise = { courrierId: 'courrier-2', ...circuitVisaInitial<MotifCourrier>([]) }
    const motifs = [{ code: 'mise_en_demeure', message: 'Mise en demeure : visa de la direction.' }]
    expect(codes(anomaliesCircuitVisa(libre, avant, motifs))).toEqual(['visa_devenu_necessaire'])
  })

  it('6. avis préalable sous administration provisoire (D. 1967 art. 62-7) : l’urgence est CONSTATÉE par l’administrateur provisoire (constat daté, motivé, attribué)', () => {
    const d = demande()
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      delai: 'urgence',
      justificatifs: { modeFinancement: 'appel de fonds' },
    }
    // constat complet : l'avis n'est plus exigé
    const constatee = sortie(d, { ...cadre, constatUrgence: CONSTAT })
    expect(constatee.visa).toBe('Sortie libre')
    expect(constatee.constatUrgence).toEqual(CONSTAT)
    expect(controlerAvantEnvoiOs(d, constatee, CONTEXTE)).toEqual([])
    expect(sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, motif: '  Fuite active  ', collaborateurId: ' col-direction ' } }).constatUrgence).toEqual({
      ...CONSTAT,
      motif: 'Fuite active',
    })
    // constat incomplet à la saisie : refusé (date, motif, auteur)
    expect(() => sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, motif: '   ' } })).toThrow(/motif/)
    expect(() => sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, constateLe: '02/10/2026' } })).toThrow(/AAAA-MM-JJ/)
    expect(() => sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, collaborateurId: ' ' } })).toThrow(/collaborateur/)
    // sans constat : l'avis reste exigé (bloquant), l'urgence est signalée non constatée
    const sansConstat = viser(sortie(d, cadre), d)
    const anomalies = controlerAvantEnvoiOs(d, sansConstat, CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(anomalies.find((a) => a.code === 'urgence_non_constatee')).toMatchObject({ gravite: 'alerte' })
    // constat incomplet repris d'ailleurs : il ne vaut pas constat, l'avis reste exigé
    const incomplet: SortieOrdreService = { ...sansConstat, constatUrgence: { ...CONSTAT, motif: ' ' } }
    expect(codes(motifsVisa(d, incomplet))).toEqual(['avis_conseil_syndical_aj'])
    const anomaliesIncomplet = controlerAvantEnvoiOs(d, incomplet, CONTEXTE)
    expect(bloquants(anomaliesIncomplet)).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(anomaliesIncomplet.find((a) => a.code === 'urgence_non_constatee')?.message).toMatch(/manque : motif/)
    // délai « prioritaire » : toujours pas une urgence, même constatée
    const prioritaire = sortie(d, { ...cadre, delai: 'prioritaire', constatUrgence: CONSTAT })
    expect(prioritaire.motifsVisa).toEqual(['avis_conseil_syndical_aj'])
    const anomaliesPrioritaire = controlerAvantEnvoiOs(d, viser(prioritaire, d), CONTEXTE)
    expect(bloquants(anomaliesPrioritaire)).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(anomaliesPrioritaire.find((a) => a.code === 'constat_urgence_sans_urgence')).toMatchObject({ gravite: 'alerte' })
  })
})

describe('retours de relecture des décisions de Hugo du 03/11/2026 (tour 1)', () => {
  /** Intervention décidée par l'administrateur provisoire au titre des pouvoirs de l'assemblée, inscrite au registre le 02/10/2026. */
  const cadreAj = (constatUrgence: ConstatUrgence | null, saisie: SaisieSortieOs = {}): SaisieSortieOs => ({
    fondement: 'decision_aj_pouvoirs_ag',
    fondementReference: 'registre n° 7',
    decisionLe: '2026-10-02',
    delai: 'urgence',
    constatUrgence,
    ...saisie,
    justificatifs: { modeFinancement: 'appel de fonds', ...saisie.justificatifs },
  })
  const le = (constateLe: string): ConstatUrgence => ({ ...CONSTAT, constateLe })
  const dues = (d: Demande, s: SortieOrdreService) => relancesOsDues([{ demande: d, sortie: s }])

  it('constat daté après la décision au registre, avis du conseil syndical recueilli à temps : le constat ne sert pas, rien ne bloque', () => {
    const d = demande()
    const s = sortie(d, cadreAj(le('2026-10-03'), { justificatifs: { avisConseilSyndicalLe: '2026-10-01' } }))
    expect(controlerAvantEnvoiOs(d, s, CONTEXTE)).toEqual([])
    expect(envoyerOs(d, s, ENVOI, CONTEXTE).journal).toHaveLength(1)
    // avis du jour même de la décision (borne) : à temps aussi
    expect(controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-03'), { justificatifs: { avisConseilSyndicalLe: '2026-10-02' } })), CONTEXTE)).toEqual([])
  })

  it('demande de devis au titre des pouvoirs de l’assemblée : aucun avis n’est exigé, la date du constat n’est pas contrôlée', () => {
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    const contexte: ContexteEnvoiOs = { date: '2026-10-03', prestataireAvecCompteVitfix: true }
    expect(controlerAvantEnvoiOs(devis, sortie(devis, cadreAj(null, { delai: 'normale' })), contexte)).toEqual([])
    expect(controlerAvantEnvoiOs(devis, sortie(devis, cadreAj(le('2026-10-03'))), contexte)).toEqual([])
    expect(envoyerOs(devis, sortie(devis, cadreAj(le('2026-10-03'))), ENVOI, contexte).journal).toHaveLength(1)
  })

  it('constat qui tient lieu de l’avis, daté après la décision au registre : alerte à confirmer (règle proposée, question à Hugo), plus de bloquant', () => {
    const d = demande()
    // bornes : constat du jour de la décision, rien ; du lendemain, alerte à confirmer
    expect(controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-02'))), CONTEXTE)).toEqual([])
    const tardif = controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-03'))), CONTEXTE)
    expect(tardif.map((a) => [a.code, a.gravite, a.aConfirmer])).toEqual([['constat_urgence_posterieur', 'alerte', true]])
    expect(tardif[0].message).toMatch(/Urgence constatée le 03\/10\/2026, après la décision au registre du 02\/10\/2026/)
    // l'issue proposée lève bien l'alerte : enregistrer l'avis recueilli à temps, ou corriger la date du constat
    expect(tardif[0].message).toMatch(/enregistrer l'avis s'il a été recueilli au plus tard ce jour-là, ou corriger la date du constat/)
    expect(tardif[0].fondement).toMatch(/62-7/)
    expect(envoyerOs(d, sortie(d, cadreAj(le('2026-10-03'))), ENVOI, CONTEXTE).journal).toHaveLength(1)
    // avis recueilli après la décision : il ne vaut pas avis préalable, le constat tardif reste signalé
    const avisTardif = sortie(d, cadreAj(le('2026-10-03'), { justificatifs: { avisConseilSyndicalLe: '2026-10-03' } }))
    expect(codes(controlerAvantEnvoiOs(d, avisTardif, CONTEXTE))).toEqual(['constat_urgence_posterieur'])
    // décision non datée : le jour de l'envoi sert de borne ; un constat du lendemain est postérieur à l'envoi (tour 2 :
    // bloquant constat_urgence_posterieur_envoi, et non plus l'alerte constat_urgence_posterieur)
    const sansDate = (constateLe: string) => sortie(d, cadreAj(le(constateLe), { decisionLe: null }))
    expect(controlerAvantEnvoiOs(d, sansDate('2026-10-03'), CONTEXTE)).toEqual([])
    const apresEnvoi = controlerAvantEnvoiOs(d, sansDate('2026-10-04'), CONTEXTE)
    expect(apresEnvoi.map((a) => [a.code, a.gravite])).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    expect(apresEnvoi[0].message).toMatch(/après l'envoi du 03\/10\/2026/)
  })

  it('exécution d’une résolution (L. 1965 art. 42, al. 3 ; la décision 7 ne fixe pas la date du constat) et autres fondements : la date du constat n’est pas comparée à la décision', () => {
    const d = demande()
    const pendant = { ...CONTEXTE, finDelaiContestationAg: '2026-11-20' }
    // constat du jour de l'envoi, trois semaines après la résolution du 12/09/2026 (tour 2 : un constat postérieur à l'envoi
    // est, lui, bloquant pour tous les fondements)
    const resolution = sortie(d, {
      fondement: 'execution_resolution_ag',
      fondementReference: 'AG du 12/09/2026, résolution 7',
      decisionLe: '2026-09-12',
      majoriteResolution: 'art25',
      delai: 'urgence',
      constatUrgence: le('2026-10-03'),
    })
    expect(controlerAvantEnvoiOs(d, resolution, pendant)).toEqual([])
    const sauvegarde = sortie(d, { fondement: 'urgence_sauvegarde', delai: 'urgence', constatUrgence: le('2026-10-03') })
    expect(codes(controlerAvantEnvoiOs(d, sauvegarde, CONTEXTE))).toEqual(['urgence_suites'])
  })

  it('urgence non retenue : le message ne cite l’avis (D. 1967 art. 62-7) ou la suspension (L. 1965 art. 42, al. 3) que lorsqu’ils s’appliquent', () => {
    const message = (d: Demande, saisie: SaisieSortieOs, code: string, contexte: ContexteEnvoiOs = CONTEXTE) =>
      controlerAvantEnvoiOs(d, sortie(d, saisie), contexte).find((a) => a.code === code)?.message ?? ''
    const d = demande()
    // urgence de sauvegarde, administration courante : ni avis ni suspension
    for (const fondement of ['urgence_sauvegarde', 'administration_courante'] as const) {
      const neutre = message(d, { fondement, delai: 'urgence' }, 'urgence_non_constatee')
      expect(neutre, fondement).toMatch(/sans lui, l'urgence n'est pas retenue\.$/)
      expect(neutre, fondement).not.toMatch(/conseil syndical|art\. 42/)
    }
    // pouvoirs de l'assemblée, intervention : l'avis
    const avis = message(d, cadreAj(null), 'urgence_non_constatee')
    expect(avis).toMatch(/l'avis préalable du conseil syndical reste exigé \(D\. 1967 art\. 62-7\)/)
    expect(avis).not.toMatch(/art\. 42/)
    // résolution votée à l'art. 25 : la suspension ; à l'art. 24 : rien
    const resolution: SaisieSortieOs = { fondement: 'execution_resolution_ag', fondementReference: 'résolution 7', delai: 'urgence', majoriteResolution: 'art25' }
    const suspension = message(d, resolution, 'urgence_non_constatee', { ...CONTEXTE, finDelaiContestationAg: '2026-10-01' })
    expect(suspension).toMatch(/majorité de l'art\. 25 reste suspendue pendant le délai de contestation \(L\. 1965 art\. 42, al\. 3\)/)
    expect(suspension).not.toMatch(/conseil syndical/)
    expect(message(d, { ...resolution, majoriteResolution: 'art24' }, 'urgence_non_constatee')).toMatch(/n'est pas retenue\.$/)
    // demande de devis au titre des pouvoirs de l'assemblée : aucun avis exigé
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    const contexteDevis: ContexteEnvoiOs = { date: '2026-10-03', prestataireAvecCompteVitfix: true }
    expect(message(devis, cadreAj(null), 'urgence_non_constatee', contexteDevis)).toMatch(/n'est pas retenue\.$/)
    // constat sans délai « urgence » : même règle
    const sansUrgence = message(d, { fondement: 'administration_courante', constatUrgence: CONSTAT }, 'constat_urgence_sans_urgence')
    expect(sansUrgence).toMatch(/l'urgence n'est pas retenue ; choisir le délai « urgence » ou effacer le constat\.$/)
    expect(sansUrgence).not.toMatch(/conseil syndical|art\. 42/)
    expect(message(d, cadreAj(CONSTAT, { delai: 'normale' }), 'constat_urgence_sans_urgence')).toMatch(/l'avis préalable du conseil syndical reste exigé/)
  })

  it('3. relance : sans date de relance (jamais fixée, ou vidée par relancerOs), l’OS reste dû tant qu’un élément manque : la prochaine relance est à fixer', () => {
    const accuse: Demande = { ...demande(), statut: 'Accusé demandé' }
    // envoi sans date de relance : élément daté du premier envoi, prochaine relance à fixer (tour 2 : relanceAFixer, et non
    // plus aConfirmer, réservé aux repères juridiques)
    const envoye = envoyerOs(accuse, sortie(accuse), ENVOI, CONTEXTE)
    expect(envoye.relanceLe).toBeNull()
    const [aFixer] = dues(accuse, envoye)
    expect(aFixer).toMatchObject({
      id: 'demandes:relance_os:dem-1',
      date: '2026-10-03',
      aConfirmer: false,
      relanceAFixer: true,
      attendus: ['reponse', 'accuse'],
      assigneId: 'col-gestion',
    })
    expect(aFixer.libelle).toMatch(/attendu : réponse à l'ordre de service, accusé de réception$/)
    // date fixée : l'élément est daté d'elle, il n'y a plus de relance à fixer
    const fixee = fixerRelance(envoye, '2026-10-10')
    expect(dues(accuse, fixee).map((r) => [r.date, r.relanceAFixer])).toEqual([['2026-10-10', false]])
    expect(dues(accuse, fixee)[0].libelle).not.toMatch(/Fixer/)
    // relance faite, éléments encore manquants : élément daté de la dernière relance, prochaine relance à fixer
    const relancee = relancerOs(fixee, { ...ENVOI, date: '2026-10-10', heure: '09:00' })
    expect(dues(accuse, relancee).map((r) => [r.date, r.relanceAFixer, r.attendus])).toEqual([['2026-10-10', true, ['reponse', 'accuse']]])
    const deuxFois = relancerOs(fixerRelance(relancee, '2026-10-17'), { ...ENVOI, date: '2026-10-17', heure: '09:00' })
    expect(dues(accuse, deuxFois).map((r) => [r.date, r.relanceAFixer])).toEqual([['2026-10-17', true]])
    // tout reçu : plus rien, avec ou sans date
    const recu = enregistrerReception(relancee, { ...ENVOI, date: '2026-10-11', heure: '09:00' })
    expect(dues({ ...accuse, statut: 'Accepté' }, recu)).toEqual([])
    expect(dues({ ...accuse, stade: 'Acceptée' }, recu)).toEqual([])
    expect(dues({ ...accuse, stade: 'Acceptée' }, relancee).map((r) => r.attendus)).toEqual([['accuse']])
    // jamais envoyé : rien
    expect(dues(accuse, sortie(accuse))).toEqual([])
  })

  it('3. relance : le rapport reçu vaut réponse à l’OS (l’entreprise qui le remet a répondu)', () => {
    const rapport: Demande = { ...demande(), statut: 'Rapport demandé' }
    const s = fixerRelance(envoyerOs(rapport, sortie(rapport), ENVOI, CONTEXTE), '2026-10-10')
    expect(attendusOs(rapport, s)).toEqual(['reponse', 'rapport'])
    const recu = enregistrerRapport(rapport, s, { recuLe: '2026-10-08', documentId: 'doc-1' })
    expect(attendusOs(rapport, recu)).toEqual([])
    expect(dues(rapport, recu)).toEqual([])
    // rapport reçu sans avoir été demandé : la réponse est reçue, l'accusé demandé reste attendu
    const accuse: Demande = { ...rapport, statut: 'Accusé demandé' }
    expect(attendusOs(accuse, recu)).toEqual(['accuse'])
  })

  it('visa de l’OS : messages selon l’état ; le refus renvoie à la demande (l’OS est la demande), comme les autres messages', () => {
    const d = demande()
    const contexte = { ...CONTEXTE, regles: SEUIL_100 }
    const manquant = (s: SortieOrdreService) => controlerAvantEnvoiOs(d, s, contexte).find((a) => a.code === 'visa_manquant')?.message
    const necessaire = sortie(d, {}, { regles: SEUIL_100 })
    expect(manquant(necessaire)).toBe("Visa nécessaire non demandé : demander le visa avant l'envoi.")
    const demandee = demanderVisa(necessaire, d, DEMANDE_GESTION)
    expect(manquant(demandee)).toBe('Visa demandé, en attente du viseur : envoi impossible.')
    const refuse = refuserVisa(demandee, d, evenement('col-direction', 'Direction', '10:00', 'Prix à renégocier'))
    expect(manquant(refuse)).toBe('Visa refusé : revoir la demande, puis demander de nouveau le visa. Motif du refus : Prix à renégocier')
  })
})

describe('retours de relecture des décisions de Hugo du 03/11/2026 (tour 2)', () => {
  const le = (constateLe: string): ConstatUrgence => ({ ...CONSTAT, constateLe })
  const resume = (liste: readonly { code: string; gravite: string }[]) => liste.map((a) => [a.code, a.gravite])
  const dues = (d: Demande, s: SortieOrdreService) => relancesOsDues([{ demande: d, sortie: s }])
  const pendant: ContexteEnvoiOs = { ...CONTEXTE, finDelaiContestationAg: '2026-11-20' }
  /** Exécution d'une résolution votée à l'art. 25, intervention le 15/10/2026 pendant le délai de contestation. */
  const resolution = (constatUrgence: ConstatUrgence | null): SaisieSortieOs => ({
    fondement: 'execution_resolution_ag',
    fondementReference: 'AG du 12/09/2026, résolution 7',
    decisionLe: '2026-09-12',
    majoriteResolution: 'art25',
    delai: 'urgence',
    constatUrgence,
  })
  /** Décision de l'administrateur provisoire au titre des pouvoirs de l'assemblée, au registre le 02/10/2026, sans avis. */
  const cadreAj = (constatUrgence: ConstatUrgence | null): SaisieSortieOs => ({
    fondement: 'decision_aj_pouvoirs_ag',
    fondementReference: 'registre n° 7',
    decisionLe: '2026-10-02',
    delai: 'urgence',
    constatUrgence,
    justificatifs: { modeFinancement: 'appel de fonds' },
  })

  it('constat d’urgence daté après l’envoi, exécution d’une résolution (L. 1965 art. 42, al. 3) : bloquant ; bornes : jour de l’envoi, lendemain', () => {
    const d = demande()
    expect(bloquants(controlerAvantEnvoiOs(d, sortie(d, resolution(null)), pendant))).toEqual(['execution_suspendue_art42'])
    // constat du jour de l'envoi : l'urgence est retenue, la suspension levée
    expect(controlerAvantEnvoiOs(d, sortie(d, resolution(le('2026-10-03'))), pendant)).toEqual([])
    // du lendemain : le jour de l'envoi, ce constat n'existe pas, la suspension n'est pas levée
    const lendemain = controlerAvantEnvoiOs(d, sortie(d, resolution(le('2026-10-04'))), pendant)
    expect(resume(lendemain)).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    expect(lendemain[0]).toMatchObject({ fondement: null, aConfirmer: false })
    expect(lendemain[0].message).toBe(
      "Urgence constatée le 04/10/2026, après l'envoi du 03/10/2026 : le jour de l'envoi, ce constat n'existe pas encore, l'urgence n'est pas retenue : l'exécution des travaux votés à la majorité de l'art. 25 reste suspendue pendant le délai de contestation (L. 1965 art. 42, al. 3) ; corriger la date du constat (au plus tard le jour de l'envoi) ou l'effacer.",
    )
    // constat près de trois mois après l'envoi (cas 1 du constat de relecture) : l'envoi est refusé, rien n'est journalisé
    expect(() => envoyerOs(d, sortie(d, resolution(le('2026-12-31'))), ENVOI, pendant)).toThrow(
      /non envoyé : Urgence constatée le 31\/12\/2026, après l'envoi du 03\/10\/2026/,
    )
  })

  it('constat d’urgence daté après l’envoi, décision de l’administrateur provisoire (D. 1967 art. 62-7) : bloquant, seul signalement, l’avis reste dû', () => {
    const d = demande()
    // cas 2 du constat de relecture : plus de « Sortie libre » qui part, ni de simple alerte « après la décision au registre »
    const futur = controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-12-31'))), CONTEXTE)
    expect(resume(futur)).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    expect(futur[0].message).toMatch(
      /^Urgence constatée le 31\/12\/2026, après l'envoi du 03\/10\/2026 : .*l'avis préalable du conseil syndical reste exigé \(D\. 1967 art\. 62-7\) ; corriger la date du constat/,
    )
    expect(() => envoyerOs(d, sortie(d, cadreAj(le('2026-12-31'))), ENVOI, CONTEXTE)).toThrow(/non envoyé/)
    // bornes, décision du 02/10/2026, envoi du 03/10/2026 : jour de la décision, rien ; jour de l'envoi, alerte à confirmer
    // (après la décision, question 🔴 ouverte) ; lendemain de l'envoi, bloquant
    expect(controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-02'))), CONTEXTE)).toEqual([])
    expect(resume(controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-03'))), CONTEXTE))).toEqual([['constat_urgence_posterieur', 'alerte']])
    expect(resume(controlerAvantEnvoiOs(d, sortie(d, cadreAj(le('2026-10-04'))), CONTEXTE))).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    // la date du constat corrigée avant l'envoi lève le bloquant
    const corrigee = modifierSortieOs(sortie(d, cadreAj(le('2026-12-31'))), d, { constatUrgence: le('2026-10-02') })
    expect(controlerAvantEnvoiOs(d, corrigee, CONTEXTE)).toEqual([])
  })

  it('constat d’urgence daté après l’envoi, autres fondements, demande de devis, constat sans délai « urgence » : même bloquant ; une date illisible reste un constat incomplet', () => {
    const d = demande()
    const sauvegarde = controlerAvantEnvoiOs(d, sortie(d, { fondement: 'urgence_sauvegarde', delai: 'urgence', constatUrgence: le('2026-10-04') }), CONTEXTE)
    expect(resume(sauvegarde)).toEqual([
      ['constat_urgence_posterieur_envoi', 'bloquant'],
      ['urgence_suites', 'alerte'],
    ])
    expect(sauvegarde[0].message).toMatch(/n'existe pas encore, l'urgence n'est pas retenue ; corriger la date du constat/)
    const courante = (constatUrgence: ConstatUrgence, delai: SaisieSortieOs['delai']) =>
      resume(controlerAvantEnvoiOs(d, sortie(d, { fondement: 'administration_courante', delai, constatUrgence }), CONTEXTE))
    expect(courante(le('2026-10-03'), 'urgence')).toEqual([])
    expect(courante(le('2026-10-04'), 'urgence')).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    expect(courante(le('2026-10-04'), 'normale')).toEqual([
      ['constat_urgence_posterieur_envoi', 'bloquant'],
      ['constat_urgence_sans_urgence', 'alerte'],
    ])
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    const contexteDevis: ContexteEnvoiOs = { date: '2026-10-03', prestataireAvecCompteVitfix: true }
    expect(controlerAvantEnvoiOs(devis, sortie(devis, cadreAj(le('2026-10-03'))), contexteDevis)).toEqual([])
    expect(resume(controlerAvantEnvoiOs(devis, sortie(devis, cadreAj(le('2026-10-04'))), contexteDevis))).toEqual([['constat_urgence_posterieur_envoi', 'bloquant']])
    // constat repris d'ailleurs, date illisible : constat incomplet (urgence_non_constatee), sans comparaison de dates
    const illisible: SortieOrdreService = { ...sortie(d, resolution(null)), constatUrgence: { ...CONSTAT, constateLe: '31/12/2026' } }
    const anomalies = controlerAvantEnvoiOs(d, illisible, pendant)
    expect(codes(anomalies)).toEqual(['urgence_non_constatee', 'execution_suspendue_art42'])
    expect(anomalies[0].message).toMatch(/manque : date/)
  })

  it('relance sans date : aConfirmer reste faux (repère juridique, contrat d’ElementAFaire) ; l’élément demande de FIXER la prochaine relance (relanceAFixer), pas de relancer', () => {
    const d: Demande = { ...demande(), statut: 'Accusé demandé' }
    const attendu = "ordre de service 12.3.456 (Recherche de fuite colonne) ; attendu : réponse à l'ordre de service, accusé de réception"
    // envoyé sans date de relance : dû le jour de l'envoi, pour fixer la relance
    const envoye = envoyerOs(d, sortie(d), ENVOI, CONTEXTE)
    const [aFixer] = dues(d, envoye)
    expect(aFixer).toMatchObject({ date: '2026-10-03', aConfirmer: false, relanceAFixer: true })
    expect(aFixer.libelle).toBe(`Fixer la prochaine relance de l'entreprise (fixerRelance) : ${attendu}`)
    // borne : relance fixée au jour même de l'envoi, « Relancer l'entreprise » dû ce jour-là
    const memeJour = dues(d, fixerRelance(envoye, '2026-10-03'))
    expect(memeJour.map((r) => [r.date, r.aConfirmer, r.relanceAFixer])).toEqual([['2026-10-03', false, false]])
    expect(memeJour[0].libelle).toBe(`Relancer l'entreprise : ${attendu}`)
    // le jour de la relance faite, plus de « Relancer l'entreprise » (pas de relance en double) : la suivante est à fixer
    const relancee = relancerOs(fixerRelance(envoye, '2026-10-10'), { ...ENVOI, date: '2026-10-10', heure: '09:00' })
    const apres = dues(d, relancee)
    expect(apres.map((r) => [r.date, r.aConfirmer, r.relanceAFixer])).toEqual([['2026-10-10', false, true]])
    expect(apres[0].libelle).toBe(`Fixer la prochaine relance de l'entreprise (fixerRelance) : ${attendu}`)
    // une relance due n'est jamais un repère juridique non confirmé, date fixée ou non
    expect([...dues(d, envoye), ...memeJour, ...apres].every((r) => !r.aConfirmer)).toBe(true)
  })
})

describe('décisions de Hugo du 03/11/2026 (suite : questions 7 à 9, J17 à J19)', () => {
  const pendant: ContexteEnvoiOs = { ...CONTEXTE, finDelaiContestationAg: '2026-11-20' }

  it('7 (J17). L. 1965 art. 42, al. 3, « oui » compris comme la confirmation des trois choix : envoi bloqué pendant le délai, intervention = travaux, unanimité non suspendue (comportement inchangé)', () => {
    const d = demande()
    const resolution = (majoriteResolution: SaisieSortieOs['majoriteResolution'], cible: Demande = d) =>
      sortie(cible, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution })
    // (a) bloquant : l'envoi est refusé tant que l'intervention tombe dans le délai de contestation
    for (const majorite of ['art25', 'art26'] as const) {
      const [suspendu] = controlerAvantEnvoiOs(d, resolution(majorite), pendant)
      expect(suspendu, majorite).toMatchObject({ code: 'execution_suspendue_art42', gravite: 'bloquant', fondement: 'L. 1965 art. 42, al. 3', aConfirmer: true })
      expect(() => envoyerOs(d, resolution(majorite), ENVOI, pendant), majorite).toThrow(/non envoyé : Travaux votés à la majorité/)
    }
    // bornes : intervention le dernier jour du délai, bloquant ; le lendemain, rien
    expect(bloquants(controlerAvantEnvoiOs(demande({ prevuLe: '2026-11-20' }), resolution('art25'), pendant))).toEqual(['execution_suspendue_art42'])
    expect(controlerAvantEnvoiOs(demande({ prevuLe: '2026-11-21' }), resolution('art25'), pendant)).toEqual([])
    // (b) toute intervention qui exécute la résolution vaut « travaux », quel que soit son objet ; une demande de devis n'exécute rien
    const diagnostic = demande({ objet: 'Diagnostic amiante avant travaux' })
    expect(bloquants(controlerAvantEnvoiOs(diagnostic, resolution('art25', diagnostic), pendant))).toEqual(['execution_suspendue_art42'])
    const devis = demande({ numero: '12.3.9' }, DEVIS)
    expect(controlerAvantEnvoiOs(devis, resolution('art25', devis), { date: '2026-10-03', prestataireAvecCompteVitfix: true, finDelaiContestationAg: '2026-11-20' })).toEqual([])
    // (c) unanimité (et art. 24) : pas de suspension
    expect(controlerAvantEnvoiOs(d, resolution('unanimite'), pendant)).toEqual([])
    expect(controlerAvantEnvoiOs(d, resolution('art24'), pendant)).toEqual([])
  })

  it('8 (J18). signataire : un collaborateur habilité par le cabinet signe l’OS, pas seulement l’administrateur désigné ; la liste est un réglage du cabinet, fournie par l’appelant', () => {
    const d = demande()
    /** Réglage du cabinet : l'administrateur désigné et un collaborateur. */
    const habilites = new Set(['col-aj', 'col-gestion'])
    const contexte: ContexteEnvoiOs = { ...CONTEXTE, signatairesHabilites: habilites }
    const parCollaborateur = sortie(d, { signataireId: 'col-gestion' })
    expect(controlerAvantEnvoiOs(d, parCollaborateur, contexte)).toEqual([])
    expect(envoyerOs(d, parCollaborateur, ENVOI, contexte).journal).toHaveLength(1)
    // hors de la liste du cabinet : bloquant, règle de gestion (décision prise : ni texte cité, ni « à confirmer »)
    const horsListe = sortie(d, { signataireId: 'col-stagiaire' })
    const [hors] = controlerAvantEnvoiOs(d, horsListe, contexte)
    expect(hors).toMatchObject({ code: 'signataire_non_habilite', gravite: 'bloquant', fondement: null, aConfirmer: false })
    expect(hors.message).toBe(
      "Signataire col-stagiaire hors des collaborateurs habilités par le cabinet à signer un OS (réglage du cabinet) : choisir un collaborateur habilité, ou l'ajouter à la liste du cabinet.",
    )
    expect(() => envoyerOs(d, horsListe, ENVOI, contexte)).toThrow(/non envoyé : Signataire col-stagiaire hors des collaborateurs habilités par le cabinet/)
    // liste non fournie par l'appelant : non contrôlé ; signataire absent : toujours bloquant
    expect(controlerAvantEnvoiOs(d, horsListe, CONTEXTE)).toEqual([])
    expect(bloquants(controlerAvantEnvoiOs(d, sortie(d, { signataireId: '  ' }), contexte))).toEqual(['signataire_absent'])
  })

  it('8 (J18), interprétation à confirmer : l’auteur du constat d’urgence hors des signataires habilités → alerte à confirmer, sans blocage ni effet sur l’urgence', () => {
    const d = demande()
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      delai: 'urgence',
      justificatifs: { modeFinancement: 'appel de fonds' },
    }
    const contexte: ContexteEnvoiOs = { ...CONTEXTE, signatairesHabilites: new Set(['col-direction']) }
    const parStagiaire = sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, collaborateurId: 'col-stagiaire' } })
    const anomalies = controlerAvantEnvoiOs(d, parStagiaire, contexte)
    expect(anomalies.map((a) => [a.code, a.gravite, a.aConfirmer])).toEqual([['constat_urgence_auteur_non_habilite', 'alerte', true]])
    expect(anomalies[0]).toMatchObject({ fondement: null })
    expect(anomalies[0].message).toBe(
      "Urgence constatée par col-stagiaire, hors des collaborateurs habilités par le cabinet à signer un OS : à confirmer (interprétation des décisions 6 et 8) : l'auteur du constat, qui agit au nom de l'administrateur provisoire comme le signataire, doit-il être un signataire habilité ? Ce signalement ne change pas l'urgence retenue.",
    )
    // l'urgence reste retenue : l'avis du conseil syndical n'est pas exigé, l'envoi part
    expect(parStagiaire.visa).toBe('Sortie libre')
    expect(envoyerOs(d, parStagiaire, ENVOI, contexte).journal).toHaveLength(1)
    // auteur habilité, liste non fournie, ou aucun constat : rien
    expect(controlerAvantEnvoiOs(d, sortie(d, { ...cadre, constatUrgence: CONSTAT }), contexte)).toEqual([])
    expect(controlerAvantEnvoiOs(d, parStagiaire, CONTEXTE)).toEqual([])
    expect(controlerAvantEnvoiOs(d, sortie(d), contexte)).toEqual([])
  })

  it('9 (J19). l’AR fait preuve de la réception de l’OS : la réception porte son AR (référence, date de première présentation si elle est connue, comme J1)', () => {
    const d = demande({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } })
    const envoiAr: SaisieDiffusion = { ...ENVOI, canal: 'courrier_ar', missionId: null, courrierId: 'courrier-1' }
    const envoye = envoyerOs(d, sortie(d, { canal: 'courrier_ar' }), envoiAr, CONTEXTE)
    const reception: SaisieDiffusion = { ...envoiAr, date: '2026-10-06', heure: '09:00' }
    const avecAr = (premierePresentationLe?: string | null) => enregistrerReception(envoye, { ...reception, ar: { reference: 'AR-7', premierePresentationLe } })
    const prouvee = enregistrerReception(envoye, { ...reception, ar: { reference: ' 1A 234 567 8901 2 ', premierePresentationLe: '2026-10-05' } })
    const ligne = prouvee.journal[1]
    expect(ligne).toMatchObject({ nature: 'reception', date: '2026-10-06', ar: { reference: '1A 234 567 8901 2', premierePresentationLe: '2026-10-05' } })
    expect(preuveDeReception(ligne)).toBe('ar')
    const courrierLie: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: '2026-10-06' }
    expect(preuveDeDiffusion(prouvee, ligne, courrierLie)).toBe('ar')
    // courrier AR : le courrier lié reste attendu par preuveDeDiffusion, comme pour l'envoi
    expect(() => preuveDeDiffusion(prouvee, ligne)).toThrow(/courrier lié est attendu/)
    expect(envoye.journal).toHaveLength(1)
    // première présentation inconnue : l'AR fait preuve quand même
    expect(avecAr().journal[1].ar).toEqual({ reference: 'AR-7', premierePresentationLe: null })
    expect(preuveDeReception(avecAr(null).journal[1])).toBe('ar')
    // bornes : le jour de l'envoi du pli (ici le premier envoi) et le jour de la réception, admises ; la veille de l'envoi, le lendemain de la réception, refusées
    expect(avecAr('2026-10-03').journal[1].ar?.premierePresentationLe).toBe('2026-10-03')
    expect(avecAr('2026-10-06').journal[1].ar?.premierePresentationLe).toBe('2026-10-06')
    expect(() => avecAr('2026-10-02')).toThrow("Première présentation de l'AR (02/10/2026) antérieure à l'envoi de l'OS par le courrier courrier-1 (03/10/2026).")
    expect(() => avecAr('2026-10-07')).toThrow(/après la réception/)
    expect(() => avecAr('05/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => enregistrerReception(envoye, { ...reception, ar: { reference: '  ' } })).toThrow(/référence/)
    // l'envoi ne porte pas d'AR ; la relance non plus
    expect(envoye.journal[0].ar).toBeNull()
    expect(relancerOs(envoye, { ...envoiAr, date: '2026-10-05' }).journal[1].ar).toBeNull()
    // aucune caducité codée ; la réception reste datée de sa ligne (la première présentation ne la remplace pas : question ouverte)
    expect(codes(devisCaducALaReception(d, prouvee, '2026-10-05'))).toEqual(['devis_caduc'])
  })

  it('9 (J19). réception sans AR : admise (accusé reçu, sans blocage), marquée « sans preuve »', () => {
    const accuse: Demande = { ...demande(), statut: 'Accusé demandé', stade: 'Acceptée' }
    const envoye = envoyerOs(accuse, sortie(accuse), ENVOI, CONTEXTE)
    const recue = enregistrerReception(envoye, { ...ENVOI, heure: '14:00' })
    const ligne = recue.journal[1]
    expect(ligne.ar).toBeNull()
    expect(preuveDeReception(ligne)).toBe('sans_preuve')
    expect(preuveDeDiffusion(recue, ligne)).toBe('sans_preuve')
    expect(estRecu(recue)).toBe(true)
    expect(attendusOs(accuse, recue)).toEqual([])
    expect(relancesOsDues([{ demande: accuse, sortie: recue }])).toEqual([])
    expect(preuveDeReception(enregistrerReception(envoye, { ...ENVOI, heure: '14:00', ar: null }).journal[1])).toBe('sans_preuve')
    // seule une réception a une preuve de réception ; la preuve de l'envoi ne change pas
    expect(() => preuveDeReception(envoye.journal[0])).toThrow(/réception/)
    expect(preuveDeDiffusion(envoye, envoye.journal[0])).toBe('trace_interne')
  })
})

describe('retours de relecture des décisions 7 à 9 (J17 à J19)', () => {
  const d = demande({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } })
  const envoiAr: SaisieDiffusion = { ...ENVOI, canal: 'courrier_ar', missionId: null, courrierId: 'courrier-1' }
  const envoyeAr = envoyerOs(d, sortie(d, { canal: 'courrier_ar' }), envoiAr, CONTEXTE)
  const receptionAr: SaisieDiffusion = { ...envoiAr, date: '2026-10-06', heure: '09:00' }
  /** Courrier AR lié (courriers.ts) : déposé le 03/10, présenté le 05/10, avis de réception signé le 06/10. */
  const COURRIER_AR: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: '2026-10-06' }

  it('9 (J19), non-régression : une réception par courrier AR sans AR saisi garde l’état de notification du courrier lié (preuveDeDiffusion, comme avant la décision 9)', () => {
    const recue = enregistrerReception(envoyeAr, receptionAr)
    const ligne = recue.journal[1]
    expect(ligne.ar).toBeNull()
    expect(preuveDeDiffusion(recue, ligne, COURRIER_AR)).toBe('notifie')
    expect(preuveDeDiffusion(recue, ligne, { ...COURRIER_AR, datePremierePresentation: null, dateAccuseReception: null })).toBe('envoye_non_notifie')
    expect(() => preuveDeDiffusion(recue, ligne)).toThrow(/courrier lié est attendu/)
    expect(() => preuveDeDiffusion(recue, ligne, { ...COURRIER_AR, formeEnvoi: 'Normal' })).toThrow(/un courrier en AR est attendu/)
    // la ligne seule ne porte pas d'AR
    expect(preuveDeReception(ligne)).toBe('sans_preuve')
  })

  it('9 (J19) : l’AR saisi est rapproché du courrier lié : première présentation tirée du courrier quand elle n’est pas saisie, différente refusée (saisie et preuve)', () => {
    const tiree = enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-7' } }, COURRIER_AR)
    expect(tiree.journal[1].ar).toEqual({ reference: 'AR-7', premierePresentationLe: '2026-10-05' })
    expect(preuveDeDiffusion(tiree, tiree.journal[1], COURRIER_AR)).toBe('ar')
    const egale = enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-7', premierePresentationLe: '2026-10-05' } }, COURRIER_AR)
    expect(egale.journal[1].ar?.premierePresentationLe).toBe('2026-10-05')
    // courrier sans première présentation connue : la date saisie est gardée, aucune comparaison
    const inconnue = { ...COURRIER_AR, datePremierePresentation: null }
    expect(enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-7', premierePresentationLe: '2026-10-04' } }, inconnue).journal[1].ar?.premierePresentationLe).toBe('2026-10-04')
    // différente : refusée à la saisie
    const divergente = { ...receptionAr, ar: { reference: 'AR-7', premierePresentationLe: '2026-10-04' } }
    expect(() => enregistrerReception(envoyeAr, divergente, COURRIER_AR)).toThrow(
      "AR de la réception refusé : première présentation de l'AR (04/10/2026) différente de celle du courrier lié (05/10/2026) ; corriger l'AR saisi ou le suivi du courrier (courriers.ts).",
    )
    // saisie sans le courrier, lue avec lui : la preuve signale l'écart, sans lever (tour 2, constat 2)
    const sansCourrier = enregistrerReception(envoyeAr, divergente)
    expect(preuveDeDiffusion(sansCourrier, sansCourrier.journal[1], COURRIER_AR)).toBe('ar_ecart_courrier')
    // le courrier lié doit être en AR, et ne vaut que pour une réception par courrier AR
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-7' } }, { ...COURRIER_AR, formeEnvoi: 'Normal' })).toThrow(/un courrier en AR est attendu/)
    const parMessagerie: SaisieDiffusion = { ...ENVOI, date: '2026-10-06', heure: '09:00' }
    expect(() => enregistrerReception(envoyeAr, parMessagerie, COURRIER_AR)).toThrow(
      'Courrier lié : réservé à une réception par courrier AR (ici « messagerie_vitfix »).',
    )
    // la première présentation tirée du courrier respecte les mêmes bornes (pas après la réception)
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, date: '2026-10-04', ar: { reference: 'AR-7' } }, COURRIER_AR)).toThrow(/après la réception/)
  })

  it('9 (J19) : l’AR et la première présentation sont réservés à la réception par courrier AR (avis de réception du pli recommandé) ; par un autre canal, réception admise « sans preuve »', () => {
    const dm = demande()
    const envoye = envoyerOs(dm, sortie(dm), ENVOI, CONTEXTE)
    const ar = { reference: 'x', premierePresentationLe: '2026-10-03' }
    for (const canal of ['messagerie_vitfix', 'courriel', 'courrier', 'sms'] as const) {
      const saisie: SaisieDiffusion = { ...ENVOI, canal, heure: '11:00' }
      expect(() => enregistrerReception(envoye, { ...saisie, ar }), canal).toThrow(
        `AR saisi sur une réception par « ${canal} » : l'AR est l'avis de réception du courrier AR ; par ce canal, la réception est admise sans AR (« sans preuve »).`,
      )
      expect(() => enregistrerReception(envoye, { ...saisie, ar: { reference: 'x' } }), canal).toThrow(/l'AR est l'avis de réception du courrier AR/)
      expect(preuveDeReception(enregistrerReception(envoye, saisie).journal[1]), canal).toBe('sans_preuve')
    }
  })

  it('9 (J19) : un AR reçu après une réception déjà enregistrée s’inscrit sur une nouvelle ligne « reception » ; preuveReceptionOs donne la preuve de l’OS, la réception reste datée de la première ligne', () => {
    expect(preuveReceptionOs(envoyeAr)).toBeNull()
    // l'entreprise confirme par la messagerie le 06/10 : réception sans AR
    const confirmee = enregistrerReception(envoyeAr, { ...ENVOI, date: '2026-10-06', heure: '09:00' })
    expect(preuveReceptionOs(confirmee)).toBe('sans_preuve')
    // l'avis de réception revient le 09/10 : nouvelle ligne, par courrier AR, avec l'AR
    const prouvee = enregistrerReception(confirmee, { ...receptionAr, date: '2026-10-09', ar: { reference: 'AR-7' } }, COURRIER_AR)
    expect(prouvee.journal.map((e) => e.nature)).toEqual(['envoi', 'reception', 'reception'])
    expect(prouvee.journal.slice(1).map((e) => preuveDeReception(e))).toEqual(['sans_preuve', 'ar'])
    expect(preuveReceptionOs(prouvee)).toBe('ar')
    // la réception reste datée de la première ligne (06/10) : caducité et accusé reçu
    expect(estRecu(confirmee)).toBe(true)
    expect(codes(devisCaducALaReception(d, prouvee, '2026-10-05'))).toEqual(['devis_caduc'])
    expect(devisCaducALaReception(d, prouvee, '2026-10-06')).toEqual([])
  })

  it('9 (J19) : une ligne de réception écrite sans la clé « ar » (avant la décision 9) est lue sans AR, jamais comme prouvée', () => {
    const ancienne: EvenementDiffusion = { ...enregistrerReception(envoyeAr, { ...ENVOI, date: '2026-10-06', heure: '09:00' }).journal[1] }
    delete ancienne.ar
    expect('ar' in ancienne).toBe(false)
    expect(preuveDeReception(ancienne)).toBe('sans_preuve')
    const avecAncienne = { ...envoyeAr, journal: [envoyeAr.journal[0], ancienne] }
    expect(preuveDeDiffusion(avecAncienne, ancienne)).toBe('sans_preuve')
    expect(preuveReceptionOs(avecAncienne)).toBe('sans_preuve')
    const ancienneAr: EvenementDiffusion = { ...enregistrerReception(envoyeAr, receptionAr).journal[1] }
    delete ancienneAr.ar
    expect(preuveDeDiffusion({ ...envoyeAr, journal: [envoyeAr.journal[0], ancienneAr] }, ancienneAr, COURRIER_AR)).toBe('notifie')
  })

  it('8 (J18) : l’administrateur désigné (administrateurDesigneId) signe toujours, même hors de la liste du cabinet ; liste vide : lui seul ; sans lui, tout envoi est bloqué', () => {
    const vide: ContexteEnvoiOs = { ...CONTEXTE, signatairesHabilites: new Set<string>() }
    const parAj = sortie(d, { signataireId: 'col-aj' })
    // liste vide sans administrateur désigné : tout signataire est bloqué
    expect(bloquants(controlerAvantEnvoiOs(d, parAj, vide))).toEqual(['signataire_non_habilite'])
    expect(() => envoyerOs(d, parAj, ENVOI, vide)).toThrow(/non envoyé : Signataire col-aj hors des collaborateurs habilités/)
    // liste vide avec l'administrateur désigné : lui seul signe
    const avecAj: ContexteEnvoiOs = { ...vide, administrateurDesigneId: 'col-aj' }
    expect(controlerAvantEnvoiOs(d, parAj, avecAj)).toEqual([])
    expect(envoyerOs(d, parAj, ENVOI, avecAj).journal).toHaveLength(1)
    expect(bloquants(controlerAvantEnvoiOs(d, sortie(d, { signataireId: 'col-gestion' }), avecAj))).toEqual(['signataire_non_habilite'])
    // liste du cabinet qui ne le contient pas : il signe quand même ; le collaborateur de la liste aussi
    const sansLui: ContexteEnvoiOs = { ...CONTEXTE, signatairesHabilites: new Set(['col-gestion']), administrateurDesigneId: ' col-aj ' }
    expect(controlerAvantEnvoiOs(d, parAj, sansLui)).toEqual([])
    expect(controlerAvantEnvoiOs(d, sortie(d, { signataireId: 'col-gestion' }), sansLui)).toEqual([])
    // il constate aussi l'urgence sans alerte (décision 6 : « nous constatons l'urgence »)
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      delai: 'urgence',
      justificatifs: { modeFinancement: 'appel de fonds' },
      signataireId: 'col-gestion',
    }
    expect(controlerAvantEnvoiOs(d, sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, collaborateurId: 'col-aj' } }), sansLui)).toEqual([])
    expect(codes(controlerAvantEnvoiOs(d, sortie(d, { ...cadre, constatUrgence: { ...CONSTAT, collaborateurId: 'col-stagiaire' } }), sansLui))).toEqual([
      'constat_urgence_auteur_non_habilite',
    ])
  })

  it('7 (J17), (a) : un envoi pendant le délai de contestation pour une intervention prévue après le délai part sans anomalie (comportement décrit dans l’en-tête)', () => {
    const pendant: ContexteEnvoiOs = { ...CONTEXTE, finDelaiContestationAg: '2026-11-20' }
    const apres = demande({ prevuLe: '2026-11-25' })
    const resolution = sortie(apres, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution: 'art25' })
    expect(controlerAvantEnvoiOs(apres, resolution, pendant)).toEqual([])
    expect(envoyerOs(apres, resolution, ENVOI, pendant).journal[0].date).toBe('2026-10-03')
    // sans date d'intervention prévue, l'envoi pendant le délai est bloqué
    const sansDate = demande({ prevuLe: null })
    expect(bloquants(controlerAvantEnvoiOs(sansDate, sortie(sansDate, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution: 'art25' }), pendant))).toEqual([
      'execution_suspendue_art42',
    ])
  })
})

describe('retours de relecture des décisions 7 à 9 (J17 à J19, tour 2)', () => {
  const d = demande({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 } })
  const envoiAr: SaisieDiffusion = { ...ENVOI, canal: 'courrier_ar', missionId: null, courrierId: 'courrier-1' }
  const envoyeAr = envoyerOs(d, sortie(d, { canal: 'courrier_ar' }), envoiAr, CONTEXTE)
  const receptionAr: SaisieDiffusion = { ...envoiAr, date: '2026-10-06', heure: '09:00' }
  /** Courrier AR lié (courriers.ts) : déposé le 03/10, présenté le 05/10, avis de réception signé le 06/10. */
  const COURRIER_AR: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: '2026-10-06' }
  const NON_DEPOSE: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: null, datePremierePresentation: null, dateAccuseReception: null }

  it('9 (J19), constat 1 : l’AR ne prouve la réception de l’OS que s’il est celui du courrier AR qui a porté l’OS à l’entreprise (envoi ou rediffusion, même courrier)', () => {
    const autrePli = /n'a pas porté l'OS à l'entreprise/
    // (1) OS envoyé par la seule messagerie VitFix : aucun pli en courrier AR dans le journal
    const dm = demande()
    const parMessagerie = envoyerOs(dm, sortie(dm), ENVOI, CONTEXTE)
    const sansRapport: SaisieReception = {
      ...ENVOI,
      canal: 'courrier_ar',
      courrierId: 'courrier-sans-rapport',
      missionId: null,
      heure: '12:00',
      ar: { reference: 'AR-X', premierePresentationLe: '2026-10-03' },
    }
    expect(() => enregistrerReception(parMessagerie, sansRapport)).toThrow(
      "AR du courrier courrier-sans-rapport refusé : ce courrier n'a pas porté l'OS à l'entreprise (ni envoi ni rediffusion de l'OS par courrier AR à ent-1 sous ce courrier) ; l'AR d'un autre pli ne prouve pas la réception de l'OS.",
    )
    expect(() => enregistrerReception(parMessagerie, sansRapport, { ...COURRIER_AR, datePremierePresentation: '2026-10-03' })).toThrow(autrePli)
    // (2) OS porté par « courrier-1 », réception sur « courrier-2 »
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, courrierId: 'courrier-2', ar: { reference: 'AR-2' } })).toThrow(autrePli)
    // rediffusion de l'OS à l'entreprise par courrier AR « courrier-2 » le 08/10 : son AR prouve, présenté au plus tôt ce jour-là
    const rediffuse = envoyerOs(d, envoyeAr, { ...envoiAr, courrierId: 'courrier-2', date: '2026-10-08' }, CONTEXTE)
    const recu = (premierePresentationLe: string) =>
      enregistrerReception(rediffuse, { ...receptionAr, courrierId: 'courrier-2', date: '2026-10-10', ar: { reference: 'AR-2', premierePresentationLe } })
    expect(preuveReceptionOs(recu('2026-10-08'))).toBe('ar')
    expect(() => recu('2026-10-07')).toThrow("Première présentation de l'AR (07/10/2026) antérieure à l'envoi de l'OS par le courrier courrier-2 (08/10/2026).")
    // rediffusion par courrier AR à une autre fiche, ou relance par courrier AR : leur AR ne prouve pas la réception de l'OS par l'entreprise
    const aLaCopropriete = envoyerOs(d, envoyeAr, { ...envoiAr, courrierId: 'courrier-3', destinataire: creerRattachement('Copropriété', 'copro-1') }, CONTEXTE)
    expect(() => enregistrerReception(aLaCopropriete, { ...receptionAr, courrierId: 'courrier-3', ar: { reference: 'AR-3' } })).toThrow(autrePli)
    const relance = relancerOs(envoyeAr, { ...envoiAr, courrierId: 'courrier-4', date: '2026-10-05' })
    expect(() => enregistrerReception(relance, { ...receptionAr, courrierId: 'courrier-4', ar: { reference: 'AR-4' } })).toThrow(autrePli)
    // le pli qui a porté l'OS : accepté (non-régression)
    expect(preuveReceptionOs(enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-1' } }))).toBe('ar')
  })

  it('9 (J19), constat 1 : à la saisie, le courrier lié fourni est déposé, et l’AR n’est présenté ni avant le dépôt ni après le retrait du pli (comme courriers.ts)', () => {
    // (3) courrier lié jamais déposé
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-3', premierePresentationLe: '2026-10-04' } }, NON_DEPOSE)).toThrow(
      "AR de la réception refusé : courrier lié jamais déposé : l'AR n'est pas celui d'un pli parti ; corriger l'AR saisi ou le suivi du courrier (courriers.ts).",
    )
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-3' } }, NON_DEPOSE)).toThrow(/jamais déposé/)
    // (4) courrier déposé le 05/10, AR saisi présenté le 04/10
    const depotTardif: CourrierSuivi = { ...NON_DEPOSE, dateDepot: '2026-10-05' }
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-4', premierePresentationLe: '2026-10-04' } }, depotTardif)).toThrow(
      "AR de la réception refusé : première présentation de l'AR (04/10/2026) antérieure au dépôt du courrier lié (05/10/2026) ; corriger l'AR saisi ou le suivi du courrier (courriers.ts).",
    )
    expect(enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-4', premierePresentationLe: '2026-10-05' } }, depotTardif).journal[1].ar?.premierePresentationLe).toBe(
      '2026-10-05',
    )
    // courrier écrit avant J1 : retrait connu, présentation absente ; l'AR présenté après le retrait est refusé
    const avantJ1: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', dateAccuseReception: '2026-10-04' }
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-4', premierePresentationLe: '2026-10-05' } }, avantJ1)).toThrow(
      /postérieure au retrait du pli \(04\/10\/2026\)/,
    )
    // sans AR, la réception par courrier AR reste admise comme avant la décision 9 ; sa preuve est l'état du courrier lié
    const sansAr = enregistrerReception(envoyeAr, receptionAr, NON_DEPOSE)
    expect(preuveDeDiffusion(sansAr, sansAr.journal[1], NON_DEPOSE)).toBe('non_envoye')
  })

  it('9 (J19), constat 2 : un écart entre l’AR et le courrier lié apparu après la saisie est signalé à la lecture (« ar_ecart_courrier »), jamais levé : la ligne ne se réécrit pas', () => {
    // saisie : courrier lié sans première présentation connue, AR présenté le 04/10
    const sansDate: CourrierSuivi = { ...COURRIER_AR, datePremierePresentation: null, dateAccuseReception: null }
    const saisie = enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-5', premierePresentationLe: '2026-10-04' } }, sansDate)
    const ligne = saisie.journal[1]
    expect(preuveDeDiffusion(saisie, ligne, sansDate)).toBe('ar')
    expect(ecartArCourrier(ligne, sansDate)).toBeNull()
    // le suivi postal fixe ensuite la présentation au 05/10 (courriers.ts) : l'écart est signalé, rien n'est levé
    expect(preuveDeDiffusion(saisie, ligne, COURRIER_AR)).toBe('ar_ecart_courrier')
    expect(ecartArCourrier(ligne, COURRIER_AR)).toBe(
      "AR de la réception du 06/10/2026 en écart avec le courrier lié : première présentation de l'AR (04/10/2026) différente de celle du courrier lié (05/10/2026) ; la ligne du journal ne se réécrit pas : enregistrer une nouvelle réception avec l'AR exact, ou corriger le suivi du courrier (courriers.ts).",
    )
    // nouvelle réception avec l'AR exact : sa ligne vaut « ar », l'ancienne reste signalée ; lire tout le journal ne lève pas
    const corrigee = enregistrerReception(saisie, { ...receptionAr, date: '2026-10-07', ar: { reference: 'AR-5' } }, COURRIER_AR)
    expect(corrigee.journal.map((l) => preuveDeDiffusion(corrigee, l, COURRIER_AR))).toEqual(['notifie', 'ar_ecart_courrier', 'ar'])
    expect(preuveReceptionOs(corrigee)).toBe('ar')
    // autres écarts lus : courrier jamais déposé, présentation avant le dépôt, après le retrait du pli (courrier écrit avant J1)
    const avecSeule = enregistrerReception(envoyeAr, { ...receptionAr, ar: { reference: 'AR-6', premierePresentationLe: '2026-10-04' } })
    const seule = avecSeule.journal[1]
    expect(preuveDeDiffusion(avecSeule, seule, NON_DEPOSE)).toBe('ar_ecart_courrier')
    expect(ecartArCourrier(seule, NON_DEPOSE)).toMatch(/: courrier lié jamais déposé : l'AR n'est pas celui d'un pli parti ;/)
    expect(ecartArCourrier(seule, { ...NON_DEPOSE, dateDepot: '2026-10-05' })).toMatch(/antérieure au dépôt du courrier lié \(05\/10\/2026\)/)
    expect(ecartArCourrier(seule, { formeEnvoi: 'AR', dateDepot: '2026-10-03', dateAccuseReception: '2026-10-03' })).toMatch(/postérieure au retrait du pli \(03\/10\/2026\)/)
    // sans AR : aucun écart (preuve : état de notification du courrier, comme avant la décision 9) ; un courrier hors AR reste refusé
    expect(ecartArCourrier(enregistrerReception(envoyeAr, receptionAr).journal[1], COURRIER_AR)).toBeNull()
    expect(() => preuveDeDiffusion(saisie, ligne, { ...COURRIER_AR, formeEnvoi: 'Normal' })).toThrow(/un courrier en AR est attendu/)
  })
})

describe('contrôle final des décisions 7 à 9 (J19) : toute réception par courrier AR, AR saisi ou non, est celle du pli qui a porté l’OS', () => {
  const d = demande()
  const envoiAr: SaisieDiffusion = { ...ENVOI, canal: 'courrier_ar', missionId: null, courrierId: 'courrier-1' }
  const envoyeAr = envoyerOs(d, sortie(d, { canal: 'courrier_ar' }), envoiAr, CONTEXTE)
  /** Réception par courrier AR, sans AR saisi. */
  const receptionAr: SaisieReception = { ...envoiAr, date: '2026-10-06', heure: '09:00' }
  /** Courrier AR lié (courriers.ts) : déposé le 03/10, présenté le 05/10, retiré le 06/10. */
  const COURRIER_AR: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: '2026-10-06' }
  const refus = (courrierId: string) =>
    `Réception par le courrier ${courrierId} refusée : ce courrier n'a pas porté l'OS à l'entreprise (ni envoi ni rediffusion de l'OS par courrier AR à ent-1 sous ce courrier) ; la réception d'un autre pli n'est pas celle de l'OS.`
  const relancee = relancerOs(envoyeAr, { ...envoiAr, courrierId: 'courrier-4', date: '2026-10-05' })

  it('cas nominal : sans AR saisi, sur le courrier AR qui a porté l’OS (envoi, ou rediffusion à l’entreprise), la réception est admise ; sa preuve est l’état de notification de ce courrier', () => {
    const recue = enregistrerReception(envoyeAr, receptionAr, COURRIER_AR)
    const ligne = recue.journal[1]
    expect(ligne).toMatchObject({ nature: 'reception', canal: 'courrier_ar', courrierId: 'courrier-1', ar: null })
    expect(preuveDeDiffusion(recue, ligne, COURRIER_AR)).toBe('notifie')
    expect(preuveDeReception(ligne)).toBe('sans_preuve')
    expect(preuveReceptionOs(recue)).toBe('sans_preuve')
    // après une relance par un autre courrier, la réception sous le courrier de l'envoi reste admise
    const apresRelance = enregistrerReception(relancee, receptionAr)
    expect(preuveDeDiffusion(apresRelance, apresRelance.journal[2], COURRIER_AR)).toBe('notifie')
    // rediffusion de l'OS à l'entreprise par « courrier-2 » : la réception sous ce courrier est admise
    const rediffuse = envoyerOs(d, envoyeAr, { ...envoiAr, courrierId: 'courrier-2', date: '2026-10-04' }, CONTEXTE)
    const parRediffusion = enregistrerReception(rediffuse, { ...receptionAr, courrierId: 'courrier-2' })
    expect(parRediffusion.journal[2]).toMatchObject({ nature: 'reception', courrierId: 'courrier-2', ar: null })
    expect(preuveDeDiffusion(parRediffusion, parRediffusion.journal[2], { ...COURRIER_AR, datePremierePresentation: null, dateAccuseReception: null })).toBe(
      'envoye_non_notifie',
    )
  })

  it('scénario 1 : OS parti par la seule messagerie VitFix ; une réception par courrier AR sans AR saisi est refusée, motif à l’appui', () => {
    const parMessagerie = envoyerOs(d, sortie(d), ENVOI, CONTEXTE)
    const sansRapport: SaisieReception = { ...ENVOI, canal: 'courrier_ar', courrierId: 'courrier-sans-rapport', missionId: null, heure: '12:00' }
    expect(() => enregistrerReception(parMessagerie, sansRapport, COURRIER_AR)).toThrow(refus('courrier-sans-rapport'))
    expect(() => enregistrerReception(parMessagerie, { ...sansRapport, ar: null })).toThrow(refus('courrier-sans-rapport'))
  })

  it('scénario 2 : OS parti par « courrier-1 », réception sans AR saisi sous « courrier-2 » : refusée', () => {
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, courrierId: 'courrier-2' }, COURRIER_AR)).toThrow(refus('courrier-2'))
    expect(() => enregistrerReception(envoyeAr, { ...receptionAr, courrierId: 'courrier-2' })).toThrow(refus('courrier-2'))
  })

  it('scénario 3 : courrier d’une relance (« courrier-4 »), ou d’une rediffusion à une autre fiche : refusée sans AR saisi', () => {
    expect(() => enregistrerReception(relancee, { ...receptionAr, courrierId: 'courrier-4' }, COURRIER_AR)).toThrow(refus('courrier-4'))
    const aLaCopropriete = envoyerOs(d, envoyeAr, { ...envoiAr, courrierId: 'courrier-3', destinataire: creerRattachement('Copropriété', 'copro-1') }, CONTEXTE)
    expect(() => enregistrerReception(aLaCopropriete, { ...receptionAr, courrierId: 'courrier-3' })).toThrow(refus('courrier-3'))
  })

  it('lecture : une réception sans AR dont le courrier n’a pas porté l’OS (ligne écrite sans ce contrôle) est « sans preuve », jamais l’état d’un pli non rattaché', () => {
    const admise = enregistrerReception(envoyeAr, receptionAr).journal[1]
    /** Ligne de réception sans la clé « ar », écrite avant la décision 9 sans le contrôle du pli, sous ce courrier. */
    const ancienne = (s: SortieOrdreService, courrierId: string) => {
      const ligne: EvenementDiffusion = { ...admise, courrierId }
      delete ligne.ar
      return { sortie: { ...s, journal: [...s.journal, ligne] }, ligne }
    }
    const scenarios = [
      ancienne(envoyerOs(d, sortie(d), ENVOI, CONTEXTE), 'courrier-sans-rapport'),
      ancienne(envoyeAr, 'courrier-2'),
      ancienne(relancee, 'courrier-4'),
    ]
    for (const { sortie: s, ligne } of scenarios) {
      expect(preuveDeDiffusion(s, ligne, COURRIER_AR), ligne.courrierId ?? '').toBe('sans_preuve')
      expect(preuveReceptionOs(s), ligne.courrierId ?? '').toBe('sans_preuve')
    }
    // le courrier lié reste attendu de toute ligne par courrier AR ; la ligne d'envoi garde l'état de son courrier
    const { sortie: autreCourrier, ligne } = scenarios[1]
    expect(() => preuveDeDiffusion(autreCourrier, ligne)).toThrow(/courrier lié est attendu/)
    expect(preuveDeDiffusion(autreCourrier, autreCourrier.journal[0], COURRIER_AR)).toBe('notifie')
    // la même ligne ancienne, sous le courrier qui a porté l'OS : l'état de notification de ce courrier
    const rattachee = ancienne(envoyeAr, 'courrier-1')
    expect(preuveDeDiffusion(rattachee.sortie, rattachee.ligne, COURRIER_AR)).toBe('notifie')
  })
})

describe('retouches de demandes.ts (base #618)', () => {
  it('verifierSansBloquant, exporté, ne lève que sur les bloquants et les liste', () => {
    expect(() => verifierSansBloquant([{ gravite: 'alerte', message: 'A.' }], 'Refus')).not.toThrow()
    expect(() => verifierSansBloquant([{ gravite: 'bloquant', message: 'B.' }, { gravite: 'alerte', message: 'A.' }], 'Refus')).toThrow(/^Refus : B\.$/)
  })

  it('codification : la facture la moins avancée, inchangée avec la valeur initiale du reduce', () => {
    const d = { ...demande(), factureIds: ['f1', 'f2'] }
    expect(codificationFacture(d, [{ id: 'f1', statut: 'Comptabilisée' }, { id: 'f2', statut: 'À traiter' }])).toBe('À traiter')
    expect(codificationFacture({ ...d, factureIds: ['f1'] }, [{ id: 'f1', statut: 'Comptabilisée' }])).toBe('Comptabilisée')
  })
})

describe('en-tête du module', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'envoi-ordre-service.ts'), 'utf8')
  /** En-tête lu d'un seul tenant : les retours à la ligne du commentaire (« \n *   ») valent une espace. */
  const enTete = source.slice(0, source.indexOf('*/')).replaceAll(/\r?\n \* */g, ' ')

  it('cite les tranches Gestéam, les marqueurs et la base du rôle de viseur', () => {
    for (const attendu of ['tranche 34', 'tranche 40', 'tranche 43', '🟢', '🔵', '🔴', 'CircuitValidationModule', 'ROLES_CABINET'])
      expect(enTete).toContain(attendu)
  })

  it('relève le droit ajouté au tour 1 (art. 42, al. 3 ; D. 39 ; D. 62-7, al. 3 ; art. 21-1 à 21-3 ; loi 2004-575)', () => {
    for (const attendu of ['L. 1965 art. 42, al. 3', 'D. 1967 art. 39', '62-7, al. 3', '21-3', '2004-575'])
      expect(enTete).toContain(attendu)
  })

  it('tour 2 : branchement du suivi « à faire » par relanceAFixer (aConfirmer laissé aux repères juridiques) ; constat postérieur à l’envoi bloquant', () => {
    expect(enTete).not.toContain('aConfirmer pour une date de relance à fixer')
    expect(enTete).toContain('relanceAFixer')
    const deduit = enTete.slice(enTete.indexOf('🔵 Déduit'), enTete.indexOf('🔴 Non établi'))
    expect(deduit).toContain('constat_urgence_posterieur_envoi')
    // la question du moment du constat (décision ou envoi) reste ouverte
    expect(enTete.slice(enTete.indexOf('🔴 Non établi'))).toContain("constat doit-il précéder la décision au registre, ou l'envoi")
  })

  it('ne cite pas l’art. 1127-5 du code civil, abrogé', () => {
    expect(source).not.toContain('1127-5')
  })

  it('retours de relecture J17 à J19 : textes du signataire gardés, art. 42 décrit selon le comportement, unanimité justifiée, réception distincte déduite, preuve de la réception', () => {
    const decisions = enTete.slice(enTete.indexOf('Décisions de Hugo du 03/11/2026'), enTete.indexOf('🔵 Déduit'))
    const deduit = enTete.slice(enTete.indexOf('🔵 Déduit'), enTete.indexOf('🔴 Non établi'))
    const questions = enTete.slice(enTete.indexOf('🔴 Non établi'))
    // J18 : les textes de la question 8 restent cités, la lecture est marquée 🔵 ; « sans texte » ne vaut que pour la liste du cabinet
    expect(decisions).toContain('« Seul responsable de sa gestion, il ne peut se faire substituer. »')
    expect(decisions).toContain("« L'administrateur provisoire exécute personnellement la mission qui lui est confiée. »")
    expect(decisions).toContain("au nom et sous la responsabilité de l'administrateur provisoire, n'est pas une substitution")
    expect(decisions).toContain('contrôle par la liste du cabinet : règle de gestion, sans texte')
    expect(decisions).toContain('administrateurDesigneId')
    expect(decisions).toContain('une liste vide bloque tout autre signataire')
    expect(enTete).not.toContain('règle de gestion sans texte (signataire_non_habilite')
    expect(enTete).not.toMatch(/AUCUN TEXTE pour [^.]*, le signataire,/)
    expect(questions).toContain("textes sur l'habilitation des collaborateurs non lus")
    // J17 (a) : la décision décrit le comportement ; le cas de l'intervention postérieure est à confirmer
    expect(decisions).toContain("un envoi pendant le délai pour une intervention prévue après lui n'est pas bloqué")
    expect(decisions).not.toContain("l'envoi de l'OS est BLOQUÉ pendant le délai de contestation (")
    expect(questions).toContain('un envoi pendant le délai de contestation, pour une intervention prévue après la fin du délai, peut-il partir')
    // J17 (c) : la raison de l'interprétation, et l'écart avec majorites-ag.ts
    expect(decisions).not.toContain('seules les majorités des art. 25 et 26 le sont')
    expect(decisions).toContain('ni opposant ni défaillant')
    expect(decisions).toContain('« Les actions en contestation des décisions des assemblées générales doivent, à peine de déchéance, être introduites par les copropriétaires opposants ou défaillants')
    expect(questions).toContain("MAJORITES_AG (majorites-ag.ts) fonde l'unanimité sur L. 1965 art. 26, dernier al.")
    // J19 : réception distincte déduite (🔵), AR réservé au courrier AR, AR tardif, ligne ancienne, courrier lié
    expect(decisions).toContain("déduit de « l'AR fait preuve »")
    expect(deduit).toContain("l'AR est réservé à la réception par courrier AR")
    expect(deduit).toContain('preuveReceptionOs')
    expect(deduit).toContain('nouvelle ligne « reception »')
    expect(deduit).toContain('lue sans AR')
    expect(deduit).toContain("rapproché du courrier lié")
  })

  it('retours de relecture J17 à J19 (tour 2) : art. 18, IV et 29-1, I cités jusqu’aux phrases qui suivent ; administrateurDesigneId tiré du mandat, jamais du réglage du cabinet ; AR du pli qui a porté l’OS', () => {
    const decisions = enTete.slice(enTete.indexOf('Décisions de Hugo du 03/11/2026'), enTete.indexOf('🔵 Déduit'))
    const deduit = enTete.slice(enTete.indexOf('🔵 Déduit'), enTete.indexOf('🔴 Non établi'))
    const questions = enTete.slice(enTete.indexOf('🔴 Non établi'), enTete.indexOf('Branchements à faire plus tard'))
    const branchements = enTete.slice(enTete.indexOf('Branchements à faire plus tard'))
    // constat 3 : la phrase de l'art. 29-1, I qui suit « exécute personnellement » (et celle de l'art. 18, IV), mot pour mot
    expect(decisions).toContain(
      '« Il peut toutefois, lorsque le bon déroulement de la mission le requiert, se faire assister par un tiers désigné par le président du tribunal judiciaire sur sa proposition et rétribué sur sa rémunération. »',
    )
    expect(decisions).toContain("« L'assemblée générale peut seule autoriser, à la majorité prévue par l'article 25, une délégation de pouvoir à une fin déterminée. »")
    expect(decisions).toContain('le seul concours que cet alinéa prévoit')
    expect(decisions).toContain("le collaborateur n'est pas le tiers qui assiste l'administrateur provisoire")
    expect(questions).toContain('collaborateurs du cabinet sont-ils des « tiers » au sens de L. 1965 art. 29-1, I')
    expect(questions).toContain('« délégation de pouvoir » de L. 1965 art. 18, IV')
    // constat 4 : l'administrateur provisoire est désigné pour chaque mandat par le président du tribunal judiciaire
    /** Source entière, commentaires lus d'un seul tenant (« \n   * » vaut une espace). */
    const joint = source.replaceAll(/\r?\n\s*\* */g, ' ')
    expect(joint).not.toMatch(/administrateurDesigneId[^.;]*réglage du cabinet/)
    expect(branchements).toContain('administrateurDesigneId tiré du MANDAT')
    expect(decisions).toContain("administrateurDesigneId, l'administrateur provisoire désigné pour ce mandat par la décision du président du tribunal judiciaire")
    const champ = joint.slice(joint.indexOf('administrateurDesigneId?: string | null') - 600, joint.indexOf('administrateurDesigneId?: string | null'))
    expect(champ).toContain('désigné pour ce mandat par la décision du président du tribunal judiciaire')
    expect(champ).toContain('jamais depuis le réglage du cabinet')
    expect(questions).toContain('mandat qui nomme deux administrateurs judiciaires')
    // constat 1 : l'AR est celui du pli qui a porté l'OS ; « comme courriers.ts » vaut pour le courrier lié lui-même
    expect(deduit).toContain("celui du pli qui a porté l'OS à l'entreprise")
    expect(deduit).not.toContain("n'est ni antérieure au premier envoi ni postérieure à la réception (comme courriers.ts")
    // constat 2 : l'écart découvert à la lecture est signalé, jamais levé
    expect(deduit).toContain('ar_ecart_courrier')
    expect(deduit).not.toContain('refuse la même incohérence')
  })

  it('contrôle final J19 : toute réception par courrier AR, AR saisi ou non, rattachée au pli qui a porté l’OS ; sans AR, jamais la preuve d’un pli non rattaché', () => {
    const deduit = enTete.slice(enTete.indexOf('🔵 Déduit'), enTete.indexOf('🔴 Non établi'))
    const branchements = enTete.slice(enTete.indexOf('Branchements à faire plus tard'))
    expect(deduit).toContain('toute réception par courrier AR, AR saisi ou non')
    expect(deduit).toContain("la réception d'un autre pli n'est pas celle de l'OS")
    expect(deduit).toContain("« sans preuve », jamais l'état de notification d'un pli qui n'a pas porté l'OS")
    expect(branchements).toContain('preuveDeDiffusion avec la sortie et le courrier lié de toute ligne par courrier AR')
  })

  it('L. 1965 art. 42, al. 3 cité mot pour mot (Légifrance, version en vigueur au 03/11/2026)', () => {
    expect(enTete).toContain(
      "« Sauf urgence, l'exécution par le syndic des travaux décidés par l'assemblée générale en application des articles 25 et 26 de la présente loi est suspendue jusqu'à l'expiration du délai de deux mois mentionné au deuxième alinéa du présent article. »",
    )
    expect(enTete).toContain('version en vigueur au 03/11/2026')
    expect(enTete).not.toContain('suspendue jusqu\'à l\'expiration du délai de contestation de deux mois (L. 1965 art. 42, al. 3)')
  })

  it('rubrique « Décisions de Hugo du 03/11/2026 » : réponses 1 à 9 (J11 à J19) inscrites, leurs questions fermées, les autres restent ouvertes', () => {
    const decisions = enTete.slice(enTete.indexOf('Décisions de Hugo du 03/11/2026'), enTete.indexOf('🔵 Déduit'))
    for (const attendu of ['PAR MANDAT', 'UrgenceOrdreAJ', 'CANAUX_ENVOI_OS', '« Accusé demandé »', '« Rapport demandé »', 'MÊME circuit', 'mise en concurrence', "nous constatons l'urgence"])
      expect(decisions).toContain(attendu)
    // décisions 7 à 9 (J17 à J19)
    for (const attendu of [
      '7 (J17)',
      "interprétation de la réponse « oui », à confirmer par Hugo (🔵)",
      'unanimité',
      '8 (J18)',
      'COLLABORATEUR',
      'réglage du cabinet',
      '9 (J19)',
      'FAIT PREUVE',
      'première présentation',
      'aucune caducité codée',
    ])
      expect(decisions).toContain(attendu)
    // l'auteur du constat face aux signataires : interprétation (🔵), pas une décision de Hugo
    expect(decisions).not.toContain('constat_urgence_auteur_non_habilite')
    // décision 5 : le contenu de l'alinéa reste écrit ; décision 3 : la règle telle que le code l'applique
    expect(decisions).toContain('L. 1965 art. 21, al. 6 (pas de conseil syndical : mise en concurrence non obligatoire) : le motif « mise en concurrence » est gardé')
    expect(decisions).toContain('date de relance fixée ou non')
    // la date du constat n'est pas une décision de Hugo
    expect(decisions).not.toMatch(/borneAvisAj|constat_urgence_posterieur/)
    const deduit = enTete.slice(enTete.indexOf('🔵 Déduit'), enTete.indexOf('🔴 Non établi'))
    expect(deduit).toContain('critère proposé, non contredit par Hugo')
    expect(deduit).toContain('règle proposée, non demandée par Hugo')
    expect(deduit).toContain('constat_urgence_auteur_non_habilite')
    expect(deduit).toContain('« sans preuve »')
    expect(deduit).not.toContain("l'auteur du constat n'est pas comparé aux signataires habilités")
    expect(deduit).not.toContain('question 7 ouverte')
    const questions = enTete.slice(enTete.indexOf('🔴 Non établi'))
    for (const tranchee of [
      'séquence par mandat (retenue) ou par mandat et plan',
      'valeurs des listes Délai, Envoi et Signature',
      'la relance vise-t-elle',
      'le visa des courriers (tranche 20) suit-il',
      "Qui constate l'urgence",
      'vaut-il pour les marchés',
      // décisions 7 à 9
      'L. 1965 art. 42, al. 3 : bloquant',
      'relève-t-elle de la suspension',
      'un collaborateur peut-il signer',
      '(question 7)',
    ])
      expect(questions).not.toContain(tranchee)
    for (const ouverte of [
      'segment <plan>',
      'au premier envoi',
      'complété de zéros',
      'liste Signature',
      'devisExigesParAssemblee',
      'Hugo (suite de la décision 6)',
      'critère proposé (entretien courant',
      'un délai « prioritaire » peut-il valoir urgence',
      "constat doit-il précéder la décision au registre, ou l'envoi",
      // restes des décisions 8 et 9
      "l'auteur du constat d'urgence doit-il être un signataire habilité",
      'Hugo, preuve (suite de la décision 9)',
      // registre J19 : « objet (devis ou OS) » ; la question imposée nommait le devis et l'AR
      "la caducité d'un an vise-t-elle le devis accepté par l'OS, l'OS lui-même, ou l'AR lui-même ? À compter de quelle date : envoi, première présentation, réception ?",
      // non répondue par Hugo : déduite de « l'AR fait preuve », elle reste à confirmer
      "la réception distincte de l'envoi convient-elle",
      "vaut-elle réception de l'OS au sens de C. civ. art. 1121",
      "délai d'acheminement",
    ])
      expect(questions).toContain(ouverte)
  })
})
