// tests/lib/coproprietaire-filtrage.test.ts
//
// lib/coproprietaire/filtrage.ts — ce qu'un copropriétaire voit des lignes du syndic :
//   - interventions : parties communes et immeuble entier pour tous ; une mission qui vise un lot
//     privé (lot, locataire, téléphone, accès au logement) seulement si elle est la sienne ;
//     étage/lot masqués pour les missions d'autrui ; montants selon le statut ; jamais de champ privé ;
//     coordonnées masquées dans les textes ;
//   - documents des prestataires rattachés à la bonne mission ;
//   - charges, factures (PDF = chemin de stockage seulement), impayés (jamais « passé en perte »),
//     documents (publiés par le syndic, espace commun ou personnel), contrats/assurances de l'immeuble,
//     assemblées (immeuble strict, sans brouillon, annulée seulement si convoquée, compteurs masqués
//     avant séance, mon vote), annonces, profil (quote-part seulement si tous les lots sont saisis),
//     vue locataire.

import { describe, it, expect } from 'vitest'
import {
  construireAnnonces, construireAppels, construireAssemblees, construireAssurances, construireAutresLots,
  construireContrats, construireDemandes, construireDocuments, construireFactures, construireImmeuble,
  construireImpayes, construireProfil, construireSyndic, documentsParMission, filtrerInterventions,
  masquerCoordonnees, memeNom, missionPrivee, nombre, normaliserLot, pdfFactureDisponible,
  restreindrePourLocataire, statutAssemblee,
  type LigneMission, type LigneMessagePro, type LigneSignalement,
} from '@/lib/coproprietaire/filtrage'
import type { FicheCoproprio } from '@/lib/coproprietaire/acces'
import { espaceDemo } from '@/lib/coproprietaire/demo'

const CTX = { email: 'geraldine.xavier@email.com', emailLocataire: 'paul@exemple.fr', immeuble: 'Résidence Le Prado', batiment: 'D', etage: '4', numLot: '12' }
const MES_FICHES = new Set(['f1'])

function mission(surcharge: Partial<LigneMission> & { id: string }): LigneMission {
  return {
    signalement_id: null, immeuble: 'Résidence Le Prado', artisan: 'Plomberie du Vieux-Port', type: 'Plomberie',
    description: 'Fuite colonne', priorite: 'normale', statut: 'en_cours', date_creation: '2026-10-10',
    date_intervention: '2026-10-12', montant_devis: 640, montant_facture: null, batiment: null, etage: null,
    num_lot: null, demandeur_email: null, est_partie_commune: false, zone_signalee: null, travail_effectue: null,
    materiaux_utilises: null, problemes_constates: null, recommandations: null, date_rapport: null,
    duree_intervention: null, created_at: '2026-10-10T08:00:00Z',
    ...surcharge,
  }
}

const FICHE: FicheCoproprio = {
  id: 'f1', cabinet_id: 'cab', immeuble: 'Résidence Le Prado', batiment: 'D', etage: 4, numero_porte: '12',
  nom_proprietaire: 'Xavier', prenom_proprietaire: 'Géraldine', email_proprietaire: 'Geraldine.Xavier@Email.com',
  tel_proprietaire: '06 12 34 56 78', nom_locataire: 'Durand', prenom_locataire: 'Paul', email_locataire: 'paul@exemple.fr',
  tel_locataire: '06 00 00 00 00', est_occupe: true, tantieme: '450', solde: '-855.5', acces_portail: true,
}

