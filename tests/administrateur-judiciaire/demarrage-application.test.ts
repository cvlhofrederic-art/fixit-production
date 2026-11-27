import './fuseau-paris'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { demarrerApplication, reinitialiserDemarrageEnTest } from '@/components/administrateur-judiciaire/AdministrateurJudiciaireApp'
import { viderBaseLocale } from '@/lib/administrateur-judiciaire/db/reset'
import { ajDb } from '@/lib/administrateur-judiciaire/db/schema'
import { CLE_STOCKAGE_MODE } from '@/lib/administrateur-judiciaire/mode'

/**
 * Démarrage de l'application (demarrerApplication) : base de démonstration, puis compte bancaire fictif (rb-07 A,
 * décision du 26/11/2026). Le démarrage est mémorisé au niveau du module : chaque test le réinitialise.
 */

beforeEach(async () => {
  localStorage.removeItem(CLE_STOCKAGE_MODE)
  reinitialiserDemarrageEnTest()
  await viderBaseLocale()
})

describe('demarrerApplication', () => {
  it('en démonstration, base vidée : exactement un compte de démonstration, sur la copropriété C2', async () => {
    await demarrerApplication()
    const comptes = await ajDb.banques.toArray()
    expect(comptes).toHaveLength(1)
    expect(comptes[0].coproprieteId).toBe('C2')
  })

  it('un second appel ne relance pas le démarrage (un seul compte)', async () => {
    await demarrerApplication()
    await demarrerApplication()
    expect(await ajDb.banques.count()).toBe(1)
  })

  it('en mode réel : aucun compte n’est ajouté', async () => {
    localStorage.setItem(CLE_STOCKAGE_MODE, 'reel')
    await demarrerApplication()
    expect(await ajDb.banques.count()).toBe(0)
  })
})
