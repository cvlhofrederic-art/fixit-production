import { describe, expect, it } from 'vitest'
import {
  changerStade,
  creerDemande,
  marquerSansFacture,
  modeleDeNature,
  rattacherFacture,
  terminerDemande,
  type Demande,
  type ModeleDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import type { PrestataireIdentifiable } from '@/lib/administrateur-judiciaire/domain/facture-contrat'
import {
  TOLERANCE_PREVU_PCT,
  comparerPrevuFacture,
  factureDeposeeDepuisOrdre,
  imputationDepuisDemande,
  proposerImputationFactureDemande,
  rapprocherFactureDemande,
  rattachementLigneDepuisDemande,
  type ContexteRapprochementDemande,
} from '@/lib/administrateur-judiciaire/domain/facture-demande'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import { proposerImputation, type FactureLue } from '@/lib/administrateur-judiciaire/domain/imputation-facture'

/**
 * Facture d'une demande d'intervention (point 43 du bilan 2 ; Gestéam, tranche 43 § 15 : « une demande suit sa facture »,
 * rapprochement OS ↔ facture, codification de la facture ; tranche 34 : prix, devis associé, ventilation clé · analytique).
 * La demande se retrouve par le prestataire (comme un contrat) et la copropriété, puis se départage par le N° d'OS, puis par
 * le prévu ; la ventilation de la demande l'emporte sur les mots-clés, toute divergence étant signalée.
 */

const modele = (nature: string): ModeleDemande => {
  const trouve = modeleDeNature(nature)
  if (!trouve) throw new Error(`Modèle absent du test : ${nature}`)
  return trouve
}
const OS = modele('OS Copro')

const saisie = (surcharge: Partial<SaisieDemande> = {}): SaisieDemande => ({
  id: 'dem-1',
  coproprieteId: 'copro-1',
  mandatId: null,
  prestataireId: 'ent-1',
  demandeLe: '2026-10-01',
  numero: 'OS-2026-051',
  objet: 'Remplacement vanne colonne',
  prix: { montantTtcCentimes: 120_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 109_091 },
  ventilation: { cleRepartition: '001 - Charges communes générales', analytique: '460', comptePlan: '61500' },
  ...surcharge,
})

const realisee = (surcharge: Partial<SaisieDemande> = {}, m: ModeleDemande = OS): Demande =>
  changerStade(creerDemande(saisie(surcharge), m), 'Réalisée', { date: '2026-10-10' })

const PRESTATAIRES: PrestataireIdentifiable[] = [
  { id: 'ent-1', nom: 'Plomberie du Port', siret: '12345678900012' },
  { id: 'ent-2', nom: 'Toitures du Sud', siret: '98765432100015' },
]

const contexte = (demandes: Demande[], surcharge: Partial<ContexteRapprochementDemande> = {}): ContexteRapprochementDemande => ({
  coproprieteId: 'copro-1',
  prestataires: PRESTATAIRES,
  demandes,
  ...surcharge,
})

const facture = (surcharge: Partial<FactureLue> = {}): FactureLue => ({
  fournisseur: 'PLOMBERIE DU PORT SARL',
  siret: '12345678900012',
  numero: 'F-2026-118',
  date: '2026-10-14',
  htCentimes: 109_091,
  tauxTva: 10,
  tvaCentimes: 10_909,
  ttcCentimes: 120_000,
  texte: 'PLOMBERIE DU PORT SARL\nFacture n° F-2026-118\nRemplacement vanne colonne\nTotal TTC 1 200,00',
  ...surcharge,
})

const CLES = ['001 - Charges communes générales', '002 - Ascenseur']

describe('rapprocherFactureDemande', () => {
  it('une seule demande ouverte du prestataire dans la copropriété : trouvée', () => {
    const r = rapprocherFactureDemande(facture(), contexte([realisee()]))
    expect(r).toEqual({ statut: 'trouve', demandeId: 'dem-1', prestataireId: 'ent-1', identification: 'siret', departage: 'unique' })
  })

  it('prestataire inconnu, ou aucune demande pouvant recevoir une facture : aucune', () => {
    expect(rapprocherFactureDemande(facture({ fournisseur: 'Inconnu', siret: null }), contexte([realisee()]))).toMatchObject({
      statut: 'aucun',
      motif: 'prestataire_inconnu',
    })
    const fermees = [
      realisee({ id: 'autre-copro', coproprieteId: 'copro-2' }),
      marquerSansFacture(realisee({ id: 'sans' }), true),
      changerStade(creerDemande(saisie({ id: 'refus' }), OS), 'Refusée', { date: '2026-10-02' }),
      creerDemande(saisie({ id: 'devis' }), modele('Demande devis Copro')),
      terminerDemande(marquerSansFacture(changerStade(realisee({ id: 'fin' }), 'Validée', { date: '2026-10-11' }), true), [], '2026-10-12'),
      realisee({ id: 'autre-ent', prestataireId: 'ent-2' }),
    ]
    expect(rapprocherFactureDemande(facture(), contexte(fermees))).toEqual({ statut: 'aucun', motif: 'aucune_demande_ouverte', prestataireIds: ['ent-1'] })
  })

  it('plusieurs demandes : le N° d’OS cité dans la facture départage', () => {
    const demandes = [realisee(), realisee({ id: 'dem-2', numero: 'OS-2026-077' })]
    const texte = 'PLOMBERIE DU PORT\nVotre ordre de service OS-2026-077\nTotal TTC 1 200,00'
    expect(rapprocherFactureDemande(facture({ texte }), contexte(demandes))).toMatchObject({ statut: 'trouve', demandeId: 'dem-2', departage: 'reference' })
  })

  it('une référence d’OS donnée (dépôt VitFix) l’emporte et écarte une demande au numéro différent', () => {
    const demandes = [realisee(), realisee({ id: 'dem-2', numero: 'OS-2026-077' })]
    expect(rapprocherFactureDemande({ ...facture(), referenceOs: 'os 2026 077' }, contexte(demandes))).toMatchObject({
      statut: 'trouve',
      demandeId: 'dem-2',
      departage: 'reference',
    })
    expect(rapprocherFactureDemande({ ...facture(), referenceOs: 'OS-2026-099' }, contexte([realisee()]))).toEqual({
      statut: 'aucun',
      motif: 'reference_os_inconnue',
      prestataireIds: ['ent-1'],
    })
    const sansNumero = realisee({ numero: null })
    expect(rapprocherFactureDemande({ ...facture(), referenceOs: 'OS-2026-099' }, contexte([sansNumero]))).toMatchObject({ statut: 'trouve', departage: 'unique' })
  })

  it('une référence d’OS qui désigne une demande close ne fait jamais rattacher la facture à une autre demande', () => {
    const ascenseur = { cleRepartition: '002 - Ascenseur', analytique: '460', comptePlan: '61400' }
    const autre = realisee({ id: 'B', numero: null, ventilation: ascenseur })
    const nonFacturee = marquerSansFacture(realisee({ id: 'A' }), true)
    const terminee = terminerDemande(marquerSansFacture(changerStade(realisee({ id: 'A' }), 'Validée', { date: '2026-10-11' }), true), [], '2026-10-12')
    const depot = { ...facture({ ttcCentimes: 30_000 }), referenceOs: 'OS-2026-051' }
    for (const close of [nonFacturee, terminee])
      expect(rapprocherFactureDemande(depot, contexte([close, autre]))).toEqual({
        statut: 'aucun',
        motif: 'demande_os_close',
        designation: 'reference',
        prestataireIds: ['ent-1'],
        demandeIds: ['A'],
      })
    const r = proposerImputationFactureDemande(depot, CLES, contexte([terminee, autre]))
    expect(r).toMatchObject({ demandeId: null, comparaison: null })
    expect(r.imputation.certitude).not.toBe('demande')
    expect(r.alertes.map((a) => a.code)).toEqual(['demande_os_close'])
    expect(r.alertes[0].message).toMatch(/référence d'OS donnée.*OS-2026-051.*terminée/)
  })

  it('facture papier : un N° d’OS de demande close cité dans le TEXTE ne fait jamais rattacher la facture à une autre demande', () => {
    const ascenseur = { cleRepartition: '002 - Ascenseur', analytique: '460', comptePlan: '61400' }
    const nonFacturee = marquerSansFacture(realisee({ id: 'A' }), true)
    const papier = facture({ ttcCentimes: 30_000, texte: 'PLOMBERIE DU PORT\nVotre ordre de service OS-2026-051\nTotal TTC 300,00' })
    for (const numero of ['OS-2026-077', null])
      expect(rapprocherFactureDemande(papier, contexte([nonFacturee, realisee({ id: 'B', numero, ventilation: ascenseur })]))).toEqual({
        statut: 'aucun',
        motif: 'demande_os_close',
        designation: 'texte',
        prestataireIds: ['ent-1'],
        demandeIds: ['A'],
      })
    const r = proposerImputationFactureDemande(papier, CLES, contexte([nonFacturee, realisee({ id: 'B', numero: 'OS-2026-077', ventilation: ascenseur })]))
    expect(r).toMatchObject({ demandeId: null, comparaison: null })
    expect(r.imputation.certitude).not.toBe('demande')
    expect(r.alertes.map((a) => a.code)).toEqual(['demande_os_close'])
    expect(r.alertes[0].message).toMatch(/cité dans le texte de la facture.*OS-2026-051.*Non facturé/)
  })

  it('le N° d’une demande de devis ne désigne jamais une demande close : cité dans le texte, l’OS ouvert du même prestataire est retenu, quel que soit l’état du devis', () => {
    const devis = creerDemande(saisie({ id: 'D', numero: 'DV-2026-010', prix: null }), modele('Demande devis Copro'))
    const acceptee = changerStade(devis, 'Acceptée', { date: '2026-10-02' })
    const etatsDuDevis = [devis, acceptee, changerStade(devis, 'Refusée', { date: '2026-10-02' }), terminerDemande(acceptee, [], '2026-10-03')]
    const os = realisee({ id: 'B' })
    const papier = facture({ texte: 'PLOMBERIE DU PORT\nSuite à votre demande de devis DV-2026-010\nRemplacement vanne colonne\nTotal TTC 1 200,00' })
    for (const d of etatsDuDevis) {
      expect(rapprocherFactureDemande(papier, contexte([d, os]))).toEqual({
        statut: 'trouve',
        demandeId: 'B',
        prestataireId: 'ent-1',
        identification: 'siret',
        departage: 'unique',
      })
      const r = proposerImputationFactureDemande(papier, CLES, contexte([d, os]))
      expect(r).toMatchObject({ demandeId: 'B', imputation: { comptePlan: '61500', certitude: 'demande' } })
      expect(r.alertes).toEqual([])
    }
    // Cité à côté du N° d'un OS clos, le N° du devis ne change rien : l'OS clos arrête la facture, seul désigné.
    const close = marquerSansFacture(realisee({ id: 'A', numero: 'OS-2026-077' }), true)
    const lesDeux = facture({ texte: 'Devis DV-2026-010, ordre de service OS-2026-077' })
    expect(rapprocherFactureDemande(lesDeux, contexte([acceptee, close, os]))).toEqual({
      statut: 'aucun',
      motif: 'demande_os_close',
      designation: 'texte',
      prestataireIds: ['ent-1'],
      demandeIds: ['A'],
    })
    // Le N° de l'OS clos n'est cité qu'à l'intérieur du N° plus long du devis : il ne compte pas, l'OS ouvert est retenu.
    const devisLong = changerStade(creerDemande(saisie({ id: 'D', numero: 'OS-2026-077-DV', prix: null }), modele('Demande devis Copro')), 'Acceptée', {
      date: '2026-10-02',
    })
    expect(rapprocherFactureDemande(facture({ texte: 'Votre devis OS-2026-077-DV' }), contexte([devisLong, close, os]))).toMatchObject({
      statut: 'trouve',
      demandeId: 'B',
      departage: 'unique',
    })
    // Donné en référence (dépôt VitFix), le N° du devis ne désigne aucun OS : référence inconnue, jamais « close ».
    expect(rapprocherFactureDemande({ ...facture(), referenceOs: 'DV-2026-010' }, contexte([acceptee, os]))).toEqual({
      statut: 'aucun',
      motif: 'reference_os_inconnue',
      prestataireIds: ['ent-1'],
    })
  })

  it('N° cités dans le texte : une demande ouverte citée reste retenue ; la référence d’OS donnée prime sur le texte', () => {
    const nonFacturee = marquerSansFacture(realisee({ id: 'A' }), true)
    const ouverte = realisee({ id: 'B', numero: 'OS-2026-077' })
    const lesDeux = facture({ texte: 'Ordres de service OS-2026-051 et OS-2026-077' })
    expect(rapprocherFactureDemande(lesDeux, contexte([nonFacturee, ouverte, realisee({ id: 'C', numero: 'OS-2026-090' })]))).toMatchObject({
      statut: 'trouve',
      demandeId: 'B',
      departage: 'reference',
    })
    const papier = facture({ texte: 'Votre ordre de service OS-2026-051' })
    expect(rapprocherFactureDemande({ ...papier, referenceOs: 'OS-2026-077' }, contexte([nonFacturee, ouverte]))).toMatchObject({
      statut: 'trouve',
      demandeId: 'B',
      departage: 'reference',
    })
    // Le N° de la demande close n'est cité qu'à l'intérieur du N° plus long de la demande ouverte : il ne compte pas.
    const longue = realisee({ id: 'B', numero: 'OS-2026-051-B' })
    expect(rapprocherFactureDemande(facture({ texte: 'Facture OS-2026-051-B' }), contexte([nonFacturee, longue]))).toMatchObject({
      statut: 'trouve',
      demandeId: 'B',
    })
  })

  it('deux demandes portent la référence d’OS donnée : ambigu entre elles seules, sans repli sur une demande sans numéro', () => {
    const auPrixFacture = { montantTtcCentimes: 50_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: null }
    const demandes = [realisee({ id: 'D1', numero: 'OS-1' }), realisee({ id: 'D2', numero: 'OS-1' }), realisee({ id: 'D3', numero: null, prix: auPrixFacture })]
    expect(rapprocherFactureDemande({ ...facture({ ttcCentimes: 50_000 }), referenceOs: 'OS-1' }, contexte(demandes))).toEqual({
      statut: 'ambigu',
      demandeIds: ['D1', 'D2'],
      prestataireId: 'ent-1',
      identification: 'siret',
    })
  })

  it('un N° cité seulement à l’intérieur d’un N° plus long ne compte pas comme cité ; cité aussi à part, il reste candidat', () => {
    const prix = (euros: number) => ({ montantTtcCentimes: euros * 100, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: null })
    const demandes = [realisee({ id: 'A', numero: 'OS-2026-051', prix: prix(500) }), realisee({ id: 'B', numero: 'OS-2026-051-B', prix: prix(900) })]
    expect(rapprocherFactureDemande(facture({ ttcCentimes: 50_000, texte: 'Facture OS-2026-051-B' }), contexte(demandes))).toMatchObject({
      statut: 'trouve',
      demandeId: 'B',
      departage: 'reference',
    })
    const lesDeux = facture({ ttcCentimes: 50_000, texte: 'OS-2026-051 et OS-2026-051-B' })
    expect(rapprocherFactureDemande(lesDeux, contexte(demandes))).toMatchObject({ statut: 'trouve', demandeId: 'A', departage: 'prix' })
  })

  it('à défaut de référence, le prévu dans la tolérance départage ; sinon rien n’est deviné', () => {
    const autre = realisee({ id: 'dem-2', numero: null, prix: { montantTtcCentimes: 45_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: null } })
    expect(rapprocherFactureDemande(facture({ ttcCentimes: 123_000 }), contexte([realisee(), autre]))).toMatchObject({
      statut: 'trouve',
      demandeId: 'dem-1',
      departage: 'prix',
    })
    expect(rapprocherFactureDemande(facture({ ttcCentimes: 80_000 }), contexte([realisee(), autre]))).toEqual({
      statut: 'ambigu',
      demandeIds: ['dem-1', 'dem-2'],
      prestataireId: 'ent-1',
      identification: 'siret',
    })
  })

  it('le prix ne départage jamais deux entreprises distinctes de même nom', () => {
    const homonymes: PrestataireIdentifiable[] = [
      { id: 'ent-1', nom: 'Plomberie du Port', siret: null },
      { id: 'ent-3', nom: 'Plomberie du Port', siret: null },
    ]
    const demandes = [realisee(), realisee({ id: 'dem-3', prestataireId: 'ent-3', numero: null, prix: null })]
    const r = rapprocherFactureDemande(facture({ siret: null }), contexte(demandes, { prestataires: homonymes }))
    expect(r).toEqual({ statut: 'ambigu', demandeIds: ['dem-1', 'dem-3'], prestataireId: null, identification: 'nom' })
  })

  it('le prestataire choisi par le gestionnaire est retenu', () => {
    const r = rapprocherFactureDemande(facture({ fournisseur: null, siret: null }), contexte([realisee()], { prestataireId: 'ent-1' }))
    expect(r).toMatchObject({ statut: 'trouve', identification: 'saisi' })
  })
})

describe('comparerPrevuFacture', () => {
  it('tolérance de 5 % par défaut (règle de gestion, comme les contrats)', () => {
    expect(TOLERANCE_PREVU_PCT).toBe(5)
    expect(comparerPrevuFacture(realisee(), [126_000])).toEqual({
      prevuCentimes: 120_000,
      factureCentimes: 126_000,
      ecartCentimes: 6_000,
      ecartPct: 5,
      anomalies: [],
    })
  })

  it('facture au-dessus ou en dessous du prévu au-delà de la tolérance : alerte', () => {
    const dessus = comparerPrevuFacture(realisee(), [130_000])
    expect(dessus).toMatchObject({ ecartCentimes: 10_000, ecartPct: 8.3 })
    expect(dessus.anomalies.map((a) => a.code)).toEqual(['facture_au_dessus_prevu'])
    const dessous = comparerPrevuFacture(realisee(), [60_000], { tolerancePct: 10 })
    expect(dessous).toMatchObject({ ecartCentimes: -60_000, ecartPct: -50 })
    expect(dessous.anomalies.map((a) => a.code)).toEqual(['facture_en_dessous_prevu'])
  })

  it('l’acompte et le solde s’additionnent ; le devis associé fait le prévu', () => {
    const d = realisee({ devisAssocie: { devisId: 'dv-1', montantTtcCentimes: 100_000 } })
    expect(comparerPrevuFacture(d, [30_000, 70_000])).toMatchObject({ prevuCentimes: 100_000, factureCentimes: 100_000, ecartCentimes: 0, anomalies: [] })
  })

  it('prévu inconnu : alerte, sans écart ; montants non entiers refusés', () => {
    const r = comparerPrevuFacture(realisee({ prix: null }), [10_000])
    expect(r).toMatchObject({ prevuCentimes: null, ecartCentimes: null, ecartPct: null })
    expect(r.anomalies.map((a) => a.code)).toEqual(['prevu_inconnu'])
    expect(() => comparerPrevuFacture(realisee(), [100.5])).toThrow(/centimes entiers/)
    expect(() => comparerPrevuFacture(realisee(), [100], { tolerancePct: -1 })).toThrow(/Tolérance/)
  })

  it('prévu nul : tout montant facturé est au-dessus', () => {
    const gratuit = realisee({ prix: { montantTtcCentimes: 0, remiseCentimes: 0, tauxTvaPct: null, baseHtCentimes: null } })
    expect(comparerPrevuFacture(gratuit, [5_000]).anomalies.map((a) => a.code)).toEqual(['facture_au_dessus_prevu'])
    expect(comparerPrevuFacture(gratuit, [0]).anomalies).toEqual([])
  })
})

describe('imputationDepuisDemande', () => {
  it('reprend la ventilation de la demande, complétée du compte proposé', () => {
    expect(imputationDepuisDemande(realisee())).toEqual({
      comptePlan: '61500',
      libelleCompte: 'Entretien et petites réparations',
      familleAnalytique: '460-469',
      rubriqueAnalytique: '460',
      cleRepartition: '001 - Charges communes générales',
      decisionAgRequise: false,
      certitude: 'demande',
    })
  })

  it('compte hors des comptes proposés : repris tel quel ; travaux décidés en AG : décision requise', () => {
    expect(imputationDepuisDemande(realisee({ ventilation: { cleRepartition: null, analytique: null, comptePlan: '61999' } }))).toMatchObject({
      comptePlan: '61999',
      libelleCompte: null,
      familleAnalytique: null,
      decisionAgRequise: false,
    })
    expect(imputationDepuisDemande(realisee({ ventilation: { cleRepartition: null, analytique: null, comptePlan: '67100' } }))?.decisionAgRequise).toBe(true)
  })

  it('sans ventilation ou sans compte : null', () => {
    expect(imputationDepuisDemande(realisee({ ventilation: null }))).toBeNull()
    expect(imputationDepuisDemande(realisee({ ventilation: { cleRepartition: 'x', analytique: null, comptePlan: null } }))).toBeNull()
  })
})

describe('proposerImputationFactureDemande', () => {
  it('la ventilation de la demande rapprochée l’emporte sur les mots-clés', () => {
    const r = proposerImputationFactureDemande(facture(), CLES, contexte([realisee()]))
    expect(r.demandeId).toBe('dem-1')
    expect(r.imputation.certitude).toBe('demande')
    expect(r.imputation.comptePlan).toBe('61500')
    expect(r.comparaison?.anomalies).toEqual([])
    expect(r.alertes).toEqual([])
  })

  it('mots-clés orientés vers un autre compte ou vers une décision d’AG : signalés, décision d’AG reportée', () => {
    const texte = 'PLOMBERIE DU PORT\nRéfection étanchéité toiture terrasse\nTotal TTC 1 200,00'
    const r = proposerImputationFactureDemande(facture({ texte }), CLES, contexte([realisee()]))
    expect(r.imputation.comptePlan).toBe('61500')
    expect(r.imputation.decisionAgRequise).toBe(true)
    expect(r.alertes.map((a) => a.code)).toEqual(['mots_cles_divergents', 'decision_ag_possible'])
  })

  it('clé de la demande absente des clés de la copropriété : signalée', () => {
    const d = realisee({ ventilation: { cleRepartition: '009 - Parking', analytique: '460', comptePlan: '61500' } })
    expect(proposerImputationFactureDemande(facture(), CLES, contexte([d])).alertes.map((a) => a.code)).toEqual(['cle_demande_inconnue'])
  })

  it('demande sans ventilation, ambiguë ou introuvable : mots-clés inchangés', () => {
    const motsCles = proposerImputation(facture(), CLES)
    const sansVentilation = proposerImputationFactureDemande(facture(), CLES, contexte([realisee({ ventilation: null })]))
    expect(sansVentilation.imputation).toEqual(motsCles)
    expect(sansVentilation.alertes.map((a) => a.code)).toEqual(['ventilation_absente'])
    const ambigu = proposerImputationFactureDemande(facture({ ttcCentimes: 80_000 }), CLES, contexte([realisee(), realisee({ id: 'dem-2', numero: null })]))
    expect(ambigu).toMatchObject({ demandeId: null, comparaison: null, imputation: proposerImputation(facture({ ttcCentimes: 80_000 }), CLES) })
    expect(ambigu.alertes.map((a) => a.code)).toEqual(['demande_ambigue'])
    const aucune = proposerImputationFactureDemande(facture(), CLES, contexte([]))
    expect(aucune).toMatchObject({ demandeId: null, comparaison: null, alertes: [], imputation: motsCles })
  })

  it('TTC illisible : pas de comparaison au prévu', () => {
    expect(proposerImputationFactureDemande(facture({ ttcCentimes: null }), CLES, contexte([realisee()])).comparaison).toBeNull()
  })
})

describe('rattachementLigneDepuisDemande', () => {
  it('le dossier de la demande donne le rattachement de la ligne de facture (travaux, contentieux, sinistre)', () => {
    const avec = (type: 'Travaux' | 'Contentieux' | 'Sinistre' | 'Equipement') => realisee({ dossier: creerRattachement(type, `${type}-1`) })
    expect(rattachementLigneDepuisDemande(avec('Travaux'))).toEqual({ type: 'travaux', id: 'Travaux-1' })
    expect(rattachementLigneDepuisDemande(avec('Contentieux'))).toEqual({ type: 'contentieux', id: 'Contentieux-1' })
    expect(rattachementLigneDepuisDemande(avec('Sinistre'))).toEqual({ type: 'sinistre', id: 'Sinistre-1' })
    expect(rattachementLigneDepuisDemande(avec('Equipement'))).toBeNull()
    expect(rattachementLigneDepuisDemande(realisee())).toBeNull()
  })
})

describe('factureDeposeeDepuisOrdre (facture déposée par le prestataire VitFix)', () => {
  const ordre = { referenceAj: 'OS-2026-077', prestataire: { nom: 'Plomberie du Port', metier: 'Plombier' } }

  it('convertit le montant en centimes et garde la référence de l’OS', () => {
    const depot = factureDeposeeDepuisOrdre({ type: 'facture', reference: 'F-118', montant_ttc: 1234.56, description: 'Vanne', date: '2026-10-14' }, ordre)
    expect(depot).toEqual({
      fournisseur: 'Plomberie du Port',
      siret: null,
      numero: 'F-118',
      date: '2026-10-14',
      htCentimes: null,
      tauxTva: null,
      tvaCentimes: null,
      ttcCentimes: 123_456,
      referenceOs: 'OS-2026-077',
      texte: 'Vanne',
    })
  })

  it('arrondit le montant déposé au centime (virgule flottante)', () => {
    const depot = factureDeposeeDepuisOrdre({ type: 'facture', reference: 'F-1', montant_ttc: 0.1 + 0.2, description: '', date: '2026-10-14' }, ordre)
    expect(depot.ttcCentimes).toBe(30)
  })

  it('la facture déposée s’impute directement à sa demande, d’après la ventilation de celle-ci', () => {
    const demandes = [realisee(), realisee({ id: 'dem-2', numero: 'OS-2026-077' })]
    const depot = factureDeposeeDepuisOrdre({ type: 'facture', reference: 'F-118', montant_ttc: 1200, description: 'Vanne', date: '2026-10-14' }, ordre)
    const r = proposerImputationFactureDemande(depot, CLES, contexte(demandes, { prestataireId: 'ent-1' }))
    expect(r).toMatchObject({ demandeId: 'dem-2', imputation: { comptePlan: '61500', certitude: 'demande' }, comparaison: { anomalies: [] } })
  })

  it('montant ou date absents : null ; un devis ou un rapport ne s’impute pas', () => {
    const depot = factureDeposeeDepuisOrdre({ type: 'facture', reference: '', description: '', date: '' }, { ...ordre, referenceAj: '' })
    expect(depot).toMatchObject({ numero: null, date: null, ttcCentimes: null, referenceOs: null })
    expect(() => factureDeposeeDepuisOrdre({ type: 'devis', reference: 'D-1', description: '', date: '2026-10-14' }, ordre)).toThrow(/facture/)
    expect(() => factureDeposeeDepuisOrdre({ type: 'rapport', reference: 'R-1', description: '', date: '2026-10-14' }, ordre)).toThrow(/« rapport »/)
  })

  it('la facture déposée retrouve sa demande par la référence de l’OS', () => {
    const demandes = [realisee(), realisee({ id: 'dem-2', numero: 'OS-2026-077' })]
    const depot = factureDeposeeDepuisOrdre({ type: 'facture', reference: 'F-118', montant_ttc: 1200, description: 'Vanne', date: '2026-10-14' }, ordre)
    expect(rapprocherFactureDemande(depot, contexte(demandes, { prestataireId: 'ent-1' }))).toMatchObject({
      statut: 'trouve',
      demandeId: 'dem-2',
      identification: 'saisi',
      departage: 'reference',
    })
  })
})

describe('cohérence avec le cycle de la demande', () => {
  it('la facture rapprochée se rattache à sa demande', () => {
    const d = realisee()
    const r = rapprocherFactureDemande(facture(), contexte([d]))
    if (r.statut !== 'trouve') throw new Error('rapprochement attendu')
    expect(rattacherFacture(d, 'f-118').factureIds).toEqual(['f-118'])
  })
})
