import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { repoAgs } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type Ag, type ChangementStatut } from '@/lib/administrateur-judiciaire/db/schema'
import { changerStatutAg, historiqueStatutAg } from '@/lib/administrateur-judiciaire/db/statut-assemblee'
import {
  DELAI_CONTESTATION_AG_ART42,
  dateNotificationAg,
  detecterStatutsAgNonHistorises,
  finDelaiContestationAg,
  preparerChangementStatutAg,
} from '@/lib/administrateur-judiciaire/domain/statut-assemblee'
import type { NatureAssemblee, StatutAssemblee } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * T12 (intégration Gestéam, lot 1) : l'AG porte deux axes distincts (nature, statut) ; tout changement de statut est
 * historisé avec sa date d'effet (date de l'acte), distincte de la date de saisie ; le délai de contestation de
 * l'art. 42 al. 2 part de la date d'effet de la notification.
 */

const changement = (surcharge: Partial<ChangementStatut>): ChangementStatut => ({
  id: 'cs-1',
  entiteType: 'ag',
  entiteId: 'ag-1',
  statutAncien: 'PV signé',
  statutNouveau: 'Notifiée',
  dateEffet: '2026-03-02',
  courrierId: null,
  createdAt: '2026-03-05T10:00:00.000Z',
  updatedAt: '2026-03-05T10:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

async function creerAg(statut: StatutAssemblee = 'Projet', nature: NatureAssemblee = 'Judiciaire'): Promise<Ag> {
  return repoAgs.create({ coproprieteId: 'C1', date: new Date(2026, 1, 10), nature, statut })
}

beforeEach(async () => {
  await viderBaseLocale()
})

describe('T12 — domaine (pur)', () => {
  it('prépare un changement : nouveau statut, ancien statut, date d’effet, courrier (null en attendant T30)', () => {
    const prepare = preparerChangementStatutAg({ id: 'ag-1', statut: 'PV signé' }, 'Notifiée', '2026-03-02')
    expect(prepare).toEqual({
      statut: 'Notifiée',
      changement: {
        entiteType: 'ag',
        entiteId: 'ag-1',
        statutAncien: 'PV signé',
        statutNouveau: 'Notifiée',
        dateEffet: '2026-03-02',
        courrierId: null,
      },
    })
  })

  it('refuse une date d’effet invalide et un statut inchangé', () => {
    expect(() => preparerChangementStatutAg({ id: 'ag-1', statut: 'PV signé' }, 'Notifiée', '02/03/2026')).toThrow(
      /date d'effet/i,
    )
    expect(() => preparerChangementStatutAg({ id: 'ag-1', statut: 'Notifiée' }, 'Notifiée', '2026-03-02')).toThrow(
      /déjà/i,
    )
  })

  it('le délai de l’art. 42 part de la date d’effet, jamais de la date de saisie', () => {
    // Notification le lundi 02/03/2026, saisie le jeudi 05/03/2026.
    const historique = [changement({ dateEffet: '2026-03-02', createdAt: '2026-03-05T10:00:00.000Z' })]
    expect(dateNotificationAg(historique, 'ag-1')).toBe('2026-03-02')
    // 02/03 + 2 mois = samedi 02/05/2026 → reporté au lundi 04/05 (le 1er mai est férié, le 03 un dimanche).
    expect(finDelaiContestationAg(historique, 'ag-1')).toBe('2026-05-04')
    const memeActeSaisiAutrement = [changement({ dateEffet: '2026-03-02', createdAt: '2026-04-20T10:00:00.000Z' })]
    expect(finDelaiContestationAg(memeActeSaisiAutrement, 'ag-1')).toBe('2026-05-04')
    expect(DELAI_CONTESTATION_AG_ART42.delai).toEqual({ valeur: 2, unite: 'mois', sens: 'apres' })
  })

  it('sans notification, pas de délai ; la dernière notification (par date d’effet) l’emporte', () => {
    expect(finDelaiContestationAg([changement({ statutNouveau: 'PV signé' })], 'ag-1')).toBeNull()
    const deux = [
      changement({ id: 'a', dateEffet: '2026-03-02' }),
      changement({ id: 'b', dateEffet: '2026-03-16', createdAt: '2026-03-03T09:00:00.000Z' }),
    ]
    expect(dateNotificationAg(deux, 'ag-1')).toBe('2026-03-16')
  })

  it('détecte une AG dont le statut ne correspond pas à son historique', () => {
    const ags = [
      { id: 'ok-projet', statut: 'Projet' as StatutAssemblee },
      { id: 'ok-notifiee', statut: 'Notifiée' as StatutAssemblee },
      { id: 'contourne', statut: 'Notifiée' as StatutAssemblee },
    ]
    const historique = [changement({ entiteId: 'ok-notifiee' })]
    expect(detecterStatutsAgNonHistorises(ags, historique)).toEqual(['contourne'])
  })
})

describe('T12 — base locale', () => {
  it('nature et statut sont deux champs distincts de l’AG', async () => {
    const ag = await creerAg('Projet', 'Judiciaire')
    expect(ag.nature).toBe('Judiciaire')
    expect(ag.statut).toBe('Projet')
  })

  it('passer une AG à « Notifiée » crée une ligne d’historique avec sa date d’effet', async () => {
    const ag = await creerAg()
    await changerStatutAg(ag.id, 'Convoquée', { dateEffet: '2026-02-10' })
    await changerStatutAg(ag.id, 'PV signé', { dateEffet: '2026-02-28' })
    const notifiee = await changerStatutAg(ag.id, 'Notifiée', { dateEffet: '2026-03-02' })
    expect(notifiee.statut).toBe('Notifiée')
    const historique = await historiqueStatutAg(ag.id)
    expect(historique.map((ligne) => [ligne.statutAncien, ligne.statutNouveau, ligne.dateEffet])).toEqual([
      ['Projet', 'Convoquée', '2026-02-10'],
      ['Convoquée', 'PV signé', '2026-02-28'],
      ['PV signé', 'Notifiée', '2026-03-02'],
    ])
    const derniere = historique[2]
    expect(derniere.courrierId).toBeNull()
    expect(derniere.createdAt.slice(0, 10)).not.toBe(derniere.dateEffet)
    expect(finDelaiContestationAg(historique, ag.id)).toBe('2026-05-04')
  })

  it('un changement de statut hors de la fonction de domaine est refusé par le repository', async () => {
    const ag = await creerAg()
    await expect(repoAgs.update(ag.id, { statut: 'Notifiée' })).rejects.toThrow(/changerStatutAg/)
    await expect(repoAgs.create({ coproprieteId: 'C1', date: new Date(), nature: 'Annuelle', statut: 'Notifiée' })).rejects.toThrow(
      /Projet/,
    )
    // Les autres champs restent modifiables normalement.
    const modifiee = await repoAgs.update(ag.id, { nature: 'Spéciale' })
    expect(modifiee.nature).toBe('Spéciale')
    expect(modifiee.statut).toBe('Projet')
  })

  it('un contournement direct de la table est détecté', async () => {
    const ag = await creerAg()
    await ajDb.ags.update(ag.id, { statut: 'Notifiée' })
    const ags = await ajDb.ags.toArray()
    const historique = await ajDb.changementsStatut.toArray()
    expect(detecterStatutsAgNonHistorises(ags, historique)).toEqual([ag.id])
  })

  it('une erreur au milieu du changement ne laisse ni statut ni historique à moitié écrits', async () => {
    const ag = await creerAg()
    await expect(changerStatutAg(ag.id, 'Convoquée', { dateEffet: 'pas-une-date' })).rejects.toThrow()
    expect((await repoAgs.get(ag.id))?.statut).toBe('Projet')
    expect(await historiqueStatutAg(ag.id)).toEqual([])
    await expect(changerStatutAg('inconnue', 'Convoquée', { dateEffet: '2026-02-10' })).rejects.toThrow(/introuvable/)
  })

  it('le schéma passe en version 2 sans retirer aucune table de la version 1', () => {
    expect(ajDb.verno).toBe(2)
    const tables = ajDb.tables.map((table) => table.name)
    for (const nom of ['coproprietes', 'mandats', 'lots', 'ags', 'journaux', 'notifications', 'activityLog'])
      expect(tables).toContain(nom)
    expect(tables).toContain('changementsStatut')
  })
})