describe('outils', () => {
  it('nombre lit les numeric renvoyés en chaîne', () => {
    expect(nombre('12.5')).toBe(12.5)
    expect(nombre(3)).toBe(3)
    expect(nombre(null)).toBe(0)
    expect(nombre('abc')).toBe(0)
  })
  it('memeNom ignore casse et espaces, jamais vrai pour une valeur vide', () => {
    expect(memeNom(' Résidence le prado ', 'RÉSIDENCE LE PRADO')).toBe(true)
    expect(memeNom('', '')).toBe(false)
    expect(memeNom(null, 'x')).toBe(false)
  })
  it('normaliserLot rapproche les saisies libres d’un numéro de lot', () => {
    expect(normaliserLot('Lot 12')).toBe('12')
    expect(normaliserLot('lot n°12')).toBe('12')
    expect(normaliserLot('012')).toBe('12')
    expect(normaliserLot('2B')).toBe('2b')
    expect(normaliserLot(null)).toBe('')
  })
  it('masquerCoordonnees retire téléphones et e-mails des textes libres', () => {
    expect(masquerCoordonnees('Appelez Marc au 06 12 34 56 78 ou marc@plomberie.fr'))
      .toBe('Appelez Marc au [numéro masqué] ou [e-mail masqué]')
    expect(masquerCoordonnees('+33 6 12 34 56 78 / 04.91.00.00.00')).toBe('[numéro masqué] / [numéro masqué]')
    expect(masquerCoordonnees('Remplacement de 6 blocs LED, devis 380 € le 15/10/2026')).toBe('Remplacement de 6 blocs LED, devis 380 € le 15/10/2026')
  })
  it('statutAssemblee normalise les accents et écarte le brouillon', () => {
    expect(statutAssemblee('convoquée')).toBe('convoquee')
    expect(statutAssemblee('clôturée')).toBe('cloturee')
    expect(statutAssemblee('annulée')).toBe('annulee')
    expect(statutAssemblee('en_cours')).toBe('en_cours')
    expect(statutAssemblee('brouillon')).toBeNull()
    expect(statutAssemblee('')).toBeNull()
  })
  it('pdfFactureDisponible : chemin de stockage oui, URL brute non', () => {
    expect(pdfFactureDisponible('cabinet/factures/FC-1.pdf')).toBe(true)
    expect(pdfFactureDisponible('syndic-documents/x.pdf')).toBe(true)
    expect(pdfFactureDisponible('https://exemple.fr/f.pdf')).toBe(false)
    expect(pdfFactureDisponible('javascript:alert(1)')).toBe(false)
    expect(pdfFactureDisponible('')).toBe(false)
    expect(pdfFactureDisponible(null)).toBe(false)
  })
})

describe('profil, lots, immeuble, syndic', () => {
  it('profil propriétaire : quote-part seulement quand tous les lots sont saisis', () => {
    const p = construireProfil(FICHE, 'proprietaire', 10000, 48, 48)
    expect(p).toMatchObject({
      id: 'f1', prenom: 'Géraldine', nom: 'Xavier', email: 'geraldine.xavier@email.com', telephone: '06 12 34 56 78',
      role: 'proprietaire', immeuble: 'Résidence Le Prado', batiment: 'D', etage: '4', numLot: '12',
      tantiemes: 450, quotePart: 4.5, solde: -855.5, estOccupe: true,
    })
    expect(construireProfil(FICHE, 'proprietaire', 355, 4, 12).quotePart).toBe(0)
    expect(construireProfil(FICHE, 'proprietaire', 10000, 48, 0).quotePart).toBe(0)
    expect(Object.keys(p)).not.toContain('notes')
  })
  it('profil locataire : coordonnées du locataire, solde et tantièmes du propriétaire masqués', () => {
    const p = construireProfil(FICHE, 'locataire', 10000, 48, 48)
    expect(p).toMatchObject({ prenom: 'Paul', nom: 'Durand', email: 'paul@exemple.fr', role: 'locataire', solde: 0, tantiemes: 0, quotePart: 0 })
  })
  it('autres lots : tous sauf celui affiché', () => {
    const autre: FicheCoproprio = { ...FICHE, id: 'f2', batiment: 'A', etage: 1, numero_porte: '3' }
    expect(construireAutresLots([FICHE, autre], FICHE)).toEqual([{ id: 'f2', immeuble: 'Résidence Le Prado', batiment: 'A', etage: '1', numLot: '3' }])
  })
  it('immeuble absent : nom de la fiche, sans règlement', () => {
    expect(construireImmeuble(null, 'Résidence Le Prado')).toMatchObject({ id: null, nom: 'Résidence Le Prado', reglement: null })
  })
  it('immeuble présent : règlement construit si une information existe', () => {
    const i = construireImmeuble({
      id: 'i1', nom: 'Résidence Le Prado', adresse: '182 avenue du Prado', ville: 'Marseille', code_postal: '13008',
      nb_lots: 48, annee_construction: 1972, type_immeuble: 'Copropriété', gestionnaire: 'Hugo Carvalho',
      budget_annuel: '45000', depenses_annee: '31200.5', reglement_texte: null, reglement_pdf_nom: 'reglement.pdf',
      reglement_date_maj: '2020-03-10', reglement_charges_repartition: 'tantièmes généraux', reglement_majorite_ag: null,
      reglement_fonds_travaux: true, reglement_fonds_roulement_pct: '5',
    }, 'x')
    expect(i.budgetAnnuel).toBe(45000)
    expect(i.depensesAnnee).toBe(31200.5)
    expect(i.reglement).toEqual({ texte: '', pdfNom: 'reglement.pdf', dateMaj: '2020-03-10', chargesRepartition: 'tantièmes généraux', majoriteAg: '', fondsTravaux: true, fondsRoulementPct: 5 })
  })
  it('syndic : champs vides quand le cabinet est inconnu', () => {
    expect(construireSyndic(null)).toEqual({ nom: '', adresse: '', ville: '', codePostal: '', telephone: '', email: '' })
    expect(construireSyndic({ nom: ' Cabinet VitFix ', adresse: null, ville: null, code_postal: null, telephone: '04', email: 'A@B.fr' }))
      .toMatchObject({ nom: 'Cabinet VitFix', email: 'a@b.fr', telephone: '04' })
  })
})

