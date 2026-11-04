'use client'

// ── Barre du super admin : source du portail et copropriété affichée ─────────────────────────────────────────────
//
// En haut de tous les écrans du portail, pour le super admin seulement : il choisit les données affichées (base du
// syndic, ou Administrateur judiciaire), puis, avec l'AJ, la copropriété (liste déroulante, partagée avec le sélecteur
// du haut de page de l'AJ) et le copropriétaire dont il voit l'espace. Textes en français : la vue super admin et
// l'Administrateur judiciaire sont des outils français.

import { useId } from 'react'
import { Icone } from '@/components/coproprietaire-dashboard/ui'
import type { SourceAj, SourcePortail } from '@/lib/coproprietaire/liaison-aj'

const URL_AJ = '/fr/administrateur-judiciaire/'

const euros = (n: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const CLASSES_LISTE =
  'min-h-[44px] w-full rounded-xl border-2 border-[#E4DDD0] bg-white px-3 text-base text-[#0D1B2E] focus:border-[#C9A84C] focus:outline-none sm:w-auto sm:max-w-[320px]'

function BoutonSource({ valeur, courante, libelle, onChoisir }: Readonly<{ valeur: SourcePortail; courante: SourcePortail; libelle: string; onChoisir: (s: SourcePortail) => void }>) {
  const actif = valeur === courante
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={() => onChoisir(valeur)}
      className={`min-h-[40px] rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C] ${
        actif ? 'bg-[#0D1B2E] text-white' : 'text-[#0D1B2E] hover:bg-[#F7F4EE]'
      }`}
    >
      {libelle}
    </button>
  )
}

export default function BarreLiaisonAj({ aj }: Readonly<{ aj: SourceAj }>) {
  const id = useId()
  if (!aj.disponible) return null
  const copro = aj.copros.find((c) => c.code === aj.code) ?? null

  return (
    <section aria-label="Vue super admin : données du portail" className="border-b border-[#E4DDD0] bg-white px-4 py-3 md:px-9">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[1px] text-[#6F5313]">
          <Icone nom="cadenas" taille={18} />
          <span>Vue super admin</span>
        </div>

        <div role="group" aria-label="Données affichées" className="flex gap-1 rounded-xl border border-[#E4DDD0] bg-white p-1">
          <BoutonSource valeur="aj" courante={aj.source} libelle="Administrateur judiciaire" onChoisir={aj.choisirSource} />
          <BoutonSource valeur="syndic" courante={aj.source} libelle="Syndic" onChoisir={aj.choisirSource} />
        </div>

        {aj.source === 'aj' && (
          <>
            <label htmlFor={`${id}-copro`} className="flex w-full flex-col gap-1 text-sm text-[#4A5E78] sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium">Copropriété</span>
              <select
                id={`${id}-copro`}
                value={aj.code ?? ''}
                disabled={aj.copros.length === 0}
                onChange={(e) => aj.choisirCopro(e.target.value)}
                className={CLASSES_LISTE}
              >
                {aj.copros.length === 0 && <option value="">Chargement…</option>}
                {aj.copros.map((c) => (
                  <option key={c.code} value={c.code}>{c.nom} ({c.code})</option>
                ))}
              </select>
            </label>

            <label htmlFor={`${id}-personne`} className="flex w-full flex-col gap-1 text-sm text-[#4A5E78] sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium">Copropriétaire</span>
              <select
                id={`${id}-personne`}
                value={aj.personneId ?? ''}
                disabled={!copro}
                onChange={(e) => aj.choisirPersonne(e.target.value)}
                className={CLASSES_LISTE}
              >
                {copro?.coproprietaires.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} · {p.lot}{p.solde < 0 ? ` · doit ${euros(-p.solde)}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={URL_AJ}
                target="_blank"
                rel="noopener"
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#0D1B2E] underline-offset-4 hover:bg-[#F7F4EE] hover:underline"
              >
                <Icone nom="ouvrir" taille={16} />
                <span>Ouvrir l’Administrateur judiciaire</span>
              </a>
              <button
                type="button"
                onClick={aj.reinitialiser}
                className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[#4A5E78] hover:bg-[#F7F4EE] hover:text-[#0D1B2E]"
              >
                <Icone nom="actualiser" taille={16} />
                <span>Effacer les échanges de démonstration</span>
              </button>
            </div>
          </>
        )}
      </div>

      {aj.source === 'aj' && copro && (
        <p className="mt-2 text-sm text-[#4A5E78]">
          {copro.adresse} · {copro.fondement}. Les demandes, messages et votes faits ici arrivent dans l’Administrateur judiciaire ouvert dans ce navigateur ; ses réponses et ses avis reviennent ici.
        </p>
      )}
      {aj.source === 'aj' && aj.modeAj === 'reel' && (
        <p className="mt-2 rounded-lg bg-[#FFF1D6] px-3 py-2 text-sm font-medium text-[#5C3A00]" role="status">
          L’Administrateur judiciaire de ce navigateur est en mode « données réelles » : ce portail montre son jeu de démonstration. Repassez l’AJ en démonstration pour que les deux correspondent.
        </p>
      )}
    </section>
  )
}
