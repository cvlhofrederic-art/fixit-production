'use client'

import type { CSSProperties } from 'react'
import {
  TAILLE_MAX_FICHIER_FACTURE,
  normaliserFactureExtraite,
  type FactureExtraite,
  type TypeFichierFacture,
} from '@/lib/administrateur-judiciaire/ia/outils'

/**
 * Appels des outils IA de la succursale (Claude, via /api/administrateur-judiciaire/outils) depuis les écrans :
 * Analyse de devis & factures, Rédaction de PV, Saisie de factures. Les fonctions rejettent en cas d'échec
 * (ErreurOutilIA) : l'écran affiche un toast et aucun résultat fictif.
 */

/** Bouton désactivé pendant l'appel (la feuille de style n'a pas de règle .btn:disabled). */
export const STYLE_BOUTON_ATTENTE: CSSProperties = { opacity: 0.6, cursor: 'wait' }

export interface DemandeAnalyseDevis {
  tache: 'analyse-devis'
  texte: string
  dateDuJour: string
}

export interface DemandeRedactionPv {
  tache: 'redaction-pv'
  copropriete: string
  resolutions: string[]
  dateDuJour: string
  contexte: Record<string, unknown>
}

export interface DemandeSaisieFacture {
  tache: 'saisie-facture'
  /** Fichier en data URL base64 (PDF, PNG, JPEG ou WebP, 4 Mo au plus). */
  fichier: string
  nomFichier: string
  /** Copropriétés de la base (nom, adresse) pour reconnaître celle de la facture. */
  coproprietes: Array<{ nom: string; adresse?: string }>
}

/** Échec d'un outil IA : statut HTTP (0 : réseau injoignable) et code d'erreur renvoyé par la route. */
export class ErreurOutilIA extends Error {
  constructor(
    readonly statut: number,
    readonly code: string | null,
  ) {
    super(`Outil IA indisponible (HTTP ${statut}${code ? `, ${code}` : ''})`)
    this.name = 'ErreurOutilIA'
  }
}

async function appeler(
  demande: DemandeAnalyseDevis | DemandeRedactionPv | DemandeSaisieFacture,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let reponse: Response
  try {
    reponse = await fetch('/api/administrateur-judiciaire/outils', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demande),
      signal,
    })
  } catch (erreur) {
    if (signal?.aborted) throw erreur
    throw new ErreurOutilIA(0, 'reseau')
  }
  const donnees = (await reponse.json().catch(() => null)) as Record<string, unknown> | null
  if (!reponse.ok || !donnees) {
    throw new ErreurOutilIA(reponse.status, typeof donnees?.error === 'string' ? donnees.error : null)
  }
  return donnees
}

/** Analyse de devis ou projet de PV : texte Markdown rédigé par l'IA. */
export async function demanderTexteOutilIA(
  demande: DemandeAnalyseDevis | DemandeRedactionPv,
  signal?: AbortSignal,
): Promise<string> {
  const donnees = await appeler(demande, signal)
  if (typeof donnees.text !== 'string' || !donnees.text.trim()) throw new ErreurOutilIA(502, 'reponse_vide')
  return donnees.text
}

/** Facture fournisseur lue par l'IA (vision). */
export async function lireFactureIA(demande: DemandeSaisieFacture, signal?: AbortSignal): Promise<FactureExtraite> {
  const donnees = await appeler(demande, signal)
  const facture = normaliserFactureExtraite(donnees.facture)
  if (!facture) throw new ErreurOutilIA(502, 'reponse_invalide')
  return facture
}

/** Texte du toast d'échec, selon la réponse de la route. */
export function messageErreurOutilIA(erreur: unknown): string {
  if (erreur instanceof ErreurOutilIA) {
    if (erreur.code === 'lecture_fichier') return 'Le fichier n’a pas pu être lu sur cet appareil.'
    if (erreur.statut === 0) return 'Connexion impossible : vérifiez le réseau, puis réessayez.'
    if (erreur.statut === 401) return 'Session expirée : reconnectez-vous pour utiliser l’assistant IA.'
    if (erreur.statut === 429) return 'Trop de demandes en peu de temps : réessayez dans une minute.'
    if (erreur.code === 'fichier_trop_volumineux') {
      return `Fichier trop volumineux (${TAILLE_MAX_FICHIER_FACTURE / (1024 * 1024)} Mo maximum).`
    }
    if (erreur.code === 'format_non_pris_en_charge') return 'Format non pris en charge : PDF, PNG, JPEG ou WebP.'
    if (erreur.code === 'reponse_invalide') return 'La facture n’a pas pu être lue : vérifiez la qualité du fichier, puis réessayez.'
    if (erreur.code === 'fichier_illisible') return 'Fichier illisible ou corrompu : exportez-le à nouveau (PDF, PNG, JPEG ou WebP).'
    if (erreur.statut === 413) return 'Document trop volumineux pour l’assistant IA.'
  }
  return 'L’assistant IA est momentanément indisponible. Réessayez dans un instant.'
}

/** Contenu d'un fichier en data URL base64, avec le type reconnu (le navigateur peut ne pas en fournir). */
export function lireFichierDataUrl(fichier: Blob, type: TypeFichierFacture): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => {
      const resultat = typeof lecteur.result === 'string' ? lecteur.result : ''
      const virgule = resultat.indexOf(',')
      if (virgule < 0) rejeter(new ErreurOutilIA(0, 'lecture_fichier'))
      else resoudre(`data:${type};base64,${resultat.slice(virgule + 1)}`)
    }
    lecteur.onerror = () => rejeter(new ErreurOutilIA(0, 'lecture_fichier'))
    lecteur.readAsDataURL(fichier)
  })
}
