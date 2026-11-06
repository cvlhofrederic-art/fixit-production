// tests/lib/aj-signalement.test.ts
//
// AJ Signalement, modules sans React : règles du formulaire public (coordonnées obligatoires, parcours du
// portail, corps du POST), schémas Zod de la route, jeton / adresse publique / numéro, libellés et calculs
// du tableau de bord, codes d'erreur de l'API cliente.

import { describe, it, expect } from 'vitest'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { textesCopro } from '@/lib/coproprietaire/textes'
import {
  VALEURS_INITIALES_QR, construireSaisieQr, erreursCoordonnees, formulaireComplet, lieuLogementQr, telephoneValide,
  type ValeursFormulaireQr,
} from '@/lib/aj-signalement/formulaire'
import { estJetonQr, numeroSignalementQr, urlSignalementQr, type SignalementQr } from '@/lib/aj-signalement/types'
import {
  ACTIONS_STATUT_QR, analyserEmailsQr, compteursTableauQr, dateHeureParis, etatConfirmationQr, filtrerSignalementsQr, lieuSignalementQr,
  messageErreurTableauQr, resumeCompteursQr, situationLotQr,
} from '@/lib/aj-signalement/affichage'
import { codeDepuisReponseQr, envoyerSignalementQr } from '@/lib/aj-signalement/api'
import { coproprieteQrSchema, modificationCoproprieteQrSchema, signalementQrSchema, statutSignalementQrSchema } from '@/lib/validation'

const JETON = '0123456789abcdef0123456789abcdef'

const complet: ValeursFormulaireQr = {
  ...VALEURS_INITIALES_QR,
  prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'Marie.Durand@Example.com', etage: '4', numLot: '12',
  lieu: 'logement', type: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', urgence: 'urgent',
}

export function signalementTest(sur: Partial<SignalementQr> = {}): SignalementQr {
  return {
    id: '5f2c9a1e-1111-4222-8333-444444444444',
    coproprieteId: 'c0000000-0000-4000-8000-000000000001',
    coproprieteNom: 'Parc Belle Ombre',
    prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie.durand@example.com',
    batiment: 'B', etage: '4', numLot: '12',
    estPartieCommune: false, zoneSignalee: '',
    typeIntervention: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier',
    priorite: 'urgente', statut: 'en_attente', langue: 'fr',
    emailEnvoyeLe: '2026-11-04T14:05:10.000Z', emailErreur: null,
    confirmationEnvoyeeLe: '2026-11-04T14:05:12.000Z', confirmationErreur: null,
    creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
    ...sur,
  }
}

describe('formulaire public : coordonnées obligatoires', () => {
  it('tout vide = chaque champ obligatoire manque (le bâtiment n’est pas exigé)', () => {
    expect(erreursCoordonnees(VALEURS_INITIALES_QR)).toEqual({
      prenom: 'obligatoire', nom: 'obligatoire', telephone: 'obligatoire', email: 'obligatoire', etage: 'obligatoire', numLot: 'obligatoire',
    })
  })

  it('e-mail sans domaine et téléphone trop court sont invalides ; coordonnées complètes = aucune erreur', () => {
    expect(erreursCoordonnees({ ...complet, email: 'marie@localhost', telephone: '12' })).toEqual({ email: 'invalide', telephone: 'invalide' })
    expect(erreursCoordonnees(complet)).toEqual({})
  })

  it('téléphone : six chiffres au moins, caractères usuels seulement', () => {
    expect(telephoneValide('+33 6 12 34 56 78')).toBe(true)
    expect(telephoneValide('06.12.34.56.78')).toBe(true)
    expect(telephoneValide('(04) 91 00 00 00')).toBe(true)
    expect(telephoneValide('12345')).toBe(false)
    expect(telephoneValide('appelez-moi')).toBe(false)
  })
})