describe('interventions de l’immeuble', () => {
  const missions = [
    mission({ id: 'commune', est_partie_commune: true, zone_signalee: 'Hall d’entrée', etage: '2', num_lot: '5' }),
    mission({ id: 'immeuble', type: 'Ravalement', montant_devis: '48600', montant_facture: '48600' }),
    mission({ id: 'immeuble-terminee', type: 'Ascenseur', statut: 'terminee', montant_devis: 1240, montant_facture: '1240' }),
    mission({ id: 'mon-lot', num_lot: 'Lot 12', batiment: 'd', etage: '4' }),
    mission({ id: 'ma-demande', num_lot: '12', batiment: 'D', etage: '4', signalement_id: 'sig-1' }),
    mission({ id: 'par-email', num_lot: '12', batiment: 'D', etage: '4', demandeur_email: ' GERALDINE.xavier@email.com ' }),
    mission({ id: 'par-mon-locataire', num_lot: '12', batiment: 'D', etage: '4', demandeur_email: 'paul@exemple.fr' }),
    mission({ id: 'autre-lot', num_lot: '7', batiment: 'A', etage: '1', demandeur_email: 'autre@exemple.fr' }),
    mission({ id: 'meme-lot-autre-bat', num_lot: '12', batiment: 'A', etage: '4' }),
    mission({ id: 'meme-lot-autre-etage', num_lot: '12', batiment: 'D', etage: '3' }),
    mission({ id: 'privee-sans-lot', locataire: 'M. Durand', telephone_locataire: '06 00 00 00 01' }),
    mission({ id: 'privee-acces', acces_logement: 'Clé chez la gardienne' }),
    mission({ id: 'autre-immeuble', immeuble: 'Résidence Castellane', est_partie_commune: true }),
  ]

  it('garde parties communes, immeuble entier, mon lot et mes demandes ; écarte le lot d’autrui, les missions privées sans lot et un autre immeuble', () => {
    const vues = filtrerInterventions(missions, CTX, new Set(['sig-1']), new Map())
    expect(vues.map(v => v.id).sort()).toEqual(['commune', 'immeuble', 'immeuble-terminee', 'ma-demande', 'mon-lot', 'par-email', 'par-mon-locataire'])
    const parId = Object.fromEntries(vues.map(v => [v.id, v]))
    expect(parId.commune).toMatchObject({ partieCommune: true, zone: 'Hall d’entrée', estLaMienne: false, montantDevis: 640, montantFacture: null, etage: '', numLot: '' })
    expect(parId.immeuble).toMatchObject({ partieCommune: true, montantDevis: 48600, montantFacture: null, estLaMienne: false })
    expect(parId['immeuble-terminee']).toMatchObject({ montantDevis: 1240, montantFacture: 1240 })
    expect(parId['mon-lot']).toMatchObject({ partieCommune: false, estLaMienne: true, numLot: 'Lot 12', etage: '4' })
    expect(parId['ma-demande']).toMatchObject({ estLaMienne: true, signalementId: 'sig-1' })
    expect(parId['par-email'].estLaMienne).toBe(true)
    expect(parId['par-mon-locataire'].estLaMienne).toBe(true)
  })

  it('missionPrivee : lot, locataire, téléphone ou accès au logement renseignés, sauf marque « partie commune »', () => {
    expect(missionPrivee(mission({ id: 'a' }))).toBe(false)
    expect(missionPrivee(mission({ id: 'b', num_lot: '3' }))).toBe(true)
    expect(missionPrivee(mission({ id: 'c', locataire: 'X' }))).toBe(true)
    expect(missionPrivee(mission({ id: 'd', acces_logement: 'code 1234' }))).toBe(true)
    expect(missionPrivee(mission({ id: 'e', num_lot: '3', est_partie_commune: true }))).toBe(false)
  })

  it('ne recopie aucun champ privé de la mission', () => {
    const [vue] = filtrerInterventions([mission({ id: 'commune', est_partie_commune: true, locataire: 'X', telephone_locataire: '06', acces_logement: 'clé' })], CTX, new Set(), new Map())
    const cles = Object.keys(vue)
    for (const interdit of ['locataire', 'telephoneLocataire', 'accesLogement', 'demandeurEmail', 'demandeurNom', 'canalMessages', 'demandeurMessages']) {
      expect(cles).not.toContain(interdit)
    }
  })

  it('montants selon le statut : rien en attente, devis dès acceptée, facture une fois terminée ; coordonnées masquées', () => {
    const vues = filtrerInterventions([
      mission({ id: 'attente', est_partie_commune: true, statut: 'en_attente', montant_devis: 500, montant_facture: 500, description: 'Rappeler le 06 11 22 33 44' }),
      mission({ id: 'acceptee', est_partie_commune: true, statut: 'acceptee', montant_devis: 500, montant_facture: 500 }),
    ], CTX, new Set(), new Map([['attente', [{ type: 'devis', reference: 'D', montantTtc: 500, description: '', date: '' }]]]))
    const parId = Object.fromEntries(vues.map(v => [v.id, v]))
    expect(parId.attente).toMatchObject({ montantDevis: null, montantFacture: null, documents: [], description: 'Rappeler le [numéro masqué]' })
    expect(parId.acceptee).toMatchObject({ montantDevis: 500, montantFacture: null })
  })

  it('compte rendu présent seulement si un champ est rempli ; statuts et priorités inconnus ramenés aux valeurs sûres', () => {
    const [sans, avec] = filtrerInterventions([
      mission({ id: 'a', est_partie_commune: true, statut: 'bizarre', priorite: 'haute' }),
      mission({ id: 'b', est_partie_commune: true, travail_effectue: 'Remplacement du joint, contact 06 12 34 56 78', date_rapport: '2026-10-13', date_creation: '2026-10-01' }),
    ], CTX, new Set(), new Map())
    expect(sans.compteRendu).toBeNull()
    expect(sans.statut).toBe('en_attente')
    expect(sans.priorite).toBe('urgente')
    expect(avec.compteRendu).toMatchObject({ travailEffectue: 'Remplacement du joint, contact [numéro masqué]', dateRapport: '2026-10-13' })
  })

  it('trie du plus récent au plus ancien et rattache les documents des prestataires', () => {
    const docs = new Map([['b', [{ type: 'devis' as const, reference: 'D-1', montantTtc: 300, description: 'Devis', date: '2026-10-02' }]]])
    const vues = filtrerInterventions([
      mission({ id: 'a', est_partie_commune: true, date_creation: '2026-09-01' }),
      mission({ id: 'b', est_partie_commune: true, date_creation: '2026-10-01' }),
    ], CTX, new Set(), docs)
    expect(vues.map(v => v.id)).toEqual(['b', 'a'])
    expect(vues[0].documents).toHaveLength(1)
    expect(vues[1].documents).toEqual([])
  })
})

