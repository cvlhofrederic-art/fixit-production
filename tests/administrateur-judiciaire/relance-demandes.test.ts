import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  changerStade,
  changerStatut,
  creerDemande,
  modeleDeNature,
  rattacherFacture,
  terminerDemande,
  type Demande,
  type ModeleDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import {
  creerSortieOs,
  enregistrerReception,
  envoyerOs,
  fixerRelance,
  relancerOs,
  type ContexteEnvoiOs,
  type SaisieDiffusion,
  type SortieOrdreService,
} from '@/lib/administrateur-judiciaire/domain/envoi-ordre-service'
import { nouvelleFicheEntreprise, type RelancesService } from '@/lib/administrateur-judiciaire/domain/fiche-entreprise'
import { creerRattachement } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  alertesChargeEntreprises,
  attendEntreprise,
  chargesEntreprises,
  controlerPlafondAvantAttribution,
  demandesUniques,
  estDemandeEnCours,
  libelleChargeEntreprise,
  libelleRelanceDemande,
  reglageRelance,
  relancesDemandesDues,
  SERVICE_DEMANDE_PAR_DEFAUT,
  type DemandeSuivie,
  type EntrepriseRelance,
} from '@/lib/administrateur-judiciaire/domain/relance-demandes'
import {
  depuisDemandes,
  FAMILLES_SUIVI,
  LIBELLES_FAMILLES_SUIVI,
  LIBELLES_NATURES_SUIVI,
  NATURES_SUIVI,
  reglageParDefaut,
  selectionnerAFaire,
  type AffectationMandat,
  type ReglageSuivi,
} from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import type { PiecesEntreprise } from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'

/**
 * Entreprises : relance des demandes (point 46 du bilan 2 ; Gestéam, tranche 39 § Entreprise, onglet Demandes : par
 * service, colonnes Devis et Interventions, délai de relance, nombre maximum de demandes en cours, alerte au-delà d'un
 * seuil ; tranche 38 : blocs « Dem. interv. » et « Demandes devis » du Suivi). Droit relevé le 03/11/2026 : aucun texte
 * de la loi de 1965 ni du décret de 1967 sur la relance d'une entreprise (règles de gestion du cabinet).
 */

const AUJOURDHUI = '2026-10-20'

const modele = (nature: string): ModeleDemande => {
  const trouve = modeleDeNature(nature)
  if (!trouve) throw new Error(`Modèle absent du test : ${nature}`)
  return trouve
}

const OS = modele('OS Copro')
const DEVIS = modele('Demande devis Copro')

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

const intervention = (surcharge: Partial<SaisieDemande> = {}): Demande => creerDemande(saisie(surcharge), OS)
const devis = (surcharge: Partial<SaisieDemande> = {}): Demande => creerDemande(saisie({ numero: null, prix: null, ...surcharge }), DEVIS)

/** Devis : relance à 8 jours, maximum 3, alerte au-delà de 1 ; interventions : relance à 3 jours, maximum 10, alerte au-delà de 8. */
const RELANCES: RelancesService = {
  devis: { delaiRelanceJours: 8, maxDemandesEnCours: 3, alerteAuDela: 1 },
  interventions: { delaiRelanceJours: 3, maxDemandesEnCours: 10, alerteAuDela: 8 },
}
const FICHE = nouvelleFicheEntreprise({ relances: RELANCES })
const ENTREPRISES: EntrepriseRelance[] = [{ id: 'ent-1', fiche: FICHE }, { id: 'ent-sans-fiche' }]

const PIECES: PiecesEntreprise = {
  prestataireId: 'ent-1',
  etablieEnFrance: true,
  attestationUrssafLe: '2026-09-01',
  attestationUrssafVerifiee: true,
  immatriculation: { nature: 'kbis', le: '2026-09-01' },
}

const CONTEXTE: Omit<ContexteEnvoiOs, 'date'> = {
  pieces: PIECES,
  controle: { decennaleObligatoire: false },
  prestataireAvecCompteVitfix: true,
}

const ENVOI: SaisieDiffusion = {
  date: '2026-10-03',
  heure: '10:00',
  collaborateurId: 'col-gestion',
  canal: 'messagerie_vitfix',
  destinataire: creerRattachement('Entreprise', 'ent-1'),
  missionId: 'mission-1',
}

const sortiePrete = (d: Demande): SortieOrdreService =>
  creerSortieOs(d, { signataireId: 'col-direction', canal: 'messagerie_vitfix', fondement: 'administration_courante', entrepriseLiee: false })

