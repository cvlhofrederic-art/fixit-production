// ── AJ Signalement : ce qu'un gestionnaire connecté reçoit (PR 2, SPEC § 2.5) ─────────────────────────────────
//
// Module pur, sans dépendance serveur : appliqué par les routes de lecture (tableau, signalements d'une copropriété)
// APRÈS le filtrage par la portée (porteeGestionnaireQr), dont il refait le filtre par défense en profondeur.
// Un gestionnaire voit ses copropriétés (QR code, affiches, lien public, destinataires) et leurs signalements, avec les
// coordonnées du déclarant (nécessaires pour le rappeler). Il ne reçoit JAMAIS : le nom, l'adresse ou l'identifiant
// d'un autre gestionnaire (liste des gestionnaires, auteur d'une copropriété, adresse restée dans les saisies), l'auteur
// nominatif d'un changement de statut (seulement « vous », « un collègue », « le cabinet »), le texte d'une erreur
// d'envoi (email_erreur, confirmation_erreur), l'adresse proposée par un déclarant (application réservée au super
// admin), le jeton d'une copropriété désactivée (aucun QR code), la fiche de suivi du super admin.

import { saisiesVisiblesQr } from '@/lib/aj-signalement/destinataires'
import type {
  AuteurStatutQr, CabinetsDesDomainesQr, CoproprieteQr, FicheAdresseQr, PorteeQr, SignalementQr, TableauQr,
} from '@/lib/aj-signalement/types'

/** Trace du dernier changement de statut (colonnes statut_modifie_par / statut_modifie_profil, migration 20261111). */
export interface TraceStatutQr {
  par: string | null
  profil: string | null
}

/** Ce que la minimisation sait du gestionnaire connecté (tout vient de sa fiche, relue par le serveur). */
export interface VueGestionnaireQr {
  /** Compte de la session (statut changé par « vous »). */
  userId: string
  gestionnaireId: string
  nom: string | null
  portee: PorteeQr
  /**
   * Fiches dont une saisie affichée peut être l'adresse (id, adresse, cabinet), pour masquer celles des collègues : même
   * boîte, ou même partie locale sur un domaine de leur cabinet (lireContexteGestionStrictQr).
   */
  fichesSaisies: ReadonlyArray<FicheAdresseQr & { id: string }>
  /** Domaines des saisies affichées → cabinet qui les a déclarés (lus avec les fiches). */
  cabinetsDesDomaines: CabinetsDesDomainesQr
}

/** Qui a changé le statut, sans nom : « vous » (ce compte), « collègue » (autre gestionnaire), « cabinet » (super admin). */
export function auteurStatutQr(trace: TraceStatutQr | null | undefined, userId: string): AuteurStatutQr | null {
  if (!trace) return null
  if (trace.profil === 'super_admin') return 'cabinet'
  if (trace.profil === 'gestionnaire') return trace.par === userId ? 'vous' : 'collegue'
  return null
}

/** Copropriété vue par le gestionnaire (nouvel objet ; la copropriété reçue n'est pas modifiée). */
export function coproprieteVueGestionnaireQr(c: CoproprieteQr, vue: VueGestionnaireQr): CoproprieteQr {
  const saisies = saisiesVisiblesQr(c.emailsDestinataires, vue.fichesSaisies, vue.gestionnaireId, vue.cabinetsDesDomaines)
  const creeeParVous = typeof c.creePar === 'object' && c.creePar.gestionnaireId === vue.gestionnaireId
  return {
    ...c,
    // Copropriété désactivée par le cabinet : visible, sans QR code.
    jeton: c.actif ? c.jeton : '',
    emailsDestinataires: saisies.emails,
    adressesMasquees: saisies.adressesMasquees,
    adressesDeGestionnaires: 0,
    derniereAdresseProposee: null,
    gestionnaires: [],
    creePar: creeeParVous ? { gestionnaireId: vue.gestionnaireId, nom: vue.nom } : 'administrateur',
    creeeParVous,
    // Attribuée nommément ET active : une copropriété désactivée reste visible en lecture seulement (SPEC § 2.5).
    modifiable: c.actif && vue.portee.modifiables.has(c.id),
  }
}

/** Signalement vu par le gestionnaire : erreurs d'envoi et adresse proposée retirées, auteur du statut sans nom. */
export function signalementVuGestionnaireQr(s: SignalementQr, trace: TraceStatutQr | null | undefined, vue: Pick<VueGestionnaireQr, 'userId'>): SignalementQr {
  return {
    ...s,
    emailErreur: null,
    confirmationErreur: null,
    adresseProposee: '',
    statutModifiePar: auteurStatutQr(trace, vue.userId),
  }
}

/**
 * Tableau vu par le gestionnaire : seulement les copropriétés visibles de sa portée et leurs signalements (même si le
 * serveur a déjà filtré), minimisés ; jamais la fiche de suivi du super admin (tableau.gestionnaire).
 */
export function tableauVuGestionnaireQr(
  tableau: TableauQr, traces: ReadonlyMap<string, TraceStatutQr>, vue: VueGestionnaireQr,
): TableauQr {
  const visibles = vue.portee.visibles
  return {
    coproprietes: tableau.coproprietes.filter((c) => visibles.has(c.id)).map((c) => coproprieteVueGestionnaireQr(c, vue)),
    signalements: tableau.signalements.filter((s) => visibles.has(s.coproprieteId)).map((s) => signalementVuGestionnaireQr(s, traces.get(s.id), vue)),
  }
}
