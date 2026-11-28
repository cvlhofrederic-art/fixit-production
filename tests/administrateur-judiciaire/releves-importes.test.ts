import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dedoublonnerRelevesStructures, reconnaitreReleve, empreinteReleve } from '@/lib/administrateur-judiciaire/domain/import/doublons-releves'
import { lireReleve } from '@/lib/administrateur-judiciaire/domain/import/lecture-releve'
import type { ReleveCompte } from '@/lib/administrateur-judiciaire/domain/import/releve-compte'
import {
  dejaImporteSurCompte,
  dernierReleveAu,
  origineDuMouvement,
  releveImporte,
  soldeBanquePropose,
  type ReleveImporte,
} from '@/lib/administrateur-judiciaire/domain/import/releves-importes'

/**
 * Relevés importés gardés (décision du 26/11/2026 du référent métier, PR 799, points 10 B, 11 B et 3 C) : ce qui est
 * gardé d'un relevé structuré (CFONB 120, camt.053) et de chacun de ses mouvements, ce qui en est relu pour reconnaître
 * un relevé ou un mouvement déjà importé, et le solde de clôture proposé comme solde banque d'un arrêté. Fonctions pures.
 * Fichiers fictifs : tests/administrateur-judiciaire/fixtures/releves/.
 */

const dossier = join(__dirname, 'fixtures', 'releves')
const CFONB = readFileSync(join(dossier, 'releve-nominal.cfonb120.txt'), 'latin1').replaceAll('\r\n', '\n')
const CAMT = readFileSync(join(dossier, 'releve-nominal.camt053.xml'), 'utf8')
/** Relevés 1 et 3 du fichier CFONB : ceux du seul compte 12345 00010 00012345678. */
const CFONB_UN_COMPTE = CFONB.split('\n')
  .filter((ligne) => !ligne.includes('00087654321'))
  .join('\n')

const relevesCfonb = (): ReleveCompte[] => lireReleve(CFONB_UN_COMPTE).releves
const relevesCamt = (): ReleveCompte[] => lireReleve(CAMT).releves

const contexte = (id: string, surcharge: Partial<{ banqueId: string; dateImport: string }> = {}) => ({
  id,
  coproprieteId: 'C2',
  banqueId: surcharge.banqueId ?? 'B1',
  dateImport: surcharge.dateImport ?? '2026-11-27',
})

/** Relevé gardé d'un relevé lu, repris en entier. */
const garde = (releve: ReleveCompte, id: string, surcharge: Partial<{ banqueId: string; dateImport: string }> = {}): ReleveImporte =>
  releveImporte({ releve, repris: releve.mouvements }, contexte(id, surcharge))

describe('ce qui est gardé d’un relevé importé', () => {
  it('empreinte complète, compte bancaire, copropriété, format, nombre de mouvements et date d’import', () => {
    const [releve] = relevesCamt()
    const gardeDuReleve = garde(releve, 'R1')
    expect(gardeDuReleve).toEqual({
      id: 'R1',
      coproprieteId: 'C2',
      banqueId: 'B1',
      dateImport: '2026-11-27',
      format: 'camt053',
      rang: 1,
      decimales: 2,
      nombreMouvements: 4,
      nombreMouvementsRepris: 4,
      ...empreinteReleve(releve),
    })
    // Le solde de clôture et l'identifiant du relevé, perdus jusqu'ici à l'enregistrement, sont gardés.
    expect(gardeDuReleve.identifiant).toBe('RELEVE-2026-10-05-A')
    expect(gardeDuReleve.soldeClotureMineur).toBe(releve.soldeClotureMineur)
    expect(gardeDuReleve.dateCloture).toBe('2026-10-05')
  })

  it('relevé repris en partie : le nombre de mouvements repris est gardé à côté du nombre de mouvements du relevé', () => {
    const [releve] = relevesCamt()
    expect(releveImporte({ releve, repris: releve.mouvements.slice(1) }, contexte('R1'))).toMatchObject({
      nombreMouvements: 4,
      nombreMouvementsRepris: 3,
    })
  })

  it('aucun mouvement, ni libellé ni montant de ligne, n’est recopié dans le relevé gardé', () => {
    expect(Object.keys(garde(relevesCamt()[0], 'R1'))).not.toContain('mouvements')
  })
})

