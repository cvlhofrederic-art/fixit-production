'use client'

// ── Portail copropriétaire relié à l'Administrateur judiciaire (vue super admin) ─────────────────────────────────
//
// Le super admin choisit la source du portail : la base du syndic (comportement historique) ou l'Administrateur
// judiciaire (AJ). Avec l'AJ, l'espace affiché est celui d'un copropriétaire d'une copropriété de l'AJ
// (lib/coproprietaire/source-aj.ts, chargé à la demande), et les actions du portail arrivent dans l'AJ par la liaison
// du navigateur (lib/liaison-copro-aj). La copropriété choisie est partagée avec l'AJ (même clé que son sélecteur du
// haut de page) : choisir une copropriété ici la choisit dans l'AJ, et inversement, y compris d'un onglet à l'autre.
//
// Lien direct depuis l'AJ : /coproprietaire/dashboard?aj=<code>&personne=<id copropriétaire>.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { lireModeStocke, type Mode } from '@/lib/administrateur-judiciaire/mode'
import { maintenantLiaison } from '@/lib/liaison-copro-aj/horloge'
import { useLiaisonCoproAj } from '@/lib/liaison-copro-aj/hooks'
import { ajouterMessage, deposerDemande, effacerLiaison, enregistrerVote } from '@/lib/liaison-copro-aj/stockage'
import type { ActionsLiaisonAj } from '@/components/coproprietaire-dashboard/contrat'
import type { EspaceCopro } from '@/lib/coproprietaire/types'
import type { CoproAj } from '@/lib/coproprietaire/source-aj'

type ModuleSourceAj = typeof import('@/lib/coproprietaire/source-aj')

export type SourcePortail = 'syndic' | 'aj'

/** Source choisie par le super admin (« aj » ou « syndic »). */
export const CLE_SOURCE_PORTAIL = 'vitfix.liaison.copro-aj.source'
/** Copropriétaire affiché, par copropriété de l'AJ (JSON : paires [code, id]). */
export const CLE_PERSONNE_PORTAIL = 'vitfix.liaison.copro-aj.personne'
/** Copropriété choisie dans l'AJ (même clé que son sélecteur du haut de page, valeur JSON). */
export const CLE_COPRO_AJ = 'vitfix.aj.dossierEnCours'

/** Super admin d'après app_metadata (rôle posé par le serveur, non modifiable par le navigateur). */
export function estSuperAdmin(meta: Record<string, unknown> | null | undefined): boolean {
  return !!meta && (meta.role === 'super_admin' || meta._original_role === 'super_admin')
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle)
  } catch (e) {
    console.warn('[copro] stockage local inaccessible', e)
    return null
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur)
  } catch (e) {
    console.warn('[copro] choix non mémorisé', e)
  }
}

function lireJson<T>(cle: string, defaut: T): T {
  const brut = lire(cle)
  if (!brut) return defaut
  try {
    return JSON.parse(brut) as T
  } catch (e) {
    console.warn('[copro] valeur illisible ignorée', cle, e)
    return defaut
  }
}

const lireCodeAj = (): string | null => {
  const code = lireJson<unknown>(CLE_COPRO_AJ, null)
  return typeof code === 'string' && code ? code : null
}

/**
 * Copropriétaire mémorisé pour chaque copropriété. Une Map de paires, jamais un objet indexé : le code peut venir de
 * l'adresse (lien direct), il ne doit pas pouvoir nommer une propriété (« __proto__ »…).
 */
const lirePersonnes = (): Map<string, string> => {
  const brut = lireJson<unknown>(CLE_PERSONNE_PORTAIL, [])
  if (!Array.isArray(brut)) return new Map()
  const estPaire = (p: unknown): p is [string, string] => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string'
  return new Map(brut.filter(estPaire))
}

const memoriserPersonne = (code: string, id: string): void => {
  const personnes = lirePersonnes()
  personnes.set(code, id)
  ecrire(CLE_PERSONNE_PORTAIL, JSON.stringify([...personnes]))
}

