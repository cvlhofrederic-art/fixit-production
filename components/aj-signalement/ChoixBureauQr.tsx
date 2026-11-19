'use client'

// ── Liste « Bureau » d'un cabinet client (super admin ; écrans E2, E4, E5 et import du plan des bureaux) ─────────────
//
// Bureaux des cabinets (migration 20261119), BROUILLON soumis avant fusion. Une liste déroulante des bureaux proposés
// (ouverts ; E4 : sauf l'actuel), lus par useBureauxCabinetQr :
//   - lecture en cours : « Chargement des bureaux… » (annoncé) ;
//   - base absente (503) : « Fonction pas encore disponible » ; autre échec : le message et « Réessayer » ;
//   - lue : la liste, première option « Choisir… » (valeur vide, jamais un « aucun bureau ») ; aucune proposition : `vide`
//     s'il est donné, sinon rien. E5 (bureau facultatif d'une copropriété) : `premiere` nomme l'option vide (« Aucun bureau »).
// Mêmes composants que les champs voisins (Champ, CLASSES_SAISIE, Encadre, Bouton) : aucun nouveau style. Le choix exigé
// est annoncé (aria-required) ; le contrôle reste celui de l'écran, comme pour la liste « Cabinet » de la même fenêtre.

import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import type { LectureBureauxQr } from '@/components/aj-signalement/useBureauxCabinetQr'
import { TEXTES_GESTION_QR as G, libelleBureauQr, messageErreurBureauQr } from '@/lib/aj-signalement/affichage-gestion'
import type { BureauResumeQr } from '@/lib/aj-signalement/bureaux'

export interface PropsChoixBureauQr {
  id: string
  etiquette: string
  aide?: string
  lecture: LectureBureauxQr
  /** Bureaux proposés, dans l'ordre reçu (triés par nom par le serveur). */
  bureaux: readonly BureauResumeQr[]
  /** Id du bureau choisi ; '' : aucun choix. */
  valeur: string
  onChange: (id: string) => void
  /** « Réessayer » après une lecture en échec. */
  onReessayer: () => void
  /** Choix exigé (annoncé aux lecteurs d'écran). */
  requis?: boolean
  disabled?: boolean
  /** Texte quand aucun bureau n'est proposé ; absent : rien n'est affiché. */
  vide?: string
  /** Libellé de l'option vide ; absent : « Choisir… » (E5 : « Aucun bureau », le bureau est facultatif). */
  premiere?: string
}

export default function ChoixBureauQr({
  id, etiquette, aide, lecture, bureaux, valeur, onChange, onReessayer, requis = false, disabled = false, vide, premiere = G.bureaux.choisir,
}: Readonly<PropsChoixBureauQr>) {
  if (lecture.etat === 'chargement') return <p role="status" className="text-sm text-[#4A5E78]">{G.bureaux.fenetre.chargement}</p>
  if (lecture.etat === 'indisponible') return <Encadre ton="avertissement">{G.bureaux.indisponible}</Encadre>
  if (lecture.etat === 'erreur') {
    return (
      <Encadre ton="erreur">
        <p>{messageErreurBureauQr(lecture.code, true)}</p>
        <div className="mt-2"><Bouton variante="secondaire" petit icone="actualiser" onClick={onReessayer}>{G.reessayer}</Bouton></div>
      </Encadre>
    )
  }
  if (bureaux.length === 0) return vide ? <p role="status" className="text-sm text-[#4A5E78]">{vide}</p> : null
  return (
    <Champ id={id} etiquette={etiquette} aide={aide}>
      <select
        id={id} value={valeur} className={CLASSES_SAISIE} disabled={disabled} aria-required={requis || undefined}
        aria-describedby={aide ? `${id}-aide` : undefined} onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{premiere}</option>
        {bureaux.map((b) => <option key={b.id} value={b.id}>{libelleBureauQr(b)}</option>)}
      </select>
    </Champ>
  )
}
