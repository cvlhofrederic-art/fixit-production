'use client'

/**
 * Outils communs aux listes Devis et Factures (V5 : artisan ET BTP, à la demande de Frédéric le 11/11/2026) :
 * recherche dans tout ce qui est relié au document, cases à cocher, et téléchargement groupé des PDF
 * (« Tout télécharger » ou « Télécharger la sélection », une seule archive ZIP).
 *
 * Lecture seule : rien n'est écrit dans les documents, ni dans le stockage du navigateur.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { docIdentityKey } from '@/lib/devis-utils'
import { dateDuJourLocale } from '@/lib/acompte-par-taux'
import {
  filtrerDocuments,
  indexerDocument,
  type ChampRecherche,
  type IndiceRecherche,
  type LocaleRecherche,
} from '@/lib/documents/recherche-documents'
import { telechargerDocumentsGroupes } from '@/lib/pdf/telechargement-groupe'
import type { DownloadContext, SavedDevis } from '@/lib/pdf/download-saved-devis'

type Traduire = (cle: string) => string

const CLE_TEXTES = 'proDash.documentsListe'
/** Clé de traduction d'un texte des listes : « proDash.documentsListe.<nom> ». */
const cleTexte = (nom: string): string => `${CLE_TEXTES}.${nom}`

function localeRecherche(locale: string): LocaleRecherche {
  return locale === 'pt' ? 'pt' : 'fr'
}

/* ─── Recherche ─────────────────────────────────────────────────────────── */

/**
 * Documents trouvés (ordre de `docs` conservé) et, pour chacun, l'indice « trouvé dans… » éventuel.
 * `montantDe` : montant affiché par la liste, cherchable aussi (identité stable : fonction du module ou useCallback).
 */
export function useRechercheDocuments<T extends object>(
  docs: readonly T[],
  requete: string,
  locale: string,
  champsVisibles: ReadonlySet<ChampRecherche>,
  montantDe?: (doc: T) => number,
): { documents: T[]; indiceDe: (doc: T) => IndiceRecherche | null } {
  const loc = localeRecherche(locale)
  const index = useMemo(
    () => docs.map(d => indexerDocument(d, loc, montantDe?.(d))),
    [docs, loc, montantDe],
  )
  return useMemo(() => {
    const resultats = filtrerDocuments(index, requete, champsVisibles)
    const indices = new Map<T, IndiceRecherche>()
    for (const r of resultats) if (r.indice) indices.set(r.doc, r.indice)
    return { documents: resultats.map(r => r.doc), indiceDe: (doc: T) => indices.get(doc) ?? null }
  }, [index, requete, champsVisibles])
}

// Deux lignes au plus, retour à la ligne permis : l'indice n'élargit pas la colonne (pas d'ascenseur horizontal).
const STYLE_INDICE = {
  fontSize: 10, color: '#888', marginTop: 2, maxWidth: 240, overflow: 'hidden', overflowWrap: 'anywhere',
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
} as const

/** Petite ligne sous le nom du client : pourquoi ce document est dans les résultats (champ non affiché). */
export function IndiceResultat({ indice, t }: Readonly<{ indice: IndiceRecherche | null; t: Traduire }>) {
  if (!indice) return null
  return (
    <div style={STYLE_INDICE} title={indice.texte}>
      {t(cleTexte(`champs.${indice.champ}`))} : {indice.texte}
    </div>
  )
}

/* ─── Filtre par statut ─────────────────────────────────────────────────── */

export interface OptionFiltre<K extends string> {
  cle: K
  libelle: string
  nombre: number
}

// Puce verte quand elle est active : même rendu que le filtre par statut historique des factures.
const styleFiltre = (actif: boolean) => ({
  padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: actif ? 700 : 500,
  border: `1px solid ${actif ? '#16a34a' : '#ddd'}`,
  background: actif ? 'rgba(22, 163, 74, 0.12)' : '#fff',
  color: actif ? '#15803d' : '#444',
})

