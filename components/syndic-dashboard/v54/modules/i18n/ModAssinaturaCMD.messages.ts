import { defineMessages } from '@/lib/syndic/v54/i18n'

interface AssinaturaCMDTextes {
  titre: string
  chapeau: string
  noteLegale: string
  kpi: { total: string; enAttente: string; ceMois: string; dernier: string; dernierValeur: string }
  onglets: { ass: string; docs: string; val: string; cfg: string }
  panneau: string
  consigne: string
  nomDocument: string
  nomPlaceholder: string
  typeDocument: string
  typeProcesVerbal: string
  immeuble: string
  choisirImmeuble: string
  depot: string
  formats: string
}

export const ASSINATURA_CMD_MESSAGES = defineMessages<AssinaturaCMDTextes>({
  'pt-PT': {
    titre: 'Assinatura Digital CMD',
    chapeau: 'Chave Móvel Digital — Assinatura qualificada de documentos do condomínio',
    noteLegale: 'Conforme DL 12/2021 (assinatura digital qualificada PT) e Regulamento eIDAS (UE 910/2014). A assinatura via Chave Móvel Digital tem o mesmo valor legal que a assinatura manuscrita.',
    kpi: { total: 'Total Documentos Assinados', enAttente: 'Pendentes', ceMois: 'Este Mês', dernier: 'Último Documento', dernierValeur: '22 de maio de 2026' },
    onglets: { ass: 'Assinar Documento', docs: 'Documentos Assinados', val: 'Validação', cfg: 'Configuração' },
    panneau: 'Assinar Novo Documento',
    consigne: 'Carregue o documento que pretende assinar digitalmente com a Chave Móvel Digital.',
    nomDocument: 'Nome do Documento',
    nomPlaceholder: 'Ex: Ata AG Ordinária - Março 2026',
    typeDocument: 'Tipo de Documento',
    typeProcesVerbal: 'Ata de Assembleia',
    immeuble: 'Edifício',
    choisirImmeuble: '— Selecionar edifício —',
    depot: 'Clique ou arraste o ficheiro aqui',
    formats: 'Formatos suportados: PDF, DOC, DOCX (máx. 10 MB)',
  },
  'fr-FR': {
    titre: 'Signature électronique',
    chapeau: 'Signature électronique qualifiée (eIDAS) des documents de la copropriété',
    noteLegale: "Conformément au règlement (UE) n° 910/2014 (eIDAS) et à l'article 1367 du Code civil. La signature électronique qualifiée a la même valeur juridique que la signature manuscrite et sa fiabilité est présumée (décret n° 2017-1416 du 28 septembre 2017).",
    kpi: { total: 'Documents signés (total)', enAttente: 'En attente', ceMois: 'Ce mois-ci', dernier: 'Dernier document', dernierValeur: '22 mai 2026' },
    onglets: { ass: 'Signer un document', docs: 'Documents signés', val: 'Vérification', cfg: 'Configuration' },
    panneau: 'Signer un nouveau document',
    consigne: 'Déposez le document à signer par signature électronique qualifiée.',
    nomDocument: 'Nom du document',
    nomPlaceholder: "Ex. : PV de l'AG ordinaire - mars 2026",
    typeDocument: 'Type de document',
    typeProcesVerbal: "Procès-verbal d'assemblée générale",
    immeuble: 'Immeuble',
    choisirImmeuble: '— Choisir un immeuble —',
    depot: 'Cliquez ou glissez le fichier ici',
    formats: 'Formats acceptés : PDF, DOC, DOCX (10 Mo max.)',
  },
})