describe('ce qui est gardé de chaque mouvement importé', () => {
  it('référence de la banque, date de valeur, payeur, et tout ce que le lecteur rend en plus de la ligne', () => {
    const [releve] = relevesCamt(),
      [mouvement] = releve.mouvements,
      origine = origineDuMouvement('R1', mouvement)
    expect(origine.releveId).toBe('R1')
    expect(origine.referenceBanque).toBe(mouvement.referenceBanque)
    expect(origine.dateValeur).toBe(mouvement.dateValeur)
    expect(origine.payeur).toBe(mouvement.payeur)
    expect(origine.referenceBanque).not.toBeNull()
    expect(origine.dateValeur).not.toBeNull()
    expect(origine.payeur).not.toBeNull()
    // Rien de ce que le lecteur rend n'est perdu : chaque champ du mouvement est soit dans l'écriture (date, libellé,
    // montant), soit dans l'origine gardée.
    const { date, libelle, montant, ...enPlus } = mouvement
    expect([date, libelle, montant]).toHaveLength(3)
    expect(origine).toEqual({ releveId: 'R1', ...enPlus })
  })

  it('CFONB 120 : les enregistrements complémentaires (05) du mouvement sont gardés', () => {
    const mouvement = relevesCfonb()
      .flatMap((releve) => releve.mouvements)
      .find((candidat) => candidat.complements.length > 0)
    expect(mouvement).toBeDefined()
    if (!mouvement) return
    expect(origineDuMouvement('R1', mouvement).complements).toEqual(mouvement.complements)
  })
})

describe('relevé ou mouvement déjà importé, relu de ce qui est gardé', () => {
  it('relevé gardé à un import précédent : reconnu à l’import suivant, aucun de ses mouvements n’est repris', () => {
    const releves = relevesCfonb(),
      gardes = releves.map((releve, rang) => garde(releve, `R${rang + 1}`)),
      resultat = dedoublonnerRelevesStructures(relevesCfonb(), dejaImporteSurCompte(gardes, []))
    expect(resultat.lignes).toEqual([])
    expect(resultat.nouveaux).toEqual([])
    expect(resultat.dejaImportes.map((releve) => releve.rang)).toEqual([1, 2])
    // Le relevé gardé qui a fait reconnaître chaque relevé est rendu tel quel (sa date d'import est dite à l'écran).
    expect(resultat.reconnus.map((reconnu) => [reconnu.releve.rang, reconnu.comparaison, reconnu.connu])).toEqual([
      [1, 'identique', gardes[0]],
      [2, 'identique', gardes[1]],
    ])
    expect(resultat.reconnus.map((reconnu) => reconnu.avertissement)).toEqual(resultat.avertissements)
  })

  it('le même relevé gardé d’un CFONB 120 est reconnu dans un camt.053 (RIB et IBAN, période, soldes, totaux)', () => {
    const gardes = lireReleve(CFONB).releves.map((releve, rang) => garde(releve, `R${rang + 1}`)),
      resultat = dedoublonnerRelevesStructures(relevesCamt(), dejaImporteSurCompte(gardes, []))
    expect(resultat.dejaImportes.map((releve) => releve.rang)).toEqual([1, 2])
  })

  it('relevé d’un autre fichier dont un mouvement a déjà été importé : seul ce mouvement est écarté, par sa référence', () => {
    const [premier] = relevesCamt(),
      gardeDuPremier = garde(premier, 'R1'),
      lignes = premier.mouvements.map((mouvement) => ({ date: mouvement.date, releve: origineDuMouvement('R1', mouvement) })),
      // Relevé suivant (autre identifiant, autre période), qui reprend le premier mouvement du relevé déjà importé.
      suivant: ReleveCompte = {
        ...premier,
        identifiant: 'RELEVE-2026-10-06-A',
        dateOuverture: '2026-10-05',
        dateCloture: '2026-10-06',
        soldeOuvertureMineur: premier.soldeClotureMineur,
        soldeClotureMineur: premier.soldeClotureMineur + premier.mouvements[0].montantMineur,
        totalCreditsMineur: Math.max(premier.mouvements[0].montantMineur, 0),
        totalDebitsMineur: Math.max(-premier.mouvements[0].montantMineur, 0),
        mouvements: [premier.mouvements[0]],
      },
      resultat = dedoublonnerRelevesStructures([suivant], dejaImporteSurCompte([gardeDuPremier], lignes))
    expect(resultat.nouveaux).toEqual([suivant])
    expect(resultat.doublons).toEqual([premier.mouvements[0]])
    expect(resultat.lignes).toEqual([])
  })

  it('ligne sans origine (CSV, import antérieur à cette version) ou d’un relevé qui n’est plus gardé : jamais une empreinte', () => {
    const [premier] = relevesCamt()
    const deja = dejaImporteSurCompte(
      [garde(premier, 'R1')],
      [
        { date: '2026-10-01' },
        { date: '2026-10-01', releve: null },
        { date: premier.mouvements[0].date, releve: origineDuMouvement('R-inconnu', premier.mouvements[0]) },
      ],
    )
    expect(deja.releves).toHaveLength(1)
    expect(deja.mouvements).toEqual([])
  })

  it('reconnaitreReleve : identique, même identifiant mais contenu différent, ou inconnu', () => {
    const [premier, second] = relevesCamt(),
      connus = [garde(premier, 'R1')]
    expect(reconnaitreReleve(empreinteReleve(premier), connus)).toEqual({ connu: connus[0], comparaison: 'identique' })
    expect(reconnaitreReleve({ ...empreinteReleve(premier), soldeClotureMineur: 1 }, connus)).toEqual({ connu: connus[0], comparaison: 'identifiant' })
    expect(reconnaitreReleve(empreinteReleve(second), connus)).toBeNull()
  })

  it('reconnaitreReleve, relevé sans identifiant (CFONB 120) : même période qu’un relevé gardé, autre solde (réponse du 28/11/2026, point #858 · 2 A)', () => {
    const [premier, suivant] = relevesCfonb(),
      connus = [garde(premier, 'R1')]
    expect(reconnaitreReleve(empreinteReleve(premier), connus)).toEqual({ connu: connus[0], comparaison: 'identique' })
    expect(reconnaitreReleve({ ...empreinteReleve(premier), soldeClotureMineur: 1 }, connus)).toEqual({ connu: connus[0], comparaison: 'periode' })
    expect(reconnaitreReleve({ ...empreinteReleve(premier), soldeOuvertureMineur: 1 }, connus)).toEqual({ connu: connus[0], comparaison: 'periode' })
    // Relevé de la période suivante : inconnu, il sera repris.
    expect(reconnaitreReleve(empreinteReleve(suivant), connus)).toBeNull()
  })
})

