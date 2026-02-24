const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://irluhepekbqgquveaett.supabase.co',
  'sb_secret_lDcyzgFqQMUE65_bCpzuAg_rlTsd6tB'
)

async function main() {
  // Exécuter via une fonction PostgreSQL qu'on crée d'abord
  // Étape 1: créer une fonction execute_ddl dans le schema public
  // Le service role peut faire ça via l'API REST avec header X-Custom-Role
  
  console.log('Test connexion...')
  const { data, error } = await supabase.from('profiles_artisan').select('id').limit(1)
  if (error) { console.error('Erreur connexion:', error.message); return }
  console.log('Connexion OK')

  // Insérer directement si la table existe déjà
  const { data: d2, error: e2 } = await supabase
    .from('syndic_team_members')
    .upsert({
      cabinet_id: 'c018eab3-63d4-4928-b5ba-44dd1db5f579',
      user_id: '3d40c802-b0ea-493d-bf2d-f57cf6237917',
      email: 'htmpro.renovation@gmail.com',
      full_name: 'HTM Pro Renovation',
      role: 'syndic_tech',
      accepted_at: new Date().toISOString(),
      is_active: true
    }, { onConflict: 'email' })
    .select()
  
  if (e2) {
    console.log('Table pas encore créée (normal):', e2.message)
    console.log('\n→ La table doit être créée manuellement dans Supabase SQL Editor')
    console.log('→ Contenu du fichier: /Users/elgato_fofo/Desktop/fixit-production/supabase-team.sql')
  } else {
    console.log('✅ Membre inséré avec succès:', d2)
  }
}

main().catch(console.error)
