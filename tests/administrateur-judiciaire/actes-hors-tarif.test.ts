import { describe, expect, it } from 'vitest'
import {
  FONDEMENTS_ACTES_HORS_TARIF,
  MENTION_ACTES_HORS_TARIF,
  creerActeHorsTarif,
  etatDesActesHorsTarif,
  montantDemandeHtCentimes,
  type ActeHorsTarif,
  type ParametresEtatActesHorsTarif,
} from '@/lib/administrateur-judiciaire/domain/actes-hors-tarif'
import { periodeAnneeDeMission } from '@/lib/administrateur-judiciaire/domain/honoraires-tableau'
import { dureeDepuisHoraires } from '@/lib/administrateur-judiciaire/domain/honoraires-sinistre'
import { AP_120_LOTS } from './donnees-ordonnances-remuneration'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décision du 20/11/2026 (partie C, F5) — actes hors tarif de l'administrateur provisoire (arrêté du 8 octobre 2015,
 * art. 14) : chiffrés au temps passé, en minutes exactes, multiplié par le taux horaire du cabinet, acte par acte, avec la
 * date, la durée, l'objet et la fiche liée. Le montant est une demande présentée au juge, jamais une facture au syndicat.
 * Données fictives.
 */

/** Taux horaire fictif du cabinet : 90,00 € HT, en dix-millièmes d'euro. */
const TAUX_90_EUROS = 900_000

const acte = (surcharge: Partial<ActeHorsTarif> = {}): ActeHorsTarif => ({
  id: 'act-1',
  mandatId: 'mandat-2026',
  date: '2026-04-10',
  minutes: 20,
  objet: "Rendez-vous avec l'expert de l'assureur",
  fiche: { type: 'Sinistre', id: 'sin-42' },
  ...surcharge,
})

const parametres = (surcharge: Partial<ParametresEtatActesHorsTarif> = {}): ParametresEtatActesHorsTarif => ({
  mandatId: 'mandat-2026',
  mandat: AP_120_LOTS,
  ...periodeAnneeDeMission('2026-03-15', 1),
  tauxHoraireHtDixMilliemes: TAUX_90_EUROS,
  ...surcharge,
})

const actes: ActeHorsTarif[] = [
  acte(),
  acte({ id: 'act-2', date: '2026-06-02', minutes: 95, objet: 'Pièces de la vente du lot 12 et réponse au notaire', fiche: { type: 'Mutation', id: 'mut-7' } }),
  acte({ id: 'act-3', date: '2026-05-20', minutes: 7, objet: 'Relance du copropriétaire du lot 4', fiche: { type: 'Contentieux', id: 'ctx-3' } }),
  acte({ id: 'act-0', date: '2026-05-20', minutes: 120, objet: "Réunion d'information des copropriétaires", fiche: { type: 'Assemblée', id: 'reu-1' } }),
  acte({ id: 'act-hors-periode', date: '2027-03-15', minutes: 30 }),
  acte({ id: 'act-autre-mandat', mandatId: 'mandat-autre', minutes: 45 }),
]

describe('actes hors tarif — montant demandé : minutes exactes × taux horaire du cabinet (décision du 20/11/2026, partie C, F5)', () => {
  it('minutes exactes, un seul arrondi au centime : 20 minutes à 90 € = 30,00 € (et non 0,33 h × 90 € = 29,70 €)', () => {
    expect(montantDemandeHtCentimes(20, TAUX_90_EUROS)).toBe(3_000)
    expect(montantDemandeHtCentimes(7, TAUX_90_EUROS)).toBe(1_050)
    expect(montantDemandeHtCentimes(95, TAUX_90_EUROS)).toBe(14_250)
    expect(montantDemandeHtCentimes(60, TAUX_90_EUROS)).toBe(9_000)
  })

  it('arrondi au centime le plus proche, demi au-dessus : 1 minute à 85 € = 1,4166… € → 1,42 € ; 1 minute à 0,30 € = 0,5 centime → 1', () => {
    expect(montantDemandeHtCentimes(1, 850_000)).toBe(142)
    expect(montantDemandeHtCentimes(1, 3_000)).toBe(1)
  })

  it('le temps se lit aussi depuis des horaires : dureeDepuisHoraires rend les minutes exactes', () => {
    expect(montantDemandeHtCentimes(dureeDepuisHoraires('09:00', '09:20').minutes, TAUX_90_EUROS)).toBe(3_000)
  })

  it('refuse des minutes ou un taux qui ne sont pas des entiers strictement positifs', () => {
    for (const minutes of [0, -5, 1.5, Number.NaN]) expect(() => montantDemandeHtCentimes(minutes, TAUX_90_EUROS)).toThrow(/minutes/i)
    for (const taux of [0, -1, 1.5, Number.NaN]) expect(() => montantDemandeHtCentimes(20, taux)).toThrow(/taux horaire/i)
    expect(() => montantDemandeHtCentimes(Number.MAX_SAFE_INTEGER, TAUX_90_EUROS)).toThrow(/calcul exact/i)
  })
})

