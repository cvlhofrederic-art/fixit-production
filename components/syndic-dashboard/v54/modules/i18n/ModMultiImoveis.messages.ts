import { defineMessages } from '@/lib/syndic/v54/i18n'

interface MultiImoveisTextes {
  titre: string
  chapeau: string
  erreur: { titre: string; desc: string }
  kpi: { immeubles: string; lots: string; budget: string; depensesBudget: string }
  portefeuille: string
  vide: { titre: string; desc: string }
  colonnes: { immeuble: string; ville: string; lots: string; budget: string; depenses: string; utilisation: string }
  /** Pourcentage du KPI global. */
  pct: (n: number) => string
  /** Signe pourcent placé après le nombre dans le tableau (le nombre reste dans le JSX). */
  pourcent: string
}

export const MULTI_IMOVEIS_MESSAGES = defineMessages<MultiImoveisTextes>({
  'pt-PT': {
    titre: 'Multi-Imóveis',
    chapeau: 'Gestão consolidada do seu portefólio',
    erreur: { titre: 'Erro ao carregar imóveis', desc: 'Verifique a sua ligação e tente novamente.' },
    kpi: { immeubles: 'Edifícios', lots: 'Frações totais', budget: 'Orçamento total', depensesBudget: 'Despesas / orçamento' },
    portefeuille: 'Portefólio de edifícios',
    vide: { titre: 'Sem edifícios', desc: 'Adicione edifícios em « Edifícios » para os consolidar aqui.' },
    colonnes: { immeuble: 'Edifício', ville: 'Cidade', lots: 'Frações', budget: 'Orçamento', depenses: 'Despesas', utilisation: 'Uso' },
    pct: (n) => `${n}%`,
    pourcent: '%',
  },
  'fr-FR': {
    titre: 'Multi-copropriétés',
    chapeau: 'Gestion consolidée de votre portefeuille',
    erreur: { titre: 'Erreur de chargement des copropriétés', desc: 'Vérifiez votre connexion et réessayez.' },
    kpi: { immeubles: 'Copropriétés', lots: 'Lots (total)', budget: 'Budget prévisionnel total', depensesBudget: 'Dépenses / budget' },
    portefeuille: 'Portefeuille de copropriétés',
    vide: { titre: 'Aucune copropriété', desc: 'Ajoutez des immeubles dans « Immeubles » pour les consolider ici.' },
    colonnes: { immeuble: 'Copropriété', ville: 'Ville', lots: 'Lots', budget: 'Budget', depenses: 'Dépenses', utilisation: 'Utilisation' },
    pct: (n) => `${n}\u00a0%`,
    pourcent: '\u00a0%',
  },
})