describe('documents des prestataires par mission', () => {
  it('chaque document suit le dernier ordre de mission de sa conversation', () => {
    const messages: LigneMessagePro[] = [
      { id: 'm1', conversation_id: 'c1', type: 'ordre_mission', metadata: { cote: 'donneur_ordre' }, ordre_mission: { syndic_mission_id: 'mis-1' }, created_at: '2026-10-01T10:00:00Z' },
      { id: 'm2', conversation_id: 'c1', type: 'text', metadata: { cote: 'artisan', document: { type: 'devis', reference: 'DEV-1', montant_ttc: 640, description: 'Devis fuite', date: '2026-10-02' } }, ordre_mission: null, created_at: '2026-10-02T10:00:00Z' },
      { id: 'm3', conversation_id: 'c1', type: 'ordre_mission', metadata: {}, ordre_mission: { syndic_mission_id: 'mis-2' }, created_at: '2026-10-05T10:00:00Z' },
      { id: 'm4', conversation_id: 'c1', type: 'text', metadata: { document: { type: 'facture', reference: 'FAC-9', montant_ttc: 700, description: '', date: '' } }, ordre_mission: null, created_at: '2026-10-06T10:00:00Z' },
      { id: 'm5', conversation_id: 'c2', type: 'text', metadata: { document: { type: 'rapport', reference: 'R', description: 'Sans ordre', date: '2026-10-06' } }, ordre_mission: null, created_at: '2026-10-06T10:00:00Z' },
      { id: 'm6', conversation_id: 'c1', type: 'text', metadata: { document: { type: 'inconnu', reference: 'X' } }, ordre_mission: null, created_at: '2026-10-07T10:00:00Z' },
    ]
    const parMission = documentsParMission(messages)
    expect(parMission.get('mis-1')).toEqual([{ type: 'devis', reference: 'DEV-1', montantTtc: 640, description: 'Devis fuite', date: '2026-10-02' }])
    expect(parMission.get('mis-2')).toEqual([{ type: 'facture', reference: 'FAC-9', montantTtc: 700, description: '', date: '2026-10-06' }])
    expect(parMission.size).toBe(2)
  })
})

