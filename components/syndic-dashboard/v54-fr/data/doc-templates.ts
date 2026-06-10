// Générateur d'actes du mandat judiciaire — port byte-exact du mockup v8.
// 6 modèles fusionnant les données de l'ordonnance (copropriété, tribunal, RG,
// dates, fondement). Consommés par DocModal + cockpit (tâches kind 'doc').

import type { IconName } from '@/lib/syndic/icon-names'
import type { Copro } from './mock'

export interface GeneratedDoc {
  title: string
  body: string
}

export const SIG =
  'Cabinet Delaunay — Syndic judiciaire\n(auxiliaire de justice — art. 18 à 18-2 de la loi du 10 juillet 1965)'

export const head = (c: Copro): string =>
  `CABINET DELAUNAY — Syndic judiciaire\nDésigné par le ${c.tribunal} · Ordonnance du ${c.ordonnance} (RG ${c.rg})\nCopropriété : ${c.nom} — ${c.adresse}\n${'—'.repeat(58)}`

export const tConvocation = (c: Copro): GeneratedDoc => ({
  title: `Convocation AG élective — ${c.nom}`,
  body: `${head(c)}

CONVOCATION À L'ASSEMBLÉE GÉNÉRALE ÉLECTIVE
(art. 17 de la loi n° 65-557 du 10 juillet 1965 ; art. 46 du décret du 17 mars 1967)

Madame, Monsieur,

En qualité de syndic judiciaire de la copropriété, désigné par le ${c.tribunal}, nous avons l'honneur de vous convoquer à l'assemblée générale des copropriétaires :

   Date : [À COMPLÉTER]  —  au plus tard le ${c.echeance}
   Lieu : [À COMPLÉTER]          Heure : [À COMPLÉTER]

ORDRE DU JOUR
   1. Désignation du syndic (majorité art. 25, subsidiairement art. 25-1, puis 24) ;
   2. Approbation des comptes de la période d'administration judiciaire ;
   3. Quitus de la gestion du syndic judiciaire ;
   4. Budget prévisionnel et cotisation au fonds de travaux (loi ALUR) ;
   5. Questions diverses.

Pièces jointes : comptes, annexes et projets de résolution (art. 11 du décret).

Fait pour valoir ce que de droit.
${SIG}`,
})

export const tNotification = (c: Copro): GeneratedDoc => ({
  title: `Notification d'ordonnance — ${c.nom}`,
  body: `${head(c)}

NOTIFICATION DE L'ORDONNANCE DE DÉSIGNATION
(art. 64 du décret du 17 mars 1967 — dans le mois du prononcé)

Madame, Monsieur,

Nous vous notifions l'ordonnance rendue le ${c.ordonnance} par le ${c.tribunal} (RG ${c.rg}), désignant le Cabinet Delaunay en qualité de syndic judiciaire de la copropriété, sur le fondement : ${c.fondement}.

Durée de la mission : ${c.dureeMois} mois — échéance au ${c.echeance}.
Motif de la désignation : ${c.motif}.

La présente notification ouvre, le cas échéant, les voies de recours prévues par les textes. Vous pouvez consulter l'ordonnance auprès de notre cabinet.

${SIG}`,
})

export const tMiseDemeure = (c: Copro): GeneratedDoc => ({
  title: `Mise en demeure — ${c.nom}`,
  body: `${head(c)}

MISE EN DEMEURE DE PAYER
(art. 19 de la loi du 10 juillet 1965 — charges de copropriété impayées)

Lettre recommandée avec accusé de réception

Madame, Monsieur / [COPROPRIÉTAIRE DÉBITEUR],

Sauf erreur de notre part, votre compte présente un solde débiteur de [MONTANT] € au titre des charges de copropriété (appels échus et non réglés).

Nous vous mettons en demeure de régler cette somme sous TRENTE (30) JOURS à compter de la réception des présentes. À défaut, et conformément aux pouvoirs du syndic judiciaire, le recouvrement sera poursuivi par toutes voies de droit, les frais restant à votre charge (art. 10-1 de la loi).

${SIG}`,
})

