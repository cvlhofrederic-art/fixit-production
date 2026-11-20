import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Décisions du 20/11/2026 (partie C), intégration des sept thèmes : quand deux thèmes complètent l'en-tête du même
 * module, l'en-tête garde un seul bloc « Décisions du 20/11/2026 », et chaque décision y est un point de liste. Aucune
 * décision n'est retirée : seul leur regroupement change.
 */

const enTeteBrut = (module: string): string => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', `${module}.ts`), 'utf8').replaceAll('\r\n', '\n')
  return source.slice(0, source.indexOf('\n */'))
}

/** Les blocs « Décisions du 20/11/2026 … : », chacun jusqu'à la ligne « * » vide suivante. */
const blocsDesDecisions = (module: string): string[] => {
  const enTete = enTeteBrut(module)
  const blocs: string[] = []
  for (let i = enTete.indexOf('\n * Décisions du 20/11/2026'); i >= 0; i = enTete.indexOf('\n * Décisions du 20/11/2026', i + 1)) {
    const fin = enTete.indexOf('\n *\n', i)
    blocs.push(enTete.slice(i, fin < 0 ? enTete.length : fin))
  }
  return blocs
}

const pointsDuBloc = (bloc: string): string[] => [...bloc.matchAll(/\n \* - Décision du 20\/11\/2026 \(partie C, (F\d+)\)/g)].map(([, id]) => id)

describe('décisions du 20/11/2026 — intégration des en-têtes', () => {
  it('virement-interne.ts : un seul bloc des décisions, F95 et F96 (travaux et fonds) puis F103 et F112 (appels et banque)', () => {
    const blocs = blocsDesDecisions('virement-interne')
    expect(blocs).toHaveLength(1)
    expect(pointsDuBloc(blocs[0])).toEqual(['F95', 'F96', 'F103', 'F112'])
  })

  it('envoi-ordre-service.ts : F67 (travaux et fonds) est un point du bloc des décisions, avant F77, F81 et F82 (ordre des numéros)', () => {
    const blocs = blocsDesDecisions('envoi-ordre-service')
    expect(blocs).toHaveLength(1)
    expect(pointsDuBloc(blocs[0])).toEqual(['F67', 'F77', 'F81', 'F82'])
    expect(enTeteBrut('envoi-ordre-service')).not.toMatch(/\n \* Décision du 20\/11\/2026 \(partie C, F67\)/)
  })
})
