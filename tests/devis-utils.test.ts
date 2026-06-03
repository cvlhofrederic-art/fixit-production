import { describe, it, expect } from 'vitest'
import { titleCaseAddress, getDocSeq, stableDocId, isStableDocId, docIdentityKey, dedupeDocsByIdentity } from '../lib/devis-utils'

describe('stableDocId', () => {
  it('génère un UUID v4 valide', () => {
    expect(stableDocId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
  it('génère des identifiants uniques', () => {
    const ids = new Set(Array.from({ length: 200 }, () => stableDocId()))
    expect(ids.size).toBe(200)
  })
})

describe('isStableDocId — distingue un id canonique (UUID) d\'un id legacy', () => {
  it('vrai pour un UUID (stableDocId / crypto.randomUUID)', () => {
    expect(isStableDocId('50e30094-3af7-442b-b2b0-4e8c8fc12b64')).toBe(true)
    expect(isStableDocId(stableDocId())).toBe(true)
  })
  it('faux pour un id legacy horodaté (Date.now())', () => {
    expect(isStableDocId('1779539827817')).toBe(false)
  })
  it('faux pour chaîne vide, numéro de doc, ou valeur non-string', () => {
    expect(isStableDocId('')).toBe(false)
    expect(isStableDocId('DEV-2026-010')).toBe(false)
    expect(isStableDocId(null)).toBe(false)
    expect(isStableDocId(undefined)).toBe(false)
    expect(isStableDocId(1779539827817)).toBe(false)
  })
})

describe('docIdentityKey', () => {
  it('priorise id sur docNumber', () => {
    expect(docIdentityKey({ id: 'abc', docNumber: 'FACT-2026-001' })).toBe('abc')
  })
  it('retombe sur docNumber quand id absent (legacy)', () => {
    expect(docIdentityKey({ docNumber: 'FACT-2026-001' })).toBe('FACT-2026-001')
  })
  it('chaîne vide si ni id ni docNumber, ou null', () => {
    expect(docIdentityKey({})).toBe('')
    expect(docIdentityKey(null)).toBe('')
  })
})

describe('dedupeDocsByIdentity', () => {
  it('incoming prime sur existing à id égal, ordre d\'existing préservé', () => {
    const existing = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }]
    const incoming = [{ id: 'b', v: 2 }, { id: 'c', v: 2 }]
    expect(dedupeDocsByIdentity(existing, incoming)).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 2 }])
  })
  it('deux brouillons sans numéro mais id distincts ne fusionnent pas', () => {
    expect(dedupeDocsByIdentity([], [{ id: 'x', docNumber: '' }, { id: 'y', docNumber: '' }])).toHaveLength(2)
  })
  it('fusionne brouillon puis émis (même id, numéro attribué à la validation)', () => {
    const draft = { id: 'k', docNumber: '', status: 'draft' }
    const emitted = { id: 'k', docNumber: 'FACT-2026-017', status: 'envoye' }
    expect(dedupeDocsByIdentity([draft], [emitted])).toEqual([emitted])
  })
  it('les docs sans identité ne sont jamais écrasés entre eux', () => {
    expect(dedupeDocsByIdentity([{ x: 1 }, { x: 2 }], [{ x: 3 }])).toHaveLength(3)
  })
})