const envoyee = (d: Demande): SortieOrdreService => envoyerOs(d, sortiePrete(d), ENVOI, CONTEXTE)

const item = (demande: Demande, extra: Omit<DemandeSuivie, 'demande'> = {}): DemandeSuivie => ({ demande, ...extra })

describe('réglage de relance de l’entreprise (tranche 39 : par service, colonnes Devis et Interventions)', () => {
  it('le réglage de la fiche vaut pour le service Copropriété, celui d’un service prévaut, un autre service sans réglage : rien', () => {
    expect(SERVICE_DEMANDE_PAR_DEFAUT).toBe('Copropriété')
    expect(reglageRelance(FICHE, 'Copropriété', 'devis')).toEqual(RELANCES.devis)
    expect(reglageRelance(FICHE, 'Copropriété', 'intervention')).toEqual(RELANCES.interventions)
    expect(reglageRelance(FICHE, 'Gérance', 'devis')).toBeNull()
    const propre = { ...RELANCES, devis: { delaiRelanceJours: 15, maxDemandesEnCours: 2, alerteAuDela: 1 } }
    const parService = { ...FICHE, relancesParService: { Copropriété: propre, Gérance: RELANCES } }
    expect(reglageRelance(parService, 'Copropriété', 'devis')).toEqual(propre.devis)
    expect(reglageRelance(parService, 'Gérance', 'intervention')).toEqual(RELANCES.interventions)
    expect(reglageRelance(null, 'Copropriété', 'devis')).toBeNull()
    expect(reglageRelance(undefined, 'Copropriété', 'devis')).toBeNull()
  })

  it('refuse un service ou un type inconnus, et un réglage qui n’est pas un entier positif ou nul', () => {
    expect(() => reglageRelance(FICHE, 'Syndic' as never, 'devis')).toThrow(/Service inconnu/)
    expect(() => reglageRelance(FICHE, 'Copropriété', 'travaux' as never)).toThrow(/Type de demande inconnu/)
    const invalide = (valeur: number) =>
      reglageRelance({ relances: { ...RELANCES, devis: { ...RELANCES.devis, delaiRelanceJours: valeur } } }, 'Copropriété', 'devis')
    expect(() => invalide(-1)).toThrow(/entier positif ou nul/)
    expect(() => invalide(2.5)).toThrow(/Copropriété, Devis, delaiRelanceJours/)
    expect(invalide(0)?.delaiRelanceJours).toBe(0)
  })
})

