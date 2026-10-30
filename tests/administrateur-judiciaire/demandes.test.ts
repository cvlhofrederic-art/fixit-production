import { describe, expect, it } from 'vitest'
import {
  ETAPES_DEMANDE,
  MODELES_DEMANDE_OBSERVES,
  NON_FACTURE,
  changerStade,
  changerStatut,
  codificationFacture,
  controleDeclaratifDemande,
  controlerCloture,
  controlerDemande,
  creerDemande,
  demandesNonFacturees,
  detacherFacture,
  enregistrerPieceRecue,
  estRefusee,
  etapeDuStade,
  etapesDemande,
  ficheLieeDepuisDemande,
  marquerSansFacture,
  modeleDeNature,
  motifRefusFacture,
  phaseSuggereeParExecution,
  prevuDemande,
  rattacherFacture,
  stadeDepuisStatutOrdre,
  statutFactureDemande,
  terminerDemande,
  type Demande,
  type FactureDeDemande,
  type ModeleDemande,
  type SaisieDemande,
} from '@/lib/administrateur-judiciaire/domain/demandes'
import { creerRattachement, fichesLiees } from '@/lib/administrateur-judiciaire/domain/fiches-liees'
import {
  controlerAvantOrdreService,
  controlerAvantReglement,
  type PiecesEntreprise,
} from '@/lib/administrateur-judiciaire/domain/vigilance-entreprises'
import { STADE_INTERVENTION, STATUT_DEMANDE } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Demandes d'intervention et ordres de service : modèle et cycle jusqu'à la facture (point 43 du bilan 2 ; Gestéam,
 * tranche 34 : fiche demande et onglet Suivi, frise Demandée → Acceptation → Réalisation → Facturation ; tranche 43 § 15 :
 * nature complète, codification de la facture, pièce exigée en retour, « Huissier - exécution forcée » ; tranche 17 § 4 :
 * statut et stade, deux axes distincts).
 */

const modele = (nature: string): ModeleDemande => {
  const trouve = modeleDeNature(nature)
  if (!trouve) throw new Error(`Modèle absent du test : ${nature}`)
  return trouve
}

const OS = modele('OS Copro')
const OS_PV = modele('OS Copro avec PV de réception')
const DEVIS = modele('Demande devis Copro')
const HUISSIER = modele('Huissier - exécution forcée')

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

const demande = (surcharge: Partial<SaisieDemande> = {}, m: ModeleDemande = OS): Demande => creerDemande(saisie(surcharge), m)

const realisee = (surcharge: Partial<SaisieDemande> = {}, m: ModeleDemande = OS): Demande =>
  changerStade(demande(surcharge, m), 'Réalisée', { date: '2026-10-10' })

const validee = (surcharge: Partial<SaisieDemande> = {}, m: ModeleDemande = OS): Demande =>
  changerStade(realisee(surcharge, m), 'Validée', { date: '2026-10-12' })

const comptabilisee = (id: string): FactureDeDemande => ({ id, statut: 'Comptabilisée' })

const codes = (anomalies: { code: string }[]): string[] => anomalies.map((a) => a.code)

describe('Référentiels de la demande (Gestéam T34, T43 § 15)', () => {
  it('la frise compte quatre étapes, dont la Facturation', () => {
    expect(ETAPES_DEMANDE).toEqual(['Demandée', 'Acceptation', 'Réalisation', 'Facturation'])
  })

  it('13 natures génériques observées, sans variante par gestionnaire, toutes distinctes', () => {
    expect(MODELES_DEMANDE_OBSERVES).toHaveLength(13)
    expect(new Set(MODELES_DEMANDE_OBSERVES.map((m) => m.nature)).size).toBe(13)
    expect(MODELES_DEMANDE_OBSERVES.filter((m) => m.type === 'devis').map((m) => m.nature)).toEqual([
      'Demande devis Copro',
      'Demande devis Copro BIS',
      'Demande devis Gérance',
    ])
  })

  it('le modèle d’OS porte la pièce exigée en retour ; seule la nature huissier est une exécution forcée', () => {
    expect(modele('OS Copro avec Attestation').pieceExigee).toBe('attestation')
    expect(OS_PV.pieceExigee).toBe('pv_reception')
    expect(OS.pieceExigee).toBeNull()
    expect(MODELES_DEMANDE_OBSERVES.filter((m) => m.executionForcee).map((m) => m.nature)).toEqual(['Huissier - exécution forcée'])
    expect(HUISSIER.type).toBe('intervention')
  })

  it('une nature se retrouve sans tenir compte de la casse ni des accents ; une nature inconnue donne null', () => {
    expect(modeleDeNature('  os copro avec pv de reception ')).toEqual(OS_PV)
    expect(modeleDeNature('OS inconnu')).toBeNull()
    const propre: ModeleDemande = { nature: 'OS Ascenseur', type: 'intervention', pieceExigee: null, executionForcee: false }
    expect(modeleDeNature('OS Ascenseur', [propre])).toBe(propre)
  })
})

