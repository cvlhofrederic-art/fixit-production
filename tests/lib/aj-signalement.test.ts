// tests/lib/aj-signalement.test.ts
//
// AJ Signalement, modules sans React : règles du formulaire public (coordonnées obligatoires, bâtiment et qualité
// compris, parcours du portail, corps du POST avec l'adresse proposée et le numéro du signalement lié), schémas Zod
// des routes, jeton / adresse publique / numéro, libellés et calculs du tableau de bord, API cliente (dépôt,
// adresse proposée, signalements semblables, codes d'erreur).

import { describe, it, expect } from 'vitest'
import { TEXTES_SIGNALEMENT_QR } from '@/lib/aj-signalement/textes'
import { textesCopro } from '@/lib/coproprietaire/textes'
import {
  VALEURS_INITIALES_QR, construireSaisieQr, erreursCoordonnees, formulaireComplet, lieuLogementQr, telephoneValide,
  type ValeursFormulaireQr,
} from '@/lib/aj-signalement/formulaire'
import { estJetonQr, numeroSignalementQr, urlSignalementQr, type SignalementQr } from '@/lib/aj-signalement/types'
import {
  ACTIONS_STATUT_QR, analyserEmailsQr, compteursTableauQr, dateHeureParis, etatConfirmationQr, filtrerSignalementsQr, libelleQualiteQr,
  lieuSignalementQr, messageErreurTableauQr, resumeCompteursQr, situationLotQr, texteSignalementLieQr,
} from '@/lib/aj-signalement/affichage'
import { chargerSemblablesQr, codeDepuisReponseQr, envoyerSignalementQr, proposerAdresseQr } from '@/lib/aj-signalement/api'
import {
  adresseQrSchema, coproprieteQrSchema, modificationCoproprieteQrSchema, semblablesQrQuerySchema, signalementQrSchema, statutSignalementQrSchema,
} from '@/lib/validation'

const JETON = '0123456789abcdef0123456789abcdef'

const complet: ValeursFormulaireQr = {
  ...VALEURS_INITIALES_QR,
  prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'Marie.Durand@Example.com', batiment: 'B', etage: '4', numLot: '12',
  qualite: 'proprietaire', lieu: 'logement', type: 'Plomberie (fuite, colonne, robinetterie)', description: 'Fuite sous l’évier de la cuisine', urgence: 'urgent',
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
    qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieId: null,
    creeLe: '2026-11-04T14:05:00.000Z', misAJourLe: '2026-11-04T14:05:00.000Z',
    ...sur,
  }
}