/** Puces de filtre par statut (« Toutes (12) », « Émises (8) »…) : « Tout télécharger » suit le filtre choisi. */
export function FiltreStatut<K extends string>({ options, actif, onChoisir }: Readonly<{
  options: readonly OptionFiltre<K>[]
  actif: K
  onChoisir: (cle: K) => void
}>) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {options.map(option => (
        <button
          key={option.cle}
          type="button"
          onClick={() => onChoisir(option.cle)}
          aria-pressed={actif === option.cle}
          style={styleFiltre(actif === option.cle)}
        >
          {option.libelle} ({option.nombre})
        </button>
      ))}
    </div>
  )
}

/* ─── Sélection ─────────────────────────────────────────────────────────── */

const clesObjets = new WeakMap<object, string>()
let compteurCles = 0

/** Clé stable d'un document dans la sélection : n° définitif, sinon id, sinon date d'enregistrement. */
export function cleDocument(doc: object): string {
  const d = doc as { id?: unknown; docNumber?: unknown; savedAt?: unknown }
  const texte = (v: unknown): string | null => (typeof v === 'string' || typeof v === 'number' ? String(v) : null)
  const cle = docIdentityKey({ id: texte(d.id), docNumber: texte(d.docNumber) })
  if (cle) return cle
  const enregistreLe = texte(d.savedAt)
  if (enregistreLe) return `enregistre:${enregistreLe}`
  // Document sans identité (ne devrait pas exister) : clé propre à l'objet affiché.
  let cleObjet = clesObjets.get(doc)
  if (!cleObjet) {
    compteurCles += 1
    cleObjet = `objet:${compteurCles}`
    clesObjets.set(doc, cleObjet)
  }
  return cleObjet
}

export type EtatSelectionEntete = 'aucun' | 'partiel' | 'tous'

/**
 * Sélection par cases à cocher. Elle survit à la recherche et aux filtres (on peut cocher des documents de
 * plusieurs recherches) ; Maj + clic coche ou décoche toute la plage depuis la case précédente.
 */
export function useSelectionDocuments<T extends object>(visibles: readonly T[]) {
  const [cles, setCles] = useState<ReadonlySet<string>>(() => new Set())
  const derniereCle = useRef<string | null>(null)
  const clesVisibles = useMemo(() => visibles.map(cleDocument), [visibles])
  const nbVisiblesCoches = clesVisibles.filter(c => cles.has(c)).length
  let etatEntete: EtatSelectionEntete = 'partiel'
  if (nbVisiblesCoches === 0) etatEntete = 'aucun'
  else if (nbVisiblesCoches === clesVisibles.length) etatEntete = 'tous'

  const appliquer = (concernees: readonly string[], cocher: boolean): void => {
    setCles(avant => {
      const apres = new Set(avant)
      for (const cle of concernees) {
        if (cocher) apres.add(cle)
        else apres.delete(cle)
      }
      return apres
    })
  }

  const basculer = (doc: T, plage: boolean): void => {
    const cle = cleDocument(doc)
    let concernees: readonly string[] = [cle]
    const depuis = derniereCle.current ? clesVisibles.indexOf(derniereCle.current) : -1
    const jusqua = clesVisibles.indexOf(cle)
    if (plage && depuis >= 0 && jusqua >= 0) {
      concernees = clesVisibles.slice(Math.min(depuis, jusqua), Math.max(depuis, jusqua) + 1)
    }
    derniereCle.current = cle
    appliquer(concernees, !cles.has(cle))
  }

  return {
    etatEntete,
    estSelectionne: (doc: T): boolean => cles.has(cleDocument(doc)),
    basculer,
    /** Case d'en-tête : coche tous les documents affichés, ou les décoche s'ils l'étaient tous. */
    basculerTout: (): void => appliquer(clesVisibles, etatEntete !== 'tous'),
    /** Documents cochés parmi `tous` (un document supprimé entre-temps n'y est plus). */
    selectionnes: (tous: readonly T[]): T[] => tous.filter(d => cles.has(cleDocument(d))),
    vider: (): void => {
      derniereCle.current = null
      setCles(new Set())
    },
  }
}