describe('mes demandes', () => {
  const signalements: LigneSignalement[] = [
    {
      id: 'sig-1', type_intervention: 'Plomberie', description: 'Fuite au plafond', priorite: 'urgente', statut: 'acceptee',
      batiment: 'D', etage: '4', num_lot: '12', est_partie_commune: false, zone_signalee: null, artisan_assigne: 'Plomberie du Vieux-Port',
      created_at: '2026-10-10T09:00:00Z', updated_at: '2026-10-11T09:00:00Z',
      syndic_signalement_messages: [
        { id: 'mm2', auteur: 'Syndic', role: 'syndic', texte: 'Mission confiée, joignable au 06 55 44 33 22', created_at: '2026-10-11T09:00:00Z' },
        { id: 'mm1', auteur: 'Géraldine Xavier', role: 'coproprio', texte: 'Merci', created_at: '2026-10-10T10:00:00Z' },
        { id: 'mm3', auteur: 'Interne', role: 'technicien', texte: 'Note entre gestionnaires', created_at: '2026-10-10T11:00:00Z' },
      ],
    },
    { id: 'sig-2', type_intervention: 'Ascenseur', description: 'Bruit', priorite: 'normale', statut: 'en_attente', batiment: null, etage: null, num_lot: null, est_partie_commune: true, zone_signalee: 'Ascenseur', artisan_assigne: null, created_at: '2026-10-12T09:00:00Z', updated_at: '2026-10-12T09:00:00Z', syndic_signalement_messages: null },
  ]

  it('fil trié chronologiquement sans les rôles internes, coordonnées masquées, mission liée la plus récente (hors annulée), tri par date décroissante', () => {
    const missions = [
      mission({ id: 'mis-ancienne', signalement_id: 'sig-1', statut: 'annulee', created_at: '2026-10-10T12:00:00Z' }),
      mission({ id: 'mis-1', signalement_id: 'sig-1', statut: 'acceptee', created_at: '2026-10-11T09:00:00Z', num_lot: '12', batiment: 'D' }),
    ]
    const demandes = construireDemandes(signalements, missions, new Map())
    expect(demandes.map(d => d.id)).toEqual(['sig-2', 'sig-1'])
    const d1 = demandes[1]
    expect(d1.messages.map(m => m.id)).toEqual(['mm1', 'mm2'])
    expect(d1.messages[0].deMoi).toBe(true)
    expect(d1.messages[1]).toMatchObject({ deMoi: false, texte: 'Mission confiée, joignable au [numéro masqué]' })
    expect(d1.intervention?.id).toBe('mis-1')
    expect(d1.intervention?.estLaMienne).toBe(true)
    expect(d1.prestataire).toBe('Plomberie du Vieux-Port')
    expect(demandes[0].intervention).toBeNull()
    expect(demandes[0]).toMatchObject({ partieCommune: true, zone: 'Ascenseur', prestataire: '' })
  })

  it('provenance : portail, public, sinon inconnue (colonne absente ou valeur imprévue) → null', () => {
    const base = signalements[1]
    const demandes = construireDemandes([
      { ...base, id: 'sans' },
      { ...base, id: 'portail', origine: 'portail' },
      { ...base, id: 'public', origine: 'public' },
      { ...base, id: 'autre', origine: 'papier' },
    ], [], new Map())
    expect(new Map(demandes.map(d => [d.id, d.origine]))).toEqual(new Map([['sans', null], ['portail', 'portail'], ['public', 'public'], ['autre', null]]))
  })
})

