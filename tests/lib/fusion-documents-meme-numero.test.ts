// tests/lib/fusion-documents-meme-numero.test.ts
//
// Fusion des listes de devis et factures (base + navigateur) quand DEUX documents distincts portent le même numéro
// (constat documents-cycle-1 de l'audit des fondations BTP du 11/11/2026) : facture A numérotée hors connexion par le
// navigateur, facture B numérotée par le serveur, même numéro FACT-2026-012.
//
// Avant : la fusion par numéro ne gardait qu'un des deux (result[idx] = d), puis le tableau de bord réécrivait le
// stockage du navigateur sans l'autre — une facture déjà remise au client disparaissait du logiciel, et le miroir
// serveur du stockage recopiait la perte sur les autres appareils.
// Désormais, pour une société BTP (option conserverIdsDistincts) : deux identifiants stables (UUID) différents sont
// deux documents, gardés tous les deux, dans la liste ET dans le stockage du navigateur.
// Inchangé : même identifiant → même document ; copie locale à identifiant historique (horodaté, non UUID) et copie
// de la base au même numéro → un seul document (incident des doublons du 05/06/2026) ; artisan : fusion d'origine.

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dedupeDocsByIdentity, docIdentityKey, memeDocument, numeroPorteParUnAutreDocument, optionsFusionPourRole } from '../../lib/devis-utils'
import { fusionnerDocumentsDeLaBase, persistEmittedDocsToCache } from '../../lib/document-sync'
import { cleDocument, cleDocumentBtp } from '../../components/dashboard/documents/OutilsListeDocuments'

const NUMERO = 'FACT-2026-012'
const A = { id: '6f1c2a34-0000-4000-8000-0000000000a1', docNumber: NUMERO, docType: 'facture', status: 'envoye', clientName: 'Client A' }
const B = { id: '6f1c2a34-0000-4000-8000-0000000000b1', docNumber: NUMERO, docType: 'facture', status: 'pending', clientName: 'Client B', _fromSupabase: true }
const BTP = { conserverIdsDistincts: true }
const AID = 'fiche-btp-1'
const CLE = `fixit_documents_${AID}`

beforeEach(() => { localStorage.clear() })

describe('dedupeDocsByIdentity — deux documents au même numéro', () => {
  it('BTP : identifiants stables différents → les deux documents restent', () => {
    expect(dedupeDocsByIdentity([A], [B], BTP)).toEqual([A, B])
  })

  it('BTP : rafraîchissement (liste et navigateur contiennent déjà les deux) → toujours deux', () => {
    expect(dedupeDocsByIdentity([A, B], [A, B], BTP)).toEqual([A, B])
  })

  it('BTP : même identifiant → la version entrante remplace l\'ancienne (inchangé)', () => {
    const Amaj = { ...A, clientName: 'Client A (modifié)' }
    expect(dedupeDocsByIdentity([A, B], [Amaj], BTP)).toEqual([Amaj, B])
  })

  it('BTP : copie locale à identifiant historique (non UUID) et copie de la base au même numéro → un seul document (inchangé)', () => {
    const { _fromSupabase: _base, ...copieLocale } = { ...B, id: '1779539827817' }
    expect(dedupeDocsByIdentity<Record<string, unknown>>([copieLocale], [B], BTP)).toEqual([B])
  })

  it('BTP : brouillons sans numéro, identité par identifiant (inchangé)', () => {
    const d1 = { id: '6f1c2a34-0000-4000-8000-0000000000d1', docNumber: '', status: 'brouillon' }
    const d2 = { id: '6f1c2a34-0000-4000-8000-0000000000d2', docNumber: '', status: 'brouillon' }
    expect(dedupeDocsByIdentity([d1], [d2, d1], BTP)).toEqual([d1, d2])
  })

  it('artisan (sans option) : fusion d\'origine par numéro, inchangée', () => {
    expect(dedupeDocsByIdentity([A], [B])).toEqual([B])
  })
})

describe('persistEmittedDocsToCache — stockage du navigateur réécrit après la fusion', () => {
  it('BTP : les deux documents au même numéro restent dans le stockage', () => {
    persistEmittedDocsToCache(AID, [A, B], BTP)
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([A, B])
  })

  it('artisan (sans option) : réécriture d\'origine, inchangée', () => {
    persistEmittedDocsToCache(AID, [A, B])
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([B])
  })
})