// Case de 18 px (la règle globale des écrans tactiles la porterait à 44 px) ; la zone cliquable de 44 px est le
// libellé qui l'entoure, sur toute la cellule.
const STYLE_CASE = {
  width: 18, height: 18, minWidth: 18, minHeight: 18, margin: 0, cursor: 'pointer',
  accentColor: 'var(--v5-primary-yellow-dark, #FFA000)',
}
const STYLE_ZONE_CASE = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44,
  cursor: 'pointer', userSelect: 'none',
} as const

export function EnteteSelection({ etat, onBasculer, t }: Readonly<{
  etat: EtatSelectionEntete
  onBasculer: () => void
  t: Traduire
}>) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = etat === 'partiel'
  }, [etat])
  const libelle = t(cleTexte('toutSelectionner'))
  return (
    <th style={{ width: 44, padding: 0 }}>
      <label style={STYLE_ZONE_CASE} title={libelle}>
        <input ref={ref} type="checkbox" checked={etat === 'tous'} onChange={onBasculer} aria-label={libelle} style={STYLE_CASE} />
      </label>
    </th>
  )
}

/** Cellule de case à cocher : toute la cellule est cliquable, et le clic n'ouvre pas le document. */
export function CelluleSelection({ coche, onBasculer, libelle }: Readonly<{
  coche: boolean
  onBasculer: (plage: boolean) => void
  libelle: string
}>) {
  return (
    <td style={{ width: 44, padding: 0 }} onClick={e => e.stopPropagation()}>
      <label style={STYLE_ZONE_CASE}>
        <input type="checkbox" checked={coche} aria-label={libelle} style={STYLE_CASE}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onBasculer((e.nativeEvent as MouseEvent).shiftKey === true)} />
      </label>
    </td>
  )
}

/* ─── Téléchargement groupé ─────────────────────────────────────────────── */

export interface ProgressionTelechargement {
  faits: number
  total: number
}

/** Fiche de l'artisan ou de la société, telle que les listes la reçoivent (champs lus comme par chaque ligne). */
type ArtisanTelechargement = { id: string; company_name?: string | null } | null

const champTexte = (fiche: object, nom: string): string | null => {
  const valeur = (fiche as Record<string, unknown>)[nom]
  return typeof valeur === 'string' ? valeur : null
}

const MAX_ECHECS_AFFICHES = 5

/** Numéros des documents en échec, cinq au plus (« … et 3 autres ») : le message reste lisible. */
function listeEchecs(echecs: readonly string[], t: Traduire): string {
  if (echecs.length <= MAX_ECHECS_AFFICHES) return echecs.join(', ')
  const reste = echecs.length - MAX_ECHECS_AFFICHES
  const suite = reste === 1 ? t(cleTexte('etUnAutre')) : t(cleTexte('etAutres')).replace('{n}', String(reste))
  return `${echecs.slice(0, MAX_ECHECS_AFFICHES).join(', ')} ${suite}`
}

/**
 * Téléchargement des documents d'une liste, avec le même contexte que le bouton « Télécharger » de chaque
 * ligne (modèle V3 pour le BTP, V2 pour l'artisan). Rend `true` quand tous les documents sont partis.
 */
