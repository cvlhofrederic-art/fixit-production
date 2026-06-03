// tests/devis-form-artisan.test.ts
//
// Hardening du formulaire ARTISAN (components/DevisFactureForm.tsx).
// Côté artisan uniquement (orgRole 'artisan', franchise TVA 293 B) — ne touche
// JAMAIS le BTP (DevisFactureFormBTP). Chaque test cible un bug audité ; les
// helpers purs testés ici sont exportés depuis le composant et utilisés
// in-situ pour corriger le bug correspondant (TDD : test rouge d'abord).
//
// On importe le module composant (vérifié : s'importe proprement sous jsdom,
// ~1,6 s) pour exercer ses helpers purs sans monter le composant React lourd
// (jsPDF / generateDevisPdfV3). Les bugs purement DOM/état (refs, purge,
// flag isCustom) sont couverts via leurs helpers extraits.

import { describe, it, expect } from 'vitest'
import {
  computeRpcDocType,
  localFallbackDocPrefix,
  tvaRateForLocale,
  applyTvaRateToLines,
  applyTvaRateToFrais,
  applyTvaRateToCustomTables,
  nextNumericLineId,
  nextCustomTableId,
  regimeTvaForArtisan,
  isDocEmittedStatus,
  purgeDraftById,
  prepareConversionIdentity,
  safeMoney,
  shouldShowFreeTextInput,
} from '@/components/DevisFactureForm'
import type { ProductLine, FraisAnnexeItem, CustomTable } from '@/lib/devis-types'
import { isStableDocId } from '@/lib/devis-utils'

// ── Bug #1 — numérotation acompte (AC-) au lieu de FACT- ──────────────────────
describe('Bug #1 — computeRpcDocType : sous-type acompte → série dédiée', () => {
  it('facture standard reste "facture" (série FACT-)', () => {
    expect(computeRpcDocType('facture', 'standard')).toBe('facture')
  })
  it('facture + acompte devient "acompte" (série AC-)', () => {
    expect(computeRpcDocType('facture', 'acompte')).toBe('acompte')
  })
  it('facture + situation reste "facture" (situation = série FACT-)', () => {
    expect(computeRpcDocType('facture', 'situation')).toBe('facture')
  })
  it('devis reste "devis" quel que soit le sous-type (série DEV-)', () => {
    expect(computeRpcDocType('devis', 'acompte')).toBe('devis')
    expect(computeRpcDocType('devis', 'standard')).toBe('devis')
  })
  it('sous-type absent → docType brut', () => {
    expect(computeRpcDocType('facture', undefined)).toBe('facture')
    expect(computeRpcDocType('devis', undefined)).toBe('devis')
  })
})

describe('Bug #1 — localFallbackDocPrefix : préfixe localStorage cohérent', () => {
  it('devis → DEV', () => {
    expect(localFallbackDocPrefix('devis', 'standard')).toBe('DEV')
  })
  it('facture standard → FACT', () => {
    expect(localFallbackDocPrefix('facture', 'standard')).toBe('FACT')
  })
  it('facture + acompte → AC (pas FACT)', () => {
    expect(localFallbackDocPrefix('facture', 'acompte')).toBe('AC')
  })
  it('facture + situation → FACT', () => {
    expect(localFallbackDocPrefix('facture', 'situation')).toBe('FACT')
  })
})

// ── Bug #4 — toggle TVA applique le taux à TOUTES les lignes ──────────────────
describe('Bug #4 — tvaRateForLocale', () => {
  it('désactivé → 0 quel que soit le pays', () => {
    expect(tvaRateForLocale(false, 'fr')).toBe(0)
    expect(tvaRateForLocale(false, 'pt')).toBe(0)
  })
  it('activé FR → 20', () => {
    expect(tvaRateForLocale(true, 'fr')).toBe(20)
  })
  it('activé PT → 23', () => {
    expect(tvaRateForLocale(true, 'pt')).toBe(23)
  })
  it('locale autre que pt traitée comme FR (20)', () => {
    expect(tvaRateForLocale(true, 'en')).toBe(20)
    expect(tvaRateForLocale(true, 'es')).toBe(20)
  })
})

