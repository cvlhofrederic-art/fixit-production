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
      'create_event',
    ]),
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
        // ⚠️ Le champ `type` du JSON ##ACTION## est consommé comme discriminator
        // côté useAgentStream, donc args.type est undefined ici. Le LLM doit
        // émettre `type_travaux` pour le type d'intervention.
        const missionType = a.type_travaux ?? a.type ?? a.titre ?? 'Intervention'
        const { data, error } = await supabaseAdmin
          .from('syndic_missions')
          .insert({
            cabinet_id: cabinetId,
            immeuble: a.immeuble ?? null,
            // col 'artisan' est TEXT dans 001_syndic_tables ; 'artisan_id' UUID ajouté en 055
            artisan: a.artisan ?? null,
            artisan_id: a.artisan_id ?? null,
            type: String(missionType).slice(0, 100),
            description: a.description ?? '',
            priorite: a.priorite ?? 'normale',
            statut: 'en_attente',
            date_intervention: a.date_intervention ?? null,
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
        // Sémantique alignée sur le prompt : "Mission AVEC artisan" → crée une
        // nouvelle mission directement assignée (statut en_cours), pas un update
        // d'une mission existante (le LLM ne connaît pas les UUIDs internes).
        // L'ancien comportement (update via mission_id) reste accessible si le
        // LLM fournit explicitement un mission_id.
        if (a.mission_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- updates dynamiques
          const updates: any = { statut: 'en_cours' }
          if (a.artisan_id) updates.artisan_id = a.artisan_id
          else if (a.artisan) updates.artisan = a.artisan
          else return NextResponse.json({ error: 'missing_artisan_or_artisan_id' }, { status: 400 })
          if (a.date_intervention) updates.date_intervention = a.date_intervention
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

        // Pas de mission_id → création + assignation directe
        if (!a.artisan && !a.artisan_id) {
          return NextResponse.json({ error: 'missing_artisan_or_artisan_id' }, { status: 400 })
        }
        // Résolution artisan_id depuis email si possible (table profiles_artisan)
        let resolvedArtisanId: string | null = a.artisan_id ?? null
        if (!resolvedArtisanId && a.artisan_email) {
          try {
            const { data: artisanRow } = await supabaseAdmin
              .from('profiles_artisan')
              .select('id')
              .eq('email', String(a.artisan_email).toLowerCase())
              .maybeSingle()
            if (artisanRow?.id) resolvedArtisanId = artisanRow.id
          } catch {
            // ignore — on garde l'artisan TEXT
          }
        }
        const missionType = a.type_travaux ?? a.type ?? a.titre ?? 'Intervention'
        // Pas de colonne `notes` dans syndic_missions → concatène à description
        // pour ne pas perdre l'info dictée par l'utilisateur.
        const baseDesc = String(a.description ?? '').trim()
        const noteSuffix = a.notes ? `\n\nNotes : ${String(a.notes).trim()}` : ''
        const fullDescription = `${baseDesc}${noteSuffix}`.slice(0, 5000)
        const { data, error } = await supabaseAdmin
          .from('syndic_missions')
          .insert({
            cabinet_id: cabinetId,
            immeuble: a.immeuble ?? null,
            artisan: a.artisan ?? null,
            artisan_id: resolvedArtisanId,
            type: String(missionType).slice(0, 100),
            description: fullDescription,
            priorite: a.priorite ?? 'normale',
            statut: 'en_cours',
            date_intervention: a.date_intervention ?? null,
          })
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ ok: true, mission_id: data.id, assigned_artisan_id: resolvedArtisanId })
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
        // Mapping urgence (prompt FR) / urgencia (PT) → severity (DB).
        // Sans ce mapping, severity tombait toujours sur 'normal' car le LLM
        // émet `urgence`, pas `severity`.
        const urgenceMap: Record<string, string> = {
          haute: 'high', high: 'high', urgente: 'high', urgent: 'high', alta: 'high',
          moyenne: 'normal', normal: 'normal', média: 'normal', media: 'normal',
          basse: 'low', low: 'low', baixa: 'low',
        }
        const rawSeverity = a.severity ?? a.urgence ?? a.urgencia ?? 'normal'
        const severity = urgenceMap[String(rawSeverity).toLowerCase()] ?? 'normal'
        const alertPayload = {
          cabinet_id: cabinetId,
          immeuble_id: a.immeuble_id ?? null,
          titre: a.titre ?? (a.message as string | undefined)?.slice(0, 80) ?? 'Alerte',
          message: a.message ?? a.description ?? null,
          severity,
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

      case 'create_event': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args dynamiques LLM
        const a = args as any
        if (!a.titre || !a.date) {
          return NextResponse.json({ error: 'missing_titre_or_date' }, { status: 400 })
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date))) {
          return NextResponse.json({ error: 'invalid_date_format' }, { status: 400 })
        }
        const heure = a.heure && /^\d{2}:\d{2}$/.test(String(a.heure)) ? a.heure : '09:00'
        // La catégorie d'événement vit dans `category` (le champ `type` est réservé
        // au discriminator d'action ##ACTION##type## et a déjà été extrait en amont).
        const rawCategory = a.category ?? a.event_type ?? a.type
        const category = rawCategory ? String(rawCategory).slice(0, 50) : 'autre'
        const { data, error } = await supabaseAdmin
          .from('syndic_planning_events')
          .insert({
            cabinet_id: cabinetId,
            titre: String(a.titre).slice(0, 200),
            type: category,
            date: a.date,
            heure,
            duree_min: Number.isFinite(Number(a.dureeMin ?? a.duree_min)) ? Number(a.dureeMin ?? a.duree_min) : 60,
            assigne_a: a.assigneA ?? a.assigne_a ?? '',
            assigne_role: a.assigneRole ?? a.assigne_role ?? '',
            description: a.description ?? '',
            cree_par: user.email ?? '',
            statut: 'planifie',
          })
          .select()
          .single()
        if (error) {
          if (error.code === '42P01') {
            return NextResponse.json({ error: 'needsMigration' }, { status: 503 })
          }
          throw error
        }
        return NextResponse.json({ ok: true, event_id: data.id })
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
