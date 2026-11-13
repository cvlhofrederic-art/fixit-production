'use client'

// ── Logo d'un cabinet client (fenêtre de la vue « Cabinets », super admin) ───────────────────────────────────────────
//
// Demande de Hugo du 13/11/2026 : « pouvoir ajouter le logo au cabinet et aux PDF ». BROUILLON pour Frédéric : composants
// et couleurs de l'espace (Bouton, Champ, Encadre), aucune nouvelle charte.
//   - logo actuel, lu par sa route publique versionnée (cheminLogoCabinetQr), ou « Aucun logo » ;
//   - fichier SVG, PNG, JPEG ou WebP converti en PNG SUR L'APPAREIL (convertirLogoQr : canvas, 800 × 400 px et 200 Ko au
//     plus, fond transparent conservé ; un SVG chargé comme image n'exécute aucun script), aperçu, puis « Enregistrer ce
//     logo » : seul le PNG part (PUT …/logo), jamais le fichier choisi ;
//   - « Retirer le logo » après confirmation (DELETE …/logo) ;
//   - refus de la conversion ou du serveur : message, fenêtre ouverte.
// Focus (règle § 7.6 « Tab piégé », relecture de conformité du 13/11/2026) : quand le bouton activé disparaît, le focus
// reste dans la fenêtre — « Retirer le logo » → la question de confirmation ; « Annuler » → « Retirer le logo » ;
// retrait refusé → le message d'erreur. Il tombait sur <body>, et Tab partait dans le fond de la page.

