// tests/lib/facture-depuis-devis.test.ts
//
// « Facturer → Facture totale » côté BTP : la facture est construite directement depuis le
// devis (lib/facture-depuis-devis.ts). Montants du devis repris tels que le formulaire les
// affiche, date du jour, lien vers le devis, acomptes déjà facturés déduits taux par taux, et
// refus explicites (devis non validé ou refusé, client absent, montant nul, prestation future,
// régime de TVA incohérent, devis déjà facturé, acomptes couvrant tout le devis).

import { describe, it, expect } from 'vitest'
import { buildAcompteParTauxPrefill } from '../../lib/acompte-par-taux'
import { buildAcomptePrefill } from '../../lib/acompte-prefill'
import { computeDocumentTotalHT, buildDocumentLines, negateDocumentLines } from '../../lib/devis-totals'
import {
  acomptesDejaFacturesPourDevis,
  acomptesEmisPourDevis,
  buildFactureDepuisDevis,
  controlerAcompteSurDevis,
  facturesEmisesPourDevis,
  ID_TABLE_ACOMPTES_DEDUITS,
} from '../../lib/facture-depuis-devis'
import { computeTva } from '../../lib/tva-calculator'

type Doc = Record<string, unknown>

const ligne = (id: number, totalHT: number, tvaRate: number, description = `Ligne ${id}`) => ({
  id, description, qty: 1, unit: 'u', priceHT: totalHT, tvaRate, totalHT,
})

const DEVIS: Doc = {
  id: '6f1c2a34-0000-4000-8000-000000000001', docType: 'devis', docNumber: 'DEV-2026-009', docDate: '2026-09-12',
  docTitle: 'Rénovation salle de bain', status: 'envoye', savedAt: '2026-09-12T08:00:00.000Z', sentAt: '2026-09-12T08:00:00.000Z',
  signatureData: 'data:image/png;base64,xxx',
  clientName: 'Marie Dubois', clientType: 'particulier', regimeTva: 'classique', tvaEnabled: true,
  paymentDelay: '30 jours', insuranceName: 'AXA', insuranceNumber: 'RC-123',
  lines: [ligne(1, 3000, 10, 'Dépose et pose faïence'), ligne(2, 1200, 20, 'Meuble vasque')],
  materialLines: [ligne(3, 420, 20, 'Faïence')],
  fraisLines: [ligne(4, 80, 20, 'Déplacement')],
  customTables: [{ id: 'lot-1', name: 'Lot électricité', lines: [ligne(5, 1500, 10, 'Tableau')] }],
  acomptesEnabled: true,
  acomptes: [{ id: 'a1', ordre: 1, label: 'Signature', pourcentage: 30, declencheur: 'À la signature' }],
}

const AUJOURD_HUI = '2026-10-04'
const options = (factures: Doc[] = []) => ({ factures, aujourdHui: AUJOURD_HUI })
const totalHT = (doc: Doc) => computeDocumentTotalHT(doc as Parameters<typeof computeDocumentTotalHT>[0])

/** Acompte émis (forme « une ligne par taux ») sur le devis. */
const acompteEmis = (pourcentage: number, numero: string, ordre = 1, devis: Doc = DEVIS): Doc => ({
  ...buildAcompteParTauxPrefill(devis, { percentage: pourcentage, ordre, total: 3, declencheur: 'À la signature' }),
  id: `ac-${numero}`, docNumber: numero, status: 'envoye', docDate: '2026-09-15',
})

/** Avoir émis sur une facture : total (toutes les lignes négativées) ou partiel (une ligne négative). */
const avoirTotal = (facture: Doc, numero: string): Doc => ({
  ...negateDocumentLines(facture as Parameters<typeof negateDocumentLines>[0]),
  id: `av-${numero}`, docType: 'facture', factureSubType: 'avoir', docNumber: numero, status: 'envoye', parentInvoiceNumber: facture.docNumber,
})
const avoirPartiel = (facture: Doc, numero: string, montantHT: number, tvaRate: number): Doc => ({
  id: `av-${numero}`, docType: 'facture', factureSubType: 'avoir', docNumber: numero, status: 'envoye',
  parentInvoiceNumber: facture.docNumber, regimeTva: 'classique', lines: [ligne(1, -montantHT, tvaRate, 'Annulation partielle')],
})

