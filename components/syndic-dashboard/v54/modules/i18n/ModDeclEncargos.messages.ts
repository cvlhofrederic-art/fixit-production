import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Statut d'une déclaration, valeur stockée par l'API (contrainte CHECK de syndic_decl_encargos). */
export type StatutDecl = 'pendente' | 'emitida' | 'concluida'

interface DeclEncargosTextes {
  titre: string
  chapeau: string
  nouvelle: string
  alerteTitre: string
  alerteTexte: string
  kpi: { total: string; pendentes: string; horsDelai: string; concluidas: string }
  onglets: { todas: (n: number) => string; pen: (n: number) => string; em: string; conc: (n: number) => string }
  videTitre: string
  videDesc: string
  colonnes: { lot: string; coproprietaire: string; immeuble: string; demande: string; dateLimite: string; charges: string; statut: string }
  /** Pastille de statut de chaque ligne (clé = valeur API `estado`). */
  statuts: Record<StatutDecl, string>
  formulaire: {
    titre: string
    lot: string
    lotPlaceholder: string
    dateDemande: string
    coproprietaire: string
    coproprietairePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    chargesCourantes: string
    impayes: string
    notes: string
    annuler: string
    enregistrer: string
  }
  erreurs: { lot: string; coproprietaire: string }
  toasts: {
    enregistree: string
    enregistreeDesc: (lot: string) => string
    erreur: string
    reessayerPlusTard: string
    enregistreeDemo: string
    connexionRequise: string
  }
}

export const DECL_ENCARGOS_MESSAGES = defineMessages<DeclEncargosTextes>({
  'pt-PT': {
    titre: 'Declaração de Encargos',
    chapeau: 'Obrigação legal — Lei n.° 8/2022 de 10 de janeiro · Transmissão de frações',
    nouvelle: '+ Nova declaração',
    alerteTitre: 'Obrigação legal — Lei n.° 8/2022 de 10 de janeiro (alteração ao Código Civil)',
    alerteTexte: 'O administrador é obrigado a emitir a declaração de encargos em 10 dias úteis após o pedido. Após a escritura, o novo proprietário deve notificar o administrador no prazo de 15 dias.',
    kpi: { total: 'Total de declarações', pendentes: 'Pendentes', horsDelai: 'Fora do prazo', concluidas: 'Concluídas' },
    onglets: {
      todas: (n) => `Todas (${n})`,
      pen: (n) => `Pendentes (${n})`,
      em: 'Emitidas',
      conc: (n) => `Concluídas (${n})`,
    },
    videTitre: 'Nenhuma declaração registada',
    videDesc: 'Crie uma declaração de encargos quando um condómino solicitar a venda da sua fração.',
    colonnes: { lot: 'Fração', coproprietaire: 'Condómino', immeuble: 'Edifício', demande: 'Pedido', dateLimite: 'Prazo limite', charges: 'Encargos', statut: 'Estado' },
    statuts: { pendente: 'Pendente', emitida: 'Emitida', concluida: 'Concluída' },
    formulaire: {
      titre: 'Nova declaração de encargos',
      lot: 'Fração',
      lotPlaceholder: 'Apt 3.º E',
      dateDemande: 'Data do pedido',
      coproprietaire: 'Condómino',
      coproprietairePlaceholder: 'Nome do proprietário',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Residência…',
      chargesCourantes: 'Encargos correntes',
      impayes: 'Dívidas em atraso',
      notes: 'Notas',
      annuler: 'Cancelar',
      enregistrer: 'Registar',
    },
    erreurs: { lot: 'A fração é obrigatória.', coproprietaire: 'Indique o condómino.' },
    toasts: {
      enregistree: 'Declaração registada',
      enregistreeDesc: (lot) => `Fração ${lot} · prazo legal 10 dias úteis`,
      erreur: 'Erro ao registar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      enregistreeDemo: 'Declaração registada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'État daté — vente de lots',
    chapeau: "Obligation légale — décret n° 67-223 du 17 mars 1967, art. 5 · Pré-état daté (CCH, art. L721-2) · Vente d'un lot",
    nouvelle: '+ Nouvel état daté',
    alerteTitre: 'Obligation légale — art. 5 du décret du 17 mars 1967 et art. L721-2 du CCH',
    alerteTexte: "Avant la vente d'un lot, le syndic adresse au notaire, à sa demande ou à celle du copropriétaire vendeur, un état daté en trois parties : sommes dues par le vendeur au syndicat, sommes dues par le syndicat au vendeur, sommes à la charge de l'acquéreur. Dès la promesse de vente, l'acquéreur reçoit les informations financières prévues par l'article L721-2 du CCH (dites « pré-état daté »). Les honoraires d'état daté, plafonnés par décret, sont à la charge du seul vendeur (loi du 10 juillet 1965, art. 10-1). Après la vente, le transfert de propriété est notifié sans délai au syndic (décret de 1967, art. 6) ; sauf certificat attestant que le vendeur est libre de toute obligation, le notaire lui donne aussi avis de la mutation dans les 15 jours (loi de 1965, art. 20).",
    kpi: { total: 'Total des états datés', pendentes: 'À établir', horsDelai: 'Hors délai', concluidas: 'Clôturés' },
    onglets: {
      todas: (n) => `Tous (${n})`,
      pen: (n) => `À établir (${n})`,
      em: 'Délivrés',
      conc: (n) => `Clôturés (${n})`,
    },
    videTitre: 'Aucun état daté enregistré',
    videDesc: "Créez un état daté lorsque le notaire ou le copropriétaire vendeur vous le demande pour la vente d'un lot.",
    colonnes: { lot: 'Lot', coproprietaire: 'Copropriétaire vendeur', immeuble: 'Immeuble', demande: 'Demande', dateLimite: 'Date limite', charges: 'Charges courantes', statut: 'Statut' },
    statuts: { pendente: 'À établir', emitida: 'Délivré', concluida: 'Clôturé' },
    formulaire: {
      titre: 'Nouvel état daté',
      lot: 'Lot',
      lotPlaceholder: '12 — Apt B3',
      dateDemande: 'Date de la demande',
      coproprietaire: 'Copropriétaire vendeur',
      coproprietairePlaceholder: 'Nom du copropriétaire',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Résidence…',
      chargesCourantes: 'Charges courantes',
      impayes: 'Impayés du vendeur',
      notes: 'Notes',
      annuler: 'Annuler',
      enregistrer: 'Enregistrer',
    },
    erreurs: { lot: 'Le lot est obligatoire.', coproprietaire: 'Indiquez le copropriétaire vendeur.' },
    toasts: {
      enregistree: 'État daté enregistré',
      enregistreeDesc: (lot) => `Lot ${lot} · délai interne de traitement : 10 jours`,
      erreur: "Erreur lors de l'enregistrement",
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      enregistreeDemo: 'État daté enregistré (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
