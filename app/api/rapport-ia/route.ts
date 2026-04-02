// ══════════════════════════════════════════════════════════════════════════════
// POST /api/rapport-ia — Génère le texte IA d'un rapport d'intervention
// Appelé côté client après clôture du chantier (ProofOfWork)
// ══════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server'
import { genererTexteRapport, type DonneesChantier } from '@/lib/rapport-ia'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateBody, rapportIaSchema } from '@/lib/validation'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`rapport_ia_${ip}`, 10, 60_000))) return rateLimitResponse()

    // Auth check
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const v = validateBody(rapportIaSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { booking_id } = v.data

    // Charger le booking avec ses relations
    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*, services(name)')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking introuvable' }, { status: 404 })
    }

    // Vérifier que l'artisan est bien le propriétaire
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, company_name, user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!artisan || booking.artisan_id !== artisan.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Charger le client si disponible
    let clientPrenom = 'le client'
    let clientCivilite: string | undefined
    if (booking.client_id) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('first_name, last_name, civilite')
        .eq('id', booking.client_id)
        .maybeSingle()
      if (client) {
        clientPrenom = client.first_name || client.last_name || 'le client'
        clientCivilite = client.civilite || undefined
      }
    }

    // Extraire le nom de l'artisan
    const nomParts = (artisan.company_name || '').split(' ')
    const artisanPrenom = nomParts[0] || 'Artisan'
    const artisanNom = nomParts.slice(1).join(' ') || ''

    // Calculer la durée
    let dureeHeures: number | undefined
    if (booking.duration_minutes) {
      dureeHeures = Math.round((booking.duration_minutes / 60) * 10) / 10
    }

    // Construire les données
    const donnees: DonneesChantier = {
      motif_nom: booking.services?.name || 'Intervention',
      artisan_prenom: artisanPrenom,
      artisan_nom: artisanNom,
      client_prenom: clientPrenom,
      client_civilite: clientCivilite,
      adresse_chantier: booking.address || 'Adresse non renseignée',
      date_intervention: new Date(booking.booking_date + 'T12:00:00'),
      duree_heures: dureeHeures,
      description_devis: body.description || undefined,
      texte_dictee: body.texte_dictee || undefined,
      notes_artisan: booking.notes || body.notes || undefined,
      materiaux_utilises: body.materiaux || undefined,
    }

    // Générer le texte (avec fallback intégré — ne plante jamais)
    const contenu = await genererTexteRapport(donnees)

    // Sauvegarder en base pour traçabilité
    await supabaseAdmin
      .from('bookings')
      .update({
        rapport_ia_source: contenu.source,
        rapport_ia_genere_le: new Date().toISOString(),
        rapport_ia_texte_brut: JSON.stringify(contenu),
      })
      .eq('id', booking_id)

    return NextResponse.json({
      success: true,
      contenu,
    })
  } catch (err) {
    console.error('[rapport-ia] Error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 }
    )
  }
}
