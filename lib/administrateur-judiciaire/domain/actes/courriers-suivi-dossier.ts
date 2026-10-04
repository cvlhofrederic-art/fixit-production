import type { CoproprieteDemo } from '@/components/administrateur-judiciaire/data/coproprietes'
import { formatEuros } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Courriers pré-remplis des étapes de la checklist d'un dossier (modale de suivi de dossier du cabinet).
 * Textes repris de la maquette au caractère près (retours à la ligne, apostrophes droites).
 */

/** Courrier préparé pour une étape : objet, destinataire, libellé du bouton d'envoi et corps. */
export interface CourrierEtapeDossier {
  objet: string
  dest: string
  sendLabel: string
  body: string
}

/**
 * Courrier correspondant au libellé d'une étape. Les tests sur le libellé en minuscules sont faits en cascade,
 * dans cet ordre : notification de l'ordonnance, convocation de l'AG, recouvrement, reddition, rapport au tribunal,
 * plan d'apurement, compte séparé, devis, assurance, budget, diagnostic, carnet / visite / état des lieux ;
 * à défaut, une note de diligence.
 * Bizarreries conservées : « Convocation AG travaux » reçoit le modèle de l'AG élective, la date de l'AG
 * (08/07/2026 à 18h30) et la signature « Cabinet Delaunay » sont en dur.
 */
