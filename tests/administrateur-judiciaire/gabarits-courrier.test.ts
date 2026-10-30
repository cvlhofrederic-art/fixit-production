import { describe, expect, it } from 'vitest'
import type { SuiviEcheancier } from '@/lib/administrateur-judiciaire/domain/decompte-contentieux'
import {
  CLES_GABARITS_COURRIER,
  GABARITS_COURRIER,
  champsDuContexte,
  choisirCertificatArt20,
  controlerAttestationNonRecours,
  controlerCaduciteProtocole,
  controlerCertificatArt20,
  controlerContexteFusion,
  controlerFormeEnvoi,
  echeanceOppositionArt20,
  gabaritCourrier,
  modeleCourrierDepuisGabarit,
  verifierRegistreGabarits,
} from '@/lib/administrateur-judiciaire/domain/gabarits-courrier'
import type { ResultatDelaiContestation } from '@/lib/administrateur-judiciaire/domain/statut-assemblee'

/**
 * Gabarits de courrier prioritaires d'un administrateur judiciaire (point 62 du bilan 2 ; Gestéam, tranche 43 § 22 :
 * modèles « Famille - LIBELLÉ - [contexte] - mode d'envoi », le contexte d'édition fixant les champs de fusion).
 * Droit relu sur Légifrance le 29/10/2026 : L. 1965 art. 20, 29-5 V, 42 al. 2, 42-1, 17-1 A ; D. 1967 art. 5-1, 9,
 * 9 bis, 14-1, 18, 64 à 64-3, 64-9 ; C. civ. art. 1224, 1225, 2240 ; C. assur. art. L. 113-2, L. 114-1, L. 114-2,
 * L. 242-1 et annexe II à l'art. A. 243-1. PV de carence et attestation de non-recours : pratiques, sans texte propre.
 */

const socle = {
  'copropriete.nom': 'Les Tilleuls',
  'copropriete.adresse': '12 rue des Tilleuls, 13001 Marseille',
  'mandat.fondement': 'L. 1965 art. 29-1',
  'mandat.tribunal': 'TJ de Marseille',
  'mandat.ordonnance': '2026-03-02',
  'mandat.rg': '26/01234',
  'destinataire.nom': 'Me Lefèvre',
  'destinataire.adresse': '1 cours Pierre Puget, 13006 Marseille',
}

