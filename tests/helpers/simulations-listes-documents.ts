// tests/helpers/simulations-listes-documents.ts — simulations communes des tests des listes Devis et Factures
// (components/dashboard/DevisSection.tsx et FacturesSection.tsx, artisan et BTP). À utiliser dans une fabrique vi.mock
// asynchrone, comme tests/helpers/mocks-formulaires-devis.ts :
//   vi.mock('@/components/dashboard/useThemeVars', async () => (await import('../helpers/simulations-listes-documents')).themeVarsNeutres())
// (vi.mock est remonté en tête de fichier : la fabrique ne lit, du fichier de test, que des valeurs créées par vi.hoisted.)

import { vi } from 'vitest'

export type RoleListe = 'pro_societe' | 'artisan'

/** Contexte du rôle (useOrgRoleContext) : rôle relu à chaque rendu dans `role`, objet créé par vi.hoisted dans le test. */
export const contexteRole = (role: { valeur: RoleListe }) => ({
  useOrgRoleContext: () => ({ orgRole: role.valeur, isV5: true, useBtpDesign: role.valeur === 'pro_societe' }),
})

/** Couleurs du thème : valeurs neutres. */
export const themeVarsNeutres = () => ({
  useThemeVars: () => ({
    bg: '#fff', surface: '#fff', surfaceAlt: '#f5f5f5', border: '#e5e5e5',
    text: '#000', textMuted: '#666', accent: '#000', accentText: '#fff', red: '#dc2626', green: '#16a34a',
  }),
})

/** Mises à jour envoyées à la base par les listes (« Marquer payée », suppression d'un brouillon), dans l'ordre. */
export const misesAJourBase: Array<{ table: string; valeurs: unknown; colonne: string; valeur: unknown }> = []

/** Client Supabase du navigateur : aucune session ; from(table).update(valeurs).eq(colonne, valeur) est noté et réussit. */
export const supabaseListes = () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: (table: string) => ({
      update: (valeurs: unknown) => ({
        eq: (colonne: string, valeur: unknown) => {
          misesAJourBase.push({ table, valeurs, colonne, valeur })
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
})

/** Composant simulé qui n'affiche rien (formulaire, fenêtre). */
export const composantVide = () => ({ default: () => null })

/** Téléchargement des PDF : rien n'est produit. */
export const telechargementPdfMuet = () => ({ downloadSavedDevis: vi.fn() })

/** Statuts de la liste après les mises à jour passées à setSavedDocuments (liste ou fonction), à partir de `avant`. */
export function statutsApres(setSavedDocuments: ReturnType<typeof vi.fn>, avant: ReadonlyArray<{ status?: string }>): Array<string | undefined> {
  let liste: ReadonlyArray<{ status?: string }> = avant
  for (const [maj] of setSavedDocuments.mock.calls) liste = typeof maj === 'function' ? maj(liste) : maj
  return liste.map((d) => d.status)
}