describe('solde banque proposé à « Nouvel arrêté » : solde de clôture du dernier relevé importé du compte à la date', () => {
  const [premier] = relevesCamt()
  const releve = (id: string, dateCloture: string, soldeClotureMineur: number, surcharge: Partial<ReleveImporte> = {}): ReleveImporte => ({
    ...garde(premier, id),
    identifiant: id,
    dateOuverture: dateCloture,
    dateCloture,
    soldeClotureMineur,
    ...surcharge,
  })

  it('aucun relevé importé sur le compte : rien n’est proposé', () => {
    expect(soldeBanquePropose([], 'B1', '2026-10-31')).toBeNull()
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 47_294, { banqueId: 'B2' })], 'B1', '2026-10-31')).toBeNull()
  })

  it('relevé clos le jour de l’arrêté : son solde de clôture, daté du relevé, sans réserve', () => {
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 47_294)], 'B1', '2026-10-05')).toEqual({
      centimes: 47_294,
      dateReleve: '2026-10-05',
      anterieur: false,
    })
  })

  it('dernier relevé clos avant la date : proposé, et dit antérieur à la date de l’arrêté', () => {
    const releves = [releve('R1', '2026-09-30', 10_000), releve('R2', '2026-10-05', -3_550), releve('R3', '2026-10-20', 99_900)]
    expect(soldeBanquePropose(releves, 'B1', '2026-10-10')).toEqual({ centimes: -3_550, dateReleve: '2026-10-05', anterieur: true })
    // Un relevé clos après la date de l'arrêté n'est jamais proposé.
    expect(soldeBanquePropose(releves, 'B1', '2026-09-29')).toBeNull()
    expect(dernierReleveAu(releves, 'B1', '2026-12-31')?.id).toBe('R3')
  })

  it('deux relevés clos le même jour : le dernier enregistré (ordre de la liste lue de la base)', () => {
    const releves = [releve('R1', '2026-10-05', 10_000), releve('R2', '2026-10-05', 20_000)]
    expect(dernierReleveAu(releves, 'B1', '2026-10-05')?.id).toBe('R2')
  })

  it('date de l’arrêté illisible, relevé dans une autre devise ou au solde illisible : rien n’est proposé', () => {
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 47_294)], 'B1', '')).toBeNull()
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 47_294)], 'B1', '2026-13-40')).toBeNull()
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 47_294, { devise: 'USD' })], 'B1', '2026-10-05')).toBeNull()
    expect(soldeBanquePropose([releve('R1', '2026-10-05', 472.94)], 'B1', '2026-10-05')).toBeNull()
    expect(soldeBanquePropose([releve('R1', 'pas-une-date', 47_294)], 'B1', '2026-10-05')).toBeNull()
  })
})