describe('actes hors tarif — enregistrement du temps : date, durée, objet, fiche liée', () => {
  it('rend l’acte contrôlé : objet et identifiants nettoyés, fiche revalidée', () => {
    expect(creerActeHorsTarif(acte({ id: ' act-1 ', objet: '  Constat des dégâts  ', fiche: { type: 'Sinistre', id: ' sin-42 ' } }))).toEqual(
      acte({ objet: 'Constat des dégâts' }),
    )
  })

  it('l’acte reçu n’est pas modifié', () => {
    const recu = acte({ objet: ' Constat ' })
    creerActeHorsTarif(recu)
    expect(recu.objet).toBe(' Constat ')
  })

  it('refuse un acte sans identifiant, sans mandat, sans objet, mal daté ou sans durée', () => {
    expect(() => creerActeHorsTarif(acte({ id: ' ' }))).toThrow(/identifiant/i)
    expect(() => creerActeHorsTarif(acte({ mandatId: '' }))).toThrow(/mandat/i)
    expect(() => creerActeHorsTarif(acte({ objet: '  ' }))).toThrow(/objet/i)
    expect(() => creerActeHorsTarif(acte({ date: '10/04/2026' }))).toThrow(/date/i)
    expect(() => creerActeHorsTarif(acte({ minutes: 0 }))).toThrow(/minutes/i)
    expect(() => creerActeHorsTarif(acte({ minutes: 12.5 }))).toThrow(/minutes/i)
  })

  it('la fiche liée est obligatoire et c’est une fiche de dossier (sinistre, vente de lot, recouvrement, réunion…)', () => {
    expect(() => creerActeHorsTarif(acte({ fiche: null as never }))).toThrow(/fiche liée/i)
    expect(() => creerActeHorsTarif(acte({ fiche: { type: 'Copropriété', id: 'copro-1' } }))).toThrow(/fiche porteuse/i)
    expect(() => creerActeHorsTarif(acte({ fiche: { type: 'Inconnu' as never, id: 'x' } }))).toThrow(/type de rattachement inconnu/i)
    expect(() => creerActeHorsTarif(acte({ fiche: { type: 'Sinistre', id: ' ' } }))).toThrow(/identifiant/i)
  })
})