const tvaDe = (doc: Doc) =>
  computeTva({ regime: 'classique', lines: buildDocumentLines(doc as Parameters<typeof buildDocumentLines>[0]).map((l) => ({ totalHT: Number(l.totalHT ?? 0), tvaRate: Number(l.tvaRate ?? 0) })) })

const tableDeduction = (payload: Doc) =>
  (payload.customTables as { id: string; name: string; lines: { description: string; totalHT: number; tvaRate: number; qty: number; priceHT: number }[] }[])
    .find((t) => t.id === ID_TABLE_ACOMPTES_DEDUITS)

describe('buildFactureDepuisDevis — facture totale sans acompte', () => {
  const resultat = buildFactureDepuisDevis(DEVIS, options())

  it('reprend tous les montants du devis (lignes, matériaux, frais, lots)', () => {
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(totalHT(resultat.payload)).toBe(6200)
    expect(resultat.payload.lines).toEqual(DEVIS.lines)
    expect(resultat.payload.materialLines).toEqual(DEVIS.materialLines)
    expect(resultat.payload.fraisLines).toEqual(DEVIS.fraisLines)
    expect(resultat.payload.customTables).toEqual(DEVIS.customTables)
    expect(resultat.acomptesDeduits).toEqual([])
  })

  it('est une facture standard datée du jour, reliée au devis, sans identité ni numéro hérités', () => {
    if (!resultat.ok) throw new Error('facture attendue')
    const f = resultat.payload
    expect(f.docType).toBe('facture')
    expect(f.factureSubType).toBe('standard')
    expect(f.docDate).toBe(AUJOURD_HUI)
    expect(f.prestationDate).toBe(AUJOURD_HUI)
    expect(f.sourceDevisNumber).toBe('DEV-2026-009')
    expect(f.sourceDevisId).toBe(DEVIS.id)
    expect(f.docTitle).toBe('Rénovation salle de bain')
    for (const champ of ['id', 'docNumber', 'status', 'savedAt', 'sentAt', 'signatureData']) expect(f).not.toHaveProperty(champ)
  })

  it('conserve les mentions portées par le devis (client, paiement, assurance, régime)', () => {
    if (!resultat.ok) throw new Error('facture attendue')
    expect(resultat.payload).toMatchObject({ clientName: 'Marie Dubois', paymentDelay: '30 jours', insuranceName: 'AXA', insuranceNumber: 'RC-123', regimeTva: 'classique' })
  })

  it('garde la date de prestation du devis quand elle est passée', () => {
    const r = buildFactureDepuisDevis({ ...DEVIS, prestationDate: '2026-09-30' }, options())
    expect(r.ok && r.payload.prestationDate).toBe('2026-09-30')
  })

  it('ne porte jamais l\'échéancier du devis (sinon « → Acompte » proposerait un acompte sur le solde)', () => {
    const r = buildFactureDepuisDevis(DEVIS, options())
    expect(r.ok && r.payload.acomptesEnabled).toBe(false)
    expect(r.ok && r.payload.acomptes).toEqual([])
  })

  it('renvoie le total HT émis, en centimes', () => {
    const r = buildFactureDepuisDevis(DEVIS, options())
    expect(r.ok && r.totalHtCents).toBe(620000)
    const solde = buildFactureDepuisDevis(DEVIS, options([acompteEmis(30, 'AC-2026-001')]))
    expect(solde.ok && solde.totalHtCents).toBe(434000)
  })

  it('titre : le mot « Devis » en tête devient « Facture » ; le reste du titre est conservé', () => {
    const titre = (docTitle: string, factures: Doc[] = []) => {
      const r = buildFactureDepuisDevis({ ...DEVIS, docTitle }, options(factures))
      return r.ok && r.payload.docTitle
    }
    expect(titre('Devis rénovation cuisine')).toBe('Facture rénovation cuisine')
    expect(titre('Devis')).toBe('Facture')
    expect(titre('Devisage du chantier')).toBe('Devisage du chantier')
    expect(titre('')).toBe('')
    expect(titre('Devis : rénovation cuisine', [acompteEmis(30, 'AC-2026-001')])).toBe('Facture de solde — rénovation cuisine')
    expect(titre('', [acompteEmis(30, 'AC-2026-001')])).toBe('Facture de solde')
    // Même casse et même langue que le mot remplacé ; le reste du titre n'est pas touché.
    expect(titre('DEVIS RÉNOVATION')).toBe('FACTURE RÉNOVATION')
    expect(titre('Orçamento cozinha')).toBe('Fatura cozinha')
    expect(titre('Devis T2 appartement')).toBe('Facture T2 appartement')
    expect(titre('Devis nouvelle cuisine')).toBe('Facture nouvelle cuisine')
    // Un numéro de devis en tête ne doit pas passer pour un numéro de facture.
    expect(titre('Devis n° 12 — cuisine')).toBe('cuisine')
    expect(titre('Devis DEV-2026-009 : cuisine')).toBe('cuisine')
    expect(titre('Devis n° 12 — cuisine', [acompteEmis(30, 'AC-2026-001')])).toBe('Facture de solde — cuisine')
  })

  it('devis signé ou accepté : la facture cite le devis (mention « conformément au devis signé » du PDF)', () => {
    const signe = buildFactureDepuisDevis({ ...DEVIS, status: 'signe', notes: 'Accès par la cour.' }, options())
    expect(signe.ok && signe.payload.notes).toBe('Accès par la cour.\nRéf. devis : DEV-2026-009')
    const accepte = buildFactureDepuisDevis({ ...DEVIS, status: 'accepte' }, options())
    expect(accepte.ok && accepte.payload.notes).toBe('Réf. devis : DEV-2026-009')
    // Devis simplement envoyé : pas de « devis signé » affirmé à tort.
    const envoye = buildFactureDepuisDevis({ ...DEVIS, notes: 'Accès par la cour.' }, options())
    expect(envoye.ok && envoye.payload.notes).toBe('Accès par la cour.')
    const pt = buildFactureDepuisDevis({ ...DEVIS, status: 'signed' }, { ...options(), locale: 'pt' })
    expect(pt.ok && pt.payload.notes).toBe('Ref. orçamento: DEV-2026-009')
    // Notes qui citent déjà une référence lisible par le PDF : rien n'est ajouté.
    const dejaCite = buildFactureDepuisDevis({ ...DEVIS, status: 'signe', notes: 'Réf. devis : DEV-2026-009' }, options())
    expect(dejaCite.ok && dejaCite.payload.notes).toBe('Réf. devis : DEV-2026-009')
    // Mention libre que le PDF ne sait pas lire : la référence est ajoutée sur sa propre ligne.
    const libre = buildFactureDepuisDevis({ ...DEVIS, status: 'signe', notes: 'Réf. devis client 4521' }, options())
    expect(libre.ok && libre.payload.notes).toBe('Réf. devis client 4521\nRéf. devis : DEV-2026-009')
  })

  it('ligne héritée sans désignation, ou ligne null : désignation vide en texte, ligne null écartée (le PDF appelle .trim())', () => {
    const devis = {
      ...DEVIS,
      lines: [null, { id: 1, qty: 1, unit: 'u', priceHT: 500, tvaRate: 20, totalHT: 500 }, { id: 2, description: null, qty: 1, unit: 'u', priceHT: 100, tvaRate: 20, totalHT: 100 }],
      materialLines: [null],
      customTables: [{ id: 'lot-1', name: 'Lot', lines: [null, ligne(5, 1500, 10, 'Tableau')] }],
    }
    const r = buildFactureDepuisDevis(devis, options())
    if (!r.ok) throw new Error('facture attendue')
    expect((r.payload.lines as { description: unknown }[]).map((l) => l.description)).toEqual(['', ''])
    expect(r.payload.materialLines).toEqual([])
    expect((r.payload.customTables as { lines: unknown[] }[])[0].lines).toHaveLength(1)
  })

  it('ne modifie pas le devis', () => {
    const avant = JSON.stringify(DEVIS)
    buildFactureDepuisDevis(DEVIS, options([acompteEmis(30, 'AC-2026-001')]))
    expect(JSON.stringify(DEVIS)).toBe(avant)
  })

  it('total de ligne périmé : la facture porte quantité × prix, comme le formulaire l\'affiche', () => {
    // Prestation changée après saisie de la quantité : le formulaire stockait 1 × prix.
    const devis = { ...DEVIS, lines: [{ id: 1, description: 'Faïence', qty: 12, unit: 'm2', priceHT: 85, tvaRate: 10, totalHT: 85 }], materialLines: [], fraisLines: [], customTables: [] }
    const r = buildFactureDepuisDevis(devis, options())
    if (!r.ok) throw new Error('facture attendue')
    expect((r.payload.lines as { totalHT: number }[])[0].totalHT).toBe(1020)
    expect(totalHT(r.payload)).toBe(1020)
  })

  it('ancien devis sans regimeTva mais en autoliquidation : le régime est écrit sur la facture', () => {
    const { regimeTva: _regime, ...sansRegime } = DEVIS
    const r = buildFactureDepuisDevis({ ...sansRegime, autoliquidationBTP: true, clientType: 'professionnel', clientSiret: '552 100 554 00013', tvaNumber: 'FR12345678901' }, options())
    expect(r.ok && r.payload.regimeTva).toBe('autoliquidation_btp')
  })
})

