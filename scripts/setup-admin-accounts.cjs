// ============================================================================
// One-shot : Configure les 2 comptes super_admin
//
// - Definit app_metadata.role = 'super_admin' (non forgeable)
// - Retire 'role' et '_admin_override' de user_metadata (forgeable)
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_EMAIL=admin1@example.com ADMIN_EMAIL_2=admin2@example.com \
//     node scripts/setup-admin-accounts.cjs
// ============================================================================

const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const emails = [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAIL_2].filter(Boolean)
if (emails.length === 0) {
  console.error('Au moins ADMIN_EMAIL est requis')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log(`Configuration de ${emails.length} compte(s) super_admin...\n`)

  for (const email of emails) {
    // Trouver le user par email
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) { console.error('listUsers error:', listErr.message); continue }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      console.log(`[skip] ${email} — compte introuvable`)
      continue
    }

    // Nettoyer user_metadata : retirer role et _admin_override
    const cleanMeta = { ...(user.user_metadata || {}) }
    const hadRole = cleanMeta.role
    const hadOverride = cleanMeta._admin_override
    delete cleanMeta.role
    delete cleanMeta._admin_override

    // Ecrire app_metadata.role = super_admin (non forgeable)
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata || {}), role: 'super_admin' },
      user_metadata: cleanMeta,
    })

    if (error) {
      console.error(`[error] ${email}: ${error.message}`)
    } else {
      console.log(`[ok] ${email}`)
      console.log(`     id: ${user.id}`)
      console.log(`     app_metadata.role: ${data.user?.app_metadata?.role}`)
      if (hadRole) console.log(`     user_metadata.role retire (etait: ${hadRole})`)
      if (hadOverride) console.log(`     user_metadata._admin_override retire`)
      console.log()
    }
  }

  console.log('Termine.')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
