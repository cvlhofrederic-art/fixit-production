import './fuseau-paris'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { genererActeJuge, type ActeJugeRedige } from '@/lib/administrateur-judiciaire/domain/actes/actes-juge'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  calculerEcheancesCopropriete,
  construireContexteMandat,
  listerEcheancesPortefeuille,
  type CoproprieteMoteur,
} from '@/lib/administrateur-judiciaire/domain/echeances-mandat'
import type { Fiche360Copropriete } from '@/lib/administrateur-judiciaire/domain/fiche-360'
import type { IntentionFixy } from '@/lib/administrateur-judiciaire/domain/fixy/intentions'
import { repondreDemandeFixy, type DonneesFixy } from '@/lib/administrateur-judiciaire/domain/fixy/reponses'
import { planifierMandat } from '@/lib/administrateur-judiciaire/domain/planification-mandat'
import { construireIndexRecherche, type DonneesIndexRecherche } from '@/lib/administrateur-judiciaire/domain/recherche'
import { revivre, type CasOracle } from './oracle'

/**
 * Régressions des défauts de dates hérités de la maquette (revue, constats 10 à 13) : chaque cas levait une exception
 * (ou renvoyait une date « 10000-… » illisible par les écrans) avec le code d'origine. Les cas ordinaires restent
 * couverts par les fixtures oracle ; ici, les résultats attendus des cas corrigés sont dérivés de ces fixtures.
 */
