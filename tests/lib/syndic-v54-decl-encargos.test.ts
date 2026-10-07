import { describe, it, expect, afterEach } from 'vitest'
import {
  REGLES_DELAI_DECLARATION,
  decalerJourCivil,
  prazoLimiteDeclaracao,
  estHorsDelai,
} from '@/lib/syndic/v54/decl-encargos'

/**
 * Déclaration d'encargos (PT) / état daté (FR) — règles de date, une par pays :
 * - PT : délai LÉGAL de 10 jours (art. 1424.º-A, n.º 2, CC : « no prazo máximo de 10 dias a
 *   contar do respetivo requerimento »), compté selon l'art. 279.º CC (rendu applicable par
 *   l'art. 296.º) : le jour de la demande n'est pas compté (al. b) ; un terme qui tombe un
 *   dimanche ou un jour férié passe au premier jour ouvrable (al. e). Le samedi n'est pas visé ;
 * - FR : aucun texte ne fixe de délai de délivrance de l'état daté (décret n° 67-223,
 *   art. 5 : contenu seulement) ; le cabinet s'impose un délai INTERNE de 10 jours, sans report.
 * Arithmétique en jours civils UTC : aucun décalage d'un jour au passage à l'heure d'été.
 */

const TZ_INITIAL = process.env.TZ
afterEach(() => {
  if (TZ_INITIAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_INITIAL
})

const FUSEAUX = ['Europe/Lisbon', 'Atlantic/Azores', 'Europe/Paris', 'America/Los_Angeles', 'Pacific/Kiritimati']

describe('règle de délai, une par pays', () => {
  it('PT : 10 jours, délai légal, terme reporté selon l’art. 279.º, e), CC', () => {
    expect(REGLES_DELAI_DECLARATION.pt).toEqual({ jours: 10, nature: 'legal', reportTerme: 'art279e' })
  })

  it('FR : 10 jours, délai interne (aucun délai légal de délivrance), sans report', () => {
    expect(REGLES_DELAI_DECLARATION.fr).toEqual({ jours: 10, nature: 'interne', reportTerme: 'aucun' })
  })
})

describe('decalerJourCivil', () => {
  it('ajoute des jours civils, fins de mois et d’année comprises', () => {
    expect(decalerJourCivil('2026-05-01', 10)).toBe('2026-05-11')
    expect(decalerJourCivil('2026-12-25', 10)).toBe('2027-01-04')
    expect(decalerJourCivil('2026-02-25', 10)).toBe('2026-03-07')
    expect(decalerJourCivil('2028-02-25', 10)).toBe('2028-03-06')
    expect(decalerJourCivil('2026-05-11', 0)).toBe('2026-05-11')
  })

  it.each(FUSEAUX)('aucun décalage au passage à l’heure d’été, fuseau %s', (tz) => {
    process.env.TZ = tz
    // Ancienne formule du navigateur (setDate local + toISOString UTC) : J+9 du 20 au 29 mars.
    expect(decalerJourCivil('2026-03-20', 10)).toBe('2026-03-30')
    expect(decalerJourCivil('2026-03-25', 10)).toBe('2026-04-04')
    expect(decalerJourCivil('2026-03-29', 10)).toBe('2026-04-08')
    expect(decalerJourCivil('2026-10-20', 10)).toBe('2026-10-30')
  })

  it.each([undefined, null, '', 'abc', '2026-02-30', '2026-13-01', '2026-5-1', '25/03/2026'])('jour absent ou impossible (%s) → null', (jour) => {
    expect(decalerJourCivil(jour, 10)).toBeNull()
  })
})

describe('prazoLimiteDeclaracao — PT : art. 1424.º-A, n.º 2, et art. 279.º CC', () => {
  it.each([
    ['terme un lundi ordinaire : inchangé', '2026-05-01', '2026-05-11'],
    ['terme un samedi : non reporté (le samedi n’est pas visé par l’al. e)', '2026-10-14', '2026-10-24'],
    ['terme le samedi veille de Pâques : non reporté', '2026-03-25', '2026-04-04'],
    ['terme un dimanche (25/10/2026) : lundi suivant', '2026-10-15', '2026-10-26'],
    ['terme le Domingo de Páscoa (05/04/2026) : lundi suivant', '2026-03-26', '2026-04-06'],
    ['terme un jour férié (Imaculada Conceição, 08/12/2026) : lendemain', '2026-11-28', '2026-12-09'],
    ['terme un jour férié (Dia de Portugal, 10/06/2026) : lendemain', '2026-05-31', '2026-06-11'],
    ['terme la Sexta-feira Santa (26/03/2027) : samedi suivant, jour où le terme peut échoir', '2027-03-16', '2027-03-27'],
    ['terme le Corpo de Deus (27/05/2027) : lendemain', '2027-05-17', '2027-05-28'],
    ['enchaînement férié + dimanche (samedi 15/08/2026 férié) : lundi 17', '2026-08-05', '2026-08-17'],
    ['enchaînement dimanche + férié (31/10/2027, Todos os Santos lundi 01/11) : mardi 02/11', '2027-10-21', '2027-11-02'],
    ['enchaînement férié + dimanche d’une année sur l’autre (samedi 01/01/2028) : lundi 03/01', '2027-12-22', '2028-01-03'],
  ])('%s', (_cas, dataPedido, prazo) => {
    expect(prazoLimiteDeclaracao(dataPedido, 'pt')).toBe(prazo)
  })

  it.each(FUSEAUX)('report indépendant du fuseau du serveur (%s), changement d’heure du 25/10/2026 compris', (tz) => {
    process.env.TZ = tz
    expect(prazoLimiteDeclaracao('2026-10-15', 'pt')).toBe('2026-10-26')
    expect(prazoLimiteDeclaracao('2026-11-28', 'pt')).toBe('2026-12-09')
    expect(prazoLimiteDeclaracao('2026-10-14', 'pt')).toBe('2026-10-24')
  })
})

describe('prazoLimiteDeclaracao — FR : délai interne de 10 jours, sans report', () => {
  it.each([
    ['2026-05-01', '2026-05-11'],
    ['2026-10-15', '2026-10-25'], // dimanche : pas de report
    ['2026-11-28', '2026-12-08'], // férié portugais : sans objet en FR
    ['2027-05-17', '2027-05-27'],
    ['2026-08-05', '2026-08-15'], // 15 août, férié en France aussi : pas de report
    ['2026-07-04', '2026-07-14'], // 14 juillet : pas de report
    ['2027-12-22', '2028-01-01'],
  ])('%s → %s (date de la demande + 10 jours exactement)', (dataPedido, prazo) => {
    expect(prazoLimiteDeclaracao(dataPedido, 'fr')).toBe(prazo)
  })
})

describe('prazoLimiteDeclaracao — sans date de demande valide', () => {
  it.each(['pt', 'fr'] as const)('%s : pas de date limite', (pays) => {
    expect(prazoLimiteDeclaracao(undefined, pays)).toBeNull()
    expect(prazoLimiteDeclaracao(null, pays)).toBeNull()
    expect(prazoLimiteDeclaracao('', pays)).toBeNull()
    expect(prazoLimiteDeclaracao('2026-02-30', pays)).toBeNull()
  })
})

describe('estHorsDelai — statut « pendente » et échéance dépassée (jour civil local)', () => {
  /** 10 h, heure locale du navigateur, le jour donné. */
  const le = (annee: number, mois: number, jour: number) => new Date(annee, mois - 1, jour, 10)

  it('le jour de l’échéance reste dans le délai', () => {
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2026-05-11' }, le(2026, 5, 11))).toBe(false)
  })

  it('hors délai à partir du lendemain de l’échéance', () => {
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2026-05-11' }, le(2026, 5, 12))).toBe(true)
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2026-04-30' }, le(2026, 5, 11))).toBe(true)
  })

  it('jour civil du navigateur, pas le jour UTC : 0 h 30 le 12/05 à Lisbonne = 23 h 30 UTC le 11/05', () => {
    process.env.TZ = 'Europe/Lisbon'
    const instant = new Date('2026-05-11T23:30:00Z')
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2026-05-11' }, instant)).toBe(true)
    process.env.TZ = 'America/Los_Angeles'
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2026-05-11' }, instant)).toBe(false)
  })

  it.each(['emitida', 'concluida'])('déclaration %s : jamais hors délai', (estado) => {
    expect(estHorsDelai({ estado, prazoLimite: '2026-05-01' }, le(2026, 5, 11))).toBe(false)
  })

  it.each(['', 'a definir', '2026-05-01T00:00:00Z'])('date limite absente ou non « AAAA-MM-JJ » (%s) : pas hors délai', (prazoLimite) => {
    expect(estHorsDelai({ estado: 'pendente', prazoLimite }, le(2026, 5, 11))).toBe(false)
  })

  it('sans date de référence : maintenant', () => {
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2000-01-01' })).toBe(true)
    expect(estHorsDelai({ estado: 'pendente', prazoLimite: '2999-12-31' })).toBe(false)
  })
})