describe('buildFactureDepuisDevis — déduction des acomptes déjà facturés', () => {
  it('un acompte de 30 % : une ligne négative par taux, reliquat de 70 % HT et TVA', () => {
    const r = buildFactureDepuisDevis(DEVIS, options([acompteEmis(30, 'AC-2026-001')]))
    if (!r.ok) throw new Error('facture attendue')
    expect(r.payload.customTables).toHaveLength(2)
    const deduction = tableDeduction(r.payload)!
    expect(deduction.name).toBe('Acomptes déjà facturés (à déduire)')
    // Devis : 1 700 € à 20 %, 4 500 € à 10 % → acompte 30 % : 510 € et 1 350 €.
    expect(deduction.lines.map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, -510], [10, -1350]])
    expect(deduction.lines[0].description).toBe('Acompte déjà facturé — facture n° AC-2026-001 du 15/09/2026 — TVA 20 %')
    expect(deduction.lines.every((l) => l.qty === 1 && l.priceHT === l.totalHT)).toBe(true)
    expect(totalHT(r.payload)).toBe(4340)
    const tva = tvaDe(r.payload)
    expect(tva.breakdown).toEqual([{ rate: 10, base: 3150, amount: 315 }, { rate: 20, base: 1190, amount: 238 }])
    expect(tva.totalTTC).toBe(4893)
    expect(r.payload.docTitle).toBe('Facture de solde — Rénovation salle de bain')
    expect(r.acomptesDeduits.map((a) => a.docNumber)).toEqual(['AC-2026-001'])
  })

  it('acompte + solde : HT du devis exact taux par taux ; TVA à un centime près par taux', () => {
    // Montants non ronds : la TVA est arrondie facture par facture, d'où un écart possible d'un centime.
    const devis: Doc = { ...DEVIS, lines: [ligne(1, 100.03, 20), ligne(2, 333.35, 10)], materialLines: [], fraisLines: [], customTables: [] }
    const acompte = acompteEmis(50, 'AC-2026-001', 1, devis)
    const r = buildFactureDepuisDevis(devis, options([acompte]))
    if (!r.ok) throw new Error('facture attendue')
    const du = tvaDe(devis)
    const solde = tvaDe(r.payload)
    const dejaFacture = tvaDe(acompte)
    for (const { rate, base, amount } of du.breakdown) {
      const baseSolde = solde.breakdown.find((b) => b.rate === rate)!
      const baseAcompte = dejaFacture.breakdown.find((b) => b.rate === rate)!
      expect(Math.round((baseSolde.base + baseAcompte.base) * 100)).toBe(Math.round(base * 100))
      expect(Math.abs(Math.round((baseSolde.amount + baseAcompte.amount) * 100) - Math.round(amount * 100))).toBeLessThanOrEqual(1)
    }
  })

  it('plusieurs acomptes, quel que soit leur statut d\'émission : déduits dans l\'ordre des numéros', () => {
    // Statuts renvoyés par la base (pending, paid) comme statut local (envoye).
    const factures = [{ ...acompteEmis(20, 'AC-2026-002', 2), status: 'paid' }, { ...acompteEmis(30, 'AC-2026-001'), status: 'pending' }]
    const r = buildFactureDepuisDevis(DEVIS, options(factures))
    if (!r.ok) throw new Error('facture attendue')
    expect(r.acomptesDeduits.map((a) => a.docNumber)).toEqual(['AC-2026-001', 'AC-2026-002'])
    expect(totalHT(r.payload)).toBe(3100)
  })

  it('ancien acompte (lignes du devis mises à l\'échelle) : déduit de la même façon, par taux', () => {
    const ancien: Doc = { ...buildAcomptePrefill(DEVIS, { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' }), id: 'ac-ancien', docNumber: 'AC-2026-001', status: 'envoye' }
    const r = buildFactureDepuisDevis(DEVIS, options([ancien]))
    if (!r.ok) throw new Error('facture attendue')
    expect(tableDeduction(r.payload)!.lines.map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, -510], [10, -1350]])
  })

  it('acompte créé par le formulaire (lien devis seul, sans parentInvoiceNumber) : déduit aussi', () => {
    const duFormulaire: Doc = { ...acompteEmis(30, 'AC-2026-001'), parentInvoiceNumber: '' }
    const r = buildFactureDepuisDevis(DEVIS, options([duFormulaire]))
    if (!r.ok) throw new Error('facture attendue')
    expect(totalHT(r.payload)).toBe(4340)
  })

  it('acompte partiellement crédité par un avoir : seul le net est déduit', () => {
    const acompte = acompteEmis(30, 'AC-2026-001') // 510 € à 20 %, 1 350 € à 10 %
    const r = buildFactureDepuisDevis(DEVIS, options([acompte, avoirPartiel(acompte, 'AV-2026-001', 350, 10)]))
    if (!r.ok) throw new Error('facture attendue')
    expect(tableDeduction(r.payload)!.lines.map((l) => [l.tvaRate, l.totalHT])).toEqual([[20, -510], [10, -1000]])
    expect(tableDeduction(r.payload)!.lines[1].description).toBe('Acompte déjà facturé — facture n° AC-2026-001 du 15/09/2026, net de l\'avoir n° AV-2026-001 — TVA 10 %')
    expect(totalHT(r.payload)).toBe(4690)
  })

  it('ignore les acomptes en brouillon, annulés, entièrement crédités ou rattachés à un autre devis', () => {
    const brouillon = { ...acompteEmis(30, 'AC-2026-001'), status: 'brouillon' }
    const annule = { ...acompteEmis(30, 'AC-2026-002'), status: 'cancelled' }
    const credite = acompteEmis(30, 'AC-2026-003')
    const autreDevis = { ...acompteEmis(30, 'AC-2026-004'), parentInvoiceNumber: 'DEV-2026-999', sourceDevisNumber: 'DEV-2026-999', sourceDevisId: 'autre' }
    const factures = [brouillon, annule, credite, avoirTotal(credite, 'AV-2026-001'), autreDevis]
    expect(acomptesEmisPourDevis(DEVIS, factures)).toEqual([])
    const r = buildFactureDepuisDevis(DEVIS, options(factures))
    expect(r.ok && totalHT(r.payload)).toBe(6200)
    expect(r.ok && r.payload.docTitle).toBe('Rénovation salle de bain')
  })

  it('refuse quand les acomptes couvrent déjà tout le devis', () => {
    const r = buildFactureDepuisDevis(DEVIS, options([acompteEmis(50, 'AC-2026-001'), acompteEmis(50, 'AC-2026-002', 2)]))
    expect(r).toMatchObject({ ok: false, erreur: 'acomptes_couvrent_le_devis' })
    expect(!r.ok && r.message).toContain('AC-2026-001, AC-2026-002')
  })

  it('acomptes au-delà du devis : le refus chiffre le dépassement et demande un avoir', () => {
    const acomptes = [1, 2, 3, 4].map((n) => acompteEmis(30, `AC-2026-00${n}`, n))
    const r = buildFactureDepuisDevis(DEVIS, options(acomptes))
    expect(r).toMatchObject({ ok: false, erreur: 'acomptes_depassent_le_devis' })
    // 4 × 30 % de 6 200 € = 7 440 € : 1 240 € de trop.
    expect(!r.ok && r.message).toContain('dépassent le montant du devis de 1 240,00 € HT')
  })

  it('devis modifié après un acompte (taux disparu) : refus plutôt qu\'une TVA négative', () => {
    const acompte = acompteEmis(30, 'AC-2026-001') // 510 € à 20 %, 1 350 € à 10 %
    const modifie: Doc = { ...DEVIS, lines: [ligne(1, 6200, 10, 'Tout à 10 %')], materialLines: [], fraisLines: [], customTables: [] }
    const r = buildFactureDepuisDevis(modifie, options([acompte]))
    expect(r).toMatchObject({ ok: false, erreur: 'acomptes_incoherents' })
    expect(!r.ok && r.message).toContain('AC-2026-001')
  })

  it('cumul des acomptes d\'un devis : pourcentage et bases par taux (nets des avoirs)', () => {
    const premier = acompteEmis(30, 'AC-2026-001')
    const cumul = acomptesDejaFacturesPourDevis(DEVIS, [premier, acompteEmis(20, 'AC-2026-002', 2), avoirPartiel(premier, 'AV-2026-001', 350, 10)])
    expect(cumul.pourcentageCumule).toBe(50)
    expect(cumul.basesParTaux).toEqual([{ taux: 20, baseCents: 85000 }, { taux: 10, baseCents: 190000 }])
    expect(cumul.nombre).toBe(2)
  })
})

