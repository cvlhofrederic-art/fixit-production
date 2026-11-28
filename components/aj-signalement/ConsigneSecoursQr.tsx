// ── Consigne d'appel aux secours de la page publique « AJ Signalement » ───────────
//
// R70 du dossier téléphonie (14/11/2026) : une urgence déclarée par QR code n'alerte aucun secours. BROUILLON (textes à
// valider par le référent métier, présentation par Frédéric, portugais H4), composant du socle seulement (Encadre, tons existants) :
//   - ConsigneSecoursQr : consigne permanente, en tête du formulaire, avant les coordonnées (ton « info ») ;
//   - ConsigneSecoursUrgenteQr : consigne renforcée (ton « avertissement »), sous le choix d'urgence quand « urgent »
//     est choisi et sur la confirmation d'un signalement urgent.
// Accessibilité : l'Encadre porte le rôle « status » (jamais une alerte), mais une région créée avec son texte n'est pas
// lue à coup sûr : rien ne promet une annonce à l'apparition de la consigne renforcée. Sous le choix d'urgence, le
// formulaire la relie au bouton d'envoi (prop id, sur un bloc sans classe autour du titre et du texte, Encadre n'acceptant
// pas d'id ; aria-describedby du bouton) : elle est lue quand la personne atteint le bouton. Aucune région vivante en plus ;
// le focus ne bouge pas. Textes : lib/aj-signalement/textes.ts.

import { Encadre } from '@/components/coproprietaire-dashboard/ui'
import type { TextesSignalementQr } from '@/lib/aj-signalement/textes'

export function ConsigneSecoursQr({ tq }: Readonly<{ tq: TextesSignalementQr }>) {
  return <Encadre ton="info">{tq.consigneSecours}</Encadre>
}

export function ConsigneSecoursUrgenteQr({ tq, id, className }: Readonly<{ tq: TextesSignalementQr; id?: string; className?: string }>) {
  return (
    <Encadre ton="avertissement" className={className}>
      <div id={id}>
        <p className="font-semibold">{tq.consigneSecoursUrgente.titre}</p>
        <p className="mt-1">{tq.consigneSecoursUrgente.texte}</p>
      </div>
    </Encadre>
  )
}
