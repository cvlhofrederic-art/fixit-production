import { afterEach, describe, expect, it } from 'vitest'
import { textePourEcran } from '@/components/administrateur-judiciaire/modules/finances/tresorerie/analyse-releve'
import { feuillesALargeur, retirerFeuilles } from './regles-a-largeur'

/**
 * PR 799, relevés importés, défauts relevés sur les captures : pastilles de la colonne « État » coupées sur deux lignes,
 * nom court d'une fiche (« …7849 ») coupé entre « … » et les quatre chiffres.
 */

afterEach(() => {
  retirerFeuilles()
  document.body.innerHTML = ''
})

describe('nom court d’une fiche dans un message à l’écran', () => {
  it('« … » et les quatre derniers chiffres de l’IBAN sont joints (aucune coupure possible entre les deux)', () => {
    expect(textePourEcran('(« Compte principal · …7849 », clôturé)')).toBe('(« Compte principal · …\u20607849 », clôturé)')
  })

  it('un « … » qui ne précède pas un chiffre est laissé tel quel', () => {
    expect(textePourEcran('Choisir le compte…')).toBe('Choisir le compte…')
  })
})

describe('colonne « État » de « Relevés lus » : la pastille ne se coupe pas', () => {
  for (const largeur of [1440, 375])
    it(`à ${largeur} px : white-space nowrap sur la pastille de la colonne État, pas sur les autres pastilles`, () => {
      feuillesALargeur(largeur)
      document.body.innerHTML = `<div id="aj-root"><table class="tbl vfx-fiches"><tbody><tr>
        <td class="vfx-etat-releve"><span class="pill amber no-dot">Non repris, à vérifier</span></td>
        <td><span class="pill amber no-dot">Autre</span></td></tr></tbody></table></div>`
      const [etat, autre] = Array.from(document.querySelectorAll<HTMLElement>('.pill'))
      expect(getComputedStyle(etat).whiteSpace).toBe('nowrap')
      expect(getComputedStyle(autre).whiteSpace).not.toBe('nowrap')
    })
})
