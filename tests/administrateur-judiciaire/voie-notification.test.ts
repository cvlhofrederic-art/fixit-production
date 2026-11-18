import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { creerIdentite, type Identite } from '@/lib/administrateur-judiciaire/domain/identites-positions'
import {
  JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE,
  JOURS_AVANT_EFFET_VOIE_POSTALE,
  accordElectroniqueEnAttente,
  accordElectroniqueEnVigueur,
  adresseElectroniqueDeNotification,
  communicationDeLaRenonciation,
  controlerAvantEnvoiElectronique,
  creerCommunicationAdresseElectronique,
  creerConsentementVoieElectronique,
  creerDemandeVoiePostale,
  creerRenonciationVoiePostale,
  demandesDepuisConsentements,
  effetDemandeVoiePostale,
  effetRetourVoieElectronique,
  mentionFaculteVoiePostale,
  motifNotificationAvantRetour,
  voieDeNotification,
  type RenonciationVoiePostale,
} from '@/lib/administrateur-judiciaire/domain/voie-notification'
import { enTeteDuModule } from './en-tete-module'

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

  it('J67, R17 : demande d’avant le 25/12/2025, effet à sa réception gardé, motif corrigé (l’ancien texte avait déjà huit jours)', () => {
    const ancienne = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2025-06-01', origine: 'courrier' })
    const voie = voieDeNotification({ identiteId: 'id-1', demandes: [ancienne], date: '2026-01-05' })
    expect(voie).toMatchObject({ voie: 'postale', depuis: '2025-06-01', aConfirmer: null })
    // correction R17 du registre : choix prudent, plus strict que le texte, et non « l'ancienne règle » ; sans prénom
    expect(voie.fondement).toBe(
      "L. 1965 art. 42-1, al. 2 ; D. 1967 art. 64-1 ; demande reçue avant le 25/12/2025 : effet retenu à sa réception, choix prudent, plus strict que le texte : le retrait de l'accord prenait déjà effet le lendemain du huitième jour suivant sa réception (D. 1967 art. 64-4, version du 04/07/2020 au 24/12/2025 ; avant, art. 64-2 : lendemain du huitième jour du 29/06/2019 au 03/07/2020, lendemain de la réception du 24/10/2015 au 28/06/2019) ; décret n° 2025-1292 sans règle transitoire, C. civ. art. 2 ; J52 ; J67, R17",
    )
    expect(voie.fondement).not.toMatch(/Hugo|ancienne règle/)
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'voie-notification.ts'), 'utf8')
    expect(source).not.toMatch(/ANCIENNE_REGLE|AncienneRegle/)
    const { texte, item } = enTeteDuModule('voie-notification')
    expect(texte).not.toContain('ancienne règle : effetDemandeVoiePostale')
    expect(texte).not.toMatch(/Le délai de huit jours de l'art\. 64-4 actuel ne vaut que/)
    // la phrase sur le délai de huit jours : le texte l'avait déjà pour le retrait de l'accord
    expect(texte).not.toMatch(/Le code n'applique le délai de huit\s+jours qu'à une demande reçue depuis le 25\/12\/2025/)
    expect(item('- J52 :')).toMatch(/choix prudent, plus strict que le texte/)
    expect(item('- J52 :')).toMatch(/29\/06\/2019 au 03\/07\/2020.*24\/10\/2015 au 28\/06\/2019/)
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(ouvert).not.toContain("accord exprès de l'art. 64-3 de la rédaction de 2020")
    expect(texte).toMatch(/J67, R17 : lecture prudente gardée/)
    // relecture : le message rendu ne présente plus la question comme ouverte
    const avant = voieDeNotification({ identiteId: 'id-1', demandes: [], date: '2025-06-01' })
    expect(avant).toMatchObject({ voie: null, depuis: null })
    expect(avant.aConfirmer).toBe(
      'Avant le 25/12/2025 : lettre recommandée avec avis de réception, sauf accord exprès à la voie électronique, exigé aussi du 11/04/2024 au 24/12/2025 (lecture prudente, J67, R17) ; voie non calculée ici : le calcul du délai en décide (statut-assemblee.ts).',
    )
  })

  it('J74 : retour à la voie électronique tranché ; la question 🔴 de R18 est retirée, la décision est citée', () => {
    const { texte, item } = enTeteDuModule('voie-notification')
    const ouvert = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(ouvert).not.toMatch(/retour à la voie électronique après une DemandeVoiePostale/)
    expect(ouvert).not.toMatch(/d'ici là, le code ne change pas/)
    const j74 = item('Décision de Hugo du 18/11/2026 (registre des décisions juridiques, J74')
    expect(j74).toMatch(/RenonciationVoiePostale/)
    expect(j74).toMatch(/lendemain du huitième jour suivant leur réception/)
    expect(j74).toMatch(/JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE/)
    expect(j74).toMatch(/ne vaut pas notification/)
    expect(j74).toMatch(/à faire après #741/)
  })

  it('l’en-tête date la vérification du texte et garde ses points ouverts', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'voie-notification.ts'), 'utf8')
    expect(source).toMatch(/Légifrance le 28\/10\/2026/)
    expect(source).toMatch(/🔵/)
    expect(source).toMatch(/🔴/)
  })
})