describe('fusionnerDocumentsDeLaBase — fusion du tableau de bord', () => {
  it('BTP : la facture locale A et la facture B de la base restent visibles et enregistrées', () => {
    localStorage.setItem(CLE, JSON.stringify([A]))
    const liste = fusionnerDocumentsDeLaBase(AID, [A], [B], optionsFusionPourRole('pro_societe'))
    expect(liste).toEqual([A, B])
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([A, B])
  })

  it('artisan : fusion et réécriture d\'origine, inchangées', () => {
    localStorage.setItem(CLE, JSON.stringify([A]))
    const liste = fusionnerDocumentsDeLaBase(AID, [A], [B], optionsFusionPourRole('artisan'))
    expect(liste).toEqual([B])
    expect(JSON.parse(localStorage.getItem(CLE)!)).toEqual([B])
  })

  it('l\'option n\'est donnée qu\'au rôle pro_societe', () => {
    expect(optionsFusionPourRole('pro_societe')).toEqual(BTP)
    for (const role of ['artisan', 'super_admin', 'pro_conciergerie', 'pro_gestionnaire', '', undefined]) {
      expect(optionsFusionPourRole(role)).toBeUndefined()
    }
  })

  it('tableau de bord : ses deux fusions (fiche société, compte sans fiche) passent l\'option du rôle', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(commun)/pro/dashboard/page.tsx'), 'utf8')
    expect(page.match(/fusionnerDocumentsDeLaBase\([^)]*optionsFusionPourRole\(role\)\)/g)).toHaveLength(2)
    expect(page).not.toMatch(/dedupeDocsByIdentity\(prev, sbDocs/)
  })
})

// Actions des listes Devis et Factures sur un document dont le numéro est porté par un autre (relecture adverse du lot,
// 16/11/2026) : même identité que la fusion BTP, et repérage du numéro en double avant une action que le serveur
// rattache au seul numéro (annulation, devis accepté ou refusé).
describe('memeDocument — même document pour une action de la liste', () => {
  it('BTP : identifiants stables différents → deux documents, même au même numéro', () => {
    expect(memeDocument(A, B, BTP)).toBe(false)
    const Amaj = { ...A, clientName: 'Client A (modifié)' }
    expect(memeDocument(A, Amaj, BTP)).toBe(true)
  })

  it('BTP : copie à identifiant historique (non UUID) au même numéro → même document, comme la fusion', () => {
    expect(memeDocument({ ...B, id: '1779539827817' }, B, BTP)).toBe(true)
  })

  it('sans option (artisan) : identité d\'origine par numéro définitif, et jamais deux documents sans identité', () => {
    expect(memeDocument(A, B)).toBe(true)
    expect(memeDocument(A, B)).toBe(docIdentityKey(A) === docIdentityKey(B))
    expect(memeDocument({ docNumber: '' }, { docNumber: '' })).toBe(false)
  })
})

describe('numeroPorteParUnAutreDocument — numéro en double avant une action par numéro', () => {
  it('un autre document non annulé porte le numéro → vrai, pour chacun des deux', () => {
    expect(numeroPorteParUnAutreDocument(A, [A, B])).toBe(true)
    expect(numeroPorteParUnAutreDocument(B, [A, B])).toBe(true)
  })

  it('le document seul, ou une autre copie de lui-même (même identifiant) → faux', () => {
    expect(numeroPorteParUnAutreDocument(A, [A])).toBe(false)
    const copieDeA = { ...A, clientName: 'Client A (copie)' }
    expect(numeroPorteParUnAutreDocument(A, [copieDeA])).toBe(false)
  })

  it('l\'autre document est annulé (base ou navigateur) → faux : le serveur refuse déjà toute action sur lui', () => {
    expect(numeroPorteParUnAutreDocument(A, [A, { ...B, status: 'cancelled' }])).toBe(false)
    expect(numeroPorteParUnAutreDocument(A, [A, { ...B, status: 'annule' }])).toBe(false)
  })

  it('brouillon sans numéro définitif (vide ou BR-) → faux', () => {
    const brouillon = { id: '6f1c2a34-0000-4000-8000-0000000000d1', docNumber: '', status: 'brouillon' }
    expect(numeroPorteParUnAutreDocument(brouillon, [brouillon, { ...brouillon, id: '6f1c2a34-0000-4000-8000-0000000000d2' }])).toBe(false)
    const provisoire = { ...brouillon, docNumber: 'BR-1779539827817' }
    expect(numeroPorteParUnAutreDocument(provisoire, [provisoire, { ...provisoire, id: '6f1c2a34-0000-4000-8000-0000000000d2' }])).toBe(false)
  })
})

describe('cleDocumentBtp — case à cocher d\'un document', () => {
  it('BTP : une clé par identifiant stable, même au même numéro', () => {
    expect(cleDocumentBtp(A)).not.toBe(cleDocumentBtp(B))
  })

  it('sans identifiant stable : la clé commune (cleDocument), inchangée', () => {
    const historique = { id: '1779539827817', docNumber: NUMERO }
    expect(cleDocumentBtp(historique)).toBe(cleDocument(historique))
    expect(cleDocument(A)).toBe(cleDocument(B))
  })
})
