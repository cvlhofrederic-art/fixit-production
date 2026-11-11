/**
 * Téléchargement groupé des listes Devis et Factures du tableau de bord pro (artisan et BTP).
 *
 * Chaque PDF est produit exactement comme par le bouton « Télécharger » de sa ligne (produireFichierDocument :
 * modèle V2 artisan ou V3 BTP, Factur-X compris), puis tous sont rangés dans une seule archive ZIP — un seul
 * téléchargement, que le navigateur ne bloque pas. Un seul document : son PDF, sans archive.
 *
 * Les PDF sont produits l'un après l'autre (mémoire et réseau des petits appareils) ; un document en échec
 * n'arrête pas les autres, il est signalé dans le résultat. Lecture seule : rien n'est écrit dans les documents.
 */

import type { Zippable } from 'fflate'
import {
  downloadSavedDevis,
  produireFichierDocument,
  type DownloadContext,
  type FichierDocument,
  type SavedDevis,
} from '@/lib/pdf/download-saved-devis'
import { DELAI_REVOCATION_TELECHARGEMENT_MS, telechargerParLien } from '@/lib/pdf/apercu-pdf'

export interface ResultatTelechargementGroupe {
  /** Documents présents dans le téléchargement (archive ou PDF seul). */
  telecharges: number
  /** Numéros (ou noms de client) des documents qui n'ont pas pu être produits. */
  echecs: string[]
  /** Raison du premier échec (ex. « Assurance RC Pro obligatoire… »), à montrer à l'utilisateur. */
  raison: string | null
  /** Nom de l'archive téléchargée ; null quand un seul PDF a été téléchargé, ou rien. */
  archive: string | null
}

export interface OptionsTelechargementGroupe {
  /** Nom de l'archive, sans extension (ex. « Devis_2026-11-11 »). */
  nomArchive: string
  /** Appelé après chaque document produit (réussi ou non). */
  onProgression?: (faits: number, total: number) => void
  /** Production d'un PDF ; remplaçable dans les tests. */
  produire?: (doc: SavedDevis, ctx: DownloadContext) => Promise<FichierDocument>
  /** Téléchargement d'un document seul ; remplaçable dans les tests. */
  telechargerUn?: (doc: SavedDevis, ctx: DownloadContext) => Promise<void>
  /** Remise du fichier final au navigateur ; remplaçable dans les tests. */
  enregistrer?: (fichier: Blob, nom: string) => void
}

