/** Version française du syndic v54 sans texte portugais — quart 2/4 des routes (voir fr-residus.suite.tsx). */
import { vi } from 'vitest'
import { suiteResidusFr } from './fr-residus.suite'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

suiteResidusFr(2, 4)
