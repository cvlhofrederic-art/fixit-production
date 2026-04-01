import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Mapping service slug → metiers in artisans_catalogue
const SERVICE_TO_METIERS: Record<string, string[]> = {
  'plombier':               ['Plombier'],
  'electricien':            ['Électricien'],
  'serrurier':              ['Serrurier'],
  'peintre':                ['Peintre'],
  'plaquiste':              ['Plaquiste'],
  'nettoyage-encombrants':  ['Nettoyage', 'Déménageur'],
  'espaces-verts':          ['Paysagiste'],
  'paysagiste':             ['Paysagiste'],
  'elagueur':               ['Paysagiste'],
  'nettoyage-copropriete':  ['Nettoyage'],
  'nettoyage-terrains':     ['Paysagiste', 'Nettoyage'],
  'jardinier':              ['Paysagiste'],
  'vide-maison':            ['Déménageur', 'Nettoyage'],
  'debouchage-canalisation':['Débouchage', 'Plombier'],
  'couvreur':               ['Couvreur'],
  'climatisation':          ['Climatisation', 'Chauffagiste'],
  'carreleur':              ['Carreleur'],
  'macon':                  ['Maçon'],
  'store-banne':            ['Menuisier'],
  'vitrier':                ['Vitrier'],
  'metallerie':             ['Métallier', 'Ferronnier', 'Métallerie'],
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city') || ''
    const service = searchParams.get('service') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20)

    if (!city || !service) {
      return NextResponse.json({ artisans: [] })
    }

    const metiers = SERVICE_TO_METIERS[service]
    if (!metiers) {
      return NextResponse.json({ artisans: [] })
    }

    // Pour Marseille, on cherche tous les arrondissements
    const isMars = city.toLowerCase().includes('marseille')

    let query = supabaseAdmin
      .from('artisans_catalogue')
      .select('id, nom_entreprise, metier, specialite, adresse, ville, arrondissement, google_note, google_avis, telephone_pro, pappers_verifie')
      .in('metier', metiers)
      .order('google_note', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (isMars) {
      query = query.ilike('ville', '%arseille%')
    } else {
      query = query.eq('ville', city)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ artisans: [] }, { status: 500 })
    }

    return NextResponse.json(
      { artisans: data || [] },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
    )
  } catch (err) {
    console.error('[artisans-catalogue/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
