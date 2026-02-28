import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// Codes NAF typiques pour les artisans du bâtiment et services
const ARTISAN_NAF_PREFIXES = [
  '43', // Travaux de construction spécialisés (plomberie, electricité, peinture, etc.)
  '41', // Construction de bâtiments
  '42', // Génie civil
  '81.3', // Services d'aménagement paysager
  '81.2', // Activités de nettoyage
  '33', // Réparation et installation de machines
  '25', // Fabrication de produits métalliques (serrurerie)
  '71', // Architecture et ingénierie
  '95', // Réparation ordinateurs et biens personnels
  '96.0', // Autres services personnels
  '01.6', // Activités de soutien agriculture (espaces verts)
]

function isArtisanNafCode(nafCode: string): boolean {
  if (!nafCode) return true // Si pas de code NAF, on ne bloque pas
  const cleanCode = nafCode.replace(/\./g, '')
  return ARTISAN_NAF_PREFIXES.some(prefix => {
    const cleanPrefix = prefix.replace(/\./g, '')
    return cleanCode.startsWith(cleanPrefix)
  })
}

function validateSiretFormat(siret: string): { valid: boolean; message?: string } {
  const clean = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(clean)) {
    return { valid: false, message: 'Le SIRET doit contenir exactement 14 chiffres' }
  }
  // Vérification Luhn
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(clean[i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  // Exception connue : La Poste (SIREN 356000000) ne passe pas Luhn
  if (sum % 10 !== 0 && !clean.startsWith('356000000')) {
    return { valid: false, message: 'Le numéro SIRET est invalide (erreur de saisie)' }
  }
  return { valid: true }
}

export async function GET(request: NextRequest) {
  // Rate limit anti-énumération SIRET : 10 req/min par IP
  const ip = getClientIP(request)
  if (!checkRateLimit(`verify_siret_${ip}`, 10, 60_000)) return rateLimitResponse()

  const siret = request.nextUrl.searchParams.get('siret')

  if (!siret) {
    return NextResponse.json({ error: 'SIRET requis' }, { status: 400 })
  }

  const cleanSiret = siret.replace(/\s/g, '')

  // 1. Validation du format
  const formatCheck = validateSiretFormat(cleanSiret)
  if (!formatCheck.valid) {
    return NextResponse.json({
      verified: false,
      error: formatCheck.message,
      step: 'format'
    })
  }

  try {
    // 2. Appel à l'API Annuaire des Entreprises (gratuit, sans clé)
    // Retry with backoff for transient errors
    let response: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&mtm_campaign=fixit`,
          {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(10000), // 10s timeout
          }
        )
        if (response.ok || response.status < 500) break
      } catch (err: any) {
        if (attempt === 2) throw err
        await new Promise(r => setTimeout(r, (attempt + 1) * 1000))
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({
        verified: false,
        error: 'Service de vérification temporairement indisponible. Réessayez dans quelques instants.',
        step: 'api_error'
      })
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        verified: false,
        error: 'Ce SIRET n\'existe pas dans le répertoire officiel des entreprises françaises',
        step: 'not_found'
      })
    }

    // Trouver l'entreprise qui correspond exactement au SIRET
    const entreprise = data.results.find((r: any) => {
      // Vérifier le SIRET du siège
      if (r.siege?.siret === cleanSiret) return true
      // Vérifier dans les établissements
      if (r.matching_etablissements?.some((e: any) => e.siret === cleanSiret)) return true
      return false
    }) || data.results[0] // Fallback au premier résultat

    if (!entreprise) {
      return NextResponse.json({
        verified: false,
        error: 'Aucune entreprise trouvée avec ce SIRET',
        step: 'not_found'
      })
    }

    // 3. Vérification de l'état administratif
    const etatAdmin = entreprise.etat_administratif
    if (etatAdmin === 'C') {
      return NextResponse.json({
        verified: false,
        error: 'Cette entreprise est radiée/fermée. Vous ne pouvez pas vous inscrire avec un SIRET inactif.',
        step: 'closed',
        companyName: entreprise.nom_complet,
      })
    }

    // 4. Vérification du code NAF (avertissement seulement)
    const nafCode = entreprise.activite_principale || ''
    const isArtisan = isArtisanNafCode(nafCode)

    // Map nature_juridique code to label
    const NATURE_JURIDIQUE: Record<string, string> = {
      '1000': 'Entrepreneur individuel',
      '5499': 'SARL', '5498': 'EURL',
      '5710': 'SAS', '5720': 'SASU',
      '5599': 'SA', '6220': 'SCI',
    }
    const natureCode = entreprise.nature_juridique || ''
    let legalFormLabel = entreprise.nature_juridique_label || NATURE_JURIDIQUE[natureCode] || ''
    if (!legalFormLabel && natureCode.startsWith('1')) legalFormLabel = 'Entrepreneur individuel'
    if (!legalFormLabel && natureCode.startsWith('54')) legalFormLabel = 'SARL'
    if (!legalFormLabel && natureCode.startsWith('57')) legalFormLabel = 'SAS'

    // 5. Succès — retourner les données de l'entreprise
    return NextResponse.json({
      verified: true,
      company: {
        name: entreprise.nom_complet || entreprise.nom_raison_sociale || '',
        siret: cleanSiret,
        siren: entreprise.siren || cleanSiret.substring(0, 9),
        nafCode: nafCode,
        nafLabel: entreprise.activite_principale_label || '',
        legalForm: legalFormLabel,
        address: entreprise.siege ? [
          entreprise.siege.adresse,
          `${entreprise.siege.code_postal} ${entreprise.siege.libelle_commune}`
        ].filter(Boolean).join(', ') : '',
        city: entreprise.siege?.libelle_commune || '',
        postalCode: entreprise.siege?.code_postal || '',
        isActive: etatAdmin === 'A',
        creationDate: entreprise.date_creation || '',
        isArtisanActivity: isArtisan,
      },
      warning: !isArtisan ? 'Le code NAF de cette entreprise ne correspond pas à une activité artisanale classique. Vérifiez que vous êtes bien artisan.' : null,
    })

  } catch (error: any) {
    console.error('SIRET verification error:', error)
    return NextResponse.json({
      verified: false,
      error: 'Erreur lors de la vérification. Veuillez réessayer.',
      step: 'network_error'
    })
  }
}