describe('formulaire public : parcours du portail', () => {
  it('complet seulement avec lieu (zone pour les parties communes), type, 10 caractères et urgence', () => {
    expect(formulaireComplet(complet)).toBe(true)
    expect(formulaireComplet({ ...complet, lieu: 'communes' })).toBe(false)
    expect(formulaireComplet({ ...complet, lieu: 'communes', zone: 'Escalier' })).toBe(true)
    expect(formulaireComplet({ ...complet, description: 'Court' })).toBe(false)
    expect(formulaireComplet({ ...complet, urgence: '' })).toBe(false)
    expect(formulaireComplet({ ...complet, type: '' })).toBe(false)
    expect(formulaireComplet({ ...complet, email: '' })).toBe(false)
  })

  it('corps du POST : e-mail en minuscules, zone seulement pour les parties communes, priorité comme le portail', () => {
    const saisie = construireSaisieQr(complet, JETON, 'fr')
    expect(saisie).toMatchObject({
      jeton: JETON, prenom: 'Marie', nom: 'Durand', email: 'marie.durand@example.com', batiment: '', etage: '4', numLot: '12',
      estPartieCommune: false, zoneSignalee: '', priorite: 'urgente', langue: 'fr', description: 'Fuite sous l’évier de la cuisine',
    })
    expect(construireSaisieQr({ ...complet, lieu: 'communes', zone: 'Escalier', urgence: 'genant' }, JETON, 'pt'))
      .toMatchObject({ estPartieCommune: true, zoneSignalee: 'Escalier', priorite: 'normale', langue: 'pt' })
    expect(construireSaisieQr({ ...complet, urgence: 'non' }, JETON, 'fr').priorite).toBe('normale')
    expect(signalementQrSchema.safeParse(saisie).success).toBe(true)
  })

  it('lieu du logement d’après la saisie : « bât. B, 4e étage, lot 12 », « 1er étage », sinon « votre logement »', () => {
    const t = textesCopro('fr')
    const tq = TEXTES_SIGNALEMENT_QR.fr
    expect(lieuLogementQr(VALEURS_INITIALES_QR, 'fr', t, tq)).toBe('votre logement')
    expect(lieuLogementQr({ ...complet, batiment: 'B' }, 'fr', t, tq)).toBe('bât. B, 4e étage, lot 12')
    expect(lieuLogementQr({ ...complet, etage: '1' }, 'fr', t, tq)).toBe('1er étage, lot 12')
    expect(lieuLogementQr({ ...complet, etage: 'RDC' }, 'fr', t, tq)).toBe('étage RDC, lot 12')
    expect(lieuLogementQr(complet, 'pt', textesCopro('pt'), TEXTES_SIGNALEMENT_QR.pt)).toContain('4.º')
  })
})

describe('schémas Zod de la route', () => {
  const base = construireSaisieQr(complet, JETON, 'fr')

  it('refuse un jeton mal formé, un e-mail sans domaine, une description courte, un étage vide', () => {
    expect(signalementQrSchema.safeParse({ ...base, jeton: 'abc' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, email: 'x@localhost' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, description: 'court' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, etage: '' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, telephone: '12' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, priorite: 'haute' }).success).toBe(false)
  })

  it('valeurs par défaut : bâtiment et zone vides, langue fr', () => {
    const { batiment: _b, zoneSignalee: _z, langue: _l, ...sans } = base
    const r = signalementQrSchema.safeParse(sans)
    expect(r.success && r.data).toMatchObject({ batiment: '', zoneSignalee: '', langue: 'fr' })
  })

  it('copropriété : nom requis, e-mails valides, valeurs par défaut ; modification : jeton régénérable, statut borné', () => {
    const r = coproprieteQrSchema.safeParse({ nom: 'Parc Belle Ombre' })
    expect(r.success && r.data).toEqual({ nom: 'Parc Belle Ombre', adresse: '', emailsDestinataires: [] })
    expect(coproprieteQrSchema.safeParse({ nom: '   ' }).success).toBe(false)
    expect(coproprieteQrSchema.safeParse({ nom: 'X', emailsDestinataires: ['pas-un-email'] }).success).toBe(false)
    expect(modificationCoproprieteQrSchema.safeParse({ regenererJeton: true }).success).toBe(true)
    expect(statutSignalementQrSchema.safeParse({ statut: 'terminee' }).success).toBe(true)
    expect(statutSignalementQrSchema.safeParse({ statut: 'perdu' }).success).toBe(false)
  })
})

describe('jeton, adresse publique, numéro', () => {
  it('jeton = 32 hexadécimaux minuscules ; adresse sous /fr/signalement/ ; numéro = 8 caractères en majuscules', () => {
    expect(estJetonQr(JETON)).toBe(true)
    expect(estJetonQr(JETON.toUpperCase())).toBe(false)
    expect(estJetonQr('abc')).toBe(false)
    expect(estJetonQr(null)).toBe(false)
    expect(urlSignalementQr(JETON)).toBe(`https://vitfix.io/fr/signalement/${JETON}/`)
    expect(urlSignalementQr(JETON, 'http://localhost:3000/')).toBe(`http://localhost:3000/fr/signalement/${JETON}/`)
    expect(numeroSignalementQr('5f2c9a1e-1111-4222-8333-444444444444')).toBe('5F2C9A1E')
  })
})