describe('Bug #4 — application du taux à toutes les familles de lignes', () => {
  const mkLine = (id: number, tvaRate: number): ProductLine => ({
    id, description: 'x', qty: 1, unit: 'u', priceHT: 10, tvaRate, totalHT: 10,
  })
  const mkFrais = (id: number, tva: number): FraisAnnexeItem => ({
    id, designation: 'déplacement', categorie: 'deplacement', quantite: 1,
    unite: 'forfait', prix_unitaire_ht: 5, tva_applicable: tva, total_ht: 5,
  })

  it('applyTvaRateToLines remappe tvaRate sur chaque ligne (immutable)', () => {
    const lines = [mkLine(1, 0), mkLine(2, 0)]
    const out = applyTvaRateToLines(lines, 20)
    expect(out.map(l => l.tvaRate)).toEqual([20, 20])
    expect(out).not.toBe(lines)
    expect(lines.map(l => l.tvaRate)).toEqual([0, 0]) // source intacte
  })
  it('applyTvaRateToLines à 0 remet tout à 0 (désactivation)', () => {
    const out = applyTvaRateToLines([mkLine(1, 20), mkLine(2, 20)], 0)
    expect(out.map(l => l.tvaRate)).toEqual([0, 0])
  })
  it('applyTvaRateToFrais cible le champ tva_applicable', () => {
    const out = applyTvaRateToFrais([mkFrais(1, 0), mkFrais(2, 0)], 23)
    expect(out.map(f => f.tva_applicable)).toEqual([23, 23])
  })
  it('applyTvaRateToCustomTables remappe tvaRate de chaque ligne de chaque table', () => {
    const tables: CustomTable[] = [
      { id: 'custom_1', name: 'Toiture', category: 'labor', lines: [mkLine(1, 0), mkLine(2, 0)] },
      { id: 'custom_2', name: 'Divers', category: 'material', lines: [mkLine(3, 0)] },
    ]
    const out = applyTvaRateToCustomTables(tables, 20)
    expect(out[0].lines.map(l => l.tvaRate)).toEqual([20, 20])
    expect(out[1].lines.map(l => l.tvaRate)).toEqual([20])
    // structure préservée
    expect(out[0].name).toBe('Toiture')
    expect(out[0].category).toBe('labor')
  })
})

// ── Bug #8 — collisions d'id de ligne (Date.now()) ───────────────────────────
describe('Bug #8 — nextNumericLineId : pas de collision sur ajouts rapides', () => {
  it('liste vide → 1', () => {
    expect(nextNumericLineId([])).toBe(1)
  })
  it('max(ids)+1', () => {
    expect(nextNumericLineId([{ id: 3 }, { id: 7 }, { id: 5 }])).toBe(8)
  })
  it('ignore les ids négatifs / non-finis (plancher 0)', () => {
    expect(nextNumericLineId([{ id: -10 }])).toBe(1)
    expect(nextNumericLineId([{ id: Number.NaN as unknown as number }])).toBe(1)
  })
  it('deux appels consécutifs sur la liste cumulée donnent des ids distincts', () => {
    let lines: { id: number }[] = []
    const id1 = nextNumericLineId(lines); lines = [...lines, { id: id1 }]
    const id2 = nextNumericLineId(lines); lines = [...lines, { id: id2 }]
    expect(id1).not.toBe(id2)
    expect(new Set(lines.map(l => l.id)).size).toBe(2)
  })
})

describe('Bug #8 — nextCustomTableId : id de table unique', () => {
  it('aucune table → custom_1', () => {
    expect(nextCustomTableId([])).toBe('custom_1')
  })
  it('incrémente le plus grand suffixe numérique existant', () => {
    expect(nextCustomTableId([{ id: 'custom_1' }, { id: 'custom_4' }])).toBe('custom_5')
  })
  it('ignore les ids non conformes (legacy horodaté)', () => {
    expect(nextCustomTableId([{ id: 'custom_1779539827817' }])).toMatch(/^custom_\d+$/)
  })
})

// ── Bug #9 — régime TVA persisté (franchise 293 B vs classique) ───────────────
describe('Bug #9 — regimeTvaForArtisan', () => {
  it('TVA activée → classique', () => {
    expect(regimeTvaForArtisan(true)).toBe('classique')
  })
  it('TVA désactivée (artisan EI/AE) → franchise_293b', () => {
    expect(regimeTvaForArtisan(false)).toBe('franchise_293b')
  })
})

