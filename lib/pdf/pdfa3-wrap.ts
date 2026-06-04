// ══════════════════════════════════════════════════════════════════════════════
// PDF metadata wrapper (ex PDF/A-3 — voir note conformité)
// ══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE :
//   FR-V2 a tenté un wrap PDF/A-3B pour archivage probant (arrêté 22 mars
//   2017 / ISO 19005-3). MAIS l'implémentation déclarait un OutputIntent
//   sRGB SANS embarquer le profil ICC binaire (DestOutputProfile stream).
//   C'est INVALIDE selon ISO 19005-3 §6.2.2 → les lecteurs strict (macOS
//   Aperçu, Preview iOS) refusent d'ouvrir le PDF en disant "endommagé".
//
// FIX (12/05/2026, user feedback Carvalho) :
//   On retire l'OutputIntent + les markers pdfaid:part/conformance puisqu'on
//   n'embarque PAS le profil ICC. Honnêteté : on ne prétend plus être PDF/A-3B.
//   On garde uniquement les XMP metadata standard (titre, auteur, date) +
//   Info dictionary qui ne posent aucun problème de lecture.
//
// POUR REPASSER EN VRAI PDF/A-3B (futur) :
//   1. Télécharger le profil sRGB IEC61966-2.1 (~3KB, Adobe distribute libre).
//   2. Embarquer comme DestOutputProfile stream dans l'OutputIntent.
//   3. Réactiver pdfaid:part/conformance markers dans XMP.
//   4. Tester ouverture macOS Aperçu + Acrobat Pro PDF/A validator.
//   Tant qu'on ne fait pas ça, on garde le wrap "léger" actuel.

import { PDFDocument } from 'pdf-lib'

interface PdfMetadataOptions {
  /** Titre du document — utilisé dans XMP metadata. */
  title: string
  /** Auteur — par défaut "Vitfix.io". */
  author?: string
  /** Description courte — par défaut le titre. */
  subject?: string
}

/**
 * Ajoute des metadata standard (Info dictionary) à un PDF existant produit
 * par jsPDF. N'altère PAS la structure visuelle du PDF, n'ajoute aucun
 * OutputIntent (cf. note de tête sur invalidation Aperçu macOS).
 */
export async function wrapAsPdfA3(
  pdfBytes: Uint8Array,
  opts: PdfMetadataOptions,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false })

  // Document-level metadata (Info dictionary) — toujours safe à ajouter,
  // tous les readers PDF les acceptent.
  pdfDoc.setTitle(opts.title)
  pdfDoc.setAuthor(opts.author || 'Vitfix.io')
  pdfDoc.setSubject(opts.subject || opts.title)
  pdfDoc.setProducer('Vitfix.io')
  pdfDoc.setCreator('Vitfix Pro (jsPDF + pdf-lib)')
  pdfDoc.setCreationDate(new Date())
  pdfDoc.setModificationDate(new Date())

  return await pdfDoc.save({ useObjectStreams: false })
}
