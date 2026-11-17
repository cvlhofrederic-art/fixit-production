import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { composerDateIso as d } from '@/lib/administrateur-judiciaire/domain/dates'
import { creerDemande, modeleDeNature, type Demande, type ModeleDemande, type SaisieDemande } from '@/lib/administrateur-judiciaire/domain/demandes'
import {
  controlerAvantEnvoiOs,
  creerSortieOs,
  envoyerOs,
  formaterNumeroOs,
  lireNumeroOs,
  numeroterAuPremierEnvoi,
  rangOsSuivant,
  segmentPlanOs,
  type ContexteEnvoiOs,
  type SaisieDiffusion,
  type SaisieSortieOs,
} from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import {
  CAUSES_DELAI_NON_CALCULE,
  finDelaiContestationAg,
  finDelaiContestationAgParDestinataire,
  type ContexteVoieNotification,
  type ResultatDelaiContestation,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import {
  NATURES_DEPENSE_TRAVAUX,
  assietteDroitProportionnelTravaux,
  compteProvisoireDroitsProportionnelsTravaux,
  droitProportionnelTravauxAdministrateurProvisoire,
} from '@/lib/administrateur-judiciaire/domain/travaux-budget'
import type { PiecesEntreprise } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import {
  creerConsentementVoieElectronique,
  creerDemandeVoiePostale,
  effetDemandeVoiePostale,
  voieDeNotification,
  type SensConsentementVoieElectronique,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { chaineLe, lreLe } from './donnees-delai-contestation'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions de Hugo du 17/11/2026 (DECISIONS-HUGO-2026-11-17.md ; numéros de registre proposés) :
 * - J52 (Q1, suite de J50) : demande de voie postale, refus ou retrait de la voie électronique reçu AVANT le 25/12/2025 :
 *   effet dès sa réception (ancienne règle), même pour un envoi électronique postérieur au 25/12/2025, qui ne vaut pas
 *   notification ; le délai de contestation ne court pas pour ce copropriétaire ;
 * - J53 (Q2, suite de J50) : LRE à un non-professionnel (ou qualité non saisie) sans consentement enregistré (CPCE art.
 *   L. 100) : ne vaut pas notification ; l'accord du critère LRE de Gestéam vaut consentement ; le prestataire qualifié
 *   n'est pas concerné ; la LRAR reste possible ;
 * - J54 (Q3, suite de J47 et J49) : le devis du 29/02 a un an le 28/02 suivant (comportement inchangé) ;
 * - J55 (Q4, suite de J39) : assiette du droit proportionnel = travaux seuls, HT ; détail par opération pour le compte
 *   provisoire détaillé des émoluments (D. 1967 art. 61-1-5, II) ;
 * - J56 (Q5, suite de J11, J12, J18) : N° attribué au premier envoi, rang sans zéros, segment « plan » = date du premier
 *   envoi (AAAAMMJJ) ; liste « Signature » = signataires habilités du cabinet.
 */

// ─── Données du délai de contestation (comme j50-j51-decisions.test.ts) ─────────────────────────────

// ligne, chaineLe et lreLe : ./donnees-delai-contestation (partagés avec l'autre fichier des décisions du 17/11).

const consent = (sens: SensConsentementVoieElectronique, recuLe: string) => creerConsentementVoieElectronique({ identiteId: 'id-1', sens, recuLe })
const demandePostale = (recueLe: string) => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe, origine: 'courrier' })

/** LRE du `date` à un destinataire professionnel (pas de question de CPCE art. L. 100). */
const lreDu = (date: string, voie: ContexteVoieNotification, professionnel: boolean | null = true) =>
  finDelaiContestationAg(chaineLe(date), [lreLe(date)], 'ag-1', { opposantsOuDefaillants: 1, professionnel, voie })

const motifDe = (resultat: ResultatDelaiContestation): string => {
  if (resultat.etat !== 'refuse') throw new Error(`Refus attendu : ${JSON.stringify(resultat)}`)
  return resultat.motif
}

// ─── Données de l'ordre de service (comme envoi-ordre-service.test.ts) ──────────────────────────────

const modele = (nature: string): ModeleDemande => {
  const trouve = modeleDeNature(nature)
  if (!trouve) throw new Error(`Modèle absent du test : ${nature}`)
  return trouve
}
const OS = modele('OS Copro')

const saisieDemande = (surcharge: Partial<SaisieDemande> = {}): SaisieDemande => ({
  id: 'dem-1',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  prestataireId: 'ent-1',
  demandeLe: '2026-10-01',
  numero: '125.20261001.6',
  objet: 'Recherche de fuite colonne',
  prix: { montantTtcCentimes: 120_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 109_091 },
  prevuLe: '2026-12-15',
  ...surcharge,
})
const demande = (surcharge: Partial<SaisieDemande> = {}): Demande => creerDemande(saisieDemande(surcharge), OS)

