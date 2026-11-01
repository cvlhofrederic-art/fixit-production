import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { creerIdentite, type Identite } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  adresseElectroniqueDeNotification,
  controlerAvantEnvoiElectronique,
  creerCommunicationAdresseElectronique,
  creerDemandeVoiePostale,
  effetDemandeVoiePostale,
  mentionFaculteVoiePostale,
  voieDeNotification,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'

/**
 * Voie de notification d'un copropriétaire (point 60 du bilan 2 ; Gestéam : critère LRE de la fiche client, modes
 * d'acquisition du consentement, anomalies « LRE sans prénom » et « PM sans représentant » — tranche 43 § 4 et § 5).
 * Droit vérifié sur Légifrance le 28/10/2026 (tranche 43 § 5) :
 * - L. 1965 art. 42-1 (loi n° 2024-322) : notifications et mises en demeure valablement faites par voie électronique ; le
 *   copropriétaire peut, à tout moment et par tout moyen, demander la voie postale ;
 * - D. 1967 art. 64 à 64-4 (décret n° 2025-1292) : voie électronique de principe, LRAR pour qui a demandé la voie
 *   postale, rappel de cette faculté sur les appels de charges et les convocations, demande effective le lendemain du
 *   huitième jour suivant sa réception, ou dès l'assemblée si elle y est formulée (mention au PV) ; art. 65 : dernière
 *   adresse communiquée par le copropriétaire à cet effet.
 */

const physique = (surcharge: Partial<Identite> = {}) =>
  creerIdentite({
    id: 'id-1',
    nature: 'physique',
    civilite: 'Madame',
    nom: 'Durand',
    prenom: 'Claire',
    telecoms: [{ nature: 'Email', valeur: 'claire@example.org' }],
    ...surcharge,
  })