describe('registre des gabarits', () => {
  it('tient ses invariants : familles, formes, champs requis du contexte, fondement ou pratique déclarée', () => {
    expect(verifierRegistreGabarits()).toEqual([])
    expect(CLES_GABARITS_COURRIER).toHaveLength(12)
  })

  it('les familles suivent Gestéam (mutation, contentieux, assemblée, sinistre)', () => {
    expect(GABARITS_COURRIER.certificat_art20_ii_1.famille).toBe('Mutation')
    expect(GABARITS_COURRIER.opposition_art20.famille).toBe('Contentieux')
    expect(GABARITS_COURRIER.pv_carence.famille).toBe('Assemblée')
    expect(GABARITS_COURRIER.declaration_sinistre_do.famille).toBe('Sinistre')
  })

  it('opposition art. 20 : acte extrajudiciaire exigé par la loi, alors que Gestéam l’étiquette « AR »', () => {
    const g = gabaritCourrier('opposition_art20')
    expect(g).toMatchObject({ formeLegale: 'acte_extrajudiciaire', formeObservee: 'AR' })
    expect(g.fondements).toContain('L. 1965 art. 20, I')
    expect(g.mentions.join(' ')).toMatch(/élection de domicile/i)
    expect(g.mentions.join(' ')).toMatch(/montant et causes/i)
    expect(g.champsPropres).toEqual(expect.arrayContaining(['vendeur.nom', 'mutation.date', 'opposition.electionDomicile', 'creance.annees1Centimes', 'creance.autresCentimes']))
  })

  it('PV de carence et attestation de non-recours : pratiques déclarées, sans texte propre ni forme imposée', () => {
    expect(gabaritCourrier('pv_carence')).toMatchObject({ formeLegale: 'libre', formeEnvoiParDefaut: 'AR' })
    expect(gabaritCourrier('pv_carence').sansTexte).toMatch(/pratique/i)
    expect(gabaritCourrier('attestation_non_recours')).toMatchObject({ formeLegale: 'libre' })
    expect(gabaritCourrier('attestation_non_recours').sansTexte).toMatch(/pratique/i)
    expect(gabaritCourrier('certificat_art20_ii_1').sansTexte).toBeNull()
  })

  it('convocation avec vote par correspondance : 21 jours, mention de la voie postale (art. 64-2), remise contre émargement (art. 64-3)', () => {
    const g = gabaritCourrier('convocation_ag_vpc')
    expect(g.formeLegale).toBe('notification_coproprietaire')
    expect(g.delai?.libelle).toMatch(/21 jours/)
    expect(g.mentions.join(' ')).toMatch(/voie postale \(D\. 1967 art\. 64-2\)/)
    expect(g.fondements.join(' ')).toMatch(/64-3/)
    expect(g.fondements.join(' ')).toMatch(/arrêté du 2 juillet 2020, art\. 1/)
  })

  it('dommages-ouvrage : durée de la garantie tirée de l’annexe II, prescription de deux ans', () => {
    const { delai, fondements } = gabaritCourrier('declaration_sinistre_do')
    expect(delai?.fondement).toMatch(/annexe II.*durée de la garantie/)
    expect(delai?.libelle).toMatch(/prescription de deux ans/)
    expect(fondements).toContain('C. assur. art. L. 114-1')
    expect(gabaritCourrier('contestation_expertise_do')).toMatchObject({ formeLegale: 'libre', formeEnvoiParDefaut: 'AR' })
    expect(gabaritCourrier('contestation_expertise_do').fondements.join(' ')).toMatch(/B 1° a, B 3° c/)
  })

  it('refuse une clé inconnue, même héritée d’Object', () => {
    // @ts-expect-error — clé hors registre
    expect(() => gabaritCourrier('lettre_au_pere_noel')).toThrow(/inconnu/i)
    // @ts-expect-error — clé héritée
    expect(() => gabaritCourrier('toString')).toThrow(/inconnu/i)
  })
})

describe('contexte de fusion', () => {
  it('le socle commun, puis les champs du contexte', () => {
    const champs = champsDuContexte('mutation').map((c) => c.cle)
    expect(champs.slice(0, 3)).toEqual(['copropriete.nom', 'copropriete.adresse', 'mandat.fondement'])
    expect(champs).toContain('notaire.nom')
  })

  it('complet : tous les champs requis, valeurs au bon type', () => {
    const valeurs = {
      ...socle,
      'lot.numero': '12',
      'notaire.nom': 'Me Lefèvre',
      'notificationNotaire.dateReception': '2026-10-01',
      'personnesNotifiees.noms': 'Martin Paul',
    }
    expect(controlerContexteFusion('certificat_art20_ii_1', valeurs)).toEqual({ complet: true, manquants: [], invalides: [], inconnus: [] })
  })

  it('signale les champs manquants, de mauvais type et inconnus', () => {
    const resultat = controlerContexteFusion('certificat_art20_ii_1', {
      'copropriete.nom': ' ',
      'mandat.rg': 1234,
      'notificationNotaire.dateReception': '01/10/2026',
      'lot.numero': '12',
      'champ.invente': 'x',
    })
    expect(resultat.complet).toBe(false)
    expect(resultat.manquants.map((c) => c.cle)).toContain('notaire.nom')
    expect(resultat.invalides).toEqual([
      { cle: 'copropriete.nom', motif: 'texte vide' },
      { cle: 'mandat.rg', motif: 'texte attendu' },
      { cle: 'notificationNotaire.dateReception', motif: 'date AAAA-MM-JJ attendue' },
    ])
    expect(resultat.inconnus).toEqual(['champ.invente'])
    const montant = controlerContexteFusion('protocole_apurement_caducite', { 'protocole.impayesCentimes': 12.5 })
    expect(montant.invalides).toContainEqual({ cle: 'protocole.impayesCentimes', motif: 'centimes entiers positifs ou nuls attendus' })
    const booleen = controlerContexteFusion('certificat_art20_ii_2', { 'personnesNotifiees.uneEstCoproprietaire': 'oui' })
    expect(booleen.invalides).toContainEqual({ cle: 'personnesNotifiees.uneEstCoproprietaire', motif: 'oui ou non attendu' })
  })

  it('modèle de courrier prêt pour la table (contexte = clé du contexte, forme = défaut du gabarit)', () => {
    expect(modeleCourrierDepuisGabarit('declaration_sinistre_do')).toEqual({
      famille: 'Sinistre',
      libelle: 'Déclaration de sinistre dommages-ouvrage',
      contexte: 'sinistre',
      formeEnvoi: 'AR',
    })
  })
})