describe('actes hors tarif — état pour le compte provisoire : une demande présentée au juge, jamais une facture au syndicat', () => {
  const etat = etatDesActesHorsTarif(actes, parametres())

  it('acte par acte : les actes du mandat datés dans la période (bornes incluses), par date puis par identifiant', () => {
    expect(etat.lignes.map((l) => [l.id, l.date, l.minutes, l.montantDemandeHtCentimes])).toEqual([
      ['act-1', '2026-04-10', 20, 3_000],
      ['act-0', '2026-05-20', 120, 18_000],
      ['act-3', '2026-05-20', 7, 1_050],
      ['act-2', '2026-06-02', 95, 14_250],
    ])
    expect(etat).toMatchObject({ mandatId: 'mandat-2026', du: '2026-03-15', au: '2027-03-14', tauxHoraireHtDixMilliemes: TAUX_90_EUROS })
  })

  it('chaque ligne garde la date, la durée, l’objet et la fiche liée', () => {
    expect(etat.lignes[3]).toEqual({
      id: 'act-2',
      mandatId: 'mandat-2026',
      date: '2026-06-02',
      minutes: 95,
      objet: 'Pièces de la vente du lot 12 et réponse au notaire',
      fiche: { type: 'Mutation', id: 'mut-7' },
      montantDemandeHtCentimes: 14_250,
    })
  })

  it('totaux : minutes et montant demandé, somme des lignes arrondies une à une', () => {
    expect(etat.totalMinutes).toBe(242)
    expect(etat.totalDemandeHtCentimes).toBe(36_300)
    expect(etat.totalDemandeHtCentimes).toBe(etat.lignes.reduce((s, l) => s + l.montantDemandeHtCentimes, 0))
  })

  it('mention et fondements : demande au juge, jamais une facture au syndicat ; aucun statut « A facturer »', () => {
    expect(etat.mention).toBe(MENTION_ACTES_HORS_TARIF)
    expect(MENTION_ACTES_HORS_TARIF).toMatch(/Demande présentée au juge, jamais une facture au syndicat/)
    expect(MENTION_ACTES_HORS_TARIF).toMatch(/minutes exactes × taux horaire du cabinet/)
    expect(etat.fondements).toEqual(FONDEMENTS_ACTES_HORS_TARIF)
    expect(FONDEMENTS_ACTES_HORS_TARIF.join(' ; ')).toMatch(/Arrêté du 8 octobre 2015, art\. 14.*D\. 1967 art\. 61-1-5, II et III.*810\.2 et 820\.3/)
    expect(JSON.stringify(etat)).not.toMatch(/A facturer|statut/)
  })

  it('période modifiable : une autre période (par exemple l’année civile) retient d’autres actes', () => {
    const civile = etatDesActesHorsTarif(actes, parametres({ du: '2027-01-01', au: '2027-12-31' }))
    expect(civile.lignes.map((l) => l.id)).toEqual(['act-hors-periode'])
    expect(etatDesActesHorsTarif([], parametres())).toMatchObject({ lignes: [], totalMinutes: 0, totalDemandeHtCentimes: 0 })
  })

  it('actes liés à un sinistre : rappel de l’art. 14 et de J67, R8 (hors déclaration, sommes de l’assureur déduites), une alerte qui ne retire rien', () => {
    expect(etat.signalements).toHaveLength(1)
    const [rappel] = etat.signalements
    expect(rappel).toMatch(/^Fiches Sinistre \(sin-42\) : /)
    expect(rappel).toMatch(/hors déclaration du sinistre et déduction faite des sommes versées par l'assureur à l'administrateur/)
    expect(rappel).toMatch(/arrêté du 8 octobre 2015, art\. 14.*J67, R8.*soldeHonorairesSinistre/)
    expect(rappel).toMatch(/montants de l'état sont bruts/)
    // Rien n'est retiré ni déduit : les actes ne disent ni quelle diligence est la déclaration, ni ce que l'assureur a versé.
    expect(etat.lignes).toHaveLength(4)
    expect(etat.totalDemandeHtCentimes).toBe(36_300)
    // Chaque sinistre une fois, dans l'ordre ; seuls les actes retenus dans l'état comptent (act-hors-periode est hors période).
    const deux = etatDesActesHorsTarif(
      [...actes, acte({ id: 'act-9', date: '2026-07-01', fiche: { type: 'Sinistre', id: 'sin-7' } }), acte({ id: 'act-10', date: '2026-08-03' })],
      parametres(),
    )
    expect(deux.signalements).toHaveLength(1)
    expect(deux.signalements[0]).toMatch(/^Fiches Sinistre \(sin-42, sin-7\) : /)
    expect(etatDesActesHorsTarif(actes.filter((a) => a.fiche.type !== 'Sinistre'), parametres()).signalements).toEqual([])
    expect(etatDesActesHorsTarif(actes, parametres({ du: '2027-01-01', au: '2027-12-31' })).signalements[0]).toMatch(/\(sin-42\)/)
  })

  it('les actes d’un autre mandat sont ignorés ; un acte du mandat fourni deux fois est refusé', () => {
    expect(etat.lignes.some((l) => l.mandatId !== 'mandat-2026')).toBe(false)
    expect(() => etatDesActesHorsTarif([acte(), acte()], parametres())).toThrow(/act-1 : fourni deux fois/)
    expect(() => etatDesActesHorsTarif([acte({ objet: '' })], parametres())).toThrow(/objet/i)
  })

  it('refuse une période ou un taux invalides, et un mandat vide', () => {
    expect(() => etatDesActesHorsTarif(actes, parametres({ du: '2026-13-01' }))).toThrow(/date/i)
    expect(() => etatDesActesHorsTarif(actes, parametres({ du: '2026-06-01', au: '2026-05-01' }))).toThrow(/période/i)
    expect(() => etatDesActesHorsTarif(actes, parametres({ tauxHoraireHtDixMilliemes: 0 }))).toThrow(/taux horaire/i)
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandatId: ' ' }))).toThrow(/mandat/i)
  })
})

