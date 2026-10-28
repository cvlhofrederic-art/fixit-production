// scripts/migrer-images-artisans-storage.ts
// ──────────────────────────────────────────────────────────────────────────────
// Script ponctuel : déplace dans Supabase Storage (bucket public profile-photos) les photos de profil et logos
// d'artisans encore enregistrés en data: URL base64 dans profiles_artisan (profile_photo_url, logo_url), et met
// l'URL https publique à la place. Logique et garde-fous : lib/storage/migrer-images-artisan.ts.
//
// SIMULATION PAR DÉFAUT : lit les lignes et affiche ce qui serait migré, sans rien envoyer ni écrire.
// Rien n'est modifié sans le drapeau --appliquer.
//
// À lancer APRÈS le déploiement de la nouvelle route /api/save-logo (sinon de nouvelles data: URL arrivent
// pendant la migration).
//
// Usage (PowerShell), clé service_role lue dans l'environnement :
//   $env:NEXT_PUBLIC_SUPABASE_URL = "https://irluhepekbqgquveaett.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<clé service_role>"
//   npx tsx scripts/migrer-images-artisans-storage.ts                  # simulation
//   npx tsx scripts/migrer-images-artisans-storage.ts --limite=1 --appliquer   # une seule image, pour vérifier
//   npx tsx scripts/migrer-images-artisans-storage.ts --appliquer      # migration
// Options : --champ=profile_photo_url ou --champ=logo_url (une seule colonne), --limite=N (N valeurs au plus).
//
// Comptage préalable, en lecture seule (éditeur SQL Supabase) :
//   SELECT
//     count(*) FILTER (WHERE profile_photo_url LIKE 'data:%') AS photos_base64,
//     count(*) FILTER (WHERE logo_url LIKE 'data:%') AS logos_base64,
//     count(*) FILTER (WHERE profile_photo_url LIKE 'data:%' OR logo_url LIKE 'data:%') AS lignes_concernees,
//     pg_size_pretty(
//       coalesce(sum(octet_length(profile_photo_url)) FILTER (WHERE profile_photo_url LIKE 'data:%'), 0)
//       + coalesce(sum(octet_length(logo_url)) FILTER (WHERE logo_url LIKE 'data:%'), 0)
//     ) AS volume_base64
//   FROM profiles_artisan;
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import type { ChampImageArtisan } from '../lib/storage/images-artisan'
import { CHAMPS_IMAGE_ARTISAN, migrerImagesArtisans } from '../lib/storage/migrer-images-artisan'

interface OptionsLigneDeCommande {
  appliquer: boolean
  champs: ChampImageArtisan[]
  limite?: number
}

function lireArguments(args: string[]): OptionsLigneDeCommande | { erreur: string } {
  const options: OptionsLigneDeCommande = { appliquer: false, champs: CHAMPS_IMAGE_ARTISAN }
  let simulationExplicite = false
  for (const arg of args) {
    if (arg === '--appliquer') {
      options.appliquer = true
    } else if (arg === '--dry-run') {
      // Simulation explicite (c'est déjà le mode par défaut) ; prime sur --appliquer si les deux sont donnés.
      simulationExplicite = true
    } else if (arg.startsWith('--champ=')) {
      const champ = arg.slice('--champ='.length)
      if (!CHAMPS_IMAGE_ARTISAN.includes(champ as ChampImageArtisan)) {
        return { erreur: `Champ inconnu : ${champ} (profile_photo_url ou logo_url)` }
      }
      options.champs = [champ as ChampImageArtisan]
    } else if (arg.startsWith('--limite=')) {
      const limite = Number(arg.slice('--limite='.length))
      if (!Number.isInteger(limite) || limite < 1) return { erreur: `Limite invalide : ${arg}` }
      options.limite = limite
    } else {
      // Une faute de frappe ne doit jamais lancer autre chose que ce qui est demandé
      return { erreur: `Argument inconnu : ${arg} (attendus : --dry-run, --appliquer, --champ=…, --limite=N)` }
    }
  }
  if (simulationExplicite) options.appliquer = false
  return options
}

async function main() {
  const options = lireArguments(process.argv.slice(2))
  if ('erreur' in options) {
    console.error(`[migration] ${options.erreur}`)
    process.exitCode = 1
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) {
    console.error('[migration] NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY sont requis')
    process.exitCode = 1
    return
  }
  const client = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(`[migration] mode : ${options.appliquer ? 'APPLICATION (envois Storage et mises à jour)' : 'SIMULATION (aucune écriture)'}`)
  console.log(`[migration] colonnes : ${options.champs.join(', ')}${options.limite ? ` ; limite : ${options.limite}` : ''}`)

  const { bilan, arret } = await migrerImagesArtisans(client, options)

  console.log('[migration] bilan :')
  for (const champ of options.champs) {
    const b = bilan[champ]
    console.log(
      `  ${champ} : ${b.trouvees} en data: URL, ${b.valides} image(s) reconnue(s) (${Math.round(b.octets / 1024)} Ko), `
      + `${b.migrees} migrée(s), ${b.ignorees} laissée(s) telle(s) quelle(s), ${b.echecs} échec(s)`,
    )
  }
  if (arret) {
    console.error(`[migration] ${arret}`)
    process.exitCode = 1
  }
  if (!options.appliquer) {
    console.log('[migration] Simulation : rien n’a été envoyé ni écrit. Relancer avec --appliquer pour migrer.')
  }
}

main().catch((e: unknown) => {
  console.error('[migration] échec :', e instanceof Error ? e.message : e)
  process.exitCode = 1
})