describe('dedupeDocsByIdentity — convergence par docNumber (fix doublons local-id / cloud-UUID)', () => {
  const UUID = '50e30094-3af7-442b-b2b0-4e8c8fc12b64'
  const UUID2 = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
  // Forme souple pour des entrées hétérogènes (champs présents d'un seul côté)
  // sans que l'inférence de T contraigne les deux listes à la même forme.
  type Doc = { id?: string; docNumber?: string; status?: string; sentAt?: string; savedAt?: string; clientPhone?: string }

  it('collapse une paire (id horodaté legacy) + (UUID cloud) de MÊME docNumber en une seule entrée', () => {
    const local = { id: '1779539827817', docNumber: 'FACT-2026-017', status: 'envoye' }
    const cloud = { id: UUID, docNumber: 'FACT-2026-017', status: 'envoye' }
    const out = dedupeDocsByIdentity([local], [cloud])
    expect(out).toHaveLength(1)
    // L'entrée survivante porte l'id canonique (UUID cloud), pas l'id horodaté.
    expect(out[0].id).toBe(UUID)
  })

  it('préfère l\'id canonique (UUID) quel que soit l\'ordre existing/incoming', () => {
    const local = { id: '1779539827817', docNumber: 'DEV-2026-003' }
    const cloud = { id: UUID, docNumber: 'DEV-2026-003' }
    // UUID dans existing, legacy dans incoming → survivant = UUID
    const a = dedupeDocsByIdentity([cloud], [local])
    expect(a).toHaveLength(1)
    expect(a[0].id).toBe(UUID)
    // legacy dans existing, UUID dans incoming → survivant = UUID
    const b = dedupeDocsByIdentity([local], [cloud])
    expect(b).toHaveLength(1)
    expect(b[0].id).toBe(UUID)
  })

  it('conserve les données les plus complètes (union des champs, le canonique prime sur conflit)', () => {
    // Le local a un champ que le cloud n'a pas (clientPhone) ; le cloud a un statut frais.
    const local: Doc = { id: '1779539827817', docNumber: 'FACT-2026-018', status: 'brouillon', clientPhone: '0600000000' }
    const cloud: Doc = { id: UUID, docNumber: 'FACT-2026-018', status: 'envoye', sentAt: '2026-06-01T10:00:00Z' }
    const out = dedupeDocsByIdentity([local], [cloud])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(UUID)
    // Champ cloud-only conservé
    expect(out[0].sentAt).toBe('2026-06-01T10:00:00Z')
    // Champ local-only conservé (donnée la plus complète)
    expect(out[0].clientPhone).toBe('0600000000')
    // Conflit (status) résolu en faveur du canonique cloud
    expect(out[0].status).toBe('envoye')
  })

  it('NE fusionne PAS deux docs sans docNumber (brouillons) même si présents des deux côtés', () => {
    // Régression : drafts sans numéro doivent rester distincts (clé id only).
    const d1 = { id: '1779000000001', docNumber: '' }
    const d2 = { id: '1779000000002', docNumber: '' }
    const d3 = { id: '1779000000003' } // pas de docNumber du tout
    expect(dedupeDocsByIdentity([d1, d2], [d3])).toHaveLength(3)
  })

  it('NE fusionne PAS deux docNumbers différents', () => {
    const a = { id: UUID, docNumber: 'FACT-2026-001' }
    const b = { id: UUID2, docNumber: 'FACT-2026-002' }
    expect(dedupeDocsByIdentity([a], [b])).toHaveLength(2)
  })

  it('préserve la position de la première occurrence du docNumber (stabilité de liste UI)', () => {
    const x = { id: 'x', docNumber: '' }
    const localPair = { id: '1779539827817', docNumber: 'FACT-2026-020' }
    const y = { id: 'y', docNumber: '' }
    const cloudPair = { id: UUID, docNumber: 'FACT-2026-020' }
    // existing = [x, localPair, y], incoming = [cloudPair]
    // localPair et cloudPair convergent ; le survivant garde la place de localPair (index 1)
    const out = dedupeDocsByIdentity([x, localPair, y], [cloudPair])
    expect(out).toHaveLength(3)
    expect(out.map(d => d.id)).toEqual(['x', UUID, 'y'])
  })

  it('si AUCUN des deux n\'est un UUID canonique, collapse quand même par docNumber (incoming prime)', () => {
    // Deux copies legacy du même doc (avant migration UUID) : on en garde une.
    const oldLocal = { id: '1779000000010', docNumber: 'FACT-2026-021', status: 'brouillon' }
    const newLocal = { id: '1779000000011', docNumber: 'FACT-2026-021', status: 'envoye' }
    const out = dedupeDocsByIdentity([oldLocal], [newLocal])
    expect(out).toHaveLength(1)
    // Pas de UUID dispo → incoming prime (donnée la plus récente)
    expect(out[0].status).toBe('envoye')
  })

  it('legacy SANS id mais avec docNumber + UUID même docNumber → un seul, id canonique', () => {
    const legacyNoId: Doc = { docNumber: 'FACT-2026-022', status: 'envoye', savedAt: '2026-05-01T08:00:00Z' }
    const cloud: Doc = { id: UUID, docNumber: 'FACT-2026-022', status: 'envoye' }
    const out = dedupeDocsByIdentity([legacyNoId], [cloud])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe(UUID)
    expect(out[0].savedAt).toBe('2026-05-01T08:00:00Z')
  })

  it('ne casse PAS le merge brouillon→émis par id égal (cas existant) quand un docNumber apparaît', () => {
    // Même id 'k' : géré par la passe id, jamais par la passe docNumber.
    const draft = { id: 'k', docNumber: '', status: 'draft' }
    const emitted = { id: 'k', docNumber: 'FACT-2026-017', status: 'envoye' }
    expect(dedupeDocsByIdentity([draft], [emitted])).toEqual([emitted])
  })
})