describe('forme d’envoi', () => {
  it('opposition art. 20 : le courrier ne remplace jamais l’acte du commissaire de justice', () => {
    expect(controlerFormeEnvoi('opposition_art20', 'AR', { voie: null })).toMatchObject([{ code: 'acte_extrajudiciaire_requis', gravite: 'avertissement' }])
  })

  it('notification à un copropriétaire : LRAR en voie postale ; un envoi simple ne vaut jamais', () => {
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Normal', { voie: 'postale' })).toMatchObject([{ code: 'lrar_requise', gravite: 'bloquant' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'AR', { voie: 'postale' })).toEqual([])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Email', { voie: 'electronique' })).toMatchObject([{ code: 'envoi_non_qualifie', gravite: 'bloquant' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Normal', { voie: 'electronique' })).toMatchObject([{ code: 'envoi_non_qualifie', gravite: 'bloquant' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'AR', { voie: 'electronique' })).toMatchObject([{ code: 'lrar_hors_demande', gravite: 'avertissement' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'AR', { voie: null })).toMatchObject([{ code: 'voie_inconnue', gravite: 'avertissement' }])
    expect(controlerFormeEnvoi('convocation_ag_vpc', 'Normal', { voie: null }).map((a) => a.code)).toEqual(['voie_inconnue', 'envoi_non_qualifie'])
  })

  it('convocation remise contre émargement : valable quelle que soit la voie (art. 64-3) ; pas pour la caducité du protocole', () => {
    for (const voie of ['postale', 'electronique', null] as const)
      expect(controlerFormeEnvoi('convocation_ag_vpc', 'Normal', { voie, remiseContreEmargement: true })).toEqual([])
    expect(controlerFormeEnvoi('protocole_apurement_caducite', 'Normal', { voie: 'postale', remiseContreEmargement: true })).toMatchObject([{ code: 'lrar_requise' }])
  })

  it('forme libre : aucun blocage (certificat, PV de carence, contestation d’expertise dommages-ouvrage)', () => {
    expect(controlerFormeEnvoi('certificat_art20_ii_1', 'Email', { voie: null })).toEqual([])
    expect(controlerFormeEnvoi('pv_carence', 'Normal', { voie: 'postale' })).toEqual([])
    expect(controlerFormeEnvoi('contestation_expertise_do', 'Email', { voie: null })).toEqual([])
  })
})

describe('certificat de l’art. 20 II', () => {
  it('choisit le 1° ou le 2° selon qu’une personne notifiée (acquéreur, associé, conjoint…) est déjà copropriétaire', () => {
    expect(choisirCertificatArt20(false)).toBe('certificat_art20_ii_1')
    expect(choisirCertificatArt20(true)).toBe('certificat_art20_ii_2')
  })

  it('délivré dans le mois de la notification du notaire', () => {
    expect(controlerCertificatArt20({ unePersonneNotifieeCoproprietaire: false, misesEnDemeure: [], dateNotificationNotaire: '2026-10-10', aujourdhui: '2026-10-15' })).toEqual({
      cle: 'certificat_art20_ii_1',
      delivrable: true,
      echeance: '2026-11-10',
      motif: 'Certificat à délivrer au notaire au plus tard le 10/11/2026 (L. 1965 art. 20, II).',
    })
  })

  it('associé de la SCI acquéreuse déjà copropriétaire : refus si sa mise en demeure est restée infructueuse plus de 45 jours', () => {
    const base = { unePersonneNotifieeCoproprietaire: true, dateNotificationNotaire: '2026-10-10', aujourdhui: '2026-10-20' }
    // Point de départ le 2026-09-04 : 46 jours au 2026-10-20.
    const refus = controlerCertificatArt20({ ...base, misesEnDemeure: [{ pointDeDepart: '2026-09-04', regleeLe: null }] })
    expect(refus).toMatchObject({ cle: 'certificat_art20_ii_2', delivrable: false })
    expect(refus.motif).toMatch(/notaire notifie/i)
    expect(refus.motif).toMatch(/trente jours/)
    // 45 jours tout juste : pas encore « plus de 45 jours ».
    expect(controlerCertificatArt20({ ...base, misesEnDemeure: [{ pointDeDepart: '2026-09-05', regleeLe: null }] }).delivrable).toBe(true)
    // Réglée avant la date du certificat : plus infructueuse ; réglée après : encore infructueuse.
    expect(controlerCertificatArt20({ ...base, misesEnDemeure: [{ pointDeDepart: '2026-09-04', regleeLe: '2026-10-01' }] }).delivrable).toBe(true)
    expect(controlerCertificatArt20({ ...base, misesEnDemeure: [{ pointDeDepart: '2026-09-04', regleeLe: '2026-10-25' }] }).delivrable).toBe(false)
  })

  it('délai d’un mois expiré : signalé', () => {
    const tardif = controlerCertificatArt20({ unePersonneNotifieeCoproprietaire: false, misesEnDemeure: [], dateNotificationNotaire: '2026-09-01', aujourdhui: '2026-10-02' })
    expect(tardif).toMatchObject({ delivrable: true, echeance: '2026-10-01' })
    expect(tardif.motif).toMatch(/expiré le 01\/10\/2026/)
  })

  it('refuse des dates invalides et des mises en demeure sans personne copropriétaire', () => {
    expect(() => controlerCertificatArt20({ unePersonneNotifieeCoproprietaire: false, misesEnDemeure: [], dateNotificationNotaire: '01/09/2026', aujourdhui: '2026-10-02' })).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerCertificatArt20({ unePersonneNotifieeCoproprietaire: true, misesEnDemeure: [{ pointDeDepart: 'x', regleeLe: null }], dateNotificationNotaire: '2026-09-01', aujourdhui: '2026-10-02' })).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerCertificatArt20({ unePersonneNotifieeCoproprietaire: false, misesEnDemeure: [{ pointDeDepart: '2026-09-04', regleeLe: null }], dateNotificationNotaire: '2026-09-01', aujourdhui: '2026-10-02' })).toThrow(/incohérentes/)
  })
})

