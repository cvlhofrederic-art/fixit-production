import { describe, expect, it } from 'vitest'
import {
  BASES_LIGNES_HONORAIRES_COURRIER,
  baseLigneHonorairesCourrier,
  casDesFraisDEnvoi,
  creerRegleHonorairesCourrier,
  estRecouvrementContreUnCoproprietaire,
  proposerHonorairesDuCourrier,
  regleHonorairesMiseEnDemeure,
  type CasFraisEnvoi,
  type ContexteHonorairesCourrier,
  type CourrierDeclencheur,
  type LigneHonorairesCourrier,
} from '@/lib/administrateur-judiciaire/domain/etapes-courrier'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { creerElement } from '@/lib/administrateur-judiciaire/domain/honoraires-facturation'
import { enTeteDuModule } from './en-tete-module'

/**
 * Réponse de Frédéric du 17/11/2026 (page de validation), registre J77, avec la précision de Hugo du 18/11/2026 :
 * imputation du forfait selon le cas du courrier (comme les frais d'envoi de J72) ; un montant de 0 vaut « non saisi ».
 * Montants : valeurs de test, en dix-millièmes d'euro.
 */

const AUJOURDHUI = '2026-11-18'
const contentieux = creerRattachement('Contentieux', 'C-3')
const copro = creerRattachement('Copropriété', 'copro-1')

const courrier = (libelle = 'Mise en demeure de payer'): CourrierDeclencheur => ({
  id: 'cour-1',
  modeleId: 'mod-1',
  modele: { famille: 'Contentieux', libelle },
  dateDepot: '2026-11-10',
  rattachements: [contentieux, copro],
  coproprieteId: 'copro-1',
  mandatId: 'M1',
})

const ligneAr: LigneHonorairesCourrier = {
  objet: 'frais_envoi',
  nature: 'AR',
  tarif: 'Gestion - RAR',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 61_000,
  soumisTva: true,
  tauxTvaPct: 20,
  destinataire: 'Syndicat des copropriétaires',
}
const ligneForfait: LigneHonorairesCourrier = {
  objet: 'forfait_mise_en_demeure',
  nature: 'Honoraires',
  tarif: 'Contentieux - MISE EN DEMEURE',
  quantite: 1,
  prixUnitaireHtDixMilliemes: 300_000,
  soumisTva: true,
  tauxTvaPct: 20,
  destinataire: 'Syndicat des copropriétaires',
}

/** Règle active déclenchée par le modèle : tout libellé du courrier la déclenche, ce qui isole le cas du courrier. */
const regle = (lignes: readonly LigneHonorairesCourrier[], active = true) =>
  regleHonorairesMiseEnDemeure({ lignes, active, declencheur: { par: 'modele', modeleIds: ['mod-1'] } })

const contexte = (surcharge: Partial<ContexteHonorairesCourrier> = {}): ContexteHonorairesCourrier => ({
  mission: 'judiciaire',
  aujourdhui: AUJOURDHUI,
  idElement: ({ regle: r, rang }) => `el:${r.id}:${rang}`,
  ...surcharge,
})

const forfaitDe = (libelle: string, recouvrementContreUnCoproprietaire: boolean | null | undefined, surcharge: Partial<ContexteHonorairesCourrier> = {}) =>
  proposerHonorairesDuCourrier(courrier(libelle), [regle([ligneForfait])], contexte({ recouvrementContreUnCoproprietaire, ...surcharge })).propositions[0]

const IMPUTATION_ART_10_1_A = {
  a: 'coproprietaire_en_retard',
  fondement: 'L. 1965 art. 10-1, a',
  conditions: ['créance justifiée', 'mise en demeure partie (une relance faite avant elle n’est pas visée)', 'coût nécessaire'],
}
const SANS_IMPUTATION = { payeur: 'syndicat', paiement: 'facture_du_cabinet', imputation: null }
const CAS: readonly CasFraisEnvoi[] = ['recouvrement', 'autre_envoi', 'non_etabli']
const REGIMES: readonly (Regime | null)[] = [null, 'sj', 'ap47', 'ap291']