// ─── J74 : retour à la voie électronique (décision de Hugo du 18/11/2026 ; R18) ─────────────────────────────────

describe('J74 — renonciation à la voie postale (R18) : écrite, datée, reçue par un moyen qui prouve sa date, avec une adresse', () => {
  const saisie = {
    identiteId: ' id-1 ',
    dateeLe: '2026-02-28',
    recueLe: '2026-03-02',
    justificatif: ' Avis de réception n° 1A 234 ',
    adresseElectronique: ' claire@example.org ',
  }

  it('enregistrée nettoyée ; chaque condition manquante est refusée avec son motif', () => {
    expect(creerRenonciationVoiePostale(saisie)).toEqual({
      identiteId: 'id-1',
      dateeLe: '2026-02-28',
      recueLe: '2026-03-02',
      justificatif: 'Avis de réception n° 1A 234',
      adresseElectronique: 'claire@example.org',
    })
    expect(() => creerRenonciationVoiePostale({ ...saisie, identiteId: ' ' })).toThrow(/identité attendue/)
    expect(() => creerRenonciationVoiePostale({ ...saisie, dateeLe: '28/02/2026' })).toThrow(/date de l'écrit invalide.*AAAA-MM-JJ/i)
    expect(() => creerRenonciationVoiePostale({ ...saisie, recueLe: '2026-02-30' })).toThrow(/date de réception invalide.*AAAA-MM-JJ/i)
    expect(() => creerRenonciationVoiePostale({ ...saisie, dateeLe: '2026-03-03' })).toThrow(/écrit daté du 03\/03\/2026, après sa réception le 02\/03\/2026/)
    expect(() => creerRenonciationVoiePostale({ ...saisie, justificatif: ' ' })).toThrow(/établir avec certitude sa date de réception.*J74/)
    expect(() => creerRenonciationVoiePostale({ ...saisie, adresseElectronique: 'claire.example.org' })).toThrow(/adresse électronique.*art\. 65/)
  })

  it('son adresse électronique vaut adresse de notification communiquée à cet effet, à sa réception (D. 1967 art. 65)', () => {
    expect(communicationDeLaRenonciation(creerRenonciationVoiePostale(saisie))).toEqual({
      identiteId: 'id-1',
      adresse: 'claire@example.org',
      communiqueeLe: '2026-03-02',
    })
  })
})

describe('J74 — effet du retour à la voie électronique : le lendemain du huitième jour suivant la réception', () => {
  it('même paramètre que la demande de voie postale (D. 1967 art. 64-4) ; date d’effet et justification', () => {
    expect(JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE).toBe(JOURS_AVANT_EFFET_VOIE_POSTALE)
    expect(effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '2026-03-02' })).toEqual({
      nature: 'renonciation',
      recueLe: '2026-03-02',
      effet: '2026-03-11',
      justification:
        'Renonciation à la voie postale reçue le 02/03/2026 : effet le 11/03/2026, lendemain du 8e jour suivant sa réception (D. 1967 art. 64-4, même règle que la demande de voie postale ; J74).',
    })
    const accord = effetRetourVoieElectronique({ nature: 'accord', recueLe: '2025-12-26' })
    expect(accord.effet).toBe('2026-01-04')
    expect(accord.justification).toMatch(/^Accord à la voie électronique, donné après un refus, reçu le 26\/12\/2025 : effet le 04\/01\/2026, lendemain du 8e jour/)
    // la durée est un paramètre : une autre valeur se passe à la fonction, rien n'est écrit en dur
    expect(effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '2026-03-02' }, 4)).toMatchObject({ effet: '2026-03-06' })
    expect(effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '2026-03-02' }, 4).justification).toContain('lendemain du 3e jour')
    expect(() => effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '02/03/2026' })).toThrow(/AAAA-MM-JJ/)
    expect(() => effetRetourVoieElectronique({ nature: 'renonciation', recueLe: '2026-03-02' }, 0)).toThrow(/entier strictement positif/)
  })
})

