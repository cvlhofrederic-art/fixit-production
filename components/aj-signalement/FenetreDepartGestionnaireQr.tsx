'use client'

// ── Fenêtre « Départ de <nom> » (SPEC § 1.8, RG-11) ──────────────────────────────────────────────────────────────
//
// Deux groupes : les copropriétés dont il est le seul gestionnaire — un successeur à choisir pour CHACUNE (fiche
// active du même cabinet, adresse non contestée), « le même pour toutes », ou « Laisser sans gestionnaire » — et celles
// où d'autres gestionnaires restent (simplement retirées). Une succession manquante bloque l'envoi ; le serveur
// revérifie tout (409 a_reverifier). Après le départ, la fiche est désactivée et son adresse retirée des saisies.
// Correctif du 13/11/2026 : départ fait, la fenêtre reste occupée (aucun nouvel envoi) jusqu'à la fiche et aux listes
// relues (onFait), qui la ferment.

import { useId, useMemo, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { Bouton, Champ, CLASSES_SAISIE, Encadre } from '@/components/coproprietaire-dashboard/ui'
import { messageEchecQr } from '@/components/aj-signalement/messageEchecQr'
import { departGestionnaireQr, type ResultatDepartQr } from '@/lib/aj-signalement/api'
import {
  SANS_GESTIONNAIRE_QR, TEXTES_GESTION_QR as G, gestionnairesAttribuablesQr, groupesDepartQr, successionsDepartQr,
} from '@/lib/aj-signalement/affichage-gestion'
import type { AttributionVueQr, CoproprieteQr, GestionnaireQr } from '@/lib/aj-signalement/types'

export interface PropsFenetreDepartGestionnaireQr {
  fiche: GestionnaireQr
  attributions: readonly AttributionVueQr[]
  /** Copropriétés du tableau (pour savoir qui d'autre les gère). */
  coproprietes: readonly CoproprieteQr[]
  gestionnaires: readonly GestionnaireQr[]
  onFermer: () => void
  /** Départ fait : tenue une fois la fiche et les listes relues (la fenêtre reste occupée jusque-là). */
  onFait: (bilan: Extract<ResultatDepartQr, { ok: true }>) => Promise<void>
}

export default function FenetreDepartGestionnaireQr({
  fiche, attributions, coproprietes, gestionnaires, onFermer, onFait,
}: Readonly<PropsFenetreDepartGestionnaireQr>) {
  const idBase = useId()
  const groupes = useMemo(() => groupesDepartQr(fiche.id, attributions, coproprietes), [fiche.id, attributions, coproprietes])
  const successeurs = gestionnairesAttribuablesQr(gestionnaires, fiche.cabinet.id, fiche.id)
  const [choix, setChoix] = useState<Record<string, string>>({})
  const [meme, setMeme] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const options = (
    <>
      <option value="">{G.depart.choisir}</option>
      <option value={SANS_GESTIONNAIRE_QR}>{G.depart.sansGestionnaire}</option>
      {successeurs.map((g) => <option key={g.id} value={g.id}>{g.nom ?? G.fiche.ancien}</option>)}
    </>
  )

  const confirmer = async () => {
    if (occupe) return
    const decision = successionsDepartQr(groupes, choix)
    if (!decision.ok) {
      const noms = groupes.seul.filter((a) => decision.manquantes.includes(a.coproprieteId)).map((a) => a.nom)
      return setErreur(remplir(G.depart.manquantes, { noms: noms.join(', ') }))
    }
    setErreur(null)
    setOccupe(true)
    const r = await departGestionnaireQr(fiche.id, decision.successions)
    if (!r.ok) {
      setOccupe(false)
      return setErreur(messageEchecQr(r.code))
    }
    await onFait(r)
    setOccupe(false)
  }

  return (
    <div className="space-y-5">
      {attributions.length === 0 && <p className="text-base text-[#1F2D3D]">{G.depart.aucune}</p>}

      {groupes.seul.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-[#0D1B2E]">{remplir(G.depart.seul, { n: groupes.seul.length })}</h3>
          {groupes.seul.length > 1 && (
            <Champ id={`${idBase}-meme`} etiquette={G.depart.memePourToutes}>
              <select
                id={`${idBase}-meme`} value={meme} className={CLASSES_SAISIE}
                onChange={(e) => {
                  setMeme(e.target.value)
                  setChoix(Object.fromEntries(groupes.seul.map((a) => [a.coproprieteId, e.target.value])))
                }}
              >
                {options}
              </select>
            </Champ>
          )}
          <ul className="space-y-3">
            {groupes.seul.map((a, i) => (
              <li key={a.coproprieteId}>
                <Champ id={`${idBase}-${i}`} etiquette={remplir(G.depart.successeur, { nom: a.nom })}>
                  <select
                    id={`${idBase}-${i}`} value={choix[a.coproprieteId] ?? ''} className={CLASSES_SAISIE}
                    onChange={(e) => setChoix((c) => ({ ...c, [a.coproprieteId]: e.target.value }))}
                  >
                    {options}
                  </select>
                </Champ>
              </li>
            ))}
          </ul>
          <Encadre ton="avertissement">{G.depart.avertissement}</Encadre>
        </section>
      )}

      {groupes.partages.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-base font-bold text-[#0D1B2E]">{remplir(G.depart.partages, { n: groupes.partages.length })}</h3>
          <p className="text-sm text-[#4A5E78]">{G.depart.partagesAide}</p>
          <ul className="list-disc space-y-1 pl-5 text-base text-[#1F2D3D]">
            {groupes.partages.map((a) => <li key={a.coproprieteId}>{a.nom}</li>)}
          </ul>
        </section>
      )}

      {erreur && <Encadre ton="erreur">{erreur}</Encadre>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Bouton variante="danger" disabled={occupe} className="flex-1" onClick={() => { void confirmer() }}>{G.depart.confirmer}</Bouton>
        <Bouton variante="secondaire" disabled={occupe} className="flex-1" onClick={onFermer}>{G.annuler}</Bouton>
      </div>
    </div>
  )
}
