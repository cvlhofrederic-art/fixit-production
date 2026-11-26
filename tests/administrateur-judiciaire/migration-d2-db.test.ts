import './fuseau-paris'
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_COPROPRIETAIRES } from '@/components/administrateur-judiciaire/data/coproprietaires'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { migrerFichesCoproprietaires, planDeReprise } from '@/lib/administrateur-judiciaire/db/migration-d2'
import { repoComptesCoproprietaires, repoCoproprietes, repoIdentites, repoPositions } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { initialiserBaseDemo } from '@/lib/administrateur-judiciaire/db/seed-demo'
import { CLE_STOCKAGE_MODE, DATE_DEMO_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Migration des fiches copropriétaire en base (db/migration-d2.ts) : une seule transaction (lecture, plan pur, écritures
 * en add), relançable sans doublon, sans effacer ni modifier l'ancienne table, sans toucher au store. Base de
 * démonstration (neuve et restaurée) et base réelle remplie par l'import de liste. Données fictives.
 */

const D2 = ['identites', 'comptesCoproprietaires', 'positions'] as const
const NOUVELLES = new Set<string>([...D2, 'clesRepartition', 'echeancesAppel', 'traitements'])
const etat = () => useDonneesStore.getState()

/** Contenu de toutes les tables des versions 1 et 2, hors journal d'activité. */
async function tablesAnciennes(): Promise<Record<string, unknown[]>> {
  const r: Record<string, unknown[]> = {}
  for (const t of ajDb.tables) if (!NOUVELLES.has(t.name) && t.name !== 'activityLog') r[t.name] = await t.toArray()
  return r
}

const compter = async () => ({
  identites: await ajDb.identites.count(),
  comptesCoproprietaires: await ajDb.comptesCoproprietaires.count(),
  positions: await ajDb.positions.count(),
  activityLog: await ajDb.activityLog.count(),
})

/** Lignes D2 sans les horodatages « maintenant ». */
async function lignesD2() {
  const sansHorodatage = <T extends { createdAt: string; updatedAt: string }>({ createdAt: _c, updatedAt: _u, ...reste }: T) => reste
  return {
    identites: (await ajDb.identites.toArray()).map(sansHorodatage),
    comptes: (await ajDb.comptesCoproprietaires.toArray()).map(sansHorodatage),
    positions: (await ajDb.positions.toArray()).map(sansHorodatage),
  }
}

async function demonstration(): Promise<void> {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  await viderBaseLocale()
  await initialiserBaseDemo()
  useDonneesStore.setState({ loading: false })
  await etat().loadAll()
}

beforeEach(async () => {
  await demonstration()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('base de démonstration', () => {
  it('une identité, un compte et une position par fiche ; trois entrées de journal par fiche ; ancienne table et autres tables inchangées', async () => {
    const n = DEMO_COPROPRIETAIRES.length
    expect(n).toBe(8)
    const avant = await tablesAnciennes()
    const journalAvant = await ajDb.activityLog.count()
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO, actor: 'migration-d2' })
    expect(rapport.creees).toHaveLength(n)
    expect(rapport.dejaMigrees).toEqual([])
    expect(rapport.ecartees).toEqual([])
    expect(rapport.lotsARegulariser).toEqual([])
    expect(await compter()).toEqual({ identites: n, comptesCoproprietaires: n, positions: n, activityLog: journalAvant + 3 * n })
    expect(await tablesAnciennes()).toEqual(avant)
    const journal = await ajDb.activityLog.where('entite').anyOf([...D2]).toArray()
    expect(journal.every((l) => l.action === 'create' && l.qui === 'migration-d2')).toBe(true)
  })

  it('dates d’entrée exactes (première ordonnance, date locale) ; séries par syndicat ; soldes relevés ; personne morale restée physique', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    const lots = await ajDb.lots.toArray()
    const coproDuLot = new Map(lots.map((l) => [l.id, l.coproprieteId]))
    const positions = await ajDb.positions.toArray()
    const dates = new Map(positions.map((p) => [coproDuLot.get(p.lotId), p.dateEntree]))
    // ordonnances de la démonstration : C1 le 12/03/2026, C4 le 28/04/2026 (stockées la veille à 23 h ou 22 h UTC)
    expect(dates.get('C1')).toBe('2026-03-12')
    expect(dates.get('C4')).toBe('2026-04-28')
    for (const p of positions) expect(p.reprise).toEqual({ coproprietaireId: p.id.replace(/^pos-/, ''), origineDateEntree: 'ordonnance' })
    // en place à la date figée de la démonstration
    expect(positions.every((p) => p.dateEntree <= DATE_DEMO_ISO && p.statut === 'En place')).toBe(true)
    const comptes = await ajDb.comptesCoproprietaires.toArray()
    const seriesC1 = comptes.filter((c) => c.coproprieteId === 'C1').map((c) => c.serie).sort((a, b) => a.localeCompare(b))
    expect(seriesC1).toEqual(['00001', '00002', '00003'])
    expect((await ajDb.comptesCoproprietaires.get('cpt-P5'))?.reprise).toEqual({
      coproprietaireId: 'P5',
      soldeDuCentimes: 920_000,
      statutFiche: 'Contentieux',
      releveLe: DATE_DEMO_ISO,
    })
    expect((await ajDb.identites.get('id-P5'))?.nature).toBe('physique')
  })

  it('relance : rien de créé, aucun doublon, journal inchangé', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    const apresPremiere = await compter()
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual([])
    expect([...rapport.dejaMigrees].sort((a, b) => a.localeCompare(b))).toEqual(DEMO_COPROPRIETAIRES.map((c) => c.id).sort((a, b) => a.localeCompare(b)))
    expect(await compter()).toEqual(apresPremiere)
  })

  it('deux migrations lancées ensemble (deux onglets) : aucune erreur, aucun doublon, la seconde ne crée rien', async () => {
    const [a, b] = await Promise.all([
      migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO }),
      migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO }),
    ])
    expect([a.creees.length, b.creees.length].sort((x, y) => x - y)).toEqual([0, DEMO_COPROPRIETAIRES.length])
    expect(await ajDb.identites.count()).toBe(DEMO_COPROPRIETAIRES.length)
  })

  it('identité supprimée après la migration (rapprochement de doublons) : jamais recréée', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    await repoIdentites.remove('id-P1')
    await repoPositions.remove('pos-P1')
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual([])
    expect(rapport.dejaMigrees).toContain('P1')
    expect(await ajDb.identites.get('id-P1')).toBeUndefined()
  })

  it('les trois lignes supprimées après la migration : jamais recréées, la trace du journal d’activité suffit', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    await repoIdentites.remove('id-P1')
    await repoComptesCoproprietaires.remove('cpt-P1')
    await repoPositions.remove('pos-P1')
    const avant = await compter()
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual([])
    expect(rapport.dejaMigrees).toContain('P1')
    expect(await ajDb.identites.get('id-P1')).toBeUndefined()
    expect(await ajDb.comptesCoproprietaires.get('cpt-P1')).toBeUndefined()
    expect(await ajDb.positions.get('pos-P1')).toBeUndefined()
    expect(await compter()).toEqual(avant)
  })

  it('compte à la plus grande série supprimé, puis nouvelle fiche migrée : la série sortie n’est jamais redonnée (journal d’activité)', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    const comptesC1 = (await ajDb.comptesCoproprietaires.where('coproprieteId').equals('C1').toArray()).sort((a, b) => a.serie.localeCompare(b.serie))
    const dernier = comptesC1.at(-1)
    expect(dernier?.serie).toBe('00003')
    const ficheDuDernier = await ajDb.coproprietaires.get(String(dernier?.id).replace(/^cpt-/, ''))
    expect(ficheDuDernier).toBeDefined()
    await repoComptesCoproprietaires.remove(String(dernier?.id))
    // nouvelle fiche sur le même lot (import après une vente) : fictive
    await ajDb.coproprietaires.add({ ...(ficheDuDernier as NonNullable<typeof ficheDuDernier>), id: 'PNEW', nom: 'Personne nouvelle' })
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual(['PNEW'])
    expect((await ajDb.comptesCoproprietaires.get('cpt-PNEW'))?.serie).toBe('00004')
  })

  it('échec d’écriture au milieu : rien n’est écrit, l’erreur remonte', async () => {
    const original = repoPositions.create
    let appels = 0
    vi.spyOn(repoPositions, 'create').mockImplementation(async (...args) => {
      appels++
      if (appels === 3) throw new Error('Écriture refusée')
      return original(...args)
    })
    const journalAvant = await ajDb.activityLog.count()
    await expect(migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })).rejects.toThrow('Écriture refusée')
    expect(await compter()).toEqual({ identites: 0, comptesCoproprietaires: 0, positions: 0, activityLog: journalAvant })
  })

  it('jour de la migration invalide : refusé, rien n’est écrit', async () => {
    const avant = await compter()
    await expect(migrerFichesCoproprietaires({ aujourdhui: '19/11/2026' })).rejects.toThrow('Migration D2 : date invalide (19/11/2026), AAAA-MM-JJ attendu.')
    expect(await compter()).toEqual(avant)
  })

  it('le store n’est pas touché', async () => {
    const avant = JSON.stringify(etat())
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(JSON.stringify(etat())).toBe(avant)
  })

  it('démonstration restaurée (base vidée, seed, migration) : mêmes identifiants, mêmes séries, mêmes lignes', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    const premiere = await lignesD2()
    await demonstration()
    expect(await ajDb.identites.count()).toBe(0)
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    const seconde = await lignesD2()
    // les lots de la démonstration reçoivent de nouveaux identifiants à chaque seed : on compare hors lotId
    const sansLot = (l: Awaited<ReturnType<typeof lignesD2>>) => ({ ...l, positions: l.positions.map(({ lotId: _l, ...p }) => p) })
    expect(sansLot(seconde)).toEqual(sansLot(premiere))
  })
})

