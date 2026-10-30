import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  JOURS_PRESENTATION_AVANT_REUNION,
  constaterCarence,
  controlerSuitesCarence,
  suitesProposees,
  type SaisieCarence,
} from '@/lib/administrateur-judiciaire/domain/carence-assemblee'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Carence d'une assemblée (point 23 du bilan 2 ; Gestéam : bouton « Carence » de la fiche AG, nature « Judiciaire »,
 * modèle « PV de carence » — tranches 22 et 31). Textes relus sur Légifrance le 29/10/2026.
 * - « Carence » n'est pas un terme légal pour une assemblée : la loi parle de l'assemblée convoquée pour désigner un
 *   syndic qui ne le nomme pas (L. 1965 art. 17, al. 3 ; D. 1967 art. 46).
 * - Syndic désigné par le juge (art. 46) : nouvelle convocation, requête en désignation, prorogation par requête.
 * - Administrateur de l'art. 47 : nouvelle convocation, requête en désignation ; pas de prorogation de fait.
 * - Administrateur provisoire (art. 29-1) : nouvelle convocation, prolongation de la mission (29-1, I, al. 3), compte
 *   rendu au juge (D. 62-11).
 * - Distincte de l'ordonnance de carence du mandat (art. 47), que porte mandat-judiciaire.ts.
 */

const saisie = (surcharge: Partial<SaisieCarence> = {}): SaisieCarence => ({
  agId: 'AG-2026-1',
  date: '2026-10-20',
  motif: 'syndic_non_designe',
  objetDesignationSyndic: true,
  ...surcharge,
})

const codes = (suites: { code: string }[]) => suites.map((s) => s.code)
const carence = (regime: Regime | null, surcharge: Partial<SaisieCarence> = {}) => constaterCarence(saisie(surcharge), { regime })

describe('constat', () => {
  it('constate la carence d’une assemblée, avec son motif, son régime et ses suites', () => {
    expect(carence('ap47')).toMatchObject({
      agId: 'AG-2026-1',
      date: '2026-10-20',
      motif: 'syndic_non_designe',
      objetDesignationSyndic: true,
      regime: 'ap47',
    })
    expect(codes(carence('ap47', { motif: 'aucun_participant', objetDesignationSyndic: false }).suites)).toEqual([
      'nouvelle_convocation',
      'information_juge',
    ])
  })

  it('refuse une date, un motif ou une assemblée invalides', () => {
    expect(() => carence('ap47', { date: '20/10/2026' })).toThrow(/AAAA-MM-JJ/)
    // @ts-expect-error — motif inconnu
    expect(() => carence('ap47', { motif: 'quorum' })).toThrow(/motif/i)
    expect(() => carence('ap47', { agId: ' ' })).toThrow(/assemblée/i)
    expect(() => carence('ap47', { motif: 'syndic_non_designe', objetDesignationSyndic: false })).toThrow(/désignation/i)
  })
})

describe('suites proposées selon le régime', () => {
  it('administrateur de l’art. 47 : nouvelle convocation, requête en désignation (requérants de l’art. 17 et du D. 46), information du juge', () => {
    const suites = suitesProposees({ regime: 'ap47', objetDesignationSyndic: true })
    expect(codes(suites)).toEqual(['nouvelle_convocation', 'requete_designation_syndic', 'information_juge'])
    const requete = suites.find((s) => s.code === 'requete_designation_syndic')
    expect(requete).toMatchObject({ fondement: 'L. 1965 art. 17, al. 3 ; D. 1967 art. 46' })
    expect(requete?.libelle).toMatch(/copropriétaires, un ou plusieurs membres du conseil syndical, le maire ou le président de l'EPCI/)
    expect(codes(suitesProposees({ regime: 'ap47', objetDesignationSyndic: false }))).toEqual(['nouvelle_convocation', 'information_juge'])
  })

  it('syndic désigné par le juge (art. 46) : requête en désignation et prorogation par requête, si l’AG devait désigner un syndic', () => {
    const suites = suitesProposees({ regime: 'sj', objetDesignationSyndic: true })
    expect(codes(suites)).toEqual(['nouvelle_convocation', 'requete_designation_syndic', 'prorogation_mission', 'information_juge'])
    expect(suites.find((s) => s.code === 'prorogation_mission')).toMatchObject({ fondement: 'D. 1967 art. 46', aConfirmer: false })
    expect(codes(suitesProposees({ regime: 'sj', objetDesignationSyndic: false }))).toEqual(['nouvelle_convocation', 'information_juge'])
  })

  it('administrateur provisoire (art. 29-1) : prolongation de la mission (29-1, I, al. 3), compte rendu au juge (D. 62-11)', () => {
    const suites = suitesProposees({ regime: 'ap291', objetDesignationSyndic: true })
    expect(codes(suites)).toEqual(['nouvelle_convocation', 'prorogation_mission', 'information_juge'])
    expect(suites.find((s) => s.code === 'prorogation_mission')).toMatchObject({ fondement: 'L. 1965 art. 29-1, I, al. 3' })
    expect(suites.find((s) => s.code === 'information_juge')).toMatchObject({ fondement: 'D. 1967 art. 62-11', aConfirmer: false })
    expect(codes(suitesProposees({ regime: 'ap291', objetDesignationSyndic: false }))).toEqual(['nouvelle_convocation', 'information_juge'])
  })

  it.each(['sj', 'ap47'] as const)('information du juge en régime « %s » : selon l’ordonnance, à confirmer', (regime) => {
    expect(suitesProposees({ regime, objetDesignationSyndic: true }).find((s) => s.code === 'information_juge')).toMatchObject({
      fondement: null,
      aConfirmer: true,
    })
  })

  it('nouvelle convocation : délai plus long du règlement et urgence rappelés ; régime inconnu : cette suite seule', () => {
    const [convocation] = suitesProposees({ regime: null, objetDesignationSyndic: true })
    expect(convocation.libelle).toMatch(/délai plus long du règlement de copropriété\), sauf urgence/)
    expect(codes(suitesProposees({ regime: null, objetDesignationSyndic: true }))).toEqual(['nouvelle_convocation'])
  })
})

