// tests/helpers/aj-signalement-acces.ts — jeu de données des tests d'accès des gestionnaires (PR 2).
//
// Deux cabinets clients ; dans le premier, deux gestionnaires (G1, G2) aux copropriétés distinctes et une copropriété
// « attribuée à tous » (copropriété de test) dont les saisies contiennent encore l'adresse de G2 (données antérieures) ;
// dans le second, un gestionnaire G3 et sa propre copropriété « à tous ». Une copropriété sans cabinet. Chaque
// gestionnaire a un compte (rôle app_metadata gestionnaire_signalement, repère de routage) relié à sa fiche par
// user_id (état d'après la liaison : la base simulée ne joue pas les triggers). Aucune donnée réelle : @exemple.test,
// @autre-exemple.test, @externe.test, « Résidence … ». Lot 2 : fonction de création simulée (simulerCreationCoproprietesQr).

import { baseQr, type Ligne } from './aj-signalement-base'
import { simulQr, type UtilisateurSimule } from './aj-signalement-routes'

export const CAB = 'ca000000-0000-4000-8000-000000000001'
export const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'

export const U1 = '0b000000-0000-4000-8000-000000000001'
export const U2 = '0b000000-0000-4000-8000-000000000002'
export const U3 = '0b000000-0000-4000-8000-000000000003'
export const G1 = 'a0000000-0000-4000-8000-000000000001'
export const G2 = 'a0000000-0000-4000-8000-000000000002'
export const G3 = 'a0000000-0000-4000-8000-000000000003'
export const EMAIL_G1 = 'marie.exemple@exemple.test'
export const EMAIL_G2 = 'paul.collegue@exemple.test'
export const EMAIL_G3 = 'luc.ailleurs@autre-exemple.test'

export const C1 = 'c0000000-0000-4000-8000-000000000001'
export const C2 = 'c0000000-0000-4000-8000-000000000002'
export const C_TOUS = 'c0000000-0000-4000-8000-000000000003'
export const C3 = 'c0000000-0000-4000-8000-000000000004'
export const C_TOUS_AUTRE = 'c0000000-0000-4000-8000-000000000005'
export const C_SANS = 'c0000000-0000-4000-8000-000000000006'

export const S1 = '5f000000-0000-4000-8000-000000000001'
export const S2 = '5f000000-0000-4000-8000-000000000002'
export const S_TOUS = '5f000000-0000-4000-8000-000000000003'
export const S3 = '5f000000-0000-4000-8000-000000000004'
export const S_TOUS_AUTRE = '5f000000-0000-4000-8000-000000000005'
export const S_SANS = '5f000000-0000-4000-8000-000000000006'

/** Texte d'une erreur d'envoi gardée en base : ne doit jamais atteindre un gestionnaire. */
export const ERREUR_ENVOI = 'partiel : 1 refusé par le service'

const compte = (id: string, email: string, identifiant: string): UtilisateurSimule => ({
  id, email, app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: identifiant },
})
export const COMPTE_G1 = compte(U1, EMAIL_G1, 'cabinet-exemple')
export const COMPTE_G2 = compte(U2, EMAIL_G2, 'cabinet-exemple')
export const COMPTE_G3 = compte(U3, EMAIL_G3, 'autre-cabinet')

const jeton = (n: number) => `${String(n).padStart(2, '0')}23456789abcdef0123456789abcdef`

export const ligneCoproQr = (id: string, n: number, nom: string, sur: Ligne = {}): Ligne => ({
  id, nom, adresse: `${n} rue Exemple`, jeton: jeton(n), emails_destinataires: [], actif: true,
  created_at: `2026-11-0${n}T09:00:00+00:00`, cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', immatriculation: null,
  reference_cabinet: null, batiments: [], attribuee_a_tous: false, cree_par_gestionnaire_id: null, cle_nom: null, operation_id: null, ...sur,
})

export const ligneSignalementQr = (id: string, coproprieteId: string, minute: number, sur: Ligne = {}): Ligne => ({
  id, copropriete_id: coproprieteId, prenom: 'Prénom', nom: 'Déclarant', telephone: '0600000000', email: 'declarant@exemple.test',
  batiment: 'A', etage: '1', num_lot: '7', est_partie_commune: false, zone_signalee: '', type_intervention: 'Plomberie',
  description: 'Fuite d’eau au plafond', priorite: 'normale', statut: 'en_attente', langue: 'fr', email_envoye_le: '2026-11-10T09:30:00+00:00',
  email_erreur: null, confirmation_envoyee_le: null, confirmation_erreur: null, qualite_declarant: 'locataire', adresse_proposee: null,
  signalement_lie_id: null, statut_modifie_le: null, statut_modifie_par: null, statut_modifie_profil: null, nb_emails_envoyes: 1, email_retenu: false,
  created_at: `2026-11-10T09:${String(minute).padStart(2, '0')}:00+00:00`, updated_at: `2026-11-10T09:${String(minute).padStart(2, '0')}:00+00:00`, ...sur,
})

