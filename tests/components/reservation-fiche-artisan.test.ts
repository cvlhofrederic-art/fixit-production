// tests/components/reservation-fiche-artisan.test.ts
//
// Fiche artisan (app/fr/artisan/[id]/page.tsx, réexportée par /fr/societe/[slug], /pt/empresa/[slug] et
// /pt/profissional/[id]) : après une réservation réussie, le bouton reste désactivé. /confirmation/ est servie par
// app/(commun), sous un autre layout racine : Next attend la réponse du serveur avant de recharger la page, et un bouton
// réactivé laissait un second clic créer une seconde réservation (l'API n'a pas de contrôle de doublon). La page
// (données Supabase, étapes du formulaire) n'est pas montée ici : le test lit le chemin de succès de submitBooking.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app', 'fr', 'artisan', '[id]', 'page.tsx'), 'utf8')

describe('réservation depuis la fiche artisan', () => {
  it('succès : router.push vers /confirmation puis return, le bouton n’est pas réactivé', () => {
    const succes = source.match(/if \(!bookingJson\.error && bookingJson\.data\) \{([\s\S]*?)\r?\n {4}\}/)
    expect(succes, 'chemin de succès de submitBooking introuvable').not.toBeNull()
    expect(succes![1]).toMatch(/router\.push\(`\/confirmation\?id=\$\{bookingJson\.data\.id\}`\)/)
    expect(succes![1]).toMatch(/\breturn\b/)
    expect(succes![1]).not.toMatch(/setSubmitting\(false\)/)
  })

  it('échec : message affiché, puis bouton réactivé', () => {
    const suite = source.slice(source.indexOf('if (!bookingJson.error && bookingJson.data)'))
    expect(suite).toMatch(/setBookingError\(errMsg\)\r?\n {4}setSubmitting\(false\)/)
  })

  it('retour depuis le cache du navigateur (bfcache) : pageshow avec persisted réactive le bouton', () => {
    expect(source).toMatch(/window\.addEventListener\('pageshow', auRetour\)/)
    expect(source).toMatch(/if \(evenement\.persisted\) setSubmitting\(false\)/)
  })
})
