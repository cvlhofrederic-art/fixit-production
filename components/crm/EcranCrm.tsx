'use client'

// ── CRM du secrétariat : écran principal (/admin/crm) ───────────────────────
// Compteurs du jour, liste des demandes par statut, fiche « Appel en cours » ou détail d'une demande. Français ou
// portugais au choix (mémorisé sur ce navigateur). Sans session : page de connexion générale, qui ramène ici le compte
// « secretariat » (lib/auth/destination-par-role.ts). Les droits sont vérifiés par les routes app/api/crm/*.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { LogOut, PhoneIncoming, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { safeNavigate } from '@/lib/security/safe-url'
import { TEXTES_CRM } from '@/lib/crm/libelles'
import { compterParStatut, filtrerDemandes } from '@/lib/crm/filtres'
import type { CompteursCrm, DemandeCrm, LangueCrm } from '@/lib/crm/types'
import { ErreurApiCrm, apiCrm } from './api-crm'
import { DetailDemande } from './DetailDemande'
import { FicheAppel } from './FicheAppel'
import { ListeDemandes, type OngletCrm } from './ListeDemandes'
import { CLASSE_BOUTON_PRINCIPAL, CLASSE_CHAMP } from './elements'

const CLE_LANGUE = 'vitfix_crm_langue'
const RAFRAICHISSEMENT_MS = 60_000

type EtatEcran = 'chargement' | 'pret' | 'refuse' | 'erreur'

