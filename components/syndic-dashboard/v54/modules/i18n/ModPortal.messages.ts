import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Teinte d'un avis (liseré gauche et pastille). */
export type TeinteAvis = 'amber' | 'sage' | 'rust' | 'gold'

/** Avis récent de démonstration : titre, extrait, date, catégorie, teinte. */
export interface AvisPortail {
  titre: string
  extrait: string
  date: string
  categorie: string
  teinte: TeinteAvis
}

interface PortalTextes {
  titre: string
  chapeau: string
  onglets: { vg: string; cc: string; dc: string; cm: string; pd: string }
  kpi: {
    solde: string
    aJour: string
    prochainAppel: string
    echeance: string
    dernierPaiement: string
    dateDernierPaiement: string
    lot: string
    etage: string
    tantiemes: string
  }
  actionsTitre: string
  /** Libellés des actions rapides (reçus, attestation fiscale, incident, contact) ; le libellé sert aussi de titre au toast. */
  actions: { recus: string; attestation: string; incident: string; contact: string }
  avisTitre: string
  avis: AvisPortail[]
}

export const PORTAL_MESSAGES = defineMessages<PortalTextes>({
  'pt-PT': {
    titre: 'Portal do Condómino',
    chapeau: 'Vista única do condómino: conta, documentos, comunicações, pedidos',
    onglets: { vg: 'Visão Geral', cc: 'Conta Corrente', dc: 'Documentos', cm: 'Comunicações', pd: 'Pedidos' },
    kpi: {
      solde: 'Saldo devedor',
      aJour: 'Em dia',
      prochainAppel: 'Próxima quota',
      echeance: 'Vencimento: 1 Abril 2026',
      dernierPaiement: 'Último pagamento',
      dateDernierPaiement: '01 de março de 2026',
      lot: 'Fração B',
      etage: '2.° Direito',
      tantiemes: 'Permilagem: 55/1000',
    },
    actionsTitre: 'Ações rápidas',
    actions: { recus: 'Ver recibos', attestation: 'Declaração para IRS', incident: 'Reportar avaria', contact: 'Contactar administração' },
    avisTitre: 'Avisos recentes',
    avis: [
      { titre: 'Obras na fachada - Início previsto', extrait: 'Informamos que as obras de reabilitação da fachada principal terão início no dia 20 de Março', date: '10/03/2026', categorie: 'Manutenção', teinte: 'amber' },
      { titre: 'Assembleia Geral Ordinária', extrait: 'Convocamos todos os condóminos para a Assembleia Geral Ordinária que decorrerá no dia 15 de Abril às 19h00', date: '08/03/2026', categorie: 'Info', teinte: 'sage' },
      { titre: 'Corte de água programado', extrait: 'No dia 25 de Março, entre as 9h e as 13h, haverá corte de água para reparação no sistema de canalização do piso 0', date: '05/03/2026', categorie: 'Urgente', teinte: 'rust' },
      { titre: 'Orçamento aprovado - Elevador', extrait: 'Foi aprovado em AG o orçamento para modernização do elevador no valor de 12.500 EUR. Os trabalhos iniciam em Maio', date: '01/03/2026', categorie: 'Financeiro', teinte: 'gold' },
      { titre: 'Limpeza partes comuns', extrait: 'Informamos que a nova empresa de limpeza iniciará funções a partir de 1 de Abril. Horário: 2.ª a 6.ª, das 8h às 10h', date: '28/02/2026', categorie: 'Info', teinte: 'sage' },
    ],
  },
  'fr-FR': {
    titre: 'Espace copropriétaire',
    chapeau: 'Compte, documents, communications et demandes du copropriétaire réunis dans un espace en ligne sécurisé (décret n° 2019-502 du 23 mai 2019)',
    onglets: { vg: "Vue d'ensemble", cc: 'Compte copropriétaire', dc: 'Documents', cm: 'Communications', pd: 'Demandes' },
    kpi: {
      solde: 'Solde débiteur',
      aJour: 'À jour',
      prochainAppel: 'Prochain appel de provisions',
      echeance: 'Échéance : 1er avril 2026',
      dernierPaiement: 'Dernier paiement',
      dateDernierPaiement: '1er mars 2026',
      lot: 'Lot 12',
      etage: '2e étage droite',
      tantiemes: 'Tantièmes : 550/10000',
    },
    actionsTitre: 'Actions rapides',
    actions: { recus: 'Voir les reçus', attestation: 'Relevé de charges (revenus fonciers)', incident: 'Signaler un incident', contact: 'Contacter le syndic' },
    avisTitre: 'Avis récents',
    avis: [
      { titre: 'Ravalement de façade — début prévu', extrait: 'Nous vous informons que les travaux de ravalement de la façade principale débuteront le 20 mars', date: '10/03/2026', categorie: 'Entretien', teinte: 'amber' },
      { titre: 'Assemblée générale ordinaire', extrait: "L'assemblée générale ordinaire se tiendra le 15 avril à 19 h ; la convocation est adressée à chaque copropriétaire par lettre recommandée ou par voie électronique", date: '08/03/2026', categorie: 'Info', teinte: 'sage' },
      { titre: "Coupure d'eau programmée", extrait: "Le 25 mars, de 9 h à 13 h, l'eau sera coupée pour une réparation sur les canalisations du rez-de-chaussée", date: '05/03/2026', categorie: 'Urgent', teinte: 'rust' },
      { titre: 'Devis voté — ascenseur', extrait: "L'assemblée générale a voté le devis de modernisation de l'ascenseur, d'un montant de 12 500 €. Les travaux débuteront en mai", date: '01/03/2026', categorie: 'Finances', teinte: 'gold' },
      { titre: 'Nettoyage des parties communes', extrait: "La nouvelle entreprise de nettoyage interviendra à partir du 1er avril, du lundi au vendredi, de 8 h à 10 h", date: '28/02/2026', categorie: 'Info', teinte: 'sage' },
    ],
  },
})
