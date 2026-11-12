'use client'

// ── AJ Signalement — fenêtre de la diffusion : « Diffuser un message », annonce, historique (PR 3, lot 8, BROUILLON) ──
//
// Cahier PR 3 § 7.1 à 7.3 et § 7.6 ; écran en BROUILLON, soumis à Frédéric (F1). Ouverte depuis la carte d'une
// copropriété (« Diffuser un message », « Messages envoyés ») ou le détail d'un signalement (« Informer les déclarants
// de ce signalement », portée fixe). Socle visuel de l'espace (Modale de components/coproprietaire-dashboard/ui.tsx,
// NON modifié : largeur max-w-lg, contenu dans le conteneur défilant de l'assistant d'import).
// Fermeture PROTÉGÉE (§ 7.1) : Échap, clic dehors, bouton Fermer, « Annuler » et changement de vue de l'espace
// (demandeFermeture) passent par la même règle —
//   - rien à perdre : la fenêtre se ferme ;
//   - saisie en cours : « Abandonner ce message ? » (Abandonner / Continuer la saisie) ;
//   - envoi en cours : la fenêtre ne se ferme pas (« L'envoi continue ; vous pourrez fermer à la fin »).
// Le passage à une autre vue de la fenêtre (« Annoncer la diffusion… », « Voir les messages envoyés ») suit la même
// règle (relecture 3 de la PR 3) : il remplace le formulaire, donc il jetterait la saisie ou arrêterait la reprise
// automatique de l'envoi ; « Abandonner » mène alors à la vue demandée au lieu de fermer.
// La Modale réenregistre ses écouteurs à chaque nouvelle fonction onFermer (et remet le focus sur son titre) : la
// fonction passée ici est stable (useCallback sans dépendance, état lu dans des références).
// La fenêtre est rendue dans document.body (portail) : quand l'espace passe à une vue hors du tableau, la partie qui la
// contient est masquée (hidden) ; la fenêtre reste visible, sa protection s'applique. Si elle se ferme quand même
// (navigation), le filet de reprise (D-C1) termine l'envoi.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Encadre, Modale } from '@/components/coproprietaire-dashboard/ui'
import FormulaireDiffusionQr from '@/components/aj-signalement/FormulaireDiffusionQr'
import HistoriqueDiffusionsQr from '@/components/aj-signalement/HistoriqueDiffusionsQr'
import { DELAI_REPRISE_DIFFUSION_MS } from '@/components/aj-signalement/envoiDiffusionQr'
import {
  TEXTES_ECRAN_DIFFUSION_QR as TD, type CoproprieteEcranDiffusionQr, type GardeDiffusionQr, type ProfilDiffusionQr,
} from '@/lib/aj-signalement/affichage-ecran-diffusion'

export interface PropsFenetreDiffusionQr {
  copropriete: CoproprieteEcranDiffusionQr
  profil: ProfilDiffusionQr
  /** Ce que la fenêtre montre à l'ouverture. */
  contenu: 'message' | 'historique'
  /** Portée « signalement » (depuis le détail d'un signalement) : fixe. */
  signalementId?: string
  onFermer: () => void
  /** Change quand l'espace demande la fermeture (changement de vue) : même protection qu'Échap. */
  demandeFermeture?: number
  /** État de protection remonté à l'appelant (« libre » à la fermeture). */
  onGarde?: (garde: GardeDiffusionQr) => void
  /** Pause entre deux reprises automatiques (ms). */
  delaiRepriseMs?: number
}

type VueFenetre = 'message' | 'annonce' | 'historique'
/** Ce que fait « Abandonner » : fermer la fenêtre, ou passer à une autre de ses vues. */
type SuiteAbandon = 'fermer' | VueFenetre

