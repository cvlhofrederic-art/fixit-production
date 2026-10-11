// Copies locales (localStorage) des données de démo de l'espace copropriétaire.
import { PROFILE_DEMO } from '@/lib/copro-demo-data'

/**
 * Version des données de démo (lib/copro-demo-data.ts), redatées autour d'octobre 2026 ;
 * « -b » : fonds de travaux art. 14-2-1, immeuble à Marseille ;
 * « -c » : immeuble = Résidence Le Prado (182 avenue du Prado), celui du cabinet de démo Syndic v54.
 */
export const VERSION_DONNEES_COPRO = '2026-10-c'

/** Immeuble des versions antérieures : un profil local qui le porte est remplacé par le profil de démo. */
export const IMMEUBLE_DEMO_PERIME = 'Résidence Les Acacias'

const CLES_DATEES = ['charges', 'paiements', 'documents', 'annonces', 'ags', 'echeances', 'notifications', 'historique']

/**
 * Oublie les copies locales d'une version antérieure des données de démo (dates de février-avril 2026),
 * qui masqueraient les nouvelles. Paramètres conservés ; profil conservé, sauf s'il désigne encore
 * l'ancien immeuble de démo (sinon les signalements partiraient vers un immeuble absent du cabinet).
 * Sans effet une fois la version notée.
 */
export function oublierDonneesDemoPerimees(uid: string, stockage: Storage = localStorage): void {
  try {
    const cleVersion = `fixit_copro_version_${uid}`
    if (stockage.getItem(cleVersion) === VERSION_DONNEES_COPRO) return
    CLES_DATEES.forEach(cle => stockage.removeItem(`fixit_copro_${cle}_${uid}`))
    const cleProfil = `fixit_copro_profile_${uid}`
    let profilLocal: { id?: string; immeuble?: string } | null = null
    try {
      profilLocal = JSON.parse(stockage.getItem(cleProfil) || 'null') as { id?: string; immeuble?: string } | null
    } catch (e) {
      console.warn('[copro] profil local illisible', e)
    }
    stockage.removeItem(`fixit_interventions_copro_${profilLocal?.id ?? PROFILE_DEMO.id}`)
    if (profilLocal?.immeuble === IMMEUBLE_DEMO_PERIME) stockage.removeItem(cleProfil)
    stockage.setItem(cleVersion, VERSION_DONNEES_COPRO)
  } catch (e) {
    console.warn('[copro] localStorage inaccessible (navigation privée ?)', e)
  }
}
