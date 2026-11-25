import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import { controlerDroitsLot, creerIdentite, migrerCoproprietaire, positionsEnPlace } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  detaillerEcartees,
  idsMigration,
  libelleFicheEcartee,
  planifierMigrationD2,
  seriesDuJournal,
  type EntreesMigrationD2,
} from '@/lib/administrateur-judiciaire/domain/migration-d2'

/**
 * Migration D2 des anciennes fiches copropriétaire (une par lot : identité, position et solde mêlés), plan pur : une
 * fiche = une identité + un compte copropriétaire + une position 1/1 (migrerCoproprietaire), sans fusion de personnes ;
 * séries à la suite de celles du syndicat ; date d'entrée = première ordonnance des mandats du syndicat, à défaut le
 * jour de création de la fiche (marquée à vérifier) ; solde et statut gardés sur le compte comme donnée de reprise, sans
 * écriture ; fiches déjà migrées ignorées ; fiches invalides écartées avec leur motif. Données fictives.
 */

const AUJOURDHUI = '2026-06-04'

const fiche = (id: string, lotId: string, surcharge: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  lotId,
  nom: `Personne ${id}`,
  tel: '',
  mail: '',
  solde: 0,
  statut: 'À jour',
  createdAt: '2026-05-01T08:00:00.000Z',
  updatedAt: '2026-05-01T08:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

const LOTS = [
  { id: 'L12', coproprieteId: 'C1', numero: 'Lot 12 — Apt B3' },
  { id: 'L7', coproprieteId: 'C1', numero: 'Lot 7 — Apt A1' },
  { id: 'L31', coproprieteId: 'C1', numero: 'Lot 31 — Apt C2' },
  { id: 'L4', coproprieteId: 'C2', numero: 'Lot 4' },
]

const entrees = (surcharge: Partial<EntreesMigrationD2> = {}): EntreesMigrationD2 => ({
  fiches: [],
  lots: LOTS,
  mandats: [
    { coproprieteId: 'C1', ordonnance: new Date(2026, 2, 12) },
    { coproprieteId: 'C1', ordonnance: new Date(2026, 4, 2) },
  ],
  comptes: [],
  idsConnus: new Set(),
  aujourdhui: AUJOURDHUI,
  ...surcharge,
})

describe('une fiche → une identité, un compte, une position 1/1', () => {
  it('identifiants id-, cpt-, pos- de migrerCoproprietaire ; copropriétaire en place, part 1/1 ; reprise marquée', () => {
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12', { nom: '  Laure   Exemple ', tel: '0100000000', mail: 'laure@example.test' })] }))
    expect(plan.ecartees).toEqual([])
    expect(plan.dejaMigrees).toEqual([])
    expect(plan.aCreer).toHaveLength(1)
    const [{ coproprietaireId, identite, compte, position }] = plan.aCreer
    expect(coproprietaireId).toBe('P1')
    expect(identite).toEqual({
      id: 'id-P1',
      nature: 'physique',
      civilite: '',
      nom: 'Laure Exemple',
      prenom: null,
      telecoms: [
        { nature: 'Téléphone', valeur: '0100000000' },
        { nature: 'E-mail', valeur: 'laure@example.test' },
      ],
      adresses: [],
      groupes: [],
      representants: [],
    })
    // J78 : aucune case « professionnel » (l'ancienne fiche n'en a pas)
    expect('professionnel' in identite).toBe(false)
    expect(compte).toEqual({
      id: 'cpt-P1',
      coproprieteId: 'C1',
      serie: '00001',
      libelle: 'Laure Exemple',
      reprise: { coproprietaireId: 'P1', soldeDuCentimes: 0, statutFiche: 'À jour', releveLe: AUJOURDHUI },
    })
    expect(position).toEqual({
      id: 'pos-P1',
      identiteId: 'id-P1',
      lotId: 'L12',
      compteId: 'cpt-P1',
      qualite: 'Copropriétaire',
      part: { numerateur: 1, denominateur: 1 },
      statut: 'En place',
      dateEntree: '2026-03-12',
      dateSortie: null,
      reprise: { coproprietaireId: 'P1', origineDateEntree: 'ordonnance' },
    })
  })

  it('les identifiants de la migration sont ceux de migrerCoproprietaire (aucune convention recopiée)', () => {
    const { identite, compte, position } = migrerCoproprietaire(
      { id: 'X9', lotId: 'L12', nom: 'Nom', tel: '', mail: '', statut: '' },
      { coproprieteId: 'C1', serie: '1', dateEntree: '2026-01-01' },
    )
    expect(idsMigration('X9')).toEqual({ identite: identite.id, compte: compte.id, position: position.id })
  })

  it('personne morale : reste « physique » (nature fixée par migrerCoproprietaire, sans déduction) ; aucun représentant légal possible avant correction', () => {
    const [{ identite }] = planifierMigrationD2(entrees({ fiches: [fiche('P5', 'L12', { nom: 'SCI Exemple' })] })).aCreer
    expect(identite.nature).toBe('physique')
    expect(() => creerIdentite({ ...identite, representants: [{ identiteId: 'id-P6', fonction: 'Gérant', du: '2026-01-01', au: null }] })).toThrow(
      /réservé à une personne morale/,
    )
  })
})

describe('solde et statut : gardés sur le compte comme donnée de reprise, sans écriture', () => {
  it('solde de la fiche (euros, négatif = dette) → centimes, positifs quand ils sont dus ; statut tel quel ; jour du relevé', () => {
    const plan = planifierMigrationD2(
      entrees({
        fiches: [
          fiche('P2', 'L12', { solde: -1840, statut: 'Impayé' }),
          fiche('P3', 'L7', { solde: -9200.55, statut: 'Contentieux' }),
          fiche('P4', 'L31', { solde: 25.5, statut: 'À jour' }),
          fiche('P6', 'L4', { solde: -0, statut: 'À jour' }),
        ],
      }),
    )
    const reprises = Object.fromEntries(plan.aCreer.map((l) => [l.coproprietaireId, l.compte.reprise]))
    expect(reprises.P2).toEqual({ coproprietaireId: 'P2', soldeDuCentimes: 184_000, statutFiche: 'Impayé', releveLe: AUJOURDHUI })
    expect(reprises.P3).toEqual({ coproprietaireId: 'P3', soldeDuCentimes: 920_055, statutFiche: 'Contentieux', releveLe: AUJOURDHUI })
    expect(reprises.P4.soldeDuCentimes).toBe(-2_550)
    expect(Object.is(reprises.P6.soldeDuCentimes, 0)).toBe(true)
  })
})

describe('séries : à la suite de celles du syndicat, ordre stable', () => {
  it('ordre : n° de lot (numérique), nom, identifiant ; séries propres à chaque syndicat', () => {
    const fiches = [fiche('P1', 'L12'), fiche('P4', 'L31'), fiche('P8', 'L7'), fiche('P9', 'L4')]
    const series = (plan: ReturnType<typeof planifierMigrationD2>) => plan.aCreer.map((l) => [l.coproprietaireId, l.compte.coproprieteId, l.compte.serie])
    const attendu = [
      ['P8', 'C1', '00001'],
      ['P1', 'C1', '00002'],
      ['P4', 'C1', '00003'],
      ['P9', 'C2', '00001'],
    ]
    expect(series(planifierMigrationD2(entrees({ fiches })))).toEqual(attendu)
    // même résultat quel que soit l'ordre de lecture des fiches
    expect(series(planifierMigrationD2(entrees({ fiches: [...fiches].reverse() })))).toEqual(attendu)
  })

  it('à la suite du plus grand numéro existant du syndicat ; une série alphanumérique n’est jamais reprise', () => {
    const plan = planifierMigrationD2(
      entrees({
        fiches: [fiche('P1', 'L12'), fiche('P8', 'L7')],
        comptes: [
          { coproprieteId: 'C1', serie: '00007' },
          { coproprieteId: 'C1', serie: '0000A' },
          { coproprieteId: 'C1', serie: '9' },
          { coproprieteId: 'C2', serie: '00040' },
        ],
      }),
    )
    expect(plan.aCreer.map((l) => l.compte.serie)).toEqual(['00010', '00011'])
  })

  it('plus de série libre (99999 atteint) : fiche écartée avec son motif', () => {
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12')], comptes: [{ coproprieteId: 'C1', serie: '99999' }] }))
    expect(plan.aCreer).toEqual([])
    expect(plan.ecartees).toEqual([{ coproprietaireId: 'P1', motif: expect.stringMatching(/série/) }])
  })

  it('série illisible sur un compte du syndicat (ligne écrite hors application) : ses fiches écartées avec leur motif, les autres syndicats migrés', () => {
    // série qui n'est pas un texte : les séries prises du syndicat sont inconnues, aucune n'est donnée (risque de doublon)
    const comptes = [{ coproprieteId: 'C1', serie: 42 as unknown as string }]
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12'), fiche('P2', 'L7'), fiche('P9', 'L4')], comptes }))
    expect(plan.aCreer.map((l) => [l.coproprietaireId, l.compte.serie])).toEqual([['P9', '00001']])
    const motif = 'Série illisible sur un compte copropriétaire du syndicat : à corriger avant de reprendre la fiche.'
    expect(plan.ecartees).toEqual([
      { coproprietaireId: 'P1', motif },
      { coproprietaireId: 'P2', motif },
    ])
  })

  it('séries gardées par le journal d’activité des comptes (avant et après) : compte supprimé ou renuméroté, série jamais redonnée', () => {
    const journal = [
      // création puis suppression : la série 00007 est sortie
      { avant: null, apres: { id: 'cpt-X', coproprieteId: 'C1', serie: '00007' } },
      { avant: { id: 'cpt-X', coproprieteId: 'C1', serie: '00007' }, apres: null },
      // renumérotation : l'ancienne série (00009) comme la nouvelle (00003) sont prises
      { avant: { id: 'cpt-Y', coproprieteId: 'C1', serie: '00009' }, apres: { id: 'cpt-Y', coproprieteId: 'C1', serie: '00003' } },
      { avant: null, apres: { id: 'cpt-Z', coproprieteId: 'C2', serie: '00040' } },
      // entrées illisibles (ligne écrite hors application) : ignorées
      { avant: 'texte', apres: { coproprieteId: 'C1', serie: 12 } },
      { avant: { serie: '00500' }, apres: { coproprieteId: 7, serie: '00600' } },
    ]
    expect(seriesDuJournal(journal)).toEqual([
      { coproprieteId: 'C1', serie: '00007' },
      { coproprieteId: 'C1', serie: '00007' },
      { coproprieteId: 'C1', serie: '00009' },
      { coproprieteId: 'C1', serie: '00003' },
      { coproprieteId: 'C2', serie: '00040' },
    ])
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12'), fiche('P9', 'L4')], comptes: seriesDuJournal(journal) }))
    expect(plan.aCreer.map((l) => [l.coproprietaireId, l.compte.serie])).toEqual([
      ['P1', '00010'],
      ['P9', '00041'],
    ])
  })
})

describe('jour de la migration', () => {
  it('pas au format AAAA-MM-JJ : refusé, rien n’est planifié (le relevé du solde le porte)', () => {
    for (const aujourdhui of ['19/11/2026', '2026-02-30', '', '2026-11-19T10:00:00.000Z'])
      expect(() => planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12')], aujourdhui })), aujourdhui).toThrow(
        `Migration D2 : date invalide (${aujourdhui}), AAAA-MM-JJ attendu.`,
      )
  })
})

describe('déjà migrée : ignorée, jamais recréée', () => {
  it('une de ses lignes existe, ou le journal a enregistré leur création (identité supprimée depuis : pas recréée)', () => {
    for (const connu of ['id-P1', 'cpt-P1', 'pos-P1']) {
      const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12'), fiche('P8', 'L7')], idsConnus: new Set([connu]) }))
      expect(plan.dejaMigrees, connu).toEqual(['P1'])
      expect(plan.aCreer.map((l) => l.coproprietaireId), connu).toEqual(['P8'])
    }
  })
})

describe('pas de fusion automatique de personnes', () => {
  it('même personne sur deux lots : deux identités, deux comptes', () => {
    const plan = planifierMigrationD2(
      entrees({ fiches: [fiche('P1', 'L12', { nom: 'Laure Exemple', tel: '0100000000' }), fiche('P2', 'L7', { nom: 'Laure Exemple', tel: '0100000000' })] }),
    )
    expect(plan.aCreer.map((l) => [l.identite.id, l.compte.id])).toEqual([
      ['id-P2', 'cpt-P2'],
      ['id-P1', 'cpt-P1'],
    ])
    expect(plan.lotsARegulariser).toEqual([])
  })

  it('deux fiches sur un lot (indivision saisie en deux lignes, ou import après une vente) : deux comptes, droits du lot en anomalie, lot à régulariser', () => {
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12', { nom: 'Vendeur' }), fiche('P2', 'L12', { nom: 'Acquéreur' })] }))
    expect(plan.aCreer).toHaveLength(2)
    const positions = plan.aCreer.map((l) => l.position)
    expect(controlerDroitsLot(positionsEnPlace(positions, 'L12', AUJOURDHUI)).map((a) => a.code)).toEqual(['parts_incompletes', 'comptes_multiples'])
    expect(plan.lotsARegulariser).toEqual([
      { lotId: 'L12', coproprietaireIds: ['P1', 'P2'], motif: expect.stringMatching(/indivision ou mutation à régulariser/) },
    ])
  })
})

describe('fiches écartées avec leur motif, les autres migrées', () => {
  it('lot introuvable, nom vide, champ non texte, solde non numérique, identifiant absent', () => {
    const plan = planifierMigrationD2(
      entrees({
        fiches: [
          fiche('P1', 'L-inconnu'),
          fiche('P2', 'L12', { nom: '   ' }),
          fiche('P3', 'L12', { tel: 612 }),
          fiche('P4', 'L12', { solde: '12,5' }),
          fiche('', 'L12'),
          fiche('P6', 'L31'),
        ],
      }),
    )
    expect(plan.aCreer.map((l) => l.coproprietaireId)).toEqual(['P6'])
    expect(plan.ecartees).toEqual([
      { coproprietaireId: 'P1', motif: expect.stringMatching(/lot introuvable/i) },
      { coproprietaireId: 'P2', motif: expect.stringMatching(/Nom de l'identité manquant/) },
      { coproprietaireId: 'P3', motif: expect.stringMatching(/« tel » : texte attendu/) },
      { coproprietaireId: 'P4', motif: expect.stringMatching(/solde/i) },
      { coproprietaireId: '', motif: expect.stringMatching(/identifiant/i) },
    ])
    // la série écartée n'est pas consommée
    expect(plan.aCreer[0].compte.serie).toBe('00001')
  })

  it('tel, mail ou statut absents (ligne écrite hors application) : vides, la fiche est migrée', () => {
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P1', 'L12', { tel: undefined, mail: null, statut: undefined })] }))
    expect(plan.aCreer[0].identite.telecoms).toEqual([])
    expect(plan.aCreer[0].compte.reprise.statutFiche).toBe('')
  })
})

describe('date d’entrée des positions', () => {
  it('première ordonnance des mandats du syndicat, en date locale (Europe/Paris) ; sans mandat, jour de création de la fiche', () => {
    const plan = planifierMigrationD2(
      entrees({
        fiches: [fiche('P1', 'L12'), fiche('P9', 'L4', { createdAt: '2026-03-31T22:30:00.000Z' })],
        mandats: [
          { coproprieteId: 'C1', ordonnance: new Date(2026, 4, 2) },
          { coproprieteId: 'C1', ordonnance: new Date(2026, 2, 12) },
          { coproprieteId: 'C1', ordonnance: 'pas une date' },
        ],
      }),
    )
    expect(plan.aCreer.map((l) => [l.coproprietaireId, l.position.dateEntree, l.position.reprise])).toEqual([
      ['P1', '2026-03-12', { coproprietaireId: 'P1', origineDateEntree: 'ordonnance' }],
      // 31/03/2026 à 22 h 30 UTC = 01/04/2026 à Paris
      ['P9', '2026-04-01', { coproprietaireId: 'P9', origineDateEntree: 'creation_fiche' }],
    ])
  })

  it('sans mandat ni date de création lisible : fiche écartée', () => {
    const plan = planifierMigrationD2(entrees({ fiches: [fiche('P9', 'L4', { createdAt: 'inconnue' })] }))
    expect(plan.ecartees).toEqual([{ coproprietaireId: 'P9', motif: expect.stringMatching(/Date d'entrée introuvable/) }])
  })
})

describe('fiches écartées : nommées par leur lot, leur syndicat et leur nom (décision du 22/11/2026)', () => {
  const fiches = [
    fiche('P1', 'L-inconnu'),
    fiche('P2', 'L12', { nom: '   ' }),
    fiche('P3', 'L12', { tel: 612 }),
    fiche('P9', 'L4', { createdAt: 'inconnue' }),
  ]
  const plan = () => planifierMigrationD2(entrees({ fiches }))

  it('detaillerEcartees : syndicat et n° du lot de la fiche, nom lisible ; ordre et motifs du plan conservés', () => {
    const { ecartees } = plan()
    const detaillees = detaillerEcartees(ecartees, fiches, LOTS)
    expect(detaillees).toEqual([
      { coproprietaireId: 'P1', motif: 'Lot introuvable (id=L-inconnu).', coproprieteId: null, lotNumero: null, nom: 'Personne P1' },
      { coproprietaireId: 'P2', motif: "Nom de l'identité manquant.", coproprieteId: 'C1', lotNumero: 'Lot 12 — Apt B3', nom: null },
      { coproprietaireId: 'P3', motif: expect.stringMatching(/« tel » : texte attendu/), coproprieteId: 'C1', lotNumero: 'Lot 12 — Apt B3', nom: 'Personne P3' },
      { coproprietaireId: 'P9', motif: expect.stringMatching(/Date d'entrée introuvable/), coproprieteId: 'C2', lotNumero: 'Lot 4', nom: 'Personne P9' },
    ])
    // motifs du plan, tels quels, dans son ordre
    expect(detaillees.map(({ coproprietaireId, motif }) => ({ coproprietaireId, motif }))).toEqual(ecartees)
  })

  it('libelleFicheEcartee : « <code> · Lot <n°>, <nom> — <motif> » ; n° déjà préfixé « Lot » non doublé ; sans lot : « <nom> — <motif> »', () => {
    const [p1, p2, , p9] = detaillerEcartees(plan().ecartees, fiches, LOTS)
    expect(libelleFicheEcartee(p2)).toBe("Lot 12 — Apt B3, fiche sans nom — Nom de l'identité manquant.")
    expect(libelleFicheEcartee(p9, 'BOUL')).toBe(
      "BOUL · Lot 4, Personne P9 — Date d'entrée introuvable : aucun mandat du syndicat, date de création de la fiche illisible.",
    )
    expect(libelleFicheEcartee(p1)).toBe('Personne P1 — Lot introuvable (id=L-inconnu).')
    expect(libelleFicheEcartee({ coproprietaireId: 'X1', motif: 'Motif fictif.', coproprieteId: 'C1', lotNumero: '7', nom: 'Personne X1' }, 'ACAC')).toBe(
      'ACAC · Lot 7, Personne X1 — Motif fictif.',
    )
  })

  it('libelleFicheEcartee : « Lot » déjà écrit, collé au n°, en capitales ou au pluriel, jamais doublé ; un mot qui commence par « lot » est préfixé', () => {
    const libelle = (lotNumero: string) =>
      libelleFicheEcartee({ coproprietaireId: 'X1', motif: 'Motif fictif.', coproprieteId: 'C1', lotNumero, nom: 'Personne X1' }, 'ACAC')
    expect(libelle('Lot12')).toBe('ACAC · Lot12, Personne X1 — Motif fictif.')
    expect(libelle('LOT 12')).toBe('ACAC · LOT 12, Personne X1 — Motif fictif.')
    expect(libelle('Lots 3-4')).toBe('ACAC · Lots 3-4, Personne X1 — Motif fictif.')
    expect(libelle('lot')).toBe('ACAC · lot, Personne X1 — Motif fictif.')
    expect(libelle('Lotissement 2')).toBe('ACAC · Lot Lotissement 2, Personne X1 — Motif fictif.')
  })
})