describe('actes hors tarif — seulement sous le tarif de l’administrateur provisoire de l’art. 29-1 (moins de 500 lots)', () => {
  it('500 lots et plus : l’art. 14 ne s’applique pas, l’entière rémunération est fixée par le juge (arrêté, art. 3)', () => {
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandat: { regime: 'ap291', nbLots: 500 } }))).toThrow(
      /500 lots et plus.*art\. 3/,
    )
  })

  it('syndic judiciaire et AP de l’art. 47 : rémunération fixée par le président (C. com. R. 814-27) ; régime inconnu : à vérifier', () => {
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandat: { regime: 'sj', nbLots: 40 } }))).toThrow(/R\. 814-27/)
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandat: { regime: 'ap47', nbLots: 40 } }))).toThrow(/R\. 814-27/)
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandat: { regime: null, nbLots: 40 } }))).toThrow(/fondement du mandat/)
  })

  it('un nombre de lots invalide est refusé pour l’art. 29-1', () => {
    expect(() => etatDesActesHorsTarif(actes, parametres({ mandat: { regime: 'ap291', nbLots: 0 } }))).toThrow(/lots/i)
  })
})

describe('actes hors tarif — en-tête du module', () => {
  const { texte } = enTeteDuModule('actes-hors-tarif')

  it('cite la décision et ses fondements ; données hors du domaine passées par l’appelant ; aucune question ouverte', () => {
    expect(texte).toMatch(/Décision du 20\/11\/2026 \(partie C, F5\)/)
    expect(texte).toMatch(/arrêté du 8 octobre 2015, art\. 14/)
    expect(texte).toMatch(/taux horaire du cabinet.*passé par l'appelant/)
    expect(texte).not.toMatch(/🔴/)
  })

  it('l’arrondi n’est pas fixé par la décision : choix 🔵, à part de la question ouverte des éléments horaires', () => {
    const { item } = enTeteDuModule('actes-hors-tarif')
    const montant = item("- Montant d'un acte")
    expect(montant).toMatch(/sans arrondi intermédiaire des heures/)
    expect(montant).toMatch(/🔵 Un seul arrondi, au centime le plus proche \(demi au-dessus\)/)
    expect(montant).toMatch(/la décision ne fixe pas l'arrondi/)
    expect(montant).toMatch(/heures au centième.*question ouverte de honoraires-sinistre\.ts/)
  })

  it('sinistres : les conditions de l’art. 14 et de J67, R8 sont rappelées, ni retirées ni déduites', () => {
    const sinistres = enTeteDuModule('actes-hors-tarif').item('- Sinistres')
    expect(sinistres).toMatch(/hors déclaration du sinistre et déduction faite des sommes versées par l'assureur/)
    expect(sinistres).toMatch(/art\. 14 ; décision du 17\/11\/2026, J67, R8/)
    expect(sinistres).toMatch(/une alerte\), sans rien retirer ni déduire/)
  })
})