describe('demande de voie postale', () => {
  it('reçue par courrier, extranet ou autre moyen : effective le lendemain du huitième jour suivant sa réception', () => {
    for (const origine of ['courrier', 'extranet', 'autre'] as const) {
      const demande = creerDemandeVoiePostale({ identiteId: ' id-1 ', recueLe: '2026-10-01', origine })
      expect(demande).toEqual({ identiteId: 'id-1', recueLe: '2026-10-01', origine, agId: null })
      expect(effetDemandeVoiePostale(demande)).toBe('2026-10-10')
    }
  })

  it('formulée en assemblée : effective dès l’assemblée, avec la référence de l’AG pour la mention au PV', () => {
    const demande = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-10-15', origine: 'ag', agId: 'AG-2026' })
    expect(effetDemandeVoiePostale(demande)).toBe('2026-10-15')
    expect(() => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-10-15', origine: 'ag' })).toThrow(/assemblée/i)
    expect(() => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-10-15', origine: 'courrier', agId: 'AG-2026' })).toThrow(/origine « ag »/)
  })

  it('refuse une date, une origine ou une identité invalides', () => {
    expect(() => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '01/10/2026', origine: 'courrier' })).toThrow(/AAAA-MM-JJ/)
    // @ts-expect-error — origine inconnue
    expect(() => creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-10-01', origine: 'pigeon' })).toThrow(/origine/i)
    expect(() => creerDemandeVoiePostale({ identiteId: ' ', recueLe: '2026-10-01', origine: 'courrier' })).toThrow(/identité/i)
  })
})

describe('voie de notification à une date', () => {
  const demande = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-10-01', origine: 'courrier' })

  it('par défaut : voie électronique ; après l’effet d’une demande : voie postale (LRAR)', () => {
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [], date: '2026-10-29' })).toMatchObject({ voie: 'electronique', depuis: null, aConfirmer: null })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], date: '2026-10-09' })).toMatchObject({ voie: 'electronique' })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], date: '2026-10-10' })).toMatchObject({
      voie: 'postale',
      depuis: '2026-10-10',
      fondement: 'L. 1965 art. 42-1 ; D. 1967 art. 64-1, 64-4',
    })
  })

  it('ne tient compte que des demandes de l’identité ; la plus ancienne en vigueur fait foi', () => {
    const autre = creerDemandeVoiePostale({ identiteId: 'id-2', recueLe: '2026-01-01', origine: 'courrier' })
    const seconde = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-09-01', origine: 'extranet' })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [autre], date: '2026-10-29' }).voie).toBe('electronique')
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande, seconde], date: '2026-10-29' }).depuis).toBe('2026-09-10')
  })

  it('avant le 25/12/2025 (ancien régime de l’accord exprès) : voie non calculée, à confirmer', () => {
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [], date: '2025-12-25' }).voie).toBe('electronique')
    const anterieure = voieDeNotification({ identiteId: 'id-1', demandes: [], date: '2025-12-24' })
    expect(anterieure).toMatchObject({ voie: null, depuis: null })
    expect(anterieure.fondement).toMatch(/antérieure au décret n° 2025-1292/)
    expect(anterieure.aConfirmer).toMatch(/accord exprès/)
  })

  it('refuse une date invalide', () => {
    expect(() => voieDeNotification({ identiteId: 'id-1', demandes: [], date: '29/10/2026' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('adresse électronique communiquée à cet effet (D. 1967 art. 65)', () => {
  const premiere = creerCommunicationAdresseElectronique({ identiteId: 'id-1', adresse: ' claire@example.org ', communiqueeLe: '2026-01-15' })
  const nouvelle = creerCommunicationAdresseElectronique({ identiteId: 'id-1', adresse: 'c.durand@example.org', communiqueeLe: '2026-09-01' })

  it('la dernière reçue au plus tard à la date ; aucune avant la première communication', () => {
    expect(premiere.adresse).toBe('claire@example.org')
    const communications = [
      nouvelle,
      premiere,
      creerCommunicationAdresseElectronique({ identiteId: 'id-2', adresse: 'x@example.org', communiqueeLe: '2026-10-01' }),
    ]
    expect(adresseElectroniqueDeNotification({ identiteId: 'id-1', communications, date: '2026-08-31' })?.adresse).toBe('claire@example.org')
    expect(adresseElectroniqueDeNotification({ identiteId: 'id-1', communications, date: '2026-09-01' })?.adresse).toBe('c.durand@example.org')
    expect(adresseElectroniqueDeNotification({ identiteId: 'id-1', communications, date: '2026-01-14' })).toBeNull()
    const memeJour = creerCommunicationAdresseElectronique({ identiteId: 'id-1', adresse: 'autre@example.org', communiqueeLe: '2026-09-01' })
    expect(adresseElectroniqueDeNotification({ identiteId: 'id-1', communications: [nouvelle, memeJour], date: '2026-10-29' })?.adresse).toBe('autre@example.org')
  })

  it('refuse une adresse, une identité ou une date invalides', () => {
    expect(() => creerCommunicationAdresseElectronique({ identiteId: 'id-1', adresse: 'claire.example.org', communiqueeLe: '2026-01-15' })).toThrow(/invalide/i)
    expect(() => creerCommunicationAdresseElectronique({ identiteId: ' ', adresse: 'claire@example.org', communiqueeLe: '2026-01-15' })).toThrow(/identité/i)
    expect(() => creerCommunicationAdresseElectronique({ identiteId: 'id-1', adresse: 'claire@example.org', communiqueeLe: '15/01/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => adresseElectroniqueDeNotification({ identiteId: 'id-1', communications: [], date: '29/10/2026' })).toThrow(/AAAA-MM-JJ/)
  })
})

describe('contrôles avant un envoi électronique', () => {
  const avec = { representantLegalId: null, adresseElectronique: 'claire@example.org' }

  it('personne physique avec prénom et adresse communiquée à cet effet : rien à signaler', () => {
    expect(controlerAvantEnvoiElectronique(physique(), avec)).toEqual([])
  })

  it('personne physique sans prénom : bloquant (anomalie « LRE sans prénom » de Gestéam ; CPCE art. R. 53-2, 2°)', () => {
    const anomalies = controlerAvantEnvoiElectronique(physique({ prenom: null }), avec)
    expect(anomalies).toMatchObject([{ code: 'lre_sans_prenom', gravite: 'bloquant' }])
    expect(anomalies[0].message).toMatch(/R\. 53-2/)
  })

  it('personne morale sans représentant légal : bloquant (anomalie « PM sans représentant » de Gestéam ; D. 1967 art. 32)', () => {
    const morale = physique({ nature: 'morale', civilite: 'S.C.I.', nom: 'SCI Les Tilleuls', prenom: null })
    const anomalies = controlerAvantEnvoiElectronique(morale, avec)
    expect(anomalies).toMatchObject([{ code: 'pm_sans_representant', gravite: 'bloquant' }])
    expect(anomalies[0].message).toMatch(/art\. 32/)
    expect(controlerAvantEnvoiElectronique(morale, { ...avec, representantLegalId: 'id-9' })).toEqual([])
  })

  it('un e-mail de contact ne suffit pas : sans adresse communiquée à cet effet, bloquant', () => {
    const anomalies = controlerAvantEnvoiElectronique(physique(), { representantLegalId: null, adresseElectronique: null })
    expect(anomalies).toMatchObject([{ code: 'adresse_electronique_absente', gravite: 'bloquant' }])
    expect(anomalies[0].message).toMatch(/art\. 65/)
    expect(controlerAvantEnvoiElectronique(physique(), { representantLegalId: null, adresseElectronique: ' ' })).toHaveLength(1)
  })
})

describe('mention et marqueurs', () => {
  it('la mention de la faculté de demander la voie postale, à porter sur les appels de charges et les convocations', () => {
    const mention = mentionFaculteVoiePostale()
    expect(mention.fondement).toBe('D. 1967 art. 64-2, 64-4')
    expect(mention.texte).toMatch(/à tout moment/)
    expect(mention.texte).toMatch(/les notifications et les mises en demeure par voie postale/)
    expect(mention.texte).toMatch(/établir avec certitude sa date de réception/)
    expect(mention.texte).toMatch(/au syndic/)
    expect(mention.texte).not.toMatch(/vous sont faites par voie électronique/)
  })

  it('administrateur provisoire désigné : la demande lui est adressée (D. 1967 art. 64-9)', () => {
    const mention = mentionFaculteVoiePostale({ administrateurProvisoire: true })
    expect(mention.texte).toMatch(/à l'administrateur provisoire/)
    expect(mention.fondement).toBe('D. 1967 art. 64-2, 64-4, 64-9')
  })

  it('l’en-tête date la vérification du texte et garde ses points ouverts', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'voie-notification.ts'), 'utf8')
    expect(source).toMatch(/Légifrance le 28\/10\/2026/)
    expect(source).toMatch(/🔵/)
    expect(source).toMatch(/🔴/)
  })
})