const fiche = (id: string, cabinet: string, nom: string, email: string, userId: string): Ligne => ({
  id, cabinet_id: cabinet, nom, email, actif: true, domaine_force: false, adresse_confirmee_le: '2026-11-05T09:00:00+00:00',
  adresse_contestee_le: null, pseudonymise_le: null, desactive_le: null, cree_par: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4',
  created_at: '2026-11-05T08:00:00+00:00', user_id: userId, acces_ouvert_le: '2026-11-06T09:00:00+00:00', connexion_bloquee_le: null,
  effacement_demande_le: null,
})

/** Pose le jeu de données dans la base simulée partagée (après baseQr.reinitialiser()). */
export function poserJeuAccesQr(): void {
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'fr' },
  ]
  t.signalements_qr_domaines_autorises = [
    { cabinet_id: CAB, domaine: 'exemple.test' },
    { cabinet_id: CAB_AUTRE, domaine: 'autre-exemple.test' },
  ]
  t.signalements_qr_gestionnaires = [
    fiche(G1, CAB, 'Marie Exemple', EMAIL_G1, U1),
    fiche(G2, CAB, 'Paul Collègue', EMAIL_G2, U2),
    fiche(G3, CAB_AUTRE, 'Luc Ailleurs', EMAIL_G3, U3),
  ]
  t.signalements_qr_coproprietes = [
    ligneCoproQr(C1, 1, 'Résidence Une', { emails_destinataires: ['cs-une@externe.test'] }),
    ligneCoproQr(C2, 2, 'Résidence Deux', { cree_par_gestionnaire_id: G2, emails_destinataires: [EMAIL_G2] }),
    ligneCoproQr(C_TOUS, 3, 'Résidence Test', { attribuee_a_tous: true, emails_destinataires: ['cs@externe.test', EMAIL_G2] }),
    ligneCoproQr(C3, 4, 'Résidence Ailleurs', { cabinet_id: CAB_AUTRE }),
    ligneCoproQr(C_TOUS_AUTRE, 5, 'Résidence Test Ailleurs', { cabinet_id: CAB_AUTRE, attribuee_a_tous: true }),
    ligneCoproQr(C_SANS, 6, 'Parc Exemple', { cabinet_id: null }),
  ]
  t.signalements_qr_attributions = [
    { copropriete_id: C1, gestionnaire_id: G1, origine: 'super_admin', created_at: '2026-11-05T09:00:00+00:00' },
    { copropriete_id: C2, gestionnaire_id: G2, origine: 'creation', created_at: '2026-11-05T09:00:00+00:00' },
    { copropriete_id: C3, gestionnaire_id: G3, origine: 'super_admin', created_at: '2026-11-05T09:00:00+00:00' },
  ]
  t.signalements_qr = [
    ligneSignalementQr(S1, C1, 1),
    ligneSignalementQr(S2, C2, 2, { email_erreur: ERREUR_ENVOI }),
    ligneSignalementQr(S_TOUS, C_TOUS, 3, {
      email_erreur: ERREUR_ENVOI, confirmation_erreur: ERREUR_ENVOI, adresse_proposee: '9 rue Proposée',
      statut: 'acceptee', statut_modifie_le: '2026-11-10T10:00:00+00:00', statut_modifie_par: U2, statut_modifie_profil: 'gestionnaire',
    }),
    ligneSignalementQr(S3, C3, 4),
    ligneSignalementQr(S_TOUS_AUTRE, C_TOUS_AUTRE, 5),
    ligneSignalementQr(S_SANS, C_SANS, 6),
  ]
  t.signalements_qr_journal = []
  baseQr.etat.fonctions.signalements_qr_compteurs = (a) => ({
    data: (a.p_ids as string[]).map((id) => ({ copropriete_id: id, total: 1, en_attente: 1, ouverts: 1, urgents_ouverts: 0, attente_48h: 0, dernier: '2026-11-10T09:00:00+00:00' })),
  })
}

