import { describe, it, expect } from 'vitest'
import { titleCaseAddress, getDocSeq, stableDocId, isStableDocId, docIdentityKey, dedupeDocsByIdentity, compareDocsForList, getDocSeries } from '../lib/devis-utils'

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
  it('numéro DÉFINITIF (FACT-/DEV-/AC-/AV-) prime sur id → anti-doublon', () => {
    // Même doc émis présent en localStorage (id legacy horodaté) ET en DB (UUID) :
    // l'identité par numéro évite qu'il apparaisse 2 fois (incident 2026-06-05).
    expect(docIdentityKey({ id: '1779539827817', docNumber: 'FACT-2026-001' })).toBe('FACT-2026-001')
    expect(docIdentityKey({ id: 'uuid-1', docNumber: 'AC-2026-002' })).toBe('AC-2026-002')
  })
  it('retombe sur docNumber quand id absent (legacy)', () => {
    expect(docIdentityKey({ docNumber: 'FACT-2026-001' })).toBe('FACT-2026-001')
  })
  it('BROUILLON (BR- ou sans numéro) → identité par id (numéro pas encore légal)', () => {
    expect(docIdentityKey({ id: 'abc', docNumber: 'BR-2026-001' })).toBe('abc')
    expect(docIdentityKey({ id: 'abc' })).toBe('abc')
    // BR- sans id → repli sur le numéro provisoire
    expect(docIdentityKey({ docNumber: 'BR-2026-001' })).toBe('BR-2026-001')
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
  it('DOUBLON corrigé : même numéro définitif, id legacy (localStorage) vs UUID (DB) → 1 seul', () => {
    const fromLocal = { id: '1779539827817', docNumber: 'FACT-2026-016', status: 'envoye' }
    const fromDb = { id: '50e30094-3af7-442b-b2b0-4e8c8fc12b64', docNumber: 'FACT-2026-016', status: 'pending' }
    const merged = dedupeDocsByIdentity([fromLocal], [fromDb])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual(fromDb) // incoming (DB) prime
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

describe('getDocSeries — extrait le préfixe de série', () => {
  it('reconnaît les séries usuelles', () => {
    expect(getDocSeries({ docNumber: 'FACT-2026-001' })).toBe('FACT')
    expect(getDocSeries({ docNumber: 'AC-2026-002' })).toBe('AC')
    expect(getDocSeries({ docNumber: 'AV-2026-003' })).toBe('AV')
    expect(getDocSeries({ docNumber: 'BR-2026-004' })).toBe('BR')
    expect(getDocSeries({ docNumber: 'DEV-2026-005' })).toBe('DEV')
    expect(getDocSeries({ docNumber: 'ORC-2026-038' })).toBe('ORC')
  })
  it('renvoie chaîne vide si numéro absent ou malformé', () => {
    expect(getDocSeries({})).toBe('')
    expect(getDocSeries({ docNumber: '' })).toBe('')
    expect(getDocSeries({ docNumber: 'brouillon' })).toBe('')
  })
})

describe('compareDocsForList — tri liste Devis/Factures', () => {
  it('même série : seq DESC (résout le bug user du 8 juin — FACT-003 ne doit pas passer avant FACT-004)', () => {
    // Scénario réel : 4 factures FACT- avec timestamps NON alignés sur le seq.
    // FACT-003 a été ré-enregistrée APRÈS FACT-004 → savedAt 003 > savedAt 004,
    // mais l'utilisateur attend l'ordre numérique strict.
    const docs = [
      { docNumber: 'FACT-2026-003', savedAt: '2026-06-08T15:00:00.000Z' },
      { docNumber: 'FACT-2026-004', savedAt: '2026-06-08T10:00:00.000Z' },
      { docNumber: 'FACT-2026-002', savedAt: '2026-06-05T09:00:00.000Z' },
      { docNumber: 'FACT-2026-001', savedAt: '2026-05-20T09:00:00.000Z' },
    ]
    const sorted = [...docs].sort(compareDocsForList).map(d => d.docNumber)
    expect(sorted).toEqual(['FACT-2026-004', 'FACT-2026-003', 'FACT-2026-002', 'FACT-2026-001'])
  })

  it('séries différentes : un acompte récent passe AVANT une facture plus ancienne (préserve l\'intent de getDocTime)', () => {
    // Cas couvert par devis-doc-time.test.ts — préservé via le fallback time.
    const docs = [
      { docNumber: 'FACT-2026-017', sentAt: '2026-06-04T09:00:00.000Z' },
      { docNumber: 'AC-2026-002', sentAt: '2026-06-05T15:00:00.000Z' },
    ]
    const sorted = [...docs].sort(compareDocsForList).map(d => d.docNumber)
    expect(sorted).toEqual(['AC-2026-002', 'FACT-2026-017'])
  })

  it('séries mixtes intercalées : seq DESC par série + time DESC entre séries', () => {
    const docs = [
      { docNumber: 'AC-2026-001', sentAt: '2026-05-01T10:00:00.000Z' },
      { docNumber: 'FACT-2026-005', sentAt: '2026-06-03T10:00:00.000Z' },
      { docNumber: 'AC-2026-002', sentAt: '2026-06-08T10:00:00.000Z' },
      { docNumber: 'FACT-2026-006', sentAt: '2026-06-07T10:00:00.000Z' },
    ]
    const sorted = [...docs].sort(compareDocsForList).map(d => d.docNumber)
    // AC-002 (08/06) > FACT-006 (07/06) > FACT-005 (03/06) > AC-001 (01/05)
    // mais FACT-005 et FACT-006 doivent rester groupés en seq DESC
    // entre eux. Comparator transitif → résultat : AC-002, FACT-006, FACT-005, AC-001.
    expect(sorted).toEqual(['AC-2026-002', 'FACT-2026-006', 'FACT-2026-005', 'AC-2026-001'])
  })

  it('docs sans numéro (brouillons) restent triés par date', () => {
    const docs = [
      { savedAt: '2026-06-05T10:00:00.000Z' },
      { savedAt: '2026-06-08T10:00:00.000Z' },
    ]
    const sorted = [...docs].sort(compareDocsForList).map(d => d.savedAt)
    expect(sorted).toEqual(['2026-06-08T10:00:00.000Z', '2026-06-05T10:00:00.000Z'])
  })
})
