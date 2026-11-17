/**
 * Catalogue de prestations et matériaux d'une société BTP (pro_societe), tenu par le module Prestations
 * (components/dashboard/PrestationsBTPSection.tsx) dans le navigateur, recopié sur le serveur par le miroir du
 * stockage (lib/storage-sync.ts, table user_storage). Le formulaire de devis et facture BTP
 * (components/DevisFactureFormBTP.tsx) le lit sans jamais l'écrire.
 *
 * Constats stockage-local-miroir-5 et -10 de l'audit du 11/11/2026 :
 *  - le formulaire lisait une ancienne copie (clé v4) qu'il remplissait lui-même du jeu par défaut ;
 *  - le module écrivait le jeu par défaut dès que sa clé manquait dans le navigateur, alors que la restauration
 *    depuis le serveur pouvait ne pas être encore arrivée (ou avoir échoué), puis réécrivait la clé depuis l'écran.
 * Aucune clé n'est supprimée, et l'effet de chargement n'écrit aucun catalogue (ni exemple, ni liste vide) : on lit au
 * bon endroit (navigateur, puis serveur) ; un compte qui n'a de catalogue ni dans ce navigateur ni au serveur commence
 * avec un catalogue vide (aucun jeu d'exemple depuis le 17/11/2026, en France comme au Portugal). Après une publication
 * réussie, le rattrapage note les identifiants de services dans le catalogue relu au moment d'écrire ou, si la clé
 * manque, écrit le catalogue affiché (celui de la société) avec ses identifiants.
 */
import { jetonAcces } from '@/lib/auth/jeton-acces'

/** Clé du catalogue tenu par le module Prestations depuis le 16/04/2026. */
export const cleCatalogueBTP = (artisanId: string): string => `fixit_prestations_btp_v5_${artisanId}`

/**
 * Ancienne clé : le module ne l'écrit plus depuis le 16/04/2026, le formulaire y recopiait le jeu par défaut. Lue
 * en repli tant que le module n'a rien enregistré, jamais écrite ni supprimée.
 */
export const cleCatalogueBTPAncienne = (artisanId: string): string => `fixit_prestations_btp_v4_${artisanId}`

/** Ce que ce fichier lit d'un élément du catalogue ; le reste est conservé tel quel. */
export interface ElementCatalogueBTP {
  id: number
  name: string
  type: string
  supabase_id?: string | null
}

export type LectureLocale<T> =
  | { etat: 'present'; catalogue: T[] }
  | { etat: 'absent' }
  /** Stockage illisible (bloqué par le navigateur) ou valeur qui n'est pas une liste. */
  | { etat: 'illisible' }

/** Catalogue enregistré sous `cle` dans ce navigateur. Ne lève jamais. */
export function lireCatalogueLocal<T>(cle: string): LectureLocale<T> {
  // Rendu côté serveur : pas de stockage à lire.
  if (typeof window === 'undefined') return { etat: 'illisible' }
  let brut: string | null
  try {
    brut = window.localStorage.getItem(cle)
  } catch (erreur) {
    console.warn('[catalogue BTP] stockage du navigateur illisible :', erreur)
    return { etat: 'illisible' }
  }
  if (brut === null) return { etat: 'absent' }
  try {
    const valeur: unknown = JSON.parse(brut)
    if (Array.isArray(valeur)) return { etat: 'present', catalogue: valeur as T[] }
    console.warn('[catalogue BTP] valeur enregistrée qui n\'est pas une liste :', cle)
  } catch (erreur) {
    console.warn('[catalogue BTP] valeur enregistrée illisible :', cle, erreur)
  }
  return { etat: 'illisible' }
}

/**
 * Catalogue proposé par le formulaire de devis et facture : celui du module (clé v5), à défaut l'ancienne copie
 * (clé v4). Rien n'est écrit. Rien d'enregistré : aucun catalogue, jamais d'exemple (catalogue vierge à la création du
 * compte). Sans fiche, ou si la valeur trouvée est illisible, aucun catalogue (comme avant, où la lecture en échec ne
 * proposait rien) ; un élément qui n'est pas un objet, ou qui n'a pas de nom, est écarté.
 */