describe('J74 — voie de notification après une renonciation : postale jusqu’à son effet', () => {
  const demande = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-02-01', origine: 'courrier' })
  const renonciation = (surcharge: Partial<RenonciationVoiePostale> = {}): RenonciationVoiePostale =>
    creerRenonciationVoiePostale({
      identiteId: 'id-1',
      dateeLe: '2026-02-28',
      recueLe: '2026-03-02',
      justificatif: 'Avis de réception n° 1A 234',
      adresseElectronique: 'claire@example.org',
      ...surcharge,
    })

  it('avant l’effet : voie postale, retour en attente ; une notification électronique envoyée avant ne vaut pas notification', () => {
    const avant = voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [renonciation()], date: '2026-03-10' })
    expect(avant).toMatchObject({ voie: 'postale', depuis: '2026-02-10', retour: { nature: 'renonciation', recueLe: '2026-03-02', effet: '2026-03-11' } })
    expect(avant.retour === null ? '' : motifNotificationAvantRetour(avant.retour, '2026-03-10')).toBe(
      'Retour à la voie électronique pas encore en vigueur : Renonciation à la voie postale reçue le 02/03/2026 : effet le 11/03/2026, lendemain du 8e jour suivant sa réception (D. 1967 art. 64-4, même règle que la demande de voie postale ; J74). La notification électronique du 10/03/2026, envoyée avant cette date, ne vaut pas notification et ne fait courir aucun délai : la refaire par lettre recommandée avec avis de réception (D. 1967 art. 64-1 ; J74).',
    )
    // le jour même de la réception aussi
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [renonciation()], date: '2026-03-02' }).voie).toBe('postale')
  })

  it('à l’effet : voie électronique, avec le retour qui l’a rétablie ; sans renonciation : voie postale, aucun retour', () => {
    const apres = voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [renonciation()], date: '2026-03-11' })
    expect(apres).toMatchObject({ voie: 'electronique', depuis: null, aConfirmer: null, retour: { nature: 'renonciation', effet: '2026-03-11' } })
    expect(apres.fondement).toBe('L. 1965 art. 42-1 ; D. 1967 art. 64, 64-4 ; renonciation à la voie postale (J74)')
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], date: '2026-03-11' })).toMatchObject({ voie: 'postale', retour: null })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [], date: '2026-03-11' })).toMatchObject({ voie: 'electronique', retour: null })
  })

  it('elle ne lève que les demandes reçues au plus tard le jour de sa réception : une demande plus récente l’emporte', () => {
    const nouvelle = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-04-01', origine: 'extranet' })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande, nouvelle], renonciations: [renonciation()], date: '2026-04-15' })).toMatchObject({
      voie: 'postale',
      depuis: '2026-04-10',
      retour: null,
    })
    // entre son effet et celui de la nouvelle demande : voie électronique
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande, nouvelle], renonciations: [renonciation()], date: '2026-04-05' }).voie).toBe('electronique')
    // celle d'une autre identité ne compte pas
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [renonciation({ identiteId: 'id-2' })], date: '2026-03-15' }).voie).toBe('postale')
  })

  it('relecture : même jour que la demande, la renonciation la lève à son effet, comme l’accord enregistré après un refus le même jour (🔵)', () => {
    const demandeAg = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2026-02-01', origine: 'ag', agId: 'ag-9' })
    const memeJour = renonciation({ dateeLe: '2026-02-01', recueLe: '2026-02-01' })
    // demande formulée en assemblée (effet ce jour-là) : postale jusqu'à l'effet de la renonciation, puis électronique
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demandeAg], renonciations: [memeJour], date: '2026-02-09' })).toMatchObject({
      voie: 'postale',
      depuis: '2026-02-01',
      retour: { nature: 'renonciation', recueLe: '2026-02-01', effet: '2026-02-10' },
    })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demandeAg], renonciations: [memeJour], date: '2026-02-10' })).toMatchObject({
      voie: 'electronique',
      retour: { nature: 'renonciation', effet: '2026-02-10' },
    })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [memeJour], date: '2026-03-15' })).toMatchObject({ voie: 'electronique' })
    // même règle pour le refus et l'accord reçus le même jour, l'accord enregistré après : le refus est levé à l'effet
    const refus = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'refus', recuLe: '2026-02-01' })
    const accord = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: '2026-02-01' })
    expect(demandesDepuisConsentements([refus, accord], '2026-02-09')).toMatchObject([{ recueLe: '2026-02-01', retourEnAttente: { effet: '2026-02-10' } }])
    expect(demandesDepuisConsentements([refus, accord], '2026-02-10')).toEqual([])
    // l'accord enregistré avant le refus, le même jour : le refus reste le dernier état
    expect(demandesDepuisConsentements([accord, refus], '2026-03-15')).toEqual([{ identiteId: 'id-1', recueLe: '2026-02-01', origine: 'autre', agId: null }])
  })

  it('demande reçue avant le 25/12/2025 (effet à sa réception, J52) levée par une renonciation reçue depuis : même effet', () => {
    const ancienne = creerDemandeVoiePostale({ identiteId: 'id-1', recueLe: '2025-06-01', origine: 'courrier' })
    const r = renonciation({ dateeLe: '2026-01-02', recueLe: '2026-01-05' })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [ancienne], renonciations: [r], date: '2026-01-13' })).toMatchObject({
      voie: 'postale',
      depuis: '2025-06-01',
      retour: { effet: '2026-01-14' },
    })
    expect(voieDeNotification({ identiteId: 'id-1', demandes: [ancienne], renonciations: [r], date: '2026-01-14' }).voie).toBe('electronique')
  })

  it('renonciation incomplète, telle qu’une base ou une reprise peut la porter : écartée, la voie postale demeure (lecture prudente)', () => {
    const complete = { identiteId: 'id-1', dateeLe: '2026-02-28', recueLe: '2026-03-02', justificatif: 'AR', adresseElectronique: 'claire@example.org' }
    for (const defaut of [{ recueLe: '2026-02-30' }, { dateeLe: '' }, { dateeLe: '2026-03-05' }, { justificatif: ' ' }, { adresseElectronique: 'claire' }]) {
      const brute: RenonciationVoiePostale = { ...complete, ...defaut }
      expect(voieDeNotification({ identiteId: 'id-1', demandes: [demande], renonciations: [brute], date: '2026-04-15' }), JSON.stringify(defaut)).toMatchObject({
        voie: 'postale',
        retour: null,
      })
    }
  })
})

