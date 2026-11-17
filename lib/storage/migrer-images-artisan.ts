/**
 * Migration des photos de profil et logos d'artisans encore enregistrés en data: URL base64 dans
 * profiles_artisan (profile_photo_url, logo_url) : chaque image est décodée, envoyée dans Supabase Storage
 * (même bucket, même chemin et même vérification que /api/save-logo) et la colonne reçoit l'URL https publique.
 *
 * Lancée par scripts/migrer-images-artisans-storage.ts. Sans `appliquer`, c'est une simulation : lectures
 * seulement, aucun envoi ni aucune écriture.
 *
 * Ordre exact (détaillé dans l'en-tête du script) : déploiement de la PR, script avec --appliquer, comptage de
 * contrôle à 0, puis les migrations 20261028a (contraintes NOT VALID) et 20261028b (VALIDATE CONSTRAINT). Jamais
 * les contraintes avant la migration des données : une contrainte CHECK, même NOT VALID, est vérifiée sur toute
 * ligne mise à jour, quelles que soient les colonnes touchées, et chaque mise à jour faite ici ne touche qu'une
 * colonne (une fiche dont les deux colonnes sont en data: URL ne pourrait plus être migrée).
 *
 * Une valeur que l'artisan a changée pendant la migration n'est jamais écrasée : la mise à jour ne passe que si la
 * colonne contient encore la data: URL lue (début et fin comparés). Une valeur qui n'est pas une image reconnue
 * (type non pris en charge, base64 abîmé) reste telle quelle et figure dans le bilan.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  envoyerImageArtisan,
  lireImageDataUrl,
  supprimerImageArtisan,
  type ChampImageArtisan,
} from './images-artisan'

export const CHAMPS_IMAGE_ARTISAN: ChampImageArtisan[] = ['profile_photo_url', 'logo_url']

export interface OptionsMigrationImages {
  /** false : simulation, rien n'est envoyé ni écrit. */
  appliquer: boolean
  champs?: ChampImageArtisan[]
  /** Nombre maximal de valeurs traitées, toutes colonnes confondues. */
  limite?: number
  journal?: (ligne: string) => void
}

export interface BilanChampImage {
  /** Lignes dont la colonne commence par « data: ». */
  trouvees: number
  /** Images reconnues (JPEG, PNG, WebP, GIF) parmi les valeurs traitées. */
  valides: number
  /** Taille décodée des images reconnues, en octets. */
  octets: number
  migrees: number
  /** Laissées telles quelles : format non pris en charge, ou valeur changée entre-temps. */
  ignorees: number
  echecs: number
}

export interface ResultatMigrationImages {
  bilan: Record<ChampImageArtisan, BilanChampImage>
  /** Raison de l'arrêt anticipé (Storage en échec à répétition), sinon null. */
  arret: string | null
}

const TAILLE_PAGE = 1000
const ECHECS_STORAGE_CONSECUTIFS_MAX = 3

const bilanVide = (): BilanChampImage => ({ trouvees: 0, valides: 0, octets: 0, migrees: 0, ignorees: 0, echecs: 0 })
const court = (id: string) => id.slice(0, 8)
const ko = (octets: number) => `${Math.round(octets / 1024)} Ko`

/**
 * Motif LIKE qui ne reconnaît que cette valeur : ses 128 premiers et 128 derniers caractères (la valeur entière
 * si elle est courte). Les caractères spéciaux de LIKE sont échappés ; le base64 n'en contient pas.
 */
export function motifValeurIdentique(valeur: string): string {
  const echapper = (texte: string) => texte.replace(/[\\%_]/g, (c) => `\\${c}`)
  if (valeur.length <= 256) return echapper(valeur)
  return `${echapper(valeur.slice(0, 128))}%${echapper(valeur.slice(-128))}`
}

async function listerIds(client: SupabaseClient, champ: ChampImageArtisan): Promise<string[]> {
  const ids: string[] = []
  let pagePleine = true
  for (let debut = 0; pagePleine; debut += TAILLE_PAGE) {
    const { data, error } = await client
      .from('profiles_artisan')
      .select('id')
      .like(champ, 'data:%')
      .order('id')
      .range(debut, debut + TAILLE_PAGE - 1)
    if (error) throw new Error(`lecture des lignes (${champ}) impossible : ${error.message}`)
    const page = (data ?? []) as unknown as Array<{ id: string }>
    ids.push(...page.map((ligne) => ligne.id))
    pagePleine = page.length === TAILLE_PAGE
  }
  return ids
}

