'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Liens frais vers les documents du compte connecté, rangés dans le seau privé (Conformité, Références).
// La valeur gardée au dépôt est un lien signé qui cesse de s'ouvrir au bout de 7 jours : POST /api/stockage/liens en
// retrouve le chemin et rend un lien frais de 7 jours. La valeur enregistrée n'est jamais réécrite ; tant qu'aucun lien
// frais n'est arrivé (ou si la demande échoue), c'est elle qui sert, comme avant.

const MAX_VALEURS = 100 // limite de la route

/** Table valeur enregistrée → lien frais ; une valeur sans lien frais n'y figure pas. */
export async function demanderLiensFrais(valeurs: readonly string[]): Promise<Record<string, string>> {
  const uniques = [...new Set(valeurs.filter(Boolean))].slice(0, MAX_VALEURS)
  if (uniques.length === 0) return {}
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  const res = await fetch('/api/stockage/liens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ valeurs: uniques }),
  })
  if (!res.ok) throw new Error(`liens frais indisponibles (HTTP ${res.status})`)
  const { liens } = (await res.json()) as { liens?: Array<string | null> }
  const table: Record<string, string> = {}
  uniques.forEach((valeur, i) => {
    const lien = liens?.[i]
    if (typeof lien === 'string' && lien) table[valeur] = lien
  })
  return table
}

/**
 * `actif` faux (rôle autre que société BTP) : aucune demande, chaque valeur est rendue telle quelle.
 * Sinon, demande les liens frais des valeurs reçues et rend, pour une valeur, son lien frais s'il est arrivé.
 */
export function useLiensFrais(
  actif: boolean,
  valeurs: ReadonlyArray<string | null | undefined>,
): (valeur: string | undefined) => string | undefined {
  const [liens, setLiens] = useState<Record<string, string>>({})
  const cle = actif ? valeurs.filter((v): v is string => !!v).join('\n') : ''

  useEffect(() => {
    if (!cle) return
    let annule = false
    demanderLiensFrais(cle.split('\n'))
      .then((table) => {
        if (!annule) setLiens((avant) => ({ ...avant, ...table }))
      })
      .catch((erreur: unknown) => {
        console.warn('[liens-frais] liens frais indisponibles, liens enregistrés gardés', erreur)
      })
    return () => { annule = true }
  }, [cle])

  return (valeur) => (actif && valeur ? liens[valeur] ?? valeur : valeur)
}
