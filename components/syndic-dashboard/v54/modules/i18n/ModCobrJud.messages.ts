import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Étapes de la procédure (codes de la table syndic_recouvrement, inchangés dans les deux langues). */
export type EtapeRecouvrement = 'amiable' | 'mise_en_demeure' | 'huissier' | 'tribunal' | 'saisie' | 'accord_paiement'

/** Statuts d'un dossier (codes de l'API). */
type StatutDossier = 'en_cours' | 'suspendu' | 'cloture_succes' | 'cloture_echec'

/**
 * Textes de l'écran « Cobrança Judicial » (Lei 8/2022) / « Recouvrement judiciaire »
 * (loi du 10 juillet 1965 : art. 19, 19-1, 19-2 ; décret du 17 mars 1967 : art. 55).
 */
interface CobrJudTextes {
  titre: string
  chapeau: string
  nouveau: string
  cadre: { titre: string; texte: string }
  onglets: { pipe: string; proc: string; mod: string; leg: string }
  kpi: { impayes: string; actifs: string; tribunal: string; recouvre: string }
  panneau: string
  etapes: Record<EtapeRecouvrement, string>
  /** Statuts d'un dossier (codes de l'API) ; repli sur la valeur brute si inconnue. */
  statuts: Record<StatutDossier, string>
  aucun: string
  coproprietaire: string
  echeance: string
  avancer: string
  formulaire: {
    titre: string
    immeuble: string
    choisir: string
    coproprietaire: string
    etape: string
    montant: string
    avocat: string
    nomPlaceholder: string
    echeance: string
    notes: string
    annuler: string
    ouvrir: string
  }
  erreurMontant: string
  toasts: {
    ouvert: string
    erreurOuverture: string
    reessayerPlusTard: string
    ouvertDemo: string
    connexionRequise: string
    avancerDemo: string
    connexionSyndic: string
    avance: string
    erreur: string
  }
}

export const COBR_JUD_MESSAGES = defineMessages<CobrJudTextes>({
  'pt-PT': {
    titre: 'Cobrança Judicial',
    chapeau: 'Gestão automatizada de cobrança de dívidas ao condomínio (Lei portuguesa)',
    nouveau: '+ Novo processo',
    cadre: {
      titre: 'Enquadramento legal — Lei 8/2022',
      texte: 'O administrador deve instaurar ação judicial de cobrança após 90 dias de incumprimento. Faça avançar cada processo pelas etapas legais (amigável → notificação → solicitador → tribunal → penhora).',
    },
    onglets: { pipe: 'Pipeline', proc: 'Processos', mod: 'Modelos', leg: 'Legislação' },
    kpi: { impayes: 'Total em dívida', actifs: 'Processos ativos', tribunal: 'Em tribunal / penhora', recouvre: 'Recuperado' },
    panneau: 'Pipeline de cobrança',
    etapes: {
      amiable: 'Contacto amigável',
      mise_en_demeure: 'Notificação (LRAR)',
      huissier: 'Solicitador / Agente',
      tribunal: 'Injunção / Tribunal',
      saisie: 'Penhora',
      accord_paiement: 'Acordo de pagamento',
    },
    statuts: { en_cours: 'Em curso', suspendu: 'Suspenso', cloture_succes: 'Encerrado (sucesso)', cloture_echec: 'Encerrado (insucesso)' },
    aucun: 'Sem processos',
    coproprietaire: 'Condómino',
    echeance: 'Próx.: ',
    avancer: 'Avançar',
    formulaire: {
      titre: 'Novo processo de cobrança judicial',
      immeuble: 'Edifício',
      choisir: '— escolher —',
      coproprietaire: 'Condómino',
      etape: 'Etapa',
      montant: 'Montante em dívida',
      avocat: 'Advogado / Solicitador',
      nomPlaceholder: 'Nome…',
      echeance: 'Próxima diligência',
      notes: 'Notas',
      annuler: 'Cancelar',
      ouvrir: 'Abrir processo',
    },
    erreurMontant: 'Indique o montante.',
    toasts: {
      ouvert: 'Processo aberto',
      erreurOuverture: 'Erro ao abrir',
      reessayerPlusTard: 'Tente novamente mais tarde',
      ouvertDemo: 'Processo aberto (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
      avancerDemo: 'Avançar (demo)',
      connexionSyndic: 'Conecte-se como síndico',
      avance: 'Procedimento avançado',
      erreur: 'Erro',
    },
  },
  'fr-FR': {
    titre: 'Recouvrement judiciaire',
    chapeau: 'Recouvrement contentieux des charges impayées dues au syndicat des copropriétaires',
    nouveau: '+ Nouveau dossier',
    cadre: {
      titre: 'Cadre légal — loi du 10 juillet 1965',
      texte: "Le syndic agit en recouvrement des charges sans autorisation de l'AG, sauf pour la saisie en vue de la vente d'un lot (art. 55 du décret du 17 mars 1967). Les charges impayées peuvent être réclamées par injonction de payer ; après une mise en demeure restée sans effet pendant 30 jours, les provisions non encore échues deviennent exigibles et le président du tribunal judiciaire, statuant selon la procédure accélérée au fond, condamne le copropriétaire défaillant à les payer (art. 19-2 de la loi). La créance du syndicat est garantie par une hypothèque légale sur le lot (art. 19 et 19-1). Faites avancer chaque dossier étape par étape (relance amiable → mise en demeure → commissaire de justice → tribunal → saisie).",
    },
    onglets: { pipe: 'Suivi des étapes', proc: 'Dossiers', mod: 'Modèles', leg: 'Réglementation' },
    kpi: { impayes: 'Total des impayés', actifs: 'Dossiers actifs', tribunal: 'Au tribunal / en saisie', recouvre: 'Recouvré' },
    panneau: 'Étapes du recouvrement',
    etapes: {
      amiable: 'Relance amiable',
      mise_en_demeure: 'Mise en demeure (LRAR)',
      huissier: 'Commissaire de justice',
      tribunal: 'Injonction de payer / tribunal',
      saisie: 'Saisie',
      accord_paiement: 'Accord de paiement',
    },
    statuts: { en_cours: 'En cours', suspendu: 'Suspendu', cloture_succes: 'Clôturé (recouvré)', cloture_echec: 'Clôturé (échec)' },
    aucun: 'Aucun dossier',
    coproprietaire: 'Copropriétaire',
    echeance: 'Échéance : ',
    avancer: 'Étape suivante',
    formulaire: {
      titre: 'Nouveau dossier de recouvrement judiciaire',
      immeuble: 'Immeuble',
      choisir: '— choisir —',
      coproprietaire: 'Copropriétaire',
      etape: 'Étape',
      montant: 'Montant impayé',
      avocat: 'Avocat / commissaire de justice',
      nomPlaceholder: 'Nom…',
      echeance: 'Prochaine échéance',
      notes: 'Notes',
      annuler: 'Annuler',
      ouvrir: 'Ouvrir le dossier',
    },
    erreurMontant: 'Indiquez le montant.',
    toasts: {
      ouvert: 'Dossier ouvert',
      erreurOuverture: "Erreur lors de l'ouverture du dossier",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      ouvertDemo: 'Dossier ouvert (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
      avancerDemo: 'Étape suivante (démonstration)',
      connexionSyndic: 'Connectez-vous en tant que syndic',
      avance: "Dossier passé à l'étape suivante",
      erreur: 'Erreur',
    },
  },
})
