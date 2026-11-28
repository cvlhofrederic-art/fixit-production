// tests/lib/vitfixsignal-batiments.test.ts
//
// Bâtiments proposés au déclarant (demande du 17/11/2026 : « un champ de remplissage par choix avec les
// bâtiments prédéfinis par nous ») — règles pures (lib/vitfixsignal/batiments.ts), schéma Zod du dépôt
// (batimentListeQrSchema, lib/validation.ts) et code d'erreur de l'API cliente :
//   - liste vue par le public : textes seuls, nettoyés, 50 caractères au plus, doublons écartés à la casse et aux espaces
//     près (le premier saisi reste), ordre saisi par le cabinet ;
//   - bâtiment d'un dépôt : retrouvé dans la liste à la casse et aux espaces près, rendu sous le nom saisi par le cabinet ;
//     absent de la liste → refusé (plus strict que la comparaison des signalements semblables) ;
//   - 400 batiment_inconnu → code « batiment_inconnu » pour l'écran (jamais le texte du serveur).

import { describe, it, expect } from 'vitest'
import { BATIMENT_MAX_QR, batimentDeLaListeQr, batimentsProposesQr } from '@/lib/vitfixsignal/batiments'
import { batimentListeQrSchema, signalementQrSchema } from '@/lib/validation'
import { codeDepuisReponseQr, envoyerSignalementQr } from '@/lib/vitfixsignal/api'
import { VALEURS_INITIALES_QR, construireSaisieQr } from '@/lib/vitfixsignal/formulaire'

const RESIDENCE_EXEMPLE = ['Bâtiment A', 'Bâtiment B', 'Les Pins', 'commerces']
const JETON = '0123456789abcdef0123456789abcdef'

describe('batimentsProposesQr : la liste vue par le public', () => {
  it('garde l’ordre saisi par le cabinet', () => {
    expect(batimentsProposesQr(RESIDENCE_EXEMPLE)).toEqual(RESIDENCE_EXEMPLE)
  })

  it('retire les espaces autour, les vides, les non-textes et ce qui dépasse la borne du champ (50 caractères)', () => {
    const long = 'x'.repeat(BATIMENT_MAX_QR + 1)
    expect(BATIMENT_MAX_QR).toBe(50)
    expect(batimentsProposesQr(['  Bâtiment A ', '', '   ', 42, null, long, 'x'.repeat(50), 'Bâtiment B'])).toEqual(['Bâtiment A', 'x'.repeat(50), 'Bâtiment B'])
  })

  it('écarte les doublons à la casse et aux espaces près : le premier saisi reste', () => {
    expect(batimentsProposesQr(['Les Pins', 'Bâtiment A', 'les  pins', 'BÂTIMENT A', ' Bâtiment A'])).toEqual(['Les Pins', 'Bâtiment A'])
  })

  it('colonne vide, absente ou d’une autre forme : aucune liste', () => {
    expect(batimentsProposesQr([])).toEqual([])
    expect(batimentsProposesQr(null)).toEqual([])
    expect(batimentsProposesQr(undefined)).toEqual([])
    expect(batimentsProposesQr('Bâtiment A')).toEqual([])
    expect(batimentsProposesQr({ 0: 'Bâtiment A' })).toEqual([])
  })
})

describe('batimentDeLaListeQr : le nom saisi par le cabinet', () => {
  it('sans tenir compte de la casse ni des espaces en trop', () => {
    expect(batimentDeLaListeQr('Bâtiment A', RESIDENCE_EXEMPLE)).toBe('Bâtiment A')
    expect(batimentDeLaListeQr('  bÂtImEnT a  ', RESIDENCE_EXEMPLE)).toBe('Bâtiment A')
    expect(batimentDeLaListeQr('COMMERCES', RESIDENCE_EXEMPLE)).toBe('commerces')
    expect(batimentDeLaListeQr('les    pins', ['Les Pins'])).toBe('Les Pins')
    // Même lettre accentuée écrite en un ou deux caractères (clavier, copier-coller) : le même bâtiment.
    expect(batimentDeLaListeQr('Bâtiment A', ['Bâtiment A'])).toBe('Bâtiment A')
  })

  it('absent de la liste : null (le « A » saisi en texte libre, un préfixe, un accent manquant)', () => {
    expect(batimentDeLaListeQr('A', RESIDENCE_EXEMPLE)).toBeNull()
    expect(batimentDeLaListeQr('', RESIDENCE_EXEMPLE)).toBeNull()
    expect(batimentDeLaListeQr('Bât. Les Pins', RESIDENCE_EXEMPLE)).toBeNull()
    expect(batimentDeLaListeQr('Batiment A', RESIDENCE_EXEMPLE)).toBeNull()
    expect(batimentDeLaListeQr('Bâtiment A', [])).toBeNull()
  })
})

describe('batimentListeQrSchema : contrôle Zod du dépôt quand la copropriété a une liste', () => {
  it('accepte un bâtiment de la liste et rend le nom saisi par le cabinet', () => {
    const r = batimentListeQrSchema(RESIDENCE_EXEMPLE).safeParse(' bâtiment b ')
    expect(r.success && r.data).toBe('Bâtiment B')
  })

  it('refuse un bâtiment absent de la liste, avec un message sans la liste', () => {
    const r = batimentListeQrSchema(RESIDENCE_EXEMPLE).safeParse('A')
    expect(r.success).toBe(false)
    const message = r.error?.issues.map((i) => i.message).join(' ') ?? ''
    expect(message).toMatch(/liste/)
    for (const nom of RESIDENCE_EXEMPLE) expect(message).not.toContain(nom)
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