// ── Bug #2 — émission ne doit pas régresser en brouillon via autosave ─────────
describe('Bug #2 — isDocEmittedStatus : garde autosave', () => {
  it('brouillon / draft / vide → non émis', () => {
    expect(isDocEmittedStatus('brouillon')).toBe(false)
    expect(isDocEmittedStatus('draft')).toBe(false)
    expect(isDocEmittedStatus('')).toBe(false)
    expect(isDocEmittedStatus(undefined)).toBe(false)
    expect(isDocEmittedStatus(null)).toBe(false)
  })
  it('envoye / paye / accepte → émis', () => {
    expect(isDocEmittedStatus('envoye')).toBe(true)
    expect(isDocEmittedStatus('paye')).toBe(true)
    expect(isDocEmittedStatus('accepte')).toBe(true)
  })
})

describe('Bug #2 — purgeDraftById : retire le brouillon de même id après émission', () => {
  it('supprime l\'entrée dont l\'id correspond, garde les autres', () => {
    const drafts = [{ id: 'a', x: 1 }, { id: 'b', x: 2 }, { id: 'c', x: 3 }]
    expect(purgeDraftById(drafts, 'b')).toEqual([{ id: 'a', x: 1 }, { id: 'c', x: 3 }])
  })
  it('id absent → liste inchangée (copie)', () => {
    const drafts = [{ id: 'a' }]
    const out = purgeDraftById(drafts, 'zzz')
    expect(out).toEqual(drafts)
  })
  it('id vide/undefined ne purge rien (évite de tout effacer)', () => {
    const drafts = [{ id: 'a' }, { id: '' }, {}]
    expect(purgeDraftById(drafts, '')).toEqual(drafts)
    expect(purgeDraftById(drafts, undefined)).toEqual(drafts)
  })
})

// ── Bug #3 — conversion devis→facture : nouvel id + numéro FACT- ──────────────
describe('Bug #3 — prepareConversionIdentity : ne réutilise pas l\'identité du devis', () => {
  it('retourne un nouvel UUID stable, distinct de l\'id du devis', () => {
    const { id } = prepareConversionIdentity('old-devis-uuid')
    expect(isStableDocId(id)).toBe(true)
    expect(id).not.toBe('old-devis-uuid')
  })
  it('réinitialise le numéro à vide (forcera un fetch FACT-)', () => {
    const { docNumber } = prepareConversionIdentity('whatever')
    expect(docNumber).toBe('')
  })
  it('deux conversions successives → deux ids différents', () => {
    const a = prepareConversionIdentity('x').id
    const b = prepareConversionIdentity('x').id
    expect(a).not.toBe(b)
  })
})

// ── Bug #6 — crash écran blanc sur ligne matériau legacy sans totalHT ─────────
describe('Bug #6 — safeMoney : tolère totalHT manquant', () => {
  it('nombre fini → inchangé', () => {
    expect(safeMoney(12.5)).toBe(12.5)
    expect(safeMoney(0)).toBe(0)
  })
  it('undefined / null / NaN → 0 (pas de throw)', () => {
    expect(safeMoney(undefined)).toBe(0)
    expect(safeMoney(null)).toBe(0)
    expect(safeMoney(Number.NaN)).toBe(0)
  })
  it('formatable sans erreur (reproduit l\'appel .toFixed(2))', () => {
    expect(() => safeMoney((undefined as unknown as number)).toFixed(2)).not.toThrow()
    expect(safeMoney(undefined).toFixed(2)).toBe('0.00')
  })
})

// ── Bug #7 — "Saisie libre" : le champ texte libre doit être visible ──────────
describe('Bug #7 — shouldShowFreeTextInput : champ libre visible après choix "custom"', () => {
  it('ligne non marquée custom, sans description → input caché (menu motif seul)', () => {
    expect(shouldShowFreeTextInput(1, new Set<number>(), '')).toBe(false)
  })
  it('ligne marquée custom, description encore vide → input visible', () => {
    expect(shouldShowFreeTextInput(1, new Set<number>([1]), '')).toBe(true)
  })
  it('description déjà saisie → input libre inutile (le bloc titre prend le relais)', () => {
    expect(shouldShowFreeTextInput(1, new Set<number>([1]), 'Pose carrelage')).toBe(false)
  })
  it('autre ligne marquée custom n\'affecte pas la ligne courante', () => {
    expect(shouldShowFreeTextInput(2, new Set<number>([1]), '')).toBe(false)
  })
})
