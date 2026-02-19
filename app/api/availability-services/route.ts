import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET: Fetch dayServices config from artisan's bio marker
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('bio')
    .eq('id', artisanId)
    .single()

  if (error) {
    console.error('Error fetching artisan bio:', error)
    return NextResponse.json({ error: 'Failed to fetch artisan data' }, { status: 500 })
  }

  let dayServices: Record<string, string[]> = {}
  if (artisan?.bio) {
    const match = artisan.bio.match(/<!--DS:(.*?)-->/)
    if (match) {
      try {
        dayServices = JSON.parse(match[1])
      } catch (parseError) {
        console.error('Failed to parse dayServices JSON:', parseError)
      }
    }
  }

  return NextResponse.json({ data: dayServices })
}

// POST: Save dayServices config into artisan's bio marker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { artisan_id, dayServices } = body

    if (!artisan_id || !dayServices) {
      return NextResponse.json({ error: 'artisan_id and dayServices are required' }, { status: 400 })
    }

    // Get current bio
    const { data: artisan, error: fetchError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('bio')
      .eq('id', artisan_id)
      .single()

    if (fetchError) {
      console.error('Error fetching artisan bio:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch artisan data' }, { status: 500 })
    }

    // Clean existing marker and add new one
    const cleanBio = (artisan?.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    const hasConfig = Object.values(dayServices as Record<string, string[]>).some(arr => arr.length > 0)
    const marker = hasConfig ? ` <!--DS:${JSON.stringify(dayServices)}-->` : ''
    const newBio = `${cleanBio}${marker}`

    const { error: updateError } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ bio: newBio })
      .eq('id', artisan_id)

    if (updateError) {
      console.error('Error updating artisan bio:', updateError)
      return NextResponse.json({ error: 'Failed to update artisan data' }, { status: 500 })
    }

    return NextResponse.json({ success: true, bio: newBio })
  } catch (e: unknown) {
    console.error('Server error in availability-services POST:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