const lireJson = (nom: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', nom), 'utf8'))

const casOracle = (fixture: string, id: string): CasOracle => {
  const trouve = (lireJson(fixture) as CasOracle[]).find((c) => c.id === id)
  if (!trouve) throw new Error(`Cas introuvable : ${id}`)
  return trouve
}

const argumentsOracle = (fixture: string, id: string): unknown[] => revivre(casOracle(fixture, id).args) as unknown[]

type CoproIndex = DonneesIndexRecherche['copros'][number]

/** Copropriété de démonstration LM (vue de la base, telle que capturée dans la maquette). */
const coproLM = (): CoproIndex => argumentsOracle('logique-metier.json', 'calculerEcheancesCopropriete#1')[0] as CoproIndex

/** Même copropriété, mandat daté à la fin du calendrier (ordonnance 9999, échéance enregistrée en 10000). */
const coproHorsCalendrier = (modifs: Partial<CoproprieteMoteur> = {}): CoproIndex => ({
  ...coproLM(),
  id: 'CZZ',
  code: 'ZZ',
  nom: 'Résidence An 9999',
  notifOrdonnance: '',
  ordonnance: new Date(9999, 2, 15),
  dureeMois: 12,
  echeance: new Date(10000, 2, 15),
  ...modifs,
})

const toutesDatesValides = (resultat: ReturnType<typeof calculerEcheancesCopropriete>): boolean =>
  resultat.echeances.every((echeance) =>
    [echeance.dateLegale, echeance.dateProrogee, echeance.dateRetenue, echeance.depart.date].every(
      (date) => date === null || estDateIsoValide(date),
    ),
  )

describe('constat 10 — échéances d’un mandat hors du calendrier ISO (année au-delà de 9999)', () => {
  it('une échéance enregistrée en 10000 (ordonnance du 15/03/9999, 12 mois) ne fait plus lever le moteur', () => {
    const resultat = calculerEcheancesCopropriete(coproHorsCalendrier())
    expect(resultat.etat).toBe('hors_perimetre')
    expect(resultat.echeances).toEqual([])
    expect(resultat.contexte).toBeNull()
  })

  it('une ordonnance du 15/12/9999 ne renvoie plus de date « 10000-… » (art. 46, sans durée)', () => {
    const resultat = calculerEcheancesCopropriete(
      coproHorsCalendrier({ ordonnance: new Date(9999, 11, 15), dureeMois: 0, echeance: null }),
    )
    expect(toutesDatesValides(resultat)).toBe(true)
    expect(resultat.etat).toBe('hors_perimetre')
  })

  it('une ordonnance du 15/03/9999 en art. 29-1 ne renvoie plus de date « 10000-… » (suspension d’exigibilité)', () => {
    const resultat = calculerEcheancesCopropriete(
      coproHorsCalendrier({
        fondement: 'Administration provisoire (art. 29-1)',
        dureeMois: 0,
        echeance: null,
      }),
    )
    expect(toutesDatesValides(resultat)).toBe(true)
    expect(resultat.etat).toBe('hors_perimetre')
  })

  it('une ordonnance datée au-delà de 9999 est traitée comme une ordonnance invalide', () => {
    expect(calculerEcheancesCopropriete(coproHorsCalendrier({ ordonnance: new Date(10000, 0, 15) })).etat).toBe(
      'ordonnance_manquante',
    )
  })

  it('le contexte du moteur écarte une échéance hors calendrier comme une Date invalide', () => {
    expect(
      construireContexteMandat({
        fondement: 'art. 46 — carence',
        ordonnance: new Date(2026, 2, 12),
        dureeMois: 12,
        echeance: new Date(10000, 2, 12),
      }),
    ).toEqual({ regime: 'sj', dateOrdonnance: '2026-03-12', dureeMissionMois: 12, dateFinMission: null })
  })

  it('le portefeuille et l’index de recherche (rendu du Shell) se construisent sans cette copropriété', () => {
    const lm = coproLM()
    expect(listerEcheancesPortefeuille([lm, coproHorsCalendrier()])).toEqual(listerEcheancesPortefeuille([lm]))
    const donnees = argumentsOracle('logique-metier.json', 'construireIndexRecherche#1')[0] as DonneesIndexRecherche
    const attendu = construireIndexRecherche(donnees)
    const index = construireIndexRecherche({ ...donnees, copros: [...donnees.copros, coproHorsCalendrier()] })
    expect(index.filter((entree) => entree.id !== 'copro:ZZ')).toEqual(attendu)
    expect(index.filter((entree) => entree.id.includes(':ZZ'))).toHaveLength(1)
  })
})

describe('constat 11 — requête en prorogation avec une durée décimale ou démesurée', () => {
  const idCas = 'genererActeJuge#LM-P4-2026-06-04'
  const rediger = (dureeProrogation: number): ActeJugeRedige => {
    const [fiche, impayes, params, reference] = argumentsOracle('actes.json', idCas) as Parameters<
      typeof genererActeJuge
    >
    return genererActeJuge(fiche, impayes, { ...params, dureeProrogation }, reference)
  }
  const attendu = casOracle('actes.json', idCas).attendu as ActeJugeRedige
  const demandeOracle = "proroger la mission pour une durée de 12 mois, soit jusqu'au 12/03/2028, aux fins de"

  it('la fixture de référence cite la nouvelle fin de mission', () => {
    expect(attendu.texte).toContain(demandeOracle)
    expect(rediger(12)).toEqual(attendu)
  })

  it.each([
    [6.5, '6.5'],
    [100000, '100000'],
  ])('durée %s : l’acte est rédigé sans « soit jusqu’au … » au lieu de lever', (duree, libelle) => {
    expect(rediger(duree)).toEqual({
      ...attendu,
      texte: attendu.texte.replace(demandeOracle, `proroger la mission pour une durée de ${libelle} mois, aux fins de`),
    })
  })
})

describe('constat 12 — assistant de mandat : fin de mission ou délais hors du calendrier ISO', () => {
  const fondements = [
    'art. 46 décret du 17 mars 1967 (carence)',
    'art. 47 décret du 17 mars 1967 (syndicat dépourvu de syndic)',
    'art. 29-1 loi du 10 juillet 1965 (copropriété en difficulté)',
  ]

  it.each(fondements)('durée « 99999 » : plan de durée inconnue, comme une durée illisible (%s)', (fondement) => {
    const plan = planifierMandat({ ordonnance: '04/06/2026', duree: '99999', fondement })
    expect(plan).toEqual(planifierMandat({ ordonnance: '04/06/2026', duree: '', fondement }))
    expect(plan.ech).toBe('')
    expect('erreur' in plan).toBe(false)
  })

  it('ordonnance du 15/12/9999 : rejet de l’ordonnance, comme une date invalide', () => {
    expect(planifierMandat({ ordonnance: '15/12/9999', duree: '', fondement: fondements[0] })).toEqual(
      planifierMandat({ ordonnance: '31/02/2026', duree: '', fondement: fondements[0] }),
    )
  })

  it.each(fondements)('ordonnance du 15/03/9999 pour 12 mois : plus d’exception (%s)', (fondement) => {
    const plan = planifierMandat({ ordonnance: '15/03/9999', duree: '12', fondement })
    const datesFr = [...plan.calendar.map((e) => e.date), ...plan.taches.map((t) => t.date)]
    expect(datesFr.every((date) => /^\d{2}\/\d{2}\/\d{4}$/.test(date))).toBe(true)
  })

  it('les longues durées qui restent dans le calendrier sont inchangées (oracle : 1500 et 95000 mois)', () => {
    expect(planifierMandat({ ordonnance: '04/06/2026', duree: '1500', fondement: fondements[0] }).ech).toBe('04/06/2151')
    expect(planifierMandat({ ordonnance: '04/06/2026', duree: '95000', fondement: fondements[0] }).ech).toBe(
      '04/02/9943',
    )
  })
})

describe('constat 13 — Fixy interrogé sur une copropriété sans mandat', () => {
  const entrees = lireJson('fixy-entrees.json') as { etendu: { fichesCopro: Record<string, unknown> } }
  const fiche = (code: string): Fiche360Copropriete =>
    revivre(entrees.etendu.fichesCopro[code]) as Fiche360Copropriete
  const intention = (code: string, label: string): IntentionFixy => ({
    texte: label,
    cible: {
      id: `copro:${code}`,
      type: 'copro',
      label,
      sub: '',
      icon: 'building',
      route: 'fiche360',
      selection: { code },
    },
    detail: null,
    confiance: 'forte',
    type: 'copro',
  })
  const donnees = (ficheCopro: Fiche360Copropriete): DonneesFixy => ({
    reference: '2026-09-29',
    ficheCopro: (code) => (code === ficheCopro.vue.code ? ficheCopro : null),
    fichePersonne: () => null,
    copros: [{ code: ficheCopro.vue.code, nom: ficheCopro.vue.nom }],
    ordresDeService: [],
    impayes: [],
  })

  it('l’ordonnance d’une vue sans mandat (chaîne createdAt) s’affiche « · » au lieu de lever une TypeError', () => {
    const zy = fiche('ZY')
    expect(typeof zy.vue.ordonnance).toBe('string')
    const reponse = repondreDemandeFixy(intention('ZY', 'Résidence Zéro'), donnees(zy))
    expect(reponse.lignes[1]).toBe('Ordonnance du · · · mois · notification non renseignée · statut .')
  })

  it('une ordonnance Date invalide s’affiche « · » au lieu de lever une RangeError', () => {
    const lm = fiche('LM')
    const invalide = { ...lm, vue: { ...lm.vue, ordonnance: new Date(Number.NaN) } }
    expect(repondreDemandeFixy(intention('LM', lm.vue.nom), donnees(invalide)).lignes[1]).toMatch(/^Ordonnance du · · /)
  })

  it('une ordonnance valide reste lue via toISOString (veille UTC), comme dans la maquette', () => {
    const lm = fiche('LM')
    expect(repondreDemandeFixy(intention('LM', lm.vue.nom), donnees(lm)).lignes[1]).toMatch(
      /^Ordonnance du 11\/03\/2026 · 12 mois · /,
    )
  })
})