export default function FenetreDiffusionQr({
  copropriete, profil, contenu, signalementId, onFermer, demandeFermeture = 0, onGarde, delaiRepriseMs = DELAI_REPRISE_DIFFUSION_MS,
}: Readonly<PropsFenetreDiffusionQr>) {
  const [vue, setVue] = useState<VueFenetre>(contenu)
  const [avis, setAvis] = useState<'abandon' | 'envoi' | null>(null)
  const [suiteAbandon, setSuiteAbandon] = useState<SuiteAbandon>('fermer')
  // Protection : en référence (lue par la fonction de fermeture, stable) et en état (lue au rendu).
  const garde = useRef<GardeDiffusionQr>('libre')
  const [gardeAffichee, setGardeAffichee] = useState<GardeDiffusionQr>('libre')
  const rappels = useRef({ onFermer, onGarde })
  const zoneAvis = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    rappels.current = { onFermer, onGarde }
  }, [onFermer, onGarde])

  /** Protection signalée par le contenu ; un avis qui n'a plus d'objet disparaît. */
  const signalerGarde = useCallback((g: GardeDiffusionQr) => {
    garde.current = g
    setGardeAffichee(g)
    setAvis((a) => ((a === 'envoi' && g !== 'envoi') || (a === 'abandon' && g !== 'saisie') ? null : a))
    rappels.current.onGarde?.(g)
  }, [])

  /** Fermeture ou autre vue, sans question : rien n'est plus à protéger. */
  const executer = useCallback((suite: SuiteAbandon) => {
    if (suite === 'fermer') rappels.current.onFermer()
    else setVue(suite)
  }, [])

  /** Fermeture ou autre vue demandée (Échap, clic dehors, Fermer, Annuler, annonce, historique) : voir l'en-tête. */
  const demander = useCallback((suite: SuiteAbandon) => {
    if (garde.current === 'envoi') return setAvis('envoi')
    if (garde.current === 'saisie') {
      setSuiteAbandon(suite)
      return setAvis('abandon')
    }
    executer(suite)
  }, [executer])
  // Stable : la Modale réenregistre ses écouteurs à chaque nouvelle fonction onFermer (voir l'en-tête).
  const demanderFermeture = useCallback(() => demander('fermer'), [demander])

  // Changement de vue de l'espace (état ajusté au rendu) : même règle qu'Échap ; la valeur reçue à l'ouverture ne compte
  // pas (une fenêtre neuve ne se ferme pas seule). Rien à protéger : la fermeture est demandée à l'appelant après le rendu.
  const [demandeVue, setDemandeVue] = useState(demandeFermeture)
  const [fermetureDemandee, setFermetureDemandee] = useState(false)
  if (demandeFermeture !== demandeVue) {
    setDemandeVue(demandeFermeture)
    if (gardeAffichee === 'envoi') setAvis('envoi')
    else if (gardeAffichee === 'saisie') {
      setSuiteAbandon('fermer')
      setAvis('abandon')
    } else setFermetureDemandee(true)
  }
  useEffect(() => {
    if (fermetureDemandee) rappels.current.onFermer()
  }, [fermetureDemandee])

  // Fermée : plus rien à protéger pour l'appelant.
  useEffect(() => () => { rappels.current.onGarde?.('libre') }, [])

  // Question d'abandon : le focus va sur « Continuer la saisie » (le choix qui ne perd rien).
  useEffect(() => {
    if (avis === 'abandon') zoneAvis.current?.querySelector<HTMLButtonElement>('[data-continuer]')?.focus()
  }, [avis])

  const titre = vue === 'historique'
    ? remplir(TD.titres.historique, { copropriete: copropriete.nom })
    : vue === 'annonce'
      ? remplir(TD.titres.annonce, { copropriete: copropriete.nom })
      : signalementId ? TD.titres.signalement : remplir(TD.titres.message, { copropriete: copropriete.nom })

  if (typeof document === 'undefined') return null
  return createPortal(
    <div lang="fr">
      <Modale titre={titre} onFermer={demanderFermeture} labelFermer={TD.fermerFenetre}>
        <div ref={zoneAvis} className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {avis === 'abandon' && (
            <Encadre ton="avertissement" role="alert">
              <p className="font-semibold">{TD.fermeture.question}</p>
              <p className="mt-1">{TD.fermeture.aide}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Bouton variante="danger" petit onClick={() => { setAvis(null); executer(suiteAbandon) }}>{TD.fermeture.abandonner}</Bouton>
                <Bouton variante="secondaire" petit data-continuer="" onClick={() => setAvis(null)}>{TD.fermeture.continuer}</Bouton>
              </div>
            </Encadre>
          )}
          {avis === 'envoi' && <Encadre ton="info" role="status">{TD.fermeture.envoiContinue}</Encadre>}
          {vue === 'historique' ? (
            <HistoriqueDiffusionsQr copropriete={copropriete} profil={profil} delaiRepriseMs={delaiRepriseMs} onGarde={signalerGarde} />
          ) : (
            <FormulaireDiffusionQr
              key={vue}
              copropriete={copropriete} profil={profil} mode={vue} signalementId={vue === 'message' ? signalementId : undefined}
              delaiRepriseMs={delaiRepriseMs} onGarde={signalerGarde} onFermer={demanderFermeture}
              onAnnoncer={() => demander('annonce')} onHistorique={() => demander('historique')}
            />
          )}
        </div>
      </Modale>
    </div>,
    document.body,
  )
}
