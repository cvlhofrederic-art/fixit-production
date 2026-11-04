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
  autorisationConvention,
  controlerAvantEnvoiOs,
  creerSortieOs,
  demandeEnvoiDepuisOs,
  demanderVisa,
  devisCaducALaReception,
  donnerVisa,
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
  rangOsSuivant,
  refuserVisa,
  relancerOs,
  relancesOsDues,
  revoirVisa,
  type ContexteEnvoiOs,
  type OptionsVisa,
  type ReglesVisaOs,
  type SaisieDiffusion,
  type SaisieEvenementVisa,
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
 * 37, 39, 62-7, 62-8 ; C. civ. art. 1117, 1118, 1121, 1126, 1127, 1127-4 ; loi n° 2004-575 art. 1er, IV.
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

  it('administrateur provisoire au titre des pouvoirs de l’assemblée : avis du conseil syndical, sauf urgence motivée (D. 1967 art. 62-7)', () => {
    const aj = sortie(demande(), { fondement: 'decision_aj_pouvoirs_ag' })
    expect(aj.visa).toBe('Visa nécessaire')
    expect(aj.motifsVisa).toEqual(['avis_conseil_syndical_aj'])
    const urgente = sortie(demande(), { fondement: 'decision_aj_pouvoirs_ag', delai: 'urgence', motifUrgence: 'Fuite active sur colonne' })
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

  it('signataire hors de la liste des habilités : bloquant à confirmer (L. 1965 art. 18, IV ; art. 29-1)', () => {
    const anomalies = controlerAvantEnvoiOs(demande(), sortie(), { ...CONTEXTE, signatairesHabilites: new Set(['col-aj']) })
    expect(bloquants(anomalies)).toEqual(['signataire_non_habilite'])
    expect(anomalies[0].aConfirmer).toBe(true)
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

  it('fondement : non renseigné, sans référence, urgence non motivée, suites de l’urgence (D. 1967 art. 37)', () => {
    expect(codes(controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: null }), CONTEXTE))).toEqual(['fondement_non_renseigne'])
    const sansReference = sortie(demande(), { fondement: 'execution_resolution_ag', majoriteResolution: 'art24' })
    expect(codes(controlerAvantEnvoiOs(demande(), sansReference, CONTEXTE))).toEqual(['fondement_sans_reference'])
    const urgence = controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: 'urgence_sauvegarde', delai: 'urgence' }), CONTEXTE)
    expect(codes(urgence)).toEqual(['urgence_non_motivee', 'urgence_suites'])
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
    expect(preuveDeDiffusion(envoye.journal[0])).toBe('trace_interne')
    const ar = { ...envoye.journal[0], canal: 'courrier_ar' as const, courrierId: 'courrier-1' }
    const notifie: CourrierSuivi = { formeEnvoi: 'AR', dateDepot: '2026-10-03', datePremierePresentation: '2026-10-05', dateAccuseReception: null }
    expect(preuveDeDiffusion(ar, notifie)).toBe('notifie')
    expect(preuveDeDiffusion(ar, { ...notifie, datePremierePresentation: null })).toBe('envoye_non_notifie')
    expect(() => preuveDeDiffusion(ar)).toThrow(/courrier lié/)
    expect(() => preuveDeDiffusion(ar, { ...notifie, formeEnvoi: 'Normal' })).toThrow(/AR/)
  })
})

describe('adaptateurs (branchements à faire plus tard)', () => {
  it('relances dues pour le suivi « à faire » : OS envoyés, ni terminés ni refusés, avec une date de relance', () => {
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
    expect(bloquants(controlerAvantEnvoiOs(d, resolution({ delai: 'urgence', motifUrgence: 'Infiltrations actives' }), pendant))).toEqual([])
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
    const urgence = controlerAvantEnvoiOs(demande(), sortie(demande(), { fondement: 'urgence_sauvegarde', delai: 'urgence', motifUrgence: 'Fuite active' }), CONTEXTE)
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

  it('motif d’urgence sans délai « urgence » : l’urgence n’est pas retenue, l’avis de D. 1967 art. 62-7 reste exigé, alerte', () => {
    const d = demande()
    const cadre: SaisieSortieOs = {
      fondement: 'decision_aj_pouvoirs_ag',
      fondementReference: 'registre n° 7',
      decisionLe: '2026-10-02',
      justificatifs: { modeFinancement: 'appel de fonds' },
    }
    const s = sortie(d, { ...cadre, motifUrgence: 'à voir' })
    expect(s.visa).toBe('Visa nécessaire')
    expect(s.motifsVisa).toEqual(['avis_conseil_syndical_aj'])
    const anomalies = controlerAvantEnvoiOs(d, viser(s, d), CONTEXTE)
    expect(bloquants(anomalies)).toEqual(['avis_conseil_syndical_aj_absent'])
    expect(anomalies.find((a) => a.code === 'motif_urgence_sans_urgence')?.gravite).toBe('alerte')
    // OS créé en urgence motivée, puis ramené au délai « normale » : l'avis redevient exigé
    const rabaissee = modifierSortieOs(sortie(d, { ...cadre, delai: 'urgence', motifUrgence: 'Fuite active' }), d, { delai: 'normale' })
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
  const enTete = source.slice(0, source.indexOf('*/'))

  it('cite les tranches Gestéam, les marqueurs et la base du rôle de viseur', () => {
    for (const attendu of ['tranche 34', 'tranche 40', 'tranche 43', '🟢', '🔵', '🔴', 'CircuitValidationModule', 'ROLES_CABINET'])
      expect(enTete).toContain(attendu)
  })

  it('relève le droit ajouté au tour 1 (art. 42, al. 3 ; D. 39 ; D. 62-7, al. 3 ; art. 21-1 à 21-3 ; loi 2004-575)', () => {
    for (const attendu of ['L. 1965 art. 42, al. 3', 'D. 1967 art. 39', '62-7, al. 3', '21-3', '2004-575'])
      expect(enTete).toContain(attendu)
  })

  it('ne cite pas l’art. 1127-5 du code civil, abrogé', () => {
    expect(source).not.toContain('1127-5')
  })
})
