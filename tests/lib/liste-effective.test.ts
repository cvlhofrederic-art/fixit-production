// tests/lib/liste-effective.test.ts — quelle liste de documents un écran de synthèse lit (25/11/2026).
//
// Ce que ces cas protègent :
//
//  1. un salarié invité d'une société voit les chiffres de la SOCIÉTÉ. Ses écrans de synthèse lisaient le stockage
//     de son navigateur, qui ne contient que ses brouillons : chiffre d'affaires, rentabilité et taux de
//     transformation à 0 €, sur une liste de devis par ailleurs pleine ;
//  2. le titulaire d'un compte, lui, ne change pas d'un iota (règle n° 1) : sans liste fournie, le stockage est lu
//     exactement comme avant ;
//  3. `avecBrouillons: false` filtre AUSSI la liste fournie. Sans cela, un artisan aurait vu son taux de
//     transformation bouger du seul fait que l'écran lit désormais la liste du tableau de bord, qui porte ses
//     brouillons — un chiffre qui change sans que personne l'ait demandé est une régression, pas une amélioration.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { documentsPourSynthese, estDocumentEmis } from '@/lib/documents/liste-effective'

interface Doc {
  id: string
  docNumber?: string
  status?: string
  clientName?: string
}

const COMPTE = 'compte-salarie'

const FACTURE_SOCIETE: Doc = { id: 'f-1', docNumber: 'FT-2026-001', status: 'paid', clientName: 'SCI Les Tilleuls' }
const DEVIS_SOCIETE: Doc = { id: 'd-1', docNumber: 'ORC-2026-001', status: 'accepted', clientName: 'SARL Durand' }
const BROUILLON_LOCAL: Doc = { id: 'b-1', status: 'brouillon', clientName: 'Prospect' }
const BROUILLON_BASE: Doc = { id: 'b-2', docNumber: 'ORC-2026-002', status: 'draft', clientName: 'Prospect' }

const ranger = (cle: string, valeur: unknown) => localStorage.setItem(cle, JSON.stringify(valeur))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('estDocumentEmis', () => {
  it('un document émis porte un numéro de série et n’est pas un brouillon', () => {
    expect(estDocumentEmis(FACTURE_SOCIETE)).toBe(true)
    expect(estDocumentEmis(DEVIS_SOCIETE)).toBe(true)
  })

  it('les deux noms du brouillon sont reconnus : « brouillon » dans le navigateur, « draft » en base', () => {
    expect(estDocumentEmis(BROUILLON_LOCAL)).toBe(false)
    // Celui-ci porte même un numéro : c'est son statut qui tranche.
    expect(estDocumentEmis(BROUILLON_BASE)).toBe(false)
  })

  it('un document émis SANS numéro compte : la colonne « numero » est NULLABLE en base', () => {
    // Migration 20260602 : « numero » est nullable, et /api/devis/sync écrit la valeur nulle. Le filtre que le
    // dépôt appelle canonique (isEmittedDoc, lib/document-sync.ts) porte sur le STATUT seul, et c'est lui qui
    // remplit fixit_documents_. Exiger un numéro écartait donc des documents que l'écran comptait avant ce lot.
    const emisSansNumero: Doc = { id: 'x', status: 'sent' }
    const emisNumeroVide: Doc = { id: 'y', docNumber: '', status: 'paid' }
    expect(estDocumentEmis(emisSansNumero)).toBe(true)
    expect(estDocumentEmis(emisNumeroVide)).toBe(true)
  })

  it('un numéro PROVISOIRE « BR-… » n’est pas un document émis, même marqué envoyé', () => {
    // Le tableau de bord attribue des « BR-… » aux brouillons de facture, et « Marquer envoyée » les passe à
    // « envoyé » sans tirer aucun numéro légal. Au statut seul, un tel brouillon entrait dans le chiffre
    // d'affaires en attente, le taux de recouvrement et le CA par chantier — côté artisan aussi.
    const brouillonMarqueEnvoye: Doc = { id: 'br', docNumber: 'BR-2026-001', status: 'envoye' }
    const minusculeAussi: Doc = { id: 'br2', docNumber: 'br-2026-002', status: 'paid' }
    expect(estDocumentEmis(brouillonMarqueEnvoye)).toBe(false)
    expect(estDocumentEmis(minusculeAussi)).toBe(false)
  })

  it('un statut vide n’est pas un document émis', () => {
    const sansStatut: Doc = { id: 'z', docNumber: 'FT-2026-009', status: '' }
    const rien: Doc = { id: 'z2' }
    expect(estDocumentEmis(sansStatut)).toBe(false)
    expect(estDocumentEmis(rien)).toBe(false)
  })

  it('ne lève sur rien', () => {
    expect(estDocumentEmis(null)).toBe(false)
    expect(estDocumentEmis(undefined)).toBe(false)
  })
})