describe('tableau de bord : libellés et calculs', () => {
  it('lieu et situation du lot', () => {
    expect(lieuSignalementQr(signalementTest())).toBe('Logement (bât. B, étage 4, lot 12)')
    expect(lieuSignalementQr(signalementTest({ batiment: '' }))).toBe('Logement (étage 4, lot 12)')
    expect(lieuSignalementQr(signalementTest({ estPartieCommune: true, zoneSignalee: 'Hall d’entrée' }))).toBe('Parties communes — Hall d’entrée')
    expect(lieuSignalementQr(signalementTest({ estPartieCommune: true }))).toBe('Parties communes')
    expect(situationLotQr(signalementTest())).toBe('bât. B · étage 4 · lot 12')
  })

  it('compteurs, filtre par copropriété (du plus récent au plus ancien), résumé d’une copropriété', () => {
    const liste = [
      signalementTest({ id: 'a', creeLe: '2026-11-01T10:00:00.000Z' }),
      signalementTest({ id: 'b', creeLe: '2026-11-03T10:00:00.000Z', statut: 'en_cours', coproprieteId: 'autre' }),
      signalementTest({ id: 'c', creeLe: '2026-11-02T10:00:00.000Z', statut: 'terminee' }),
      signalementTest({ id: 'd', creeLe: '2026-11-04T10:00:00.000Z', statut: 'acceptee' }),
    ]
    expect(compteursTableauQr(liste)).toEqual({ total: 4, aTraiter: 1, enCours: 2, resolus: 1 })
    expect(filtrerSignalementsQr(liste, '').map((s) => s.id)).toEqual(['d', 'b', 'c', 'a'])
    expect(filtrerSignalementsQr(liste, 'c0000000-0000-4000-8000-000000000001').map((s) => s.id)).toEqual(['d', 'c', 'a'])
    expect(resumeCompteursQr({ nbSignalements: 0, nbEnAttente: 0 })).toBe('Aucun signalement')
    expect(resumeCompteursQr({ nbSignalements: 1, nbEnAttente: 0 })).toBe('1 signalement')
    expect(resumeCompteursQr({ nbSignalements: 3, nbEnAttente: 1 })).toBe('3 signalements · 1 à traiter')
  })

  it('e-mails saisis : séparateurs, minuscules, doublons, invalides à part', () => {
    expect(analyserEmailsQr('A@b.fr, c@d.com ; a@B.FR pas-un-email\n e@f.org')).toEqual({
      emails: ['a@b.fr', 'c@d.com', 'e@f.org'], invalides: ['pas-un-email'],
    })
    expect(analyserEmailsQr('')).toEqual({ emails: [], invalides: [] })
  })

  it('transitions de statut : chaque statut propose une suite, un signalement résolu peut être rouvert', () => {
    expect(ACTIONS_STATUT_QR.en_attente.map((a) => a.statut)).toEqual(['acceptee', 'terminee', 'annulee'])
    expect(ACTIONS_STATUT_QR.terminee).toEqual([{ libelle: 'Rouvrir', statut: 'en_attente' }])
    expect(messageErreurTableauQr('base_absente')).toContain('20261104_signalements_qr.sql')
  })

  it('état de la confirmation au déclarant : envoyée (date de Paris), non envoyée avec ou sans raison', () => {
    expect(etatConfirmationQr(signalementTest())).toBe('Confirmation envoyée au déclarant le 4 novembre 2026 à 15:05.')
    expect(etatConfirmationQr(signalementTest({ confirmationEnvoyeeLe: null, confirmationErreur: 'limite atteinte' })))
      .toBe('Confirmation non envoyée au déclarant : limite atteinte.')
    // Dépôts antérieurs à la confirmation (colonnes nulles).
    expect(etatConfirmationQr(signalementTest({ confirmationEnvoyeeLe: null, confirmationErreur: null }))).toBe('Confirmation non envoyée au déclarant.')
  })

  it('date et heure de Paris en français (par défaut) et en portugais', () => {
    expect(dateHeureParis('2026-11-04T13:05:00.000Z')).toBe('4 novembre 2026 à 14:05')
    expect(dateHeureParis('2026-11-04T13:05:00.000Z', 'pt')).toBe('4 de novembro de 2026 às 14:05')
    expect(dateHeureParis('pas une date', 'pt')).toBe('pas une date')
  })
})

describe('API cliente : dépôt', () => {
  it('lit l’état des deux e-mails dans la réponse ; confirmation absente = non envoyée', async () => {
    const reponse = (signalement: Record<string, unknown>) => (async () => new Response(JSON.stringify({ signalement }), { status: 200 })) as unknown as typeof fetch
    const saisie = construireSaisieQr(complet, JETON, 'fr')
    const base = { id: 'b1c2d3e4-0000-4000-8000-000000000000', numero: 'B1C2D3E4', creeLe: '2026-11-04T14:05:00.000Z', emailEnvoye: true }
    expect(await envoyerSignalementQr(saisie, reponse({ ...base, confirmationEnvoyee: true })))
      .toEqual({ ok: true, ...base, confirmationEnvoyee: true })
    expect(await envoyerSignalementQr(saisie, reponse(base))).toMatchObject({ ok: true, confirmationEnvoyee: false })
  })
})

describe('API cliente : codes d’erreur', () => {
  it('base_absente prime, puis le statut HTTP', () => {
    expect(codeDepuisReponseQr(503, { error: 'base_absente' })).toBe('base_absente')
    expect(codeDepuisReponseQr(401, null)).toBe('non_authentifie')
    expect(codeDepuisReponseQr(403, { error: 'interdit' })).toBe('interdit')
    expect(codeDepuisReponseQr(404, null)).toBe('introuvable')
    expect(codeDepuisReponseQr(429, null)).toBe('trop_de_demandes')
    expect(codeDepuisReponseQr(400, { error: 'invalide' })).toBe('invalide')
    expect(codeDepuisReponseQr(500, null)).toBe('serveur')
  })
})
