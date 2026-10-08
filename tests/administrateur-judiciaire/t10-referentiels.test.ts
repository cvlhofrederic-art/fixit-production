import { describe, expect, expectTypeOf, it } from 'vitest'
import * as referentiels from '@/lib/data/referentiels-gesteam-judiciaire'
import {
  NATURE_ASSEMBLEE,
  REFERENTIELS_MANQUANTS,
  REFERENTIELS_TRACABILITE,
  STATUT_ASSEMBLEE,
  TYPE_SRU,
  type NatureAssemblee,
  type TypeSru,
} from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * T10 (intégration Gestéam, lot 1) : le fichier de référentiels issus de la cartographie Gestéam 5.4.22 est intégré
 * au domaine de la succursale, compile, et s'importe avec ses types unions.
 */

describe('T10 — référentiels Gestéam intégrés au domaine', () => {
  it('s’importe avec ses constantes et ses types unions', () => {
    expect(TYPE_SRU).toHaveLength(14)
    expect(TYPE_SRU).toContain('Travaux - Provisions')
    expectTypeOf<'Budget - Dépenses'>().toMatchTypeOf<TypeSru>()
    // @ts-expect-error — un libellé hors référentiel ne compile pas
    const horsListe: TypeSru = 'Budget - Dépense'
    expect(horsListe).toBe('Budget - Dépense')
  })

  it('porte la nature judiciaire de l’assemblée et le cycle de statut légal en quatre états', () => {
    expect(NATURE_ASSEMBLEE).toContain('Judiciaire' satisfies NatureAssemblee)
    expect([...STATUT_ASSEMBLEE]).toEqual(['Projet', 'Convoquée', 'PV signé', 'Notifiée'])
  })

  it('chaque constante tracée existe, et les manques sont documentés', () => {
    const exports = referentiels as Record<string, unknown>
    for (const trace of REFERENTIELS_TRACABILITE) {
      const valeur = exports[trace.nom]
      expect(valeur, trace.nom).toBeDefined()
      // Liste plate, ou objet groupé par blocs (FAMILLE_TRAITEMENT, DOMAINE…) : on compte les valeurs à plat.
      const valeurs = Array.isArray(valeur) ? valeur : Object.values(valeur as Record<string, unknown>).flat(2)
      expect(valeurs.length, trace.nom).toBe(trace.nbValeurs)
    }
    expect(REFERENTIELS_MANQUANTS.length).toBeGreaterThan(0)
    for (const manque of REFERENTIELS_MANQUANTS) expect(manque.bloqueur.length).toBeGreaterThan(0)
  })
})
