import './fuseau-paris'
import { describe, expect, it } from 'vitest'
import type { CoproprieteVue } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import type { EcheanceSuivi } from '@/lib/administrateur-judiciaire/db/schema'
import { construireContexteAgent } from '@/lib/administrateur-judiciaire/ia/contexte-agent'

/**
 * Contexte des agents IA : les dates partent telles qu'affichées à l'écran (composantes locales). La base stocke
 * les dates à minuit heure locale ; une conversion UTC les ferait reculer d'un jour à Paris.
 */

const copro = (surcharge: Partial<CoproprieteVue>): CoproprieteVue => ({
  id: 'c1', mandatId: 'm1', code: 'CV', nom: 'Le Clos des Vignes', adresse: '', lots: 48, budget: 198000, depense: 0,
  impayes: 0, fondsTravaux: 31400, fondement: '', motif: '', tribunal: 'TJ de Nanterre', rg: '26/0', ordonnance: new Date(2026, 2, 12),
  dureeMois: 12, echeance: new Date(2026, 6, 22), statut: '', pill: '', notifOrdonnance: '', ...surcharge,
})

const vide = { lots: [], coproprietaires: [], prestataires: [], taches: [], notifications: [], contrats: [], impayes: [] }

describe('construireContexteAgent — dates', () => {
  it('ordonnance, fin de mission et échéances en jour local (pas de décalage UTC)', () => {
    const echeance = { id: 'e1', coproprieteId: 'c1', objet: 'Reddition des comptes', base: '', date: new Date(2026, 5, 5), statut: '' } as unknown as EcheanceSuivi
    const contexte = construireContexteAgent({
      aujourdhui: '2026-06-04', mode: 'demo', coproprieteSelectionnee: '', copros: [copro({})], echeances: [echeance], ...vide,
    }) as { coproprietes: Array<{ mandat: { ordonnance: string; finDeMission: string } }>; echeances: Array<{ date: string }> }
    expect(contexte.coproprietes[0].mandat.ordonnance).toBe('2026-03-12')
    expect(contexte.coproprietes[0].mandat.finDeMission).toBe('2026-07-22')
    expect(contexte.echeances[0].date).toBe('2026-06-05')
  })

  it('copropriété sans mandat (dates en chaîne createdAt) : dates vides, comme à l’écran', () => {
    const contexte = construireContexteAgent({
      aujourdhui: '2026-06-04', mode: 'reel', coproprieteSelectionnee: '', echeances: [],
      copros: [copro({ ordonnance: '2026-01-15T10:00:00.000Z', echeance: '2026-01-15T10:00:00.000Z' })], ...vide,
    }) as { coproprietes: Array<{ mandat: { ordonnance: string | null; finDeMission: string | null } }> }
    expect(contexte.coproprietes[0].mandat.ordonnance).toBeNull()
    expect(contexte.coproprietes[0].mandat.finDeMission).toBeNull()
  })

  it('écrans de démonstration envoyés en mode démo seulement', () => {
    const base = { aujourdhui: '2026-06-04', coproprieteSelectionnee: '', copros: [], echeances: [], ...vide, ecransDemo: { automatisations: [1] } }
    expect(construireContexteAgent({ ...base, mode: 'demo' })).toHaveProperty('ecransDemonstration')
    expect(construireContexteAgent({ ...base, mode: 'reel' })).not.toHaveProperty('ecransDemonstration')
  })
})