describe('J74 — accord donné après un refus (J59) : effet le lendemain du huitième jour suivant sa réception (avant : dès sa réception)', () => {
  const refus = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'refus', recuLe: '2025-12-20' })
  const accord = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'accord', recuLe: '2025-12-26' })

  it('avant son effet : le refus reste une demande de voie postale, avec l’accord en attente ; la voie reste postale', () => {
    const demandes = demandesDepuisConsentements([refus, accord], '2026-01-03')
    expect(demandes).toEqual([
      { identiteId: 'id-1', recueLe: '2025-12-20', origine: 'autre', agId: null, retourEnAttente: effetRetourVoieElectronique({ nature: 'accord', recueLe: '2025-12-26' }) },
    ])
    const voie = voieDeNotification({ identiteId: 'id-1', demandes, date: '2026-01-03' })
    expect(voie).toMatchObject({ voie: 'postale', depuis: '2025-12-20', retour: { nature: 'accord', effet: '2026-01-04' } })
    // le jour de sa réception : de même
    expect(demandesDepuisConsentements([refus, accord], '2025-12-26')).toHaveLength(1)
  })

  it('à son effet : le refus n’est plus une demande (J59 inchangé sur le fond)', () => {
    expect(demandesDepuisConsentements([refus, accord], '2026-01-04')).toEqual([])
    expect(voieDeNotification({ identiteId: 'id-1', demandes: demandesDepuisConsentements([refus, accord], '2026-01-04'), date: '2026-01-04' }).voie).toBe('electronique')
  })

  it('un refus reçu après l’accord reste le dernier état : demande sans retour en attente', () => {
    const second = creerConsentementVoieElectronique({ identiteId: 'id-1', sens: 'refus', recuLe: '2025-12-28' })
    expect(demandesDepuisConsentements([refus, accord, second], '2026-01-10')).toEqual([{ identiteId: 'id-1', recueLe: '2025-12-28', origine: 'autre', agId: null }])
  })
})