describe('buildFactureDepuisDevis — refus', () => {
  it.each([
    ['brouillon', { status: 'brouillon' }],
    ['sans numéro', { docNumber: '' }],
    ['sans statut', { status: undefined }],
  ])('devis non validé (%s)', (_cas, champs) => {
    expect(buildFactureDepuisDevis({ ...DEVIS, ...champs }, options())).toMatchObject({ ok: false, erreur: 'devis_non_valide' })
  })

  it('devis refusé', () => {
    expect(buildFactureDepuisDevis({ ...DEVIS, status: 'rejected' }, options())).toMatchObject({ ok: false, erreur: 'devis_refuse' })
    expect(buildFactureDepuisDevis({ ...DEVIS, status: 'refuse' }, options())).toMatchObject({ ok: false, erreur: 'devis_refuse' })
  })

  it('devis accepté ou signé : facturable', () => {
    for (const status of ['accepte', 'accepted', 'signe', 'signed', 'sent']) {
      expect(buildFactureDepuisDevis({ ...DEVIS, status }, options()).ok).toBe(true)
    }
  })

  it('client absent', () => {
    expect(buildFactureDepuisDevis({ ...DEVIS, clientName: '  ' }, options())).toMatchObject({ ok: false, erreur: 'client_manquant' })
  })

  it('devis sans montant (ou résumé sans lignes)', () => {
    expect(buildFactureDepuisDevis({ ...DEVIS, lines: [], materialLines: [], fraisLines: [], customTables: [] }, options())).toMatchObject({ ok: false, erreur: 'montant_nul' })
    expect(buildFactureDepuisDevis({ docType: 'devis', docNumber: 'DEV-2026-010', status: 'sent', clientName: 'Client' }, options())).toMatchObject({ ok: false, erreur: 'montant_nul' })
  })

  it('prestation future : pas de facture standard avant la prestation', () => {
    const r = buildFactureDepuisDevis({ ...DEVIS, prestationDate: '2026-11-03' }, options())
    expect(r).toMatchObject({ ok: false, erreur: 'prestation_future' })
    expect(!r.ok && r.message).toContain('03/11/2026')
  })

  it('autoliquidation pour un particulier : régime incohérent', () => {
    const r = buildFactureDepuisDevis({ ...DEVIS, regimeTva: 'autoliquidation_btp' }, options())
    expect(r).toMatchObject({ ok: false, erreur: 'regime_tva' })
  })

  it('autoliquidation valide (professionnel, SIREN, TVA intracommunautaire) : acceptée', () => {
    const r = buildFactureDepuisDevis({ ...DEVIS, regimeTva: 'autoliquidation_btp', clientType: 'professionnel', clientSiret: '552 100 554 00013', tvaNumber: 'FR12345678901' }, options())
    expect(r.ok).toBe(true)
  })

  it('devis déjà facturé : cite la facture existante', () => {
    const facture: Doc = { id: 'f-1', docType: 'facture', factureSubType: 'standard', docNumber: 'FACT-2026-042', status: 'pending', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const r = buildFactureDepuisDevis(DEVIS, options([facture]))
    expect(r).toMatchObject({ ok: false, erreur: 'deja_facture' })
    expect(!r.ok && r.message).toContain('FACT-2026-042')
  })

  it('facture partiellement créditée par un avoir : le devis reste « déjà facturé »', () => {
    const facture: Doc = { id: 'f-1', docType: 'facture', docNumber: 'FACT-2026-041', status: 'envoye', sourceDevisId: DEVIS.id, regimeTva: 'classique', lines: [ligne(1, 10000, 20)] }
    const factures = [facture, avoirPartiel(facture, 'AV-2026-002', 1000, 20)]
    expect(facturesEmisesPourDevis(DEVIS, factures).map((f) => f.docNumber)).toEqual(['FACT-2026-041'])
    expect(buildFactureDepuisDevis(DEVIS, options(factures))).toMatchObject({ ok: false, erreur: 'deja_facture' })
  })

  it('facture de situation émise sur le devis : pas de facture totale par-dessus', () => {
    const situation: Doc = { id: 's-1', docType: 'facture', factureSubType: 'situation', docNumber: 'FACT-2026-050', status: 'pending', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 3000, 20)] }
    const r = buildFactureDepuisDevis(DEVIS, options([situation]))
    expect(r).toMatchObject({ ok: false, erreur: 'situations_emises' })
    expect(!r.ok && r.message).toContain('FACT-2026-050')
    // Une situation de travaux ne s'annule pas par un avoir : le message ne le conseille pas.
    expect(!r.ok && r.message).not.toContain('avoir')
    expect(!r.ok && r.message).toContain('facture de solde')
  })

  it('un brouillon de facture, une facture annulée ou entièrement créditée ne bloquent pas', () => {
    const brouillon: Doc = { id: '1791145385501', docType: 'facture', docNumber: '', status: 'brouillon', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const annulee: Doc = { id: 'f-2', docType: 'facture', docNumber: 'FACT-2026-040', status: 'annule', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const creditee: Doc = { id: 'f-3', docType: 'facture', docNumber: 'FACT-2026-041', status: 'envoye', sourceDevisId: DEVIS.id, lines: [ligne(1, 6200, 20)] }
    const factures = [brouillon, annulee, creditee, avoirTotal(creditee, 'AV-2026-002')]
    expect(facturesEmisesPourDevis(DEVIS, factures)).toEqual([])
    expect(buildFactureDepuisDevis(DEVIS, options(factures)).ok).toBe(true)
  })

  it('brouillon de facture passé à « envoyé » sans numéro définitif : ni « déjà facturé », ni acompte déduit', () => {
    // Ancien parcours : la conversion laissait un brouillon sans numéro, que « Marquer envoyée » passe à 'envoye'.
    const sansNumero: Doc = { id: '1791145385501', docType: 'facture', docNumber: '', status: 'envoye', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const provisoire: Doc = { ...sansNumero, id: '1791145385502', docNumber: 'BR-2026-001' }
    const acompteSansNumero: Doc = { ...acompteEmis(50, ''), docNumber: '' }
    const factures = [sansNumero, provisoire, acompteSansNumero]
    expect(facturesEmisesPourDevis(DEVIS, factures)).toEqual([])
    expect(acomptesEmisPourDevis(DEVIS, factures)).toEqual([])
    const r = buildFactureDepuisDevis(DEVIS, options(factures))
    expect(r.ok && totalHT(r.payload)).toBe(6200)
    expect(controlerAcompteSurDevis(DEVIS, 30, { factures })).toEqual({ ok: true })
  })

  it('devis au numéro provisoire (BR-) : non validé', () => {
    expect(buildFactureDepuisDevis({ ...DEVIS, docNumber: 'BR-2026-004' }, options())).toMatchObject({ ok: false, erreur: 'devis_non_valide' })
  })

  it('prestation future ET devis déjà facturé : le refus « déjà facturé » passe en premier', () => {
    // Sinon le message renverrait vers un acompte, lui-même refusé sur un devis déjà facturé.
    const facture: Doc = { id: 'f-1', docType: 'facture', docNumber: 'FACT-2026-010', status: 'pending', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const r = buildFactureDepuisDevis({ ...DEVIS, prestationDate: '2026-12-01' }, options([facture]))
    expect(r).toMatchObject({ ok: false, erreur: 'deja_facture' })
  })

  it('messages en portugais pour un compte en locale pt', () => {
    const r = buildFactureDepuisDevis({ ...DEVIS, status: 'brouillon' }, { ...options(), locale: 'pt' })
    expect(!r.ok && r.message).toBe('Este orçamento ainda é um rascunho: valide-o antes de o faturar.')
  })
})

describe('controlerAcompteSurDevis — garde-fous de l\'acompte émis en un clic', () => {
  const controle = (devis: Doc, pourcentage: number, factures: Doc[] = []) => controlerAcompteSurDevis(devis, pourcentage, { factures })

  it('devis validé, sans facture : acompte permis', () => {
    expect(controle(DEVIS, 30)).toEqual({ ok: true })
    expect(controle(DEVIS, 100)).toEqual({ ok: true })
  })

  it('mêmes refus que la facture totale : brouillon, refusé, client absent, régime incohérent', () => {
    expect(controle({ ...DEVIS, status: 'brouillon' }, 30)).toMatchObject({ ok: false, erreur: 'devis_non_valide' })
    expect(controle({ ...DEVIS, docNumber: '' }, 30)).toMatchObject({ ok: false, erreur: 'devis_non_valide' })
    expect(controle({ ...DEVIS, status: 'refuse' }, 30)).toMatchObject({ ok: false, erreur: 'devis_refuse' })
    expect(controle({ ...DEVIS, clientName: '' }, 30)).toMatchObject({ ok: false, erreur: 'client_manquant' })
    expect(controle({ ...DEVIS, regimeTva: 'autoliquidation_btp' }, 30)).toMatchObject({ ok: false, erreur: 'regime_tva' })
  })

  it('devis déjà facturé en totalité : un acompte ferait double emploi', () => {
    const facture: Doc = { id: 'f-1', docType: 'facture', docNumber: 'FACT-2026-042', status: 'pending', sourceDevisNumber: 'DEV-2026-009', lines: [ligne(1, 6200, 20)] }
    const r = controle(DEVIS, 30, [facture])
    expect(r).toMatchObject({ ok: false, erreur: 'acompte_deja_facture' })
    expect(!r.ok && r.message).toContain('FACT-2026-042')
  })

  it('échéancier 50/30/20 : chaque échéance passe ; une échéance réémise au-delà de 100 % est refusée', () => {
    const premier = acompteEmis(50, 'AC-2026-001')
    const deuxieme = acompteEmis(30, 'AC-2026-002', 2)
    expect(controle(DEVIS, 30, [premier])).toEqual({ ok: true })
    expect(controle(DEVIS, 20, [premier, deuxieme])).toEqual({ ok: true })
    const r = controle(DEVIS, 50, [premier, deuxieme])
    expect(r).toMatchObject({ ok: false, erreur: 'acompte_depasse_le_devis' })
    expect(!r.ok && r.message).toContain('déjà facturé : 4 960,00 € HT sur 6 200,00 € HT')
  })

  it('un acompte annulé ou entièrement crédité ne compte plus', () => {
    const annule = { ...acompteEmis(50, 'AC-2026-001'), status: 'annule' }
    const credite = acompteEmis(50, 'AC-2026-002', 2)
    expect(controle(DEVIS, 100, [annule, credite, avoirTotal(credite, 'AV-2026-001')])).toEqual({ ok: true })
  })

  it('anciens acomptes arrondis ligne à ligne : la dernière échéance n\'est pas refusée pour quelques centimes', () => {
    // Acomptes 50 % et 30 % émis avant ce module (lignes du devis au pourcentage) : leur cumul
    // dépasse 80 % de quelques centimes, mais l'émission solde le devis par différence.
    const lignes = Array.from({ length: 20 }, (_, i) => ligne(i + 1, 100.01 + i * 2.02, i < 14 ? 10 : 20))
    const devis: Doc = { ...DEVIS, lines: lignes, materialLines: [], fraisLines: [], customTables: [] }
    const anciens = [50, 30].map((percentage, i): Doc => ({
      ...buildAcomptePrefill(devis, { percentage, ordre: i + 1, total: 3, declencheur: '' }),
      id: `ac-${i + 1}`, docNumber: `AC-2026-00${i + 1}`, status: 'pending',
    }))
    expect(controle(devis, 20, anciens)).toEqual({ ok: true })
    const derniere: Doc = {
      ...buildAcompteParTauxPrefill(devis, { percentage: 20, ordre: 3, total: 3, declencheur: '' }, { dejaFacture: acomptesDejaFacturesPourDevis(devis, anciens) }),
      id: 'ac-3', docNumber: 'AC-2026-003', status: 'envoye',
    }
    // Les trois acomptes égalent le devis au centime : plus rien à facturer.
    expect(buildFactureDepuisDevis(devis, options([...anciens, derniere]))).toMatchObject({ ok: false, erreur: 'acomptes_couvrent_le_devis' })
  })

  it('devis modifié après un acompte : pas de nouvel acompte sur un taux déjà dépassé', () => {
    const origine: Doc = { ...DEVIS, lines: [ligne(1, 5000, 10), ligne(2, 5000, 20)], materialLines: [], fraisLines: [], customTables: [] }
    const acompte = acompteEmis(50, 'AC-2026-001', 1, origine) // 2 500 € à 10 %, 2 500 € à 20 %
    const modifie: Doc = { ...origine, lines: [ligne(1, 9000, 10), ligne(2, 1000, 20)] }
    const r = controle(modifie, 30, [acompte])
    expect(r).toMatchObject({ ok: false, erreur: 'acompte_incoherent' })
    expect(!r.ok && r.message).toContain('AC-2026-001')
  })
})