describe('titleCaseAddress', () => {
  it('returns input unchanged when not all-caps (already normalised)', () => {
    expect(titleCaseAddress('12 Rue de la Paix')).toBe('12 Rue de la Paix')
  })

  it('returns empty string unchanged', () => {
    expect(titleCaseAddress('')).toBe('')
  })

  it('title-cases a basic French street address', () => {
    expect(titleCaseAddress('12 RUE DE LA PAIX')).toBe('12 Rue de la Paix')
  })

  it('title-cases a hyphenated city (Aix-en-Provence)', () => {
    expect(titleCaseAddress('13290 AIX-EN-PROVENCE')).toBe('13290 Aix-en-Provence')
  })

  it('title-cases a full Kbis-style ALL CAPS address', () => {
    expect(titleCaseAddress('KINNOVA GROUP 115 RUE CLAUDE NICOLAS LEDOUX 13290 AIX-EN-PROVENCE')).toBe(
      'Kinnova Group 115 Rue Claude Nicolas Ledoux 13290 Aix-en-Provence',
    )
  })

  it('handles L\' particle correctly (typographic apostrophe)', () => {
    expect(titleCaseAddress('RUE DE L’ÉGLISE')).toBe('Rue de l’Église')
  })

  it('handles L\' particle correctly (straight apostrophe)', () => {
    expect(titleCaseAddress("RUE DE L'EGLISE")).toBe('Rue de l’Eglise')
  })

  it('handles D\' particle correctly (Rue d\'Aix)', () => {
    expect(titleCaseAddress("RUE D'AIX")).toBe('Rue d’Aix')
  })

  it('handles common French abbreviations', () => {
    expect(titleCaseAddress('AV DE LA REPUBLIQUE')).toBe('Av. de la Republique')
    expect(titleCaseAddress('BD HAUSSMANN')).toBe('Bd Haussmann')
  })

  it('preserves 5-digit postal codes as-is', () => {
    expect(titleCaseAddress('75001 PARIS')).toBe('75001 Paris')
  })

  it('preserves comma separators', () => {
    expect(titleCaseAddress('12 RUE DE LA PAIX, 75001 PARIS')).toBe('12 Rue de la Paix, 75001 Paris')
  })
})

describe('getDocSeq — tri factures par numéro émis', () => {
  // Régression incident Sud travaux 2026-05-26 : la facture FACT-2026-001 créée
  // pendant le bug avait un created_at plus récent que les autres, et apparaissait
  // donc en tête de liste alors qu'elle a le plus petit numéro. Le tri doit se
  // baser sur la séquence du numéro, pas sur la date de création.

  it("retourne une valeur ordonnable pour le format FACT-YYYY-NNN", () => {
    expect(getDocSeq({ docNumber: 'FACT-2026-001' })).toBe(2026000001)
    expect(getDocSeq({ docNumber: 'FACT-2026-009' })).toBe(2026000009)
    expect(getDocSeq({ docNumber: 'DEV-2026-012' })).toBe(2026000012)
  })

  it("trie correctement une liste mixte FACT/DEV par numéro décroissant", () => {
    const docs = [
      { docNumber: 'FACT-2026-001' },
      { docNumber: 'FACT-2026-009' },
      { docNumber: 'FACT-2026-002' },
      { docNumber: 'FACT-2026-008' },
    ]
    const sorted = [...docs].sort((a, b) => getDocSeq(b) - getDocSeq(a))
    expect(sorted.map(d => d.docNumber)).toEqual([
      'FACT-2026-009',
      'FACT-2026-008',
      'FACT-2026-002',
      'FACT-2026-001',
    ])
  })

  it("place les brouillons (BR-timestamp) en tête en ordre décroissant", () => {
    const docs = [
      { docNumber: 'FACT-2026-005' },
      { docNumber: 'BR-1779749904726' },
      { docNumber: 'FACT-2026-002' },
    ]
    const sorted = [...docs].sort((a, b) => getDocSeq(b) - getDocSeq(a))
    // BR-... → MAX_SAFE_INTEGER → en tête
    expect(sorted[0].docNumber).toBe('BR-1779749904726')
    expect(sorted[1].docNumber).toBe('FACT-2026-005')
    expect(sorted[2].docNumber).toBe('FACT-2026-002')
  })

  it("traite l'année comme partie ordonnable (2027 > 2026)", () => {
    expect(getDocSeq({ docNumber: 'FACT-2027-001' })).toBeGreaterThan(
      getDocSeq({ docNumber: 'FACT-2026-999' }),
    )
  })

  it("renvoie MAX_SAFE_INTEGER pour un docNumber absent ou malformé", () => {
    expect(getDocSeq({})).toBe(Number.MAX_SAFE_INTEGER)
    expect(getDocSeq({ docNumber: '' })).toBe(Number.MAX_SAFE_INTEGER)
    expect(getDocSeq({ docNumber: 'truc-bidule' })).toBe(Number.MAX_SAFE_INTEGER)
  })
})