// Caractères refusés dans un nom de fichier Windows ; « / » rangerait le PDF dans un sous-dossier de l'archive.
const CARACTERES_INTERDITS = /[\\/:*?"<>|]+/g

/** Nom de fichier sûr : caractères interdits remplacés, caractères de contrôle retirés. */
function nomDeFichierSur(nom: string): string {
  const sansControle = Array.from(nom, c => (c.charCodeAt(0) < 32 ? '' : c)).join('')
  return sansControle.replace(CARACTERES_INTERDITS, '-').trim()
}

/** Nom d'entrée d'archive sûr sur Windows, macOS et Android, unique dans l'archive (« (2) », « (3) »…). */
export function nomUniqueDansArchive(nom: string, dejaPris: Set<string>): string {
  const propre = nomDeFichierSur(nom)
  const finPdf = propre.toLowerCase().endsWith('.pdf') ? propre.length - 4 : propre.length
  const base = propre.slice(0, finPdf).trim() || 'document'
  let candidat = `${base}.pdf`
  // Windows et macOS ne distinguent pas les majuscules : « devis.pdf » et « DEVIS.pdf » se rencontreraient.
  for (let n = 2; dejaPris.has(candidat.toLowerCase()); n++) candidat = `${base} (${n}).pdf`
  dejaPris.add(candidat.toLowerCase())
  return candidat
}

function libelleDocument(doc: SavedDevis): string {
  return doc.docNumber || doc.clientName || doc.docTitle || '?'
}

/**
 * Nom du PDF dans l'archive. Un document numéroté garde le nom du bouton « Télécharger » de sa ligne ; un
 * brouillon sans numéro (« devis.pdf » ou « Devis__Client.pdf » sinon) est nommé « Brouillon - Devis - Client »,
 * pour ne pas se confondre avec un document émis. Seul le nom dans l'archive change, pas le PDF.
 */
const LIBELLES_BROUILLON = {
  fr: { brouillon: 'Brouillon', devis: 'Devis', facture: 'Facture' },
  pt: { brouillon: 'Rascunho', devis: 'Orcamento', facture: 'Fatura' },
} as const

function nomDansArchive(doc: SavedDevis, nomGenere: string, locale: DownloadContext['locale']): string {
  if (doc.docNumber) return nomGenere
  const libelles = locale === 'pt' ? LIBELLES_BROUILLON.pt : LIBELLES_BROUILLON.fr
  const type = doc.docType === 'facture' ? libelles.facture : libelles.devis
  const client = doc.clientName ? ` - ${doc.clientName}` : ''
  return `${libelles.brouillon} - ${type}${client}.pdf`
}

// Erreurs « métier » des générateurs, dont le message est fait pour l'utilisateur ; toute autre erreur (technique)
// reste dans la console, l'utilisateur voit « Réessayez ».
const RAISONS_AFFICHABLES = [/^Assurance RC Pro obligatoire/]
const LONGUEUR_MAX_RAISON = 160

/** Message d'une erreur métier connue, sur une ligne et abrégé ; null pour une erreur technique. */
function raisonErreur(erreur: unknown): string | null {
  if (!(erreur instanceof Error)) return null
  const message = erreur.message.replace(/\s+/g, ' ').trim()
  if (!RAISONS_AFFICHABLES.some(motif => motif.test(message))) return null
  return message.length > LONGUEUR_MAX_RAISON ? `${message.slice(0, LONGUEUR_MAX_RAISON - 1)}…` : message
}

function enregistrerDansLeNavigateur(fichier: Blob, nom: string): void {
  const url = URL.createObjectURL(fichier)
  telechargerParLien(url, nom)
  setTimeout(() => URL.revokeObjectURL(url), DELAI_REVOCATION_TELECHARGEMENT_MS)
}

/**
 * Télécharge `docs` : le PDF seul s'il n'y en a qu'un, sinon une archive ZIP de tous les PDF.
 * Ne lève pas pour un document en échec (voir `echecs`) ; lève seulement si l'archive elle-même échoue.
 */
export async function telechargerDocumentsGroupes(
  docs: readonly SavedDevis[],
  ctx: DownloadContext,
  options: OptionsTelechargementGroupe,
): Promise<ResultatTelechargementGroupe> {
  const total = docs.length
  if (total === 0) return { telecharges: 0, echecs: [], raison: null, archive: null }

  if (total === 1) {
    const telechargerUn = options.telechargerUn ?? downloadSavedDevis
    try {
      await telechargerUn(docs[0], ctx)
      return { telecharges: 1, echecs: [], raison: null, archive: null }
    } catch (erreur) {
      console.warn('[telechargement-groupe] PDF impossible :', libelleDocument(docs[0]), erreur)
      return { telecharges: 0, echecs: [libelleDocument(docs[0])], raison: raisonErreur(erreur), archive: null }
    } finally {
      options.onProgression?.(1, 1)
    }
  }

  const produire = options.produire ?? produireFichierDocument
  const entrees: Zippable = {}
  const nomsPris = new Set<string>()
  const echecs: string[] = []
  let raison: string | null = null
  let faits = 0
  for (const doc of docs) {
    try {
      const { nom, octets } = await produire(doc, ctx)
      // PDF déjà compressés : rangés sans recompression (archive aussi rapide à produire qu'à ouvrir).
      entrees[nomUniqueDansArchive(nomDansArchive(doc, nom, ctx.locale), nomsPris)] = [octets, { level: 0 }]
    } catch (erreur) {
      console.warn('[telechargement-groupe] PDF impossible :', libelleDocument(doc), erreur)
      echecs.push(libelleDocument(doc))
      raison ??= raisonErreur(erreur)
    }
    faits++
    options.onProgression?.(faits, total)
  }

  const telecharges = total - echecs.length
  if (telecharges === 0) return { telecharges: 0, echecs, raison, archive: null }

  const archive = `${nomDeFichierSur(options.nomArchive) || 'documents'}.zip`
  // Chargée au premier téléchargement groupé seulement : rien de plus à l'ouverture du tableau de bord.
  const { zipSync } = await import('fflate')
  // Le tableau rendu par zipSync est neuf (tampon à lui seul) : remis au Blob sans copie supplémentaire.
  const octets = zipSync(entrees) as Uint8Array<ArrayBuffer>
  const enregistrer = options.enregistrer ?? enregistrerDansLeNavigateur
  enregistrer(new Blob([octets], { type: 'application/zip' }), archive)
  return { telecharges, echecs, raison, archive }
}