describe('creerDemande', () => {
  it('ouvre la demande « En cours », sans stade, et reprend le type et la pièce exigée du modèle', () => {
    const d = demande({}, OS_PV)
    expect(d).toMatchObject({
      nature: 'OS Copro avec PV de réception',
      type: 'intervention',
      pieceExigee: 'pv_reception',
      executionForcee: false,
      statut: 'En cours',
      stade: null,
      realiseeLe: null,
      termineeLe: null,
      factureIds: [],
      piecesRecues: [],
      sansFacture: false,
    })
    expect(STATUT_DEMANDE).toContain(d.statut)
  })

  it('nettoie les textes : un numéro vide devient null', () => {
    const d = demande({ id: ' dem-2 ', numero: '  ', mandatId: '' })
    expect(d.id).toBe('dem-2')
    expect(d.numero).toBeNull()
    expect(d.mandatId).toBeNull()
  })

  it('refuse une saisie bloquante : date invalide, identifiant manquant, exécution forcée hors contentieux', () => {
    expect(() => demande({ demandeLe: '2026-02-30' })).toThrow(/Date de la demande invalide/)
    expect(() => demande({ coproprieteId: ' ' })).toThrow(/Identifiant de la demande ou de la copropriété manquant/)
    expect(() => demande({}, HUISSIER)).toThrow(/contentieux/)
    expect(() => demande({ dossier: creerRattachement('Sinistre', 'sin-1') }, HUISSIER)).toThrow(/contentieux/)
    expect(demande({ dossier: creerRattachement('Contentieux', 'cx-1') }, HUISSIER).executionForcee).toBe(true)
  })

  it('refuse un modèle de type inconnu', () => {
    expect(() => creerDemande(saisie(), { ...OS, type: 'autre' as never })).toThrow(/Type de demande inconnu/)
  })

  it('ne modifie pas la saisie qui lui est passée', () => {
    const brute = saisie({ id: ' dem-7 ', numero: ' 7 ', objet: ' Fuite ' })
    const avant = structuredClone(brute)
    expect(creerDemande(brute, OS)).toMatchObject({ id: 'dem-7', numero: '7', objet: 'Fuite' })
    expect(brute).toEqual(avant)
  })

  it('le dossier est un type du référentiel DOSSIER, jamais une fiche porteuse (copropriété, identité, entreprise)', () => {
    expect(() => demande({ dossier: creerRattachement('Entreprise', 'ent-9') })).toThrow(/Dossier « Entreprise »/)
    expect(() => demande({ dossier: creerRattachement('Copropriété', 'copro-2') })).toThrow(/DOSSIER/)
    const d = { ...demande(), dossier: creerRattachement('Identité', 'id-3') }
    expect(controlerDemande(d).map((a) => [a.code, a.gravite])).toEqual([['dossier_invalide', 'bloquant']])
    expect(demande({ dossier: creerRattachement('Sinistre', 'sin-1') }).dossier).toEqual({ type: 'Sinistre', id: 'sin-1' })
  })
})

describe('controlerDemande', () => {
  it('une demande correcte ne remonte rien', () => {
    expect(controlerDemande(demande())).toEqual([])
  })

  it('prix, devis associé et acompte : centimes entiers positifs, remise au plus égale au montant', () => {
    const base = demande()
    const prixFaux = { ...base, prix: { montantTtcCentimes: 1000, remiseCentimes: 2000, tauxTvaPct: 20, baseHtCentimes: null } }
    expect(codes(controlerDemande(prixFaux))).toEqual(['prix_invalide'])
    expect(codes(controlerDemande({ ...base, prix: { ...prixFaux.prix, remiseCentimes: 0, montantTtcCentimes: 10.5 } }))).toEqual(['prix_invalide'])
    expect(codes(controlerDemande({ ...base, devisAssocie: { devisId: 'dv-1', montantTtcCentimes: -1 } }))).toEqual(['devis_associe_invalide'])
    expect(codes(controlerDemande({ ...base, acompte: { montantCentimes: 0, echeance: '2026-10-20' } }))).toEqual(['acompte_invalide'])
    expect(controlerDemande(prixFaux).every((a) => a.gravite === 'bloquant')).toBe(true)
  })

  it('la base HT ne dépasse jamais le montant TTC, ni pour le prix ni pour le devis associé', () => {
    const base = demande()
    const prix = { montantTtcCentimes: 100, remiseCentimes: 0, tauxTvaPct: 20, baseHtCentimes: 1_000_000 }
    expect(codes(controlerDemande({ ...base, prix }))).toEqual(['prix_invalide'])
    expect(controlerDemande({ ...base, prix: { ...prix, tauxTvaPct: 0, baseHtCentimes: 100 } })).toEqual([])
    const devisFaux = { devisId: 'dv-1', montantTtcCentimes: 100_000, montantHtCentimes: 100_001 }
    expect(codes(controlerDemande({ ...base, devisAssocie: devisFaux }))).toEqual(['devis_associe_invalide'])
    expect(codes(controlerDemande({ ...base, devisAssocie: { ...devisFaux, montantHtCentimes: 1.5 } }))).toEqual(['devis_associe_invalide'])
    expect(controlerDemande({ ...base, devisAssocie: { ...devisFaux, montantHtCentimes: 83_334 } })).toEqual([])
  })

  it('acompte au-dessus du prévu ou sans échéance : alertes', () => {
    const d = { ...demande(), acompte: { montantCentimes: 150_000, echeance: null } }
    expect(controlerDemande(d).map((a) => [a.code, a.gravite])).toEqual([
      ['acompte_superieur_prevu', 'alerte'],
      ['acompte_sans_echeance', 'alerte'],
    ])
  })

  it('toutes les dates de la demande sont contrôlées, y compris les pièces reçues', () => {
    const d = { ...demande(), prevuLe: '2026-13-01', piecesRecues: [{ nature: 'attestation' as const, recueLe: '01/10/2026', documentId: null }] }
    expect(codes(controlerDemande(d))).toEqual(['date_invalide', 'date_invalide'])
  })
})