describe('charges, factures, impayés', () => {
  it('appels : reste à payer calculé, statut inconnu → a_payer, tri par période décroissante', () => {
    const appels = construireAppels([
      { id: 'a1', exercice: '2026-T3', periode_debut: '2026-07-01', periode_fin: '2026-09-30', montant_total: '855', montant_paye: '855', statut: 'solde', echeance: '2026-07-15', iban: null, reference_paiement: 'PAY-3' },
      { id: 'a2', exercice: '2026-T4', periode_debut: '2026-10-01', periode_fin: '2026-12-31', montant_total: 855, montant_paye: 100.004, statut: 'inconnu', echeance: '2026-10-15', iban: 'FR76…', reference_paiement: null },
    ])
    expect(appels.map(a => a.id)).toEqual(['a2', 'a1'])
    expect(appels[0]).toMatchObject({ resteAPayer: 755, statut: 'a_payer', iban: 'FR76…', referencePaiement: '' })
    expect(appels[1]).toMatchObject({ resteAPayer: 0, statut: 'solde' })
  })
  it('factures : PDF disponible seulement pour un chemin de stockage, jamais une URL relayée', () => {
    const factures = construireFactures([
      { id: 'f1', numero_facture: 'FC-1', emise_le: '2026-09-30', echeance: '2026-10-15', montant_ht: '690', tva_taux: '0', montant_ttc: '690', description: 'Provisions T4', statut: 'a_regler', pdf_url: 'https://exemple.fr/f.pdf' },
      { id: 'f2', numero_facture: 'FC-2', emise_le: '2026-10-05', echeance: null, montant_ht: 100, tva_taux: 20, montant_ttc: 120, description: null, statut: 'reglee', pdf_url: 'cab/factures/FC-2.pdf' },
    ])
    expect(factures.map(f => f.id)).toEqual(['f2', 'f1'])
    expect(factures[1].pdfDisponible).toBe(false)
    expect(factures[0]).toMatchObject({ pdfDisponible: true, montantTtc: 120, description: '' })
    expect(Object.keys(factures[0])).not.toContain('pdfUrl')
  })
  it('impayés : nature inconnue → autre ; « passé en perte » jamais montré', () => {
    const impayes = construireImpayes([
      { id: 'i1', montant: '690', nature: 'bizarre', depuis: '2026-07-15', nb_relances: 2, derniere_relance_at: '2026-09-01T00:00:00Z', statut: 'ouvert' },
      { id: 'i2', montant: '40', nature: 'frais_relance', depuis: '2025-01-15', nb_relances: 5, derniere_relance_at: null, statut: 'passe_perte' },
    ])
    expect(impayes.map(i => i.id)).toEqual(['i1'])
    expect(impayes[0]).toMatchObject({ montant: 690, nature: 'autre', nbRelances: 2, statut: 'ouvert' })
  })
})

