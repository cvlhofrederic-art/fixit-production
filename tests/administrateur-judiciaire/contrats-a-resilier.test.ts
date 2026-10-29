import { describe, expect, it } from 'vitest'
import {
  alertesAResilier,
  elementsSuiviAResilier,
  fusionnerSuiviAResilier,
  type ContratAResilier,
} from '@/lib/administrateur-judiciaire/domain/contrats-a-resilier'
import type { FacturationContrat } from '@/lib/administrateur-judiciaire/domain/contrats-facturation'
import { depuisContrats, reglageParDefaut, selectionnerAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'

/**
 * Marque « À résilier » d'un contrat (point 34 du bilan 2 ; Gestéam, tranche 33 : case « À résilier », Préavis, Limite,
 * Tacite, bouton Résilier + date). Droit relu sur Légifrance le 29/10/2026 : C. consom. art. L. 215-1 (information écrite
 * du prestataire trois mois au plus tôt et un mois au plus tard avant la date limite ; à défaut, résiliation gratuite à
 * tout moment à compter de la reconduction), L. 215-3 (non-professionnels), L. 215-5 (assurances exclues) ; C. assur.
 * art. L. 113-12 (résiliation annuelle, au moins deux mois avant l'échéance), L. 113-15 (reconduction tacite d'un an au
 * plus) ; C. civ. art. 1211, 1212, 1214, 1215.
 */

const facturation = (surcharge: Partial<FacturationContrat> = {}): FacturationContrat => ({
  dateEffet: '2024-01-01',
  dureeMois: 12,
  tacite: true,
  preavisMois: 3,
  prixOrigineTtcCentimes: null,
  prixDernierTtcCentimes: null,
  montantAlerteCentimes: null,
  indice: null,
  periodiciteFacturesMois: null,
  derniereFacture: null,
  retardFactureJours: null,
  codification: null,
  ...surcharge,
})

const contrat = (surcharge: Partial<ContratAResilier> = {}): ContratAResilier => ({
  id: 'ctr-1',
  mandatId: 'm-1',
  libelle: 'Maintenance ascenseur',
  statut: 'En cours',
  type: 'Maintenance',
  aResilier: true,
  resiliationNotifieeLe: null,
  // Information du prestataire reçue pour la dernière reconduction (limite du 2025-10-01).
  informationsRecues: ['2025-08-15'],
  facturation: facturation(),
  ...surcharge,
})

const INFORME_2025_2026 = ['2025-08-15', '2026-08-01']

describe('contrats retenus', () => {
  it('seulement les contrats marqués, en cours, hors contrat de travail', () => {
    expect(alertesAResilier([contrat({ aResilier: false }), contrat({ aResilier: undefined })], '2026-09-05')).toEqual([])
    expect(alertesAResilier([contrat({ statut: 'Résilié' }), contrat({ statut: 'Plus géré' })], '2026-09-05')).toEqual([])
    expect(alertesAResilier([contrat({ type: 'Contrat de travail' })], '2026-09-05')).toEqual([])
    expect(alertesAResilier([contrat({ statut: undefined })], '2026-09-05')).toHaveLength(1)
  })

  it('refuse une date invalide', () => {
    expect(() => alertesAResilier([contrat()], '05/09/2026')).toThrow(/AAAA-MM-JJ/)
    expect(() => alertesAResilier([contrat({ resiliationNotifieeLe: '2026-13-01' })], '2026-09-05')).toThrow(/AAAA-MM-JJ/)
    expect(() => alertesAResilier([contrat({ informationsRecues: ['x'] })], '2026-09-05')).toThrow(/AAAA-MM-JJ/)
  })
})

describe('reconduction tacite', () => {
  it('avant la limite : à faire 30 jours avant (réglable), limite = terme − préavis', () => {
    expect(alertesAResilier([contrat()], '2026-09-05')).toMatchObject([
      { contratId: 'ctr-1', etat: 'avant_limite', aAgirLe: '2026-09-01', dateLimite: '2026-10-01', terme: '2027-01-01', aConfirmer: false },
    ])
    expect(alertesAResilier([contrat()], '2026-09-05', { anticipationJours: 60 })[0].aAgirLe).toBe('2026-08-02')
  })

  it('limite dépassée et information reçue : prochaine limite, à préparer 30 jours avant', () => {
    expect(alertesAResilier([contrat({ informationsRecues: INFORME_2025_2026 })], '2026-10-15')).toMatchObject([
      { etat: 'limite_depassee', dateLimite: '2026-10-01', terme: '2027-01-01', prochaineLimite: '2027-10-01', aAgirLe: '2027-09-01', aConfirmer: false },
    ])
  })

  it('limite dépassée sans information conforme : résiliation gratuite dès la reconduction (L. 215-1, à confirmer)', () => {
    const [alerte] = alertesAResilier([contrat()], '2026-10-15')
    expect(alerte).toMatchObject({ etat: 'limite_depassee', aAgirLe: '2027-01-01', prochaineLimite: '2027-10-01', aConfirmer: true, fondement: 'C. consom. art. L. 215-1, L. 215-3' })
    expect(alerte.message).toMatch(/résiliation gratuite possible à tout moment dès la reconduction du 01\/01\/2027/)
  })

  it('reconduit sans information conforme : résiliable à tout moment (à confirmer pour un syndicat)', () => {
    // Aucune information, ou information hors de la fenêtre (moins d'un mois, ou plus de trois mois, avant la limite du 2025-10-01).
    for (const informationsRecues of [[], ['2025-09-15'], ['2025-06-01']])
      expect(alertesAResilier([contrat({ informationsRecues })], '2026-09-05')).toMatchObject([
        { etat: 'resiliable_a_tout_moment', aAgirLe: '2026-09-05', aConfirmer: true, fondement: 'C. consom. art. L. 215-1, L. 215-3' },
      ])
  })

  it('information non renseignée : aucune faculté supposée, le message le signale', () => {
    const [alerte] = alertesAResilier([contrat({ informationsRecues: null })], '2026-09-05')
    expect(alerte).toMatchObject({ etat: 'avant_limite' })
    expect(alerte.message).toMatch(/information du prestataire non renseignée/i)
  })

  it('première période pas encore reconduite : pas de faculté', () => {
    expect(alertesAResilier([contrat({ informationsRecues: [], facturation: facturation({ dateEffet: '2026-03-01' }) })], '2026-09-05')).toMatchObject([
      { etat: 'avant_limite', dateLimite: '2026-12-01', terme: '2027-03-01' },
    ])
  })

  it('préavis au moins égal à la période : la prochaine limite atteignable, jamais une limite déjà passée', () => {
    const mensuel = contrat({ informationsRecues: null, facturation: facturation({ dateEffet: '2026-01-01', dureeMois: 1, preavisMois: 2 }) })
    expect(alertesAResilier([mensuel], '2026-09-05')).toMatchObject([{ etat: 'avant_limite', dateLimite: '2026-10-01', terme: '2026-12-01', aAgirLe: '2026-09-01' }])
  })
})

describe('résiliation déjà envoyée', () => {
  it('à temps : fin au terme, statut à mettre à jour', () => {
    expect(alertesAResilier([contrat({ resiliationNotifieeLe: '2026-09-20' })], '2026-10-15')).toMatchObject([
      { etat: 'resiliation_envoyee', terme: '2027-01-01', aAgirLe: '2027-01-01', dateLimite: '2026-10-01', aConfirmer: false },
    ])
  })

  it('après la limite, information reçue : effet au premier terme dont la limite n’était pas passée', () => {
    expect(alertesAResilier([contrat({ resiliationNotifieeLe: '2026-10-10', informationsRecues: INFORME_2025_2026 })], '2026-10-15')).toMatchObject([
      { etat: 'resiliation_tardive', terme: '2028-01-01', aAgirLe: '2026-10-15', aConfirmer: false },
    ])
  })

  it('après la limite, sans information pour cette limite : à renouveler dès la reconduction (L. 215-1, à confirmer)', () => {
    const [alerte] = alertesAResilier([contrat({ resiliationNotifieeLe: '2026-10-10' })], '2026-10-15')
    expect(alerte).toMatchObject({ etat: 'resiliation_tardive', aAgirLe: '2027-01-01', terme: '2028-01-01', aConfirmer: true, fondement: 'C. consom. art. L. 215-1, L. 215-3' })
  })

  it('après la limite, faculté de L. 215-1 déjà ouverte : valable dès réception si elle s’applique (à confirmer)', () => {
    expect(alertesAResilier([contrat({ resiliationNotifieeLe: '2026-10-10', informationsRecues: [] })], '2026-10-15')).toMatchObject([
      { etat: 'resiliation_par_faculte', aConfirmer: true, terme: '2028-01-01' },
    ])
  })

  it('avant la limite mais contrat déjà reconduit sans information : la faculté de L. 215-1 prime (à confirmer)', () => {
    const reconduit = contrat({ informationsRecues: [], resiliationNotifieeLe: '2026-03-01', facturation: facturation({ dateEffet: '2025-01-01' }) })
    expect(alertesAResilier([reconduit], '2026-03-05')).toMatchObject([{ etat: 'resiliation_par_faculte', aConfirmer: true, fondement: 'C. consom. art. L. 215-1, L. 215-3' }])
  })

  it('contrat poursuivi après son terme, sans reconduction tacite : effet au terme du préavis (C. civ. art. 1211)', () => {
    const poursuivi = contrat({ resiliationNotifieeLe: '2026-09-01', facturation: facturation({ tacite: false, dateEffet: '2024-01-01' }) })
    expect(alertesAResilier([poursuivi], '2026-10-15')).toMatchObject([
      { etat: 'resiliation_envoyee', terme: '2026-12-01', aAgirLe: '2026-12-01', aConfirmer: true, fondement: 'C. civ. art. 1211' },
    ])
    const sansPreavis = contrat({ resiliationNotifieeLe: '2026-09-01', facturation: facturation({ tacite: false, dateEffet: '2024-01-01', preavisMois: 0 }) })
    const [delai] = alertesAResilier([sansPreavis], '2026-10-15')
    expect(delai).toMatchObject({ etat: 'resiliation_envoyee', terme: null, aAgirLe: '2026-10-15' })
    expect(delai.message).toMatch(/délai raisonnable, à apprécier/)
  })

  it('contrat sans reconduction tacite résilié avant son terme : fin au terme, jamais avant (C. civ. art. 1212)', () => {
    for (const [envoi, preavisMois] of [['2026-03-01', 1], ['2026-05-15', 3]] as const) {
      const cdd = contrat({ resiliationNotifieeLe: envoi, facturation: facturation({ tacite: false, dateEffet: '2025-06-01', preavisMois }) })
      expect(alertesAResilier([cdd], '2026-07-05')).toMatchObject([{ etat: 'resiliation_envoyee', terme: '2026-06-01', aAgirLe: '2026-07-05', aConfirmer: false, fondement: 'C. civ. art. 1212' }])
    }
  })
})

describe('type du contrat', () => {
  it('type absent : règles des prestations de services appliquées sous réserve', () => {
    const [alerte] = alertesAResilier([contrat({ type: undefined, informationsRecues: [] })], '2026-09-05')
    expect(alerte).toMatchObject({ etat: 'resiliable_a_tout_moment', aConfirmer: true })
    expect(alerte.message).toMatch(/Type du contrat à renseigner/)
  })
})

describe('autres régimes', () => {
  it('assurance : au moins deux mois avant l’échéance, préavis plus court de la police signalé, pas de faculté de L. 215-1', () => {
    const [alerte] = alertesAResilier([contrat({ type: 'Assurance', informationsRecues: [], facturation: facturation({ preavisMois: 1 }) })], '2026-09-05')
    expect(alerte).toMatchObject({ etat: 'avant_limite', dateLimite: '2026-11-01', aAgirLe: '2026-10-02', aConfirmer: true, fondement: 'C. assur. art. L. 113-12, L. 113-15' })
    expect(alerte.message).toMatch(/calcul prudent à deux mois/)
  })

  it('assurance de trois ans : échéances annuelles puis reconduction d’un an au plus, à confirmer selon la police', () => {
    const [alerte] = alertesAResilier([contrat({ type: 'Assurance', facturation: facturation({ dateEffet: '2023-01-01', dureeMois: 36, preavisMois: 2 }) })], '2026-10-29')
    expect(alerte).toMatchObject({ etat: 'avant_limite', dateLimite: '2026-11-01', terme: '2027-01-01', aAgirLe: '2026-10-02', aConfirmer: true })
    expect(alerte.message).toMatch(/échéances annuelles/)
  })

  it('assurance de dix-huit mois : échéance annuelle, terme de la police, puis reconductions d’un an', () => {
    const police = (surcharge: Partial<ContratAResilier> = {}) =>
      contrat({ type: 'Assurance', facturation: facturation({ dateEffet: '2025-07-01', dureeMois: 18, preavisMois: 2 }), ...surcharge })
    expect(alertesAResilier([police()], '2026-04-15')).toMatchObject([{ dateLimite: '2026-05-01', terme: '2026-07-01' }])
    expect(alertesAResilier([police()], '2026-10-29')).toMatchObject([{ etat: 'avant_limite', dateLimite: '2026-11-01', terme: '2027-01-01' }])
    expect(alertesAResilier([police()], '2027-03-01')).toMatchObject([{ dateLimite: '2027-11-01', terme: '2028-01-01' }])
    expect(alertesAResilier([police({ resiliationNotifieeLe: '2026-10-15' })], '2026-10-20')).toMatchObject([{ etat: 'resiliation_envoyee', terme: '2027-01-01' }])
  })

  it('assurance : la limite légale (deux mois) juge le retard ; un préavis plus long de la police avance seulement le rappel', () => {
    const police = (surcharge: Partial<ContratAResilier> = {}) =>
      contrat({ type: 'Assurance', facturation: facturation({ dateEffet: '2026-01-01', preavisMois: 3 }), ...surcharge })
    const [alerte] = alertesAResilier([police()], '2026-10-15')
    expect(alerte).toMatchObject({ etat: 'avant_limite', dateLimite: '2026-11-01', aAgirLe: '2026-09-01', aConfirmer: true })
    expect(alerte.message).toMatch(/la loi permet de dénoncer jusqu'à deux mois avant l'échéance/)
    expect(alertesAResilier([police({ resiliationNotifieeLe: '2026-10-20' })], '2026-10-25')).toMatchObject([{ etat: 'resiliation_envoyee', terme: '2027-01-01' }])
  })

  it('assurance sans reconduction tacite : échéances annuelles jusqu’au terme de la police, puis reconduction d’un an au plus', () => {
    const longue = contrat({ type: 'Assurance', facturation: facturation({ tacite: false, dateEffet: '2025-01-01', dureeMois: 36, preavisMois: 2 }) })
    expect(alertesAResilier([longue], '2026-10-29')).toMatchObject([{ etat: 'avant_limite', dateLimite: '2026-11-01', terme: '2027-01-01' }])
    const echue = contrat({ type: 'Assurance', facturation: facturation({ tacite: false, dateEffet: '2024-01-01', preavisMois: 2 }) })
    expect(alertesAResilier([echue], '2026-09-05')).toMatchObject([{ etat: 'terme_depasse', fondement: 'C. assur. art. L. 113-15', aConfirmer: true }])
    // Le terme de la police n'est pas une échéance à dénoncer : la police non tacite prend fin d'elle-même.
    const annuelle = contrat({ type: 'Assurance', facturation: facturation({ tacite: false, dateEffet: '2026-01-01', preavisMois: 2 }) })
    expect(alertesAResilier([annuelle], '2026-09-05')).toMatchObject([{ etat: 'fin_au_terme', terme: '2027-01-01' }])
    expect(alertesAResilier([longue], '2027-10-15')).toMatchObject([{ etat: 'fin_au_terme', terme: '2028-01-01' }])
    expect(alertesAResilier([longue], '2026-11-15')).toMatchObject([{ etat: 'fin_au_terme', terme: '2028-01-01' }])
  })

  it('assurance semestrielle : échéance hors anniversaire au préavis de la police (L. 113-12 al. 1), échéance annuelle à deux mois', () => {
    const semestrielle = (surcharge: Partial<ContratAResilier> = {}) =>
      contrat({ type: 'Assurance', facturation: facturation({ dateEffet: '2026-05-01', dureeMois: 6, preavisMois: 3 }), ...surcharge })
    expect(alertesAResilier([semestrielle()], '2026-08-15')).toMatchObject([{ etat: 'limite_depassee', dateLimite: '2026-08-01', terme: '2026-11-01', prochaineLimite: '2027-03-01' }])
    expect(alertesAResilier([semestrielle({ resiliationNotifieeLe: '2026-08-20' })], '2026-08-25')).toMatchObject([{ etat: 'resiliation_tardive', terme: '2027-05-01' }])
  })

  it('fourniture de consommables : pas de faculté de L. 215-1 (vente, non prestation de services)', () => {
    const [alerte] = alertesAResilier([contrat({ type: 'Fourniture de consommable', informationsRecues: [] })], '2026-09-05')
    expect(alerte).toMatchObject({ etat: 'avant_limite', aConfirmer: false })
    expect(alerte.message).not.toMatch(/L\. 215-1/)
  })

  it('dommages-ouvrage : pas d’échéance annuelle à attendre (à confirmer)', () => {
    expect(alertesAResilier([contrat({ type: 'Dommages Ouvrages' })], '2026-09-05')).toMatchObject([{ etat: 'non_resiliable', aConfirmer: true }])
  })

  it('sans reconduction tacite : fin au terme (C. civ. art. 1212) ; terme dépassé : reconduction possible en durée indéterminée', () => {
    expect(alertesAResilier([contrat({ facturation: facturation({ tacite: false, dateEffet: '2026-01-01' }) })], '2026-09-05')).toMatchObject([
      { etat: 'fin_au_terme', terme: '2027-01-01', aAgirLe: '2027-01-01', fondement: 'C. civ. art. 1212' },
    ])
    const [echu] = alertesAResilier([contrat({ facturation: facturation({ tacite: false, dateEffet: '2024-01-01' }) })], '2026-09-05')
    expect(echu).toMatchObject({ etat: 'terme_depasse', terme: '2025-01-01', aAgirLe: '2026-09-05', aConfirmer: true, fondement: 'C. civ. art. 1211, 1214, 1215' })
    expect(alertesAResilier([contrat({ facturation: undefined })], '2026-09-05')).toMatchObject([{ etat: 'dates_a_completer', aAgirLe: '2026-09-05' }])
  })
})

describe('suivi « à faire »', () => {
  const affectations = [{ mandatId: 'm-1', cabinetId: null, responsableId: 'collab-1', comptableId: null, assistantId: null }]
  const reglage = reglageParDefaut('collab-1')
  const id = 'contrats:ctr-1:limite_resiliation'

  it('avant la limite : l’élément « à résilier » remplace la limite générique et remonte avant elle', () => {
    const contrats = [contrat()]
    const aujourdhui = '2026-09-05'
    const elements = elementsSuiviAResilier(alertesAResilier(contrats, aujourdhui))
    expect(elements).toMatchObject([{ id, famille: 'contrats', nature: 'limite_resiliation', date: '2026-09-01', mandatId: 'm-1', objetId: 'ctr-1' }])
    expect(elements[0].libelle).toBe('À résilier — Maintenance ascenseur : Dénoncer au plus tard le 01/10/2026 (préavis de 3 mois avant le terme du 01/01/2027).')
    expect(selectionnerAFaire(depuisContrats(contrats, aujourdhui), reglage, affectations, aujourdhui)).toEqual([])
    expect(selectionnerAFaire(fusionnerSuiviAResilier(alertesAResilier(contrats, aujourdhui), depuisContrats(contrats, aujourdhui)), reglage, affectations, aujourdhui)).toMatchObject([
      { id, date: '2026-09-01' },
    ])
  })

  it('limite dépassée : la limite générique échue disparaît au profit de l’élément « à résilier », même hors horizon', () => {
    const contrats = [contrat()]
    const aujourdhui = '2026-10-15'
    expect(selectionnerAFaire(depuisContrats(contrats, aujourdhui), reglage, affectations, aujourdhui)).toMatchObject([{ id, date: '2026-10-01' }])
    const fusion = fusionnerSuiviAResilier(alertesAResilier(contrats, aujourdhui), depuisContrats(contrats, aujourdhui))
    expect(fusion.filter((e) => e.id === id)).toHaveLength(1)
    expect(fusion.find((e) => e.id === id)?.libelle).toMatch(/^À résilier — /)
    expect(selectionnerAFaire(fusion, reglage, affectations, aujourdhui)).toEqual([])
  })

  it('résiliation envoyée à temps : l’élément occupe aussi la place de la limite générique', () => {
    const contrats = [contrat({ resiliationNotifieeLe: '2026-09-20' })]
    const fusion = fusionnerSuiviAResilier(alertesAResilier(contrats, '2026-09-25'), depuisContrats(contrats, '2026-09-25'))
    expect(fusion.filter((e) => e.id === id)).toMatchObject([{ date: '2027-01-01' }])
  })
})