describe('documentsPourSynthese — la liste fournie prime', () => {
  it('rend la liste du tableau de bord, et ignore le stockage du navigateur', () => {
    // Le cas du salarié : le stockage ne porte que son brouillon, la liste porte les documents de la société.
    ranger(`fixit_documents_${COMPTE}`, [])
    ranger(`fixit_drafts_${COMPTE}`, [BROUILLON_LOCAL])

    const liste = documentsPourSynthese<Doc>([FACTURE_SOCIETE, DEVIS_SOCIETE], COMPTE, true)

    expect(liste.map(d => d.id)).toEqual(['f-1', 'd-1'])
  })

  it('rend une copie, jamais la liste reçue : un écran qui trie ne doit pas réordonner l’état du parent', () => {
    const fournie = [FACTURE_SOCIETE, DEVIS_SOCIETE]
    const liste = documentsPourSynthese<Doc>(fournie, COMPTE, true)
    expect(liste).not.toBe(fournie)
    expect(liste).toEqual(fournie)
  })

  it('avecBrouillons: false écarte les brouillons DE LA LISTE FOURNIE', () => {
    // Sans ce filtre, un artisan verrait son taux de transformation changer : la liste du tableau de bord porte
    // ses brouillons, alors que l'ancienne lecture ne regardait que les documents émis.
    const liste = documentsPourSynthese<Doc>(
      [FACTURE_SOCIETE, BROUILLON_LOCAL, DEVIS_SOCIETE, BROUILLON_BASE],
      COMPTE,
      false,
    )
    expect(liste.map(d => d.id)).toEqual(['f-1', 'd-1'])
  })
})

describe('documentsPourSynthese — le repli sur le stockage, inchangé pour un titulaire', () => {
  it('liste absente : lit le stockage du navigateur', () => {
    ranger(`fixit_documents_${COMPTE}`, [FACTURE_SOCIETE])
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, false).map(d => d.id)).toEqual(['f-1'])
  })

  it('liste vide : lit le stockage, et non une liste vide', () => {
    // L'écran peut être monté avant que la liste arrive du serveur : le repli doit tenir.
    ranger(`fixit_documents_${COMPTE}`, [FACTURE_SOCIETE])
    expect(documentsPourSynthese<Doc>([], COMPTE, false).map(d => d.id)).toEqual(['f-1'])
  })

  it('avecBrouillons: false ne lit QUE les documents émis, comme avant ce lot', () => {
    ranger(`fixit_documents_${COMPTE}`, [FACTURE_SOCIETE])
    ranger(`fixit_drafts_${COMPTE}`, [BROUILLON_LOCAL])
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, false).map(d => d.id)).toEqual(['f-1'])
  })

  it('avecBrouillons: true ajoute les brouillons, dans cet ordre', () => {
    ranger(`fixit_documents_${COMPTE}`, [FACTURE_SOCIETE])
    ranger(`fixit_drafts_${COMPTE}`, [BROUILLON_LOCAL])
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, true).map(d => d.id)).toEqual(['f-1', 'b-1'])
  })

  it('le repli applique LE MÊME filtre que la liste fournie', () => {
    // Un même document doit recevoir une seule réponse. Le filtrer d'un côté et le garder de l'autre faisait
    // dépendre un chiffre de l'état d'une prop — et comme la liste est remplie dès qu'un compte a un document,
    // c'est la branche qui écarte qui aurait gagné.
    ranger(`fixit_documents_${COMPTE}`, [
      { id: 'vieux', status: 'sent' },
      { id: 'provisoire', docNumber: 'BR-2026-001', status: 'envoye' },
    ])
    const parLeRepli = documentsPourSynthese<Doc>(undefined, COMPTE, false).map(d => d.id)
    const parLaListe = documentsPourSynthese<Doc>(
      [{ id: 'vieux', status: 'sent' }, { id: 'provisoire', docNumber: 'BR-2026-001', status: 'envoye' }],
      COMPTE,
      false,
    ).map(d => d.id)
    expect(parLeRepli).toEqual(['vieux'])
    expect(parLaListe).toEqual(parLeRepli)
  })
})

describe('documentsPourSynthese — rien ne doit démonter un écran', () => {
  it('sans identifiant de stockage et sans liste : liste vide', () => {
    expect(documentsPourSynthese<Doc>(undefined, undefined, true)).toEqual([])
    expect(documentsPourSynthese<Doc>(undefined, '', true)).toEqual([])
  })

  it('clé absente : liste vide', () => {
    expect(documentsPourSynthese<Doc>(undefined, 'compte-sans-rien', true)).toEqual([])
  })

  it('JSON abîmé : liste vide, pas d’exception', () => {
    localStorage.setItem(`fixit_documents_${COMPTE}`, '{ceci n’est pas du JSON')
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, false)).toEqual([])
  })

  it('valeur qui n’est pas un tableau : liste vide', () => {
    ranger(`fixit_documents_${COMPTE}`, { pasUnTableau: true })
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, false)).toEqual([])
  })

  it('stockage inaccessible (navigation privée, quota) : liste vide', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage refusé')
    })
    expect(documentsPourSynthese<Doc>(undefined, COMPTE, true)).toEqual([])
  })

  it('un stockage inaccessible n’empêche pas d’utiliser la liste fournie', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage refusé')
    })
    expect(documentsPourSynthese<Doc>([FACTURE_SOCIETE], COMPTE, true).map(d => d.id)).toEqual(['f-1'])
  })
})