describe('contrôle des suites', () => {
  const aujourdhui = '2026-10-29'

  it('mission en cours, assez longue pour une nouvelle convocation : rien à signaler', () => {
    expect(controlerSuitesCarence(carence('ap47'), { dateFinMission: '2027-03-31' }, aujourdhui)).toEqual([])
  })

  it('mission expirée : pas de prorogation de fait (art. 47) ; nouvelle désignation (art. 46)', () => {
    const ap47 = controlerSuitesCarence(carence('ap47'), { dateFinMission: '2026-10-25' }, aujourdhui)
    expect(ap47).toMatchObject([{ code: 'mission_expiree', fondement: 'D. 1967 art. 47' }])
    expect(ap47[0].message).toMatch(/pas de prorogation de fait.*14-24\.989/)
    const sj = controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-10-25' }, aujourdhui)
    expect(sj).toMatchObject([{ code: 'mission_expiree', fondement: 'D. 1967 art. 46' }])
    expect(sj[0].message).toMatch(/nouvelle désignation/)
  })

  it('mission qui s’achève avant la réunion la plus proche possible : prorogation d’abord (art. 46, art. 29-1), juge à saisir (art. 47, à confirmer)', () => {
    const sj = controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-11-15' }, aujourdhui)
    expect(sj).toMatchObject([{ code: 'mission_trop_courte', aConfirmer: false }])
    expect(sj[0].message).toMatch(/20\/11\/2026.*prorogation/)
    expect(controlerSuitesCarence(carence('ap291'), { dateFinMission: '2026-11-15' }, aujourdhui)).toMatchObject([
      { code: 'mission_trop_courte', fondement: 'L. 1965 art. 29-1, I, al. 3' },
    ])
    const ap47 = controlerSuitesCarence(carence('ap47'), { dateFinMission: '2026-11-15' }, aujourdhui)
    expect(ap47).toMatchObject([{ code: 'mission_trop_courte', aConfirmer: true }])
    expect(ap47[0].message).toMatch(/saisir d’abord le juge/)
  })

  it('bornes : fin de mission le jour même, à J+21 et à J+22', () => {
    expect(codes(controlerSuitesCarence(carence('sj'), { dateFinMission: aujourdhui }, aujourdhui))).toEqual(['mission_trop_courte'])
    expect(codes(controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-11-19' }, aujourdhui))).toEqual(['mission_trop_courte'])
    expect(controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-11-20' }, aujourdhui)).toEqual([])
  })

  it('délai plus long du règlement de copropriété : la réunion la plus proche recule', () => {
    expect(codes(controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-11-25', delaiConvocationJours: 30 }, aujourdhui))).toEqual([
      'mission_trop_courte',
    ])
    expect(() => controlerSuitesCarence(carence('sj'), { dateFinMission: null, delaiConvocationJours: 15 }, aujourdhui)).toThrow(/délai/i)
  })

  it('réunion tenue après la fin de la mission : sans pouvoirs', () => {
    const tardive = constaterCarence(saisie({ date: '2026-10-28' }), { regime: 'ap47' })
    expect(codes(controlerSuitesCarence(tardive, { dateFinMission: '2026-10-25' }, aujourdhui))).toEqual(['reunion_apres_fin_mission', 'mission_expiree'])
  })

  it('date de fin de mission inconnue : à renseigner ; régime inconnu : rien', () => {
    expect(controlerSuitesCarence(carence('sj'), { dateFinMission: null }, aujourdhui)).toMatchObject([{ code: 'fin_mission_inconnue', aConfirmer: true }])
    expect(controlerSuitesCarence(carence(null), { dateFinMission: null }, aujourdhui)).toEqual([])
  })

  it('délai de présentation de la convocation : 22 jours avant la réunion (21 jours francs, décision J5)', () => {
    expect(JOURS_PRESENTATION_AVANT_REUNION).toBe(22)
  })

  it('refuse une date du jour invalide, une carence postérieure au contrôle ou une fin de mission invalide', () => {
    expect(() => controlerSuitesCarence(carence('sj'), { dateFinMission: '2026-02-30' }, aujourdhui)).toThrow(/mission/i)
    expect(() => controlerSuitesCarence(carence('sj'), { dateFinMission: null }, '29/10/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerSuitesCarence(carence('sj', { date: '2026-12-01' }), { dateFinMission: null }, aujourdhui)).toThrow(/après le jour du contrôle/)
  })

  it('l’en-tête distingue la carence d’AG de l’ordonnance de carence du mandat et garde ses points ouverts', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'carence-assemblee.ts'), 'utf8')
    expect(source).toMatch(/Légifrance le 29\/10\/2026/)
    expect(source).toMatch(/mandat-judiciaire\.ts/)
    expect(source).toMatch(/🔴/)
  })
})