describe('J74, relecture — accord en vigueur (accordElectroniqueEnVigueur) : l’accord donné après un refus ou un retrait vaut à son effet, à toute date', () => {
  const c = (sens: 'accord' | 'refus' | 'retrait', recuLe: string) => creerConsentementVoieElectronique({ identiteId: 'id-1', sens, recuLe })
  const etat = (consentements: ReturnType<typeof c>[], date: string) => ({
    enVigueur: accordElectroniqueEnVigueur({ identiteId: 'id-1', consentements, date }),
    enAttente: accordElectroniqueEnAttente({ identiteId: 'id-1', consentements, date }),
  })

  it('après un refus, même reçu avant le 25/12/2025 : en attente jusqu’au lendemain du huitième jour, puis en vigueur', () => {
    const accord = c('accord', '2025-12-20')
    const consentements = [c('refus', '2025-10-01'), accord]
    const retour = effetRetourVoieElectronique({ nature: 'accord', recueLe: '2025-12-20' })
    expect(retour.effet).toBe('2025-12-29')
    for (const date of ['2025-12-20', '2025-12-22', '2025-12-28']) expect(etat(consentements, date), date).toEqual({ enVigueur: null, enAttente: retour })
    expect(etat(consentements, '2025-12-29')).toEqual({ enVigueur: accord, enAttente: null })
    // le paramètre de durée est celui de J74 (D. 1967 art. 64-4)
    expect(JOURS_AVANT_EFFET_RETOUR_VOIE_ELECTRONIQUE).toBe(9)
  })

  it('après un retrait : de même ; premier accord, sans refus ni retrait avant lui : en vigueur dès sa réception (inchangé)', () => {
    expect(etat([c('accord', '2025-03-01'), c('retrait', '2025-06-01'), c('accord', '2025-12-10')], '2025-12-12')).toMatchObject({
      enVigueur: null,
      enAttente: { nature: 'accord', recueLe: '2025-12-10', effet: '2025-12-19' },
    })
    const premier = c('accord', '2025-12-10')
    expect(etat([premier], '2025-12-10')).toEqual({ enVigueur: premier, enAttente: null })
  })

  it('plusieurs accords après le refus : l’effet du premier fait foi ; un refus reçu ensuite l’emporte', () => {
    const second = c('accord', '2026-01-08')
    expect(etat([c('refus', '2026-01-02'), c('accord', '2026-01-05'), second], '2026-01-14')).toEqual({ enVigueur: second, enAttente: null })
    expect(etat([c('refus', '2026-01-02'), c('accord', '2026-01-05'), second], '2026-01-13')).toMatchObject({ enVigueur: null, enAttente: { effet: '2026-01-14' } })
    expect(etat([c('refus', '2026-01-02'), c('accord', '2026-01-05'), c('refus', '2026-01-06')], '2026-02-01')).toEqual({ enVigueur: null, enAttente: null })
  })

  it('même jour : le refus puis l’accord enregistré après : en attente puis en vigueur ; l’accord puis le refus : aucun accord', () => {
    const accord = c('accord', '2026-02-01')
    const refus = c('refus', '2026-02-01')
    expect(etat([refus, accord], '2026-02-09')).toMatchObject({ enVigueur: null, enAttente: { effet: '2026-02-10' } })
    expect(etat([refus, accord], '2026-02-10')).toEqual({ enVigueur: accord, enAttente: null })
    expect(etat([accord, refus], '2026-02-10')).toEqual({ enVigueur: null, enAttente: null })
  })

  it('en-tête : l’accord en vigueur suit J74 ; la phrase « lit toujours l’accord dès sa réception » est retirée ; choix 🔵 dit', () => {
    const { item } = enTeteDuModule('voie-notification')
    const j74 = item('Décision de Hugo du 18/11/2026 (registre des décisions juridiques, J74')
    expect(j74).not.toMatch(/lit toujours l'accord dès sa réception/)
    expect(j74).toMatch(/accordElectroniqueEnVigueur/)
    expect(j74).toMatch(/🔵 L'accord donné après un refus ou un retrait reçu avant le 25\/12\/2025 suit aussi J74/)
  })
})
