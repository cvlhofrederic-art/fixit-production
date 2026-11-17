import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  assurancePnoDepuisFicheLot,
  attestationsPnoAControler,
  bilanAssurancesPno,
  controlesAssurancesPno,
  lireStatutPno,
  STATUTS_PNO,
  type AssurancePnoLot,
  type LotAssurancePno,
} from '@/lib/administrateur-judiciaire/domain/assurance-pno-lots'
import {
  creerEquipeImmeuble,
  destinatairesNotifications,
  estFonctionEquipeImmeuble,
  FONCTIONS_EQUIPE_IMMEUBLE,
  LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE,
  lireFonctionEquipe,
  membresDeFonction,
} from '@/lib/administrateur-judiciaire/domain/equipe-immeuble'
import { nouvelleFicheLot } from '@/lib/administrateur-judiciaire/domain/fiche-lot'
import { lireStatutMandat } from '@/lib/administrateur-judiciaire/domain/statut-mandat'
import { normaliserEspaces } from '@/lib/administrateur-judiciaire/domain/texte'
import {
  depuisAssurancesPno,
  FAMILLES_SUIVI,
  LIBELLES_FAMILLES_SUIVI,
  LIBELLES_NATURES_SUIVI,
  NATURES_SUIVI,
  portefeuille,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

const lireSource = (fichier: string): string =>
  readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8')

/** Lignes de commentaire jointes (« * » de début de ligne retirés). */
const aplatir = (texte: string): string => texte.replaceAll(/\s*\n\s*\*\s*/g, ' ')

const enTete = (fichier: string): string => {
  const source = lireSource(fichier)
  return aplatir(source.slice(0, source.indexOf('*/')))
}

// ─── Équipe de l'immeuble ───────────────────────────────────────────────────────────────────

/** La fiche vue en tranche 43 § 17 : cinq membres, cinq fonctions, le repère « => » sur trois. */
const SAISIE_TRANCHE_43 = {
  mandatId: 'M1',
  membres: [
    { collaborateurId: 'c-relation', fonction: 'charge_de_relation', principal: true },
    { collaborateurId: 'c-associe', fonction: 'associe' },
    { collaborateurId: 'c-comptable', fonction: 'comptable', principal: true },
    { collaborateurId: 'c-gestion', fonction: 'gestionnaire', principal: true },
    { collaborateurId: 'c-assistante', fonction: 'assistante', principal: false },
  ],
}

describe("équipe de l'immeuble — fonctions relevées (tranches 41 et 43 § 17)", () => {
  it('cinq fonctions ; libellés de la grille, « Associé » déduit (🔵, forme exacte non relevée)', () => {
    expect(FONCTIONS_EQUIPE_IMMEUBLE).toEqual(['charge_de_relation', 'associe', 'comptable', 'gestionnaire', 'assistante'])
    expect(Object.values(LIBELLES_FONCTIONS_EQUIPE_IMMEUBLE)).toEqual([
      'Chargé(e) de relation',
      'Associé',
      'Comptable',
      'Gestionnaire',
      'Assistante',
    ])
  })

  it('les rôles du mandat ne sont pas des fonctions de l’équipe (sauf le mot « comptable », commun aux deux)', () => {
    expect(estFonctionEquipeImmeuble('responsable')).toBe(false)
    expect(estFonctionEquipeImmeuble('assistant')).toBe(false)
    expect(estFonctionEquipeImmeuble('Gestion')).toBe(false)
    expect(estFonctionEquipeImmeuble('comptable')).toBe(true)
  })

  it('lireFonctionEquipe : code ou libellé exact de la grille (reprise Gestéam), espaces et forme Unicode normalisés', () => {
    expect(lireFonctionEquipe('charge_de_relation')).toBe('charge_de_relation')
    expect(lireFonctionEquipe('  Chargé(e)   de relation ')).toBe('charge_de_relation')
    expect(lireFonctionEquipe('Associé')).toBe('associe')
    expect(lireFonctionEquipe('Comptable')).toBe('comptable')
    expect(lireFonctionEquipe('comptable')).toBe('comptable')
  })

  it('lireFonctionEquipe : rien de deviné ; les rôles du mandat et du cabinet ne sont pas des fonctions', () => {
    for (const valeur of ['Responsable', 'responsable', 'Assistant(e)', 'assistant', 'Chargé de relation', 'GESTIONNAIRE', 'Gestion', ''])
      expect(lireFonctionEquipe(valeur)).toBeNull()
  })
})

describe('normaliserEspaces (texte.ts)', () => {
  it('forme Unicode composée, espaces réduits, casse et accents conservés', () => {
    expect(normaliserEspaces('  Extérieure  +\t sans contrat ')).toBe('Extérieure + sans contrat')
    expect(normaliserEspaces('Pas de PNO')).toBe('Pas de PNO')
  })
})

describe('creerEquipeImmeuble', () => {
  it('la fiche de la tranche 43 : cinq lignes dans l’ordre, repère par défaut à faux, gestion manuelle décochée', () => {
    const equipe = creerEquipeImmeuble(SAISIE_TRANCHE_43)
    expect(equipe.mandatId).toBe('M1')
    expect(equipe.gestionManuelle).toBe(false)
    expect(equipe.membres.map((m) => [m.collaborateurId, m.fonction, m.principal])).toEqual([
      ['c-relation', 'charge_de_relation', true],
      ['c-associe', 'associe', false],
      ['c-comptable', 'comptable', true],
      ['c-gestion', 'gestionnaire', true],
      ['c-assistante', 'assistante', false],
    ])
  })

  it('identifiants nettoyés, case « Gestion manuelle » conservée sans effet, équipe vide admise', () => {
    const equipe = creerEquipeImmeuble({
      mandatId: ' M2 ',
      membres: [{ collaborateurId: ' c1 ', fonction: 'gestionnaire', principal: true }],
      gestionManuelle: true,
    })
    expect(equipe).toEqual({
      mandatId: 'M2',
      membres: [{ collaborateurId: 'c1', fonction: 'gestionnaire', principal: true }],
      gestionManuelle: true,
    })
    expect(creerEquipeImmeuble({ mandatId: 'M3', membres: [] }).membres).toEqual([])
  })

  it('refuse une équipe sans mandat (D1 : rattachée au mandat)', () => {
    expect(() => creerEquipeImmeuble({ mandatId: '  ', membres: [] })).toThrow(/sans mandat/)
  })

  it('refuse une ligne sans collaborateur ou avec une fonction non relevée', () => {
    expect(() => creerEquipeImmeuble({ mandatId: 'M1', membres: [{ collaborateurId: ' ', fonction: 'comptable' }] })).toThrow(
      /ligne 1 : collaborateur non désigné/,
    )
    expect(() =>
      creerEquipeImmeuble({
        mandatId: 'M1',
        membres: [
          { collaborateurId: 'c1', fonction: 'comptable' },
          { collaborateurId: 'c2', fonction: 'responsable' },
        ],
      }),
    ).toThrow(/ligne 2 : fonction « responsable » inconnue/)
  })

  it('accepte les libellés de la grille Gestéam (reprise) et les range sous leur code', () => {
    const equipe = creerEquipeImmeuble({
      mandatId: 'M1',
      membres: [
        { collaborateurId: 'c1', fonction: 'Chargé(e) de relation', principal: true },
        { collaborateurId: 'c2', fonction: ' Gestionnaire ' },
      ],
    })
    expect(equipe.membres.map((m) => m.fonction)).toEqual(['charge_de_relation', 'gestionnaire'])
  })

  it('le doublon se lit après lecture de la fonction (code et libellé de la même fonction)', () => {
    expect(() =>
      creerEquipeImmeuble({
        mandatId: 'M1',
        membres: [
          { collaborateurId: 'c1', fonction: 'comptable' },
          { collaborateurId: 'c1', fonction: 'Comptable' },
        ],
      }),
    ).toThrow(/ligne 2 : collaborateur c1 déjà inscrit comme « Comptable »/)
  })

  it('refuse deux fois la même ligne (même collaborateur, même fonction), même après nettoyage', () => {
    expect(() =>
      creerEquipeImmeuble({
        mandatId: 'M1',
        membres: [
          { collaborateurId: 'c1', fonction: 'comptable' },
          { collaborateurId: ' c1', fonction: 'comptable', principal: true },
        ],
      }),
    ).toThrow(/ligne 2 : collaborateur c1 déjà inscrit comme « Comptable »/)
  })

  it('🔴 aucune règle d’unicité relevée : un collaborateur dans deux fonctions, deux membres et deux repères pour une fonction', () => {
    const equipe = creerEquipeImmeuble({
      mandatId: 'M1',
      membres: [
        { collaborateurId: 'c1', fonction: 'gestionnaire', principal: true },
        { collaborateurId: 'c1', fonction: 'charge_de_relation', principal: true },
        { collaborateurId: 'c2', fonction: 'gestionnaire', principal: true },
      ],
    })
    expect(equipe.membres).toHaveLength(3)
    expect(destinatairesNotifications(equipe, 'gestionnaire')).toEqual(['c1', 'c2'])
  })
})

describe('destinataires des notifications (repère « => ») et membres d’une fonction', () => {
  const equipe = creerEquipeImmeuble(SAISIE_TRANCHE_43)

  it('les trois repères de la tranche 43, dans l’ordre de la grille', () => {
    expect(destinatairesNotifications(equipe)).toEqual(['c-relation', 'c-comptable', 'c-gestion'])
  })

  it('limités à une fonction ; vide pour une fonction sans repère, rien n’est déduit des rôles', () => {
    expect(destinatairesNotifications(equipe, 'comptable')).toEqual(['c-comptable'])
    expect(destinatairesNotifications(equipe, 'assistante')).toEqual([])
    expect(destinatairesNotifications(creerEquipeImmeuble({ mandatId: 'M1', membres: [] }))).toEqual([])
  })

  it('un collaborateur à repère dans deux fonctions n’est cité qu’une fois', () => {
    const double = creerEquipeImmeuble({
      mandatId: 'M1',
      membres: [
        { collaborateurId: 'c1', fonction: 'gestionnaire', principal: true },
        { collaborateurId: 'c1', fonction: 'comptable', principal: true },
      ],
    })
    expect(destinatairesNotifications(double)).toEqual(['c1'])
  })

  it('membresDeFonction : repère ou non', () => {
    expect(membresDeFonction(equipe, 'assistante')).toEqual(['c-assistante'])
    expect(membresDeFonction(equipe, 'associe')).toEqual(['c-associe'])
  })

  it('distincte des rôles : un membre de l’équipe sans rôle sur le mandat n’entre pas dans son portefeuille', () => {
    const affectations: AffectationMandat[] = [
      { mandatId: 'M1', cabinetId: null, responsableId: 'r-mandat', comptableId: 'c-autre', assistantId: 'c-assistante' },
    ]
    expect(portefeuille('c-gestion', affectations)).toEqual(new Set())
    expect(portefeuille('c-assistante', affectations)).toEqual(new Set(['M1']))
    expect(equipe.membres.some((m) => m.collaborateurId === 'r-mandat')).toBe(false)
  })
})

describe('en-tête du module equipe-immeuble.ts', () => {
  const EN_TETE = enTete('equipe-immeuble.ts')

  it('sources Gestéam et marqueurs', () => {
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(EN_TETE).toContain(marqueur)
    expect(EN_TETE).toMatch(/Tranche 41/)
    expect(EN_TETE).toMatch(/Tranche 43 § 17/)
    expect(EN_TETE).toMatch(/CORRECTION de la tranche 41/)
  })

  it('aucun texte : organisation du cabinet ; règle d’unicité non relevée', () => {
    expect(EN_TETE).toMatch(/AUCUN TEXTE/)
    expect(EN_TETE).toMatch(/AUCUNE règle d'unicité n'a été relevée/)
  })

  it('🔴 questions : portefeuille des membres de l’équipe, mandat de plusieurs immeubles', () => {
    expect(EN_TETE).toMatch(/« de mon portefeuille » comprend-il les mandats où le collaborateur n'est que membre de l'équipe/)
    expect(EN_TETE).toMatch(/plusieurs immeubles a-t-il une équipe par immeuble/)
  })
})

// ─── Assurance PNO des lots ─────────────────────────────────────────────────────────────────

const lot = (lotId: string, assurancePno: AssurancePnoLot | null, numero = lotId): LotAssurancePno => ({ lotId, numero, assurancePno })
const pno = (statut: string | null, echeance: string | null = null): AssurancePnoLot => ({ statut, echeance })

describe('statuts PNO (tranche 43 § 17)', () => {
  it('cinq statuts, dans l’ordre relevé', () => {
    expect(STATUTS_PNO).toEqual(['Cabinet', 'Extérieure', 'Sans échéance', 'Extérieure + sans contrat', 'Pas de PNO'])
  })

  it('lecture : espaces superflus normalisés, valeur inconnue ou absente → null (jamais devinée)', () => {
    expect(lireStatutPno('  Extérieure   +  sans contrat ')).toBe('Extérieure + sans contrat')
    expect(lireStatutPno('Extérieure')).toBe('Extérieure')
    expect(lireStatutPno('exterieure')).toBeNull()
    expect(lireStatutPno(null)).toBeNull()
    expect(lireStatutPno(undefined)).toBeNull()
  })
})

describe('controlesAssurancesPno', () => {
  it('échéance saisie : attestation à renouveler à cette date, même dépassée', () => {
    const [controle] = controlesAssurancesPno([lot('L1', pno('Cabinet', '2026-03-31'), '14')])
    expect(controle).toEqual({
      lotId: 'L1',
      numero: '14',
      statut: 'Cabinet',
      echeance: '2026-03-31',
      motif: 'a_renouveler',
      date: '2026-03-31',
      lectureStatutAConfirmer: false,
      message: "Lot 14 : attestation PNO à renouveler à l'échéance du 31/03/2026.",
    })
  })

  it('« Cabinet » ou « Extérieure » sans échéance : échéance à obtenir, sans réserve', () => {
    const controles = controlesAssurancesPno([lot('L1', pno('Extérieure')), lot('L2', pno('Cabinet'))])
    expect(controles.map((c) => [c.lotId, c.motif, c.date, c.lectureStatutAConfirmer])).toEqual([
      ['L1', 'echeance_absente', null, false],
      ['L2', 'echeance_absente', null, false],
    ])
    expect(controles[0].message).toBe('Lot L1 : PNO « Extérieure » sans échéance saisie ; attestation à obtenir.')
  })

  it('« Sans échéance » : échéance à obtenir, lecture du statut à confirmer', () => {
    const [controle] = controlesAssurancesPno([lot('L1', pno('Sans échéance'))])
    expect(controle).toMatchObject({ motif: 'echeance_absente', date: null, lectureStatutAConfirmer: true })
    expect(controle.message).toBe(
      'Lot L1 : PNO « Sans échéance » sans échéance saisie ; attestation à obtenir (lecture du statut à confirmer).',
    )
  })

  it('« Extérieure + sans contrat » : attestation à obtenir, à confirmer, même avec une échéance', () => {
    const controles = controlesAssurancesPno([
      lot('L1', pno('Extérieure + sans contrat')),
      lot('L2', pno('Extérieure + sans contrat', '2027-01-31')),
    ])
    expect(controles.map((c) => [c.motif, c.echeance, c.date, c.lectureStatutAConfirmer])).toEqual([
      ['attestation_absente', null, null, true],
      ['attestation_absente', '2027-01-31', null, true],
    ])
    expect(controles[0].message).toBe('Lot L1 : PNO extérieure sans contrat ; attestation à obtenir (lecture du statut à confirmer).')
  })

  it('« Pas de PNO », lot sans information, statut absent sans échéance : aucun contrôle', () => {
    expect(
      controlesAssurancesPno([lot('L1', pno('Pas de PNO')), lot('L2', pno('Pas de PNO', '2026-12-31')), lot('L3', null), lot('L4', pno(null))]),
    ).toEqual([])
  })

  it('une échéance connue est contrôlée même sans statut, avec un statut inconnu ou avec « Sans échéance »', () => {
    const inconnu = { statut: 'Groupe', echeance: '2026-06-30' }
    const controles = controlesAssurancesPno([
      lot('L1', pno(null, '2026-05-31')),
      lot('L2', inconnu),
      lot('L3', pno('Sans échéance', '2026-07-31')),
    ])
    expect(controles.map((c) => [c.lotId, c.statut, c.motif, c.date, c.lectureStatutAConfirmer])).toEqual([
      ['L1', null, 'a_renouveler', '2026-05-31', false],
      ['L2', null, 'a_renouveler', '2026-06-30', false],
      ['L3', 'Sans échéance', 'a_renouveler', '2026-07-31', false],
    ])
  })

  it('échéance illisible : à ressaisir (hors « Pas de PNO » et « Extérieure + sans contrat », qui priment)', () => {
    const controles = controlesAssurancesPno([lot('L1', pno('Extérieure', '31/12/2026')), lot('L2', pno(null, '2026-02-30'))])
    expect(controles.map((c) => [c.motif, c.echeance, c.date])).toEqual([
      ['echeance_illisible', null, null],
      ['echeance_illisible', null, null],
    ])
    expect(controles[0].message).toBe('Lot L1 : échéance PNO illisible (« 31/12/2026 ») ; à ressaisir (AAAA-MM-JJ).')
  })

  it('ordre des lots conservé, un contrôle au plus par lot', () => {
    const controles = controlesAssurancesPno([lot('B', pno('Cabinet', '2026-01-31')), lot('A', pno('Extérieure'))])
    expect(controles.map((c) => c.lotId)).toEqual(['B', 'A'])
  })
})

describe('attestationsPnoAControler', () => {
  const lots = [
    lot('L1', pno('Cabinet', '2026-11-03')),
    lot('L2', pno('Extérieure', '2026-11-04')),
    lot('L3', pno('Extérieure')),
    lot('L4', pno('Extérieure', '2026-10-01')),
  ]

  it('échéance antérieure ou égale à la date, ou attestation à obtenir', () => {
    expect(attestationsPnoAControler(lots, '2026-11-03').map((c) => c.lotId)).toEqual(['L1', 'L3', 'L4'])
    expect(attestationsPnoAControler(lots, '2026-11-04').map((c) => c.lotId)).toEqual(['L1', 'L2', 'L3', 'L4'])
  })

  it('date de contrôle invalide : erreur', () => {
    expect(() => attestationsPnoAControler(lots, '03/11/2026')).toThrow(/Date invalide/)
  })
})

describe('bilanAssurancesPno (sélecteur « statut des lots »)', () => {
  it('lots par statut, non renseignés et anomalies, rien d’écarté', () => {
    const bilan = bilanAssurancesPno([
      lot('L1', pno('Cabinet', '2026-12-31')),
      lot('L2', pno('Pas de PNO')),
      lot('L3', pno('Pas de PNO', '2026-12-31'), '3'),
      lot('L4', { statut: ' Groupe ', echeance: null }, '4'),
      lot('L5', null),
      lot('L6', pno('Sans échéance', '2026-12-31'), '6'),
      lot('L7', pno('Extérieure', '2026-13-01'), '7'),
      lot('L8', pno('Cabinet')),
    ])
    expect(bilan.parStatut).toEqual({
      Cabinet: ['L1', 'L8'],
      Extérieure: ['L7'],
      'Sans échéance': ['L6'],
      'Extérieure + sans contrat': [],
      'Pas de PNO': ['L2', 'L3'],
    })
    expect(bilan.nonRenseignes).toEqual(['L4', 'L5'])
    expect(bilan.anomalies.map((a) => [a.lotId, a.motif])).toEqual([
      ['L3', 'echeance_contradictoire'],
      ['L4', 'statut_inconnu'],
      ['L6', 'echeance_contradictoire'],
      ['L7', 'echeance_illisible'],
    ])
    expect(bilan.anomalies[1].message).toMatch(/^Lot 4 : statut PNO « Groupe » hors du référentiel \(Cabinet, Extérieure/)
    expect(bilan.anomalies[0].message).toBe(
      'Lot 3 : échéance PNO saisie avec le statut « Pas de PNO » ; statut ou échéance à corriger.',
    )
  })
})

describe('assurancePnoDepuisFicheLot (échéance déjà saisie sur la fiche lot)', () => {
  it('échéance reprise, statut absent ; sans échéance, aucune information', () => {
    expect(assurancePnoDepuisFicheLot(nouvelleFicheLot({ echeancePno: '2026-12-31' }))).toEqual({ statut: null, echeance: '2026-12-31' })
    expect(assurancePnoDepuisFicheLot(nouvelleFicheLot())).toBeNull()
  })
})

describe('suivi « à faire » : famille « lots » (assurance PNO)', () => {
  const affectations: AffectationMandat[] = [
    { mandatId: 'M1', cabinetId: null, responsableId: 'u1', comptableId: null, assistantId: null, statut: 'En gestion' },
    { mandatId: 'M2', cabinetId: null, responsableId: 'u1', comptableId: null, assistantId: null, statut: 'Archivé' },
  ]
  const items = [
    { mandatId: 'M1', lot: lot('L1', pno('Cabinet', '2026-10-31'), '1') },
    { mandatId: 'M1', lot: lot('L2', pno('Extérieure', '2026-11-30'), '2') },
    { mandatId: 'M1', lot: lot('L3', pno('Sans échéance'), '3') },
    { mandatId: 'M1', lot: lot('L4', pno('Pas de PNO'), '4') },
    { mandatId: 'M2', lot: lot('L5', pno('Extérieure'), '5') },
  ]

  it('famille et natures déclarées, avec leurs libellés', () => {
    expect(FAMILLES_SUIVI).toContain('lots')
    expect(NATURES_SUIVI.lots).toEqual(['pno_a_renouveler', 'pno_a_obtenir'])
    expect(LIBELLES_FAMILLES_SUIVI.lots).toBe('Lots (assurance PNO)')
    expect(LIBELLES_NATURES_SUIVI.pno_a_renouveler).toBe('Attestation PNO à renouveler')
    expect(LIBELLES_NATURES_SUIVI.pno_a_obtenir).toBe('Attestation PNO à obtenir')
  })

  it('depuisAssurancesPno : à renouveler à l’échéance, à obtenir à la date du jour ; jamais `aConfirmer` (aucun repère juridique)', () => {
    const elements = depuisAssurancesPno(items, '2026-11-04')
    expect(elements.map((e) => [e.id, e.nature, e.date, e.mandatId, e.objetId, e.aConfirmer])).toEqual([
      ['lots:L1:pno_a_renouveler', 'pno_a_renouveler', '2026-10-31', 'M1', 'L1', false],
      ['lots:L2:pno_a_renouveler', 'pno_a_renouveler', '2026-11-30', 'M1', 'L2', false],
      ['lots:L3:pno_a_obtenir', 'pno_a_obtenir', '2026-11-04', 'M1', 'L3', false],
      ['lots:L5:pno_a_obtenir', 'pno_a_obtenir', '2026-11-04', 'M2', 'L5', false],
    ])
    expect(elements[0]).toMatchObject({ famille: 'lots', assigneId: null, libelle: "Lot 1 : attestation PNO à renouveler à l'échéance du 31/10/2026." })
    expect(elements[2].libelle).toBe('Lot 3 : PNO « Sans échéance » sans échéance saisie ; attestation à obtenir (lecture du statut à confirmer).')
  })

  it('date du jour invalide : erreur', () => {
    expect(() => depuisAssurancesPno(items, '2026-11-31')).toThrow(/invalide/)
  })

  it('selectionnerAFaire : horizon « Maintenant » sans l’échéance à venir ; mandat archivé écarté ; un mois l’ajoute', () => {
    const elements = depuisAssurancesPno(items, '2026-11-04')
    const maintenant = selectionnerAFaire(elements, reglageParDefaut('u1'), affectations, '2026-11-04')
    expect(maintenant.map((e) => e.objetId)).toEqual(['L1', 'L3'])
    const unMois: ReglageSuivi = reglageParDefaut('u1')
    unMois.familles.lots = { actif: true, perimetre: 'portefeuille', horizon: { nombre: 1, unite: 'mois' }, natures: null }
    expect(selectionnerAFaire(elements, unMois, affectations, '2026-11-04').map((e) => e.objetId)).toEqual(['L1', 'L3', 'L2'])
  })

  it('un lot passé deux fois n’est retenu qu’une fois', () => {
    const elements = depuisAssurancesPno([items[0], items[0]], '2026-11-04')
    expect(elements).toHaveLength(2)
    expect(selectionnerAFaire(elements, reglageParDefaut('u1'), affectations, '2026-11-04')).toHaveLength(1)
  })
})

describe('en-tête du module assurance-pno-lots.ts', () => {
  const EN_TETE = enTete('assurance-pno-lots.ts')

  it('sources Gestéam et marqueurs', () => {
    for (const marqueur of ['🟢', '🔵', '🔴']) expect(EN_TETE).toContain(marqueur)
    expect(EN_TETE).toMatch(/Tranche 43 § 17/)
    expect(EN_TETE).toMatch(/Cabinet · Extérieure · Sans échéance · Extérieure \+ sans contrat · Pas de PNO/)
  })

  it('L. 1965 art. 9-1 cité tel quel, et aucune obligation de contrôle pour le syndic ou l’administrateur provisoire', () => {
    expect(EN_TETE).toContain(
      "« Chaque copropriétaire est tenu de s'assurer contre les risques de responsabilité civile dont il doit répondre en sa qualité soit de copropriétaire occupant, soit de copropriétaire non-occupant. Chaque syndicat de copropriétaires est tenu de s'assurer contre les risques de responsabilité civile dont il doit répondre. »",
    )
    expect(EN_TETE).toMatch(/AUCUN TEXTE lu n'impose au syndic ni à l'administrateur provisoire/)
    expect(EN_TETE).toMatch(/RÈGLE DE GESTION/)
  })

  it('🔴 questions : échéance d’un contrat « Cabinet », date d’une attestation à obtenir', () => {
    expect(EN_TETE).toMatch(/sous le statut « Cabinet », l'échéance d'un contrat souscrit par le cabinet doit-elle remonter au suivi/)
    expect(EN_TETE).toMatch(/à quelle date une attestation « à obtenir » doit-elle remonter/)
  })
})

describe('en-tête de suivi-a-faire.ts : famille « lots »', () => {
  it('règle de gestion : `aConfirmer` reste faux, la réserve de lecture du statut passe par le libellé', () => {
    const EN_TETE = enTete('suivi-a-faire.ts')
    expect(EN_TETE).toMatch(/Lots \(point 71/)
    expect(EN_TETE).toMatch(/PNO : `aConfirmer` reste faux/)
  })
})

// ─── Relecture du point 71, tour 1 ──────────────────────────────────────────────────────────

describe('relecture 71 — libellé « Associé » : déduit (🔵), non relevé dans la grille', () => {
  const SOURCE = aplatir(lireSource('equipe-immeuble.ts'))
  const EN_TETE = enTete('equipe-immeuble.ts')

  it('en-tête : « Associé » marqué 🔵, forme exacte non relevée, déduite de la tranche 43 § 17', () => {
    expect(EN_TETE).toMatch(/🔵 « Associé » : forme exacte non relevée, déduite de la tranche 43 § 17/)
    expect(EN_TETE).not.toMatch(/le libellé exact de la grille/)
  })

  it('🔴 question à Hugo sur la forme exacte du libellé', () => {
    expect(EN_TETE).toContain('Hugo : libellé exact de la fonction associé dans la grille : Associé, Associé(e) ?')
  })

  it('la liste des fonctions ne présente plus « Associé » comme un libellé de la tranche 41', () => {
    expect(SOURCE).not.toContain('libellés de la tranche 41)')
    expect(SOURCE).toMatch(/sauf « Associé » \(🔵 forme exacte non relevée, déduite de la tranche 43 § 17 ; 🔴 question/)
  })

  it('code inchangé : « Associé(e) » n’est pas deviné, la ligne est refusée tant que la forme n’est pas relevée', () => {
    expect(lireFonctionEquipe('Associé(e)')).toBeNull()
    expect(() => creerEquipeImmeuble({ mandatId: 'M1', membres: [{ collaborateurId: 'c1', fonction: 'Associé(e)' }] })).toThrow(
      /ligne 1 : fonction « Associé\(e\) » inconnue/,
    )
  })
})

describe('relecture 71 — statut PNO saisi ou repris : chaîne brute, lue par lireStatutPno', () => {
  it('type : `statut` est la valeur brute (comme AffectationMandat.statut), pas le type affiné', () => {
    expectTypeOf<AssurancePnoLot['statut']>().toEqualTypeOf<string | null | undefined>()
  })

  it('une valeur reprise hors référentiel passe sans transtypage et est signalée au bilan, jamais devinée', () => {
    const repris: string = 'Exterieure'
    const assurance: AssurancePnoLot = { statut: repris, echeance: null }
    const bilan = bilanAssurancesPno([lot('L1', assurance, '1')])
    expect(bilan.nonRenseignes).toEqual(['L1'])
    expect(bilan.anomalies.map((a) => [a.lotId, a.motif])).toEqual([['L1', 'statut_inconnu']])
    expect(bilan.anomalies[0].message).toMatch(/^Lot 1 : statut PNO « Exterieure » hors du référentiel/)
    expect(controlesAssurancesPno([lot('L1', assurance)])).toEqual([])
  })

  it('le contrôle lit la valeur brute : statut du référentiel retrouvé après normalisation des espaces', () => {
    const [controle] = controlesAssurancesPno([lot('L1', { statut: '  Extérieure   +  sans contrat ', echeance: null })])
    expect(controle).toMatchObject({ statut: 'Extérieure + sans contrat', motif: 'attestation_absente', lectureStatutAConfirmer: true })
  })
})

describe('relecture 71 — clé « statut » ou « echeance » absente (reprise, futur Lot.assurancePno)', () => {
  const AUCUN_STATUT = { Cabinet: [], Extérieure: [], 'Sans échéance': [], 'Extérieure + sans contrat': [], 'Pas de PNO': [] }

  it('clé « statut » absente : bilan sans erreur, lot non renseigné ; le contrôle suit l’échéance', () => {
    const lots = [lot('L1', { echeance: '2026-12-31' }, '1')]
    expect(bilanAssurancesPno(lots)).toEqual({ parStatut: AUCUN_STATUT, nonRenseignes: ['L1'], anomalies: [] })
    expect(controlesAssurancesPno(lots).map((c) => [c.motif, c.date])).toEqual([['a_renouveler', '2026-12-31']])
  })

  it('clé « echeance » absente : échéance absente, jamais « illisible (« undefined ») »', () => {
    const lots = [lot('L1', { statut: 'Cabinet' }, '1')]
    const [controle] = controlesAssurancesPno(lots)
    expect(controle).toMatchObject({ motif: 'echeance_absente', echeance: null, date: null })
    expect(controle.message).toBe('Lot 1 : PNO « Cabinet » sans échéance saisie ; attestation à obtenir.')
    expect(bilanAssurancesPno(lots).anomalies).toEqual([])
    expect(depuisAssurancesPno([{ mandatId: 'M1', lot: lots[0] }], '2026-11-04').map((e) => e.libelle)).toEqual([controle.message])
  })

  it('« Pas de PNO » sans clé « echeance » : aucune anomalie de contradiction', () => {
    expect(bilanAssurancesPno([lot('L1', { statut: 'Pas de PNO' })]).anomalies).toEqual([])
  })

  it('objet vide : aucune information, aucun contrôle', () => {
    const lots = [lot('L1', {})]
    expect(controlesAssurancesPno(lots)).toEqual([])
    expect(bilanAssurancesPno(lots)).toEqual({ parStatut: AUCUN_STATUT, nonRenseignes: ['L1'], anomalies: [] })
  })
})

describe('relecture 71 — en-tête PNO : ordre des règles (la première qui s’applique l’emporte)', () => {
  const EN_TETE = enTete('assurance-pno-lots.ts')

  it('l’en-tête écrit la précédence : « Pas de PNO » et « Extérieure + sans contrat » priment sur l’échéance', () => {
    expect(EN_TETE).toMatch(/dans cet ordre, la première qui s'applique l'emporte/)
    expect(EN_TETE).toMatch(
      /hors « Pas de PNO » \(aucun contrôle\) et « Extérieure \+ sans contrat » \(attestation à obtenir, échéance non suivie\)/,
    )
    expect(EN_TETE).not.toMatch(/quel que soit le statut/)
    expect(EN_TETE).not.toMatch(/jamais écartée/)
  })

  it('comportement documenté : sous « Pas de PNO », l’échéance illisible ne donne aucun contrôle, le bilan la signale', () => {
    const lots = [lot('L1', pno('Pas de PNO', '31/12/2026'), '1')]
    expect(controlesAssurancesPno(lots)).toEqual([])
    expect(bilanAssurancesPno(lots).anomalies.map((a) => a.motif)).toEqual(['echeance_illisible', 'echeance_contradictoire'])
  })

  it('comportement documenté : sous « Extérieure + sans contrat », l’échéance est reprise mais pas suivie comme date', () => {
    const [controle] = controlesAssurancesPno([lot('L1', pno('Extérieure + sans contrat', '31/12/2026'))])
    expect(controle).toMatchObject({ motif: 'attestation_absente', echeance: null, date: null })
  })
})

describe('relecture 71 — normalisation partagée (texte.normaliserEspaces), sans copie locale', () => {
  const IMPORT = /import \{[^}]*\bnormaliserEspaces\b[^}]*\} from '@\/lib\/administrateur-judiciaire\/domain\/texte'/

  it('statut-mandat.ts, equipe-immeuble.ts et assurance-pno-lots.ts importent normaliserEspaces', () => {
    for (const fichier of ['statut-mandat.ts', 'equipe-immeuble.ts', 'assurance-pno-lots.ts']) {
      const source = lireSource(fichier)
      expect(source, fichier).toMatch(IMPORT)
      expect(source, fichier).not.toContain(".normalize('NFC')")
    }
  })

  it('lireStatutMandat inchangé : espaces et forme Unicode normalisés, casse conservée', () => {
    expect(lireStatutMandat('  En \t gestion ')).toMatchObject({ etat: 'connu', statut: 'En gestion' })
    expect(lireStatutMandat('Archivé'.normalize('NFD'))).toMatchObject({ etat: 'connu', statut: 'Archivé' })
    expect(lireStatutMandat(' en  gestion ')).toEqual({ etat: 'inconnu', valeur: 'en gestion', suivi: true, enCloture: false })
  })
})
