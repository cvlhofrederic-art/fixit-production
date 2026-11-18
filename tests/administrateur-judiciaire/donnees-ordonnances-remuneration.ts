import type { OrdonnanceRemuneration } from '@/lib/administrateur-judiciaire/domain/ordonnances-remuneration'

/**
 * Données de test partagées : une ordonnance d'acompte du mandat « mandat-2026 », rendue le 02/03/2026 et notifiée le
 * 10/03/2026 avec la mention du recours ; 3 000,00 € HT d'émoluments et 200,00 € HT de frais. À surcharger par test.
 */
export const ordonnance = (surcharge: Partial<OrdonnanceRemuneration> = {}): OrdonnanceRemuneration => ({
  id: 'ord-1',
  mandatId: 'mandat-2026',
  type: 'acompte',
  date: '2026-03-02',
  dateNotification: '2026-03-10',
  mentionDuRecours: true,
  emolumentsHtCentimes: 300_000,
  fraisHtCentimes: 20_000,
  recours: null,
  ...surcharge,
})

/** Ordonnance de fin de mission notifiée le 10/03/2026 : délai de recours jusqu'au 10/04/2026, exécutoire le 11/04/2026. */
export const finDeMission = (surcharge: Partial<OrdonnanceRemuneration> = {}): OrdonnanceRemuneration =>
  ordonnance({ id: 'ord-fin', type: 'fin_de_mission', emolumentsHtCentimes: 600_000, fraisHtCentimes: 40_000, ...surcharge })

/** Administration provisoire de l'art. 29-1, copropriété de 120 lots : droit fixe applicable. */
export const AP_120_LOTS = { regime: 'ap291', nbLots: 120 } as const
