import './fuseau-paris'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  creerCourrierDepuisModele,
  enregistrerAccuseReception,
  enregistrerDepot,
} from '@/lib/administrateur-judiciaire/db/courriers'
import { repoAgs, repoModelesCourrier } from '@/lib/administrateur-judiciaire/db/repositories'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb, type ChangementStatut, type Courrier } from '@/lib/administrateur-judiciaire/db/schema'
import { changerStatutAg, historiqueStatutAg, rattacherPreuveNotification } from '@/lib/administrateur-judiciaire/db/statut-assemblee'
import { etatNotificationCourrier } from '@/lib/administrateur-judiciaire/domain/courriers'
import { controlerPreuveNotificationAg, finDelaiContestationAg } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'

/**
 * Lot 3 — T30 (Courrier et ModeleCourrier : la preuve de notification) et T31 (moteur de délais accroché à la
 * notification, règle R9). Courrier ≠ Document (Règle 5) : deux tables distinctes.
 */

beforeEach(async () => {
  await viderBaseLocale()
})

const modeleNotificationPv = () =>
  repoModelesCourrier.create({ famille: 'Gestion', libelle: 'NOTIFICATION PROCES VERBAL', contexte: null, formeEnvoi: 'AR' })

describe('T30 — Courrier et ModeleCourrier', () => {
  it('Courrier et Document sont deux tables distinctes', () => {
    const tables = ajDb.tables.map((table) => table.name)
    expect(tables).toContain('courriers')
    expect(tables).toContain('modelesCourrier')
    expect(tables).toContain('documents')
  })

  it('le courrier fige la forme d’envoi de son modèle au moment de sa création', async () => {
    const modele = await modeleNotificationPv()
    const courrier = await creerCourrierDepuisModele(modele.id, { objet: 'Notification du PV', coproprieteId: 'C1' })
    expect(courrier.formeEnvoi).toBe('AR')
    expect(courrier.statut).toBe('Préparation')
    await repoModelesCourrier.update(modele.id, { formeEnvoi: 'Normal' })
    expect((await ajDb.courriers.get(courrier.id))?.formeEnvoi).toBe('AR')
  })

  it('un courrier AR déposé sans accusé de réception est « envoyé, non notifié » ; avec l’accusé, « notifié »', async () => {
    const modele = await modeleNotificationPv()
    const courrier = await creerCourrierDepuisModele(modele.id, { objet: 'Notification du PV' })
    expect(etatNotificationCourrier(courrier)).toBe('non_envoye')
    const depose = await enregistrerDepot(courrier.id, { dateDepot: '2026-03-02', referenceDiffusion: 'REF-123' })
    expect(etatNotificationCourrier(depose)).toBe('envoye_non_notifie')
    const recu = await enregistrerAccuseReception(courrier.id, '2026-03-04')
    expect(etatNotificationCourrier(recu)).toBe('notifie')
  })

  it('un courrier qui n’est pas en AR n’a pas valeur de notification ; un accusé ne s’enregistre que sur un AR', async () => {
    const modele = await repoModelesCourrier.create({ famille: 'Assemblée', libelle: 'PV ABREGE', contexte: null, formeEnvoi: 'Normal' })
    const courrier = await creerCourrierDepuisModele(modele.id, { objet: 'Affichage' })
    const depose = await enregistrerDepot(courrier.id, { dateDepot: '2026-03-02' })
    expect(etatNotificationCourrier(depose)).toBe('sans_valeur_de_notification')
    await expect(enregistrerAccuseReception(courrier.id, '2026-03-04')).rejects.toThrow(/AR/)
  })

  it('l’accusé de réception ne peut pas précéder le dépôt, et les dates sont des dates ISO', async () => {
    const modele = await modeleNotificationPv()
    const courrier = await creerCourrierDepuisModele(modele.id, { objet: 'Notification du PV' })
    await expect(enregistrerAccuseReception(courrier.id, '2026-03-04')).rejects.toThrow(/dépôt/)
    await enregistrerDepot(courrier.id, { dateDepot: '2026-03-02' })
    await expect(enregistrerAccuseReception(courrier.id, '2026-03-01')).rejects.toThrow(/précéder/)
    await expect(enregistrerDepot(courrier.id, { dateDepot: '02/03/2026' })).rejects.toThrow(/AAAA-MM-JJ/)
  })
})

