import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDonneesStore } from '@/lib/administrateur-judiciaire/db/donnees-store'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { enregistrerSinistre } from '@/lib/administrateur-judiciaire/db/sinistres'
import type { SaisieSinistre } from '@/lib/administrateur-judiciaire/domain/sinistres'

/**
 * Enregistrement d'une fiche sinistre dans la table locale existante « sinistres » (mode données réelles) : création,
 * modification, mise à jour du store, journal d'activité, refus d'une fiche incohérente ou d'un numéro en double. Le
 * schéma Dexie n'est pas modifié : les champs de la fiche Gestéam sont optionnels et non indexés.
 */

const AUJOURDHUI = '2026-11-06'

const saisie = (surcharge: Partial<SaisieSinistre> = {}): SaisieSinistre => ({
  coproprieteId: 'C1',
  type: 'Dégât des eaux',
  phase: 'Général',
  dateSurvenance: '2026-10-27',
  dateConnaissance: null,
  dateDeclaration: '2026-10-28',
  dateExpertise: null,
  dateRapport: null,
  dateReglement: null,
  dateCloture: null,
  partiesCommunesLesees: true,
  partiesCommunesResponsables: false,
  origine: 'Fuite sur colonne',
  lieu: 'Cage B',
  dommages: 'Plafond',
  assurance: { compagnie: 'Compagnie Démo', courtier: null, contrat: 'POL-1', numeroSinistre: null },
  indemniteImmediateCentimes: 0,
  indemniteImmediateReglee: false,
  indemniteDiffereeCentimes: 0,
  indemniteDiffereeReglee: false,
  causesSupprimees: false,
  reparationsFaites: false,
  numero: 'RT.00001',
  dateOuverture: '2026-10-28',
  notes: 'Première note',
  ...surcharge,
})

beforeEach(async () => {
  await viderBaseLocale()
  useDonneesStore.setState({ sinistres: [] })
})

describe('enregistrerSinistre — création et modification dans la table « sinistres »', () => {
  it('crée la ligne en base, avec les champs Gestéam, et l’ajoute au store', async () => {
    const enregistre = await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })
    const lignes = await ajDb.sinistres.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      id: enregistre.id,
      coproprieteId: 'C1',
      type: 'Dégât des eaux',
      numero: 'RT.00001',
      dateOuverture: '2026-10-28',
      dateConnaissance: '2026-10-27',
      dateForclusion: null,
      notes: 'Première note',
      assurance: { compagnie: 'Compagnie Démo', contrat: 'POL-1' },
    })
    expect(useDonneesStore.getState().sinistres.map((ligne) => ligne.id)).toEqual([enregistre.id])
    const journal = await ajDb.activityLog.toArray()
    expect(journal.filter((entree) => entree.entite === 'sinistres').map((entree) => entree.action)).toEqual(['create'])
  })

  it('modifie la ligne existante (même identifiant) et remplace celle du store', async () => {
    const cree = await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })
    const modifie = await enregistrerSinistre(saisie({ phase: "Mission d'expertise", parties: [] }), {
      id: cree.id,
      aujourdhui: AUJOURDHUI,
    })
    expect(modifie.id).toBe(cree.id)
    const lignes = await ajDb.sinistres.toArray()
    expect(lignes).toHaveLength(1)
    expect(lignes[0].phase).toBe("Mission d'expertise")
    expect(useDonneesStore.getState().sinistres).toHaveLength(1)
    expect(useDonneesStore.getState().sinistres[0].phase).toBe("Mission d'expertise")
  })

  it('son propre numéro n’est pas un doublon lors d’une modification', async () => {
    const cree = await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })
    await expect(enregistrerSinistre(saisie(), { id: cree.id, aujourdhui: AUJOURDHUI })).resolves.toMatchObject({ id: cree.id })
  })
})

/** Ligne écrite directement dans la table (reprise, import), hors du repository. */
const ligneExterne = (id: string, ligne: Record<string, unknown>) =>
  ajDb.sinistres.add({
    id,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T08:00:00.000Z',
    createdBy: null,
    updatedBy: null,
    coproprieteId: 'C2',
    type: 'Vol',
    dateSurvenance: '2026-10-01',
    ...ligne,
  } as never)

describe('enregistrerSinistre — lignes illisibles de la base (reprise, import)', () => {
  it('un n° qui n’est pas un texte (nombre, objet) ne bloque ni la création ni la modification numérotées', async () => {
    await ligneExterne('ext-nombre', { numero: 12 })
    await ligneExterne('ext-objet', { numero: { a: 1 } })
    const cree = await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })
    expect(cree.numero).toBe('RT.00001')
    await expect(
      enregistrerSinistre(saisie({ phase: 'Déclaration' }), { id: cree.id, aujourdhui: AUJOURDHUI }),
    ).resolves.toMatchObject({ id: cree.id, phase: 'Déclaration' })
    expect(await ajDb.sinistres.count()).toBe(3)
  })

  it('le n° texte d’une ligne illisible reste attribué : doublon refusé avec le message du domaine', async () => {
    await ligneExterne('ext-texte', { numero: 'RT.00001', origine: null })
    await expect(enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })).rejects.toThrow(
      'Numéro RT.00001 déjà attribué à un autre sinistre.',
    )
    expect(await ajDb.sinistres.count()).toBe(1)
  })
})

describe('enregistrerSinistre — refus, rien n’est écrit', () => {
  it('fiche incohérente (déclaration avant la survenance)', async () => {
    await expect(enregistrerSinistre(saisie({ dateDeclaration: '2026-10-20' }), { aujourdhui: AUJOURDHUI })).rejects.toThrow(
      /avant/i,
    )
    expect(await ajDb.sinistres.count()).toBe(0)
    expect(useDonneesStore.getState().sinistres).toEqual([])
  })

  it('numéro déjà attribué à une autre fiche', async () => {
    await enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })
    await expect(enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI })).rejects.toThrow(/numéro/i)
    expect(await ajDb.sinistres.count()).toBe(1)
  })

  it('format invalide (heure d’expertise)', async () => {
    await expect(
      enregistrerSinistre(saisie({ dateExpertise: '2026-11-20', heureExpertise: '9h' }), { aujourdhui: AUJOURDHUI }),
    ).rejects.toThrow(/heure/i)
    expect(await ajDb.sinistres.count()).toBe(0)
  })

  it('statut « Terminé » sans « Clos le »', async () => {
    await expect(
      enregistrerSinistre(saisie(), { aujourdhui: AUJOURDHUI, statutSaisi: 'Terminé' }),
    ).rejects.toThrow(/clos/i)
    expect(await ajDb.sinistres.count()).toBe(0)
  })

  it('modification d’une fiche disparue : erreur du repository', async () => {
    await expect(enregistrerSinistre(saisie(), { id: 'inconnu', aujourdhui: AUJOURDHUI })).rejects.toThrow(/introuvable/)
  })
})

describe('schéma de la base inchangé', () => {
  it('version 2, table « sinistres » indexée sur id et coproprieteId seulement', () => {
    expect(ajDb.verno).toBe(2)
    const table = ajDb.tables.find((candidate) => candidate.name === 'sinistres')
    expect(table?.schema.primKey.name).toBe('id')
    expect(table?.schema.indexes.map((index) => index.name)).toEqual(['coproprieteId'])
  })
})
