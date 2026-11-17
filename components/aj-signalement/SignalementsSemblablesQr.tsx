'use client'

// ── Signalements déjà faits au même endroit : liste et choix « même problème / autre problème » ──
//
// Demande de Hugo du 06/11/2026. Montré sous la zone des parties communes quand le serveur en a trouvé (au plus 5,
// du plus récent au plus ancien) : numéro, type, zone, date, statut, rien d'autre. Sur chaque ligne, « C'est le
// même problème » (bouton à bascule, aria-pressed) ; sous la liste, « C'est un autre problème ». Le choix est résumé
// dans une région annoncée aux lecteurs d'écran et n'empêche jamais l'envoi. Composants du socle UI seulement.
// L'apparition de la liste est annoncée par une région vivante invisible à l'écran, rendue en permanence, même sans
// liste : une région créée en même temps que son contenu n'est pas lue. La liste arrive après une pause de frappe
// et le réseau, souvent quand le focus est déjà sur le champ suivant.

import { useId } from 'react'
import { dateLongue, remplir } from '@/lib/coproprietaire/textes'
import type { LangueSignalementQr, SignalementSemblableQr } from '@/lib/aj-signalement/types'
import type { TextesSignalementQr } from '@/lib/aj-signalement/textes'
import { Bouton, Carte } from '@/components/coproprietaire-dashboard/ui'

export type ChoixSemblableQr = { type: 'meme'; numero: string } | { type: 'autre' } | null

export interface PropsSignalementsSemblablesQr {
  semblables: readonly SignalementSemblableQr[]
  choix: ChoixSemblableQr
  onChoisir: (choix: ChoixSemblableQr) => void
  langue: LangueSignalementQr
  tq: TextesSignalementQr
}

function resumeChoix(choix: ChoixSemblableQr, tq: TextesSignalementQr): string {
  if (choix?.type === 'meme') return remplir(tq.rattacheA, { numero: choix.numero })
  if (choix?.type === 'autre') return tq.nouveauProbleme
  return ''
}

/** Annonce de la liste : '' sans liste (la région est vidée), sinon le nombre de signalements déjà faits ici. */
function annonceSemblables(nombre: number, tq: TextesSignalementQr): string {
  if (nombre <= 0) return ''
  return nombre === 1 ? tq.semblablesAnnonceUn : remplir(tq.semblablesAnnonce, { n: nombre })
}

export default function SignalementsSemblablesQr({ semblables, choix, onChoisir, langue, tq }: Readonly<PropsSignalementsSemblablesQr>) {
  const idBase = useId()
  const autre = choix?.type === 'autre'

  return (
    <>
      <p aria-live="polite" aria-atomic="true" className="sr-only">{annonceSemblables(semblables.length, tq)}</p>
      {semblables.length > 0 && (
        <Carte ton="ambre" titre={tq.semblablesTitre} sousTitre={tq.semblablesAide}>
          <ul aria-label={tq.semblablesTitre} className="space-y-2">
            {semblables.map((s) => {
              const id = `${idBase}-${s.numero}`
              const meme = choix?.type === 'meme' && choix.numero === s.numero
              return (
                <li key={s.numero} className="flex flex-col gap-2 rounded-xl border border-[#E4DDD0] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div id={id} className="min-w-0">
                    <p className="text-base text-[#0D1B2E]">
                      <span className="font-semibold">{remplir(tq.semblableNumero, { numero: s.numero })}</span>
                      {' · '}
                      {s.typeIntervention}
                    </p>
                    <p className="text-sm text-[#4A5E78]">
                      {s.zone} · {dateLongue(s.creeLe, langue)} · {tq.statutsSemblables[s.statut]}
                    </p>
                  </div>
                  <Bouton
                    variante={meme ? 'or' : 'secondaire'}
                    petit
                    aria-pressed={meme}
                    aria-describedby={id}
                    onClick={() => onChoisir({ type: 'meme', numero: s.numero })}
                  >
                    {tq.memeProbleme}
                  </Bouton>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            <Bouton variante={autre ? 'or' : 'secondaire'} petit aria-pressed={autre} onClick={() => onChoisir({ type: 'autre' })}>
              {tq.autreProbleme}
            </Bouton>
          </div>
          <p aria-live="polite" className="mt-3 text-sm text-[#0D1B2E]">{resumeChoix(choix, tq)}</p>
        </Carte>
      )}
    </>
  )
}