/** Première copropriété créée par la fonction simulée (…101, puis …102). */
export const C_CREEE = 'c0000000-0000-4000-8000-000000000101'

/**
 * Fonction de création simulée (signalements_qr_creer_coproprietes, migration 20261111), au plus près de son corps SQL
 * pour une saisie (lot d'une ligne) : rejeu par operationId réservé au même auteur et au même cabinet, fiche active du
 * cabinet exigée d'un gestionnaire (42501 sinon), copropriété insérée dans le cabinet du PARAMÈTRE, adresses de fiches
 * retirées des saisies, auteur gestionnaire et attribution « creation » d'office, journal. Le re-contrôle nom + code
 * postal sous verrou n'est pas simulé (pré-contrôle de la route). `sansAttribution` : base incohérente (aucune
 * attribution posée), pour prouver que la route le voit.
 */
export function simulerCreationCoproprietesQr(options: { sansAttribution?: boolean } = {}): void {
  let creees = 0
  baseQr.etat.fonctions.signalements_qr_creer_coproprietes = (a) => {
    const deja = baseQr.table('signalements_qr_operations').find((o) => o.id === a.p_operation)
    if (deja) {
      if (deja.acteur_id !== a.p_acteur || deja.cabinet_id !== a.p_cabinet) return { error: { code: 'P0001', message: 'a_reverifier' } }
      return { data: { ...(deja.resultat as Ligne), rejeu: true } }
    }
    if (a.p_profil === 'gestionnaire'
      && !baseQr.table('signalements_qr_gestionnaires').some((g) => g.id === a.p_gestionnaire && g.actif === true && g.cabinet_id === a.p_cabinet)) {
      return { error: { code: '42501', message: 'interdit' } }
    }
    const [l] = a.p_lignes as Ligne[]
    creees += 1
    const id = `c0000000-0000-4000-8000-0000000001${String(creees).padStart(2, '0')}`
    const jetonCree = `${'e'.repeat(30)}${String(creees).padStart(2, '0')}`
    const emailsFiches = new Set(baseQr.table('signalements_qr_gestionnaires').map((g) => g.email))
    baseQr.table('signalements_qr_coproprietes').push(ligneCoproQr(id, 9, String(l.nom), {
      adresse: l.adresse, code_postal: l.codePostal, ville: l.ville, immatriculation: l.immatriculation || null,
      reference_cabinet: l.referenceCabinet || null, batiments: l.batiments,
      emails_destinataires: (l.emails as string[]).filter((e) => !emailsFiches.has(e)), jeton: jetonCree, cabinet_id: a.p_cabinet,
      cle_nom: l.cleNom, cree_par_gestionnaire_id: a.p_gestionnaire ?? null, operation_id: a.p_operation, created_at: '2026-11-11T10:00:00+00:00',
    }))
    const journal = baseQr.table('signalements_qr_journal')
    journal.push({ action: 'copropriete.creee', cabinet_id: a.p_cabinet, acteur_id: a.p_acteur, acteur_profil: a.p_profil, acteur_gestionnaire_id: a.p_gestionnaire ?? null, copropriete_id: id })
    if (a.p_profil === 'gestionnaire' && !options.sansAttribution) {
      baseQr.table('signalements_qr_attributions').push({ copropriete_id: id, gestionnaire_id: a.p_gestionnaire, origine: 'creation', created_at: '2026-11-11T10:00:00+00:00' })
      journal.push({ action: 'attribution.ajoutee', cabinet_id: a.p_cabinet, acteur_id: a.p_acteur, acteur_profil: 'gestionnaire', copropriete_id: id, gestionnaire_id: a.p_gestionnaire })
    }
    const resultat = { creees: [{ numeroLigne: 1, id, jeton: jetonCree }], completees: [] }
    baseQr.table('signalements_qr_operations').push({ id: a.p_operation, acteur_id: a.p_acteur, cabinet_id: a.p_cabinet, resultat })
    return { data: { ...resultat, rejeu: false } }
  }
}

/** Session du gestionnaire (jeton Bearer simulé). */
export function connecterQr(compteSimule: UtilisateurSimule): void {
  simulQr.user = compteSimule
}

/** Fiche d'un gestionnaire dans la base simulée (pour la modifier en cours de test). */
export const ficheSimuleeQr = (id: string): Ligne => {
  const trouvee = baseQr.table('signalements_qr_gestionnaires').find((f) => f.id === id)
  if (!trouvee) throw new Error(`fiche ${id} absente du jeu de données`)
  return trouvee
}