export function lireCatalogueBTPNavigateur<T>(artisanId: string | null | undefined): T[] {
  if (!artisanId) return []
  for (const cle of [cleCatalogueBTP(artisanId), cleCatalogueBTPAncienne(artisanId)]) {
    const lecture = lireCatalogueLocal<T>(cle)
    if (lecture.etat === 'present') {
      return lecture.catalogue.filter((element) =>
        typeof element === 'object' && element !== null && typeof (element as { name?: unknown }).name === 'string')
    }
    if (lecture.etat === 'illisible') return []
  }
  return []
}

export type LectureServeur<T> =
  | { etat: 'present'; catalogue: T[] }
  /** Le serveur a répondu et ne détient pas cette clé pour ce compte. */
  | { etat: 'absent' }
  /** Pas de réponse sûre (pas de session, réseau, erreur du serveur, réponse inattendue). */
  | { etat: 'inconnu' }

/** Nombre maximal d'entrées renvoyées par GET /api/user-storage (`.limit(2000)` de la route). */
const PLAFOND_ENTREES_SERVEUR = 2000

/** Le miroir enregistre la valeur décodée ; une valeur restée en texte (illisible à l'envoi) est décodée ici. */
function valeurServeur(valeur: unknown): unknown {
  if (typeof valeur !== 'string') return valeur
  try {
    return JSON.parse(valeur)
  } catch (erreur) {
    console.warn('[catalogue BTP] valeur du serveur illisible :', erreur)
    return null
  }
}

/**
 * Ce que le serveur détient pour `cle` (miroir du stockage du compte connecté). Même lecture que la restauration
 * (GET /api/user-storage) : elle répond sans attendre que la restauration ait recopié la clé dans le navigateur.
 */
export async function lireCatalogueAuServeur<T>(cle: string): Promise<LectureServeur<T>> {
  try {
    const jeton = await jetonAcces()
    if (!jeton) return { etat: 'inconnu' }
    const reponse = await fetch('/api/user-storage', { headers: { Authorization: `Bearer ${jeton}` } })
    if (!reponse.ok) {
      console.warn('[catalogue BTP] sauvegarde en ligne illisible, statut', reponse.status)
      return { etat: 'inconnu' }
    }
    const corps = (await reponse.json()) as { entries?: unknown }
    const entrees = corps?.entries
    if (!entrees || typeof entrees !== 'object' || Array.isArray(entrees)) return { etat: 'inconnu' }
    const parCle = entrees as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(parCle, cle)) {
      // Réponse tronquée au plafond de la route : l'absence n'y est pas prouvée.
      return Object.keys(parCle).length >= PLAFOND_ENTREES_SERVEUR ? { etat: 'inconnu' } : { etat: 'absent' }
    }
    const valeur = valeurServeur(parCle[cle])
    if (Array.isArray(valeur)) return { etat: 'present', catalogue: valeur as T[] }
    console.warn('[catalogue BTP] valeur du serveur qui n\'est pas une liste :', cle)
    return { etat: 'inconnu' }
  } catch (erreur) {
    console.warn('[catalogue BTP] sauvegarde en ligne injoignable :', erreur)
    return { etat: 'inconnu' }
  }
}

/** Prestation publiée (ligne de `services`) à reporter sur l'élément du catalogue qui l'a produite. */
export interface LienService {
  id: number
  name: string
  type: string
  supabase_id: string
}

/**
 * Reporte les identifiants de services sur les éléments correspondants : même identifiant, même nom et même type
 * (un identifiant seul peut désigner un autre élément dans un catalogue restauré entre-temps), et seulement là où
 * aucun identifiant n'est encore noté. Renvoie la liste d'origine si rien ne change.
 */
export function appliquerLiensServices<T extends ElementCatalogueBTP>(catalogue: T[], liens: LienService[]): T[] {
  let change = false
  const suivant = catalogue.map((element) => {
    if (element.supabase_id) return element
    const lien = liens.find((l) => l.id === element.id && l.name === element.name && l.type === element.type)
    if (!lien) return element
    change = true
    return { ...element, supabase_id: lien.supabase_id }
  })
  return change ? suivant : catalogue
}

