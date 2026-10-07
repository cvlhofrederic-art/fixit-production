import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Textes de l'écran « NPS Pós-Intervenção » / « Satisfaction post-intervention ». */
interface NpsTextes {
  surtitre: string
  titre: string
  chapeau: string
  enregistrerReponse: string
  voirTableauPrestataires: string
  alerte: { titre: string; texte: string }
  kpi: {
    reponses: string
    npsMoyen: string
    promoteurs: string
    detracteurs: string
    passifs: string
    prestataires: string
  }
  onglets: { resp: string; prest: string; tipo: string }
  vide: { titre: string; texte: string; action: string }
  colonnes: {
    prestataire: string
    coproprietaire: string
    intervention: string
    note: string
    commentaire: string
    typeIntervention: string
    reponses: string
    noteMoyenne: string
  }
  /** Note moyenne affichée dans le tableau agrégé (une décimale). */
  moyenne: (n: number) => string
  formulaire: {
    titre: string
    note: string
    notePlaceholder: string
    prestataire: string
    prestatairePlaceholder: string
    coproprietaire: string
    coproprietairePlaceholder: string
    typeIntervention: string
    typeInterventionPlaceholder: string
    intervention: string
    interventionPlaceholder: string
    commentaire: string
    annuler: string
    enregistrer: string
  }
  erreurNote: string
  toastEnregistree: string
  toastNote: (nota: number) => string
}

export const NPS_MESSAGES = defineMessages<NpsTextes>({
  'pt-PT': {
    surtitre: 'OPERACIONAL · NPS PÓS-INTERVENÇÃO',
    titre: 'NPS Pós-Intervenção',
    chapeau: 'Auto-envio 48h após fecho ordem serviço · NPS + comentário · Rating Marketplace · Alfredo agrega insights',
    enregistrerReponse: 'Registar resposta',
    voirTableauPrestataires: 'Ver dashboard prestadores',
    alerte: {
      titre: 'Loop fechado qualidade prestadores',
      texte: 'Cada intervenção fechada dispara um inquérito 48h depois. As respostas alimentam o rating no Marketplace e o Alfredo deteta prestadores em descida de satisfação antes que escalone.',
    },
    kpi: {
      reponses: 'Respostas recebidas',
      npsMoyen: 'NPS médio',
      promoteurs: 'Promotores (9-10)',
      detracteurs: 'Detratores (0-6)',
      passifs: 'Passivos (7-8)',
      prestataires: 'Prestadores avaliados',
    },
    onglets: { resp: 'Respostas recentes', prest: 'Por prestador', tipo: 'Por tipo intervenção' },
    vide: {
      titre: 'Nenhum inquérito enviado ainda',
      texte: 'Quando uma ordem de serviço for marcada como Concluída, um inquérito (1 pergunta NPS + 1 comentário) é enviado automaticamente 48 horas depois ao condómino que abriu.',
      action: 'Registar primeira resposta',
    },
    colonnes: {
      prestataire: 'Prestador',
      coproprietaire: 'Condómino',
      intervention: 'Intervenção',
      note: 'Nota',
      commentaire: 'Comentário',
      typeIntervention: 'Tipo de intervenção',
      reponses: 'Respostas',
      noteMoyenne: 'Nota média',
    },
    moyenne: (n) => n.toFixed(1),
    formulaire: {
      titre: 'Registar resposta NPS',
      note: 'Nota (0-10)',
      notePlaceholder: '0-10',
      prestataire: 'Prestador',
      prestatairePlaceholder: 'Empresa / técnico',
      coproprietaire: 'Condómino',
      coproprietairePlaceholder: 'Nome · Fração',
      typeIntervention: 'Tipo de intervenção',
      typeInterventionPlaceholder: 'Canalização, elétrica…',
      intervention: 'Intervenção',
      interventionPlaceholder: 'Descrição da ordem de serviço',
      commentaire: 'Comentário',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurNote: 'Nota entre 0 e 10.',
    toastEnregistree: 'Resposta NPS registada',
    toastNote: (nota) => `Nota ${nota}/10`,
  },
  'fr-FR': {
    surtitre: 'OPÉRATIONNEL · SATISFACTION POST-INTERVENTION',
    titre: 'Satisfaction post-intervention (NPS)',
    chapeau: "Envoi automatique 48 h après la clôture de l'ordre de service · NPS + commentaire · Note sur la Marketplace · Alfredo synthétise les retours",
    enregistrerReponse: 'Enregistrer une réponse',
    voirTableauPrestataires: 'Voir le tableau de bord des prestataires',
    alerte: {
      titre: 'Boucle qualité des prestataires',
      texte: "Chaque intervention clôturée déclenche une enquête 48 h plus tard. Les réponses alimentent la note des prestataires sur la Marketplace, et Alfredo repère ceux dont la satisfaction baisse avant que la situation ne s'aggrave.",
    },
    kpi: {
      reponses: 'Réponses reçues',
      npsMoyen: 'NPS moyen',
      promoteurs: 'Promoteurs (9-10)',
      detracteurs: 'Détracteurs (0-6)',
      passifs: 'Passifs (7-8)',
      prestataires: 'Prestataires évalués',
    },
    onglets: { resp: 'Réponses récentes', prest: 'Par prestataire', tipo: "Par type d'intervention" },
    vide: {
      titre: "Aucune enquête envoyée pour l'instant",
      texte: "Lorsqu'un ordre de service passe au statut « Terminé », une enquête (1 question NPS + 1 commentaire) est envoyée automatiquement 48 heures plus tard au copropriétaire à l'origine de la demande.",
      action: 'Enregistrer une première réponse',
    },
    colonnes: {
      prestataire: 'Prestataire',
      coproprietaire: 'Copropriétaire',
      intervention: 'Intervention',
      note: 'Note',
      commentaire: 'Commentaire',
      typeIntervention: "Type d'intervention",
      reponses: 'Réponses',
      noteMoyenne: 'Note moyenne',
    },
    moyenne: (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    formulaire: {
      titre: 'Enregistrer une réponse NPS',
      note: 'Note (0-10)',
      notePlaceholder: '0-10',
      prestataire: 'Prestataire',
      prestatairePlaceholder: 'Entreprise / technicien',
      coproprietaire: 'Copropriétaire',
      coproprietairePlaceholder: 'Nom · Lot',
      typeIntervention: "Type d'intervention",
      typeInterventionPlaceholder: 'Plomberie, électricité…',
      intervention: 'Intervention',
      interventionPlaceholder: "Description de l'ordre de service",
      commentaire: 'Commentaire',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurNote: 'La note doit être comprise entre 0 et 10.',
    toastEnregistree: 'Réponse NPS enregistrée',
    toastNote: (nota) => `Note : ${nota}/10`,
  },
})