/**
 * Lien direct depuis l'AJ (?aj=LM&personne=P1) : les paramètres sont lus une fois, mémorisés comme des choix faits dans
 * la barre (source, copropriété partagée avec l'AJ, copropriétaire), puis retirés de l'adresse. Un rechargement ou un
 * changement d'écran garde ainsi la vue reliée, et un choix fait ensuite dans la barre n'est pas écrasé par l'adresse.
 */
function consommerParametres(): { code: string | null; personne: string | null } {
  if (typeof window === 'undefined') return { code: null, personne: null }
  const url = new URL(window.location.href)
  const code = url.searchParams.get('aj')
  const personne = url.searchParams.get('personne')
  if (!code) return { code: null, personne: null }
  ecrire(CLE_SOURCE_PORTAIL, 'aj')
  ecrire(CLE_COPRO_AJ, JSON.stringify(code))
  if (personne) memoriserPersonne(code, personne)
  url.searchParams.delete('aj')
  url.searchParams.delete('personne')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return { code, personne }
}

export interface SourceAj {
  /** Super admin : la barre de source est proposée. */
  disponible: boolean
  source: SourcePortail
  choisirSource: (source: SourcePortail) => void
  /** Copropriétés de l'AJ ([] tant que le module n'est pas chargé). */
  copros: CoproAj[]
  code: string | null
  personneId: string | null
  choisirCopro: (code: string) => void
  choisirPersonne: (id: string) => void
  /** Espace du copropriétaire choisi (source « aj » seulement), null pendant le chargement. */
  espace: EspaceCopro | null
  actions: ActionsLiaisonAj | null
  /** Jour courant de l'AJ (date figée en démonstration). */
  aujourdhui: Date | null
  /** Mode de l'AJ dans ce navigateur : en « données réelles », le portail montre quand même sa démonstration. */
  modeAj: Mode
  /** Efface les échanges de démonstration (demandes, messages, votes, avis). */
  reinitialiser: () => void
}