const PRETE: SaisieSortieOs = { signataireId: 'col-direction', canal: 'messagerie_vitfix', fondement: 'administration_courante', entrepriseLiee: false }
const sortie = (dm: Demande, saisie: SaisieSortieOs = {}) => creerSortieOs(dm, { ...PRETE, ...saisie })

const PIECES: PiecesEntreprise = {
  prestataireId: 'ent-1',
  etablieEnFrance: true,
  attestationUrssafLe: '2026-09-01',
  attestationUrssafVerifiee: true,
  immatriculation: { nature: 'kbis', le: '2026-09-01' },
}
const CONTEXTE: ContexteEnvoiOs = { date: '2026-11-17', pieces: PIECES, controle: { decennaleObligatoire: false }, prestataireAvecCompteVitfix: true }

const ENVOI: SaisieDiffusion = {
  date: '2026-11-17',
  heure: '10:00',
  collaborateurId: 'col-gestion',
  canal: 'messagerie_vitfix',
  destinataire: creerRattachement('Entreprise', 'ent-1'),
  missionId: 'mission-1',
}

/** OS qui exécute une résolution votée à l'art. 25 (suspension de L. 1965 art. 42, al. 3). */
const resolution = (dm: Demande) =>
  sortie(dm, { fondement: 'execution_resolution_ag', fondementReference: 'AG du 12/09/2026, résolution 7', majoriteResolution: 'art25' })

// ─── J52 ────────────────────────────────────────────────────────────────────────────────────────

describe('J52 — demande, refus ou retrait reçu avant le 25/12/2025 : effet dès sa réception (ancienne règle)', () => {
  it('effet de la demande : à sa réception avant le 25/12/2025, le lendemain du huitième jour depuis (D. 1967 art. 64-4)', () => {
    for (const origine of ['courrier', 'extranet', 'autre'] as const) {
      expect(effetDemandeVoiePostale(creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2025, 12, 20), origine }))).toBe(d(2025, 12, 20))
      expect(effetDemandeVoiePostale(creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2025, 12, 24), origine }))).toBe(d(2025, 12, 24))
      // règle actuelle dès le 25/12/2025 : réception + 9 jours
      expect(effetDemandeVoiePostale(creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: d(2025, 12, 25), origine }))).toBe(d(2026, 1, 3))
    }
  })

  it('voie de notification après le 25/12/2025 : postale depuis la réception d’une demande reçue avant, fondement de J52', () => {
    const voie = voieDeNotification({ identiteId: 'id-1', demandes: [demandePostale(d(2025, 12, 20))], date: d(2025, 12, 27) })
    expect(voie).toMatchObject({ voie: 'postale', depuis: d(2025, 12, 20), aConfirmer: null })
    expect(voie.fondement).toContain('décision de Hugo du 17/11/2026, J52')
    expect(voie.fondement).toContain('effet à sa réception')
    // demande reçue depuis le 25/12/2025 : fondement inchangé
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demandePostale(d(2026, 10, 1))], date: d(2026, 10, 29) }).fondement).toBe(
      'L. 1965 art. 42-1 ; D. 1967 art. 64-1, 64-4',
    )
  })

  it('refus reçu le 20/12/2025, LRE du 27/12/2025 : ne vaut pas notification, délai non lancé pour lui (avant : calculé « à confirmer »)', () => {
    const resultat = lreDu(d(2025, 12, 27), { consentements: [consent('refus', d(2025, 12, 20))] })
    expect(resultat).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(motifDe(resultat)).toBe(
      "Délai non calculé. Voie postale demandée par ce copropriétaire : refus de la voie électronique ou retrait de l'accord reçu le 20/12/2025, avant le 25/12/2025, valant demande de voie postale (« à tout moment et par tout moyen », L. 1965 art. 42-1, al. 2, version de la loi du 9 avril 2024 ; elle vaut au moins retrait de l'accord exprès, D. 1967 art. 64-4, rédaction en vigueur du 04/07/2020 au 24/12/2025 ; effet retenu à sa réception, le délai de huit jours de l'art. 64-4 actuel n'existait pas ; décret du 22/12/2025 sans règle transitoire pour les notifications, C. civ. art. 2 ; décision de Hugo du 17/11/2026, J52) : l'envoi électronique du 27/12/2025 ne vaut pas notification et ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1).",
    )
  })

  it('demande de voie postale enregistrée, reçue le 20/12/2025 : même refus, motif « demande reçue »', () => {
    const resultat = lreDu(d(2025, 12, 27), { demandesVoiePostale: [demandePostale(d(2025, 12, 20))] })
    expect(resultat).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(motifDe(resultat)).toContain('Voie postale demandée par ce copropriétaire : demande reçue le 20/12/2025, avant le 25/12/2025 (')
    expect(motifDe(resultat)).toContain('décision de Hugo du 17/11/2026, J52')
    expect(motifDe(resultat)).not.toMatch(/à confirmer|question à Hugo/)
  })

  it('bornes : reçue le 24/12/2025, LRE du 25/12/2025 refusée ; reçue le 25/12/2025, LRE du 27/12/2025 calculée sans avertissement (règle actuelle)', () => {
    expect(lreDu(d(2025, 12, 25), { demandesVoiePostale: [demandePostale(d(2025, 12, 24))] })).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    expect(lreDu(d(2025, 12, 27), { demandesVoiePostale: [demandePostale(d(2025, 12, 25))] })).toMatchObject({ etat: 'calcule', avertissements: [] })
    // effet de la demande du 25/12/2025 atteint le 03/01/2026 : motif de la règle actuelle, sans J52
    const effective = lreDu(d(2026, 1, 3), { demandesVoiePostale: [demandePostale(d(2025, 12, 25))] })
    expect(motifDe(effective)).toBe(
      "Délai non calculé. Voie postale demandée par ce copropriétaire (effet le 03/01/2026) : l'envoi électronique du 03/01/2026 ne fait pas courir le délai pour lui ; le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1, 64-4).",
    )
  })

  it('plus aucun avertissement « à confirmer » pour la fenêtre du 16 au 24/12/2025', () => {
    for (let jour = 16; jour <= 24; jour += 1) {
      const resultat = lreDu(d(2025, 12, 27), { consentements: [consent('refus', d(2025, 12, jour))] })
      expect(resultat, `refus du ${jour}/12/2025`).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    }
  })

  it('inchangé (J50, lecture du code) : un refus d’avant le 25/12/2025 suivi d’un accord reçu avant l’envoi n’est plus une demande', () => {
    expect(lreDu(d(2025, 12, 27), { consentements: [consent('refus', d(2025, 12, 20)), consent('accord', d(2025, 12, 26))] })).toMatchObject({ etat: 'calcule' })
  })

  it('J51 : la fin du délai est inconnue, l’OS des travaux votés à l’art. 25 est bloqué, le message dit de notifier par LRAR', () => {
    const delai = finDelaiContestationAgParDestinataire(chaineLe(d(2025, 12, 27)), [lreLe(d(2025, 12, 27))], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-1', courrierId: 'k1', professionnel: true }],
      voie: { consentements: [consent('refus', d(2025, 12, 20))] },
    })
    expect(delai).toMatchObject({ etat: 'refuse', cause: 'voie_postale_demandee' })
    const dm = demande()
    const [inconnu, ...autres] = controlerAvantEnvoiOs(dm, resolution(dm), { ...CONTEXTE, delaiContestationAg: delai })
    expect(autres).toEqual([])
    expect([inconnu.code, inconnu.gravite]).toEqual(['delai_contestation_inconnu', 'bloquant'])
    expect(inconnu.message).toContain('J52')
    expect(inconnu.message).toContain('notifier de nouveau par lettre recommandée avec avis de réception')
  })

  it('en-têtes : la fenêtre du 16 au 24/12/2025 n’est plus une question ; J52 citée', () => {
    for (const fichier of ['voie-notification', 'statut-assemblee']) {
      const { texte } = enTeteDuModule(fichier)
      expect(texte, fichier).toContain('Décisions de Hugo du 17/11/2026')
      expect(texte, fichier).toContain('J52')
      expect(texte, fichier).not.toMatch(/reçu du 16 au 24\/12\/2025[^.;]*avertissement « à confirmer »/)
      expect(texte, fichier).not.toContain('variante plus prudente')
    }
  })
})

