// ══════════════════════════════════════════════════════════════════════════════
// API : Import CSV Gecond → syndic_coproprios + syndic_immeubles
// POST /api/syndic/import-gecond
//
// Actions :
//   - parse    : Parse le CSV et retourne un aperçu (preview)
//   - import   : Importe les données parsées dans Supabase
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser, isSyndicRole, resolveCabinetId, getUserRole } from '@/lib/auth-helpers'
import { parseGecondCSV, gecondToFixit } from '@/lib/gecond-parser'
import { logger } from '@/lib/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Rate limiter simple ─────────────────────────────────────────────────────
const importLimiter = new Map<string, { count: number; resetAt: number }>()
function checkImportLimit(userId: string): boolean {
  const now = Date.now()
  const entry = importLimiter.get(userId)
  if (!entry || entry.resetAt < now) {
    importLimiter.set(userId, { count: 1, resetAt: now + 60_000 }) // 1 min window
    return true
  }
  if (entry.count >= 5) return false // Max 5 imports / minute
  entry.count++
  return true
}

// ══════════════════════════════════════════════════════════════════════════════
// POST — Parse ou Import CSV Gecond
// ══════════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!isSyndicRole(user)) {
      return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
    }

    const role = getUserRole(user)
    // Seuls syndic et syndic_admin peuvent importer
    if (!['syndic', 'syndic_admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Seuls les administrateurs peuvent importer des données' }, { status: 403 })
    }

    // ── Rate limit ───────────────────────────────────────────────────────
    if (!checkImportLimit(user.id)) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez dans une minute' }, { status: 429 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) {
      return NextResponse.json({ error: 'Cabinet non trouvé' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    // ═════════════════════════════════════════════════════════════════════
    // ACTION : PARSE (preview)
    // ═════════════════════════════════════════════════════════════════════
    if (action === 'parse') {
      const { csvContent } = body
      if (!csvContent || typeof csvContent !== 'string') {
        return NextResponse.json({ error: 'csvContent requis' }, { status: 400 })
      }

      // Limiter la taille (5 MB max)
      if (csvContent.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Fichier trop volumineux (max 5 MB)' }, { status: 400 })
      }

      const parseResult = parseGecondCSV(csvContent)

      return NextResponse.json({
        success: true,
        ...parseResult,
      })
    }

    // ═════════════════════════════════════════════════════════════════════
    // ACTION : IMPORT
    // ═════════════════════════════════════════════════════════════════════
    if (action === 'import') {
      const { csvContent, immeubleName, createImmeuble } = body

      if (!csvContent || typeof csvContent !== 'string') {
        return NextResponse.json({ error: 'csvContent requis' }, { status: 400 })
      }
      if (!immeubleName || typeof immeubleName !== 'string') {
        return NextResponse.json({ error: 'Nom de l\'immeuble requis' }, { status: 400 })
      }

      // Parse CSV
      const parseResult = parseGecondCSV(csvContent)

      if (parseResult.fractions.length === 0) {
        return NextResponse.json({
          error: 'Aucune fraction valide trouvée dans le CSV',
          errors: parseResult.errors,
        }, { status: 400 })
      }

      if (parseResult.fractions.length > 500) {
        return NextResponse.json({
          error: `Trop de lignes (${parseResult.fractions.length}). Maximum 500 par import.`,
        }, { status: 400 })
      }

      // ── Créer l'immeuble si demandé ─────────────────────────────────
      let immeubleId: string | null = null
      if (createImmeuble) {
        // Vérifier s'il existe déjà
        const { data: existing } = await supabaseAdmin
          .from('syndic_immeubles')
          .select('id')
          .eq('cabinet_id', cabinetId)
          .eq('nom', immeubleName.trim())
          .maybeSingle()

        if (existing) {
          immeubleId = existing.id
        } else {
          // Calculer nb_lots et total tantièmes
          const totalPermi = parseResult.fractions.reduce((sum, f) => sum + f.permilagem, 0)

          const { data: newImm, error: immErr } = await supabaseAdmin
            .from('syndic_immeubles')
            .insert({
              cabinet_id: cabinetId,
              nom: immeubleName.trim(),
              nb_lots: parseResult.fractions.length,
              type_immeuble: 'Condomínio',
              // On peut estimer les infos depuis le CSV
              adresse: parseResult.fractions[0]?.endereco || '',
              ville: parseResult.fractions[0]?.localidade || '',
              code_postal: parseResult.fractions[0]?.codigoPostal || '',
            })
            .select('id')
            .single()

          if (immErr) {
            logger.error('[import-gecond] Erreur création immeuble:', immErr)
            return NextResponse.json({ error: 'Erreur lors de la création de l\'immeuble' }, { status: 500 })
          }
          immeubleId = newImm.id
        }
      }

      // ── Convertir les fractions en copropriétaires Fixit ────────────
      const coproprios = gecondToFixit(parseResult.fractions, immeubleName.trim())

      // ── Vérifier les doublons existants ─────────────────────────────
      const { data: existingCopros } = await supabaseAdmin
        .from('syndic_coproprios')
        .select('numero_porte, nom_proprietaire, prenom_proprietaire')
        .eq('cabinet_id', cabinetId)
        .eq('immeuble', immeubleName.trim())

      const existingSet = new Set(
        (existingCopros || []).map(c =>
          `${c.numero_porte}|${c.nom_proprietaire}|${c.prenom_proprietaire}`.toLowerCase()
        )
      )

      // Filtrer les doublons
      const toInsert = coproprios.filter(c => {
        const key = `${c.numero_porte}|${c.nom_proprietaire}|${c.prenom_proprietaire}`.toLowerCase()
        return !existingSet.has(key)
      })

      const duplicateCount = coproprios.length - toInsert.length

      if (toInsert.length === 0) {
        return NextResponse.json({
          success: true,
          imported: 0,
          duplicates: duplicateCount,
          immeubleId,
          message: 'Toutes les fractions existent déjà dans la base',
        })
      }

      // ── Insertion en batch (chunks de 50) ───────────────────────────
      let importedCount = 0
      const insertErrors: string[] = []

      for (let i = 0; i < toInsert.length; i += 50) {
        const chunk = toInsert.slice(i, i + 50).map(c => ({
          cabinet_id: cabinetId,
          ...c,
        }))

        const { error: insertErr, data: inserted } = await supabaseAdmin
          .from('syndic_coproprios')
          .insert(chunk)
          .select('id')

        if (insertErr) {
          logger.error(`[import-gecond] Erreur batch ${i}:`, insertErr)
          insertErrors.push(`Batch ${Math.floor(i / 50) + 1}: ${insertErr.message}`)
        } else {
          importedCount += (inserted || []).length
        }
      }

      return NextResponse.json({
        success: insertErrors.length === 0,
        imported: importedCount,
        duplicates: duplicateCount,
        total: coproprios.length,
        immeubleId,
        errors: insertErrors.length > 0 ? insertErrors : undefined,
        parseWarnings: parseResult.warnings.length > 0 ? parseResult.warnings : undefined,
        stats: parseResult.stats,
      })
    }

    return NextResponse.json({ error: 'Action inconnue. Utilisez "parse" ou "import"' }, { status: 400 })

  } catch (err: any) {
    logger.error('[import-gecond] Erreur:', err)
    return NextResponse.json(
      { error: 'Erreur serveur', details: err?.message },
      { status: 500 }
    )
  }
}
