import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicCertEnergSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/cert-energ — certificats énergétiques (SCE) du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`certenerg_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_cert_energ')
      .select('id, cabinet_id, numero, edificio, perito, classe, data_emissao, data_validade, notas, created_at')
      .eq('cabinet_id', cabinetId)
      .order('data_emissao', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const certificados = (data || []).map(c => ({
      id: c.id,
      numero: c.numero || '',
      edificio: c.edificio || '',
      perito: c.perito || '',
      classe: c.classe || 'C',
      dataEmissao: c.data_emissao || '',
      dataValidade: c.data_validade || '',
      notas: c.notas || '',
    }))

    return NextResponse.json({ certificados })
  } catch (err) {
    logger.error('[syndic/cert-energ/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/cert-energ — enregistrer un certificat énergétique
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`certenerg_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()

    const validation = validateBody(syndicCertEnergSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_cert_energ')
      .insert({
        cabinet_id: cabinetId,
        numero: v.numero,
        edificio: v.edificio,
        perito: v.perito || '',
        classe: v.classe || 'C',
        data_emissao: v.dataEmissao || null,
        data_validade: v.dataValidade || null,
        notas: v.notas || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/cert-energ/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ certificado: data })
  } catch (err) {
    logger.error('[syndic/cert-energ/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
