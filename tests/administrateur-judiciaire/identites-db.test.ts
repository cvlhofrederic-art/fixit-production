import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { enregistrerQualiteProfessionnelle } from '@/lib/administrateur-judiciaire/db/identites'
import { repoIdentites } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type IdentiteEnregistree } from '@/lib/administrateur-judiciaire/db/schema'
import { creerIdentite } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import { qualiteProfessionnelleA } from '@/lib/administrateur-judiciaire/domain/qualite-professionnelle'

/**
 * J78 sur la table des identités (version 3) : la case « professionnel » et ses états datés ne s'écrivent que par
 * enregistrerQualiteProfessionnelle (une transaction : lecture, domaine, écriture, journal) ; repoIdentites les refuse,
 * et sa modification se fait dans une transaction, pour qu'une modification concurrente de la fiche ne perde jamais un
 * état daté. Données fictives.
 */

const JUSTIFICATION = 'Société qui reçoit l’envoi pour son activité (exemple fictif)'

async function creer(): Promise<IdentiteEnregistree> {
  const { id, ...donnees } = creerIdentite({ id: 'id-1', nature: 'morale', civilite: 'Société', nom: 'Exemple SAS', prenom: null, telecoms: [] })
  return repoIdentites.create(donnees, { id, actor: 'test' })
}

beforeEach(async () => {
  await viderBaseLocale()
})

describe('enregistrerQualiteProfessionnelle', () => {
  it('cocher sur justification : état daté (effet le lendemain), case à jour, une entrée de journal', async () => {
    await creer()
    const apres = await enregistrerQualiteProfessionnelle('id-1', { professionnel: true, justification: JUSTIFICATION, documentId: 'ged-1' }, { aujourdhui: '2026-03-01', actor: 'test' })
    expect(apres).toMatchObject({
      id: 'id-1',
      professionnel: true,
      historiqueProfessionnel: [{ professionnel: true, saisiLe: '2026-03-01', du: '2026-03-02', justification: JUSTIFICATION, documentId: 'ged-1' }],
      updatedBy: 'test',
    })
    expect(await ajDb.identites.get('id-1')).toEqual(apres)
    const journal = await ajDb.activityLog.where('entiteId').equals('id-1').toArray()
    expect(journal.map((l) => l.action).sort((a, b) => a.localeCompare(b))).toEqual(['create', 'update'])
    expect(qualiteProfessionnelleA(apres, '2026-03-02')).toBe(true)
  })

  it('refus, rien n’est écrit : identité introuvable, cochée sans justification, saisie antérieure au dernier état', async () => {
    await creer()
    await expect(enregistrerQualiteProfessionnelle('id-9', { professionnel: false }, { aujourdhui: '2026-03-01' })).rejects.toThrow(/introuvable/)
    await expect(enregistrerQualiteProfessionnelle('id-1', { professionnel: true }, { aujourdhui: '2026-03-01' })).rejects.toThrow(/justification écrite/)
    await enregistrerQualiteProfessionnelle('id-1', { professionnel: true, justification: JUSTIFICATION }, { aujourdhui: '2026-03-10' })
    await expect(enregistrerQualiteProfessionnelle('id-1', { professionnel: false }, { aujourdhui: '2026-03-09' })).rejects.toThrow(/antérieure/)
    expect((await ajDb.identites.get('id-1'))?.historiqueProfessionnel).toHaveLength(1)
    expect(await ajDb.activityLog.count()).toBe(2)
  })
})

describe('repoIdentites : la case ne s’écrit que par enregistrerQualiteProfessionnelle', () => {
  it('création et modification refusées si elles portent la case ou ses états datés ; le reste de la fiche se modifie', async () => {
    const { id: _id, ...donnees } = creerIdentite({ id: 'id-2', nature: 'physique', civilite: 'Madame', nom: 'Durand', prenom: 'Anne', telecoms: [], professionnel: true })
    await expect(repoIdentites.create(donnees, { id: 'id-2' })).rejects.toThrow(/enregistrerQualiteProfessionnelle/)
    await expect(repoIdentites.create({ ...donnees, professionnel: undefined, historiqueProfessionnel: [] }, { id: 'id-2' })).rejects.toThrow(
      /enregistrerQualiteProfessionnelle/,
    )
    await creer()
    await expect(repoIdentites.update('id-1', { professionnel: true })).rejects.toThrow(/enregistrerQualiteProfessionnelle/)
    await expect(repoIdentites.update('id-1', { historiqueProfessionnel: [] })).rejects.toThrow(/enregistrerQualiteProfessionnelle/)
    expect((await repoIdentites.update('id-1', { nom: 'Exemple SA' })).nom).toBe('Exemple SA')
    expect(await ajDb.identites.count()).toBe(1)
  })

  it('modification de la fiche et case enregistrées en même temps : l’état daté survit, la modification aussi', async () => {
    await creer()
    await Promise.all([
      repoIdentites.update('id-1', { nom: 'Exemple SA' }),
      enregistrerQualiteProfessionnelle('id-1', { professionnel: true, justification: JUSTIFICATION }, { aujourdhui: '2026-03-01' }),
      repoIdentites.update('id-1', { telecoms: [{ nature: 'Téléphone', valeur: '0100000000' }] }),
      enregistrerQualiteProfessionnelle('id-1', { professionnel: false }, { aujourdhui: '2026-03-01' }),
    ])
    const lue = await ajDb.identites.get('id-1')
    expect(lue).toMatchObject({ nom: 'Exemple SA', telecoms: [{ nature: 'Téléphone', valeur: '0100000000' }], professionnel: false })
    expect(lue?.historiqueProfessionnel?.map((e) => e.professionnel)).toEqual([true, false])
  })
})
