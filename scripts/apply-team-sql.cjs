const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
      // Valeurs d'exemple (dépôt public) : y mettre le cabinet, le compte et l'e-mail du membre à ajouter.
      cabinet_id: '00000000-0000-4000-8000-000000000001',
      user_id: '00000000-0000-4000-8000-000000000002',
      email: 'membre@exemple.fr',
      full_name: 'Membre Exemple',
      role: 'syndic_tech',
      accepted_at: new Date().toISOString(),
      is_active: true
    }, { onConflict: 'email' })
    .select()
  
  if (e2) {
    console.log('Table pas encore créée (normal):', e2.message)
    console.log('\n→ La table doit être créée manuellement dans Supabase SQL Editor')
    console.log('→ Contenu : supabase/migrations/20260527_syndic_team_members.sql')
  } else {
    console.log('✅ Membre inséré avec succès:', d2)
  }
}

main().catch(console.error)