describe('formulaire public : coordonnées obligatoires', () => {
  it('tout vide = chaque champ manque, bâtiment compris (tous obligatoires depuis le 06/11/2026)', () => {
    expect(erreursCoordonnees(VALEURS_INITIALES_QR)).toEqual({
      prenom: 'obligatoire', nom: 'obligatoire', telephone: 'obligatoire', email: 'obligatoire', batiment: 'obligatoire', etage: 'obligatoire', numLot: 'obligatoire',
    })
    expect(erreursCoordonnees({ ...complet, batiment: '   ' })).toEqual({ batiment: 'obligatoire' })
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
    expect(formulaireComplet({ ...complet, batiment: '' })).toBe(false)
    expect(formulaireComplet({ ...complet, qualite: '' })).toBe(false)
    expect(formulaireComplet({ ...complet, qualite: 'locataire' })).toBe(true)
  })

  it('corps du POST : e-mail en minuscules, zone seulement pour les parties communes, priorité comme le portail', () => {
    const saisie = construireSaisieQr(complet, JETON, 'fr')
    expect(saisie).toMatchObject({
      jeton: JETON, prenom: 'Marie', nom: 'Durand', email: 'marie.durand@example.com', batiment: 'B', etage: '4', numLot: '12',
      estPartieCommune: false, zoneSignalee: '', priorite: 'urgente', langue: 'fr', description: 'Fuite sous l’évier de la cuisine',
      qualiteDeclarant: 'proprietaire', adresseProposee: '', signalementLieNumero: '',
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
    expect(lieuLogementQr({ ...complet, batiment: '', etage: '1' }, 'fr', t, tq)).toBe('1er étage, lot 12')
    expect(lieuLogementQr({ ...complet, batiment: '', etage: 'RDC' }, 'fr', t, tq)).toBe('étage RDC, lot 12')
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

  it('valeurs par défaut : zone, adresse proposée et numéro lié vides, langue fr ; le bâtiment n’a plus de valeur par défaut', () => {
    const { zoneSignalee: _z, langue: _l, adresseProposee: _a, signalementLieNumero: _n, ...sans } = base
    const r = signalementQrSchema.safeParse(sans)
    expect(r.success && r.data).toMatchObject({ batiment: 'B', zoneSignalee: '', langue: 'fr', adresseProposee: '', signalementLieNumero: '' })
    const { batiment: _b, ...sansBatiment } = base
    expect(signalementQrSchema.safeParse(sansBatiment).success).toBe(false)
  })

  it('bâtiment et qualité obligatoires ; numéro lié = 8 hexadécimaux majuscules ou vide ; adresse proposée bornée à 300', () => {
    expect(signalementQrSchema.safeParse({ ...base, batiment: '  ' }).success).toBe(false)
    const { qualiteDeclarant: _q, ...sansQualite } = base
    expect(signalementQrSchema.safeParse(sansQualite).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, qualiteDeclarant: 'syndic' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, qualiteDeclarant: 'locataire' }).success).toBe(true)
    expect(signalementQrSchema.safeParse({ ...base, signalementLieNumero: '1A2B3C4D' }).success).toBe(true)
    expect(signalementQrSchema.safeParse({ ...base, signalementLieNumero: '1a2b3c4d' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, signalementLieNumero: '1A2B3C4D-0000' }).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, adresseProposee: 'x'.repeat(300) }).success).toBe(true)
    expect(signalementQrSchema.safeParse({ ...base, adresseProposee: 'x'.repeat(301) }).success).toBe(false)
  })

  it('parties communes : zone obligatoire, comme dans le formulaire (vide, espaces ou absente = refusé) ; logement : zone facultative', () => {
    const communes = construireSaisieQr({ ...complet, lieu: 'communes', zone: 'Escalier' }, JETON, 'fr')
    expect(signalementQrSchema.safeParse(communes).success).toBe(true)
    for (const zoneSignalee of ['', '   ']) {
      const r = signalementQrSchema.safeParse({ ...communes, zoneSignalee })
      expect(r.success, `zone « ${zoneSignalee} »`).toBe(false)
      expect(r.error?.issues.map((i) => i.path.join('.'))).toContain('zoneSignalee')
      expect(formulaireComplet({ ...complet, lieu: 'communes', zone: zoneSignalee })).toBe(false)
    }
    const { zoneSignalee: _z, ...sansZone } = communes
    expect(signalementQrSchema.safeParse(sansZone).success).toBe(false)
    expect(signalementQrSchema.safeParse({ ...base, estPartieCommune: false, zoneSignalee: '' }).success).toBe(true)
  })

  it('adresse proposée : jeton, latitude −90..90, longitude −180..180 ; semblables : jeton, bâtiment, zone, langue', () => {
    expect(adresseQrSchema.safeParse({ jeton: JETON, latitude: 43.29, longitude: 5.37 }).success).toBe(true)
    expect(adresseQrSchema.safeParse({ jeton: JETON, latitude: 91, longitude: 5.37 }).success).toBe(false)
    expect(adresseQrSchema.safeParse({ jeton: JETON, latitude: 43.29, longitude: -180.1 }).success).toBe(false)
    expect(adresseQrSchema.safeParse({ jeton: JETON, latitude: Number.NaN, longitude: 5.37 }).success).toBe(false)
    expect(adresseQrSchema.safeParse({ jeton: 'abc', latitude: 43.29, longitude: 5.37 }).success).toBe(false)
    const r = semblablesQrQuerySchema.safeParse({ jeton: JETON, batiment: ' B ', zone: 'Escalier' })
    expect(r.success && r.data).toEqual({ jeton: JETON, batiment: 'B', zone: 'Escalier', langue: 'fr' })
    expect(semblablesQrQuerySchema.safeParse({ jeton: JETON, batiment: '', zone: 'Escalier' }).success).toBe(false)
    expect(semblablesQrQuerySchema.safeParse({ jeton: JETON, batiment: 'B', zone: '' }).success).toBe(false)
  })

  it('copropriété : nom requis, e-mails valides, valeurs par défaut ; modification : jeton régénérable, statut borné', () => {
    const r = coproprieteQrSchema.safeParse({ nom: 'Parc Belle Ombre' })
    // Champs de gestion ajoutés le 11/11/2026 (tests/lib/aj-signalement-validation.test.ts) : valeurs par défaut.
    expect(r.success && r.data).toMatchObject({ nom: 'Parc Belle Ombre', adresse: '', emailsDestinataires: [], gestionnaireIds: [], attribueeATous: false })
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

describe('corps du POST : adresse proposée et signalement lié (demandes de Hugo du 06/11/2026)', () => {
  it('adresse proposée nettoyée et bornée ; numéro lié seulement pour les parties communes et bien formé', () => {
    const communes = { ...complet, lieu: 'communes' as const, zone: 'Escalier' }
    expect(construireSaisieQr(communes, JETON, 'fr', { adresseProposee: '  1 Quai du Port 13002 Marseille ', signalementLieNumero: '1A2B3C4D' }))
      .toMatchObject({ adresseProposee: '1 Quai du Port 13002 Marseille', signalementLieNumero: '1A2B3C4D', qualiteDeclarant: 'proprietaire' })
    expect(construireSaisieQr(communes, JETON, 'fr', { adresseProposee: 'x'.repeat(400) }).adresseProposee).toHaveLength(300)
    expect(construireSaisieQr(complet, JETON, 'fr', { signalementLieNumero: '1A2B3C4D' }).signalementLieNumero).toBe('')
    expect(construireSaisieQr(communes, JETON, 'fr', { signalementLieNumero: 'pas-un-numero' }).signalementLieNumero).toBe('')
    expect(signalementQrSchema.safeParse(construireSaisieQr(communes, JETON, 'pt', { signalementLieNumero: '1A2B3C4D' })).success).toBe(true)
  })
})

describe('tableau de bord : qualité et lien', () => {
  it('qualité : Propriétaire, Locataire, « Non indiquée » pour les signalements antérieurs', () => {
    expect(libelleQualiteQr('proprietaire')).toBe('Propriétaire')
    expect(libelleQualiteQr('locataire')).toBe('Locataire')
    expect(libelleQualiteQr(null)).toBe('Non indiquée')
  })

  it('lien : « Même problème que le signalement n° X » ; rien sans lien', () => {
    expect(texteSignalementLieQr('1a2b3c4d-0000-4000-8000-000000000001')).toBe('Même problème que le signalement n° 1A2B3C4D')
    expect(texteSignalementLieQr(null)).toBe('')
  })
})

describe('API cliente : adresse proposée et signalements semblables', () => {
  type Appel = { url: string; init?: RequestInit }
  const simuler = (corps: unknown, status = 200) => {
    const appels: Appel[] = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      appels.push({ url, init })
      return new Response(JSON.stringify(corps), { status })
    }) as unknown as typeof fetch
    return { appels, fetchImpl }
  }

  it('adresse : POST du jeton et de la position dans le corps (jamais dans l’URL) ; adresse ou null ; codes d’échec', async () => {
    const { appels, fetchImpl } = simuler({ adresse: '1 Quai du Port 13002 Marseille' })
    expect(await proposerAdresseQr(JETON, 43.2951, 5.3741, fetchImpl)).toEqual({ ok: true, adresse: '1 Quai du Port 13002 Marseille' })
    expect(appels[0].url).toBe('/api/aj-signalement/adresse')
    expect(appels[0].init?.method).toBe('POST')
    expect(JSON.parse(String(appels[0].init?.body))).toEqual({ jeton: JETON, latitude: 43.2951, longitude: 5.3741 })
    expect(appels[0].url).not.toContain('43.29')
    expect(await proposerAdresseQr(JETON, 43.2951, 5.3741, simuler({ adresse: null }).fetchImpl)).toEqual({ ok: true, adresse: null })
    expect(await proposerAdresseQr(JETON, 43.2951, 5.3741, simuler({ adresse: 42 }).fetchImpl)).toEqual({ ok: true, adresse: null })
    expect(await proposerAdresseQr(JETON, 43.2951, 5.3741, simuler({ error: 'adresse_connue' }, 409).fetchImpl)).toEqual({ ok: false, code: 'invalide' })
    expect(await proposerAdresseQr(JETON, 43.2951, 5.3741, simuler({ error: 'rate' }, 429).fetchImpl)).toEqual({ ok: false, code: 'trop_de_demandes' })
  })

  it('semblables : GET avec jeton, bâtiment, zone et langue ; fiches mal formées écartées', async () => {
    const fiche = { numero: '1A2B3C4D', typeIntervention: 'Ascenseur', zone: 'Escalier', creeLe: '2026-11-05', statut: 'acceptee' }
    const { appels, fetchImpl } = simuler({
      semblables: [
        fiche, { ...fiche, numero: 'pas-un-numero' }, { ...fiche, statut: 'terminee' }, { ...fiche, zone: 3 }, null,
        // La date est un jour (AAAA-MM-JJ) : une fiche qui porterait l'heure du dépôt est écartée.
        { ...fiche, numero: '5E6F7A8B', creeLe: '2026-11-05T13:32:07.123456+00:00' },
      ],
    })
    expect(await chargerSemblablesQr({ jeton: JETON, batiment: 'Bât. B', zone: 'Hall d’entrée', langue: 'fr' }, fetchImpl)).toEqual({ ok: true, semblables: [fiche] })
    const url = new URL(appels[0].url, 'https://vitfix.io')
    expect(url.pathname).toBe('/api/aj-signalement/similaires')
    expect(Object.fromEntries(url.searchParams)).toEqual({ jeton: JETON, batiment: 'Bât. B', zone: 'Hall d’entrée', langue: 'fr' })
    expect(appels[0].init?.method).toBe('GET')
    expect(await chargerSemblablesQr({ jeton: JETON, batiment: 'B', zone: 'Escalier', langue: 'pt' }, simuler({}).fetchImpl)).toEqual({ ok: true, semblables: [] })
    expect(await chargerSemblablesQr({ jeton: JETON, batiment: 'B', zone: 'Escalier', langue: 'fr' }, simuler({ error: 'introuvable' }, 404).fetchImpl))
      .toEqual({ ok: false, code: 'introuvable' })
  })
})
