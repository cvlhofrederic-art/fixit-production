// tests/helpers/aj-signalement-base.test.ts — base simulée : rappel joué après une requête attendue, from(table, rappel).
//
// C'est par ce rappel qu'une aide rejoue un trigger après les requêtes d'une table (aj-signalement-invitation.ts : la
// liaison des envois), sans poser une seconde propriété `then` sur la requête (règle S7739 : seule la requête de la base
// simulée est « thenable », comme le constructeur de requête de Supabase).

import { beforeEach, describe, expect, it } from 'vitest'
import { baseQr, type Ligne, type ReponseSimulee } from './aj-signalement-base'

interface RequeteSimulee extends PromiseLike<ReponseSimulee> {
  select(colonnes?: string): RequeteSimulee
  update(valeurs: Ligne): RequeteSimulee
  eq(colonne: string, valeur: unknown): RequeteSimulee
  single(): Promise<ReponseSimulee>
  maybeSingle(): Promise<ReponseSimulee>
}

const depuis = (table: string, rappel?: () => void) => baseQr.client.from(table, rappel) as unknown as RequeteSimulee

describe('base simulée : rappel après une requête attendue', () => {
  let ordre: string[]
  const rappel = () => { ordre.push(`rappel v=${String(baseQr.table('t')[0].v)}`) }

  beforeEach(() => {
    baseQr.reinitialiser()
    baseQr.table('t').push({ id: 'a', v: 1 })
    ordre = []
  })

  it('await : joué une fois, APRÈS l’écriture et AVANT que la réponse ne soit rendue', async () => {
    const reponse = await depuis('t', rappel).update({ v: 2 }).eq('id', 'a').select('id, v')
    ordre.push('réponse')
    expect(ordre).toEqual(['rappel v=2', 'réponse'])
    expect(reponse).toEqual({ data: [{ id: 'a', v: 2 }], error: null, count: null })
  })

  it('then(ok) : la réponse passe au rappel de l’appelant, une fois le rappel de la table joué', async () => {
    const vue = await depuis('t', rappel).select('v').then((r) => {
      ordre.push('ok')
      return r.data
    })
    expect(ordre).toEqual(['rappel v=1', 'ok'])
    expect(vue).toEqual([{ v: 1 }])
  })

  it('single() et maybeSingle() rendent une promesse : aucun rappel (comportement de l’aide des envois, gardé)', async () => {
    await depuis('t', rappel).update({ v: 3 }).eq('id', 'a').select('v').single()
    await depuis('t', rappel).select('v').eq('id', 'a').maybeSingle()
    expect(ordre).toEqual([])
  })

  it('sans rappel : réponse inchangée', async () => {
    expect(await depuis('t').select('id').eq('id', 'a')).toEqual({ data: [{ id: 'a' }], error: null, count: null })
  })
})