/**
 * Écrit les identifiants de services dans le catalogue enregistré, RELU au moment d'écrire : la restauration
 * depuis le serveur, ou une autre saisie, a pu le remplacer pendant la publication. Clé absente : le catalogue
 * affiché (venu du serveur, pas encore recopié ici) est écrit avec ses identifiants. Clé illisible, ou aucun
 * élément correspondant : rien n'est écrit.
 */
export function reporterLiensServices<T extends ElementCatalogueBTP>(cle: string, liens: LienService[], catalogueAffiche: () => T[]): void {
  const lecture = lireCatalogueLocal<T>(cle)
  if (lecture.etat === 'illisible') return
  const base = lecture.etat === 'present' ? lecture.catalogue : catalogueAffiche()
  const suivant = appliquerLiensServices(base, liens)
  if (suivant === base) return
  try {
    window.localStorage.setItem(cle, JSON.stringify(suivant))
  } catch (erreur) {
    console.warn('[catalogue BTP] identifiants de services non enregistrés :', erreur)
  }
}

/** Services déjà publiés pour la fiche, par nom (identifiants dans l'ordre de lecture). */
export type ServicesParNom = Map<string, string[]>

/** Ligne de `services` lue pour le rattrapage : identifiant, nom, description et durée. */
export interface LigneServicePublie {
  id?: unknown
  name?: unknown
  description?: unknown
  duration_minutes?: unknown
}

/**
 * Balise de fourchette que le module écrit à la fin de la description d'une prestation publiée : [unit:…|min:…|max:…].
 * Ses valeurs (unité, prix) ne contiennent ni crochet ni barre : les exclure garde une recherche proportionnelle à la
 * longueur de la description, quelle qu'elle soit.
 */
const BALISE_FOURCHETTE_EN_FIN = /\[unit:[^[\]|]*\|min:[^[\]|]*\|max:[^[\]|]*\]$/

/**
 * Service publié par le module Prestations : description terminée par sa balise de fourchette et durée vide, comme le
 * module les écrit depuis qu'il publie (components/dashboard/PrestationsBTPSection.tsx, prestationToServicePayload).
 * Un service créé ailleurs pour la fiche (assistant Fixy, application mobile, écran des motifs, motifs proposés à
 * l'inscription) a une durée : il n'est jamais repris, sinon la prochaine modification de la prestation dans le module
 * le réécrirait. L'écran des motifs ajoute en plus d'autres balises après celle-ci ; les motifs proposés à
 * l'inscription finissent par la même balise, seule leur durée les distingue. Limite connue : un service du module dont
 * l'assistant Fixy a changé la durée ou la description n'est plus reconnu ; une prestation sans identifiant de service
 * est alors publiée une seconde fois, comme avant ce rattrapage.
 */
export function estServicePublieParLeModule(ligne: LigneServicePublie): boolean {
  return typeof ligne.description === 'string'
    && BALISE_FOURCHETTE_EN_FIN.test(ligne.description.trim())
    && ligne.duration_minutes === null
}

/** Range par nom les lignes lues de `services`, en ne gardant que celles publiées par le module. */
export function rangerServicesParNom(lignes: ReadonlyArray<LigneServicePublie>): ServicesParNom {
  const parNom: ServicesParNom = new Map()
  for (const ligne of lignes) {
    if (typeof ligne.id !== 'string' || typeof ligne.name !== 'string') continue
    if (!estServicePublieParLeModule(ligne)) continue
    parNom.set(ligne.name, [...(parNom.get(ligne.name) ?? []), ligne.id])
  }
  return parNom
}

/**
 * Service déjà publié par le module sous ce nom (rangerServicesParNom) et relié à aucun autre élément du catalogue
 * (`pris`, complété ici) : le rattrapage au chargement d'une prestation qui n'a pas d'identifiant le reprend tel quel
 * au lieu d'en créer un second. Le service repris n'est pas modifié.
 */
export function prendreServicePublie(parNom: ServicesParNom, nom: string, pris: Set<string>): string | null {
  const libre = (parNom.get(nom) ?? []).find((id) => !pris.has(id))
  if (!libre) return null
  pris.add(libre)
  return libre
}