export function useSourceAj(superAdmin: boolean): SourceAj {
  const [source, setSource] = useState<SourcePortail>('syndic')
  const [module, setModule] = useState<ModuleSourceAj | null>(null)
  const [choix, setChoix] = useState<{ code: string | null; personneId: string | null }>({ code: null, personneId: null })
  const [modeAj, setModeAj] = useState<Mode>('demo')
  const liaison = useLiaisonCoproAj()

  // Source, copropriété et copropriétaire de départ : lien direct depuis l'AJ, sinon derniers choix ; par défaut la base
  // du syndic (comportement historique du portail).
  useEffect(() => {
    if (!superAdmin) return
    const parametres = consommerParametres()
    const sourceMemorisee = lire(CLE_SOURCE_PORTAIL)
    // Choix lus après le premier rendu (stockage du navigateur) : l'état de départ reste celui du rendu serveur.
    setSource(parametres.code || sourceMemorisee === 'aj' ? 'aj' : 'syndic')
    const code = parametres.code ?? lireCodeAj()
    setChoix({ code, personneId: parametres.personne ?? (code ? lirePersonnes().get(code) ?? null : null) })
    setModeAj(lireModeStocke())
  }, [superAdmin])

  // Module de l'AJ chargé à la demande (jamais pour un compte qui n'est pas super admin).
  useEffect(() => {
    if (!superAdmin || source !== 'aj' || module) return
    let annule = false
    import('@/lib/coproprietaire/source-aj')
      .then((m) => { if (!annule) setModule(m) })
      .catch((e: unknown) => {
        // Module introuvable (déploiement en cours, réseau) : retour aux données du syndic plutôt qu'un chargement sans fin.
        console.warn('[copro] module de l’Administrateur judiciaire indisponible', e)
        if (!annule) setSource('syndic')
      })
    return () => { annule = true }
  }, [superAdmin, source, module])

  // L'AJ change de copropriété (autre onglet) : le portail suit.
  useEffect(() => {
    if (!superAdmin) return
    const surStockage = (e: StorageEvent) => {
      if (e.key !== CLE_COPRO_AJ) return
      const code = lireCodeAj()
      if (code) setChoix((c) => (c.code === code ? c : { code, personneId: lirePersonnes().get(code) ?? null }))
    }
    window.addEventListener('storage', surStockage)
    return () => window.removeEventListener('storage', surStockage)
  }, [superAdmin])

  const valide = useMemo(() => (module ? module.choixValide(choix.code, choix.personneId) : null), [module, choix])
  const copros = useMemo(() => (module ? module.listeCoprosAj() : []), [module])
  // Jour de l'AJ : sa date figée en démonstration, aujourd'hui en données réelles (null tant que le module manque).
  let dateDuJour: string | null = null
  if (module) dateDuJour = modeAj === 'demo' ? module.DATE_DU_JOUR_AJ_DEMO : new Date().toISOString().slice(0, 10)

  const espace = useMemo(() => {
    if (!superAdmin || source !== 'aj' || !module || !valide || !dateDuJour) return null
    return module.espaceDepuisAj(valide.code, valide.personneId, liaison, { dateDuJour })
  }, [superAdmin, source, module, valide, liaison, dateDuJour])

  const choisirSource = useCallback((s: SourcePortail) => {
    setSource(s)
    ecrire(CLE_SOURCE_PORTAIL, s)
  }, [])

  const choisirCopro = useCallback((code: string) => {
    setChoix({ code, personneId: lirePersonnes().get(code) ?? null })
    // Même clé que le sélecteur de l'AJ : un AJ ouvert dans un autre onglet suit ce choix.
    ecrire(CLE_COPRO_AJ, JSON.stringify(code))
  }, [])

  const choisirPersonne = useCallback((id: string) => {
    setChoix((c) => {
      if (c.code) memoriserPersonne(c.code, id)
      return { ...c, personneId: id }
    })
  }, [])

  const actions = useMemo((): ActionsLiaisonAj | null => {
    if (!espace || !module || !valide) return null
    const copro = copros.find((c) => c.code === valide.code)
    const personne = copro?.coproprietaires.find((p) => p.id === valide.personneId)
    if (!copro || !personne) return null
    const { batiment, etage, numLot } = espace.profil
    return {
      deposerDemande: (saisie) => {
        const demande = deposerDemande({
          ...saisie,
          codeCopro: copro.code,
          nomCopro: copro.nom,
          coproprietaireId: personne.id,
          nomCoproprietaire: personne.nom,
          lot: personne.lot,
        }, maintenantLiaison(modeAj))
        return module.demandeDepuisLiaison(demande, batiment, etage, numLot)
      },
      envoyerMessage: (demandeId, texte) => {
        const message = ajouterMessage(demandeId, { auteur: 'coproprietaire', nom: personne.nom, texte }, maintenantLiaison(modeAj))
        return message ? { id: message.id, auteur: message.nom, role: 'coproprio', texte: message.texte, date: message.date, deMoi: true } : null
      },
      voter: (resolutionId, choixVote) => {
        const resolution = module.decoderIdResolutionAj(resolutionId)
        if (!resolution) return null
        const vote = enregistrerVote({
          agId: resolution.agId,
          resolutionNumero: resolution.numero,
          codeCopro: copro.code,
          coproprietaireId: personne.id,
          nomCoproprietaire: personne.nom,
          choix: choixVote,
        }, maintenantLiaison(modeAj))
        return { choix: vote.choix, enregistreLe: vote.date }
      },
    }
  }, [espace, module, valide, copros, modeAj])

  return {
    disponible: superAdmin,
    source,
    choisirSource,
    copros,
    code: valide?.code ?? null,
    personneId: valide?.personneId ?? null,
    choisirCopro,
    choisirPersonne,
    espace,
    actions,
    aujourdhui: dateDuJour ? new Date(`${dateDuJour}T12:00:00`) : null,
    modeAj,
    reinitialiser: () => effacerLiaison(),
  }
}
