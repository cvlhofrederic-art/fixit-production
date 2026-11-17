import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fusionnerCoproMandat, type CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { creerDemande, modeleDeNature, type Demande } from '@/lib/administrateur-judiciaire/domain/demandes'
import { filtrerObligationsEnCours, listerEcheancesPortefeuille } from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import { construireFiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import { nouvelleFicheEntreprise } from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'
import { comprendreDemandeFixy } from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import { repondreDemandeFixy, type DonneesFixy } from '@/lib/administrateur-judiciaire/domain/fixy/reponses'
import { calculerVeilleFixy } from '@/lib/administrateur-judiciaire/domain/fixy/veille'
import { creerElement, type SaisieElement } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { tableauDesHonoraires } from '@/lib/administrateur-judiciaire/domain/honoraires-tableau'
import { construireIndexRecherche } from '@/lib/administrateur-judiciaire/domain/recherche'
import {
  chargesEntreprises,
  controlerPlafondAvantAttribution,
  type EntrepriseRelance,
} from '@/lib/administrateur-judiciaire/domain/relance-demandes'
import {
  bilanStatutsMandats,
  demandesDesMandatsSuivis,
  estMandatSuivi,
  filtrerMandatsSuivis,
  lireStatutMandat,
  mandatHorsSuivi,
  STATUTS_EN_CLOTURE,
  STATUTS_HORS_SUIVI,
} from '@/lib/administrateur-judiciaire/domain/statut-mandat'
import {
  balanceAgee,
  depuisDemandes,
  portefeuille,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type DossierOuvert,
  type ElementAFaire,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import { STATUT_MANDAT } from '@/lib/data/referentiels-gesteam-judiciaire'
import { enTeteDuModule } from './en-tete-module'

/**
 * Point 55 du bilan 2 — statut du mandat (cartographie Gestéam, tranches 18, 24, 41 et 43 § 9) : lecture typée de la valeur
 * libre `Mandat.statut` sur STATUT_MANDAT ; Prospect et Archivé sortent du portefeuille, du suivi « à faire » et de la
 * balance âgée ; « En clôture » reste visible ; une valeur inconnue est signalée, jamais rejetée en silence.
 */

const AUJOURDHUI = '2026-11-03' // mardi

const affectation = (mandatId: string, statut: string | null | undefined, surcharge: Partial<AffectationMandat> = {}): AffectationMandat => ({
  mandatId,
  cabinetId: 'C1',
  responsableId: 'u1',
  comptableId: null,
  assistantId: null,
  statut,
  ...surcharge,
})

const affectations: AffectationMandat[] = [
  affectation('M-gestion', 'En gestion'),
  affectation('M-cloture', 'En clôture'),
  affectation('M-composite', 'En gestion, en clôture'),
  affectation('M-archive', 'Archivé'),
  affectation('M-prospect', 'Prospect'),
  affectation('M-maquette', 'En cours'),
  affectation('M-sans', undefined),
]

const element = (id: string, mandatId: string | null, surcharge: Partial<ElementAFaire> = {}): ElementAFaire => ({
  id: `contrats:${id}`,
  famille: 'contrats',
  nature: 'limite_resiliation',
  libelle: id,
  date: AUJOURDHUI,
  mandatId,
  objetId: id,
  assigneId: null,
  aConfirmer: false,
  ...surcharge,
})

const MODELE_DEVIS = modeleDeNature('Demande devis Copro')
if (!MODELE_DEVIS) throw new Error('Modèle « Demande devis Copro » absent du référentiel')
const devis = (id: string, mandatId: string | null, demandeLe: string): Demande =>
  creerDemande({ id, coproprieteId: 'copro-1', mandatId, prestataireId: 'ent-1', demandeLe, objet: 'Recherche de fuite' }, MODELE_DEVIS)

/** Entreprise ent-1 — devis : relance à 8 jours, maximum 3 demandes en cours, alerte au-delà du seuil donné. */
const entreprisesDevis = (alerteAuDela: number): EntrepriseRelance[] => [
  {
    id: 'ent-1',
    fiche: nouvelleFicheEntreprise({
      relances: {
        devis: { delaiRelanceJours: 8, maxDemandesEnCours: 3, alerteAuDela },
        interventions: { delaiRelanceJours: 3, maxDemandesEnCours: 10, alerteAuDela: 8 },
      },
    }),
  },
]

describe('lireStatutMandat — valeur libre lue sur STATUT_MANDAT', () => {
  it('reconnaît les cinq valeurs du référentiel ; Prospect et Archivé sont hors suivi', () => {
    expect(STATUT_MANDAT.map((valeur) => lireStatutMandat(valeur))).toEqual([
      { etat: 'connu', statut: 'Prospect', suivi: false, enCloture: false },
      { etat: 'connu', statut: 'En gestion', suivi: true, enCloture: false },
      { etat: 'connu', statut: 'En clôture', suivi: true, enCloture: true },
      { etat: 'connu', statut: 'En gestion, en clôture', suivi: true, enCloture: true },
      { etat: 'connu', statut: 'Archivé', suivi: false, enCloture: false },
    ])
    expect([...STATUTS_HORS_SUIVI].sort()).toEqual(['Archivé', 'Prospect'])
    expect([...STATUTS_EN_CLOTURE].sort()).toEqual(['En clôture', 'En gestion, en clôture'])
  })

  it('la 5e valeur « En gestion, en clôture » reste connue, suivie, lue comme une clôture en cours, sans conversion', () => {
    const lecture = lireStatutMandat('En gestion, en clôture')
    expect(lecture).toMatchObject({ etat: 'connu', statut: 'En gestion, en clôture', suivi: true, enCloture: true })
  })

  it('normalise seulement les espaces superflus et la forme Unicode', () => {
    expect(lireStatutMandat('  Archivé ')).toMatchObject({ etat: 'connu', statut: 'Archivé', suivi: false })
    expect(lireStatutMandat('En  gestion,\ten clôture')).toMatchObject({ etat: 'connu', statut: 'En gestion, en clôture' })
    expect(lireStatutMandat('Archivé')).toMatchObject({ etat: 'connu', statut: 'Archivé' })
  })

  it('une valeur hors référentiel est inconnue mais suivie : aucune correspondance devinée', () => {
    for (const valeur of ['En cours', 'Échéance proche', 'Prorogation demandée', 'Notification en cours', 'archivé', 'Archive', ''])
      expect(lireStatutMandat(valeur)).toEqual({ etat: 'inconnu', valeur, suivi: true, enCloture: false })
  })

  it('un statut non transmis est absent et suivi', () => {
    expect(lireStatutMandat(null)).toEqual({ etat: 'absent', suivi: true, enCloture: false })
    expect(lireStatutMandat(undefined)).toEqual({ etat: 'absent', suivi: true, enCloture: false })
  })
})

describe('bilanStatutsMandats — mandats hors suivi, en clôture, anomalies', () => {
  it('range chaque mandat ; la valeur inconnue est signalée et le mandat reste suivi', () => {
    const bilan = bilanStatutsMandats(affectations)
    expect([...bilan.horsSuivi].sort()).toEqual(['M-archive', 'M-prospect'])
    expect([...bilan.enCloture].sort()).toEqual(['M-cloture', 'M-composite'])
    expect(bilan.anomalies).toHaveLength(1)
    expect(bilan.anomalies[0]).toMatchObject({ mandatId: 'M-maquette', motif: 'valeur_inconnue', valeurs: ['En cours'] })
    expect(bilan.anomalies[0].message).toMatch(/« En cours » hors du référentiel/)
    expect(bilan.anomalies[0].message).toMatch(/gardé au suivi/)
  })

  it('signale une valeur vide', () => {
    expect(bilanStatutsMandats([{ mandatId: 'M', statut: ' ' }]).anomalies).toEqual([
      expect.objectContaining({ mandatId: 'M', motif: 'valeur_inconnue', valeurs: [''] }),
    ])
  })

  it('deux statuts différents pour un même mandat : anomalie, mandat gardé au suivi', () => {
    const bilan = bilanStatutsMandats([
      { mandatId: 'M', statut: 'Archivé' },
      { mandatId: 'M', statut: 'En gestion' },
      { mandatId: 'M', statut: 'Archivé ' },
    ])
    expect(bilan.horsSuivi.size).toBe(0)
    expect(bilan.anomalies).toEqual([
      expect.objectContaining({ mandatId: 'M', motif: 'statuts_contradictoires', valeurs: ['Archivé', 'En gestion'] }),
    ])
  })

  it('le même statut répété, ou un statut absent à côté, ne fait pas d’anomalie', () => {
    const bilan = bilanStatutsMandats([
      { mandatId: 'M', statut: 'Archivé' },
      { mandatId: 'M', statut: ' Archivé' },
      { mandatId: 'M' },
    ])
    expect([...bilan.horsSuivi]).toEqual(['M'])
    expect(bilan.anomalies).toEqual([])
  })
})

describe('filtrerMandatsSuivis — filtre exposé pour l’écran du portefeuille', () => {
  it('écarte Prospect et Archivé, garde En clôture et les valeurs inconnues, rend les anomalies', () => {
    const mandats = [
      { id: 'A', statut: 'En gestion' },
      { id: 'B', statut: 'Archivé' },
      { id: 'C', statut: 'En clôture' },
      { id: 'D', statut: 'Prospect' },
      { id: 'E', statut: 'Échéance proche' },
    ]
    const { suivis, horsSuivi, anomalies } = filtrerMandatsSuivis(mandats)
    expect(suivis.map((m) => m.id)).toEqual(['A', 'C', 'E'])
    expect(horsSuivi.map((m) => m.id)).toEqual(['B', 'D'])
    expect(anomalies.map((a) => a.mandatId)).toEqual(['E'])
  })
})

describe('portefeuille — borne du statut', () => {
  it('sans les mandats Prospect ni Archivé ; En clôture, valeur inconnue et statut absent y restent', () => {
    expect([...portefeuille('u1', affectations)].sort()).toEqual(['M-cloture', 'M-composite', 'M-gestion', 'M-maquette', 'M-sans'])
  })

  it('portée « tous » : quel que soit le statut', () => {
    expect(portefeuille('u1', affectations, ['responsable'], 'tous').size).toBe(affectations.length)
  })
})

describe('selectionnerAFaire — un mandat archivé ne produit plus d’« à faire »', () => {
  const elements = affectations.map((a) => element(a.mandatId, a.mandatId))

  it('portefeuille : les éléments des mandats Prospect et Archivé ne remontent pas', () => {
    const retenus = selectionnerAFaire(elements, reglageParDefaut('u1'), affectations, AUJOURDHUI)
    expect(retenus.map((e) => e.mandatId).sort()).toEqual(['M-cloture', 'M-composite', 'M-gestion', 'M-maquette', 'M-sans'])
  })

  it('ni sur tout le cabinet, ni désignés au collaborateur ; un élément du cabinet (sans mandat) reste', () => {
    const reglage = reglageParDefaut('u9')
    reglage.familles.contrats = { actif: true, perimetre: 'cabinet', horizon: { unite: 'maintenant' }, natures: null }
    const designes = [
      element('archive-designe', 'M-archive', { assigneId: 'u9' }),
      element('prospect-designe', 'M-prospect', { assigneId: 'u9' }),
      element('cabinet', null),
    ]
    expect(selectionnerAFaire([...elements, ...designes], reglage, affectations, AUJOURDHUI).map((e) => e.id)).toEqual([
      'contrats:cabinet',
      'contrats:M-cloture',
      'contrats:M-composite',
      'contrats:M-gestion',
      'contrats:M-maquette',
      'contrats:M-sans',
    ])
  })

  it('les affectations sans statut gardent le comportement antérieur', () => {
    const sansStatut = affectations.map((a) => ({ ...a, statut: undefined }))
    expect(selectionnerAFaire(elements, reglageParDefaut('u1'), sansStatut, AUJOURDHUI)).toHaveLength(elements.length)
  })
})

describe('balanceAgee — borne du statut', () => {
  const dossier = (id: string, mandatId: string | null, closLe: string | null = null): DossierOuvert => ({
    id,
    mandatId,
    ouvertLe: '2026-10-20',
    closLe,
    responsableFicheId: null,
  })

  it('les dossiers des mandats Prospect et Archivé ne sont pas comptés, même clos ; En clôture l’est', () => {
    const dossiers = [
      dossier('d-gestion', 'M-gestion'),
      dossier('d-cloture', 'M-cloture'),
      dossier('d-archive', 'M-archive'),
      dossier('d-archive-clos', 'M-archive', '2026-10-25'),
      dossier('d-prospect', 'M-prospect'),
      dossier('d-cabinet', null),
    ]
    const balance = balanceAgee(dossiers, affectations, { rattachement: 'responsable', periodicite: 'mensuelle', dateReference: AUJOURDHUI })
    expect(balance.total).toEqual({ tous: 3, enCours: 3, tranches: [3, 0, 0, 0] })
    expect(balance.lignes).toEqual([
      { cabinetId: 'C1', collaborateurId: 'u1', tous: 2, enCours: 2, tranches: [2, 0, 0, 0] },
      { cabinetId: null, collaborateurId: null, tous: 1, enCours: 1, tranches: [1, 0, 0, 0] },
    ])
  })

  it('les dates d’un dossier écarté restent contrôlées', () => {
    expect(() =>
      balanceAgee([dossier('d-archive', 'M-archive', '2026-10-01')], affectations, {
        rattachement: 'responsable',
        periodicite: 'mensuelle',
        dateReference: AUJOURDHUI,
      }),
    ).toThrow(/antérieure à l'ouverture/)
  })
})

describe('depuisDemandes — la demande d’un mandat Prospect ou Archivé ne relance plus et ne compte plus au plafond', () => {
  /** Devis : relance à 8 jours, maximum 3 demandes en cours, alerte au-delà de 1. */
  const ENTREPRISES = entreprisesDevis(1)
  const items = [
    { demande: devis('dev-gestion', 'M-gestion', '2026-10-01') },
    { demande: devis('dev-archive', 'M-archive', '2026-10-05') },
    { demande: devis('dev-prospect', 'M-prospect', '2026-10-06') },
  ]
  const ids = (elements: ElementAFaire[]) => elements.map((e) => e.id)

  it('sans les statuts des mandats : comportement antérieur (trois relances, maximum atteint)', () => {
    expect(ids(depuisDemandes(items, ENTREPRISES, AUJOURDHUI))).toEqual([
      'demandes:devis_a_relancer:dev-gestion',
      'demandes:devis_a_relancer:dev-archive',
      'demandes:devis_a_relancer:dev-prospect',
      'demandes:plafond_demandes:ent-1:Copropriété:devis',
    ])
  })

  it('avec les statuts : seule la demande suivie reste, sous le seuil d’alerte de l’entreprise', () => {
    expect(ids(depuisDemandes(items, ENTREPRISES, AUJOURDHUI, affectations))).toEqual(['demandes:devis_a_relancer:dev-gestion'])
  })

  it('les demandes d’un mandat en clôture ou au statut inconnu comptent toujours', () => {
    const suivis = [
      ...items,
      { demande: devis('dev-cloture', 'M-cloture', '2026-10-07') },
      { demande: devis('dev-maquette', 'M-maquette', '2026-10-08') },
    ]
    const plafond = depuisDemandes(suivis, ENTREPRISES, AUJOURDHUI, affectations).find((e) => e.nature === 'plafond_demandes')
    expect(plafond).toMatchObject({ mandatId: null, date: '2026-10-08' })
    expect(plafond?.libelle).toMatch(/3 demandes de devis en cours, maximum de 3 atteint/)
  })
})

describe('tableau des honoraires — inchangé par le statut (portée « tous »)', () => {
  it('le filtre Collaborateur garde les honoraires d’un mandat archivé', () => {
    const saisie: SaisieElement = {
      id: 'el-archive',
      coproprieteId: 'copro',
      mandatId: 'M-archive',
      date: '2026-10-05',
      dossier: 'Gestion',
      nature: 'Honoraires',
      tarif: 'Gestion - HONORAIRES',
      calcul: 'Coût unitaire',
      quantite: 1,
      prixUnitaireHtDixMilliemes: 450_000,
      soumisTva: true,
      tauxTvaPct: 20,
      destinataire: 'Syndicat des copropriétaires',
    }
    const tableau = tableauDesHonoraires([creerElement(saisie)], affectations, {
      du: '2026-10-01',
      au: '2026-10-31',
      regroupement: 'Mandat',
      collaborateurId: 'u1',
    })
    expect(tableau.lignes.map((l) => l.cle)).toEqual(['M-archive'])
  })
})

describe('en-tête du module', () => {
  const { texte, item } = enTeteDuModule('statut-mandat')

  it('cite ses sources Gestéam et le relevé du droit', () => {
    expect(texte).toMatch(/Tranche 18 § 2 et tranche 24 § 1/)
    expect(texte).toMatch(/Tranche 41/)
    expect(texte).toMatch(/Tranche 43 § 9/)
    expect(texte).toMatch(/tranche 27 \(recherche des exercices/)
    expect(texte).toMatch(/Tranche 38/)
    expect(texte).toMatch(/AUCUN TEXTE ne définit un statut du mandat/)
    expect(texte).toMatch(/D\. 1967 art\. 62-11/)
    expect(texte).toMatch(/D\. 1967 art\. 33-1/)
  })

  it('situe « En clôture » régime par régime : art. 62-11 et 61-1-5 pour le seul ap291, art. 18-2 pour le syndic désigné par le juge', () => {
    // L'art. 33 (archives de la mission ordinaire) n'est plus cité comme diligence de fin de mission.
    expect(texte).not.toMatch(/D\. 1967 art\. 33\)/)
    const ap291 = item("« En clôture », administrateur provisoire de l'art. 29-1 (régime ap291)")
    expect(ap291).toMatch(/D\. 1967 art\. 62-11, I, al\. 2/)
    expect(ap291).toMatch(/art\. 61-1-5, III/)
    expect(ap291).toMatch(/Ces textes ne visent que l'administrateur provisoire de l'art\. 29-1/)
    const sj = item('« En clôture », syndic désigné par le président du tribunal judiciaire (régime sj)')
    expect(sj).toMatch(/D\. 1967 art\. 46, al\. 3/)
    expect(sj).toMatch(/quinze jours, les documents et archives du syndicat dans le mois \(L\. 1965 art\. 18-2, al\. 1\)/)
    expect(sj).toMatch(/bordereau récapitulatif .*\(D\. 1967 art\. 33-1\)/)
    expect(sj).toMatch(/après apurement et clôture, dans les deux mois .*\(L\. 1965 art\. 18-2, al\. 2/)
    const ap47 = item("« En clôture », administrateur provisoire de l'art. 47 (régime ap47)")
    expect(ap47).toMatch(/D\. 1967 art\. 47, al\. 2/)
    expect(ap47).toMatch(/aucun texte lu ne lui impose de diligence de sortie/)
    expect(ap47).toMatch(/l'art\. 62-6, .* joue à l'ENTRÉE de sa mission/)
    expect(item('Hugo : quand un mandat passe-t-il')).toMatch(
      /Seul repère légal daté, pour le syndic désigné par le juge : les délais de remise de l'art\. 18-2 \(quinze jours, un mois, puis deux mois suivants/,
    )
  })

  it('écrit les branchements : faits dans le domaine, restés sur tous les mandats, à brancher', () => {
    expect(item('Faits dans le domaine')).toMatch(
      /listerEcheancesPortefeuille .*Cockpit, Calendrier réglementaire et Obligations & échéances .*calculerVeilleFixy/,
    )
    expect(item('Restent sur tous les mandats')).toMatch(/recherche\.ts, portée « tous ».*calculerEcheancesCopropriete.*honoraires-tableau\.ts/)
    expect(item('À brancher, écrans')).toMatch(/PortefeuilleMandatsModule et ChargeCollaborateursModule .*filtrerMandatsSuivis/)
    expect(item('À brancher, relance-demandes.ts')).toMatch(
      /controlerPlafondAvantAttribution, de chargesEntreprises .*demandesDesMandatsSuivis\(items, statuts\)/,
    )
  })

  it('cite la réponse de Fixy à une demande libre : bornée sans copropriété citée, sur tous les statuts pour une copropriété citée', () => {
    expect(item('Faits dans le domaine')).toMatch(
      /repondreDemandeFixy \(fixy\/reponses\.ts\), sans copropriété citée : échéances et débiteurs du portefeuille/,
    )
    expect(item('Restent sur tous les mandats')).toMatch(/la réponse de Fixy sur une copropriété citée/)
  })

  it('pose les questions ouvertes à Hugo et Frédéric', () => {
    expect(item('Hugo : « En gestion, en clôture »')).toMatch(/\?/)
    expect(item('Frédéric et Hugo : `Mandat.statut`')).toMatch(/\?/)
    expect(item('Hugo : quand un mandat passe-t-il')).toMatch(/\?/)
    expect(item('Hugo : un mandat judiciaire peut-il être « Prospect »')).toMatch(/\?/)
    expect(item('Hugo : une balance âgée datée du passé')).toMatch(/\?/)
    expect(item("Hugo : faut-il refuser d'archiver")).toMatch(/\?/)
    expect(texte).toMatch(/L\. 1965 art\. 29-1, IV/)
  })
})

describe('estMandatSuivi et mandatHorsSuivi — prédicats partagés', () => {
  it('Prospect et Archivé ne sont pas suivis ; En clôture, valeur inconnue ou absente le sont', () => {
    expect(['Prospect', 'Archivé', ' Archivé '].map(estMandatSuivi)).toEqual([false, false, false])
    expect(['En clôture', 'En gestion, en clôture', 'En gestion', 'En cours', '', null, undefined].map(estMandatSuivi)).toEqual(
      Array(7).fill(true),
    )
  })

  it('un élément sans mandat n’est jamais hors suivi', () => {
    const horsSuivi = new Set(['M-archive'])
    expect([mandatHorsSuivi('M-archive', horsSuivi), mandatHorsSuivi('M-gestion', horsSuivi), mandatHorsSuivi(null, horsSuivi)]).toEqual([
      true,
      false,
      false,
    ])
  })
})

describe('échéances du portefeuille et veille de Fixy — un mandat archivé ne produit plus d’« à faire »', () => {
  /** Administrateur provisoire de l'art. 47, ordonnance du 01/09/2026, notification non faite. */
  const vue = (code: string, statut: string): CoproprieteVue =>
    fusionnerCoproMandat(
      {
        id: `copro-${code}`,
        code,
        nom: `Copropriété ${code}`,
        adresse: '',
        nbLots: 10,
        budget: 0,
        depense: 0,
        impayes: 0,
        fondsTravaux: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: `M-${code}`,
        fondement: 'Administrateur provisoire (art. 47)',
        ordonnance: new Date(2026, 8, 1),
        dureeMois: 12,
        echeance: new Date(2027, 8, 1),
        statut,
        notifOrdonnance: 'À faire',
      },
    )
  const vues = [vue('ZAR', 'Archivé'), vue('ZPR', 'Prospect'), vue('ZEC', 'En clôture'), vue('ZEG', 'En gestion'), vue('ZMQ', 'En cours')]
  const codes = (items: { copro: { code: string } }[]) => [...new Set(items.map((i) => i.copro.code))].sort()

  it('listerEcheancesPortefeuille (Cockpit, Calendrier réglementaire) écarte Prospect et Archivé ; En clôture et la valeur inconnue restent', () => {
    expect(codes(listerEcheancesPortefeuille(vues))).toEqual(['ZEC', 'ZEG', 'ZMQ'])
    expect(codes(listerEcheancesPortefeuille(vues, 'tous'))).toEqual(['ZAR', 'ZEC', 'ZEG', 'ZMQ', 'ZPR'])
  })

  it('les obligations en cours (écran Obligations & échéances) suivent la même borne', () => {
    expect(codes(filtrerObligationsEnCours(listerEcheancesPortefeuille(vues)))).toEqual(['ZEC', 'ZEG', 'ZMQ'])
  })

  it('la recherche globale, qui n’est pas une liste d’« à faire », garde les échéances d’un mandat archivé', () => {
    const index = construireIndexRecherche({ copros: vues, coproprietaires: [], lots: [], prestataires: [] })
    const echeances = new Set(index.filter((e) => e.type === 'echeance').map((e) => e.selection?.code))
    expect([...echeances].sort()).toEqual(['ZAR', 'ZEC', 'ZEG', 'ZMQ', 'ZPR'])
  })

  it('la veille de Fixy ne donne aucun rappel pour un mandat Prospect ou Archivé ; En clôture en donne', () => {
    const donnees = { lots: [], coproprietaires: [], echeances: [], contrats: [], sinistres: [], prestataires: [] }
    const fiches = vues.map((v) => construireFiche360Copropriete(v, donnees, AUJOURDHUI))
    const rappels = calculerVeilleFixy({ reference: AUJOURDHUI, fiches, impayes: [], piecesRecues: [], nbPieces: 0 })
    expect(rappels.map((r) => r.id)).toContain('notif:ZEC')
    expect([...new Set(rappels.map((r) => r.id.split(':')[1]))].sort()).toEqual(['ZEC', 'ZEG', 'ZMQ'])
  })

  describe('réponse de Fixy à une demande libre — le portefeuille sans Prospect ni Archivé, une copropriété citée sur tous les statuts', () => {
    /** Un copropriétaire débiteur par copropriété (données fictives). */
    const donneesFiche = {
      lots: vues.map((v) => ({ id: `lot-${v.code}`, coproprieteId: v.id, numero: '1' })),
      coproprietaires: vues.map((v) => ({ id: `p-${v.code}`, lotId: `lot-${v.code}`, nom: `Débiteur ${v.code}`, solde: -100, statut: 'Impayé' })),
      echeances: [],
      contrats: [],
      sinistres: [],
      prestataires: [],
    }
    const fiches = new Map(vues.map((v) => [v.code, construireFiche360Copropriete(v, donneesFiche, AUJOURDHUI)]))
    const donnees: DonneesFixy = {
      reference: AUJOURDHUI,
      ficheCopro: (code) => fiches.get(code) ?? null,
      fichePersonne: () => null,
      copros: vues.map((v) => ({ code: v.code, nom: v.nom })),
      ordresDeService: [],
      impayes: [],
    }
    const index = construireIndexRecherche({ copros: vues, coproprietaires: [], lots: [], prestataires: [] })
    const demander = (texte: string, d: DonneesFixy = donnees) => {
      const intention = comprendreDemandeFixy(texte, index)
      return { intention, reponse: repondreDemandeFixy(intention, d) }
    }
    const coprosCitees = (lignes: string[]) =>
      [...new Set(lignes.map((l) => /^Copropriété (Z[A-Z]{2}) · /.exec(l)?.[1]).filter((code) => code !== undefined))].sort()
    const NOTE_HORS_SUIVI =
      "2 copropriétés hors suivi (mandat Prospect ou Archivé) ne sont pas comptées ; cite la copropriété pour l'interroger."

    it.each(['Qu’est-ce que j’ai à faire ?', 'Quelles échéances sont en retard ?'])(
      '« %s » : aucune échéance d’un mandat Prospect ou Archivé ; En clôture et la valeur inconnue restent ; les mandats écartés sont dits',
      (texte) => {
        const { intention, reponse } = demander(texte)
        expect([intention.type, intention.cible]).toEqual(['echeances', null])
        expect(reponse.titre).toBe('Échéances légales au 03/11/2026')
        expect(coprosCitees(reponse.lignes)).toEqual(['ZEC', 'ZEG', 'ZMQ'])
        expect(reponse.lignes.some((l) => /ZAR|ZPR/.test(l))).toBe(false)
        expect(reponse.lignes.at(-1)).toBe(NOTE_HORS_SUIVI)
        expect(reponse.actions.map((a) => a.id)).toEqual(['nav:cockpit:'])
      },
    )

    it('les débiteurs du portefeuille suivent la même borne que la balance âgée', () => {
      const { intention, reponse } = demander('Qui sont les débiteurs ?')
      expect([intention.type, intention.cible]).toEqual(['debiteurs', null])
      expect(reponse.titre).toMatch(/^3 débiteurs · /)
      expect(coprosCitees(reponse.lignes)).toEqual(['ZEC', 'ZEG', 'ZMQ'])
      expect(reponse.lignes.at(-1)).toBe(NOTE_HORS_SUIVI)
    })

    it('une copropriété citée reste interrogeable quel que soit son statut, sans note', () => {
      const echeances = demander('Échéances de la copropriété ZAR ?')
      expect(echeances.intention.cible?.selection?.code).toBe('ZAR')
      expect(coprosCitees(echeances.reponse.lignes)).toEqual(['ZAR'])
      expect(echeances.reponse.lignes.some((l) => l.includes('hors suivi'))).toBe(false)
      const debiteurs = demander('Débiteurs de la copropriété ZPR ?')
      expect(debiteurs.reponse.titre).toMatch(/^1 débiteur · /)
      expect(coprosCitees(debiteurs.reponse.lignes)).toEqual(['ZPR'])
      expect(debiteurs.reponse.lignes.some((l) => l.includes('hors suivi'))).toBe(false)
    })

    it('un portefeuille sans mandat suivi : aucune échéance, et la note le dit', () => {
      const seuls: DonneesFixy = { ...donnees, copros: donnees.copros.filter((c) => c.code === 'ZAR' || c.code === 'ZPR') }
      expect(demander('Qu’est-ce que j’ai à faire ?', seuls).reponse.lignes).toEqual(['Aucune échéance datée en cours.', NOTE_HORS_SUIVI])
      expect(demander('Qui sont les débiteurs ?', seuls).reponse.lignes).toEqual(['Aucun débiteur enregistré.', NOTE_HORS_SUIVI])
    })

    it('sans mandat écarté, la réponse ne porte aucune note', () => {
      const suivis: DonneesFixy = { ...donnees, copros: donnees.copros.filter((c) => c.code !== 'ZAR' && c.code !== 'ZPR') }
      const { reponse } = demander('Qu’est-ce que j’ai à faire ?', suivis)
      expect(reponse.lignes.some((l) => l.includes('hors suivi'))).toBe(false)
      expect(coprosCitees(reponse.lignes)).toEqual(['ZEC', 'ZEG', 'ZMQ'])
    })
  })
})

describe('plafond des demandes — même compte au suivi et à l’attribution (demandesDesMandatsSuivis)', () => {
  /** Devis : maximum 3 demandes en cours, alerte au-delà de 2. */
  const ENTREPRISES = entreprisesDevis(2)
  const statuts = [
    { mandatId: 'M-a', statut: 'Archivé' },
    { mandatId: 'M-g', statut: 'En gestion' },
  ]
  // Deux demandes ouvertes sur un mandat archivé, une sur un mandat en gestion.
  const items = [
    { demande: devis('d1', 'M-a', '2026-10-01') },
    { demande: devis('d2', 'M-a', '2026-10-02') },
    { demande: devis('d3', 'M-g', '2026-10-03') },
  ]
  const nouvelle = { demande: devis('d4', 'M-g', AUJOURDHUI) }

  it('le suivi et le contrôle avant attribution donnent le même compte une fois le filtre appliqué', () => {
    const suivies = demandesDesMandatsSuivis(items, statuts)
    expect(suivies.map((i) => i.demande.id)).toEqual(['d3'])
    expect(depuisDemandes(items, ENTREPRISES, AUJOURDHUI, statuts).some((e) => e.nature === 'plafond_demandes')).toBe(false)
    expect(chargesEntreprises(suivies, ENTREPRISES, AUJOURDHUI)).toEqual([expect.objectContaining({ enCours: 1, niveau: 'normal' })])
    expect(controlerPlafondAvantAttribution(nouvelle, suivies, ENTREPRISES, AUJOURDHUI)).toEqual([])
    // Sans le filtre, l'attribution compterait les deux demandes du mandat archivé (4 avec la nouvelle).
    expect(controlerPlafondAvantAttribution(nouvelle, items, ENTREPRISES, AUJOURDHUI).map((a) => a.code)).toEqual(['maximum_depasse'])
  })

  it('depuisDemandes applique exactement ce filtre', () => {
    expect(depuisDemandes(items, ENTREPRISES, AUJOURDHUI, statuts)).toEqual(
      depuisDemandes(demandesDesMandatsSuivis(items, statuts), ENTREPRISES, AUJOURDHUI),
    )
  })

  it('une demande sans mandat reste ; sans statut transmis, rien n’est écarté', () => {
    const avecCabinet = [...items, { demande: devis('d5', null, '2026-10-04') }]
    expect(demandesDesMandatsSuivis(avecCabinet, statuts).map((i) => i.demande.id)).toEqual(['d3', 'd5'])
    expect(demandesDesMandatsSuivis(items, [])).toEqual(items)
  })
})

describe('tableau des honoraires — question 🔴 du statut du mandat dans l’en-tête', () => {
  const { item } = enTeteDuModule('honoraires-tableau')

  it('la question est dans l’en-tête, adressée à Frédéric comme « Pas de mandat exclu », avec le choix codé', () => {
    const question = item('🔴 (Frédéric) Statut du mandat (point 55')
    expect(question).toMatch(/mandats Prospect et Archivé \?/)
    expect(question).toMatch(/Choix actuel : oui, avec ou sans filtre Collaborateur \(portefeuille en portée « tous »\)/)
    expect(question).toMatch(/« Pas de mandat exclu » pourrait être ce réglage/)
  })

  it('le commentaire de filtreDesMandats renvoie à cette question, sans autre destinataire', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'honoraires-tableau.ts'), 'utf8')
      .replaceAll('\r\n', '\n')
    const fin = source.indexOf('function filtreDesMandats')
    const commentaire = source.slice(source.lastIndexOf('/**', fin), fin).replaceAll(/\n \*\s+/g, ' ')
    expect(commentaire).toMatch(/🔴 à confirmer par Frédéric, question « Statut du mandat » de l'en-tête/)
    expect(commentaire).not.toMatch(/Hugo/)
  })
})
