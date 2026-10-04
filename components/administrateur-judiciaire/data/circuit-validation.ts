export type EtapeCircuit = 'prepare' | 'verifie' | 'valide'

/** Acte en circuit de validation (préparé → vérifié par le juriste → validé et signé). */
export interface ActeCircuit {
  id: number
  objet: string
  copro: string
  type: string
  stage: EtapeCircuit
  by: string
}

/** Valeur initiale de l'écran (état local, sans persistance) : 3 préparés, 2 vérifiés, 1 validé. */
export const DEMO_ACTES_CIRCUIT_VALIDATION: ActeCircuit[] = [
  {
    id: 1,
    objet: 'Requête en prorogation — Les Tilleuls',
    copro: 'Copropriété Les Tilleuls',
    type: 'Requête',
    stage: 'verifie',
    by: 'C. Noël',
  },
  {
    id: 2,
    objet: 'État de frais & honoraires — Le Méridien',
    copro: 'Résidence Le Méridien',
    type: 'Taxation',
    stage: 'verifie',
    by: 'J. Marchand',
  },
  {
    id: 3,
    objet: 'Convocation AG élective — Le Clos des Vignes',
    copro: 'Le Clos des Vignes',
    type: 'Convocation',
    stage: 'prepare',
    by: 'A. Diallo',
  },
  {
    id: 4,
    objet: 'Mise en demeure — SCI Belvédère',
    copro: 'Copropriété Les Tilleuls',
    type: 'Recouvrement',
    stage: 'prepare',
    by: 'J. Marchand',
  },
  {
    id: 5,
    objet: "Notification d'ordonnance — Villa Montaigne",
    copro: 'Villa Montaigne',
    type: 'Notification',
    stage: 'valide',
    by: 'Secrétariat',
  },
  {
    id: 6,
    objet: 'Rapport intermédiaire art. 29-1 — Les Tilleuls',
    copro: 'Copropriété Les Tilleuls',
    type: 'Rapport',
    stage: 'prepare',
    by: 'C. Noël',
  },
]

export const ETAPES_CIRCUIT_VALIDATION: Record<EtapeCircuit, { label: string; pill: 'gold' | 'amber' | 'sage' }> = {
  prepare: { label: 'Préparé', pill: 'gold' },
  verifie: { label: 'Vérifié (juriste)', pill: 'amber' },
  valide: { label: 'Validé & signé', pill: 'sage' },
}
