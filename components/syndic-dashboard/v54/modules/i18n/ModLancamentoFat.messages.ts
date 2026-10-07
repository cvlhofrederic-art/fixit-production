import { defineMessages } from '@/lib/syndic/v54/i18n'

interface LancamentoFatTextes {
  titre: string
  chapeau: string
  kpi: { total: string; attente: string; validees: string; anomalies: string }
  onglets: { imp: string; esp: string; trat: string; an: string; cfg: string }
  depot: { titre: string; formats: string }
  parcourir: string
  parcourirEnCours: string
}

export const LANCAMENTO_FAT_MESSAGES = defineMessages<LancamentoFatTextes>({
  'pt-PT': {
    titre: 'Lançamento IA de Faturas',
    chapeau: 'Importação, extração automática e validação das faturas de fornecedores',
    kpi: { total: 'Total faturas', attente: 'Em espera', validees: 'Validadas', anomalies: 'Anomalias' },
    onglets: { imp: 'Importar faturas', esp: 'Em espera', trat: 'Tratadas', an: 'Anomalias', cfg: 'Configuração' },
    depot: { titre: 'Arraste e largue as suas faturas aqui', formats: 'Formatos aceites: PDF, JPG, PNG — Importação em lote suportada' },
    parcourir: 'Procurar ficheiros',
    parcourirEnCours: 'Pesquisa de ficheiros em desenvolvimento',
  },
  'fr-FR': {
    titre: 'Saisie IA des factures',
    chapeau: 'Import, extraction automatique et validation des factures fournisseurs',
    kpi: { total: 'Total des factures', attente: 'En attente', validees: 'Validées', anomalies: 'Anomalies' },
    onglets: { imp: 'Importer des factures', esp: 'En attente', trat: 'Traitées', an: 'Anomalies', cfg: 'Configuration' },
    depot: { titre: 'Glissez-déposez vos factures ici', formats: 'Formats acceptés : PDF, JPG, PNG — import par lots possible' },
    parcourir: 'Parcourir les fichiers',
    parcourirEnCours: 'Sélection de fichiers en cours de développement',
  },
})