const ligne = (surcharge: Partial<ChangementStatut>): ChangementStatut => ({
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

const courrier = (surcharge: Partial<Courrier>): Courrier => ({
  id: 'k1',
  modeleId: 'm1',
  formeEnvoi: 'AR',
  statut: 'A Suivre',
  objet: 'Notification du PV',
  coproprieteId: null,
  mandatId: null,
  personneId: null,
  entrepriseId: null,
  dateDepot: '2026-03-02',
  dateAccuseReception: '2026-03-04',
  referenceDiffusion: null,
  createdAt: '2026-03-02T09:00:00.000Z',
  updatedAt: '2026-03-02T09:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...surcharge,
})

describe('T31 — délai accroché à la notification (R9)', () => {
  it('le délai change si dateEffet change, et ne change pas si createdAt change', () => {
    const base = finDelaiContestationAg([ligne({})], 'ag-1')
    expect(finDelaiContestationAg([ligne({ createdAt: '2026-06-30T10:00:00.000Z' })], 'ag-1')).toBe(base)
    expect(finDelaiContestationAg([ligne({ dateEffet: '2026-03-16' })], 'ag-1')).not.toBe(base)
  })

  it('AG notifiée sans courrier AR → alerte métier « notification non prouvée »', () => {
    expect(controlerPreuveNotificationAg([ligne({ courrierId: null })], [], 'ag-1')).toEqual({
      code: 'notification_non_prouvee',
      motif: 'Aucun courrier rattaché à la notification.',
    })
    expect(controlerPreuveNotificationAg([ligne({ courrierId: 'k1' })], [courrier({ formeEnvoi: 'Normal' })], 'ag-1')).toEqual({
      code: 'notification_non_prouvee',
      motif: "Le courrier rattaché n'est pas un envoi en AR.",
    })
    expect(
      controlerPreuveNotificationAg([ligne({ courrierId: 'k1' })], [courrier({ dateAccuseReception: null })], 'ag-1'),
    ).toEqual({ code: 'notification_non_prouvee', motif: "L'accusé de réception n'est pas encore revenu." })
    expect(controlerPreuveNotificationAg([ligne({ courrierId: 'absent' })], [courrier({})], 'ag-1')?.motif).toMatch(
      /introuvable/,
    )
  })

  it('AG notifiée avec un AR reçu : notification prouvée (aucune alerte) ; AG non notifiée : rien à contrôler', () => {
    expect(controlerPreuveNotificationAg([ligne({ courrierId: 'k1' })], [courrier({})], 'ag-1')).toBeNull()
    expect(controlerPreuveNotificationAg([ligne({ statutNouveau: 'PV signé' })], [], 'ag-1')).toBeNull()
  })

  it('base locale : le changement de statut se relie au courrier AR, au moment du changement ou après coup', async () => {
    const modele = await modeleNotificationPv()
    const ar = await creerCourrierDepuisModele(modele.id, { objet: 'Notification du PV' })
    await enregistrerDepot(ar.id, { dateDepot: '2026-03-02' })
    const ag = await repoAgs.create({ coproprieteId: 'C1', date: new Date(2026, 1, 10), nature: 'Judiciaire', statut: 'Projet' })
    await changerStatutAg(ag.id, 'PV signé', { dateEffet: '2026-02-28' })
    await changerStatutAg(ag.id, 'Notifiée', { dateEffet: '2026-03-02' })
    let historique = await historiqueStatutAg(ag.id)
    let courriers = await ajDb.courriers.toArray()
    expect(controlerPreuveNotificationAg(historique, courriers, ag.id)?.code).toBe('notification_non_prouvee')

    const notification = historique[historique.length - 1]
    await rattacherPreuveNotification(notification.id, ar.id)
    await enregistrerAccuseReception(ar.id, '2026-03-04')
    historique = await historiqueStatutAg(ag.id)
    courriers = await ajDb.courriers.toArray()
    expect(historique[historique.length - 1].courrierId).toBe(ar.id)
    expect(controlerPreuveNotificationAg(historique, courriers, ag.id)).toBeNull()
  })

  it('un courrier inconnu ne peut pas être rattaché', async () => {
    const ag = await repoAgs.create({ coproprieteId: 'C1', date: new Date(2026, 1, 10), nature: 'Annuelle', statut: 'Projet' })
    await expect(changerStatutAg(ag.id, 'Convoquée', { dateEffet: '2026-02-10', courrierId: 'inconnu' })).rejects.toThrow(
      /courrier/i,
    )
    await changerStatutAg(ag.id, 'Convoquée', { dateEffet: '2026-02-10' })
    const [ligneConvocation] = await historiqueStatutAg(ag.id)
    await expect(rattacherPreuveNotification(ligneConvocation.id, 'inconnu')).rejects.toThrow(/courrier/i)
  })

  it('aucune date littérale dans les fichiers du moteur de délais d’AG et des courriers', () => {
    for (const fichier of ['statut-assemblee.ts', 'courriers.ts']) {
      const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', fichier), 'utf8')
      expect(source.match(/202[0-9]-/g), fichier).toBeNull()
    }
  })
})
