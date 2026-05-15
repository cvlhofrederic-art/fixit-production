// app/api/syndic/fixy-syndic/execute-action/route.ts
// Exécute les actions Fixy confirmées par l'utilisateur (create_mission, create_alert,
// send_message, assign_mission, update_mission, create_document).
// Pattern sécurité : getAuthUser → isSyndicRole → resolveCabinetId → RLS Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'

const ExecuteActionSchema = z.object({
  action: z.object({
    type: z.enum([
      'create_mission',
      'assign_mission',
      'update_mission',
      'create_alert',
      'send_message',
      'create_document',
    ]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- arguments variant selon l'action
    args: z.record(z.string(), z.unknown()),
  }),
  conversation_id: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`fixy-exec:${ip}`, 30, 60_000))) {
    return rateLimitResponse()
  }

  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = ExecuteActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) {
    return NextResponse.json({ error: 'cabinet_not_found' }, { status: 403 })
  }

  const { type, args } = parsed.data.action

  try {
    switch (type) {
      case 'create_mission': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        const { data, error } = await supabaseAdmin
          .from('syndic_missions')
          .insert({
            cabinet_id: cabinetId,
            immeuble: a.immeuble ?? null,
            // col 'artisan' est TEXT dans 001_syndic_tables ; 'artisan_id' UUID ajouté en 055
            artisan: a.artisan ?? null,
            artisan_id: a.artisan_id ?? null,
            type: a.type ?? a.titre ?? 'Intervention',
            description: a.description ?? '',
            priorite: a.priorite ?? 'normale',
            statut: 'en_attente',
            batiment: a.batiment ?? null,
            etage: a.etage ?? null,
            num_lot: a.num_lot ?? null,
            locataire: a.locataire ?? null,
            telephone_locataire: a.telephone_locataire ?? null,
            acces_logement: a.acces_logement ?? null,
          })
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, mission_id: data.id })
      }

      case 'assign_mission': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        if (!a.mission_id) {
          return NextResponse.json({ error: 'missing_mission_id' }, { status: 400 })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- updates dynamiques
        const updates: any = { statut: 'en_cours' }
        // artisan_id si UUID fourni, artisan (TEXT) sinon
        if (a.artisan_id) {
          updates.artisan_id = a.artisan_id
        } else if (a.artisan) {
          updates.artisan = a.artisan
        } else {
          return NextResponse.json({ error: 'missing_artisan_or_artisan_id' }, { status: 400 })
        }
        const { data, error } = await supabaseAdmin
          .from('syndic_missions')
          .update(updates)
          .eq('id', a.mission_id)
          .eq('cabinet_id', cabinetId)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, mission: data })
      }

      case 'update_mission': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        if (!a.mission_id) {
          return NextResponse.json({ error: 'missing_mission_id' }, { status: 400 })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- updates dynamiques
        const updates: any = {}
        if (a.statut) updates.statut = a.statut
        if (a.priorite) updates.priorite = a.priorite
        if (a.date_intervention) updates.date_intervention = a.date_intervention
        if (a.montant_devis !== undefined) updates.montant_devis = a.montant_devis
        if (a.rapport_artisan) updates.rapport_artisan = a.rapport_artisan
        if (a.artisan) updates.artisan = a.artisan
        if (a.artisan_id) updates.artisan_id = a.artisan_id
        const { data, error } = await supabaseAdmin
          .from('syndic_missions')
          .update(updates)
          .eq('id', a.mission_id)
          .eq('cabinet_id', cabinetId)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, mission: data })
      }

      case 'create_alert': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        // Tenter syndic_alertes en premier (migration 20260515), fallback syndic_notifications
        let alertId: string | undefined
        const alertPayload = {
          cabinet_id: cabinetId,
          immeuble_id: a.immeuble_id ?? null,
          titre: a.titre ?? (a.message as string | undefined)?.slice(0, 80) ?? 'Alerte',
          message: a.message ?? a.description ?? null,
          severity: a.severity ?? 'normal',
          created_by: user.id,
        }

        let inserted = false
        try {
          const res = await supabaseAdmin
            .from('syndic_alertes')
            .insert(alertPayload)
            .select()
            .maybeSingle()
          if (!res.error && res.data) {
            alertId = (res.data as { id?: string }).id
            inserted = true
          }
        } catch {
          // table absente — fallback ci-dessous
        }

        if (inserted) {
          // alertId déjà assigné
        } else {
          // Fallback : insérer dans syndic_notifications
          const { data: notifData, error: notifError } = await supabaseAdmin
            .from('syndic_notifications')
            .insert({
              cabinet_id: cabinetId,
              type: a.severity ?? 'normal',
              message: a.titre ?? a.message ?? 'Alerte',
            })
            .select()
            .maybeSingle()
          if (notifError) throw notifError
          alertId = notifData?.id
        }

        return NextResponse.json({ ok: true, alert_id: alertId })
      }

      case 'send_message': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        if (!a.to || !a.subject || !(a.body || a.html)) {
          return NextResponse.json(
            { error: 'missing_fields_to_subject_body' },
            { status: 400 },
          )
        }
        const result = await sendEmail({
          to: a.to as string,
          subject: a.subject as string,
          html: (a.html as string | undefined) ?? `<p>${((a.body as string) ?? '').replace(/\n/g, '<br>')}</p>`,
          replyTo: user.email ?? undefined,
        })
        return NextResponse.json({ ok: true, email: result })
      }

      case 'create_document': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        // La table syndic_documents n'est pas encore définie — log et retour deferred.
        // Le frontend génère les PDFs côté client via le pattern Max.
        logger.info('[fixy] create_document requested', { user_id: user.id, args: a })
        return NextResponse.json({
          ok: true,
          deferred: true,
          message: 'Document généré côté client',
        })
      }

      default:
        return NextResponse.json({ error: 'unknown_action_type' }, { status: 400 })
    }
  } catch (err) {
    logger.error('[fixy/execute-action] error', {
      error: err instanceof Error ? err.message : String(err),
      type,
    })
    return NextResponse.json(
      {
        error: 'execution_failed',
        details: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    )
  }
}
