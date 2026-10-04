import {
  articleFondementDesignation,
  enteteActe,
  qualiteMandataire,
  signatureCabinet,
  type MandatEnteteActe,
} from '@/lib/administrateur-judiciaire/domain/actes/entete-cabinet'
import { regimeDepuisFondement } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Actes express du cockpit (génération d'actes pré-remplis à partir du mandat) : gabarits textuels repris
 * de la maquette au caractère près (indentations de 3 espaces, marqueurs « [À COMPLÉTER] », pointillés).
 */

/** Champs du mandat lus par les actes express (vue copropriété affichable ou copropriété de démonstration). */
export interface MandatActeExpress extends MandatEnteteActe {
  echeance: string
  dureeMois: number
  motif: string
}

/** Acte rédigé : titre de la fenêtre et corps du document. */
export interface ActeRedige {
  title: string
  body: string
}

/** Convocation à l'assemblée générale élective. */
export const acteExpressConvocationAgElective = (mandat: MandatActeExpress): ActeRedige => ({
  title: `Convocation AG élective — ${mandat.nom}`,
  body: `${enteteActe(mandat)}

CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ÉLECTIVE
(art. 17 de la loi n° 65-557 du 10 juillet 1965 ; art. 46 du décret du 17 mars 1967)

Madame, Monsieur,

En qualité de syndic judiciaire de la copropriété, désigné par le ${mandat.tribunal}, nous avons l'honneur de vous convoquer à l'assemblée générale des copropriétaires :

   Date : [À COMPLÉTER], au plus tard le ${mandat.echeance}
   Lieu : [À COMPLÉTER]          Heure : [À COMPLÉTER]

ORDRE DU JOUR
   1. Désignation du syndic (majorité art. 25, subsidiairement art. 25-1, puis 24) ;
   2. Approbation des comptes de la période d'administration judiciaire ;
   3. Quitus de la gestion du syndic judiciaire ;
   4. Budget prévisionnel et cotisation au fonds de travaux (loi ALUR) ;
   5. Questions diverses.

Pièces jointes : comptes, annexes et projets de résolution (art. 11 du décret).

Fait pour valoir ce que de droit.
${signatureCabinet(mandat)}`,
})

/**
 * Notification de l'ordonnance de désignation : art. 62-5 (référé dans les deux mois de la publication) pour
 * le régime art. 29-1, art. 59 (quinze jours de la notification) sinon.
 */
export const acteExpressNotificationOrdonnance = (mandat: MandatActeExpress): ActeRedige => {
  const regimeAp291 = regimeDepuisFondement(mandat.fondement) === 'ap291'
  return {
    title: `Notification d'ordonnance — ${mandat.nom}`,
    body: `${enteteActe(mandat)}

NOTIFICATION DE L'ORDONNANCE DE DÉSIGNATION
(art. ${regimeAp291 ? '62-5' : '59'} du décret du 17 mars 1967, dans le mois du prononcé)

Madame, Monsieur,

Nous vous notifions l'ordonnance rendue le ${mandat.ordonnance} par le ${mandat.tribunal} (RG ${mandat.rg}), désignant le Cabinet Delaunay en qualité ${qualiteMandataire(mandat) === 'Syndic judiciaire' ? 'de syndic judiciaire' : qualiteMandataire(mandat) === 'Administrateur provisoire' ? "d'administrateur provisoire" : 'de mandataire de justice'} de la copropriété, sur le fondement ${articleFondementDesignation(mandat) ? "de l'" + articleFondementDesignation(mandat) : ': ' + mandat.fondement}.

Durée de la mission : ${mandat.dureeMois} mois, échéance au ${mandat.echeance}.
Motif de la désignation : ${mandat.motif}.

${regimeAp291 ? "Conformément à l'article 62-5 du décret du 17 mars 1967, s'agissant d'une ordonnance sur requête, tout intéressé peut en référer au juge qui l'a rendue dans le délai de deux mois à compter de sa publication." : "Conformément à l'article 59 du décret du 17 mars 1967, vous pouvez en référer au président du tribunal judiciaire dans les quinze jours de la présente notification."} Vous pouvez consulter l'ordonnance auprès de notre cabinet.

${signatureCabinet(mandat)}`,
  }
}

/** Mise en demeure de payer (art. 19-2), gabarit à compléter ([MONTANT], [COPROPRIÉTAIRE DÉBITEUR]…). */
export const acteExpressMiseEnDemeure = (mandat: MandatActeExpress): ActeRedige => ({
  title: `Mise en demeure — ${mandat.nom}`,
  body: `${enteteActe(mandat)}

MISE EN DEMEURE DE PAYER
(art. 19-2 de la loi du 10 juillet 1965 · provisions de charges impayées)

Lettre recommandée avec accusé de réception

Madame, Monsieur / [COPROPRIÉTAIRE DÉBITEUR],

Sauf erreur de notre part, votre compte présente un solde débiteur de [MONTANT] € au titre des charges de copropriété, soit : [NATURE ET MONTANT DE CHAQUE PROVISION IMPAYÉE, PAR EXERCICE].

Nous vous mettons en demeure de régler cette somme. Faute de paiement passé un délai de trente (30) jours, les autres provisions non encore échues ainsi que les sommes restant dues au titre des exercices précédents après approbation des comptes deviendront immédiatement exigibles (art. 19-2 de la loi), et le recouvrement sera poursuivi par toutes voies de droit, les frais nécessaires restant à votre charge (art. 10-1 de la loi).

${signatureCabinet(mandat)}`,
})

/** Requête en prorogation de la mission. */
export const acteExpressRequeteProrogation = (mandat: MandatActeExpress): ActeRedige => ({
  title: `Requête en prorogation — ${mandat.nom}`,
  body: `${enteteActe(mandat)}

REQUÊTE EN PROROGATION DE LA MISSION
(art. 29-1 et suivants de la loi du 10 juillet 1965)

À Monsieur / Madame le Président du ${mandat.tribunal},

Le Cabinet Delaunay, syndic judiciaire désigné par ordonnance du ${mandat.ordonnance} (RG ${mandat.rg}), expose :

   • Que la mission, d'une durée de ${mandat.dureeMois} mois, est arrivée / arrive à échéance le ${mandat.echeance} ;
   • Que le rétablissement du fonctionnement normal de la copropriété n'est pas achevé (${mandat.motif}) ;
   • Qu'un rapport intermédiaire de gestion est joint à la présente.

PAR CES MOTIFS, il est demandé au Tribunal de bien vouloir PROROGER la mission pour une durée complémentaire qu'il plaira au Tribunal de fixer.

Sous toutes réserves.
${signatureCabinet(mandat)}`,
})

/** État de frais et honoraires soumis à taxation (lignes pointillées à conserver caractère pour caractère). */
export const acteExpressEtatFrais = (mandat: MandatActeExpress): ActeRedige => ({
  title: `État de frais & honoraires — ${mandat.nom}`,
  body: `${enteteActe(mandat)}

ÉTAT DE FRAIS ET HONORAIRES · SOUMIS À TAXATION
(Code de procédure civile, art. 704 à 718 · juge taxateur : président du tribunal judiciaire)

Mission : ${qualiteMandataire(mandat).toLowerCase()}, ${articleFondementDesignation(mandat) || mandat.fondement}
Période : [DU] au [AU]

   Diligences                                              Montant (€ HT)
   ${'.'.repeat(40)}
   Constitution et étude du dossier ...................... [  ]
   Gestion courante et coordination ..................... [  ]
   Tenue de la comptabilité / compte séparé ............. [  ]
   Convocation et tenue de l'assemblée .................. [  ]
   Recouvrement et contentieux .......................... [  ]
   ${'.'.repeat(40)}
   TOTAL HT ............................................. [  ]
   TVA (le cas échéant) ................................. [  ]
   TOTAL TTC ............................................ [  ]

État soumis à la taxation du Président du ${mandat.tribunal} (RG ${mandat.rg}).
${signatureCabinet(mandat)}`,
})

/**
 * Procès-verbal d'assemblée générale (« L'an 2026 » figé dans le texte). Distinct du générateur de PV
 * de l'écran Rédaction de PV : ne pas fusionner.
 */
export const acteExpressProcesVerbalAg = (mandat: MandatActeExpress): ActeRedige => ({
  title: `Procès-verbal d'AG — ${mandat.nom}`,
  body: `${enteteActe(mandat)}

PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE
(art. 17 du décret du 17 mars 1967)

L'an 2026, le [DATE], les copropriétaires se sont réunis en assemblée générale, sur convocation du syndic judiciaire (Cabinet Delaunay).

Présents / représentés : [   ] copropriétaires · [   ] / 10 000 tantièmes.
Président de séance : [   ]    Scrutateurs : [   ]    Secrétaire : le syndic.

RÉSOLUTIONS
   Rés. 1 · [objet] : adoptée / rejetée à la majorité de l'art. [24/25/26] ;
   Rés. 2 · [objet] : ...

L'ordre du jour étant épuisé, la séance est levée. Le présent PV est notifié dans les délais légaux (art. 42 al. 2 : recours dans les 2 mois de la notification).

${signatureCabinet(mandat)}`,
})

/** Modèle d'acte express : libellé du catalogue, pictogramme, générateur et copropriété proposée par défaut. */
export interface ModeleActeExpress {
  label: string
  /** Nom de pictogramme (composant Icon). */
  icon: string
  fn: (mandat: MandatActeExpress) => ActeRedige
  /** Code de la copropriété de démonstration sélectionnée par défaut. */
  code: string
}

/**
 * Catalogue des actes express. Les clés sont référencées par les actions de démonstration (tpl) et l'ordre
 * d'insertion donne l'ordre d'affichage du cockpit (Object.entries).
 */
export const MODELES_ACTES_EXPRESS = {
  convocation: {
    label: 'Convocation AG élective',
    icon: 'bank',
    fn: acteExpressConvocationAgElective,
    code: 'CV',
  },
  notification: {
    label: "Notification d'ordonnance",
    icon: 'doc',
    fn: acteExpressNotificationOrdonnance,
    code: 'VM',
  },
  misedemeure: {
    label: 'Mise en demeure (impayés)',
    icon: 'alert',
    fn: acteExpressMiseEnDemeure,
    code: 'TL',
  },
  requete: {
    label: 'Requête en prorogation',
    icon: 'scale',
    fn: acteExpressRequeteProrogation,
    code: 'TL',
  },
  etatfrais: {
    label: 'État de frais & honoraires',
    icon: 'coin',
    fn: acteExpressEtatFrais,
    code: 'LM',
  },
  pv: {
    label: "Procès-verbal d'AG",
    icon: 'pencil',
    fn: acteExpressProcesVerbalAg,
    code: 'LM',
  },
} satisfies Record<string, ModeleActeExpress>

export type CleActeExpress = keyof typeof MODELES_ACTES_EXPRESS
