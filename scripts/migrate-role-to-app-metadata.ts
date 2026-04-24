// ──────────────────────────────────────────────────────────────────────────────
// Migration : copie user_metadata.role → app_metadata.role pour tous les users
//
// Contexte : user_metadata est client-writable via supabase.auth.updateUser().
// Any authenticated user pouvait se forger role='super_admin' et accéder à
// /api/admin/*, /api/syndic/*, /api/auth/set-pro-role. Vuln HIGH.
//
// Fix : on ne fait plus confiance qu'à app_metadata (server-only, non forgeable).
// Ce script backfille app_metadata.role pour les users existants avant qu'on
// retire le fallback user_metadata du code.
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx tsx scripts/migrate-role-to-app-metadata.ts
//
// Idempotent : si app_metadata.role est déjà défini, le user est ignoré.
// ──────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Counters = {
  total: number
  migrated: number
  already_ok: number
  no_role: number
  errors: number
}

async function migrate(): Promise<Counters> {
  const counters: Counters = { total: 0, migrated: 0, already_ok: 0, no_role: 0, errors: 0 }
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('listUsers error:', error.message)
      break
    }
    const users = data.users || []
    if (users.length === 0) break

    for (const u of users) {
      counters.total++
      const appRole: string | undefined = u.app_metadata?.role
      const userRole: string | undefined = u.user_metadata?.role

      if (appRole) {
        counters.already_ok++
        continue
      }
      if (!userRole) {
        counters.no_role++
        console.log(`[skip] ${u.email || u.id} → aucun rôle à migrer`)
        continue
      }

      // Copier le champ role (et cabinet_id / company_id / org_type s'ils existent)
      const appMetadataUpdate: Record<string, unknown> = {
        ...(u.app_metadata || {}),
        role: userRole,
      }
      const passthrough = ['cabinet_id', 'company_id', 'org_type', 'pro_team_role']
      for (const key of passthrough) {
        if (u.user_metadata?.[key] !== undefined && u.app_metadata?.[key] === undefined) {
          appMetadataUpdate[key] = u.user_metadata[key]
        }
      }

      const { error: updateErr } = await supabase.auth.admin.updateUserById(u.id, {
        app_metadata: appMetadataUpdate,
      })
      if (updateErr) {
        counters.errors++
        console.error(`[error] ${u.email || u.id}: ${updateErr.message}`)
      } else {
        counters.migrated++
        console.log(`[ok] ${u.email || u.id} → app_metadata.role = ${userRole}`)
      }
    }

    if (users.length < perPage) break
    page++
  }

  return counters
}

migrate()
  .then(c => {
    console.log('\n──────── Migration terminée ────────')
    console.log(`Total        : ${c.total}`)
    console.log(`Migrés       : ${c.migrated}`)
    console.log(`Déjà OK      : ${c.already_ok}`)
    console.log(`Sans rôle    : ${c.no_role}`)
    console.log(`Erreurs      : ${c.errors}`)
    process.exit(c.errors > 0 ? 1 : 0)
  })
  .catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
