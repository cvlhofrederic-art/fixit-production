import { describe, expect, it } from 'vitest'
import { proposerImputations, type LigneReleve } from '@/lib/administrateur-judiciaire/domain/import/releve-bancaire'
import { encaissementDepuisReleve, imputerEncaissement, type PosteDette } from '@/lib/administrateur-judiciaire/domain/imputation-encaissements'

/**
 * Encaissement créé depuis une ligne de relevé (point 40 du bilan 2, suite de la PR #596 ; Gestéam, tranche 43 § 2 : le
 * virement reçu garde la trace du rapprochement — syndicat, immeuble, compte, tiers — et le libellé de la pièce peut nommer
 * un autre payeur que le copropriétaire crédité).
 */

const coproprietaires = [
  { nom: 'Durand Claire', solde: -350, compteId: 'cpt-12', coproprieteId: 'copro-tilleuls', mandatId: 'm-1' },
  { nom: 'Martin Paul', solde: -120, compteId: 'cpt-14', coproprieteId: 'copro-tilleuls', mandatId: 'm-1' },
]
const ligne = (surcharge: Partial<LigneReleve> = {}): LigneReleve => ({ date: '2026-10-05', libelle: 'VIR SEPA DURAND CLAIRE T4', montant: 350, ...surcharge })
const proposition = (l: LigneReleve = ligne()) => proposerImputations([l], coproprietaires)[0]

describe('encaissement depuis une ligne de relevé', () => {
  it('garde le compte retenu, la date, le montant en centimes et la clé de rapprochement', () => {
    expect(encaissementDepuisReleve({ id: 'E1', proposition: proposition() })).toEqual({
      id: 'E1',
      compteId: 'cpt-12',
      date: '2026-10-05',
      montantCentimes: 35_000,
      payeur: null,
      cleRapprochement: {
        regle: 'Nom complet dans le libellé · montant égal au solde dû.',
        confiance: 'forte',
        compteId: 'cpt-12',
        coproprieteId: 'copro-tilleuls',
        mandatId: 'm-1',
        payeur: null,
        payeurTiers: false,
      },
    })
    expect(encaissementDepuisReleve({ id: 'E2', proposition: proposition(ligne({ montant: 350.1 })) }).montantCentimes).toBe(35_010)
  })

  it('un payeur qui n’est pas le copropriétaire crédité est gardé et marqué « tiers »', () => {
    const encaissement = encaissementDepuisReleve({ id: 'E1', proposition: proposition(), payeur: ' Notaire Lefèvre ' })
    expect(encaissement.payeur).toBe('Notaire Lefèvre')
    expect(encaissement.cleRapprochement).toMatchObject({ payeur: 'Notaire Lefèvre', payeurTiers: true })
  })

  it('compte choisi par le gestionnaire : la clé le dit, avec la proposition écartée', () => {
    const encaissement = encaissementDepuisReleve({
      id: 'E1',
      proposition: proposition(),
      payeur: 'DURAND CLAIRE',
      compteChoisi: { id: 'cpt-14', nom: 'Martin Paul', coproprieteId: 'copro-tilleuls', mandatId: 'm-1' },
    })
    expect(encaissement.compteId).toBe('cpt-14')
    expect(encaissement.cleRapprochement).toEqual({
      regle: 'Choix du gestionnaire (proposition écartée : cpt-12).',
      confiance: 'manuelle',
      compteId: 'cpt-14',
      coproprieteId: 'copro-tilleuls',
      mandatId: 'm-1',
      payeur: 'DURAND CLAIRE',
      payeurTiers: true,
    })
  })

  it('sans candidat : le compte choisi par le gestionnaire est exigé', () => {
    const inconnue = proposition(ligne({ libelle: 'VIR SEPA INCONNU' }))
    expect(() => encaissementDepuisReleve({ id: 'E1', proposition: inconnue })).toThrow(/compte/i)
    expect(encaissementDepuisReleve({ id: 'E1', proposition: inconnue, compteChoisi: { id: 'cpt-12', nom: 'Durand Claire' } }).cleRapprochement).toMatchObject({
      regle: 'Choix du gestionnaire (aucune proposition).',
      confiance: 'manuelle',
      compteId: 'cpt-12',
      coproprieteId: null,
    })
  })

  it('refuse un débit, un montant non fini ou une date invalide', () => {
    expect(() => encaissementDepuisReleve({ id: 'E1', proposition: proposition(ligne({ montant: -12.5 })), compteChoisi: { id: 'cpt-12', nom: 'Durand Claire' } })).toThrow(
      /^Ligne de relevé de -12,50\s€ : seul un crédit \(montant positif\) est un encaissement\.$/,
    )
    expect(() => encaissementDepuisReleve({ id: 'E1', proposition: proposition(ligne({ montant: 0 })), compteChoisi: { id: 'cpt-12', nom: 'Durand Claire' } })).toThrow(/seul un crédit/)
    expect(() => encaissementDepuisReleve({ id: 'E1', proposition: proposition(ligne({ montant: Number.NaN })), compteChoisi: { id: 'cpt-12', nom: 'Durand Claire' } })).toThrow(/montant/i)
    expect(() => encaissementDepuisReleve({ id: 'E1', proposition: proposition(ligne({ date: '05/10/2026' })) })).toThrow(/AAAA-MM-JJ/)
  })

  it('l’encaissement s’impute comme les autres', () => {
    const postes: PosteDette[] = [
      { id: 'B-1:lot-1', compteId: 'cpt-12', appelId: 'B-1', typeAppel: 'Budget', libelle: 'Budget 2026 — provision 4/4', exigibilite: '2026-10-01', montantCentimes: 35_000, regleCentimes: 0, contentieux: false },
    ]
    const resultat = imputerEncaissement(encaissementDepuisReleve({ id: 'E1', proposition: proposition() }), postes)
    expect(resultat).toMatchObject({ lignes: [{ posteId: 'B-1:lot-1', montantCentimes: 35_000 }], resteAImputerCentimes: 0 })
  })
})