describe('documents, contrats, assurances', () => {
  const doc = (surcharge: Record<string, unknown>) => ({
    id: 'd', filename: 'doc.pdf', mime_type: 'application/pdf', size_bytes: 1, type: 'pv_assemblee', status: 'processed', tags: null,
    uploaded_at: '2026-06-26T00:00:00Z', publie_extranet: true, espace_extranet: 'commun', coproprio_id: null, categorie_extranet: null,
    ...surcharge,
  })

  it('ne garde que les documents publiés, d’un type consultable, sans erreur ; espace personnel pour mes fiches seulement', () => {
    const docs = construireDocuments([
      doc({ id: 'd1', filename: 'PV AG 2026.pdf', size_bytes: '2400000', tags: ['ag'], uploaded_at: '2026-06-25T00:00:00Z', categorie_extranet: 'pv_ag' }),
      doc({ id: 'd2', type: 'rib' }),
      doc({ id: 'd3', type: 'releve_bancaire' }),
      doc({ id: 'd4', type: 'facture_artisan' }),
      doc({ id: 'd5', type: 'contrat', status: 'error' }),
      doc({ id: 'd6', type: 'devis', status: 'pending', uploaded_at: '2026-06-28T00:00:00Z', categorie_extranet: 'bizarre' }),
      doc({ id: 'd7', publie_extranet: false }),
      doc({ id: 'd8', publie_extranet: null }),
      doc({ id: 'd9', espace_extranet: 'personnel', coproprio_id: 'f1', uploaded_at: '2026-06-29T00:00:00Z', categorie_extranet: 'appel_fonds' }),
      doc({ id: 'd10', espace_extranet: 'personnel', coproprio_id: 'f-autre' }),
      doc({ id: 'd11', espace_extranet: 'personnel', coproprio_id: null }),
    ], MES_FICHES)
    expect(docs.map(d => d.id)).toEqual(['d9', 'd6', 'd1'])
    expect(docs[0]).toMatchObject({ personnel: true, categorie: 'appel_fonds' })
    expect(docs[1]).toMatchObject({ personnel: false, categorie: null })
    expect(docs[2]).toMatchObject({ nom: 'PV AG 2026.pdf', tailleOctets: 2400000, tags: ['ag'], categorie: 'pv_ag' })
  })
  it('contrats et assurances : ceux de l’immeuble seulement (nom comparé sans casse)', () => {
    const contrat = { id: 'c1', immeuble: 'résidence le prado', fornecedor: 'Nettoyage Sud', categoria: 'limpezas', custo_mensal: '300', custo_anual: '3600', data_inicio: '2026-01-01', data_fim: '2026-12-31', statut: 'ativo' }
    const autre = { ...contrat, id: 'c2', immeuble: 'Résidence Castellane' }
    const sansImmeuble = { ...contrat, id: 'c3', immeuble: '' }
    expect(construireContrats([contrat, autre, sansImmeuble], 'Résidence Le Prado').map(c => c.id)).toEqual(['c1'])
    expect(construireContrats([contrat], 'Résidence Le Prado')[0]).toMatchObject({ fournisseur: 'Nettoyage Sud', coutAnnuel: 3600 })
    const assurance = { id: 's1', immeuble: 'Résidence Le Prado', seguradora: 'AXA', tipo: 'multirriscos', apolice: 'P-1', premio_anual: '1200', capital: '2000000', data_inicio: null, data_fim: null, statut: null }
    expect(construireAssurances([assurance, { ...assurance, id: 's2', immeuble: 'Ailleurs' }], 'Résidence Le Prado').map(a => a.id)).toEqual(['s1'])
    expect(construireAssurances([assurance], 'Résidence Le Prado')[0]).toMatchObject({ assureur: 'AXA', primeAnnuelle: 1200, statut: 'ativa' })
  })
})