function langueMemorisee(): LangueCrm {
  try {
    const lue = window.localStorage.getItem(CLE_LANGUE)
    if (lue === 'fr' || lue === 'pt') return lue
  } catch (e: unknown) {
    console.warn('[crm] langue mémorisée illisible', e)
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'pt'
}

function memoriserLangue(langue: LangueCrm): void {
  try {
    window.localStorage.setItem(CLE_LANGUE, langue)
  } catch (e: unknown) {
    console.warn('[crm] langue non mémorisée', e)
  }
}

// Langue de l'écran : lue une fois sur ce navigateur, rendue en portugais côté serveur (useSyncExternalStore évite tout
// écart d'hydratation et tout setState dans un effet).
const abonnesLangue = new Set<() => void>()
let langueCourante: LangueCrm | null = null

function abonnerLangue(rappel: () => void): () => void {
  abonnesLangue.add(rappel)
  return () => {
    abonnesLangue.delete(rappel)
  }
}

function lireLangue(): LangueCrm {
  langueCourante ??= langueMemorisee()
  return langueCourante
}

function choisirLangue(langue: LangueCrm): void {
  langueCourante = langue
  memoriserLangue(langue)
  for (const rappel of abonnesLangue) rappel()
}

const LANGUE_SERVEUR: LangueCrm = 'pt'

function versConnexion(langue: LangueCrm): void {
  safeNavigate(`/${langue}/auth/login`, { allowRelative: true })
}

function Compteur({ libelle, valeur, alerte = false }: Readonly<{ libelle: string; valeur: number; alerte?: boolean }>) {
  return (
    <div className="rounded-xl bg-gray-100 px-3 py-2 sm:px-4 sm:py-3">
      <p className="text-xs text-gray-600 sm:text-sm">{libelle}</p>
      <p className={`text-xl font-semibold sm:text-2xl ${alerte && valeur > 0 ? 'text-red-700' : 'text-gray-900'}`}>{valeur}</p>
    </div>
  )
}

export default function EcranCrm() {
  const langue = useSyncExternalStore(abonnerLangue, lireLangue, () => LANGUE_SERVEUR)
  const [etat, setEtat] = useState<EtatEcran>('chargement')
  const [demandes, setDemandes] = useState<DemandeCrm[]>([])
  const [compteurs, setCompteurs] = useState<CompteursCrm>({ aTraiterAujourdhui: 0, enRetard: 0, resoluesSemaine: 0 })
  const [tronquee, setTronquee] = useState(false)
  const [onglet, setOnglet] = useState<OngletCrm>('nouvelle')
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<string | null>(null)
  const [signalNouvelAppel, setSignalNouvelAppel] = useState(0)
  const [maintenant, setMaintenant] = useState(() => new Date())
  const textes = TEXTES_CRM[langue]

  const charger = useCallback(async () => {
    try {
      const r = await apiCrm.listerDemandes()
      setDemandes(r.demandes)
      setCompteurs(r.compteurs)
      setTronquee(r.tronquee)
      setMaintenant(new Date())
      setEtat('pret')
    } catch (e: unknown) {
      if (e instanceof ErreurApiCrm && e.status === 401) return versConnexion(lireLangue())
      if (e instanceof ErreurApiCrm && e.status === 403) return setEtat('refuse')
      console.warn('[crm] liste des demandes', e)
      setEtat((precedent) => (precedent === 'pret' ? 'pret' : 'erreur'))
    }
  }, [])

  useEffect(() => {
    let actif = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!actif) return
        if (!data.session) return versConnexion(lireLangue())
        void charger()
      })
      .catch((e: unknown) => {
        console.warn('[crm] session illisible', e)
        if (actif) setEtat('erreur')
      })
    // Deux postes peuvent saisir en même temps (secrétariat et Frédéric) : relecture régulière et au retour sur l'onglet.
    const minuteur = setInterval(() => void charger(), RAFRAICHISSEMENT_MS)
    const auRetour = () => void charger()
    window.addEventListener('focus', auRetour)
    return () => {
      actif = false
      clearInterval(minuteur)
      window.removeEventListener('focus', auRetour)
    }
  }, [charger])

  async function deconnecter() {
    try {
      await supabase.auth.signOut()
    } catch (e: unknown) {
      toast.error(textes.erreurServeur)
      console.warn('[crm] déconnexion', e)
      return
    }
    versConnexion(langue)
  }

  const visibles = useMemo(() => filtrerDemandes(demandes, onglet, recherche), [demandes, onglet, recherche])
  const nombres = useMemo(() => compterParStatut(demandes, recherche), [demandes, recherche])

  function remplacer(demande: DemandeCrm) {
    setDemandes((liste) => [demande, ...liste.filter((d) => d.id !== demande.id)])
    void charger()
  }

  if (etat === 'refuse') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900">{textes.accesRefuse}</h1>
          <p className="mt-2 text-sm text-gray-600">{textes.accesRefuseDetail}</p>
          <button type="button" onClick={() => void deconnecter()} className={`${CLASSE_BOUTON_PRINCIPAL} mt-4`}>
            {textes.deconnexion}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold">{textes.titre}</h1>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={textes.recherche}
              aria-label={textes.recherche}
              className={`${CLASSE_CHAMP} pl-9`}
            />
          </div>
          <div role="group" aria-label="Langue / Língua" className="flex overflow-hidden rounded-lg border border-gray-300">
            {(['fr', 'pt'] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={langue === l}
                onClick={() => choisirLangue(l)}
                className={`px-2.5 py-1.5 text-sm uppercase ${langue === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelection(null)
              setSignalNouvelAppel((n) => n + 1)
            }}
            className={CLASSE_BOUTON_PRINCIPAL}
          >
            <PhoneIncoming className="h-4 w-4" aria-hidden="true" />
            {textes.nouvelAppel}
          </button>
          <button type="button" onClick={() => void deconnecter()} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label={textes.deconnexion} title={textes.deconnexion}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {etat === 'chargement' && <p className="text-sm text-gray-500">{textes.chargement}</p>}
        {etat === 'erreur' && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{textes.erreurChargement}</span>
            <button type="button" onClick={() => void charger()} className="underline underline-offset-2">
              {textes.reessayer}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Compteur libelle={textes.compteurs.aTraiter} valeur={compteurs.aTraiterAujourdhui} />
          <Compteur libelle={textes.compteurs.enRetard} valeur={compteurs.enRetard} alerte />
          <Compteur libelle={textes.compteurs.resolues} valeur={compteurs.resoluesSemaine} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="order-2 lg:order-1">
            <ListeDemandes
              demandes={visibles}
              onglet={onglet}
              nombres={nombres}
              textes={textes}
              langue={langue}
              maintenant={maintenant}
              selection={selection}
              tronquee={tronquee}
              onOnglet={setOnglet}
              onChoisir={setSelection}
            />
          </div>
          <aside className="order-1 rounded-xl border border-gray-200 bg-white p-4 lg:order-2 lg:sticky lg:top-4 lg:self-start">
            {selection && (
              <DetailDemande key={selection} id={selection} textes={textes} langue={langue} onFermer={() => setSelection(null)} onModifiee={remplacer} />
            )}
            {/* Toujours montée : un appel en cours de saisie survit à la consultation d'une autre demande. */}
            <div hidden={selection !== null}>
              <FicheAppel
                textes={textes}
                signalNouvelAppel={signalNouvelAppel}
                onCreee={(d) => {
                  remplacer(d)
                  setOnglet('nouvelle')
                  setSelection(d.id)
                }}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