describe('base réelle déjà remplie (import de la liste des copropriétaires)', () => {
  it('fiches importées puis migrées ; import suivant, puis relance : seules les nouvelles fiches', async () => {
    localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
    await viderBaseLocale()
    await repoCoproprietes.create(
      { code: 'ZZ', nom: 'Résidence fictive', adresse: '1 rue Fictive', nbLots: 0, budget: 0, depense: 0, impayes: 0, fondsTravaux: 0 },
      { id: 'CR1' },
    )
    await ajDb.mandats.add({
      id: 'MR1',
      coproprieteId: 'CR1',
      fondement: 'Art. 29-1',
      motif: 'Essai',
      tribunal: 'TJ Fictif',
      rg: '26/00009',
      ordonnance: new Date(2026, 8, 15),
      dureeMois: 12,
      echeance: new Date(2027, 8, 15),
      statut: 'Actif',
      pill: 'ok',
      notifOrdonnance: '',
      createdAt: '2026-09-16T08:00:00.000Z',
      updatedAt: '2026-09-16T08:00:00.000Z',
      createdBy: null,
      updatedBy: null,
    })
    useDonneesStore.setState({ loading: false })
    await etat().loadAll()
    const ligne = (n: number, solde = 0) => ({ lot: `Lot ${n}`, nom: `Personne ${n}`, tel: '', mail: '', solde, tantiemes: { numerateur: 100, denominateur: 1000 } })
    await etat().importerCoproprietaires('CR1', [ligne(1), ligne(2, -50)])
    const premier = await migrerFichesCoproprietaires({ aujourdhui: '2026-11-19' })
    expect(premier.creees).toHaveLength(2)
    expect((await ajDb.positions.toArray()).map((p) => p.dateEntree)).toEqual(['2026-09-15', '2026-09-15'])

    // import suivant : une nouvelle personne, et la même liste (mise à jour des deux premières fiches)
    await etat().importerCoproprietaires('CR1', [ligne(1), ligne(2, -80), ligne(10)])
    const second = await migrerFichesCoproprietaires({ aujourdhui: '2026-11-20' })
    expect(second.creees).toHaveLength(1)
    expect(second.dejaMigrees).toHaveLength(2)
    const comptes = (await ajDb.comptesCoproprietaires.toArray()).map((c) => [c.libelle, c.serie, c.reprise?.soldeDuCentimes, c.reprise?.releveLe])
    expect(comptes.sort((a, b) => String(a[1]).localeCompare(String(b[1])))).toEqual([
      ['Personne 1', '00001', 0, '2026-11-19'],
      // relevé de la première migration : la mise à jour de la fiche n'est pas reportée (deux modèles en parallèle)
      ['Personne 2', '00002', 5_000, '2026-11-19'],
      ['Personne 10', '00003', 0, '2026-11-20'],
    ])
  })

  it('base vide : rien à migrer', async () => {
    await viderBaseLocale()
    expect(await migrerFichesCoproprietaires({ aujourdhui: '2026-11-19' })).toEqual({ creees: [], dejaMigrees: [], ecartees: [], lotsARegulariser: [] })
  })
})

