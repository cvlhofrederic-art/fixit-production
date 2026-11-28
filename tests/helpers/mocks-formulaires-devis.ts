// tests/helpers/mocks-formulaires-devis.ts — simulations communes des tests des formulaires de devis et
// factures (artisan et BTP) et du téléchargement des PDF. À utiliser dans une fabrique vi.mock asynchrone :
//   vi.mock('@/lib/supabase', async () => (await import('../helpers/mocks-formulaires-devis')).supabaseNavigateur())
// (vi.mock est remonté en tête de fichier : la fabrique ne peut pas lire une variable du module de test.)

import { vi } from 'vitest'

/** Traductions : la clé est rendue telle quelle. */
export const traductions = (locale: 'fr' | 'pt' = 'fr') => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale }),
  useLocale: () => locale,
})

/** Client Supabase du navigateur : aucune session, requêtes vides. */
export const supabaseNavigateur = () => {
  const chaine: Record<string, unknown> = {}
  for (const methode of ['select', 'eq', 'order', 'limit', 'in']) chaine[methode] = () => chaine
  chaine.single = async () => ({ data: null, error: null })
  chaine.maybeSingle = async () => ({ data: null, error: null })
  chaine.then = (suite: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(suite)
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: () => chaine,
    },
  }
}

/** Notifications (sonner) muettes, observables par les espions. */
export const notifications = () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'tid'), dismiss: vi.fn() }),
})

/** Appels /api authentifiés : réponse vide. */
export const fetchAuthentifieVide = () => ({ fetchAuthentifie: vi.fn().mockResolvedValue(new Response('[]', { status: 200 })) })

/** Synchronisation vers la base : rien n'est envoyé. */
export const synchroMuette = () => ({ syncDocumentSafe: vi.fn() })

/** Paramètres reçus par le générateur PDF artisan (V2) simulé, dans l'ordre des appels. */
export const entreesPdfV2: Array<Record<string, unknown>> = []

/** Générateur PDF artisan (V2) simulé : garde ses paramètres et rend un faux PDF. */
export const generateurPdfV2Espion = () => ({
  generateDevisPdfV2: vi.fn(async (entree: Record<string, unknown>) => {
    entreesPdfV2.push(entree)
    return { output: () => new TextEncoder().encode('%PDF-v2').buffer, save: () => undefined }
  }),
})

/** Habillage PDF/A-3 neutre. */
export const habillagePdfA3Neutre = () => ({ wrapAsPdfA3: vi.fn(async () => new TextEncoder().encode('%PDF-a3')) })
