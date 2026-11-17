// ── Liaison portail ↔ Administrateur judiciaire : instant des échanges ───────────────────────────────────────────
//
// En démonstration, l'AJ vit à sa date figée (DATE_DEMO_ISO) : les échanges sont datés de ce jour-là, à l'heure du
// navigateur, pour s'ordonner avec ses données (doléances « 04/06 », assemblée du 15/09…). En mode « données réelles »,
// maintenant.

import { DATE_DEMO_ISO, lireModeStocke, type Mode } from '@/lib/administrateur-judiciaire/mode'

export function maintenantLiaison(mode: Mode = lireModeStocke(), horloge: Date = new Date()): Date {
  if (mode !== 'demo') return horloge
  const [annee, mois, jour] = DATE_DEMO_ISO.split('-').map(Number)
  return new Date(annee, mois - 1, jour, horloge.getHours(), horloge.getMinutes(), horloge.getSeconds())
}
