import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Map nature_juridique codes to labels
const NATURE_JURIDIQUE_MAP: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '5499': 'SARL',
  '5498': 'EURL',
  '5710': 'SAS',
  '5720': 'SASU',
  '5599': 'SA à conseil d\'administration',
  '5699': 'SA à directoire',
  '6599': 'SNC',
  '6220': 'SCI',
  '6316': 'SCP',
  '5306': 'SELURL',
  '5307': 'SELARL',
  '5308': 'SELAS',
  '5309': 'SELAFA',
  '9220': 'Association déclarée',
  '9300': 'Fondation',
  '3120': 'Auto-Entrepreneur',
}

function getNatureJuridiqueLabel(code: string): string {
  if (!code) return ''
  // Exact match
  if (NATURE_JURIDIQUE_MAP[code]) return NATURE_JURIDIQUE_MAP[code]
  // Check if code 1000 (EI) — covers all 1xxx codes
  if (code.startsWith('1')) return 'Entrepreneur individuel'
  // SARL variants (54xx)
  if (code.startsWith('54')) return 'SARL'
  // SAS variants (57xx)
  if (code.startsWith('57')) return 'SAS'
  // SA variants (55xx, 56xx)
  if (code.startsWith('55') || code.startsWith('56')) return 'SA'
  return `Forme juridique ${code}`
}

// Fetches the verified company data for an artisan (from profiles_artisan + SIRET API)
// Used by DevisFactureForm to auto-fill and lock legal fields
export async function GET(request: NextRequest) {
  const artisanId = request.nextUrl.searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get artisan profile
  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('*')
    .eq('id', artisanId)
    .single()

  if (error || !artisan) {
    return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })
  }

  // Récupérer les user_metadata pour les infos d'assurance
  let userMeta: any = {}
  if (artisan.user_id) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(artisan.user_id)
      userMeta = user?.user_metadata || {}
    } catch {
      // Ignore
    }
  }

  // If we already have legal_form stored in the profile, use it
  if (artisan.legal_form && artisan.company_address) {
    return NextResponse.json({
      verified: true,
      source: 'database',
      company: {
        name: artisan.company_name,
        siret: artisan.siret,
        siren: artisan.siren || artisan.siret?.substring(0, 9) || '',
        legalForm: artisan.legal_form,
        nafCode: artisan.naf_code || '',
        nafLabel: artisan.naf_label || '',
        address: artisan.company_address,
        city: artisan.company_city || '',
        postalCode: artisan.company_postal_code || '',
        phone: artisan.phone || '',
        email: artisan.email || '',
        insuranceNumber: userMeta.insurance_number || '',
        insuranceName: userMeta.insurance_name || '',
      }
    })
  }

  // Otherwise, fetch live from SIRET API
  if (!artisan.siret) {
    return NextResponse.json({
      verified: false,
      error: 'Pas de SIRET enregistré pour cet artisan',
    })
  }

  try {
    const cleanSiret = artisan.siret.replace(/\s/g, '')
    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${cleanSiret}&mtm_campaign=fixit`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 86400 } // cache 24h
      }
    )

    if (!response.ok) {
      return NextResponse.json({
        verified: false,
        error: 'Service de vérification temporairement indisponible',
        company: {
          name: artisan.company_name,
          siret: artisan.siret,
          siren: artisan.siret?.substring(0, 9) || '',
          legalForm: '',
          nafCode: '',
          nafLabel: '',
          address: '',
          city: '',
          postalCode: '',
          phone: artisan.phone || '',
          email: artisan.email || '',
        }
      })
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        verified: false,
        error: 'SIRET introuvable',
        company: {
          name: artisan.company_name,
          siret: artisan.siret,
          siren: artisan.siret?.substring(0, 9) || '',
          legalForm: '',
          address: '',
          city: '',
          postalCode: '',
          phone: artisan.phone || '',
          email: artisan.email || '',
        }
      })
    }

    const entreprise = data.results.find((r: any) => {
      if (r.siege?.siret === cleanSiret) return true
      if (r.matching_etablissements?.some((e: any) => e.siret === cleanSiret)) return true
      return false
    }) || data.results[0]

    // Get legal form from code (nature_juridique_label is often missing)
    const legalFormLabel = entreprise.nature_juridique_label
      || getNatureJuridiqueLabel(entreprise.nature_juridique || '')

    // Get NAF label from API or from siege
    const nafLabel = entreprise.activite_principale_label
      || entreprise.siege?.activite_principale_label
      || ''

    const companyData = {
      name: entreprise.nom_complet || entreprise.nom_raison_sociale || artisan.company_name,
      siret: cleanSiret,
      siren: entreprise.siren || cleanSiret.substring(0, 9),
      legalForm: legalFormLabel,
      nafCode: entreprise.activite_principale || '',
      nafLabel: nafLabel,
      address: entreprise.siege ? (() => {
        const adresse = entreprise.siege.adresse || ''
        const cp = entreprise.siege.code_postal || ''
        const ville = entreprise.siege.libelle_commune || ''
        // Avoid duplicating postal code if it's already in the address
        if (adresse.includes(cp)) {
          return adresse
        }
        return [adresse, `${cp} ${ville}`].filter(Boolean).join(', ')
      })() : '',
      city: entreprise.siege?.libelle_commune || '',
      postalCode: entreprise.siege?.code_postal || '',
      phone: artisan.phone || '',
      email: artisan.email || '',
    }

    // Try to update the artisan profile with verified data (best effort)
    try {
      await supabaseAdmin
        .from('profiles_artisan')
        .update({
          legal_form: companyData.legalForm,
          siren: companyData.siren,
          naf_code: companyData.nafCode,
          naf_label: companyData.nafLabel,
          company_address: companyData.address,
          company_city: companyData.city,
          company_postal_code: companyData.postalCode,
        })
        .eq('id', artisanId)
    } catch {
      // Ignore errors (columns may not exist yet)
    }

    // Ajouter les infos d'assurance depuis user_metadata
    const companyDataWithInsurance = {
      ...companyData,
      insuranceNumber: userMeta.insurance_number || '',
      insuranceName: userMeta.insurance_name || '',
    }

    return NextResponse.json({
      verified: entreprise.etat_administratif === 'A',
      source: 'api_gouv',
      company: companyDataWithInsurance,
    })

  } catch (err: any) {
    return NextResponse.json({
      verified: false,
      error: 'Erreur de vérification',
      company: {
        name: artisan.company_name,
        siret: artisan.siret,
        siren: artisan.siret?.substring(0, 9) || '',
        legalForm: '',
        address: '',
        city: '',
        postalCode: '',
        phone: artisan.phone || '',
        email: artisan.email || '',
      }
    })
  }
}
