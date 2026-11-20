import { describe, expect, it } from 'vitest'
import {
  alertesRattachementFacture,
  changerStade,
  contestationDeLaFacture,
  controlerCloture,
  creerDemande,
  marquerSansFacture,
  modeleDeNature,
  rattacherFacture,
  terminerDemande,
  type Demande,
  type FactureDeDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import { TOLERANCE_PREVU_PCT, comparerPrevuFacture } from '@/lib/administrateur-judiciaire/domain/facture-demande'
import {
  changerStatutReglement,
  selectionnerFacturesAPayer,
  type FactureAPayer,
} from '@/lib/administrateur-judiciaire/domain/statuts-facture'
import { enTeteDuModule } from './en-tete-module'

/**
 * Décisions du 20/11/2026 (partie C des questions ouvertes du code, thème « demandes, ordres de service, entreprises et
 * paiements ») : F71, F72, F77, F81, F82, F83, F84, F87, F88, F89, F90, F91, F92. Données fictives.
 */

const OS = modeleDeNature('OS Copro')
if (OS === null) throw new Error('Modèle « OS Copro » attendu.')

const saisie = (surcharge: Partial<SaisieDemande> = {}): SaisieDemande => ({
  id: 'dem-1',
  coproprieteId: 'copro-1',
  mandatId: 'mandat-1',
  prestataireId: 'ent-1',
  demandeLe: '2026-10-01',
  numero: '12.3.456',
  objet: 'Recherche de fuite colonne',
  prix: { montantTtcCentimes: 120_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 109_091 },
  ...surcharge,
})

const realisee = (surcharge: Partial<SaisieDemande> = {}): Demande => changerStade(creerDemande(saisie(surcharge), OS), 'Réalisée', { date: '2026-10-10' })
const contestee = (surcharge: Partial<SaisieDemande> = {}): Demande => changerStade(realisee(surcharge), 'Contestée', { date: '2026-10-11' })
const comptabilisee = (id: string): FactureDeDemande => ({ id, statut: 'Comptabilisée' })
const codes = (anomalies: readonly { code: string }[]): string[] => anomalies.map((a) => a.code)

const facture = (surcharge: Partial<FactureAPayer> = {}): FactureAPayer => ({
  id: 'f-1',
  prestataireId: 'ent-1',
  mode: 'Virement',
  statutSaisie: 'Enregistrée',
  comptabilisee: true,
  statutReglement: 'En attente',
  priorite: 5,
  echeance: '2026-11-01',
  resteDuCentimes: 120_000,
  ...surcharge,
})

describe('F71 — intervention « Contestée » : facture saisie avec une alerte, ni bon à payer ni clôture', () => {
  it('la facture se rattache à une intervention contestée, avec l’alerte « intervention contestée »', () => {
    const d = rattacherFacture(contestee(), 'f-1')
    expect(d.factureIds).toEqual(['f-1'])
    const [alerte, ...autres] = alertesRattachementFacture(contestee())
    expect(autres).toEqual([])
    expect([alerte.code, alerte.gravite]).toEqual(['intervention_contestee', 'alerte'])
    expect(alerte.message).toContain('Décision du 20/11/2026 (partie C, F71)')
    expect(alerte.message).toContain('ni bon à payer ni clôture')
    expect(alertesRattachementFacture(realisee())).toEqual([])
  })

  it('la clôture reste refusée tant que la contestation n’est pas levée', () => {
    const d = rattacherFacture(contestee(), 'f-1')
    const [anomalie] = controlerCloture(d, [comptabilisee('f-1')])
    expect([anomalie.code, anomalie.gravite]).toEqual(['intervention_contestee', 'bloquant'])
    expect(anomalie.message).toContain('stade suivant, avec un motif')
    expect(() => terminerDemande(d, [comptabilisee('f-1')], '2026-10-20')).toThrow(/Intervention contestée/)
  })

  it('la contestation se lève par le stade suivant, avec un motif obligatoire, tracé', () => {
    const d = contestee()
    expect(() => changerStade(d, 'Validée', { date: '2026-10-15' })).toThrow(/motif/)
    expect(() => changerStade(d, 'Validée', { date: '2026-10-15', motif: '   ' })).toThrow(/motif/)
    const levee = changerStade(d, 'Validée', { date: '2026-10-15', motif: ' Reprise faite par l’entreprise ' })
    expect(levee.stade).toBe('Validée')
    expect(levee.leveesContestation).toEqual([{ le: '2026-10-15', motif: 'Reprise faite par l’entreprise', stade: 'Validée' }])
    // le motif n'est demandé qu'à la sortie de « Contestée »
    expect(changerStade(realisee(), 'Validée', { date: '2026-10-12' }).leveesContestation).toBeUndefined()
    expect(changerStade(d, 'Contestée', { date: '2026-10-12' }).stade).toBe('Contestée')
    expect(terminerDemande(rattacherFacture(levee, 'f-1'), [comptabilisee('f-1')], '2026-10-20').statut).toBe('Terminé')
  })

  it('contestationDeLaFacture : la demande contestée qui porte la facture', () => {
    const demandes = [rattacherFacture(contestee({ id: 'dem-2' }), 'f-2'), rattacherFacture(realisee({ id: 'dem-3' }), 'f-3')]
    expect(contestationDeLaFacture('f-2', demandes)).toEqual({ demandeId: 'dem-2' })
    expect(contestationDeLaFacture('f-3', demandes)).toBeNull()
    expect(contestationDeLaFacture('f-9', demandes)).toBeNull()
  })

  it('bon à payer refusé, et aucun nouvel ordre, tant que l’intervention est contestée', () => {
    const enCause = facture({ interventionContestee: { demandeId: 'dem-2' } })
    expect(() => changerStatutReglement(enCause, 'Bon à payer')).toThrow(/Bon à payer refusé : l'intervention de la demande dem-2 est contestée/)
    expect(() => changerStatutReglement({ ...enCause, acompteCentimes: 10_000 }, 'Acompte à régler')).toThrow(/contestée/)
    expect(changerStatutReglement(facture(), 'Bon à payer').statutReglement).toBe('Bon à payer')
    const dejaBap = facture({ statutReglement: 'Bon à payer', interventionContestee: { demandeId: 'dem-2' } })
    expect(() => changerStatutReglement(dejaBap, 'En règlement')).toThrow(/contestée/)
    expect(changerStatutReglement(dejaBap, 'En attente').statutReglement).toBe('En attente')
    const selection = selectionnerFacturesAPayer([dejaBap, facture({ id: 'f-2', statutReglement: 'Bon à payer' })], {
      date: '2026-11-02',
      soldeDisponibleCentimes: 1_000_000,
    })
    expect(selection.retenues.map((f) => f.id)).toEqual(['f-2'])
    expect(selection.ecartees).toEqual([{ factureId: 'f-1', motif: 'intervention_contestee' }])
  })

  it('en-tête : la question de l’intervention contestée est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('demandes')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('Une intervention « Contestée » bloque-t-elle la facturation et la clôture')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F71)')
    expect(texte).toContain('L. 1965 art. 14-3')
    expect(enTeteDuModule('statuts-facture').texte).toContain('Décision du 20/11/2026 (partie C, F71)')
  })
})

