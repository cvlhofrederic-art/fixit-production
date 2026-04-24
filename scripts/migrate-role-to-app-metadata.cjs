// CJS version runnable directement avec node — voir migrate-role-to-app-metadata.ts pour la doc.
// Usage : NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-role-to-app-metadata.cjs [--dry-run]
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.')
  process.exit(2)
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

async function migrate() {
  const counters = { total: 0, migrated: 0, already_ok: 0, no_role: 0, errors: 0, would_migrate: 0 }
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) { console.error('listUsers error:', error.message); break }
    const users = data.users || []
    if (users.length === 0) break

    for (const u of users) {
      counters.total++
      const appRole = u.app_metadata && u.app_metadata.role
      const userRole = u.user_metadata && u.user_metadata.role

      if (appRole) { counters.already_ok++; continue }
      if (!userRole) { counters.no_role++; continue }

      if (DRY_RUN) {
        counters.would_migrate++
        console.log(`[dry] ${u.email || u.id} → ${userRole}`)
        continue
      }

      const appMetadataUpdate = Object.assign({}, u.app_metadata || {}, { role: userRole })
      for (const key of ['cabinet_id', 'company_id', 'org_type', 'pro_team_role']) {
        if (u.user_metadata && u.user_metadata[key] !== undefined && (!u.app_metadata || u.app_metadata[key] === undefined)) {
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

migrate().then(c => {
  console.log('\n──────── Résumé ────────')
  console.log(`Mode       : ${DRY_RUN ? 'DRY-RUN' : 'WRITE'}`)
  console.log(`Total      : ${c.total}`)
  if (DRY_RUN) console.log(`À migrer   : ${c.would_migrate}`)
  else console.log(`Migrés     : ${c.migrated}`)
  console.log(`Déjà OK    : ${c.already_ok}`)
  console.log(`Sans rôle  : ${c.no_role}`)
  console.log(`Erreurs    : ${c.errors}`)
  process.exit(c.errors > 0 ? 1 : 0)
}).catch(err => { console.error('Fatal:', err); process.exit(1) })