export function preparerCourrierEtapeDossier(
  libelleEtape: string,
  dossier: { nom: string },
  copro: Partial<CoproprieteDemo>,
): CourrierEtapeDossier {
  const libelle = (libelleEtape || '').toLowerCase(),
    nom = dossier.nom

  if (libelle.includes('notification') && libelle.includes('ordonnance'))
    return {
      objet: "Notification de l'ordonnance de désignation",
      dest: 'Tous les copropriétaires — ' + nom,
      sendLabel: 'Notifier aux copropriétaires',
      body: `Madame, Monsieur,

Par ordonnance du ${copro.ordonnance || ''} (RG ${copro.rg || ''}), le ${copro.tribunal || 'tribunal judiciaire'} a désigné le Cabinet Delaunay en qualité de syndic judiciaire de la copropriété ${nom}, sur le fondement de l'article 46 du décret du 17 mars 1967.

Cette ordonnance vous est notifiée conformément à l'article 59 du décret du 17 mars 1967 : vous pouvez en référer au président du tribunal judiciaire dans les quinze jours de la présente notification. Je prends mes fonctions à effet immédiat et vous tiendrai informés des prochaines échéances.

Le syndic judiciaire — Cabinet Delaunay`,
    }

  if (libelle.includes('convocation') || libelle.includes("l'ag") || libelle.includes('ag élect'))
    return {
      objet: "Convocation de l'assemblée générale élective",
      dest: 'Tous les copropriétaires — ' + nom,
      sendLabel: 'Envoyer la convocation',
      body: `Vous êtes convoqué(e) à l'assemblée générale de la copropriété ${nom}, le 08/07/2026 à 18h30.

Ordre du jour :
1. Désignation d'un syndic (art. 25 loi 1965)
2. Reddition des comptes du syndic judiciaire
3. Vote du budget prévisionnel
4. Questions diverses

Convocation par lettre recommandée au moins 21 jours avant la séance (art. 9 décret 1967). Formulaire de vote par correspondance et pouvoir joints.`,
    }

  if (libelle.includes('recouvrement') || libelle.includes('impay') || libelle.includes('mise en demeure'))
    return {
      objet: 'Mise en demeure — charges impayées',
      dest: 'Copropriétaires débiteurs — ' + nom,
      sendLabel: 'Envoyer les mises en demeure',
      body: `Madame, Monsieur,

Votre compte présente un arriéré de charges de copropriété. Le total des impayés du syndicat s'élève à ${formatEuros(copro.impayes || 0)}.

Je vous mets en demeure de régulariser ces sommes, dont le détail par provision et par exercice est joint. Faute de paiement passé un délai de trente (30) jours, conformément à l'article 19-2 de la loi du 10 juillet 1965, les provisions non encore échues et les sommes restant dues au titre des exercices précédents deviendront immédiatement exigibles et une procédure de recouvrement sera engagée.

Le syndic judiciaire — Cabinet Delaunay`,
    }

  if (libelle.includes('reddition'))
    return {
      objet: 'Reddition de comptes',
      dest: 'Conseil syndical & copropriétaires — ' + nom,
      sendLabel: 'Transmettre la reddition',
      body: `Reddition de comptes — copropriété ${nom}.

Budget prévisionnel : ${formatEuros(copro.budget || 0)}
Dépenses engagées : ${formatEuros(copro.depense || 0)}
Impayés : ${formatEuros(copro.impayes || 0)}
Fonds de travaux : ${formatEuros(copro.fondsTravaux || 0)}

Les annexes 1 à 5 (décret du 14 mars 2005) sont établies depuis le compte bancaire séparé et jointes.`,
    }

  if ((libelle.includes('rapport') && (libelle.includes('tribunal') || libelle.includes('juge'))) || libelle.includes('semestriel'))
    return {
      objet: 'Rapport au tribunal',
      dest: copro.tribunal || 'Tribunal judiciaire',
      sendLabel: 'Déposer au tribunal',
      body: `À l'attention du juge,

Rapport sur l'exécution de la mission de syndic judiciaire — copropriété ${nom} (RG ${copro.rg || ''}).

Prise de fonction effectuée, compte séparé ouvert, situation financière en cours de redressement (impayés ${formatEuros(copro.impayes || 0)}). Prochaines diligences : recouvrement et convocation de l'assemblée élective.

Le syndic judiciaire — Cabinet Delaunay`,
    }

  if (libelle.includes('plan') && libelle.includes('apurement'))
    return {
      objet: "Plan d'apurement (18 mois)",
      dest: 'Conseil syndical — ' + nom,
      sendLabel: 'Soumettre le plan',
      body: `Plan d'apurement de la dette de la copropriété ${nom} sur 18 mois.

Échéancier mensuel négocié avec les fournisseurs et présenté au conseil syndical pour avis avant l'assemblée générale.`,
    }

  if (libelle.includes('compte') && libelle.includes('séparé'))
    return {
      objet: 'Ouverture du compte bancaire séparé',
      dest: 'Établissement bancaire',
      sendLabel: "Confirmer l'ouverture",
      body: `Ouverture d'un compte bancaire séparé au nom du syndicat des copropriétaires de ${nom} (art. 18 loi 1965), sans confusion avec les fonds du cabinet. RIB transmis au conseil syndical.`,
    }

  if (libelle.includes('devis'))
    return {
      objet: 'Validation de devis',
      dest: 'Prestataire',
      sendLabel: 'Valider le devis',
      body: `Validation du devis pour les travaux de la copropriété ${nom}. Montant et conditions vérifiés ; bon pour accord sous réserve de la couverture d'assurance.`,
    }

  if (libelle.includes('assurance'))
    return {
      objet: "Vérification des contrats d'assurance",
      dest: 'Assureur',
      sendLabel: "Demander l'attestation",
      body: `Vérification de la couverture d'assurance de ${nom} : responsabilité civile obligatoire (art. 9-1 ALUR) et multirisque immeuble. Garanties et échéances contrôlées.`,
    }

  if (libelle.includes('budget'))
    return {
      objet: 'Budget prévisionnel',
      dest: 'Conseil syndical — ' + nom,
      sendLabel: 'Soumettre le budget',
      body: `Préparation du budget prévisionnel de ${nom} pour le prochain exercice, sur la base des charges réelles constatées.`,
    }

  if (libelle.includes('audit') || libelle.includes('diagnostic'))
    return {
      objet: 'Diagnostic financier',
      dest: 'Conseil syndical — ' + nom,
      sendLabel: 'Partager le diagnostic',
      body: `Diagnostic financier de ${nom} : état de la dette, des impayés (${formatEuros(copro.impayes || 0)}) et des engagements en cours.`,
    }

  if (
    libelle.includes('carnet') ||
    libelle.includes('visite') ||
    libelle.includes('état des lieux') ||
    libelle.includes('etat des lieux')
  )
    return {
      objet: "Carnet d'entretien / état des lieux",
      dest: 'Dossier interne',
      sendLabel: 'Archiver',
      body: `Mise à jour du carnet d'entretien de ${nom} et relevé de l'état des parties communes.`,
    }

  return {
    objet: libelleEtape,
    dest: nom,
    sendLabel: 'Envoyer',
    body: `Note de diligence — ${libelleEtape} (copropriété ${nom}).`,
  }
}