describe('assemblées', () => {
  const ag = (surcharge: Record<string, unknown>) => ({
    id: 'ag', titre: 'AG', immeuble: 'Résidence Le Prado', date_ag: '2026-11-19T18:00:00+01:00', lieu: 'Salle', type_ag: 'ordinaire',
    statut: 'convoquée', ordre_du_jour: [], total_tantiemes: 10000, pv_content: null, convocation_sent_at: null, ...surcharge,
  })

  it('écarte brouillons, autres immeubles, AG sans immeuble et annulées jamais convoquées ; normalise statuts et résultats ; rattache mon vote', () => {
    const ags = construireAssemblees([
      ag({ id: 'ag1', titre: 'AG extraordinaire', type_ag: 'extraordinaire', ordre_du_jour: ['Chaudière', 42], total_tantiemes: null, pv_content: 'brouillon de PV', convocation_sent_at: '2026-10-05T00:00:00Z' }),
      ag({ id: 'ag2', titre: 'AG ordinaire', date_ag: '2026-06-11T18:00:00+02:00', statut: 'clôturée', ordre_du_jour: null, total_tantiemes: 8000, pv_content: 'PV signé' }),
      ag({ id: 'ag3', titre: 'Brouillon', date_ag: '2027-01-01T18:00:00Z', statut: 'brouillon' }),
      ag({ id: 'ag4', titre: 'Autre immeuble', immeuble: 'Résidence Castellane', date_ag: '2026-12-01T18:00:00Z' }),
      ag({ id: 'ag5', titre: 'Sans immeuble', immeuble: '', date_ag: '2026-12-02T18:00:00Z' }),
      ag({ id: 'ag6', titre: 'Annulée jamais convoquée', statut: 'annulée', date_ag: '2026-12-03T18:00:00Z' }),
      ag({ id: 'ag7', titre: 'Annulée après convocation', statut: 'annulée', date_ag: '2026-12-04T18:00:00Z', convocation_sent_at: '2026-11-01T00:00:00Z' }),
    ], [
      { id: 'r2', assemblee_id: 'ag1', titre: 'Financement', description: null, numero_ordre: 2, majorite: 'art24', vote_pour: 120, vote_contre: 40, vote_abstention: 0, statut: 'adoptée' },
      { id: 'r1', assemblee_id: 'ag1', titre: 'Chaudière', description: 'Remplacement', numero_ordre: 1, majorite: 'art25', vote_pour: 0, vote_contre: 0, vote_abstention: 0, statut: 'en_cours' },
      { id: 'r3', assemblee_id: 'ag2', titre: 'Comptes 2025', description: null, numero_ordre: 1, majorite: 'bizarre', vote_pour: 7150, vote_contre: 450, vote_abstention: 600, statut: 'adoptée' },
    ], [{ resolution_id: 'r1', vote: 'pour', date_reception: '2026-10-17' }, { resolution_id: 'r3', vote: 'nimporte' }], 'Résidence Le Prado')
    expect(ags.map(a => a.id)).toEqual(['ag7', 'ag1', 'ag2'])
    expect(ags[1]).toMatchObject({ statut: 'convoquee', ordreDuJour: ['Chaudière'], totalTantiemes: 10000, pv: '', convocationEnvoyeeLe: '2026-10-05T00:00:00Z' })
    expect(ags[1].resolutions.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(ags[1].resolutions[0]).toMatchObject({ monVote: 'pour', monVoteLe: '2026-10-17' })
    // Avant la séance, les compteurs et le résultat ne sont pas montrés.
    expect(ags[1].resolutions[1]).toMatchObject({ votePour: 0, voteContre: 0, voteAbstention: 0, statut: 'en_cours', monVote: null, monVoteLe: '' })
    expect(ags[2]).toMatchObject({ statut: 'cloturee', totalTantiemes: 8000, pv: 'PV signé' })
    expect(ags[2].resolutions[0]).toMatchObject({ majorite: 'art24', statut: 'adoptee', votePour: 7150, monVote: null })
  })
})

describe('annonces', () => {
  it('immeuble ou tous les immeubles, épinglées d’abord, puis les plus récentes', () => {
    const annonces = construireAnnonces([
      { id: 'a1', immeuble: 'Résidence Le Prado', titulo: 'Coupure d’eau', descricao: 'Mardi', categoria: 'manutencao', prioridade: 'urgente', fixado: false, created_at: '2026-10-08T00:00:00Z' },
      { id: 'a2', immeuble: '', titulo: 'Fermeture du cabinet', descricao: 'Pont', categoria: 'outro', prioridade: 'normal', fixado: true, created_at: '2026-10-01T00:00:00Z' },
      { id: 'a3', immeuble: 'Résidence Castellane', titulo: 'Ailleurs', descricao: '', categoria: 'social', prioridade: 'normal', fixado: true, created_at: '2026-10-09T00:00:00Z' },
      { id: 'a4', immeuble: 'résidence le prado', titulo: 'Catégorie inconnue', descricao: '', categoria: 'xyz', prioridade: 'haute', fixado: null, created_at: '2026-10-02T00:00:00Z' },
    ], 'Résidence Le Prado')
    expect(annonces.map(a => a.id)).toEqual(['a2', 'a1', 'a4'])
    expect(annonces[2]).toMatchObject({ categorie: 'outro', priorite: 'normal', epinglee: false })
    expect(Object.keys(annonces[0])).not.toContain('notes')
  })
})

describe('vue locataire', () => {
  it('retire finances, documents, contrats, assemblées, montants et détail du compte rendu', () => {
    const espace = restreindrePourLocataire({ ...espaceDemo(), profil: { ...espaceDemo().profil, role: 'locataire' } })
    expect(espace.finances).toEqual({ solde: 0, appels: [], factures: [], impayes: [] })
    expect(espace.documents).toEqual({ fichiers: [], contrats: [], assurances: [] })
    expect(espace.assemblees).toEqual([])
    expect(espace.profil).toMatchObject({ solde: 0, tantiemes: 0, quotePart: 0 })
    expect(espace.immeuble.reglement).not.toBeNull()
    expect(espace.annonces.length).toBeGreaterThan(0)
    for (const i of [...espace.interventions.immeuble, ...espace.interventions.mesDemandes.map(d => d.intervention).filter((x): x is NonNullable<typeof x> => x !== null)]) {
      expect(i.montantDevis).toBeNull()
      expect(i.montantFacture).toBeNull()
      expect(i.documents).toEqual([])
      if (i.compteRendu) {
        expect(i.compteRendu.materiauxUtilises).toBe('')
        expect(i.compteRendu.recommandations).toBe('')
      }
    }
    const terminee = espace.interventions.immeuble.find(i => i.id === 'demo-int-1')
    expect(terminee?.compteRendu?.travailEffectue).toContain('patins')
  })
})