describe('opposition de l’art. 20 I', () => {
  it('avant l’expiration de quinze jours à compter de la réception de l’avis de mutation', () => {
    expect(echeanceOppositionArt20('2026-10-01')).toMatchObject({ echeance: '2026-10-16', dernierJourOuvrable: '2026-10-16', avertissement: null, fondement: 'L. 1965 art. 20, I' })
    expect(() => echeanceOppositionArt20('01/10/2026')).toThrow(/AAAA-MM-JJ/)
  })

  it('échéance un jour férié : avertissement et dernier jour ouvrable précédent', () => {
    const ferie = echeanceOppositionArt20('2026-12-17')
    expect(ferie).toMatchObject({ echeance: '2027-01-01', dernierJourOuvrable: '2026-12-31' })
    expect(ferie.avertissement).toMatch(/non ouvrable/)
  })
})

describe('attestation de non-recours', () => {
  const calcule = (echeanceSansReport: string, echeanceAvecReport = echeanceSansReport): ResultatDelaiContestation => ({
    etat: 'calcule',
    datePremierePresentation: '2026-08-03',
    pointDeDepart: '2026-08-04',
    echeanceSansReport,
    echeanceAvecReport,
    echeanceRetenue: echeanceSansReport,
    reportApplique: false,
    divergence: echeanceSansReport !== echeanceAvecReport,
    justification: '',
    avertissements: [],
  })
  const options = (notificationsAttendues: number, assignationsRecues = 0) => ({ assignationsRecues, notificationsAttendues })

  it('délivrable après l’expiration du délai de chaque opposant ou défaillant, sans assignation reçue', () => {
    expect(controlerAttestationNonRecours([calcule('2026-10-04'), calcule('2026-10-06')], '2026-10-07', options(2))).toMatchObject({ delivrable: true })
    expect(controlerAttestationNonRecours([calcule('2026-10-04'), calcule('2026-10-06')], '2026-10-06', options(2))).toMatchObject({ delivrable: false })
  })

  it('en cas de report débattu, la date la plus tardive fait foi', () => {
    expect(controlerAttestationNonRecours([calcule('2026-10-04', '2026-10-05')], '2026-10-05', options(1)).delivrable).toBe(false)
    expect(controlerAttestationNonRecours([calcule('2026-10-04', '2026-10-05')], '2026-10-06', options(1)).delivrable).toBe(true)
  })

  it('refus : délai manquant pour un opposant, notification non prouvée, délai non calculé, assignation reçue', () => {
    expect(controlerAttestationNonRecours([calcule('2026-10-04')], '2026-12-01', options(2)).motif).toMatch(/sans délai calculé/)
    expect(controlerAttestationNonRecours([{ etat: 'non_notifiee' }], '2026-12-01', options(1)).delivrable).toBe(false)
    expect(controlerAttestationNonRecours([{ etat: 'refuse', motif: 'Courrier introuvable.' }], '2026-12-01', options(1)).motif).toMatch(/Courrier introuvable/)
    expect(controlerAttestationNonRecours([calcule('2026-10-04')], '2026-12-01', options(1, 1)).motif).toMatch(/assignation/i)
  })

  it('sans opposant ni défaillant : délivrable ; plus de délais que d’opposants ou saisies invalides : refusés', () => {
    expect(controlerAttestationNonRecours([], '2026-12-01', options(0))).toMatchObject({ delivrable: true })
    expect(() => controlerAttestationNonRecours([calcule('2026-12-31')], '2026-12-01', options(0))).toThrow(/incohérentes/)
    expect(() => controlerAttestationNonRecours([{ etat: 'non_notifiee' }], '2026-12-01', options(0))).toThrow(/incohérentes/)
    expect(() => controlerAttestationNonRecours([calcule('2026-10-04')], '01/12/2026', options(1))).toThrow(/AAAA-MM-JJ/)
    expect(() => controlerAttestationNonRecours([calcule('2026-10-04')], '2026-12-01', options(1, -1))).toThrow(/entier positif/)
    expect(() => controlerAttestationNonRecours([calcule('2026-10-04')], '2026-12-01', options(Number.NaN))).toThrow(/entier positif/)
  })
})

describe('caducité du protocole d’apurement', () => {
  const suivi = (impayesCentimes: number): SuiviEcheancier => ({ echeances: [], prochaine: null, impayesCentimes, respecte: impayesCentimes === 0, excedentCentimes: 0 })

  it('possible seulement si une échéance échue reste impayée ; la mise en demeure doit viser la clause résolutoire', () => {
    expect(controlerCaduciteProtocole(suivi(0))).toMatchObject({ caducitePossible: false })
    const caduc = controlerCaduciteProtocole(suivi(15_000))
    expect(caduc).toMatchObject({ caducitePossible: true, impayesCentimes: 15_000 })
    expect(caduc.motif).toMatch(/clause résolutoire/)
    expect(caduc.motif).toMatch(/1225/)
  })
})
