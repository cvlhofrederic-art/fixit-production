// tests/lib/aj-signalement-batiments.test.ts
//
// Bâtiments proposés au déclarant (demande de Hugo du 17/11/2026 : « un champ de remplissage par choix avec les
// bâtiments prédéfinis par nous ») — règles pures (lib/aj-signalement/batiments.ts), schéma Zod du dépôt
// (batimentListeQrSchema, lib/validation.ts) et code d'erreur de l'API cliente :
//   - liste vue par le public : textes seuls, nettoyés, 50 caractères au plus, doublons écartés à la casse et aux espaces
//     près (le premier saisi reste), ordre saisi par le cabinet ;
//   - bâtiment d'un dépôt : retrouvé dans la liste à la casse et aux espaces près, rendu sous le nom saisi par le cabinet ;
//     absent de la liste → refusé (plus strict que la comparaison des signalements semblables) ;
//   - 400 batiment_inconnu → code « batiment_inconnu » pour l'écran (jamais le texte du serveur).

import { describe, it, expect } from 'vitest'
import { BATIMENT_MAX_QR, batimentDeLaListeQr, batimentsProposesQr } from '@/lib/aj-signalement/batiments'
import { batimentListeQrSchema, signalementQrSchema } from '@/lib/validation'
import { codeDepuisReponseQr, envoyerSignalementQr } from '@/lib/aj-signalement/api'
import { VALEURS_INITIALES_QR, construireSaisieQr } from '@/lib/aj-signalement/formulaire'

const PARC_BEL_OMBRE = ['Titan', 'Planier', 'Cicies', 'Faraman', 'commerces']
const JETON = '0123456789abcdef0123456789abcdef'

describe('batimentsProposesQr : la liste vue par le public', () => {
  it('garde l’ordre saisi par le cabinet', () => {
    expect(batimentsProposesQr(PARC_BEL_OMBRE)).toEqual(PARC_BEL_OMBRE)
  })

  it('retire les espaces autour, les vides, les non-textes et ce qui dépasse la borne du champ (50 caractères)', () => {
    const long = 'x'.repeat(BATIMENT_MAX_QR + 1)
    expect(BATIMENT_MAX_QR).toBe(50)
    expect(batimentsProposesQr(['  Titan ', '', '   ', 42, null, long, 'x'.repeat(50), 'Planier'])).toEqual(['Titan', 'x'.repeat(50), 'Planier'])
  })

  it('écarte les doublons à la casse et aux espaces près : le premier saisi reste', () => {
    expect(batimentsProposesQr(['Les Pins', 'Titan', 'les  pins', 'TITAN', ' Titan'])).toEqual(['Les Pins', 'Titan'])
  })

  it('colonne vide, absente ou d’une autre forme : aucune liste', () => {
    expect(batimentsProposesQr([])).toEqual([])
    expect(batimentsProposesQr(null)).toEqual([])
    expect(batimentsProposesQr(undefined)).toEqual([])
    expect(batimentsProposesQr('Titan')).toEqual([])
    expect(batimentsProposesQr({ 0: 'Titan' })).toEqual([])
  })
})

describe('batimentDeLaListeQr : le nom saisi par le cabinet', () => {
  it('sans tenir compte de la casse ni des espaces en trop', () => {
    expect(batimentDeLaListeQr('Titan', PARC_BEL_OMBRE)).toBe('Titan')
    expect(batimentDeLaListeQr('  tItAn  ', PARC_BEL_OMBRE)).toBe('Titan')
    expect(batimentDeLaListeQr('COMMERCES', PARC_BEL_OMBRE)).toBe('commerces')
    expect(batimentDeLaListeQr('les    pins', ['Les Pins'])).toBe('Les Pins')
    // Même lettre accentuée écrite en un ou deux caractères (clavier, copier-coller) : le même bâtiment.
    expect(batimentDeLaListeQr('Ciciès', ['Ciciès'])).toBe('Ciciès')
  })

  it('absent de la liste : null (le « A » saisi pour Parc Bel Ombre, un préfixe, un accent manquant)', () => {
    expect(batimentDeLaListeQr('A', PARC_BEL_OMBRE)).toBeNull()
    expect(batimentDeLaListeQr('', PARC_BEL_OMBRE)).toBeNull()
    expect(batimentDeLaListeQr('Bât. Titan', PARC_BEL_OMBRE)).toBeNull()
    expect(batimentDeLaListeQr('Ciciès', PARC_BEL_OMBRE)).toBeNull()
    expect(batimentDeLaListeQr('Titan', [])).toBeNull()
  })
})

describe('batimentListeQrSchema : contrôle Zod du dépôt quand la copropriété a une liste', () => {
  it('accepte un bâtiment de la liste et rend le nom saisi par le cabinet', () => {
    const r = batimentListeQrSchema(PARC_BEL_OMBRE).safeParse(' planier ')
    expect(r.success && r.data).toBe('Planier')
  })

  it('refuse un bâtiment absent de la liste, avec un message sans la liste', () => {
    const r = batimentListeQrSchema(PARC_BEL_OMBRE).safeParse('A')
    expect(r.success).toBe(false)
    const message = r.error?.issues.map((i) => i.message).join(' ') ?? ''
    expect(message).toMatch(/liste/)
    for (const nom of PARC_BEL_OMBRE) expect(message).not.toContain(nom)
  })

  it('le schéma du dépôt lui-même ne change pas : un bâtiment libre reste valide (copropriété sans liste)', () => {
    const saisie = construireSaisieQr({
      ...VALEURS_INITIALES_QR, prenom: 'Marie', nom: 'Durand', telephone: '06 12 34 56 78', email: 'marie@example.com', batiment: 'A',
      etage: '4', numLot: '12', qualite: 'proprietaire', lieu: 'logement', type: 'Ascenseur', description: 'Ascenseur bloqué', urgence: 'non',
    }, JETON, 'fr')
    expect(signalementQrSchema.safeParse(saisie).success).toBe(true)
  })
})

describe('API cliente : bâtiment absent de la liste', () => {
  it('400 batiment_inconnu → code dédié ; autre statut ou autre erreur → règle d’avant', () => {
    expect(codeDepuisReponseQr(400, { error: 'batiment_inconnu', message: 'texte du serveur' })).toBe('batiment_inconnu')
    expect(codeDepuisReponseQr(400, { error: 'invalide' })).toBe('invalide')
    expect(codeDepuisReponseQr(409, { error: 'batiment_inconnu' })).toBe('invalide')
  })

  it('dépôt refusé : échec avec le code, sans le texte du serveur', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: 'batiment_inconnu', message: 'texte du serveur' }), { status: 400 })) as unknown as typeof fetch
    const saisie = construireSaisieQr({ ...VALEURS_INITIALES_QR, batiment: 'A' }, JETON, 'fr')
    expect(await envoyerSignalementQr(saisie, fetchImpl)).toEqual({ ok: false, code: 'batiment_inconnu' })
  })
})
