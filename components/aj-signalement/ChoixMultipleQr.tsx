'use client'

// ── Choix multiple avec recherche (copropriétés, gestionnaires) ──────────────────────────────────────────────────
//
// SPEC § 1.8 : pensé pour ≈ 150 lignes. Cases à cocher natives dans une liste qui défile, champ de recherche au-delà de
// 8 lignes (accents et casse ignorés), nombre de lignes choisies. Socle visuel de l'espace (bordure, or, 44 px).

import { useId, useState } from 'react'
import { remplir } from '@/lib/coproprietaire/textes'
import { CLASSES_SAISIE } from '@/components/coproprietaire-dashboard/ui'
import { TEXTES_GESTION_QR as G } from '@/lib/aj-signalement/affichage-gestion'
import type { CoproprieteQr, GestionnaireResumeQr } from '@/lib/aj-signalement/types'

interface OptionChoix {
  id: string
  libelle: string
  detail?: string
}

interface PropsChoix {
  legende: string
  selection: readonly string[]
  onChange: (ids: string[]) => void
  /** Texte quand il n'y a rien à choisir. */
  vide?: string
}

const SEUIL_RECHERCHE = 8
const cle = (texte: string): string => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function ChoixMultipleQr({ legende, options, selection, onChange, vide }: Readonly<PropsChoix & { options: readonly OptionChoix[] }>) {
  const idBase = useId()
  const [recherche, setRecherche] = useState('')
  const choisis = new Set(selection)
  const motif = cle(recherche.trim())
  const visibles = motif ? options.filter((o) => cle(`${o.libelle} ${o.detail ?? ''}`).includes(motif)) : options
  const basculer = (id: string, coche: boolean) => onChange(coche ? [...selection.filter((x) => x !== id), id] : selection.filter((x) => x !== id))

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-base font-semibold text-[#0D1B2E]">{legende}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-[#4A5E78]">{vide ?? G.choix.aucun}</p>
      ) : (
        <>
          {options.length > SEUIL_RECHERCHE && (
            <input
              type="search" id={`${idBase}-recherche`} value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder={G.choix.rechercher} aria-label={`${G.choix.rechercher} : ${legende}`} className={CLASSES_SAISIE}
            />
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-[#E4DDD0] bg-white p-2">
            {visibles.map((o) => (
              <li key={o.id}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-base text-[#0D1B2E] hover:bg-[#F7F4EE]">
                  <input
                    type="checkbox" checked={choisis.has(o.id)} onChange={(e) => basculer(o.id, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[#C9A84C]"
                  />
                  <span className="min-w-0">
                    <span className="block">{o.libelle}</span>
                    {o.detail && <span className="block text-sm text-[#4A5E78]">{o.detail}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-[#4A5E78]">{remplir(G.choix.selection, { n: selection.length })}</p>
        </>
      )}
    </fieldset>
  )
}

/** Copropriétés à choisir (nom ; code postal et ville en détail). */
export function ChoixCoproprietesQr({ coproprietes, ...props }: Readonly<PropsChoix & { coproprietes: readonly CoproprieteQr[] }>) {
  const options = coproprietes.map((c) => ({ id: c.id, libelle: c.nom, detail: `${c.codePostal} ${c.ville}`.trim() || undefined }))
  return <ChoixMultipleQr {...props} options={options} />
}

/** Gestionnaires à choisir (nom ; adresse en détail). Fiche effacée : « Ancien gestionnaire ». */
export function ChoixGestionnairesQr({ gestionnaires, ...props }: Readonly<PropsChoix & { gestionnaires: ReadonlyArray<GestionnaireResumeQr & { email?: string | null }> }>) {
  const options = gestionnaires.map((g) => ({ id: g.id, libelle: g.nom ?? G.fiche.ancien, detail: g.email ?? undefined }))
  return <ChoixMultipleQr {...props} options={options} />
}