import { useEffect, useId, useRef, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import { envoyerLogoCabinetQr, retirerLogoCabinetQr } from '@/lib/aj-signalement/api'
import { cheminLogoCabinetQr } from '@/lib/aj-signalement/logo'
import { ACCEPT_LOGO_QR } from '@/lib/aj-signalement/logo-conversion'
import { convertirLogoQr } from '@/lib/aj-signalement/logo-navigateur'
import type { CabinetQr } from '@/lib/aj-signalement/types'

export interface PropsLogoCabinetQr {
  cabinet: CabinetQr
  onFermer: () => void
  /** Logo enregistré ou retiré : message à montrer ; l'espace recharge les cabinets. */
  onEnregistre: (message: string) => void
}

interface LogoConverti {
  png: Uint8Array<ArrayBuffer>
  largeur: number
  hauteur: number
  /** Adresse blob de l'aperçu (libérée quand il change ou à la fermeture). */
  url: string
}

type Occupation = 'conversion' | 'envoi' | 'retrait' | null
/** Où poser le focus au rendu qui suit l'ouverture ou la fermeture de la confirmation du retrait. */
type CibleFocus = 'confirmation' | 'retirer' | 'erreur'

const L = G.cabinets.logo

export default function LogoCabinetQr({ cabinet, onFermer, onEnregistre }: Readonly<PropsLogoCabinetQr>) {
  const idBase = useId()
  const [converti, setConverti] = useState<LogoConverti | null>(null)
  const [occupe, setOccupe] = useState<Occupation>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmerRetrait, setConfirmerRetrait] = useState(false)
  const focusApres = useRef<CibleFocus | null>(null)
  const zoneConfirmation = useRef<HTMLDivElement>(null)
  const zoneErreur = useRef<HTMLDivElement>(null)
  const idRetirer = `${idBase}-retirer`

  useEffect(() => () => { if (converti) URL.revokeObjectURL(converti.url) }, [converti])

  // Seuls les gestes qui font disparaître le bouton activé demandent un focus (un fichier choisi pendant la
  // confirmation la ferme sans rien déplacer : le focus est déjà sur le champ).
  useEffect(() => {
    const cible = focusApres.current
    if (!cible) return
    focusApres.current = null
    if (cible === 'confirmation') zoneConfirmation.current?.focus()
    else if (cible === 'erreur') zoneErreur.current?.focus()
    else document.getElementById(idRetirer)?.focus()
  }, [confirmerRetrait, erreur, idRetirer])

  const choisir = async (fichier: File | undefined) => {
    if (!fichier || occupe) return
    setErreur(null)
    setConfirmerRetrait(false)
    setConverti(null)
    setOccupe('conversion')
    let r: Awaited<ReturnType<typeof convertirLogoQr>>
    try {
      r = await convertirLogoQr(fichier)
    } catch (e) {
      // Défense en profondeur (convertirLogoQr rend ses refus sans lever) : message dans la fenêtre, champ réactivé.
      console.warn('[aj-signalement] logo non préparé', e instanceof Error ? e.name : 'inconnue')
      r = { ok: false, raison: 'navigateur' }
    } finally {
      setOccupe(null)
    }
    if (!r.ok) return setErreur(L.erreurs[r.raison])
    setConverti({ png: r.png, largeur: r.largeur, hauteur: r.hauteur, url: URL.createObjectURL(new Blob([r.png], { type: 'image/png' })) })
  }

  const envoyer = async () => {
    if (!converti || occupe) return
    setOccupe('envoi')
    setErreur(null)
    const r = await envoyerLogoCabinetQr(cabinet.id, converti.png)
    setOccupe(null)
    if (!r.ok) return setErreur(messageEchecQr(r.code))
    onEnregistre(r.modifie ? L.enregistre : L.inchange)
  }

  const retirer = async () => {
    if (occupe) return
    setOccupe('retrait')
    setErreur(null)
    const r = await retirerLogoCabinetQr(cabinet.id)
    setOccupe(null)
    if (!r.ok) focusApres.current = 'erreur'
    setConfirmerRetrait(false)
    if (!r.ok) return setErreur(messageEchecQr(r.code))
    onEnregistre(L.retire)
  }

  const libre = occupe === null

  return (
    <div className="space-y-4" aria-busy={!libre}>
      <p className="text-base text-[#1F2D3D]">{L.intro}</p>

      <div>
        <p className="text-sm font-semibold text-[#4A5E78]">{L.actuel}</p>
        {cabinet.logo ? (
          <div className="mt-2 flex flex-col items-start gap-2">
            <div className="rounded-xl border border-[#E4DDD0] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- image de la route publique du logo, versionnée : aucune optimisation à faire */}
              <img
                src={cheminLogoCabinetQr(cabinet.identifiant, cabinet.logo.version)} alt={remplir(L.altActuel, { cabinet: cabinet.nom })}
                className="block h-auto max-h-24 w-auto max-w-full object-contain"
              />
            </div>
            <p className="text-sm text-[#4A5E78]">{remplir(L.dimensions, { largeur: cabinet.logo.largeur, hauteur: cabinet.logo.hauteur })}</p>
          </div>
        ) : <p className="mt-1 text-base text-[#4A5E78]">{L.aucun}</p>}
      </div>

      <Champ id={`${idBase}-fichier`} etiquette={L.fichier} aide={L.fichierAide}>
        <input
          id={`${idBase}-fichier`} type="file" accept={ACCEPT_LOGO_QR} disabled={!libre} aria-describedby={`${idBase}-fichier-aide`}
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            e.target.value = ''
            void choisir(fichier)
          }}
          className={CLASSES_SAISIE}
        />
      </Champ>

      {occupe === 'conversion' && <p role="status" className="text-base text-[#4A5E78]">{L.conversion}</p>}
      {converti && (
        <div>
          <p className="text-sm font-semibold text-[#4A5E78]">{L.apercu}</p>
          <div className="mt-2 flex flex-col items-start gap-2">
            <div className="rounded-xl border border-[#E4DDD0] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (adresse blob) du PNG préparé sur l'appareil */}
              <img src={converti.url} alt={remplir(L.altApercu, { cabinet: cabinet.nom })} className="block h-auto max-h-24 w-auto max-w-full object-contain" />
            </div>
            <p className="text-sm text-[#4A5E78]">
              {remplir(L.apercuDetail, { largeur: converti.largeur, hauteur: converti.hauteur, poids: Math.max(1, Math.round(converti.png.length / 1024)) })}
            </p>
          </div>
        </div>
      )}

      {erreur && <div ref={zoneErreur} tabIndex={-1} className="outline-none"><Encadre ton="erreur">{erreur}</Encadre></div>}

      {confirmerRetrait ? (
        <div className="space-y-3">
          <div ref={zoneConfirmation} tabIndex={-1} className="outline-none"><Encadre ton="avertissement">{L.confirmerRetrait}</Encadre></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Bouton variante="danger" disabled={!libre} className="flex-1" onClick={() => { void retirer() }}>
              {occupe === 'retrait' ? L.retrait : L.confirmerRetraitBouton}
            </Bouton>
            <Bouton
              variante="secondaire" disabled={!libre} className="flex-1"
              onClick={() => { focusApres.current = 'retirer'; setConfirmerRetrait(false) }}
            >{G.annuler}</Bouton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bouton variante="principal" disabled={!converti || !libre} className="flex-1" onClick={() => { void envoyer() }}>
            {occupe === 'envoi' ? L.envoi : L.envoyer}
          </Bouton>
          {cabinet.logo && (
            <Bouton
              id={idRetirer} variante="danger" disabled={!libre} className="flex-1"
              onClick={() => { focusApres.current = 'confirmation'; setErreur(null); setConfirmerRetrait(true) }}
            >{L.retirer}</Bouton>
          )}
          <Bouton variante="secondaire" disabled={occupe === 'envoi' || occupe === 'retrait'} className="flex-1" onClick={onFermer}>{G.annuler}</Bouton>
        </div>
      )}
    </div>
  )
}
