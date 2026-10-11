// Copies locales (localStorage) des données de démo de l'espace copropriétaire.
import { PROFILE_DEMO } from '@/lib/copro-demo-data'

/** Version des données de démo (lib/copro-demo-data.ts), redatées autour d'octobre 2026 ; « -b » : fonds de travaux art. 14-2-1, immeuble à Marseille. */
export const VERSION_DONNEES_COPRO = '2026-10-b'

const CLES_DATEES = ['charges', 'paiements', 'documents', 'annonces', 'ags', 'echeances', 'notifications', 'historique']

/**
 * Oublie les copies locales d'une version antérieure des données de démo (dates de février-avril 2026),
 * qui masqueraient les nouvelles. Profil et paramètres sont conservés. Sans effet une fois la version notée.
 */
export function oublierDonneesDemoPerimees(uid: string, stockage: Storage = localStorage): void {
  try {
    const cleVersion = `fixit_copro_version_${uid}`
    if (stockage.getItem(cleVersion) === VERSION_DONNEES_COPRO) return
    CLES_DATEES.forEach(cle => stockage.removeItem(`fixit_copro_${cle}_${uid}`))
    let idProfil = PROFILE_DEMO.id
    try {
      idProfil = (JSON.parse(stockage.getItem(`fixit_copro_profile_${uid}`) || 'null') as { id?: string } | null)?.id ?? idProfil
    } catch (e) {
      console.warn('[copro] profil local illisible', e)
    }
    stockage.removeItem(`fixit_interventions_copro_${idProfil}`)
    stockage.setItem(cleVersion, VERSION_DONNEES_COPRO)
  } catch (e) {
    console.warn('[copro] localStorage inaccessible (navigation privée ?)', e)
  }
}
