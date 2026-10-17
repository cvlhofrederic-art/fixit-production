'use client'

// ── Annonces du syndic ────────────────────────────────────────────────────────
//
// Épinglées d'abord, puis les plus récentes. Chaque annonce est une carte complète,
// jamais tronquée (sauts de ligne respectés). Aucune action n'est obligatoire : un bouton
// discret permet seulement de marquer une annonce comme déjà vue (préférence d'affichage,
// CLES_PREFERENCES.annoncesLues, jamais une donnée servie) pour la griser.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { AnnonceCopro } from '@/lib/coproprietaire/types'
import { dateLongue, libelleCategorieAnnonce, remplir, type LangueCopro } from '@/lib/coproprietaire/textes'
import { CLES_PREFERENCES, type PropsEcran } from '@/components/coproprietaire-dashboard/contrat'
import { Badge, Bouton, Carte, EtatVide } from '@/components/coproprietaire-dashboard/ui'

/** Libellés propres à cet écran (préférence facultative), FR / PT. */
const LIBELLES_LOCAUX: Record<LangueCopro, { dejaVue: string; marquerVue: string; marquerNonVue: string }> = {
  fr: { dejaVue: 'Déjà vue', marquerVue: 'Marquer comme vue', marquerNonVue: 'Marquer comme non vue' },
  pt: { dejaVue: 'Já visto', marquerVue: 'Marcar como visto', marquerNonVue: 'Marcar como não visto' },
}

// ── Préférence « annonces déjà vues » (localStorage, toujours sous try/catch) ─

const CLE = CLES_PREFERENCES.annoncesLues
const ecouteurs = new Set<() => void>()
/** Dernière valeur écrite, pour que le bouton fonctionne même si le navigateur refuse localStorage. */
let memoire = ''

function abonner(cb: () => void): () => void {
  ecouteurs.add(cb)
  return () => { ecouteurs.delete(cb) }
}

function lirePreference(): string {
  try {
    return localStorage.getItem(CLE) ?? memoire
  } catch {
    return memoire
  }
}

function ecrirePreference(valeur: string): void {
  memoire = valeur
  try {
    localStorage.setItem(CLE, valeur)
  } catch (e) {
    console.warn('[copro] préférence « annonces vues » non mémorisée', e)
  }
  ecouteurs.forEach(cb => cb())
}

function idsDepuis(brut: string): Set<string> {
  if (!brut) return new Set()
  try {
    const liste: unknown = JSON.parse(brut)
    return new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function useAnnoncesVues(): { vues: Set<string>; basculer: (id: string) => void } {
  const brut = useSyncExternalStore(abonner, lirePreference, () => '')
  const vues = useMemo(() => idsDepuis(brut), [brut])
  const basculer = useCallback((id: string) => {
    const suivant = new Set(idsDepuis(lirePreference()))
    if (suivant.has(id)) suivant.delete(id)
    else suivant.add(id)
    ecrirePreference(JSON.stringify([...suivant]))
  }, [])
  return { vues, basculer }
}

// ── Tri : épinglées d'abord, puis les plus récentes ──────────────────────────

export function trierAnnonces(annonces: AnnonceCopro[]): AnnonceCopro[] {
  return [...annonces].sort((a, b) => {
    if (a.epinglee !== b.epinglee) return a.epinglee ? -1 : 1
    return b.date.localeCompare(a.date)
  })
}

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function EcranAnnonces({ espace, t, langue }: PropsEcran) {
  const { vues, basculer } = useAnnoncesVues()
  const annonces = useMemo(() => trierAnnonces(espace.annonces), [espace.annonces])
  const local = LIBELLES_LOCAUX[langue]

  if (annonces.length === 0) {
    return <EtatVide texte={t.annonces.aucune} icone="annonces" />
  }

  return (
    <div className="space-y-4">
      {annonces.map(a => {
        const vue = vues.has(a.id)
        return (
          <Carte key={a.id} ton={vue ? 'gris' : 'neutre'} className={vue ? 'text-[#4A5E78]' : ''}>
            <article aria-label={a.titre}>
              <div className="flex flex-wrap items-center gap-2">
                {a.epinglee && <Badge ton="or">{t.annonces.epinglee}</Badge>}
                {a.priorite === 'urgente' && <Badge ton="rouge">{t.annonces.urgent}</Badge>}
                {a.priorite === 'importante' && <Badge ton="ambre">{t.annonces.important}</Badge>}
                <Badge ton="gris">{libelleCategorieAnnonce(a.categorie, t)}</Badge>
                {vue && <Badge ton="gris">{local.dejaVue}</Badge>}
              </div>

              <h2 className={`mt-3 text-lg font-bold leading-snug ${vue ? 'text-[#4A5E78]' : 'text-[#0D1B2E]'}`}>{a.titre}</h2>

              <p className={`mt-2 whitespace-pre-line text-base leading-relaxed ${vue ? 'text-[#4A5E78]' : 'text-[#1F2D3D]'}`}>
                {a.contenu}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E4DDD0] pt-3">
                <div className="text-sm text-[#4A5E78]">
                  <p>{remplir(t.annonces.publieLe, { date: dateLongue(a.date, langue) })}</p>
                  {a.immeuble === '' && <p>{t.commun.tousImmeubles}</p>}
                </div>
                <Bouton variante="discret" petit icone={vue ? 'actualiser' : 'check'} aria-pressed={vue} onClick={() => basculer(a.id)}>
                  {vue ? local.marquerNonVue : local.marquerVue}
                </Bouton>
              </div>
            </article>
          </Carte>
        )
      })}
    </div>
  )
}
