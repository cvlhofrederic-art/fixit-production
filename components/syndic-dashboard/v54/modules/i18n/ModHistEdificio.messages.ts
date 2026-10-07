import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { PillKind } from '../../primitives/pill'

/**
 * Textes de l'écran « Histórico Edifício » / « Historique de l'immeuble ».
 * FR : vue proche du carnet d'entretien tenu par le syndic (loi n° 65-557 art. 18,
 * décret n° 2001-477) ; contrôle technique des ascenseurs tous les cinq ans
 * (CCH art. R134-11).
 */

/** [date, intervention, prestataire, coût] */
export type InterventionDemo = [string, string, string, string]
/** [équipement, état technique, conformité, prochaine action, pill] */
export type EquipementDemo = [string, string, string, string, PillKind]
/** [contrat, prestataire, montant, validité, pill] */
export type ContratDemo = [string, string, string, string, PillKind]

interface HistEdificioTextes {
  titre: string
  chapeau: string
  aucunImmeuble: string
  ongletsDemo: { aurora: string; belavista: string; cedofeita: string }
  kpi: { interventions: string; equipements: string; contratsActifs: string; coutCumule: string; coutCumuleDemo: string }
  interventions: {
    titre: string
    colonnes: { date: string; intervention: string; prestataire: string; cout: string; statut: string }
    vide: string
    parDefaut: string
    termineeDemo: string
  }
  equipements: {
    titre: string
    colonnes: { equipement: string; etatTechnique: string; conformite: string; prochaineAction: string }
    vide: string
    parDefaut: string
    derniereInspection: (date: string) => string
    prochaine: (date: string) => string
  }
  contrats: {
    titre: string
    colonnes: { contrat: string; prestataire: string; montant: string; validite: string }
    vide: string
    parAn: (montant: string) => string
    parMois: (montant: string) => string
    jusquau: (date: string) => string
    /** Statut de contrat brut de l'API (affiché si aucune date de fin). */
    statut: (code: string) => string
  }
  statutsMission: Record<string, string>
  conformiteEquipement: Record<string, string>
  categoriesContrat: Record<string, string>
  demo: { interventions: InterventionDemo[]; equipements: EquipementDemo[]; contrats: ContratDemo[] }
}

