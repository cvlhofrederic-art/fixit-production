'use client'

// ── CRM du secrétariat : liste des demandes, par onglet de statut ───────────

import { estEnRetard } from '@/lib/crm/compteurs'
import { formaterAnciennete, formaterDateHeure, type TextesCrm } from '@/lib/crm/libelles'
import { formaterTelephone } from '@/lib/crm/telephone'
import { STATUTS_CRM, type DemandeCrm, type LangueCrm, type StatutCrm } from '@/lib/crm/types'
import { Etiquette, IconeCanal } from './elements'

export type OngletCrm = StatutCrm | 'toutes'
export const ONGLETS_CRM: readonly OngletCrm[] = [...STATUTS_CRM, 'toutes']

function EtiquetteDemande({ demande, textes }: Readonly<{ demande: DemandeCrm; textes: TextesCrm }>) {
  if (demande.priorite === 'urgente') return <Etiquette ton="danger">{textes.priorites.urgente}</Etiquette>
  return <Etiquette ton={demande.motif === 'devis' ? 'info' : 'neutre'}>{textes.motifs[demande.motif]}</Etiquette>
}

function EtiquetteRappel({ demande, textes, langue, maintenant }: Readonly<{ demande: DemandeCrm; textes: TextesCrm; langue: LangueCrm; maintenant: Date }>) {
  if (!demande.rappel_le || demande.statut === 'resolue') return null
  if (estEnRetard(demande, maintenant)) return <Etiquette ton="danger">{`${textes.enRetard} · ${formaterDateHeure(demande.rappel_le, langue)}`}</Etiquette>
  return <Etiquette ton="attente">{`${textes.rappel} ${formaterDateHeure(demande.rappel_le, langue)}`}</Etiquette>
}

export function ListeDemandes({
  demandes,
  onglet,
  nombres,
  textes,
  langue,
  maintenant,
  selection,
  tronquee,
  onOnglet,
  onChoisir,
}: Readonly<{
  demandes: DemandeCrm[]
  onglet: OngletCrm
  nombres: Record<OngletCrm, number>
  textes: TextesCrm
  langue: LangueCrm
  maintenant: Date
  selection: string | null
  tronquee: boolean
  onOnglet: (o: OngletCrm) => void
  onChoisir: (id: string) => void
}>) {
  return (
    <div className="overflow-hidden rounded-xl border border-v22-border bg-white">
      <div role="group" aria-label={textes.detail.statut} className="flex gap-1 overflow-x-auto border-b border-v22-border px-2 py-2">
        {ONGLETS_CRM.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={onglet === o}
            onClick={() => onOnglet(o)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm ${onglet === o ? 'bg-yellow font-semibold text-dark' : 'text-gray-600 hover:bg-warm-gray'}`}
          >
            {textes.onglets[o]} <span className="opacity-70">{nombres[o]}</span>
          </button>
        ))}
      </div>
      {demandes.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-500">{textes.listeVide}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {demandes.map((d) => {
            const qui = d.contact?.nom || formaterTelephone(d.contact?.telephone) || textes.sansContact
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onChoisir(d.id)}
                  aria-current={selection === d.id ? 'true' : undefined}
                  className={`block w-full px-4 py-3 text-left ${selection === d.id ? 'bg-v22-yellow-light shadow-[inset_4px_0_0_var(--v22-yellow)]' : 'hover:bg-warm-gray'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium text-dark">{d.titre}</span>
                    <EtiquetteDemande demande={d} textes={textes} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <IconeCanal canal={d.canal} />
                      {textes.canaux[d.canal]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 truncate">{qui}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formaterAnciennete(d.created_at, langue, maintenant)}</span>
                    <EtiquetteRappel demande={d} textes={textes} langue={langue} maintenant={maintenant} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {tronquee && <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{textes.listeTronquee}</p>}
    </div>
  )
}
