import { describe, expect, it } from 'vitest'
import { MOIS_A_COMPTER_DE_LA_DEMANDE, limiteACompterDeLaDemande } from '@/lib/administrateur-judiciaire/domain/delai-a-compter-de-la-demande'
import { enTeteDuModule } from './en-tete-module'

/**
 * « Un délai d'un mois à compter de la demande » (L. 1965 art. 8-2, fiche synthétique ; art. 21, al. 7, pièces demandées
 * par le conseil syndical) : règle de gestion comptée depuis la date connue la plus tôt (J67, R24).
 */

describe('délai d’un mois à compter de la demande (J67, R24)', () => {
  it('date de la demande seule : un mois depuis elle', () => {
    expect(limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: '2026-11-03', recueLe: null })).toEqual({
      limite: '2026-12-03',
      base: 'datee_du',
      depuis: '2026-11-03',
      fondement: 'L. 1965 art. 8-2',
      justification:
        'Délai de gestion d’un mois à compter de la demande (L. 1965 art. 8-2), compté depuis la date de la demande, le 03/11/2026 : réponse au plus tard le 03/12/2026 (J67, R24).',
    })
  })

  it('réception seule : un mois depuis elle, faute de date de la demande', () => {
    const limite = limiteACompterDeLaDemande({ objet: 'pieces_conseil_syndical', dateeDu: null, recueLe: '2026-11-05' })
    expect(limite).toMatchObject({ limite: '2026-12-05', base: 'recue_le', depuis: '2026-11-05', fondement: 'L. 1965 art. 21, al. 7' })
    expect(limite.justification).toMatch(/compté depuis sa réception, le 05\/11\/2026, faute de date de la demande/)
  })

  it('les deux dates : la plus tôt fait partir le délai', () => {
    expect(limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: '2026-11-03', recueLe: '2026-11-06' })).toMatchObject({ base: 'datee_du', limite: '2026-12-03' })
    expect(limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: '2026-11-06', recueLe: '2026-11-03' })).toMatchObject({ base: 'recue_le', limite: '2026-12-03' })
    // fin de mois bornée : le 31/01 donne le 28/02
    expect(limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: '2027-01-31', recueLe: null }).limite).toBe('2027-02-28')
    expect(MOIS_A_COMPTER_DE_LA_DEMANDE).toBe(1)
  })

  it('aucune pénalité annoncée ; jamais la date de création de l’étape : sans date de la demande ni réception, refus', () => {
    const { justification } = limiteACompterDeLaDemande({ objet: 'pieces_conseil_syndical', dateeDu: '2026-11-03', recueLe: null })
    expect(justification).not.toMatch(/pénalit/i)
    expect(() => limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: null, recueLe: null })).toThrow(/date de la demande ou de sa réception attendue/)
    expect(() => limiteACompterDeLaDemande({ objet: 'fiche_synthetique', dateeDu: '03/11/2026', recueLe: null })).toThrow(/AAAA-MM-JJ/)
    expect(() => limiteACompterDeLaDemande({ objet: 'autre' as never, dateeDu: '2026-11-03', recueLe: null })).toThrow(/objet de la demande inconnu/i)
  })

  it('en-tête : J67, R24, règle de gestion ; champs de l’étape après #741 et enregistrement à brancher', () => {
    const { texte } = enTeteDuModule('delai-a-compter-de-la-demande')
    expect(texte).toContain('J67, R24')
    expect(texte).toMatch(/règle de GESTION/)
    expect(texte).toMatch(/etapes-dossier\.ts/)
    expect(texte).toMatch(/enregistrement des deux dates : à brancher/)
  })
})