export const HIST_EDIFICIO_MESSAGES = defineMessages<HistEdificioTextes>({
  'pt-PT': {
    titre: 'Histórico Edifício',
    chapeau: 'Vista consolidada por edifício — intervenções, equipamentos, contratos',
    aucunImmeuble: 'Nenhum edifício',
    ongletsDemo: { aurora: 'Edifício Aurora', belavista: 'Edifício Bela Vista', cedofeita: 'Residencial Cedofeita' },
    kpi: {
      interventions: 'Intervenções totais',
      equipements: 'Equipamentos',
      contratsActifs: 'Contratos ativos',
      coutCumule: 'Custo acumulado 2026',
      coutCumuleDemo: '€ 18 240',
    },
    interventions: {
      titre: 'Intervenções recentes',
      colonnes: { date: 'Data', intervention: 'Intervenção', prestataire: 'Profissional', cout: 'Custo', statut: 'Estado' },
      vide: 'Nenhuma intervenção para este edifício.',
      parDefaut: 'Intervenção',
      termineeDemo: 'Concluída',
    },
    equipements: {
      titre: 'Equipamentos',
      colonnes: { equipement: 'Equipamento', etatTechnique: 'Estado técnico', conformite: 'Conformidade', prochaineAction: 'Próxima ação' },
      vide: 'Nenhum equipamento registado.',
      parDefaut: 'Elevador',
      derniereInspection: (date) => `Última inspeção ${date}`,
      prochaine: (date) => `Próxima: ${date}`,
    },
    contrats: {
      titre: 'Contratos',
      colonnes: { contrat: 'Contrato', prestataire: 'Prestador', montant: 'Valor', validite: 'Vigência' },
      vide: 'Nenhum contrato para este edifício.',
      parAn: (montant) => `${montant} / ano`,
      parMois: (montant) => `${montant} / mês`,
      jusquau: (date) => `Até ${date}`,
      statut: (code) => code,
    },
    statutsMission: { en_attente: 'Em espera', acceptee: 'Aceite', en_cours: 'Em curso', terminee: 'Concluída', annulee: 'Anulada' },
    conformiteEquipement: { conforme: 'Conforme', prazo: 'A regularizar', atraso: 'Não conforme' },
    categoriesContrat: { limpezas: 'Limpeza de áreas comuns', elevadores: 'Manutenção de elevadores', seguranca: 'Segurança', jardinagem: 'Jardinagem', outros: 'Outros serviços' },
    demo: {
      interventions: [
        ['12/05/2026', 'Reparação canalização garagem', 'HidroPro Lda', '€ 480'],
        ['28/04/2026', 'Manutenção elevador anual', 'ElevaTech', '€ 1 250'],
        ['15/03/2026', 'Pintura do hall de entrada', 'ConstruFix', '€ 2 100'],
        ['02/02/2026', 'Substituição bomba de água', 'HidroPro Lda', '€ 890'],
      ],
      equipements: [
        ['Elevador OTIS A', 'Última inspeção 28/04/2026', 'Conforme', 'Próxima: 04/2028', 'sage'],
        ['Central AVAC', 'Última inspeção 10/01/2026', 'Conforme', 'Próxima: 01/2027', 'sage'],
        ['Bomba de pressurização', 'Substituída 02/02/2026', 'Operacional', '—', 'sage'],
        ['Portão automático', 'Manutenção pendente', 'A agendar', 'Atraso 12 dias', 'amber'],
      ],
      contrats: [
        ['Manutenção de elevadores', 'ElevaTech', '€ 1 250 / ano', 'Ativo até 12/2027', 'sage'],
        ['Limpeza de áreas comuns', 'CleanPro', '€ 380 / mês', 'Renovação 06/2026', 'amber'],
        ['Seguro multirriscos', 'Fidelidade', '€ 2 400 / ano', 'Ativo até 03/2027', 'sage'],
      ],
    },
  },
  'fr-FR': {
    titre: "Historique de l'immeuble",
    chapeau: 'Vue consolidée par immeuble — interventions, équipements, contrats',
    aucunImmeuble: 'Aucun immeuble',
    ongletsDemo: { aurora: 'Résidence Aurore', belavista: 'Résidence Belle Vue', cedofeita: 'Résidence Croix-Rousse' },
    kpi: {
      interventions: 'Interventions au total',
      equipements: 'Équipements',
      contratsActifs: 'Contrats actifs',
      coutCumule: 'Coût cumulé 2026',
      coutCumuleDemo: '18 240 €',
    },
    interventions: {
      titre: 'Interventions récentes',
      colonnes: { date: 'Date', intervention: 'Intervention', prestataire: 'Prestataire', cout: 'Coût', statut: 'Statut' },
      vide: 'Aucune intervention pour cet immeuble.',
      parDefaut: 'Intervention',
      termineeDemo: 'Terminée',
    },
    equipements: {
      titre: 'Équipements',
      colonnes: { equipement: 'Équipement', etatTechnique: 'État technique', conformite: 'Conformité', prochaineAction: 'Prochaine action' },
      vide: 'Aucun équipement enregistré.',
      parDefaut: 'Ascenseur',
      derniereInspection: (date) => `Dernier contrôle : ${date}`,
      prochaine: (date) => `Prochain contrôle : ${date}`,
    },
    contrats: {
      titre: 'Contrats',
      colonnes: { contrat: 'Contrat', prestataire: 'Prestataire', montant: 'Montant', validite: 'Validité' },
      vide: 'Aucun contrat pour cet immeuble.',
      parAn: (montant) => `${montant} / an`,
      parMois: (montant) => `${montant} / mois`,
      jusquau: (date) => `Jusqu'au ${date}`,
      statut: (code) => ({ ativo: 'Actif', renovacao: 'À renouveler', expirado: 'Expiré' } as Record<string, string>)[code] ?? code,
    },
    statutsMission: { en_attente: 'En attente', acceptee: 'Acceptée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' },
    conformiteEquipement: { conforme: 'Conforme', prazo: 'À régulariser', atraso: 'Non conforme' },
    categoriesContrat: { limpezas: 'Nettoyage des parties communes', elevadores: 'Entretien des ascenseurs', seguranca: 'Sécurité', jardinagem: 'Espaces verts', outros: 'Autres prestations' },
    demo: {
      interventions: [
        ['12/05/2026', 'Réparation de canalisation au parking', 'HydroPro SARL', '480 €'],
        ['28/04/2026', "Entretien annuel de l'ascenseur", 'ElevaTech', '1 250 €'],
        ['15/03/2026', "Peinture du hall d'entrée", 'ConstruFix SARL', '2 100 €'],
        ['02/02/2026', 'Remplacement de la pompe à eau', 'HydroPro SARL', '890 €'],
      ],
      equipements: [
        ['Ascenseur OTIS A', 'Dernier contrôle : 28/04/2026', 'Conforme', 'Prochain contrôle : 04/2031', 'sage'],
        ['Installation CVC', 'Dernier contrôle : 10/01/2026', 'Conforme', 'Prochain contrôle : 01/2027', 'sage'],
        ['Surpresseur', 'Remplacé le 02/02/2026', 'Opérationnel', '—', 'sage'],
        ['Portail automatique', 'Entretien en attente', 'À planifier', '12 jours de retard', 'amber'],
      ],
      contrats: [
        ['Entretien des ascenseurs', 'ElevaTech', '1 250 € / an', "En vigueur jusqu'en 12/2027", 'sage'],
        ['Nettoyage des parties communes', 'Nettoyage Rhône SARL', '380 € / mois', 'Renouvellement 06/2026', 'amber'],
        ['Assurance multirisque immeuble', 'Mutuelle Rhodanienne', '2 400 € / an', "En vigueur jusqu'en 03/2027", 'sage'],
      ],
    },
  },
})