describe('etapeDuStade', () => {
  it('chaque stade de STADE_INTERVENTION a son étape (🔵)', () => {
    expect(etapeDuStade(null)).toBe('Demandée')
    expect(Object.fromEntries(STADE_INTERVENTION.map((s) => [s, etapeDuStade(s)]))).toEqual({
      Acceptée: 'Acceptation',
      Refusée: 'Acceptation',
      'Proposition en cours': 'Demandée',
      'Proposition résident': 'Demandée',
      Programmée: 'Réalisation',
      Réalisée: 'Réalisation',
      Contestée: 'Réalisation',
      Validée: 'Réalisation',
    })
  })
})

describe('changerStade', () => {
  it('Programmée exige une date prévue, saisie avant ou avec le changement', () => {
    expect(() => changerStade(demande(), 'Programmée', { date: '2026-10-02' })).toThrow(/date prévue/)
    expect(changerStade(demande(), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-09' }).prevuLe).toBe('2026-10-09')
    expect(changerStade(demande({ prevuLe: '2026-10-08' }), 'Programmée', { date: '2026-10-02' }).stade).toBe('Programmée')
  })

  it('Réalisée pose la date de réalisation si elle manque, sans écraser une date connue', () => {
    expect(realisee().realiseeLe).toBe('2026-10-10')
    const deja = { ...demande(), realiseeLe: '2026-10-05' }
    expect(changerStade(deja, 'Réalisée', { date: '2026-10-10' }).realiseeLe).toBe('2026-10-05')
    expect(changerStade(deja, 'Réalisée', { date: '2026-10-10', realiseeLe: '2026-10-06' }).realiseeLe).toBe('2026-10-06')
  })

  it('Validée et Contestée exigent la réalisation ; l’OS saisi après l’intervention passe directement à Validée', () => {
    expect(() => changerStade(demande(), 'Validée', { date: '2026-10-12' })).toThrow(/date de réalisation/)
    expect(() => changerStade(demande(), 'Contestée', { date: '2026-10-12' })).toThrow(/date de réalisation/)
    const directe = changerStade(demande(), 'Validée', { date: '2026-10-12', realiseeLe: '2026-09-28' })
    expect(directe).toMatchObject({ stade: 'Validée', realiseeLe: '2026-09-28' })
  })

  it('une demande de devis ne se programme ni ne se réalise ; elle peut être acceptée ou refusée', () => {
    expect(() => changerStade(demande({}, DEVIS), 'Réalisée', { date: '2026-10-10' })).toThrow(/ordre de service/)
    expect(changerStade(demande({}, DEVIS), 'Acceptée', { date: '2026-10-10' }).stade).toBe('Acceptée')
  })

  it('renvoie une copie ; refuse une date ou un stade invalides et une demande terminée', () => {
    const d = demande()
    const suite = changerStade(d, 'Acceptée', { date: '2026-10-02' })
    expect(d.stade).toBeNull()
    expect(suite.stade).toBe('Acceptée')
    expect(() => changerStade(d, 'Acceptée', { date: '2026-10-32' })).toThrow(/invalide/)
    expect(() => changerStade(d, 'Acceptée', { date: '2026-10-02', prevuLe: 'demain' })).toThrow(/invalide/)
    expect(() => changerStade(d, 'Terminée' as never, { date: '2026-10-02' })).toThrow(/Stade inconnu/)
    expect(() => changerStade({ ...d, statut: 'Terminé' }, 'Acceptée', { date: '2026-10-02' })).toThrow(/terminée/)
  })
})

describe('changerStatut', () => {
  it('change le statut administratif, sauf « Terminé » réservé à terminerDemande', () => {
    expect(changerStatut(demande(), 'Rapport demandé').statut).toBe('Rapport demandé')
    expect(() => changerStatut(demande(), 'Terminé')).toThrow(/terminerDemande/)
    expect(() => changerStatut(demande(), 'Clos' as never)).toThrow(/Statut inconnu/)
    expect(() => changerStatut({ ...demande(), statut: 'Terminé' }, 'En cours')).toThrow(/terminée/)
  })
})

describe('refus d’une demande déjà réalisée ou facturée', () => {
  it('ni le statut « Refusé » ni le stade « Refusée » ne se posent sur une intervention réalisée ou facturée', () => {
    const faite = rattacherFacture(realisee({}, OS_PV), 'f1')
    expect(() => changerStatut(faite, 'Refusé')).toThrow(/déjà réalisée ou facturée/)
    expect(() => changerStade(faite, 'Refusée', { date: '2026-10-11' })).toThrow(/déjà réalisée ou facturée/)
    expect(() => changerStatut(realisee(), 'Refusé')).toThrow(/réalisée/)
    const acompte = rattacherFacture(changerStade(demande(), 'Acceptée', { date: '2026-10-02' }), 'f1')
    expect(() => changerStatut(acompte, 'Refusé')).toThrow(/facturée/)
    expect(() => changerStade(demande(), 'Refusée', { date: '2026-10-02', realiseeLe: '2026-09-30' })).toThrow(/réalisée/)
    expect(changerStatut(demande(), 'Refusé').statut).toBe('Refusé')
    expect(changerStade(demande(), 'Refusée', { date: '2026-10-02' }).stade).toBe('Refusée')
  })

  it('dans l’autre sens : une demande au statut « Refusé » ne reçoit aucune réalisation (lever le refus d’abord)', () => {
    const refusee = changerStatut(demande({}, OS_PV), 'Refusé')
    for (const stade of ['Réalisée', 'Validée', 'Contestée'] as const)
      expect(() => changerStade(refusee, stade, { date: '2026-10-10', realiseeLe: '2026-10-10' })).toThrow(/refusée.*lever le refus/)
    expect(() => changerStade(refusee, 'Acceptée', { date: '2026-10-10', realiseeLe: '2026-10-09' })).toThrow(/lever le refus/)
    // Ordre VitFix passé à « termine » sur une demande refusée au cabinet.
    const termine = stadeDepuisStatutOrdre('termine')
    if (termine === null) throw new Error('stade attendu')
    expect(() => changerStade(refusee, termine, { date: '2026-10-10' })).toThrow(/lever le refus/)
    expect(() => changerStade(changerStade(refusee, 'Refusée', { date: '2026-10-03' }), 'Réalisée', { date: '2026-10-10' })).toThrow(/lever le refus/)
    // Sans réalisation, le stade peut encore changer : le refus reste ni réalisé ni facturé.
    expect(changerStade(refusee, 'Acceptée', { date: '2026-10-03' })).toMatchObject({ statut: 'Refusé', stade: 'Acceptée', realiseeLe: null })
  })

  it('refus levé (statut ou stade remplacé) puis réalisée : facture attendue et tous les contrôles de clôture repris', () => {
    const parStatut = changerStade(changerStatut(changerStatut(demande({}, OS_PV), 'Refusé'), 'En cours'), 'Réalisée', { date: '2026-10-10' })
    const parStade = changerStade(changerStade(demande({ id: 'dem-2' }, OS_PV), 'Refusée', { date: '2026-10-02' }), 'Réalisée', { date: '2026-10-10' })
    for (const d of [parStatut, parStade]) {
      expect(estRefusee(d)).toBe(false)
      expect(etapesDemande(d, []).map((e) => e.etat)).toEqual(['done', 'done', 'done', 'current'])
      expect(codes(controlerCloture(d, []))).toEqual(['piece_exigee_absente', 'intervention_non_validee', 'facture_absente'])
      expect(rattacherFacture(d, 'f-1').factureIds).toEqual(['f-1'])
    }
    expect(demandesNonFacturees([parStatut, parStade]).map((d) => d.id)).toEqual(['dem-1', 'dem-2'])
  })

  it('objet brut refusé mais réalisé (hors des fonctions du module) : la clôture est bloquée, même « Non facturé »', () => {
    const brute: Demande = { ...validee(), statut: 'Refusé' }
    expect(codes(controlerCloture(brute, []))).toEqual(['refus_contradictoire', 'facture_absente'])
    expect(() => terminerDemande(marquerSansFacture(brute, true), [], '2026-10-20')).toThrow(/refusée.*réalisée ou facturée/)
  })
})

describe('statutFactureDemande et codificationFacture (T43 § 15)', () => {
  it('statut de la facture rapprochée, tiré des axes saisie et comptable (🔵)', () => {
    expect(statutFactureDemande({ statutSaisie: 'Enregistrée', comptabilisee: true })).toBe('Comptabilisée')
    expect(statutFactureDemande({ statutSaisie: 'Pré-saisie', comptabilisee: false })).toBe('À enregistrer')
    expect(statutFactureDemande({ statutSaisie: 'En saisie', comptabilisee: false })).toBe('À enregistrer')
    for (const statutSaisie of ['Enregistrée', 'Rgt. partiel', 'Réglée', 'Non réglée'] as const)
      expect(statutFactureDemande({ statutSaisie, comptabilisee: false })).toBe('À traiter')
  })

  it('sans facture rattachée : « Non facturé » ; sinon le statut de la facture la moins avancée', () => {
    const d = rattacherFacture(rattacherFacture(realisee(), 'f-1'), 'f-2')
    expect(codificationFacture(realisee(), [comptabilisee('f-1')])).toBe(NON_FACTURE)
    expect(codificationFacture(d, [comptabilisee('f-1'), { id: 'f-2', statut: 'À traiter' }])).toBe('À traiter')
    expect(codificationFacture(d, [comptabilisee('f-1'), comptabilisee('f-2'), { id: 'f-3', statut: 'À enregistrer' }])).toBe('Comptabilisée')
  })

  it('une facture rattachée dont le statut manque compte comme « À enregistrer » (jamais comptabilisée par défaut)', () => {
    const d = rattacherFacture(realisee(), 'f-1')
    expect(codificationFacture(d, [])).toBe('À enregistrer')
  })
})

describe('etapesDemande : frise Demandée → Acceptation → Réalisation → Facturation (T34)', () => {
  const etats = (d: Demande, factures: FactureDeDemande[] = []) => etapesDemande(d, factures).map((e) => e.etat)

  it('demande ouverte : la demande est faite, l’acceptation attendue', () => {
    expect(etapesDemande(demande(), [])).toEqual([
      { nom: 'Demandée', etat: 'done' },
      { nom: 'Acceptation', etat: 'current' },
      { nom: 'Réalisation', etat: 'pending' },
      { nom: 'Facturation', etat: 'pending' },
    ])
    expect(etats(changerStade(demande(), 'Proposition résident', { date: '2026-10-02' }))).toEqual(['done', 'current', 'pending', 'pending'])
  })

  it('acceptée ou programmée : réalisation en cours ; le statut « Accepté » vaut acceptation (🔵)', () => {
    expect(etats(changerStade(demande(), 'Acceptée', { date: '2026-10-02' }))).toEqual(['done', 'done', 'current', 'pending'])
    expect(etats(changerStade(demande(), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-09' }))).toEqual(['done', 'done', 'current', 'pending'])
    expect(etats(changerStatut(demande(), 'Accepté'))).toEqual(['done', 'done', 'current', 'pending'])
  })

  it('réalisée : la facturation est l’étape en cours tant que la facture n’est pas comptabilisée', () => {
    expect(etats(realisee())).toEqual(['done', 'done', 'done', 'current'])
    const facturee = rattacherFacture(realisee(), 'f-1')
    expect(etats(facturee, [{ id: 'f-1', statut: 'À traiter' }])).toEqual(['done', 'done', 'done', 'current'])
    expect(etats(facturee, [comptabilisee('f-1')])).toEqual(['done', 'done', 'done', 'done'])
    expect(etats(marquerSansFacture(validee(), true))).toEqual(['done', 'done', 'done', 'done'])
  })

  it('contestée : la réalisation redevient l’étape en cours', () => {
    expect(etats(changerStade(realisee(), 'Contestée', { date: '2026-10-11' }))).toEqual(['done', 'done', 'current', 'pending'])
  })

  it('une facture d’acompte comptabilisée avant la réalisation ne termine pas la frise', () => {
    const programmee = changerStade(demande(), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-09' })
    expect(etats(rattacherFacture(programmee, 'f-1'), [comptabilisee('f-1')])).toEqual(['done', 'done', 'current', 'pending'])
  })

  it('un refus (stade ou statut) s’arrête à l’acceptation', () => {
    expect(etats(changerStade(demande(), 'Refusée', { date: '2026-10-02' }))).toEqual(['done', 'refusee', 'sans_objet', 'sans_objet'])
    expect(etats(changerStatut(demande(), 'Refusé'))).toEqual(['done', 'refusee', 'sans_objet', 'sans_objet'])
  })

  it('une demande de devis s’arrête à l’acceptation : réalisation et facturation sans objet', () => {
    expect(etats(demande({}, DEVIS))).toEqual(['done', 'current', 'sans_objet', 'sans_objet'])
    expect(etats(changerStade(demande({}, DEVIS), 'Acceptée', { date: '2026-10-02' }))).toEqual(['done', 'done', 'sans_objet', 'sans_objet'])
  })
})

describe('rattacherFacture, detacherFacture, marquerSansFacture', () => {
  it('rattache et détache une facture sans doublon (idempotent), en gardant l’ordre', () => {
    const d = rattacherFacture(rattacherFacture(realisee(), 'f-1'), ' f-2 ')
    expect(d.factureIds).toEqual(['f-1', 'f-2'])
    expect(rattacherFacture(d, 'f-1')).toBe(d)
    expect(detacherFacture(d, 'f-1').factureIds).toEqual(['f-2'])
    expect(detacherFacture(d, 'f-9')).toBe(d)
    expect(() => rattacherFacture(d, '  ')).toThrow(/identifiant/)
  })

  it('refuse une facture sur une demande de devis, une demande refusée ou marquée sans facture', () => {
    expect(() => rattacherFacture(demande({}, DEVIS), 'f-1')).toThrow(/devis/)
    expect(() => rattacherFacture(changerStade(demande(), 'Refusée', { date: '2026-10-02' }), 'f-1')).toThrow(/refusée/)
    expect(() => rattacherFacture(marquerSansFacture(realisee(), true), 'f-1')).toThrow(/sans facture/)
    expect(motifRefusFacture(realisee())).toBeNull()
  })

  it('une demande terminée ne reçoit ni ne perd de facture', () => {
    const fin = terminerDemande(rattacherFacture(validee(), 'f-1'), [comptabilisee('f-1')], '2026-10-20')
    expect(motifRefusFacture(fin)).toMatch(/terminée/)
    expect(() => rattacherFacture(fin, 'f-2')).toThrow(/terminée/)
    expect(() => detacherFacture(fin, 'f-1')).toThrow(/terminée/)
    expect(demandesNonFacturees([marquerSansFacture(validee({ id: 'x' }), false)]).map((d) => d.id)).toEqual(['x'])
  })

  it('une demande déjà facturée ne peut pas être marquée sans facture ; la marque se retire', () => {
    expect(() => marquerSansFacture(rattacherFacture(realisee(), 'f-1'), true)).toThrow(/déjà/)
    expect(marquerSansFacture(marquerSansFacture(realisee(), true), false).sansFacture).toBe(false)
  })
})

describe('prevuDemande et demandesNonFacturees', () => {
  it('le prévu est le devis associé, à défaut le prix TTC', () => {
    expect(prevuDemande(demande())).toBe(120_000)
    expect(prevuDemande(demande({ devisAssocie: { devisId: 'dv-1', montantTtcCentimes: 98_000 } }))).toBe(98_000)
    expect(prevuDemande(demande({ prix: null }))).toBeNull()
  })

  it('repère les interventions réalisées ou validées sans facture et non marquées sans facture', () => {
    const liste = [
      realisee({ id: 'a' }),
      validee({ id: 'b' }),
      rattacherFacture(realisee({ id: 'c' }), 'f-1'),
      marquerSansFacture(realisee({ id: 'd' }), true),
      demande({ id: 'e' }),
      changerStade(demande({ id: 'f' }, DEVIS), 'Acceptée', { date: '2026-10-02' }),
      changerStade(realisee({ id: 'g' }), 'Contestée', { date: '2026-10-11' }),
    ]
    expect(demandesNonFacturees(liste).map((d) => d.id)).toEqual(['a', 'b'])
  })
})

describe('enregistrerPieceRecue', () => {
  it('ajoute la pièce reçue ; refuse une date ou une nature invalides', () => {
    const d = enregistrerPieceRecue(validee({}, OS_PV), { nature: 'pv_reception', recueLe: '2026-10-12', documentId: ' doc-1 ' })
    expect(d.piecesRecues).toEqual([{ nature: 'pv_reception', recueLe: '2026-10-12', documentId: 'doc-1' }])
    expect(() => enregistrerPieceRecue(d, { nature: 'pv_reception', recueLe: '12/10/2026', documentId: null })).toThrow(/invalide/)
    expect(() => enregistrerPieceRecue(d, { nature: 'kbis' as never, recueLe: '2026-10-12', documentId: null })).toThrow(/Pièce inconnue/)
  })
})

describe('controlerCloture et terminerDemande', () => {
  it('pièce exigée par le modèle et absente : bloquant (règle de gestion du cabinet)', () => {
    const d = rattacherFacture(validee({}, OS_PV), 'f-1')
    expect(controlerCloture(d, [comptabilisee('f-1')]).map((a) => [a.code, a.gravite])).toEqual([['piece_exigee_absente', 'bloquant']])
    const avecPv = enregistrerPieceRecue(d, { nature: 'pv_reception', recueLe: '2026-10-12', documentId: null })
    expect(controlerCloture(avecPv, [comptabilisee('f-1')])).toEqual([])
  })

  it('intervention non réalisée ou contestée : bloquant ; réalisée mais non validée : alerte', () => {
    expect(codes(controlerCloture(demande(), []))).toEqual(['intervention_non_realisee', 'facture_absente'])
    const contestee = rattacherFacture(changerStade(realisee(), 'Contestée', { date: '2026-10-11' }), 'f-1')
    expect(codes(controlerCloture(contestee, [comptabilisee('f-1')]))).toEqual(['intervention_contestee'])
    const nonValidee = controlerCloture(rattacherFacture(realisee(), 'f-1'), [comptabilisee('f-1')])
    expect(nonValidee.map((a) => [a.code, a.gravite])).toEqual([['intervention_non_validee', 'alerte']])
  })

  it('facture absente : bloquant, sauf demande marquée sans facture ; facture non comptabilisée : alerte', () => {
    expect(codes(controlerCloture(validee(), []))).toEqual(['facture_absente'])
    expect(controlerCloture(marquerSansFacture(validee(), true), [])).toEqual([])
    const aTraiter = controlerCloture(rattacherFacture(validee(), 'f-1'), [{ id: 'f-1', statut: 'À traiter' }])
    expect(aTraiter.map((a) => [a.code, a.gravite])).toEqual([['facture_non_comptabilisee', 'alerte']])
  })

  it('une demande refusée ou une demande de devis se clôt sans réalisation ni facture', () => {
    expect(controlerCloture(changerStade(demande({}, OS_PV), 'Refusée', { date: '2026-10-02' }), [])).toEqual([])
    expect(controlerCloture(demande({}, DEVIS), [])).toEqual([])
  })

  it('terminerDemande passe au statut « Terminé » malgré une alerte, et refuse sur un bloquant', () => {
    const d = rattacherFacture(validee(), 'f-1')
    const fin = terminerDemande(d, [{ id: 'f-1', statut: 'À traiter' }], '2026-10-20')
    expect(fin).toMatchObject({ statut: 'Terminé', termineeLe: '2026-10-20' })
    expect(d.statut).toBe('En cours')
    expect(() => terminerDemande(validee(), [], '2026-10-20')).toThrow(/facture/)
    expect(() => terminerDemande(d, [comptabilisee('f-1')], '20/10/2026')).toThrow(/invalide/)
    expect(() => terminerDemande(fin, [comptabilisee('f-1')], '2026-10-21')).toThrow(/terminée/)
  })

  it('refuse une date de fin antérieure à la réalisation ou à la demande', () => {
    const d = marquerSansFacture(realisee(), true)
    expect(() => terminerDemande(d, [], '2020-01-01')).toThrow(/antérieure/)
    expect(() => terminerDemande(d, [], '2026-10-09')).toThrow(/réalisation \(10\/10\/2026\)/)
    expect(terminerDemande(d, [], '2026-10-10').termineeLe).toBe('2026-10-10')
    const devis = demande({}, DEVIS)
    expect(() => terminerDemande(devis, [], '2026-09-30')).toThrow(/demande \(01\/10\/2026\)/)
    expect(terminerDemande(devis, [], '2026-10-01').statut).toBe('Terminé')
    const osApres = marquerSansFacture(changerStade(demande(), 'Validée', { date: '2026-10-12', realiseeLe: '2026-09-28' }), true)
    expect(() => terminerDemande(osApres, [], '2026-09-30')).toThrow(/demande/)
    expect(terminerDemande(osApres, [], '2026-10-01').statut).toBe('Terminé')
  })
})

describe('ficheLieeDepuisDemande (onglet Demandes des fiches, point 47)', () => {
  it('rattache la demande à sa copropriété, son entreprise, son mandat et son dossier', () => {
    const d = demande({ dossier: creerRattachement('Contentieux', 'cx-1') }, HUISSIER)
    expect(ficheLieeDepuisDemande(d)).toEqual({
      id: 'dem-1',
      date: '2026-10-01',
      statut: 'En cours',
      rattachements: [
        { type: 'Copropriété', id: 'copro-1' },
        { type: 'Entreprise', id: 'ent-1' },
        { type: 'Mandat de syndic', id: 'mandat-1' },
        { type: 'Contentieux', id: 'cx-1' },
      ],
    })
  })

  it('les demandes se listent par entreprise avec fichesLiees', () => {
    const fiches = [demande({ id: 'a' }), demande({ id: 'b', prestataireId: 'ent-2' }), demande({ id: 'c', prestataireId: null })].map(ficheLieeDepuisDemande)
    expect(fichesLiees(fiches, creerRattachement('Entreprise', 'ent-1')).lignes.map((f) => f.id)).toEqual(['a'])
    expect(fiches[2].rattachements.map((r) => r.type)).toEqual(['Copropriété', 'Mandat de syndic'])
  })
})

describe('controleDeclaratifDemande (avant l’OS ou avant le règlement, vigilance-entreprises.ts réutilisé)', () => {
  const pieces = (surcharge: Partial<PiecesEntreprise> = {}): PiecesEntreprise => ({
    prestataireId: 'ent-1',
    etablieEnFrance: true,
    attestationUrssafLe: '2026-09-01',
    attestationUrssafVerifiee: true,
    immatriculation: { nature: 'kbis', le: '2026-09-01' },
    listeSalariesEtrangersLe: '2026-09-01',
    ...surcharge,
  })
  const grosPrix = { montantTtcCentimes: 660_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 600_000 }
  const avantOs = { date: '2026-10-02', decennaleObligatoire: false, moment: 'ordre_de_service' as const }

  it('avant l’OS : les mêmes anomalies que controlerAvantOrdreService, sur la base HT du prix de la demande', () => {
    const d = demande({ prix: grosPrix })
    const sansUrssaf = pieces({ attestationUrssafLe: null })
    expect(controleDeclaratifDemande(d, sansUrssaf, avantOs)).toEqual(
      controlerAvantOrdreService(sansUrssaf, { date: '2026-10-02', montantHtCentimes: 600_000, decennaleObligatoire: false }),
    )
    expect(codes(controleDeclaratifDemande(d, sansUrssaf, avantOs))).toContain('vigilance_urssaf_absente')
    expect(controleDeclaratifDemande(d, pieces(), avantOs)).toEqual([])
  })

  it('avant le règlement (bloc Règlement de l’onglet Suivi, T34) : controlerAvantReglement, alertes seulement', () => {
    const d = demande({ prix: grosPrix })
    const sansUrssaf = pieces({ attestationUrssafLe: null })
    const auReglement = { date: '2026-11-16', decennaleObligatoire: false, moment: 'reglement' as const }
    const anomalies = controleDeclaratifDemande(d, sansUrssaf, auReglement)
    expect(anomalies).toEqual(
      controlerAvantReglement(sansUrssaf, { date: '2026-11-16', montantHtCentimes: 600_000, decennaleObligatoire: false, dateOuvertureChantier: null }),
    )
    expect(codes(anomalies)).toContain('vigilance_jamais_remise')
    expect(anomalies.every((a) => a.gravite === 'alerte')).toBe(true)
    expect(controleDeclaratifDemande(d, sansUrssaf, avantOs).some((a) => a.gravite === 'bloquant')).toBe(true)
    expect(() => controleDeclaratifDemande(d, sansUrssaf, { ...auReglement, moment: 'paiement' as never })).toThrow(/Moment du contrôle/)
  })

  it('le montant de l’opération entière, quand il est donné, l’emporte sur la base HT de la demande', () => {
    const sansUrssaf = pieces({ attestationUrssafLe: null })
    const petite = demande({ prix: { montantTtcCentimes: 110_000, remiseCentimes: 0, tauxTvaPct: 10, baseHtCentimes: 100_000 } })
    expect(controleDeclaratifDemande(petite, sansUrssaf, avantOs)).toEqual([])
    const cumulee = controleDeclaratifDemande(petite, sansUrssaf, { ...avantOs, montantHtOperationCentimes: 520_000 })
    expect(codes(cumulee)).toContain('vigilance_urssaf_absente')
  })

  it('devis associé qui fait le prévu : le seuil se lit sur son HT, jamais sur la base HT d’un prix différent', () => {
    const sansUrssaf = pieces({ attestationUrssafLe: null, immatriculation: null })
    const prix = { montantTtcCentimes: 480_000, remiseCentimes: 0, tauxTvaPct: 20, baseHtCentimes: 400_000 }
    const d = demande({ prix, devisAssocie: { devisId: 'dv-1', montantTtcCentimes: 720_000 } })
    expect(prevuDemande(d)).toBe(720_000)
    expect(() => controleDeclaratifDemande(d, sansUrssaf, avantOs)).toThrow(/devis associé/)
    const attendues = ['vigilance_urssaf_absente', 'immatriculation_absente']
    expect(codes(controleDeclaratifDemande(d, sansUrssaf, { ...avantOs, montantHtOperationCentimes: 600_000 }))).toEqual(expect.arrayContaining(attendues))
    const htDuDevis = demande({ prix, devisAssocie: { devisId: 'dv-1', montantTtcCentimes: 720_000, montantHtCentimes: 600_000 } })
    expect(codes(controleDeclaratifDemande(htDuDevis, sansUrssaf, avantOs))).toEqual(expect.arrayContaining(attendues))
    const memeMontant = demande({ prix: grosPrix, devisAssocie: { devisId: 'dv-2', montantTtcCentimes: 660_000 } })
    expect(codes(controleDeclaratifDemande(memeMontant, sansUrssaf, avantOs))).toEqual(expect.arrayContaining(attendues))
  })

  it('refuse sans montant HT connu, sans entreprise, avec les pièces d’une autre entreprise ou sur une demande de devis', () => {
    const options = avantOs
    expect(() => controleDeclaratifDemande(demande({ prix: null }), pieces(), options)).toThrow(/montant HT/)
    expect(() => controleDeclaratifDemande(demande({ prestataireId: null, prix: grosPrix }), pieces(), options)).toThrow(/entreprise/)
    expect(() => controleDeclaratifDemande(demande({ prix: grosPrix }), pieces({ prestataireId: 'ent-2' }), options)).toThrow(/autre entreprise/)
    expect(() => controleDeclaratifDemande(demande({ prix: grosPrix }, DEVIS), pieces(), options)).toThrow(/devis/)
  })
})

describe('stadeDepuisStatutOrdre (boucle prestataire VitFix, 🔵)', () => {
  it('traduit le statut de l’ordre de mission en stade d’intervention', () => {
    expect(stadeDepuisStatutOrdre('en_attente')).toBeNull()
    expect(stadeDepuisStatutOrdre('accepte')).toBe('Acceptée')
    expect(stadeDepuisStatutOrdre('en_cours')).toBe('Programmée')
    expect(stadeDepuisStatutOrdre('termine')).toBe('Réalisée')
    expect(stadeDepuisStatutOrdre('refuse')).toBe('Refusée')
  })
})

describe('phaseSuggereeParExecution (exécution forcée reliée au contentieux, 🔵)', () => {
  const execution = (stade: 'Acceptée' | 'Refusée' | null, contentieuxId = 'cx-1'): Demande => {
    const d = demande({ dossier: creerRattachement('Contentieux', contentieuxId) }, HUISSIER)
    return stade === null ? d : changerStade(d, stade, { date: '2026-10-02' })
  }

  it('suggère « Exécution en cours » quand la mission du commissaire de justice est acceptée', () => {
    expect(phaseSuggereeParExecution([execution('Acceptée')], 'cx-1')).toBe('Exécution en cours')
    const programmee = changerStade(execution(null), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-15' })
    expect(phaseSuggereeParExecution([programmee], 'cx-1')).toBe('Exécution en cours')
  })

  it('rien pour un autre contentieux, une mission non acceptée ou refusée, ou un OS ordinaire', () => {
    expect(phaseSuggereeParExecution([execution('Acceptée', 'cx-2')], 'cx-1')).toBeNull()
    expect(phaseSuggereeParExecution([execution(null), execution('Refusée')], 'cx-1')).toBeNull()
    const osOrdinaire = changerStade(demande({ dossier: creerRattachement('Contentieux', 'cx-1') }), 'Acceptée', { date: '2026-10-02' })
    expect(phaseSuggereeParExecution([osOrdinaire], 'cx-1')).toBeNull()
  })

  it('rien pour une mission au statut « Refusé », même programmée', () => {
    const programmee = changerStade(execution(null), 'Programmée', { date: '2026-10-02', prevuLe: '2026-10-15' })
    expect(phaseSuggereeParExecution([changerStatut(programmee, 'Refusé')], 'cx-1')).toBeNull()
  })

  it('réalisée puis validée : toujours « Exécution en cours » tant qu’elle n’est pas terminée', () => {
    const faite = changerStade(execution(null), 'Réalisée', { date: '2026-10-10' })
    expect(phaseSuggereeParExecution([faite], 'cx-1')).toBe('Exécution en cours')
    const validee = changerStade(faite, 'Validée', { date: '2026-10-12' })
    expect(phaseSuggereeParExecution([validee], 'cx-1')).toBe('Exécution en cours')
    const terminee = terminerDemande(marquerSansFacture(validee, true), [], '2026-10-20')
    expect(phaseSuggereeParExecution([terminee], 'cx-1')).toBeNull()
  })
})