export const tRequete = (c: Copro): GeneratedDoc => ({
  title: `Requête en prorogation — ${c.nom}`,
  body: `${head(c)}

REQUÊTE EN PROROGATION DE LA MISSION
(art. 29-1 et suivants de la loi du 10 juillet 1965)

À Monsieur / Madame le Président du ${c.tribunal},

Le Cabinet Delaunay, syndic judiciaire désigné par ordonnance du ${c.ordonnance} (RG ${c.rg}), expose :

   • Que la mission, d'une durée de ${c.dureeMois} mois, est arrivée / arrive à échéance le ${c.echeance} ;
   • Que le rétablissement du fonctionnement normal de la copropriété n'est pas achevé (${c.motif}) ;
   • Qu'un rapport intermédiaire de gestion est joint à la présente.

PAR CES MOTIFS, il est demandé au Tribunal de bien vouloir PROROGER la mission pour une durée complémentaire qu'il plaira au Tribunal de fixer.

Sous toutes réserves.
${SIG}`,
})

export const tEtatFrais = (c: Copro): GeneratedDoc => ({
  title: `État de frais & honoraires — ${c.nom}`,
  body: `${head(c)}

ÉTAT DE FRAIS ET HONORAIRES — SOUMIS À TAXATION
(Code de procédure civile, art. 704 à 718 — juge taxateur : Président du TJ)

Mission : syndic judiciaire — ${c.fondement}
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

État soumis à la taxation du Président du ${c.tribunal} (RG ${c.rg}).
${SIG}`,
})

export const tPV = (c: Copro): GeneratedDoc => ({
  title: `Procès-verbal d'AG — ${c.nom}`,
  body: `${head(c)}

PROCÈS-VERBAL DE L'ASSEMBLÉE GÉNÉRALE
(art. 17 du décret du 17 mars 1967)

L'an 2026, le [DATE], les copropriétaires se sont réunis en assemblée générale, sur convocation du syndic judiciaire (Cabinet Delaunay).

Présents / représentés : [   ] copropriétaires — [   ] / 10 000 tantièmes.
Président de séance : [   ]    Scrutateurs : [   ]    Secrétaire : le syndic.

RÉSOLUTIONS
   Rés. 1 — [objet] : adoptée / rejetée à la majorité de l'art. [24/25/26] ;
   Rés. 2 — [objet] : ...

L'ordre du jour étant épuisé, la séance est levée. Le présent PV est notifié dans les délais légaux (art. 42 al. 2 : recours dans les 2 mois de la notification).

${SIG}`,
})

export type DocTemplateKey = 'convocation' | 'notification' | 'misedemeure' | 'requete' | 'etatfrais' | 'pv'

export interface DocTemplate {
  label: string
  icon: IconName
  fn: (c: Copro) => GeneratedDoc
  /** Code de copropriété présélectionné dans DocModal. */
  code: string
}

export const DOC_TEMPLATES: Record<DocTemplateKey, DocTemplate> = {
  convocation: { label: 'Convocation AG élective', icon: 'bank', fn: tConvocation, code: 'CV' },
  notification: { label: "Notification d'ordonnance", icon: 'doc', fn: tNotification, code: 'VM' },
  misedemeure: { label: 'Mise en demeure (impayés)', icon: 'alert', fn: tMiseDemeure, code: 'TL' },
  requete: { label: 'Requête en prorogation', icon: 'scale', fn: tRequete, code: 'TL' },
  etatfrais: { label: 'État de frais & honoraires', icon: 'coin', fn: tEtatFrais, code: 'LM' },
  pv: { label: "Procès-verbal d'AG", icon: 'pencil', fn: tPV, code: 'LM' },
}