describe('J77 (a) — forfait de mise en demeure : imputé au copropriétaire pour le seul recouvrement contre un copropriétaire', () => {
  it('recouvrement contre un copropriétaire en retard : forfait imputable à ce seul copropriétaire (J67, R7, inchangé)', () => {
    const forfait = forfaitDe('Mise en demeure de payer', true)
    expect(forfait.repartition).toEqual({ payeur: 'syndicat', paiement: 'facture_du_cabinet', imputation: IMPUTATION_ART_10_1_A })
    expect(forfait.fondements).toContain('L. 1965 art. 10-1, a')
    expect(forfait.observation).toMatch(/^Deux lignes \(J67, R7\) : le cabinet facture le forfait au syndicat, qui le paie/)
  })

  it('courrier à un locataire : aucune imputation au copropriétaire, même si le dossier poursuit un copropriétaire', () => {
    const forfait = forfaitDe('Mise en demeure de payer - locataire', true)
    expect(forfait.repartition).toEqual(SANS_IMPUTATION)
    expect(forfait.fondements).not.toContain('L. 1965 art. 10-1, a')
    expect(forfait.observation).toMatch(/J77/)
    expect(forfait.observation).toMatch(/rien n'est imputé à un copropriétaire/)
    expect(forfait.observation).not.toMatch(/imputer au seul copropriétaire en retard/)
    // le cabinet facture toujours le forfait au syndicat (J67, R7)
    expect(forfait.saisie.destinataire).toBe('Syndicat des copropriétaires')
  })

  it('autre contentieux (litige entreprise, garantie décennale) : aucune imputation au copropriétaire', () => {
    const libelle = "Mise en demeure de l'entreprise de reprendre les désordres"
    for (const type of ['Litige entreprise', 'Garantie décennale'] as const) {
      const forfait = forfaitDe(libelle, estRecouvrementContreUnCoproprietaire({ type, compteId: null }))
      expect(forfait.repartition, type).toEqual(SANS_IMPUTATION)
    }
    expect(forfaitDe("Transmission du dossier à l'huissier", true).repartition).toEqual(SANS_IMPUTATION)
  })

  it('dossier qui ne dit pas qui il poursuit : « à confirmer », sans imputation automatique', () => {
    for (const recouvrement of [undefined, null]) {
      const forfait = forfaitDe('Mise en demeure de payer', recouvrement)
      expect(forfait.aConfirmer).toBe(true)
      expect(forfait.repartition).toEqual(SANS_IMPUTATION)
      expect(forfait.observation).toMatch(/^À confirmer \(J77\) : /)
      expect(forfait.observation).toMatch(/D'ici là, rien n'est imputé à un copropriétaire/)
    }
    // recouvrement sans compte débiteur : le débiteur n'est pas établi (un locataire, pour un loyer)
    const sansCompte = estRecouvrementContreUnCoproprietaire({ type: 'Recouvrement de charges/loyer', compteId: null })
    expect(forfaitDe('Mise en demeure de payer', sansCompte).repartition.imputation).toBeNull()
  })

  it('même lecture du cas que les frais d’envoi (J72) : le forfait est imputé exactement quand les frais d’envoi le sont', () => {
    const libelles = [
      'Mise en demeure de payer',
      'Mise en demeure de payer - locataire',
      'Procédure 19-2',
      'Relance RAR',
      "Transmission du dossier à l'huissier",
      "Mise en demeure de l'entreprise de reprendre les désordres",
    ]
    for (const mission of ['judiciaire', 'contrat_type_syndic'] as const)
      for (const libelle of libelles)
        for (const recouvrement of [true, false, null]) {
          const quoi = `${mission}, « ${libelle} », ${String(recouvrement)}`
          const [frais, forfait] = proposerHonorairesDuCourrier(
            courrier(libelle),
            [regle([ligneAr, ligneForfait])],
            contexte({ mission, recouvrementContreUnCoproprietaire: recouvrement }),
          ).propositions
          expect([frais.objet, forfait.objet], quoi).toEqual(['frais_envoi', 'forfait_mise_en_demeure'])
          expect(forfait.repartition.imputation === null, quoi).toBe(frais.repartition.imputation === null)
          const cas = casDesFraisDEnvoi({ famille: 'Contentieux', libelle }, recouvrement)
          expect(forfait.repartition.imputation === null, quoi).toBe(cas !== 'recouvrement')
          expect(forfait.aConfirmer, quoi).toBe(true)
        }
  })

  it('base sans cas (absent) : aucune imputation au copropriétaire ; avec le cas « recouvrement » : imputation de J67, R7', () => {
    expect(baseLigneHonorairesCourrier('forfait_mise_en_demeure').repartition).toEqual(SANS_IMPUTATION)
    expect(BASES_LIGNES_HONORAIRES_COURRIER.forfait_mise_en_demeure.repartition).toEqual(SANS_IMPUTATION)
    expect(BASES_LIGNES_HONORAIRES_COURRIER.forfait_mise_en_demeure.aConfirmer).toBe(true)
    expect(baseLigneHonorairesCourrier('forfait_mise_en_demeure', { cas: 'recouvrement' }).repartition.imputation).toEqual(IMPUTATION_ART_10_1_A)
    for (const cas of CAS)
      expect(baseLigneHonorairesCourrier('forfait_mise_en_demeure', { cas }).repartition, cas).toMatchObject({
        payeur: 'syndicat',
        paiement: 'facture_du_cabinet',
      })
  })

  it('art. 29-1 : la phrase sur la somme imputée au copropriétaire ne figure que si le forfait est imputé', () => {
    const base = (cas: CasFraisEnvoi) => baseLigneHonorairesCourrier('forfait_mise_en_demeure', { regime: 'ap291', cas })
    expect(base('recouvrement').observation).toMatch(/seule la somme admise et payée par le syndicat est imputée au copropriétaire/)
    for (const cas of ['autre_envoi', 'non_etabli'] as const) {
      expect(base(cas).observation, cas).not.toMatch(/est imputée au copropriétaire/)
      expect(base(cas).observation, cas).toMatch(/rémunération soumise au juge/)
      expect(base(cas).fondements, cas).toEqual(['L. 1965 art. 29-1, II', 'D. 1967 art. 61-1-5, II', 'arrêté du 08/10/2015, art. 14'])
    }
  })

  it('aucun prénom dans les observations du forfait (J75)', () => {
    for (const cas of CAS)
      for (const regime of REGIMES)
        expect(baseLigneHonorairesCourrier('forfait_mise_en_demeure', { regime, cas }).observation, `${cas}, ${String(regime)}`).not.toMatch(
          /Hugo|Frédéric/,
        )
  })
})

describe('J77 (b) — montant du forfait : 0 ou absent vaut « non saisi », aucune ligne de forfait proposée', () => {
  it('forfait à 0 : aucune ligne de forfait proposée, alerte qui dit quoi saisir ; les frais d’envoi restent proposés', () => {
    const r = regle([ligneAr, { ...ligneForfait, prixUnitaireHtDixMilliemes: 0 }])
    const { propositions, ecartees } = proposerHonorairesDuCourrier(courrier(), [r], contexte({ recouvrementContreUnCoproprietaire: true }))
    expect(propositions.map((p) => p.objet)).toEqual(['frais_envoi'])
    expect(ecartees).toEqual([
      {
        regleId: r.id,
        motif: 'montant_non_saisi',
        rang: 2,
        message: expect.stringMatching(
          /ligne 2 \(forfait de mise en demeure\) : montant non saisi.*aucune ligne de forfait proposée.*Saisir le prix unitaire HT du forfait/,
        ),
      },
    ])
    expect(ecartees[0].message).not.toMatch(/Hugo|Frédéric/)
  })

  it('forfait sans montant (absent ou null) : même chose ; la règle se crée sans refus (relue d’un stockage)', () => {
    for (const prix of [null, undefined]) {
      const ligne = { ...ligneForfait, prixUnitaireHtDixMilliemes: prix as unknown as number }
      expect(() =>
        creerRegleHonorairesCourrier({ id: 'r', libelle: 'r', declencheur: { par: 'modele', modeleIds: ['mod-1'] }, dossier: 'Contentieux', lignes: [ligne] }),
      ).not.toThrow()
      const { propositions, ecartees } = proposerHonorairesDuCourrier(courrier(), [regle([ligne])], contexte())
      expect(propositions, String(prix)).toEqual([])
      expect(
        ecartees.map((e) => [e.motif, e.rang]),
        String(prix),
      ).toEqual([['montant_non_saisi', 1]])
    }
  })

  it('0 vaut « non saisi » : la règle contrôlée porte null', () => {
    const r = regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: 0 }])
    expect(r.lignes[0].prixUnitaireHtDixMilliemes).toBeNull()
    expect(regle([ligneForfait]).lignes[0].prixUnitaireHtDixMilliemes).toBe(300_000)
  })

  it('montant saisi (au moins un dix-millième d’euro) : forfait proposé, sans alerte', () => {
    const { propositions, ecartees } = proposerHonorairesDuCourrier(courrier(), [regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: 1 }])], contexte())
    expect(propositions.map((p) => p.saisie.prixUnitaireHtDixMilliemes)).toEqual([1])
    expect(ecartees).toEqual([])
  })

  it('refus inchangés : prix négatif ou non entier', () => {
    expect(() => regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: -1 }])).toThrow(/prix unitaire invalide/)
    expect(() => regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: 2.5 }])).toThrow(/prix unitaire invalide/)
  })

  it('mission judiciaire : un forfait « Facturable » à 0 n’est plus proposé (il ne contourne plus le refus de « Offert », J67, R9)', () => {
    const r = regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: 0, qualification: 'Facturable' }])
    expect(proposerHonorairesDuCourrier(courrier(), [r], contexte()).propositions).toEqual([])
  })

  it('seul le forfait est visé : un frais d’envoi à 0 reste proposé (null refusé) ; creerElement admet toujours un prix de 0', () => {
    const [frais] = proposerHonorairesDuCourrier(courrier(), [regle([{ ...ligneAr, prixUnitaireHtDixMilliemes: 0 }])], contexte()).propositions
    expect(frais.saisie.prixUnitaireHtDixMilliemes).toBe(0)
    expect(() => regle([{ ...ligneAr, prixUnitaireHtDixMilliemes: null as unknown as number }])).toThrow(/prix unitaire invalide/)
    expect(creerElement(frais.saisie, 'judiciaire').prixUnitaireHtDixMilliemes).toBe(0)
  })

  it('règle inactive : seul l’écart « inactive », sans alerte de montant', () => {
    const r = regle([{ ...ligneForfait, prixUnitaireHtDixMilliemes: 0 }], false)
    expect(proposerHonorairesDuCourrier(courrier(), [r], contexte()).ecartees.map((e) => e.motif)).toEqual(['inactive'])
  })

  it('en-tête d’etapes-courrier.ts : J77 cité, avec la précision de Hugo du 18/11/2026', () => {
    const { item } = enTeteDuModule('etapes-courrier')
    const j77 = item('- J77 (réponse de Frédéric du 17/11/2026')
    expect(j77).toMatch(/précision de Hugo du 18\/11\/2026/)
    expect(j77).toMatch(/casDesFraisDEnvoi/)
    expect(j77).toMatch(/locataire/)
    expect(j77).toMatch(/à confirmer/)
    expect(j77).toMatch(/non saisi/)
    expect(j77).toMatch(/montant_non_saisi/)
  })
})