// ─── J53 ────────────────────────────────────────────────────────────────────────────────────────

describe('J53 — LRE à un non-professionnel sans consentement enregistré (CPCE art. L. 100) : ne vaut pas notification', () => {
  const MOTIF_L100 =
    "Délai non calculé. LRE à un destinataire non professionnel (ou dont la qualité n'est pas saisie, lue comme non professionnelle) sans consentement enregistré aux envois recommandés électroniques (CPCE art. L. 100 ; l'accord du critère LRE repris de Gestéam vaut ce consentement) : elle ne vaut pas notification et ne fait pas courir le délai pour lui (décision de Hugo du 17/11/2026, J53). Enregistrer son consentement s'il l'a donné avant l'envoi, ou le notifier par lettre recommandée avec avis de réception (D. 1967 art. 64-1) ou par le procédé d'un prestataire qualifié (art. 64, 2°)."
  const LE = d(2026, 3, 5)

  it('non professionnel, ou qualité non saisie : refus, cause consentement_lre_absent (avant : calculé « à confirmer »)', () => {
    expect(CAUSES_DELAI_NON_CALCULE).toContain('consentement_lre_absent')
    for (const professionnel of [false, null]) {
      const resultat = lreDu(LE, {}, professionnel)
      expect(resultat, String(professionnel)).toEqual({ etat: 'refuse', cause: 'consentement_lre_absent', motif: MOTIF_L100 })
    }
  })

  it('l’accord du critère LRE de Gestéam vaut consentement, s’il est reçu au plus tard à l’envoi ; le professionnel n’en a pas besoin', () => {
    expect(lreDu(LE, { consentements: [consent('accord', d(2026, 1, 10))] }, false)).toMatchObject({ etat: 'calcule', avertissements: [] })
    expect(lreDu(LE, { consentements: [consent('accord', LE)] }, null)).toMatchObject({ etat: 'calcule', avertissements: [] })
    expect(lreDu(LE, { consentements: [consent('accord', d(2026, 3, 6))] }, false)).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    expect(lreDu(LE, {}, true)).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('le procédé du prestataire qualifié (D. 1967 art. 64, 2°) n’est pas concerné ; la LRAR reste possible', () => {
    const pscq = lreLe(LE, { formeEnvoi: 'Fichier', modeNotification: 'prestataire_qualifie' })
    expect(finDelaiContestationAg(chaineLe(LE), [pscq], 'ag-1', { opposantsOuDefaillants: 1, professionnel: false })).toMatchObject({ etat: 'calcule', avertissements: [] })
    const lrar = lreLe(LE, { formeEnvoi: 'AR', modeNotification: 'lrar', dateDepot: d(2026, 3, 3), datePremierePresentation: LE, dateAvisElectronique: null })
    expect(
      finDelaiContestationAg(chaineLe(LE), [lrar], 'ag-1', { opposantsOuDefaillants: 1, professionnel: false, voie: { demandesVoiePostale: [demandePostale(d(2026, 2, 1))] } }),
    ).toMatchObject({ etat: 'calcule', avertissements: [] })
  })

  it('la variante électronique de la LRE ne dit plus le consentement « non tranché » : il est exigé (J53)', () => {
    const calcule = lreDu(LE, {}, true)
    if (calcule.etat !== 'calcule') throw new Error('calcul attendu')
    expect(calcule.aConfirmer).toMatch(/à confirmer/)
    expect(calcule.aConfirmer).not.toContain("n'est pas tranché")
    expect(calcule.aConfirmer).toContain('J53')
  })

  it('par destinataire, puis J51 : la fin est inconnue, l’OS est bloqué ; le message dit comment lever le blocage', () => {
    const delai = finDelaiContestationAgParDestinataire(chaineLe(LE), [lreLe(LE)], 'ag-1', {
      opposantsOuDefaillants: 1,
      notifications: [{ identiteId: 'id-1', courrierId: 'k1' }],
    })
    expect(delai).toMatchObject({ etat: 'refuse', cause: 'consentement_lre_absent' })
    const dm = demande()
    const [inconnu, ...autres] = controlerAvantEnvoiOs(dm, resolution(dm), { ...CONTEXTE, delaiContestationAg: delai })
    expect(autres).toEqual([])
    expect([inconnu.code, inconnu.gravite]).toEqual(['delai_contestation_inconnu', 'bloquant'])
    expect(inconnu.message).toContain(
      "Pour lever le blocage : enregistrer le consentement du copropriétaire aux envois recommandés électroniques (CPCE art. L. 100 ; accord du critère LRE de Gestéam) s'il l'a donné avant l'envoi, sinon le notifier de nouveau par lettre recommandée avec avis de réception (D. 1967 art. 64-1) ou par le procédé d'un prestataire qualifié (art. 64, 2°)",
    )
  })

  it('en-têtes : J53 citée ; le consentement de CPCE art. L. 100 n’est plus une question ouverte', () => {
    const voie = enTeteDuModule('voie-notification').texte
    expect(voie).toContain('J53')
    expect(voie.slice(voie.indexOf('🔴 Non établi'))).not.toContain('CPCE art. L. 100')
    const statut = enTeteDuModule('statut-assemblee').texte
    expect(statut).toContain('J53')
    expect(statut).not.toContain('consentement de CPCE art. L. 100 face à l\'art. 42-1 non tranché')
    const os = enTeteDuModule('envoi-ordre-service').texte
    expect(os).not.toContain('faut-il bloquer quand la marque vient d\'une LRE sans consentement')
  })
})

// ─── J54 ────────────────────────────────────────────────────────────────────────────────────────

describe('J54 — devis du 29 février : un an le 28 février suivant (comportement confirmé, sans changement)', () => {
  const DEVIS_ASSOCIE = { devisId: 'devis-1', montantTtcCentimes: 120_000, montantHtCentimes: 109_091 }
  const graves = (envoiLe: string) => {
    const dm = demande({ demandeLe: envoiLe, devisAssocie: DEVIS_ASSOCIE })
    return controlerAvantEnvoiOs(dm, sortie(dm), { ...CONTEXTE, date: envoiLe, dateDevis: d(2028, 2, 29) })
      .filter((a) => a.code.startsWith('devis_'))
      .map((a) => [a.code, a.gravite])
  }

  it('devis du 29/02/2028 : accepté le 28/02/2029 avec l’alerte de J49, refusé dès le 01/03/2029', () => {
    expect(graves(d(2029, 2, 27))).toEqual([])
    expect(graves(d(2029, 2, 28))).toEqual([['devis_revalorisation_a_demander', 'alerte']])
    expect(graves(d(2029, 3, 1))).toEqual([['devis_trop_ancien', 'bloquant']])
  })

  it('en-tête : le cas du 29 février n’est plus une question ouverte ; J54 citée', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    expect(texte).toContain('J54')
    expect(texte).not.toContain('le devis du 29 février a-t-il un an le 28 février suivant')
    expect(texte).not.toContain('Le cas du 29 février reste une lecture du code')
  })
})

// ─── J55 ────────────────────────────────────────────────────────────────────────────────────────

describe('J55 — droit proportionnel de l’administrateur provisoire : assiette des travaux seuls, détail par opération', () => {
  const eur = (centimes: number) => formatEurosCentimes(centimes / 100)

  it('natures des dépenses : travaux (art. 44, 1°, 2°, 3°, 5°) et travaux urgents (art. 37) retenus ; études, DO et honoraires exclus', () => {
    expect([...NATURES_DEPENSE_TRAVAUX]).toEqual([
      'travaux',
      'travaux_urgents',
      'etudes_techniques',
      'dommages_ouvrage',
      'honoraires_maitre_oeuvre',
      'honoraires_bureau_etudes',
      'honoraires_syndic',
      'honoraires_autres',
    ])
    const assiette = assietteDroitProportionnelTravaux([
      { nature: 'travaux', montantHtCentimes: 3_000_000, libelle: 'Ravalement, lot 1' },
      { nature: 'travaux_urgents', montantHtCentimes: 500_000 },
      { nature: 'etudes_techniques', montantHtCentimes: 400_000, libelle: 'Diagnostic structure' },
      { nature: 'dommages_ouvrage', montantHtCentimes: 200_000 },
      { nature: 'honoraires_maitre_oeuvre', montantHtCentimes: 300_000 },
      { nature: 'honoraires_bureau_etudes', montantHtCentimes: 100_000 },
      { nature: 'honoraires_syndic', montantHtCentimes: 50_000 },
      { nature: 'honoraires_autres', montantHtCentimes: 25_000 },
    ])
    expect(assiette.montantHtRetenuCentimes).toBe(3_500_000)
    expect(assiette.montantHtExcluCentimes).toBe(1_075_000)
    expect(assiette.depenses.map((p) => [p.nature, p.retenue])).toEqual([
      ['travaux', true],
      ['travaux_urgents', true],
      ['etudes_techniques', false],
      ['dommages_ouvrage', false],
      ['honoraires_maitre_oeuvre', false],
      ['honoraires_bureau_etudes', false],
      ['honoraires_syndic', false],
      ['honoraires_autres', false],
    ])
    expect(assiette.depenses[0]).toMatchObject({ libelle: 'Ravalement, lot 1', raison: 'D. 1967 art. 44, 1°, 2°, 3° ou 5°' })
    expect(assiette.depenses[1].raison).toBe('D. 1967 art. 37 (travaux urgents)')
    expect(assiette.depenses[2].raison).toContain('D. 1967 art. 44, 4°')
    expect(assiette.depenses[3].libelle).toBe('Assurance dommages-ouvrage')
  })

  it('refus : nature inconnue, montant qui n’est pas en centimes entiers positifs', () => {
    // @ts-expect-error — nature hors liste
    expect(() => assietteDroitProportionnelTravaux([{ nature: 'fournitures', montantHtCentimes: 1 }])).toThrow(/nature de dépense inconnue/i)
    expect(() => assietteDroitProportionnelTravaux([{ nature: 'travaux', montantHtCentimes: -1 }])).toThrow(/centimes entiers/)
    expect(() => assietteDroitProportionnelTravaux([{ nature: 'travaux', montantHtCentimes: 1.5 }])).toThrow(/centimes entiers/)
  })

  /**
   * T-1 : résolution 12 de l'AG du 10/03/2026, travaux 30 000 € HT, études 4 000 €, DO 2 000 €, maître d'œuvre 3 000 € ;
   * T-2 : décision AP-3 de l'administrateur provisoire du 12/03/2026, travaux urgents 10 000 € HT.
   */
  const OPERATIONS = [
    {
      numero: 'T-1',
      decision: { date: '2026-03-10', resolution: 'Résolution 12', origine: 'assemblee' as const, majorite: 'art25' as const },
      depenses: [
        { nature: 'travaux' as const, montantHtCentimes: 3_000_000 },
        { nature: 'etudes_techniques' as const, montantHtCentimes: 400_000 },
        { nature: 'dommages_ouvrage' as const, montantHtCentimes: 200_000 },
        { nature: 'honoraires_maitre_oeuvre' as const, montantHtCentimes: 300_000 },
      ],
    },
    {
      numero: 'T-2',
      decision: { date: '2026-03-12', resolution: 'Décision AP-3', origine: 'administrateur' as const },
      depenses: [{ nature: 'travaux_urgents' as const, montantHtCentimes: 1_000_000 }],
    },
  ]

  it('compte provisoire détaillé (D. 1967 art. 61-1-5, II) : par opération, la décision, le HT retenu, les tranches, le droit', () => {
    const compte = compteProvisoireDroitsProportionnelsTravaux(OPERATIONS, { nbLots: 40 })
    expect(compte).toMatchObject({ applicable: true, totalDroitHtCentimes: 68_750, depasseSeuilArticle15: false, aConfirmer: true })
    expect(compte.lignes.map((l) => [l.numero, l.decision, l.origineDecision, l.dateDecision, l.montantHtRetenuCentimes, l.droit.droitHtCentimes])).toEqual([
      ['T-1', 'Résolution 12 (AG du 10/03/2026)', 'assemblee', '2026-03-10', 3_000_000, 48_750],
      ['T-2', "Décision AP-3 (décision de l'administrateur provisoire du 12/03/2026)", 'administrateur', '2026-03-12', 1_000_000, 20_000],
    ])
    expect(compte.lignes[0].droit.tranches).toEqual([
      { tauxPct: 2, baseCentimes: 1_250_000 },
      { tauxPct: 1.5, baseCentimes: 1_250_000 },
      { tauxPct: 1, baseCentimes: 500_000 },
    ])
    expect(compte.lignes[0].assiette.montantHtExcluCentimes).toBe(900_000)
    expect(compte.lignes[0].detail).toBe(
      `Opération T-1 — Résolution 12 (AG du 10/03/2026) : montant hors taxes des travaux retenu ${eur(3_000_000)} (exclus : ${eur(400_000)} d'études techniques, ${eur(200_000)} d'assurance dommages-ouvrage, ${eur(300_000)} d'honoraires de maître d'œuvre) ; barème de l'arrêté du 8 octobre 2015, art. 11, appliqué à cette seule opération : 2 % × ${eur(1_250_000)} + 1,5 % × ${eur(1_250_000)} + 1 % × ${eur(500_000)} = ${eur(48_750)} HT.`,
    )
    expect(compte.lignes[1].detail).toBe(
      `Opération T-2 — Décision AP-3 (décision de l'administrateur provisoire du 12/03/2026) : montant hors taxes des travaux retenu ${eur(1_000_000)} ; barème de l'arrêté du 8 octobre 2015, art. 11, appliqué à cette seule opération : 2 % × ${eur(1_000_000)} = ${eur(20_000)} HT.`,
    )
    expect(compte.fondements).toEqual(['Arrêté du 8 octobre 2015, art. 11 et 15', 'D. 1967 art. 61-1-5, I, 2° et II', 'D. 1967 art. 37 et 44'])
  })

  it('J39 : barème opération par opération, jamais au cumul (sur 40 000 € cumulés, le droit serait de 587,50 €)', () => {
    const compte = compteProvisoireDroitsProportionnelsTravaux(OPERATIONS, { nbLots: 40 })
    expect(compte.totalDroitHtCentimes).toBe(48_750 + 20_000)
    expect(droitProportionnelTravauxAdministrateurProvisoire(4_000_000).droitHtCentimes).toBe(58_750)
    expect(compte.totalDroitHtCentimes).not.toBe(58_750)
  })

  it('non applicable en administration provisoire renforcée (art. 11, dernier al.) ni à 500 lots et plus (art. 3) : aucun droit, le motif', () => {
    const renforcee = compteProvisoireDroitsProportionnelsTravaux(OPERATIONS, { nbLots: 40, administrationRenforcee: true })
    expect(renforcee).toMatchObject({ applicable: false, lignes: [], totalDroitHtCentimes: 0 })
    expect(renforcee.cadre.motif).toContain("le droit proportionnel sur travaux ne s'applique pas (arrêté du 8 octobre 2015, art. 11)")
    const grande = compteProvisoireDroitsProportionnelsTravaux(OPERATIONS, { nbLots: 500 })
    expect(grande).toMatchObject({ applicable: false, lignes: [], totalDroitHtCentimes: 0 })
    expect(grande.cadre.motif).toContain('art. 3')
  })

  it('refus : opération sans décision, opération en double, nombre de lots invalide', () => {
    expect(() => compteProvisoireDroitsProportionnelsTravaux([{ ...OPERATIONS[0], decision: null }], { nbLots: 40 })).toThrow(
      "Opération T-1 sans décision : le droit proportionnel porte sur les travaux votés en assemblée ou décidés par l'administrateur provisoire (arrêté du 8 octobre 2015, art. 11) ; elle n'entre pas au compte provisoire.",
    )
    expect(() => compteProvisoireDroitsProportionnelsTravaux([OPERATIONS[0], { ...OPERATIONS[1], numero: ' T-1 ' }], { nbLots: 40 })).toThrow(/fournie deux fois/)
    expect(() => compteProvisoireDroitsProportionnelsTravaux(OPERATIONS, { nbLots: 0 })).toThrow(/Nombre de lots invalide/)
    expect(compteProvisoireDroitsProportionnelsTravaux([], { nbLots: 40 })).toMatchObject({ applicable: true, lignes: [], totalDroitHtCentimes: 0 })
  })

  it('en-tête : J55 citée ; l’assiette et la présentation au juge ne sont plus des questions ouvertes', () => {
    const { texte } = enTeteDuModule('travaux-budget')
    expect(texte).toContain('Décisions de Hugo du 17/11/2026')
    expect(texte).toContain('J55')
    const nonEtabli = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(nonEtabli).not.toMatch(/Sur quelle assiette/)
    expect(nonEtabli).not.toContain('Comment le cabinet présente-t-il ce droit au juge')
  })
})

// ─── Relecture contradictoire du 17/11/2026 ─────────────────────────────────────────────────────

describe('relecture contradictoire du 17/11/2026 : constats corrigés', () => {
  const LE = d(2026, 3, 5)
  const eur = (centimes: number) => formatEurosCentimes(centimes / 100)

  it('J53 : LRE sans destinataire renseigné : le motif dit que le consentement ne peut pas lui être rapproché (pas « sans consentement »)', () => {
    const sansDestinataire = lreLe(LE, { personneId: null })
    for (const voie of [{}, { consentements: [consent('accord', d(2026, 1, 10))] }] as ContexteVoieNotification[]) {
      const resultat = finDelaiContestationAg(chaineLe(LE), [sansDestinataire], 'ag-1', { opposantsOuDefaillants: 1, voie })
      expect(resultat).toMatchObject({ etat: 'refuse', cause: 'destinataire_non_renseigne' })
      const motif = motifDe(resultat)
      expect(motif).toContain('Destinataire du courrier rattaché non renseigné')
      expect(motif).toContain('CPCE art. L. 100')
      expect(motif).toContain('décision de Hugo du 17/11/2026, J53')
      expect(motif).not.toContain('Enregistrer son consentement')
    }
    // destinataire professionnel : pas de consentement à rapprocher, calcul inchangé
    expect(finDelaiContestationAg(chaineLe(LE), [sansDestinataire], 'ag-1', { opposantsOuDefaillants: 1, professionnel: true })).toMatchObject({ etat: 'calcule' })
  })

  it('J55 : le détail pour le juge nomme les dépenses réellement exclues, nature par nature', () => {
    const decision = { date: '2026-03-10', resolution: 'Résolution 4' }
    const [seuleDo] = compteProvisoireDroitsProportionnelsTravaux(
      [{ numero: 'T-9', decision, depenses: [{ nature: 'travaux', montantHtCentimes: 1_000_000 }, { nature: 'dommages_ouvrage', montantHtCentimes: 50_000 }] }],
      { nbLots: 10 },
    ).lignes
    expect(seuleDo.detail).toContain(`(exclus : ${eur(50_000)} d'assurance dommages-ouvrage)`)
    const [plusieurs] = compteProvisoireDroitsProportionnelsTravaux(
      [
        {
          numero: 'T-8',
          decision,
          depenses: [
            { nature: 'honoraires_maitre_oeuvre', montantHtCentimes: 300_000 },
            { nature: 'travaux', montantHtCentimes: 1_000_000 },
            { nature: 'etudes_techniques', montantHtCentimes: 100_000 },
            { nature: 'etudes_techniques', montantHtCentimes: 300_000 },
          ],
        },
      ],
      { nbLots: 10 },
    ).lignes
    expect(plusieurs.detail).toContain(`(exclus : ${eur(400_000)} d'études techniques, ${eur(300_000)} d'honoraires de maître d'œuvre)`)
  })

  it('J55 : une décision sans résolution ni référence au registre, ou mal datée, est refusée au compte provisoire', () => {
    const depenses = [{ nature: 'travaux' as const, montantHtCentimes: 1_000_000 }]
    for (const decision of [
      { date: '2026-03-10', resolution: '  ' },
      { date: '10/03/2026', resolution: 'Résolution 4' },
    ])
      expect(() => compteProvisoireDroitsProportionnelsTravaux([{ numero: 'T-7', decision, depenses }], { nbLots: 10 })).toThrow(
        "Opération T-7 : décision incomplète (assemblée ou administrateur provisoire) : date (AAAA-MM-JJ) et résolution ou référence au registre attendues ; elle n'entre pas au compte provisoire.",
      )
  })
})

// ─── J56 ────────────────────────────────────────────────────────────────────────────────────────

describe('J56 — N° de l’OS attribué au premier envoi : <mandat>.<AAAAMMJJ>.<rang>, rang sans zéros, séquence par mandat', () => {
  /** Mandat 125 : N° déjà attribués (dont un repris de Gestéam, plan « 3 ») ; plus grand rang : 6. */
  const numerotee = (id: string, numero: string) => demande({ id, numero })
  const DU_MANDAT = [numerotee('dem-a', '125.20261001.6'), numerotee('dem-b', '125.3.2'), numerotee('dem-c', '13.20261001.40')]

  it('segment plan : la date du premier envoi au format AAAAMMJJ', () => {
    expect(segmentPlanOs('2026-11-17')).toBe('20261117')
    expect(segmentPlanOs('2027-01-05')).toBe('20270105')
    expect(() => segmentPlanOs('17/11/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('attribué au premier envoi : 125.20261117.7 (rang suivant du mandat, toutes dates confondues, sans zéros)', () => {
    const sansNumero = demande({ id: 'dem-2', numero: null })
    const n = numeroterAuPremierEnvoi(sansNumero, sortie(sansNumero), [...DU_MANDAT, sansNumero], { mandat: '125', premierEnvoiLe: '2026-11-17' })
    expect(n.numero).toBe('125.20261117.7')
    expect(sansNumero.numero).toBeNull()
    expect(lireNumeroOs(n.numero)).toEqual({ mandat: '125', plan: '20261117', rang: 7 })
    // rang sans zéros, quel que soit son ordre de grandeur
    expect(formaterNumeroOs({ mandat: '125', plan: '20261117', rang: 7 })).toBe('125.20261117.7')
    expect(rangOsSuivant(['125.20261117.9', null], '125')).toBe(10)
  })

  it('une demande abandonnée avant l’envoi ne consomme pas de numéro : seuls les N° attribués comptent', () => {
    const abandonnee: Demande = { ...demande({ id: 'dem-abandon', numero: null }), statut: 'Terminé' }
    const sansNumero = demande({ id: 'dem-2', numero: null })
    const n = numeroterAuPremierEnvoi(sansNumero, sortie(sansNumero), [...DU_MANDAT, abandonnee, sansNumero], { mandat: '125', premierEnvoiLe: '2026-11-17' })
    expect(n.numero).toBe('125.20261117.7')
  })

  it('refus : N° déjà attribué (figé), OS déjà envoyé, date du premier envoi invalide ou antérieure à la demande, mandat absent ou étranger', () => {
    const sansNumero = demande({ id: 'dem-2', numero: null })
    const attribution = { mandat: '125', premierEnvoiLe: '2026-11-17' }
    expect(() => numeroterAuPremierEnvoi(DU_MANDAT[0], sortie(DU_MANDAT[0]), DU_MANDAT, attribution)).toThrow(/figé/)
    const envoyee = envoyerOs(DU_MANDAT[0], sortie(DU_MANDAT[0]), ENVOI, CONTEXTE)
    expect(() => numeroterAuPremierEnvoi({ ...sansNumero, id: 'dem-a' }, envoyee, DU_MANDAT, attribution)).toThrow(/premier envoi/)
    expect(() => numeroterAuPremierEnvoi(sansNumero, sortie(sansNumero), DU_MANDAT, { ...attribution, premierEnvoiLe: '17/11/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => numeroterAuPremierEnvoi(sansNumero, sortie(sansNumero), DU_MANDAT, { ...attribution, premierEnvoiLe: '2026-09-30' })).toThrow(/antérieur à la demande/)
    expect(() => numeroterAuPremierEnvoi({ ...sansNumero, mandatId: null }, sortie(sansNumero), [], attribution)).toThrow(/mandat/)
    const autreMandat = demande({ id: 'dem-3', mandatId: 'mandat-2' })
    expect(() => numeroterAuPremierEnvoi(sansNumero, sortie(sansNumero), [autreMandat], attribution)).toThrow(/autre mandat/)
    expect(() => numeroterAuPremierEnvoi(sansNumero, sortie(demande()), DU_MANDAT, attribution)).toThrow(/autre demande/)
  })

  it('envoi : l’OS numéroté au premier envoi part ; sans N°, le contrôle dit qu’il s’attribue au premier envoi', () => {
    const sansNumero = demande({ id: 'dem-2', numero: null })
    const s = sortie(sansNumero)
    const n = numeroterAuPremierEnvoi(sansNumero, s, [...DU_MANDAT, sansNumero], { mandat: '125', premierEnvoiLe: ENVOI.date })
    expect(envoyerOs(n, s, ENVOI, { ...CONTEXTE, segmentMandat: '125', numerosDuMandat: DU_MANDAT }).journal).toHaveLength(1)
    const [absent] = controlerAvantEnvoiOs(sansNumero, s, CONTEXTE)
    expect([absent.code, absent.gravite]).toEqual(['numero_absent', 'bloquant'])
    expect(absent.message).toBe(
      "N° d'ordre de service absent : il s'attribue au premier envoi, dans la séquence du mandat (rang suivant du mandat ; segment plan : date de l'envoi, AAAAMMJJ ; décision de Hugo du 17/11/2026, J56).",
    )
  })

  it('en-tête : J56 citée ; segment plan, moment d’attribution, zéros et liste Signature ne sont plus des questions ouvertes', () => {
    const { texte } = enTeteDuModule('envoi-ordre-service')
    expect(texte).toContain('Décisions de Hugo du 17/11/2026')
    expect(texte).toContain('J56')
    expect(texte).toContain('signatairesHabilites')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    for (const fermee of ['sens du segment <plan>', 'N° attribué à la création de la demande, ou', 'rang complété de zéros', 'valeurs de la liste Signature'])
      expect(questions, fermee).not.toContain(fermee)
  })
})
