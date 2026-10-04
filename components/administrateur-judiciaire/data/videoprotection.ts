export type ConformiteCnil = 'conforme' | 'non conforme'

export type CameraVideoprotectionDemo = [
  emplacement: string,
  copropriete: string,
  signaletique: 'oui' | 'non',
  conservation: string,
  conformite: ConformiteCnil,
]

export const DEMO_CAMERAS_VIDEOPROTECTION: CameraVideoprotectionDemo[] = [
  ["Hall d'entrée", 'Le Méridien', 'oui', '30 jours', 'conforme'],
  ['Parking sous-sol', 'Le Méridien', 'oui', '30 jours', 'conforme'],
  ['Local vélos', 'Le Clos des Vignes', 'non', '45 jours', 'non conforme'],
  ['Entrée principale', 'Villa Montaigne', 'oui', '30 jours', 'conforme'],
]

export const PILL_PAR_CONFORMITE_CNIL: Record<ConformiteCnil, 'sage' | 'rust'> = {
  conforme: 'sage',
  'non conforme': 'rust',
}