describe('demandes en cours, en attente de l’entreprise (🔵)', () => {
  it('en cours : demandée au plus tard ce jour, ni terminée ni refusée', () => {
    expect(estDemandeEnCours(devis(), AUJOURDHUI)).toBe(true)
    expect(estDemandeEnCours(devis({ demandeLe: '2026-10-21' }), AUJOURDHUI)).toBe(false)
    expect(estDemandeEnCours(terminerDemande(devis(), [], '2026-10-10'), AUJOURDHUI)).toBe(false)
    expect(estDemandeEnCours(changerStatut(devis(), 'Refusé'), AUJOURDHUI)).toBe(false)
    expect(estDemandeEnCours(changerStade(intervention(), 'Refusée', { date: '2026-10-02' }), AUJOURDHUI)).toBe(false)
    expect(estDemandeEnCours(changerStatut(intervention(), 'Accepté'), AUJOURDHUI)).toBe(true)
  })

  it('attend l’entreprise : devis non reçu ni accepté ; intervention non réalisée ; accusé ou rapport demandé', () => {
    expect(attendEntreprise(devis())).toBe(true)
    expect(attendEntreprise(devis({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 50_000 } }))).toBe(false)
    expect(attendEntreprise(changerStatut(devis(), 'Accepté'))).toBe(false)
    expect(attendEntreprise(intervention())).toBe(true)
    expect(attendEntreprise(changerStade(intervention(), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-15' }))).toBe(true)
    const realisee = changerStade(intervention(), 'Réalisée', { date: '2026-10-12' })
    expect(attendEntreprise(realisee)).toBe(false)
    expect(attendEntreprise(changerStatut(realisee, 'Rapport demandé'))).toBe(true)
    expect(attendEntreprise(changerStatut(realisee, 'Accusé demandé'))).toBe(true)
  })

  it('intervention qui porte une facture, même sans date de réalisation ni stade : l’entreprise a répondu, sauf accusé ou rapport demandé', () => {
    const facturee = rattacherFacture(intervention({ id: 'int-f' }), 'facture-1')
    expect(facturee.realiseeLe).toBeNull()
    expect(facturee.stade).toBeNull()
    expect(attendEntreprise(facturee)).toBe(false)
    expect(attendEntreprise(changerStatut(facturee, 'Rapport demandé'))).toBe(true)
    expect(attendEntreprise(changerStatut(facturee, 'Accusé demandé'))).toBe(true)
    expect(relancesDemandesDues([item(facturee)], ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(relancesDemandesDues([item(changerStatut(facturee, 'Rapport demandé'))], ENTREPRISES, AUJOURDHUI)).toEqual([
      expect.objectContaining({ demandeId: 'int-f', date: '2026-10-04' }),
    ])
  })

  it('stades « Proposition en cours » et « Proposition résident » : en attente de l’entreprise (choix retenu, 🔴 question à Hugo)', () => {
    for (const stade of ['Proposition en cours', 'Proposition résident'] as const)
      expect(attendEntreprise(changerStade(intervention(), stade, { date: '2026-10-02' }))).toBe(true)
  })

  it('date de référence invalide : refusée, comme dans les autres fonctions du module', () => {
    expect(() => estDemandeEnCours(devis(), '20/10/2026')).toThrow(/Date de référence invalide \(20\/10\/2026\) : AAAA-MM-JJ attendu/)
    expect(() => estDemandeEnCours(devis(), '2026-13-45')).toThrow(/AAAA-MM-JJ/)
  })
})

describe('une demande vue plusieurs fois (demandesUniques) : une seule occurrence, quel que soit l’ordre', () => {
  it('la sortie et le service donnés par l’une des occurrences valent pour la demande ; copies identiques : une seule', () => {
    const d = intervention({ prevuLe: '2026-10-02' })
    const sortie = envoyee(d)
    expect(demandesUniques([item(d), item(d, { sortie, service: 'Gérance' }), item(d)])).toEqual([{ demande: d, sortie, service: 'Gérance' }])
    expect(demandesUniques([item(d, { sortie }), item(d)])).toEqual([{ demande: d, sortie }])
    expect(demandesUniques([item(d), item(d, { sortie })])).toEqual([{ demande: d, sortie }])
    const { id, ...reste } = devis()
    const uniques = demandesUniques([item(devis()), item({ ...reste, id }), item(devis({ id: 'dem-2' }))])
    expect(uniques.map((i) => i.demande.id)).toEqual(['dem-1', 'dem-2'])
  })

  it('occurrences contradictoires (deux versions, deux sorties, deux services) : erreur, aucune n’est choisie', () => {
    const d = devis()
    expect(() => demandesUniques([item(d), item({ ...d, prestataireId: 'ent-2' })])).toThrow(/dem-1 reçue en deux versions différentes/)
    expect(() => demandesUniques([item(d, { service: 'Copropriété' }), item(d, { service: 'Gérance' })])).toThrow(/dem-1 reçue pour deux services/)
    const os = intervention({ id: 'int-1' })
    const envoye = envoyee(os)
    expect(() => demandesUniques([item(os, { sortie: envoye }), item(os, { sortie: fixerRelance(envoye, '2026-10-25') })])).toThrow(
      /int-1 reçue avec deux sorties d'OS différentes/,
    )
  })
})

describe('relances dues (délai de relance de l’entreprise)', () => {
  it('demande de devis sans sortie : demandée le 01/10, relance à 8 jours, sans collaborateur désigné', () => {
    const [relance] = relancesDemandesDues([item(devis())], ENTREPRISES, AUJOURDHUI)
    expect(relance).toEqual({
      demandeId: 'dem-1',
      prestataireId: 'ent-1',
      type: 'devis',
      service: 'Copropriété',
      mandatId: 'mandat-1',
      reference: 'dem-1',
      objet: 'Recherche de fuite colonne',
      date: '2026-10-09',
      depart: { date: '2026-10-01', depuis: 'demandee' },
      delaiJours: 8,
      assigneId: null,
    })
    expect(libelleRelanceDemande(relance)).toBe(
      "Relancer l'entreprise : demande de devis dem-1 (Recherche de fuite colonne), demandée le 01/10/2026 ; délai de relance de 8 jours (Copropriété)",
    )
  })

  it('intervention : départ au plus tardif de la demande et de l’intervention prévue', () => {
    expect(relancesDemandesDues([item(intervention({ prevuLe: '2026-10-15' }))], ENTREPRISES, AUJOURDHUI)).toEqual([
      expect.objectContaining({ date: '2026-10-18', depart: { date: '2026-10-15', depuis: 'intervention_prevue' }, delaiJours: 3, reference: '12.3.456' }),
    ])
    expect(relancesDemandesDues([item(intervention())], ENTREPRISES, AUJOURDHUI)[0].date).toBe('2026-10-04')
  })

  it('OS envoyé : départ à la dernière ligne du journal adressée à l’entreprise (envoi, relance, réception), pour le collaborateur du premier envoi', () => {
    const d = intervention({ prevuLe: '2026-10-02' })
    const envoye = envoyee(d)
    expect(relancesDemandesDues([item(d, { sortie: envoye })], ENTREPRISES, AUJOURDHUI)).toEqual([
      expect.objectContaining({ date: '2026-10-06', depart: { date: '2026-10-03', depuis: 'envoi' }, assigneId: 'col-gestion' }),
    ])
    const relance = relancerOs(envoye, { ...ENVOI, date: '2026-10-08', heure: '09:00', collaborateurId: 'col-autre' })
    const [apresRelance] = relancesDemandesDues([item(d, { sortie: relance })], ENTREPRISES, AUJOURDHUI)
    expect(apresRelance).toMatchObject({ date: '2026-10-11', depart: { date: '2026-10-08', depuis: 'relance' }, assigneId: 'col-gestion' })
    expect(libelleRelanceDemande(apresRelance)).toContain('relancée le 08/10/2026 ; délai de relance de 3 jours')
    const recu = enregistrerReception(relance, { ...ENVOI, date: '2026-10-09', heure: '11:00' })
    expect(relancesDemandesDues([item(d, { sortie: recu })], ENTREPRISES, AUJOURDHUI)[0]).toMatchObject({
      date: '2026-10-12',
      depart: { date: '2026-10-09', depuis: 'reception' },
    })
    const copie = envoyerOs(d, { ...envoye, diffusable: true }, { ...ENVOI, date: '2026-10-10', heure: '08:00', destinataire: creerRattachement('Copropriété', 'copro-1') }, CONTEXTE)
    expect(relancesDemandesDues([item(d, { sortie: copie })], ENTREPRISES, AUJOURDHUI)[0].depart).toEqual({ date: '2026-10-03', depuis: 'envoi' })
  })

  it('date de relance saisie sur la sortie : elle prévaut (relance_os), pas de relance automatique ; sortie jamais envoyée : rien', () => {
    const d = intervention({ prevuLe: '2026-10-02' })
    expect(relancesDemandesDues([item(d, { sortie: fixerRelance(envoyee(d), '2026-10-25') })], ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(relancesDemandesDues([item(d, { sortie: sortiePrete(d) })], ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(() => relancesDemandesDues([item(intervention({ id: 'dem-2' }), { sortie: sortiePrete(d) })], ENTREPRISES, AUJOURDHUI)).toThrow(
      /autre demande/,
    )
  })

  it('rien à relancer : sans entreprise, entreprise sans fiche, service sans réglage, réponse reçue, demande close ou future', () => {
    const cas = [
      item(devis({ prestataireId: null })),
      item(devis({ prestataireId: 'ent-sans-fiche' })),
      item(devis({ prestataireId: 'ent-inconnue' })),
      item(devis(), { service: 'Gérance' }),
      item(devis({ devisAssocie: { devisId: 'devis-1', montantTtcCentimes: 50_000 } })),
      item(changerStatut(devis(), 'Accepté')),
      item(changerStatut(devis(), 'Refusé')),
      item(terminerDemande(devis(), [], '2026-10-10')),
      item(changerStade(intervention(), 'Réalisée', { date: '2026-10-12' })),
      item(devis({ demandeLe: '2026-10-21' })),
    ]
    // Un identifiant par cas : deux versions d'une même demande sont une entrée contradictoire (demandesUniques).
    const rien = cas.map((c, i) => ({ ...c, demande: { ...c.demande, id: `rien-${i}` } }))
    expect(relancesDemandesDues(rien, ENTREPRISES, AUJOURDHUI)).toEqual([])
    for (const c of cas) expect(relancesDemandesDues([c], ENTREPRISES, AUJOURDHUI)).toEqual([])
  })

  it('rapport demandé après la réalisation : la relance reprend, comptée de la réalisation ; une demande vue deux fois ne compte qu’une fois ; tri par date', () => {
    const rapport = changerStatut(changerStade(intervention({ id: 'dem-2' }), 'Réalisée', { date: '2026-10-12' }), 'Rapport demandé')
    const relances = relancesDemandesDues([item(rapport), item(devis()), item(devis())], ENTREPRISES, AUJOURDHUI)
    expect(relances.map((r) => [r.demandeId, r.date])).toEqual([
      ['dem-1', '2026-10-09'],
      ['dem-2', '2026-10-15'],
    ])
    expect(() => relancesDemandesDues([], ENTREPRISES, '20/10/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('même demande avec puis sans sa sortie, dans les deux ordres : un seul résultat, celui de la sortie', () => {
    const d = intervention({ prevuLe: '2026-10-02' })
    const relancee = relancerOs(envoyee(d), { ...ENVOI, date: '2026-10-08', heure: '09:00' })
    const seule = relancesDemandesDues([item(d, { sortie: relancee })], ENTREPRISES, AUJOURDHUI)
    expect(seule).toEqual([expect.objectContaining({ date: '2026-10-11', depart: { date: '2026-10-08', depuis: 'relance' }, assigneId: 'col-gestion' })])
    expect(relancesDemandesDues([item(d, { sortie: relancee }), item(d)], ENTREPRISES, AUJOURDHUI)).toEqual(seule)
    expect(relancesDemandesDues([item(d), item(d, { sortie: relancee })], ENTREPRISES, AUJOURDHUI)).toEqual(seule)
    const datee = item(d, { sortie: fixerRelance(envoyee(d), '2026-10-25') })
    expect(relancesDemandesDues([item(d), datee], ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(relancesDemandesDues([datee, item(d)], ENTREPRISES, AUJOURDHUI)).toEqual([])
  })
})

describe('demandes en cours face au seuil d’alerte et au maximum de l’entreprise', () => {
  const devisDu = (n: number, extra: Partial<SaisieDemande> = {}) => devis({ id: `dev-${n}`, demandeLe: `2026-10-0${n}`, ...extra })

  it('seuil franchi strictement, maximum atteint à égalité puis dépassé ; daté du jour de la demande qui a fait franchir le niveau', () => {
    const niveaux = [1, 2, 3, 4].map((n) => {
      const items = Array.from({ length: n }, (_, i) => item(devisDu(i + 1)))
      const [c] = chargesEntreprises(items, ENTREPRISES, AUJOURDHUI)
      return [c.enCours, c.niveau, c.depuisLe]
    })
    expect(niveaux).toEqual([
      [1, 'normal', null],
      [2, 'alerte', '2026-10-02'],
      [3, 'maximum_atteint', '2026-10-03'],
      [4, 'maximum_depasse', '2026-10-04'],
    ])
  })

  it('compte par entreprise, service et type ; ni les demandes closes, refusées ou futures, ni les doublons', () => {
    const items = [
      item(devisDu(2)),
      item(devisDu(2)),
      item(devisDu(1)),
      item(changerStatut(devisDu(3), 'Refusé')),
      item(terminerDemande(devisDu(4), [], '2026-10-10')),
      item(devisDu(5, { demandeLe: '2026-10-25' })),
      item(devisDu(6), { service: 'Gérance' }),
      item(intervention({ id: 'int-1' })),
      item(devisDu(7, { prestataireId: 'ent-sans-fiche' })),
    ]
    expect(chargesEntreprises(items, ENTREPRISES, AUJOURDHUI)).toEqual([
      {
        prestataireId: 'ent-1',
        service: 'Copropriété',
        type: 'devis',
        enCours: 2,
        demandeIds: ['dev-1', 'dev-2'],
        alerteAuDela: 1,
        maxDemandesEnCours: 3,
        niveau: 'alerte',
        depuisLe: '2026-10-02',
      },
      expect.objectContaining({ type: 'intervention', enCours: 1, niveau: 'normal', depuisLe: null }),
    ])
    expect(alertesChargeEntreprises(items, ENTREPRISES, AUJOURDHUI).map((c) => c.type)).toEqual(['devis'])
  })

  it('une demande vue deux fois n’entre que dans un groupe, quel que soit l’ordre ; deux entreprises pour une même demande : erreur', () => {
    const entreprises: EntrepriseRelance[] = [{ id: 'ent-1', fiche: { ...FICHE, relancesParService: { Gérance: RELANCES } } }]
    const d1 = devisDu(1)
    const d2 = devisDu(2)
    const groupes = (items: DemandeSuivie[]) => chargesEntreprises(items, entreprises, AUJOURDHUI).map((c) => [c.service, c.demandeIds])
    const attendu = [
      ['Copropriété', ['dev-2']],
      ['Gérance', ['dev-1']],
    ]
    expect(groupes([item(d1), item(d1, { service: 'Gérance' }), item(d2)])).toEqual(attendu)
    expect(groupes([item(d1, { service: 'Gérance' }), item(d1), item(d2)])).toEqual(attendu)
    const reattribuee = [item(d1), item({ ...d1, prestataireId: 'ent-2' })]
    expect(() => chargesEntreprises(reattribuee, ENTREPRISES, AUJOURDHUI)).toThrow(/deux versions différentes/)
    expect(() => controlerPlafondAvantAttribution(item(devis({ id: 'x' })), reattribuee, ENTREPRISES, AUJOURDHUI)).toThrow(/deux versions différentes/)
  })

  it('libellé de l’alerte : identifiant de l’entreprise (l’écran met le nom), niveau, depuis quand, règle de gestion', () => {
    const items = [1, 2, 3, 4].map((n) => item(devisDu(n)))
    const [depasse] = alertesChargeEntreprises(items, ENTREPRISES, AUJOURDHUI)
    expect(libelleChargeEntreprise(depasse)).toBe(
      'Entreprise ent-1 (Copropriété) : 4 demandes de devis en cours, au-delà du maximum de 3 depuis le 04/10/2026 (règle de gestion du cabinet)',
    )
    expect(libelleChargeEntreprise({ ...depasse, enCours: 3, niveau: 'maximum_atteint', depuisLe: '2026-10-03' })).toContain('maximum de 3 atteint depuis le 03/10/2026')
    expect(libelleChargeEntreprise({ ...depasse, enCours: 2, niveau: 'alerte', depuisLe: '2026-10-02' })).toContain("au-delà du seuil d'alerte de 1")
    expect(() => libelleChargeEntreprise({ ...depasse, niveau: 'normal', depuisLe: null })).toThrow(/rien à signaler/)
  })

  it('une seule demande : libellés au singulier (seuil d’alerte à 0, maximum à 1)', () => {
    const avecReglage = (devisReglage: RelancesService['devis']): EntrepriseRelance[] => [{ id: 'ent-1', fiche: { relances: { ...RELANCES, devis: devisReglage } } }]
    const seuilZero = avecReglage({ delaiRelanceJours: 8, maxDemandesEnCours: 3, alerteAuDela: 0 })
    const [alerte] = alertesChargeEntreprises([item(devisDu(1))], seuilZero, AUJOURDHUI)
    expect(libelleChargeEntreprise(alerte)).toBe(
      "Entreprise ent-1 (Copropriété) : 1 demande de devis en cours, au-delà du seuil d'alerte de 0 depuis le 01/10/2026 (règle de gestion du cabinet)",
    )
    const maximumUn = avecReglage({ delaiRelanceJours: 8, maxDemandesEnCours: 1, alerteAuDela: 0 })
    const [maximum] = alertesChargeEntreprises([item(devisDu(1))], maximumUn, AUJOURDHUI)
    expect(libelleChargeEntreprise(maximum)).toContain('Entreprise ent-1 (Copropriété) : 1 demande de devis en cours, maximum de 1 atteint')
    expect(controlerPlafondAvantAttribution(item(devis({ id: 'dev-nouvelle' })), [], seuilZero, AUJOURDHUI)).toEqual([
      expect.objectContaining({ code: 'seuil_alerte_depasse', message: expect.stringContaining('ent-1 (Copropriété) : 1 demande de devis en cours avec celle-ci,') }),
    ])
  })

  it('avant d’attribuer une demande : alerte au-delà du seuil, puis du maximum ; jamais bloquante ; sans réglage : rien', () => {
    const nouvelle = item(devis({ id: 'dev-nouvelle' }))
    expect(controlerPlafondAvantAttribution(nouvelle, [], ENTREPRISES, AUJOURDHUI)).toEqual([])
    const une = [item(devisDu(1))]
    expect(controlerPlafondAvantAttribution(nouvelle, une, ENTREPRISES, AUJOURDHUI)).toEqual([
      {
        code: 'seuil_alerte_depasse',
        gravite: 'alerte',
        message: "Entreprise ent-1 (Copropriété) : 2 demandes de devis en cours avec celle-ci, au-delà du seuil d'alerte de 1 fixé sur sa fiche (règle de gestion du cabinet).",
      },
    ])
    const trois = [1, 2, 3].map((n) => item(devisDu(n)))
    expect(controlerPlafondAvantAttribution(nouvelle, [...trois, nouvelle], ENTREPRISES, AUJOURDHUI)).toEqual([
      expect.objectContaining({ code: 'maximum_depasse', gravite: 'alerte', message: expect.stringContaining('4 demandes de devis en cours avec celle-ci, au-delà du maximum de 3') }),
    ])
    expect(controlerPlafondAvantAttribution(item(devis({ id: 'x', prestataireId: 'ent-sans-fiche' })), trois, ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(controlerPlafondAvantAttribution(item(devis({ id: 'x', prestataireId: null })), trois, ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(controlerPlafondAvantAttribution({ ...nouvelle, service: 'Gérance' }, trois, ENTREPRISES, AUJOURDHUI)).toEqual([])
  })
})

describe('suivi « à faire » : famille « demandes » (depuisDemandes, suivi-a-faire.ts)', () => {
  const affectations: AffectationMandat[] = [
    { mandatId: 'mandat-1', cabinetId: 'cab-1', responsableId: 'col-resp', comptableId: null, assistantId: null },
  ]

  it('famille et natures : devis et interventions à relancer, relance datée de l’OS, seuil de l’entreprise', () => {
    expect(FAMILLES_SUIVI).toContain('demandes')
    expect(NATURES_SUIVI.demandes).toEqual(['devis_a_relancer', 'intervention_a_relancer', 'relance_os', 'plafond_demandes'])
    expect(LIBELLES_FAMILLES_SUIVI.demandes).toBe('Demandes (devis et interventions)')
    for (const nature of NATURES_SUIVI.demandes) expect(LIBELLES_NATURES_SUIVI[nature]).toBeTruthy()
    expect(reglageParDefaut('u1').familles.demandes?.actif).toBe(true)
  })

  it('réunit les relances automatiques, la relance datée de l’OS et l’alerte de l’entreprise, sans repère juridique', () => {
    const os = intervention({ id: 'int-1', prevuLe: '2026-10-02' })
    const items = [
      item(os, { sortie: fixerRelance(envoyee(os), '2026-10-22') }),
      item(intervention({ id: 'int-2', prevuLe: '2026-10-15' })),
      item(devis({ id: 'dev-1', demandeLe: '2026-10-01' })),
      item(devis({ id: 'dev-2', demandeLe: '2026-10-05' })),
    ]
    const elements = depuisDemandes(items, ENTREPRISES, AUJOURDHUI)
    expect(elements.map((e) => [e.id, e.nature, e.date, e.mandatId, e.assigneId])).toEqual([
      ['demandes:relance_os:int-1', 'relance_os', '2026-10-22', 'mandat-1', 'col-gestion'],
      ['demandes:devis_a_relancer:dev-1', 'devis_a_relancer', '2026-10-09', 'mandat-1', null],
      ['demandes:devis_a_relancer:dev-2', 'devis_a_relancer', '2026-10-13', 'mandat-1', null],
      ['demandes:intervention_a_relancer:int-2', 'intervention_a_relancer', '2026-10-18', 'mandat-1', null],
      ['demandes:plafond_demandes:ent-1:Copropriété:devis', 'plafond_demandes', '2026-10-05', null, null],
    ])
    expect(elements.every((e) => e.famille === 'demandes' && !e.aConfirmer)).toBe(true)
    expect(elements.at(-1)).toMatchObject({ objetId: 'ent-1', libelle: expect.stringContaining("au-delà du seuil d'alerte de 1") })
    const enDouble = depuisDemandes([items[0], ...items], ENTREPRISES, AUJOURDHUI).map((e) => e.id)
    expect(enDouble).toEqual(elements.map((e) => e.id))
  })

  it('intervention déjà facturée (sans date de réalisation) : aucune relance publiée au Suivi, elle compte encore dans les demandes en cours', () => {
    const facturee = rattacherFacture(intervention({ id: 'int-f' }), 'facture-1')
    expect(depuisDemandes([item(facturee)], ENTREPRISES, AUJOURDHUI)).toEqual([])
    expect(chargesEntreprises([item(facturee)], ENTREPRISES, AUJOURDHUI)).toEqual([
      expect.objectContaining({ prestataireId: 'ent-1', type: 'intervention', enCours: 1, demandeIds: ['int-f'] }),
    ])
  })

  it('même OS avec puis sans sa sortie, dans les deux ordres : la seule relance datée (relance_os), sans relance automatique en plus', () => {
    const os = intervention({ id: 'int-1', prevuLe: '2026-10-02' })
    const avecSortie = item(os, { sortie: fixerRelance(envoyee(os), '2026-10-22') })
    const elements = (items: DemandeSuivie[]) => depuisDemandes(items, ENTREPRISES, AUJOURDHUI).map((e) => [e.id, e.date])
    expect(elements([avecSortie])).toEqual([['demandes:relance_os:int-1', '2026-10-22']])
    expect(elements([avecSortie, item(os)])).toEqual(elements([avecSortie]))
    expect(elements([item(os), avecSortie])).toEqual(elements([avecSortie]))
  })

  it('portefeuille : les relances du mandat, pas l’alerte de l’entreprise (élément du cabinet) ; horizon appliqué', () => {
    const items = [item(devis({ id: 'dev-1' })), item(devis({ id: 'dev-2', demandeLe: '2026-10-15' }))]
    const elements = depuisDemandes(items, ENTREPRISES, AUJOURDHUI)
    const portefeuille: ReglageSuivi = { collaborateurId: 'col-resp', familles: { demandes: reglageParDefaut('col-resp').familles.demandes } }
    expect(selectionnerAFaire(elements, portefeuille, affectations, AUJOURDHUI).map((e) => e.id)).toEqual(['demandes:devis_a_relancer:dev-1'])
    const cabinet: ReglageSuivi = {
      collaborateurId: 'col-autre',
      familles: { demandes: { actif: true, perimetre: 'cabinet', horizon: { nombre: 1, unite: 'semaines' }, natures: null } },
    }
    expect(selectionnerAFaire(elements, cabinet, affectations, AUJOURDHUI).map((e) => e.id)).toEqual([
      'demandes:devis_a_relancer:dev-1',
      'demandes:plafond_demandes:ent-1:Copropriété:devis',
      'demandes:devis_a_relancer:dev-2',
    ])
  })
})

describe('en-tête du module', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'lib', 'administrateur-judiciaire', 'domain', 'relance-demandes.ts'), 'utf8')
  const enTete = source.slice(0, source.indexOf('*/'))

  it('cite les tranches Gestéam, les marqueurs, et dit « aucun texte » pour la relance des demandes', () => {
    for (const attendu of ['tranche 39', 'tranche 38', 'tranche 43', '🟢', '🔵', '🔴', 'AUCUN TEXTE', 'RÈGLES DE GESTION', 'L. 1965 art. 18, I', 'D. 1967 art. 19-2'])
      expect(enTete).toContain(attendu)
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}'/)
  })

  /** En-tête sans les retours à la ligne ni les « * » du commentaire, pour chercher une phrase entière. */
  const texte = enTete.replaceAll(/\s*\n\s*\*\s*/g, ' ')

  it('les relances des textes visent le recouvrement d’une créance (annexe 1 du décret comprise), aucune une demande', () => {
    for (const attendu of [
      'tableaux des annexes 1 et 2 du décret compris',
      'L. 1965 art. 10-1 a',
      'D. 1967 art. 38',
      'D. 1967 annexe 1, point 9.1',
      'D. 1967 annexe 1, annexe au contrat de syndic, III-10° b',
      'relance par lettre simple avant mise en demeure',
      'IV-15° b et d',
    ])
      expect(texte).toContain(attendu)
    expect(texte).not.toContain('Les seules relances')
  })

  it('D. 1967 art. 19-2 en entier : plusieurs devis ou un devis descriptif, pour la mise en concurrence de L. 1965 art. 21, al. 2', () => {
    expect(texte).toContain('La mise en concurrence des marchés de travaux et contrats autres que le contrat de syndic prévue par L. 1965 art. 21, al. 2')
    expect(texte).toContain("résulte de la demande de plusieurs devis ou de l'établissement d'un devis descriptif soumis à l'évaluation de plusieurs entreprises (D. 1967 art. 19-2)")
  })

  it('intervention en attente : ni réalisée ni facturée (une facture vaut réponse de l’entreprise, comme realiseeOuFacturee de demandes.ts)', () => {
    expect(texte).toContain('intervention : ni date de réalisation, ni stade Réalisée, Contestée ou Validée, ni facture rattachée')
  })

  it('stades « Proposition en cours » et « Proposition résident » : nommés dans la règle et question à Hugo', () => {
    expect(texte).toContain('les stades « Proposition en cours » et « Proposition résident » comptent donc comme en attente')
    expect(texte).toContain('Hugo : pendant les stades « Proposition en cours » et « Proposition résident »')
  })
})