describe('plan de la reprise sans écriture (bandeau de l’écran « Appels de fonds », décision du 22/11/2026)', () => {
  /** Fiches des lots d'un syndicat, comme les lit l'écran « Appels de fonds ». */
  async function fichesDe(coproprieteId: string) {
    const lotIds = (await ajDb.lots.where('coproprieteId').equals(coproprieteId).toArray()).map((l) => l.id)
    return ajDb.coproprietaires.where('lotId').anyOf(lotIds).toArray()
  }
  const trier = (ids: readonly string[]) => [...ids].sort((a, b) => a.localeCompare(b))

  it('n’écrit rien ; ses lignes sont celles que la reprise crée pour le syndicat ; après la reprise, plus rien à créer', async () => {
    const fichesC1 = await fichesDe('C1')
    expect(trier(fichesC1.map((f) => f.id))).toEqual(['P1', 'P4', 'P8'])
    const avant = await compter()
    const plan = await planDeReprise(fichesC1, { aujourdhui: DATE_DEMO_ISO })
    expect(await compter()).toEqual(avant)
    expect(plan.ecartees).toEqual([])
    expect(trier(plan.aCreer.map((l) => l.coproprietaireId))).toEqual(['P1', 'P4', 'P8'])

    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual(expect.arrayContaining(['P1', 'P4', 'P8']))
    for (const ligne of plan.aCreer) {
      expect(await ajDb.identites.get(ligne.identite.id)).toMatchObject(ligne.identite)
      expect(await ajDb.comptesCoproprietaires.get(ligne.compte.id)).toMatchObject(ligne.compte)
      expect(await ajDb.positions.get(ligne.position.id)).toMatchObject(ligne.position)
    }

    const apres = await planDeReprise(await fichesDe('C1'), { aujourdhui: DATE_DEMO_ISO })
    expect(apres.aCreer).toEqual([])
    expect(apres.ecartees).toEqual([])
    expect(trier(apres.dejaMigrees)).toEqual(['P1', 'P4', 'P8'])
  })

  it('fiche au nom vide : écartée avec son lot, son syndicat et son motif, comme dans le rapport de la reprise', async () => {
    const p1 = await ajDb.coproprietaires.get('P1')
    const lotP1 = await ajDb.lots.get(String(p1?.lotId))
    // fiche fictive sur le lot de P1 (C1)
    await ajDb.coproprietaires.add({ ...(p1 as NonNullable<typeof p1>), id: 'PVIDE', nom: '   ' })
    const attendue = { coproprietaireId: 'PVIDE', motif: "Nom de l'identité manquant.", coproprieteId: 'C1', lotNumero: lotP1?.numero, nom: null }
    const plan = await planDeReprise(await fichesDe('C1'), { aujourdhui: DATE_DEMO_ISO })
    expect(plan.ecartees).toEqual([attendue])
    expect(plan.aCreer.map((l) => l.coproprietaireId)).not.toContain('PVIDE')

    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.ecartees).toEqual([attendue])
    expect((await planDeReprise(await fichesDe('C1'), { aujourdhui: DATE_DEMO_ISO })).ecartees).toEqual([attendue])
  })

  it('les trois lignes d’une fiche supprimées après la reprise (trace du journal) : ni à créer, ni écartée', async () => {
    await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    await repoIdentites.remove('id-P1')
    await repoComptesCoproprietaires.remove('cpt-P1')
    await repoPositions.remove('pos-P1')
    const plan = await planDeReprise(await fichesDe('C1'), { aujourdhui: DATE_DEMO_ISO })
    expect(plan.aCreer).toEqual([])
    expect(plan.ecartees).toEqual([])
    expect(plan.dejaMigrees).toContain('P1')
  })

  it('jour invalide : refusé, rien n’est écrit', async () => {
    const avant = await compter()
    await expect(planDeReprise(await fichesDe('C1'), { aujourdhui: '19/11/2026' })).rejects.toThrow('Migration D2 : date invalide (19/11/2026), AAAA-MM-JJ attendu.')
    expect(await compter()).toEqual(avant)
  })

  it('lit les seules données des syndicats des fiches : un compte illisible d’un autre syndicat ne change rien ; celui du syndicat écarte ses fiches, sans erreur', async () => {
    const fichesC1 = await fichesDe('C1')
    const attendu = await planDeReprise(fichesC1, { aujourdhui: DATE_DEMO_ISO })
    // compte fictif de C2 dont la série n'est pas un texte : ligne écrite hors de l'application (sans le dépôt ni le domaine)
    const illisible = { id: 'cpt-illisible', coproprieteId: 'C2', serie: { valeur: '42' }, libelle: 'Compte illisible (fictif)', createdAt: '', updatedAt: '', createdBy: null, updatedBy: null }
    await ajDb.comptesCoproprietaires.add(illisible as never)
    expect(await planDeReprise(fichesC1, { aujourdhui: DATE_DEMO_ISO })).toEqual(attendu)
    // le syndicat du compte : chaque fiche est écartée avec le motif (l'écran du syndicat reste lisible), rien n'est créé
    const fichesC2 = await fichesDe('C2')
    expect(fichesC2.length).toBeGreaterThan(0)
    const planC2 = await planDeReprise(fichesC2, { aujourdhui: DATE_DEMO_ISO })
    expect(planC2.aCreer).toEqual([])
    expect(trier(planC2.ecartees.map((e) => e.coproprietaireId))).toEqual(trier(fichesC2.map((f) => f.id)))
    expect(new Set(planC2.ecartees.map((e) => e.motif))).toEqual(new Set(['Série illisible sur un compte copropriétaire du syndicat : à corriger avant de reprendre la fiche.']))
    // sans fiche, rien à classer
    expect(await planDeReprise([], { aujourdhui: DATE_DEMO_ISO })).toEqual({ aCreer: [], dejaMigrees: [], ecartees: [], lotsARegulariser: [] })
  })

  it('reprise de toutes les copropriétés avec un compte illisible dans un syndicat : les autres syndicats repris, ses fiches écartées, aucune erreur', async () => {
    const illisible = { id: 'cpt-illisible', coproprieteId: 'C2', serie: { valeur: '42' }, libelle: 'Compte illisible (fictif)', createdAt: '', updatedAt: '', createdBy: null, updatedBy: null }
    await ajDb.comptesCoproprietaires.add(illisible as never)
    const fichesC1 = await fichesDe('C1')
    const fichesC2 = await fichesDe('C2')
    expect(fichesC1.length).toBeGreaterThan(0)
    const rapport = await migrerFichesCoproprietaires({ aujourdhui: DATE_DEMO_ISO })
    expect(rapport.creees).toEqual(expect.arrayContaining(fichesC1.map((f) => f.id)))
    expect(rapport.creees.filter((id) => fichesC2.some((f) => f.id === id))).toEqual([])
    expect(trier(rapport.ecartees.filter((e) => e.coproprieteId === 'C2').map((e) => e.coproprietaireId))).toEqual(trier(fichesC2.map((f) => f.id)))
    // rien de créé pour C2 : seul le compte illisible y reste
    expect(await ajDb.comptesCoproprietaires.where('coproprieteId').equals('C2').count()).toBe(1)
  })
})