describe('F72 — clôture : facture rattachée ou « Non facturé », « Réalisée » suffit', () => {
  it('(1) bloquant sans facture ni « Non facturé » ; (2) facture non comptabilisée : alerte ; (3) non validée : alerte', () => {
    expect(controlerCloture(realisee(), []).map((a) => [a.code, a.gravite])).toEqual([
      ['intervention_non_validee', 'alerte'],
      ['facture_absente', 'bloquant'],
    ])
    expect(() => terminerDemande(realisee(), [], '2026-10-20')).toThrow(/Aucune facture rattachée/)
    const nonComptabilisee = controlerCloture(rattacherFacture(realisee(), 'f-1'), [{ id: 'f-1', statut: 'À traiter' }])
    expect(nonComptabilisee.map((a) => [a.code, a.gravite])).toEqual([
      ['intervention_non_validee', 'alerte'],
      ['facture_non_comptabilisee', 'alerte'],
    ])
    // « Réalisée » suffit : la clôture passe avec ses alertes
    expect(terminerDemande(rattacherFacture(realisee(), 'f-1'), [{ id: 'f-1', statut: 'À traiter' }], '2026-10-20').statut).toBe('Terminé')
    expect(terminerDemande(marquerSansFacture(realisee(), true), [], '2026-10-20').statut).toBe('Terminé')
  })

  it('en-tête : la question « Terminé » est remplacée par la décision, la question du bouton « Non facturé » reste', () => {
    const { texte } = enTeteDuModule('demandes')
    const questions = texte.slice(texte.indexOf('🔴 Non établi'))
    expect(questions).not.toContain('« Terminé » exige-t-il une facture comptabilisée')
    expect(questions).toContain('« Non facturé »')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F72)')
    expect(texte).toContain('arrêté du 14/03/2005, art. 10')
  })
})

describe('F91 — tolérance de 5 % : réglage propre aux demandes, au départ égal à celui des contrats', () => {
  it('5 % par défaut ; le réglage des demandes s’ajuste sans toucher aux contrats ; un écart au-delà reste signalé', () => {
    expect(TOLERANCE_PREVU_PCT).toBe(5)
    const d = realisee()
    expect(comparerPrevuFacture(d, [126_000]).anomalies).toEqual([])
    expect(codes(comparerPrevuFacture(d, [127_200]).anomalies)).toEqual(['facture_au_dessus_prevu'])
    expect(comparerPrevuFacture(d, [127_200], { tolerancePct: 6 }).anomalies).toEqual([])
    expect(codes(comparerPrevuFacture(d, [127_200], { tolerancePct: 5 }).anomalies)).toEqual(['facture_au_dessus_prevu'])
  })

  it('en-tête : la question de la tolérance est remplacée par la décision', () => {
    const { texte } = enTeteDuModule('facture-demande')
    expect(texte).not.toContain('la tolérance de 5 % entre le prévu et le facturé (reprise des contrats) convient-elle')
    expect(texte).toContain('Décision du 20/11/2026 (partie C, F91)')
    expect(texte).not.toContain('🔴 Non établi')
  })
})