export async function migrerImagesArtisans(
  client: SupabaseClient,
  options: OptionsMigrationImages,
): Promise<ResultatMigrationImages> {
  const journal = options.journal ?? ((ligne: string) => console.log(ligne))
  const champs = options.champs ?? CHAMPS_IMAGE_ARTISAN
  const bilan: Record<ChampImageArtisan, BilanChampImage> = { profile_photo_url: bilanVide(), logo_url: bilanVide() }
  let restantes = options.limite ?? Number.POSITIVE_INFINITY
  let echecsStorageConsecutifs = 0

  for (const champ of champs) {
    const ids = await listerIds(client, champ)
    const b = bilan[champ]
    b.trouvees = ids.length
    journal(`${champ} : ${ids.length} ligne(s) en data: URL`)

    for (const id of ids) {
      if (restantes <= 0) {
        journal(`Limite atteinte : arrêt avant ${champ} ${court(id)}`)
        return { bilan, arret: null }
      }
      restantes--

      // Une ligne à la fois : chaque valeur peut peser plusieurs centaines de Ko
      const { data, error } = await client
        .from('profiles_artisan')
        .select('id, profile_photo_url, logo_url')
        .eq('id', id)
        .maybeSingle()
      if (error) {
        b.echecs++
        journal(`  ${court(id)} : lecture impossible (${error.message})`)
        continue
      }
      const valeur = (data as unknown as Record<string, unknown> | null)?.[champ]
      if (typeof valeur !== 'string' || !valeur.startsWith('data:')) {
        journal(`  ${court(id)} : plus en data: URL, rien à faire`)
        continue
      }

      const image = lireImageDataUrl(valeur)
      if (!image) {
        b.ignorees++
        journal(`  ${court(id)} : format non pris en charge (${valeur.slice(0, 40)}…), laissée telle quelle`)
        continue
      }
      b.valides++
      b.octets += image.octets.length

      if (!options.appliquer) {
        journal(`  ${court(id)} : ${image.type}, ${ko(image.octets.length)}, à migrer`)
        continue
      }

      const envoi = await envoyerImageArtisan(client, champ, image)
      if (!envoi.ok) {
        b.echecs++
        echecsStorageConsecutifs++
        journal(`  ${court(id)} : envoi impossible (${envoi.etape}) : ${envoi.message}`)
        if (echecsStorageConsecutifs >= ECHECS_STORAGE_CONSECUTIFS_MAX) {
          return {
            bilan,
            arret: `${ECHECS_STORAGE_CONSECUTIFS_MAX} envois Storage de suite en échec (bucket absent ou privé ?) : migration arrêtée`,
          }
        }
        continue
      }
      echecsStorageConsecutifs = 0

      const { data: modifiees, error: erreurMaj } = await client
        .from('profiles_artisan')
        .update({ [champ]: envoi.url })
        .eq('id', id)
        .like(champ, motifValeurIdentique(valeur))
        .select('id')
      if (erreurMaj || !modifiees || modifiees.length === 0) {
        // La colonne garde sa valeur : le fichier envoyé ne sert à rien
        const echecSuppression = await supprimerImageArtisan(client, envoi.chemin)
        const orphelin = echecSuppression ? ` ; fichier ${envoi.chemin} non supprimé : ${echecSuppression}` : ''
        if (erreurMaj) {
          b.echecs++
          journal(`  ${court(id)} : mise à jour impossible (${erreurMaj.message})${orphelin}`)
        } else {
          b.ignorees++
          journal(`  ${court(id)} : valeur changée entre-temps, laissée telle quelle${orphelin}`)
        }
        continue
      }
      b.migrees++
      journal(`  ${court(id)} : migrée (${ko(image.octets.length)}) → ${envoi.url}`)
    }
  }
  return { bilan, arret: null }
}