export function useTelechargementGroupe({ artisan, locale, t, useBtpDesign, nomListe }: {
  artisan: ArtisanTelechargement
  locale: string
  t: Traduire
  useBtpDesign: boolean
  /** « Devis » ou « Factures » (nom de l'archive), déjà traduit. */
  nomListe: string
}) {
  const [progression, setProgression] = useState<ProgressionTelechargement | null>(null)
  const enCours = useRef(false)
  // « Annuler » pendant la préparation : lu avant chaque PDF (le PDF en cours se termine, puis rien ne part).
  const annulation = useRef(false)

  const telecharger = async (docs: readonly object[]): Promise<boolean> => {
    if (enCours.current || docs.length === 0) return false
    enCours.current = true
    annulation.current = false
    setProgression({ faits: 0, total: docs.length })
    const ctx: DownloadContext = {
      locale: locale as DownloadContext['locale'],
      t,
      artisan: artisan ? {
        id: artisan.id,
        company_name: artisan.company_name,
        logo_url: champTexte(artisan, 'logo_url'),
        rm: champTexte(artisan, 'rm'),
        rc_pro: champTexte(artisan, 'rc_pro'),
      } : null,
      useBtpDesign,
    }
    try {
      const resultat = await telechargerDocumentsGroupes(docs as readonly SavedDevis[], ctx, {
        nomArchive: `${nomListe}_${dateDuJourLocale()}`,
        onProgression: (faits, total) => setProgression({ faits, total }),
        estAnnule: () => annulation.current,
      })
      if (resultat.annule) {
        toast.info(t(cleTexte('annule')))
        return false
      }
      const nombre = resultat.telecharges === 1
        ? t(cleTexte('unTelecharge'))
        : `${resultat.telecharges} ${t(cleTexte('telecharges'))}`
      if (resultat.echecs.length === 0) {
        const archive = resultat.archive ? ` (${resultat.archive})` : ''
        toast.success(nombre + archive)
        return true
      }
      // Raison du premier échec métier (ex. « Assurance RC Pro obligatoire… ») ; sans raison connue : « Réessayez ».
      const raison = resultat.raison ? ` — ${resultat.raison}` : ''
      if (resultat.telecharges > 0) {
        toast.error(`${nombre}. ${t(cleTexte('echecsPartiels'))} ${listeEchecs(resultat.echecs, t)}${raison}`)
      } else {
        const suite = raison || `. ${t(cleTexte('reessayez'))}`
        toast.error(t(cleTexte('aucunPdf')) + suite)
      }
      return false
    } catch (erreur) {
      console.warn('[telechargement-groupe] archive impossible', erreur)
      toast.error(t(cleTexte('erreurArchive')))
      return false
    } finally {
      enCours.current = false
      setProgression(null)
    }
  }

  const annuler = (): void => {
    annulation.current = true
  }

  return { progression, telecharger, annuler }
}

function IconeTelechargement() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  )
}

/**
 * Boutons de la barre de recherche : « Tout télécharger (N) » quand rien n'est coché (les N documents affichés),
 * « Télécharger la sélection (k) » sinon, plus « Désélectionner » ; « Annuler » pendant la préparation.
 */
export function BoutonsTelechargementGroupe({ nbAffiches, nbSelectionnes, progression, onTelecharger, onVider, onAnnuler, t }: Readonly<{
  nbAffiches: number
  nbSelectionnes: number
  progression: ProgressionTelechargement | null
  onTelecharger: () => void
  onVider: () => void
  onAnnuler: () => void
  t: Traduire
}>) {
  const enCours = progression !== null
  let libelle = `${t(cleTexte('toutTelecharger'))} (${nbAffiches})`
  let titre = t(cleTexte('titreToutTelecharger'))
  if (progression) {
    libelle = `${t(cleTexte('preparation'))} ${progression.faits}/${progression.total}`
  } else if (nbSelectionnes > 0) {
    libelle = `${t(cleTexte('telechargerSelection'))} (${nbSelectionnes})`
    titre = t(cleTexte('titreSelection'))
  }
  return (
    <>
      {nbSelectionnes > 0 && !enCours && (
        <button type="button" className="v5-btn" onClick={onVider}>
          {t(cleTexte('deselectionner'))}
        </button>
      )}
      {enCours && (
        <button type="button" className="v5-btn" onClick={onAnnuler}>
          {t(cleTexte('annuler'))}
        </button>
      )}
      <button type="button" className="v5-btn" onClick={onTelecharger} title={titre} aria-busy={enCours}
        disabled={enCours || (nbSelectionnes === 0 && nbAffiches === 0)}>
        <IconeTelechargement />
        {libelle}
      </button>
    </>
  )
}
