// tests/lib/aj-signalement-chemin-desinscription.test.ts
//
// AJ Signalement, PR 3, lot 6 (décision F3) : seule exception au contrôle d'Origin du middleware, le POST « un clic » de
// désinscription. L'exception doit valoir pour l'adresse que l'e-mail porte réellement (urlUnClicDesinscriptionQr,
// en-tête List-Unsubscribe), et pour elle seule.

import { describe, expect, it } from 'vitest'
import { CHEMIN_API_DESINSCRIPTION_QR, estPostUnClicDesinscriptionQr } from '@/lib/aj-signalement/chemin-desinscription'
import { signerLiensDiffusionQr, urlUnClicDesinscriptionQr } from '@/lib/aj-signalement/diffusion-lien'

const ENV = { AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION: 'cle-de-test-des-liens-de-diffusion-0123456789' }

describe('POST un clic exempté du contrôle d’Origin : l’adresse de l’en-tête, et elle seule', () => {
  it('l’adresse List-Unsubscribe produite pour un message est reconnue (accord avec diffusion-lien.ts)', async () => {
    const s = await signerLiensDiffusionQr('de000000-0000-4000-8000-000000000001', ENV)
    if (!s.ok) throw new Error(s.code)
    const chemin = new URL(urlUnClicDesinscriptionQr(s.unClic)).pathname
    expect(chemin.startsWith(`${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/`)).toBe(true)
    expect(estPostUnClicDesinscriptionQr('POST', chemin)).toBe(true)
    expect(estPostUnClicDesinscriptionQr('POST', `${chemin}/`)).toBe(true)
  })

  it('jamais une autre méthode, un autre chemin, un jeton hors format ou un sous-chemin', () => {
    const jeton = `${'a'.repeat(32)}.${'b'.repeat(64)}`
    const chemin = `${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/${jeton}`
    for (const methode of ['GET', 'PATCH', 'PUT', 'DELETE', 'post']) expect(estPostUnClicDesinscriptionQr(methode, chemin), methode).toBe(false)
    for (const autre of [
      CHEMIN_API_DESINSCRIPTION_QR, `${CHEMIN_API_DESINSCRIPTION_QR}/lecture`, `${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/`,
      `${chemin}/autre`, `${chemin}//`, `${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/${jeton.toUpperCase()}`,
      `${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/${'a'.repeat(32)}`, `/x${chemin}`, `/api/aj-signalement/autre/un-clic/${jeton}`,
    ]) {
      expect(estPostUnClicDesinscriptionQr('POST', autre), autre).toBe(false)
    }
  })
})
