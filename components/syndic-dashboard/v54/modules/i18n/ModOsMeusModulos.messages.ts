import { defineMessages } from '@/lib/syndic/v54/i18n'
import { LIBELLES_FR, MASQUES_FR, SECTIONS_FR } from '../../shell/sidebar-config.fr'

/** Section du catalogue de cartes (code interne ; le titre dépend de la langue). */
export type SectionCatalogue =
  | 'gestaoCorrente' | 'terreno' | 'condominioAG' | 'obrigacoes' | 'compliance'
  | 'patrimonio' | 'fiscal' | 'gestaoCondominos' | 'ferramentas' | 'agentes'

/** Module présenté par une carte du catalogue (id de la sidebar). */
export type IdCarte =
  | 'ordens' | 'canal' | 'planeamento' | 'faturacao' | 'histEdificio' | 'urgencias' | 'emailsFixy' | 'max'
  | 'docsInterv' | 'contabTec' | 'analiseOrc' | 'caderneta' | 'sinistros'
  | 'contabCond' | 'agDigit' | 'valoresDiv' | 'extranet' | 'cobrAuto'
  | 'declEncargos' | 'seguroObr' | 'fcr' | 'obrigPrazos' | 'certEnerg'
  | 'trackerDelibs' | 'procuracoes' | 'notificJud' | 'acessibilidade' | 'segEdificio' | 'rgpdCenter'
  | 'elevadores' | 'contratos' | 'cctv'
  | 'mapaFiscal' | 'openBanking' | 'reembolsos' | 'npsPosIntervencao'
  | 'portal' | 'reserva' | 'ocorrencias' | 'enquetes' | 'avisos' | 'whatsapp' | 'qrcode' | 'dashCond' | 'chatbot'
  | 'votacaoOnline' | 'pagDigitais' | 'carregamentoVE' | 'atasIA' | 'mapaQuotas' | 'orc3' | 'cobrJud' | 'monitorizacao'
  | 'arquivoDig' | 'relGestao' | 'prepAss' | 'planoMan' | 'vistoria' | 'pontuacao' | 'seguros' | 'marketplace'
  | 'compEnergia' | 'assinaturaCMD' | 'multiImoveis' | 'efatura' | 'infracoes' | 'benchmarking'
  | 'orcIA' | 'contacto' | 'ocClassif' | 'checklists' | 'procLote' | 'agLive' | 'predicao' | 'fixy' | 'lea' | 'alfredo'

/** Section du panneau « ordre du menu » : titre PT de la section de sidebar (clé de SECTIONS_FR). */
export type SectionMenu =
  | 'Agentes IA' | 'Gestão' | 'Património' | 'Técnico' | 'Acompanhamento' | 'Condomínio'
  | 'Obrigações Legais' | 'Gestão Condóminos' | 'Ferramentas Avançadas' | 'Ferramentas IA' | 'Conta'

/** Entrée du panneau « ordre du menu » (id de la sidebar). */
export type IdLigne =
  | 'fixy' | 'max' | 'lea' | 'alfredo' | 'tempo'
  | 'dashboard' | 'ordens' | 'canal' | 'planeamento' | 'equipa'
  | 'edificios' | 'profissionais' | 'condominos' | 'elevadores' | 'contratos' | 'cctv'
  | 'docsInterv' | 'contabTec' | 'analiseOrc' | 'faturacao'
  | 'alertas' | 'relMensal' | 'calReg' | 'docsGED'
  | 'contabCond' | 'agDigit' | 'valoresDiv' | 'caderneta' | 'mapaFiscal' | 'openBanking'
  | 'declEncargos' | 'obrigPrazos' | 'prazosLegais' | 'acessibilidade' | 'preparadorAG' | 'trackerDelibs' | 'procuracoes'
  | 'seguroObr' | 'fcr' | 'sinistros' | 'segEdificio' | 'notificJud' | 'cobrAuto' | 'rgpdCenter' | 'certEnerg' | 'extranet'
  | 'portal' | 'avisos' | 'enquetes' | 'reserva' | 'ocorrencias' | 'whatsapp' | 'reembolsos' | 'npsPosIntervencao'
  | 'relGestao' | 'prepAss' | 'planoMan' | 'vistoria' | 'pontuacao' | 'orcIA' | 'contacto' | 'ocClassif' | 'seguros'
  | 'checklists' | 'procLote' | 'agLive' | 'marketplace' | 'predicao' | 'qrcode' | 'dashCond' | 'compEnergia'
  | 'assinaturaCMD' | 'multiImoveis' | 'efatura' | 'votacaoOnline' | 'atasIA' | 'pagDigitais' | 'mapaQuotas' | 'orc3'
  | 'cobrJud' | 'carregamentoVE' | 'monitorizacao' | 'arquivoDig'
  | 'lancFat' | 'comunicDig' | 'emailsFixy'
  | 'definicoes'

interface OsMeusModulosTextes {
  titre: string
  /** Chapeau ; `total` = nombre de modules du catalogue affiché. */
  chapeau: (total: number) => string
  actifs: (total: number) => string
  /** Modules retirés de l'écran dans cette langue (ids de la sidebar). */
  masques: ReadonlySet<string>
  sectionsCatalogue: Record<SectionCatalogue, string>
  nomCarte: (id: IdCarte) => string
  descriptions: Record<IdCarte, string>
  ordre: {
    titre: string
    sousTitre: string
    reinitialiser: string
    reinitialiserToast: string
    section: (cle: SectionMenu) => string
    nomLigne: (id: IdLigne) => string
    fixe: string
    monterAria: string
    monter: string
    descendreAria: string
    descendre: string
    reordonnerToast: string
  }
  astuce: { titre: string; texte: string }
}

const SECTIONS_MENU_PT: Record<SectionMenu, string> = {
  'Agentes IA': 'AGENTES IA',
  'Gestão': 'GESTÃO',
  'Património': 'PATRIMÓNIO',
  'Técnico': 'TÉCNICO',
  'Acompanhamento': 'ACOMPANHAMENTO',
  'Condomínio': 'CONDOMÍNIO',
  'Obrigações Legais': 'OBRIGAÇÕES LEGAIS',
  'Gestão Condóminos': 'GESTÃO CONDÓMINOS',
  'Ferramentas Avançadas': 'FERRAMENTAS AVANÇADAS',
  'Ferramentas IA': 'FERRAMENTAS IA',
  'Conta': 'CONTA',
}

const NOMS_CARTES_PT: Record<IdCarte, string> = {
  ordens: 'Ordens de serviço',
  canal: 'Canal de Comunicações',
  planeamento: 'Planeamento',
  faturacao: 'Faturação',
  histEdificio: 'Histórico Edifício',
  urgencias: 'Urgências Técnicas',
  emailsFixy: 'Emails Fixy',
  max: 'Max Expert',
  docsInterv: 'Documentos de Intervenções',
  contabTec: 'Contabilidade Técnica',
  analiseOrc: 'Análise Orçamentos/Faturas',
  caderneta: 'Caderneta de Manutenção',
  sinistros: 'Sinistros',
  contabCond: 'Contabilidade Condomínio',
  agDigit: 'AG Digitais',
  valoresDiv: 'Valores em dívida',
  extranet: 'Extranet Condóminos',
  cobrAuto: 'Cobrança automática',
  declEncargos: 'Declaração de Encargos',
  seguroObr: 'Seguro Obrigatório',
  fcr: 'Fundo Comum de Reserva',
  obrigPrazos: 'Obrigações Legais',
  certEnerg: 'Certificação Energética',
  trackerDelibs: 'Tracker Deliberações',
  procuracoes: 'Procurações & Presenças',
  notificJud: 'Notificações Judiciais',
  acessibilidade: 'Acessibilidade DL 163',
  segEdificio: 'Segurança Edifício RSCIE',
  rgpdCenter: 'RGPD Compliance Center',
  elevadores: 'Gestão Elevadores',
  contratos: 'Contratos com Prestadores',
  cctv: 'Câmaras Vigilância',
  mapaFiscal: 'Mapa Fiscal Anual',
  openBanking: 'Open Banking PSD2',
  reembolsos: 'Reembolsos Automáticos',
  npsPosIntervencao: 'NPS Pós-Intervenção',
  portal: 'Portal do Condómino',
  reserva: 'Reserva Espaços',
  ocorrencias: 'Ocorrências',
  enquetes: 'Enquetes',
  avisos: 'Quadro de Avisos',
  whatsapp: 'WhatsApp/SMS',
  qrcode: 'QR Code Fração',
  dashCond: 'Dashboard Condómino RT',
  chatbot: 'Chatbot WhatsApp 24/7',
  votacaoOnline: 'Votação Online',
  pagDigitais: 'Pagamentos Digitais',
  carregamentoVE: 'Carregamento VE',
  atasIA: 'Atas com IA',
  mapaQuotas: 'Mapa de Quotas',
  orc3: '3 Orçamentos Obras',
  cobrJud: 'Cobrança Judicial',
  monitorizacao: 'Monitorização Consumos',
  arquivoDig: 'Arquivo Digital',
  relGestao: 'Relatório de Gestão',
  prepAss: 'Preparador Assembleia',
  planoMan: 'Plano de Manutenção',
  vistoria: 'Vistoria Técnica',
  pontuacao: 'Pontuação de Saúde',
  seguros: 'Gestão de Seguros',
  marketplace: 'Marketplace Profissionais',
  compEnergia: 'Comparador Energia',
  assinaturaCMD: 'Assinatura Digital CMD',
  multiImoveis: 'Dashboard Multi-Imóveis',
  efatura: 'e-Fatura AT',
  infracoes: 'Acompanhamento de Infrações',
  benchmarking: 'Benchmarking Imóveis',
  orcIA: 'Orçamento Anual IA',
  contacto: 'Contacto Proativo IA',
  ocClassif: 'Ocorrências com IA',
  checklists: 'Checklists IA',
  procLote: 'Processamentos em Lote',
  agLive: 'AG Live Digital',
  predicao: 'Predição Manutenção',
  fixy: 'Fixy',
  lea: 'Léa',
  alfredo: 'Alfredo',
}

const NOMS_LIGNES_PT: Record<IdLigne, string> = {
  fixy: 'Fixy',
  max: 'Max Expert',
  lea: 'Léa',
  alfredo: 'Alfredo',
  tempo: 'Tempo',
  dashboard: 'Painel de controlo',
  ordens: 'Ordens de serviço',
  canal: 'Canal de Comunicações',
  planeamento: 'Planeamento',
  equipa: 'A Minha Equipa',
  edificios: 'Edifícios',
  profissionais: 'Profissionais',
  condominos: 'Condóminos & Inquilinos',
  elevadores: 'Gestão Elevadores',
  contratos: 'Contratos',
  cctv: 'Câmaras Vigilância',
  docsInterv: 'Documentos de Intervenções',
  contabTec: 'Contabilidade Técnica',
  analiseOrc: 'Análise Orçamentos/Faturas',
  faturacao: 'Faturação',
  alertas: 'Alertas',
  relMensal: 'Relatório mensal',
  calReg: 'Calendário regulamentar',
  docsGED: 'Documentos (GED)',
  contabCond: 'Contabilidade Condomínio',
  agDigit: 'AG Digitais',
  valoresDiv: 'Valores em dívida',
  caderneta: 'Caderneta de Manutenção',
  mapaFiscal: 'Mapa Fiscal Anual',
  openBanking: 'Open Banking',
  declEncargos: 'Declaração de Encargos',
  obrigPrazos: 'Obrigações e Prazos',
  prazosLegais: 'Prazos legais',
  acessibilidade: 'Acessibilidade DL 163',
  preparadorAG: 'Preparador AG',
  trackerDelibs: 'Tracker Deliberações',
  procuracoes: 'Procurações & Presenças',
  seguroObr: 'Seguro Obrigatório',
  fcr: 'Fundo Comum de Reserva',
  sinistros: 'Sinistros',
  segEdificio: 'Segurança Edifício',
  notificJud: 'Notificações Judiciais',
  cobrAuto: 'Cobrança automática · Juros & Sanções',
  rgpdCenter: 'RGPD Center',
  certEnerg: 'Certificação Energética',
  extranet: 'Extranet Condóminos',
  portal: 'Portal do Condómino',
  avisos: 'Quadro de Avisos',
  enquetes: 'Enquetes',
  reserva: 'Reserva Espaços',
  ocorrencias: 'Ocorrências',
  whatsapp: 'WhatsApp/SMS',
  reembolsos: 'Reembolsos',
  npsPosIntervencao: 'NPS Pós-Intervenção',
  relGestao: 'Relatório de Gestão',
  prepAss: 'Preparador Assembleia',
  planoMan: 'Plano Manutenção',
  vistoria: 'Vistoria Técnica',
  pontuacao: 'Pontuação Saúde',
  orcIA: 'Orçamento IA',
  contacto: 'Contacto Proativo',
  ocClassif: 'Ocorrências (Classificador)',
  seguros: 'Gestão Seguros',
  checklists: 'Checklists IA',
  procLote: 'Processamentos Lote',
  agLive: 'AG Live Digital',
  marketplace: 'Marketplace Profissionais',
  predicao: 'Predição Manutenção',
  qrcode: 'QR Code Fração',
  dashCond: 'Dashboard Condómino',
  compEnergia: 'Comparador Energia',
  assinaturaCMD: 'Assinatura CMD',
  multiImoveis: 'Multi-Imóveis',
  efatura: 'e-Fatura AT',
  votacaoOnline: 'Votação Online',
  atasIA: 'Atas com IA',
  pagDigitais: 'Pagamentos Digitais',
  mapaQuotas: 'Mapa de Quotas',
  orc3: '3 Orçamentos',
  cobrJud: 'Cobrança Judicial',
  carregamentoVE: 'Carregamento VE',
  monitorizacao: 'Monitorização Consumos',
  arquivoDig: 'Arquivo Digital',
  lancFat: 'Lançamento IA Faturas',
  comunicDig: 'Comunicação digital',
  emailsFixy: 'Emails Fixy',
  definicoes: 'Definições',
}

/** Titre de section en capitales, tiré des libellés FR de la sidebar (qui font foi). */
const sectionFr = (cle: SectionMenu): string => (SECTIONS_FR[cle] ?? cle).toLocaleUpperCase('fr-FR')
/** Nom FR d'un module : libellé de la sidebar FR. */
const libelleFr = (id: string): string => LIBELLES_FR[id] ?? id

export const OS_MEUS_MODULOS_MESSAGES = defineMessages<OsMeusModulosTextes>({
  'pt-PT': {
    titre: 'Os meus módulos',
    chapeau: () => '90 módulos profissionais · Ative só o que precisa · Os desativados deixam de aparecer no menu lateral · 4 módulos V5 fusionados como secções nos módulos parentes',
    actifs: () => '90/90 ativos',
    masques: new Set<string>(),
    sectionsCatalogue: {
      gestaoCorrente: 'GESTÃO CORRENTE',
      terreno: 'TERRENO & INTERVENÇÕES',
      condominioAG: 'CONDOMÍNIO & AG',
      obrigacoes: 'OBRIGAÇÕES LEGAIS PT',
      compliance: 'COMPLIANCE LEGAL V5 — NOVO',
      patrimonio: 'PATRIMÓNIO V5 — NOVO',
      fiscal: 'FISCAL & TESOURARIA V5 — NOVO',
      gestaoCondominos: 'GESTÃO CONDÓMINOS',
      ferramentas: 'FERRAMENTAS PT',
      agentes: 'AGENTES IA',
    },
    nomCarte: (id) => NOMS_CARTES_PT[id],
    descriptions: {
      ordens: 'Criar e acompanhar intervenções',
      canal: 'Mensagens internas e com profissionais',
      planeamento: 'Vista de calendário das intervenções',
      faturacao: 'Gestão de faturas',
      histEdificio: 'Vista consolidada por edifício — intervenções, equipamentos, contratos',
      urgencias: 'Despacho imediato para o profissional VITFIX disponível',
      emailsFixy: 'Gestão de emails com IA',
      max: 'Consultor especialista IA em condomínios',
      docsInterv: 'Relatórios e comprovativos de intervenção',
      contabTec: 'Acompanhamento financeiro das intervenções',
      analiseOrc: 'Comparação e validação de orçamentos',
      caderneta: 'Histórico de manutenção dos edifícios',
      sinistros: 'Pipeline de gestão de sinistros',
      contabCond: 'Contabilidade do condomínio',
      agDigit: 'Assembleias gerais online',
      valoresDiv: 'Acompanhamento e cobrança de dívidas',
      extranet: 'Portal de condóminos',
      cobrAuto: 'Procedimento automatizado de cobrança',
      declEncargos: 'Obrigação legal desde 2022 · Declaração para venda de fração',
      seguroObr: 'Seguro contra incêndio obrigatório · Art.° 1429.° CC',
      fcr: 'Mínimo legal 10% · DL 268/94 · Gestão do fundo de reserva',
      obrigPrazos: 'Calendário obrigações · Prazos legais · DL 555/99 · DL 97/2017 · DL 320/2002',
      certEnerg: 'SCE · Classes A+ a F · DL 101-D/2020 · EPBD 2024 · MEPS',
      trackerDelibs: 'CC art. 1436.°-i · 15 dias úteis · Fixy extrai · Calendário PT',
      procuracoes: 'CC art. 1433.°-3 · Léa OCR · Validação NIF AT',
      notificJud: 'CC 1436.°-o + p · Léa OCR · Update semestral auto',
      acessibilidade: '23 critérios · Alfredo Vision · Atestação PDF',
      segEdificio: 'DL 220/2008 · Categorização auto · Alfredo gera plano emergência',
      rgpdCenter: 'Tratamentos · Direitos titulares · 30 dias · Fixy classifica',
      elevadores: 'DL 320/2002 · Periodicidade auto 2/4/6 anos · Workflow 48h Câmara',
      contratos: 'Léa OCR · Tempo alertas J-90/60/30 · Auto 3 Orçamentos',
      cctv: 'RGPD · Autorização CNPD · Sinalização auto · Retenção máx 30d',
      mapaFiscal: 'Max Expert categoriza · Export Primavera/PHC/Sage/SAF-T',
      openBanking: 'Conexão direta bancos PT · Max Expert auto-match 90%+',
      reembolsos: 'Pro-rata temporis · Lei 8/2022 · Max calcula · OB executa',
      npsPosIntervencao: 'Auto-envio 48h · Rating Marketplace · Alfredo agrega insights',
      portal: 'Extrato · Recibos · Documentos · Comunicações · Pedidos',
      reserva: 'Reserva de espaços comuns · Calendário · Regras configuráveis',
      ocorrencias: 'Gestão de avarias · QR Codes · SLA · Tracking completo',
      enquetes: 'Sondagens e inquéritos · Votação informal · Participação',
      avisos: 'Avisos digitais · Comunicados · Notificações condóminos',
      whatsapp: 'Comunicação WhatsApp · SMS · Modelos · Envio em massa',
      qrcode: 'QR Codes por zona · Sinalizações via scan · Estatísticas · Geração em lote · Condómino reporter',
      dashCond: 'Estado tempo real · Barra progresso intervenções · Financeiro · Comunicação · Atividade',
      chatbot: 'Chatbot IA autónomo · Resposta automática · Classificação pedidos · Criação ocorrências',
      votacaoOnline: 'Votação à distância · Lei 8/2022 · Procurações automáticas',
      pagDigitais: 'Multibanco · MB Way · SEPA · Reconciliação automática',
      carregamentoVE: 'Postos carregamento elétrico · DL 101-D/2020 · Fundo Ambiental',
      atasIA: 'Geração automática de atas · Cálculo maiorias · Assinatura eletrónica',
      mapaQuotas: 'Cálculo quotas · Permilagem · Simulador · Cobranças trimestrais',
      orc3: 'Comparação obrigatória 3 orçamentos · Lei 8/2022 · Scoring IA',
      cobrJud: 'Pipeline de recuperação · Prazo 90 dias · Injunção · Art.° 310.° CC',
      monitorizacao: 'Água · Eletricidade · Gás · Alertas consumo anormal',
      arquivoDig: 'Arquivo certificado · SHA-256 · Pesquisa · Retenção legal',
      relGestao: 'Relatório anual · Prestação de contas · Art.° 1436.° CC · Lei 8/2022',
      prepAss: 'Convocatória · Ordem de trabalhos · Quóruns · Procurações · Lei 8/2022',
      planoMan: 'Conservação obrigatória 8 anos · DL 555/99 art. 89.° · Planificação obras',
      vistoria: 'Inspeção gás 5 anos · Elevadores 2-6 anos · Checklist · Relatório PDF',
      pontuacao: 'Score IA 0-100 por edifício · Estado técnico · Finanças · Conformidade · Energia',
      seguros: 'Apólices por edifício · Coberturas · Alertas expiração · Sinistros · Art.° 1429.° CC',
      marketplace: 'Pesquisa profissionais certificados · Pedidos orçamento · Avaliações · Comparação · Favoritos',
      compEnergia: 'Comparar tarifas EDP/Galp/Endesa · Simulação poupança · Histórico consumos · Classe energética',
      assinaturaCMD: 'Chave Móvel Digital · Assinar atas/contratos · Validação · DL 12/2021 · eIDAS',
      multiImoveis: 'Visão global · Comparação edifícios · Ranking · KPIs agregados · Score saúde',
      efatura: 'Submissão faturas AT · ATCUD · SAF-T PT · Portaria 302/2016 · DL 28/2019',
      infracoes: 'Infrações ao regulamento · Pipeline sinalização → multa · Provas · Histórico · Modelos de carta',
      benchmarking: 'Comparação KPIs entre edifícios · Rankings · Percentis · Alertas outliers · Exportação',
      orcIA: 'Geração automática baseada em 3 exercícios · Tendências · Inflação · DL 268/94',
      contacto: 'Comunicação automática condóminos · Cobranças · Avisos · Relatórios · Multi-canal',
      ocClassif: 'Criação automática a partir de texto/foto · Classificação · Priorização · Localização',
      checklists: 'Listas inteligentes · Inspeção mensal · Preparação AG · Entrada/saída · Segurança incêndio',
      procLote: 'Emissão quotas · Relances automáticos · Encerramento exercício · Recibos · Agendamentos',
      agLive: 'Sessão AG em tempo real · Votação instantânea · Controlo presenças · Quórum · Ata automática',
      predicao: 'ML preditivo · Score risco equipamentos · Timeline intervenções · Alertas · Fatores de risco',
      fixy: 'Assistente de ação — secretária IA',
      lea: 'Contabilidade de condomínio',
      alfredo: 'Gestor de emails IA',
    },
    ordre: {
      titre: 'Ordem do menu',
      sousTitre: 'Arraste ou utilize ▲▼ — a barra lateral atualiza-se em tempo real',
      reinitialiser: '↻ Redefinir',
      reinitialiserToast: 'Redefinir ordem',
      section: (cle) => SECTIONS_MENU_PT[cle],
      nomLigne: (id) => NOMS_LIGNES_PT[id],
      fixe: 'fixo',
      monterAria: 'Subir na ordem',
      monter: 'Subir',
      descendreAria: 'Descer na ordem',
      descendre: 'Descer',
      reordonnerToast: 'Reordenar módulos',
    },
    astuce: {
      titre: 'Dica',
      texte: 'Os módulos desativados desaparecem da barra lateral mas permanecem acessíveis a qualquer momento. Os seus dados nunca são eliminados.',
    },
  },
  'fr-FR': {
    titre: 'Mes modules',
    chapeau: (total) => `${total} modules professionnels · Activez uniquement ceux dont vous avez besoin · Les modules désactivés n'apparaissent plus dans le menu latéral · 4 modules V5 intégrés comme sections de leur module parent`,
    actifs: (total) => `${total}/${total} actifs`,
    // Modules sans objet en France (e-Fatura : transmission des factures à l'administration fiscale portugaise).
    masques: MASQUES_FR,
    sectionsCatalogue: {
      gestaoCorrente: 'GESTION COURANTE',
      terreno: 'TERRAIN & INTERVENTIONS',
      condominioAG: `${sectionFr('Condomínio')} & AG`,
      obrigacoes: sectionFr('Obrigações Legais'),
      compliance: 'CONFORMITÉ LÉGALE V5 — NOUVEAU',
      patrimonio: `${sectionFr('Património')} V5 — NOUVEAU`,
      fiscal: 'FISCALITÉ & TRÉSORERIE V5 — NOUVEAU',
      gestaoCondominos: sectionFr('Gestão Condóminos'),
      ferramentas: sectionFr('Ferramentas Avançadas'),
      agentes: sectionFr('Agentes IA'),
    },
    nomCarte: libelleFr,
    // Références : loi n° 65-557 du 10 juillet 1965 (« loi de 1965 ») et décret n° 67-223 du 17 mars 1967.
    descriptions: {
      ordens: 'Créer et suivre les interventions',
      canal: 'Messages internes et échanges avec les prestataires',
      planeamento: 'Vue calendrier des interventions',
      faturacao: 'Gestion des factures',
      histEdificio: 'Vue consolidée par immeuble — interventions, équipements, contrats',
      urgencias: 'Affectation immédiate au prestataire VitFix disponible',
      emailsFixy: 'Gestion des e-mails par IA',
      max: 'Conseiller IA expert en copropriété',
      docsInterv: "Rapports et justificatifs d'intervention",
      contabTec: 'Suivi financier des interventions',
      analiseOrc: 'Comparaison et validation des devis',
      caderneta: "Historique d'entretien des immeubles · Art. 18 loi de 1965 · Décret n° 2001-477",
      sinistros: "Suivi des sinistres, de la déclaration à l'indemnisation",
      contabCond: 'Comptabilité du syndicat des copropriétaires · Décret n° 2005-240',
      agDigit: 'Assemblées générales en visioconférence · Vote par correspondance (art. 17-1 A loi de 1965)',
      valoresDiv: 'Suivi et recouvrement des charges impayées',
      extranet: 'Espace en ligne des copropriétaires · Décret n° 2019-502',
      cobrAuto: 'Relances automatisées des impayés',
      declEncargos: "État daté lors de la vente d'un lot · Art. 5 décret de 1967 · Pré-état daté (CCH, art. L721-2)",
      seguroObr: 'Assurance responsabilité civile obligatoire du syndicat · Art. 9-1 loi de 1965',
      fcr: 'Au moins 5 % du budget prévisionnel · Art. 14-2-1 loi de 1965 · Gestion du fonds de travaux',
      obrigPrazos: 'Calendrier des obligations · Délais légaux · PPT · Contrôle des ascenseurs · DPE collectif',
      certEnerg: 'DPE collectif · Classes A à G · Loi Climat et résilience · Directive EPBD 2024',
      trackerDelibs: 'Notification du PV sous 1 mois · Contestation sous 2 mois (art. 42 loi de 1965) · Extraction par Fixy',
      procuracoes: 'Art. 22 loi de 1965 · 3 délégations de vote au plus par mandataire, sauf total ≤ 10 % des voix · OCR Léa',
      notificJud: "Assignations et décisions de justice · Information des copropriétaires (art. 59 décret de 1967) · Compte rendu à l'AG (art. 55) · OCR Léa",
      acessibilidade: 'Diagnostic des parties communes · Alfredo Vision · Rapport PDF',
      segEdificio: "Arrêté du 31 janvier 1986 · Classement automatique de l'immeuble · Consignes de sécurité générées par Alfredo",
      rgpdCenter: 'Registre des traitements · Droits des personnes · Réponse sous 1 mois · Classement par Fixy',
      elevadores: "Contrôle technique quinquennal · Contrat d'entretien · Suivi des pannes",
      contratos: 'OCR Léa · Alertes Tempo J-90/60/30 · Mise en concurrence automatique',
      cctv: "RGPD · Vote en AG · Panneau d'information obligatoire · Conservation d'un mois au plus (CNIL)",
      mapaFiscal: 'Ventilation des charges par copropriétaire · Catégorisation par Max Expert · Export comptable',
      openBanking: 'Connexion directe aux banques (DSP2) · Rapprochement automatique par Max Expert (plus de 90 %)',
      reembolsos: 'Apurement du compte vendeur (art. 6-2 et 45-1 du décret de 1967) · Calcul par Max · Virement via Open Banking',
      npsPosIntervencao: "Envoi automatique 48 h après l'intervention · Note dans l'annuaire des prestataires · Synthèse par Alfredo",
      portal: 'Relevé de compte · Reçus · Documents · Communications · Demandes',
      reserva: 'Réservation des espaces communs · Calendrier · Règles paramétrables',
      ocorrencias: 'Gestion des pannes · QR codes · SLA · Suivi complet',
      enquetes: 'Sondages et enquêtes · Vote consultatif · Participation',
      avisos: 'Affichage numérique · Communiqués · Notifications aux copropriétaires',
      whatsapp: 'Communication WhatsApp · SMS · Modèles · Envois groupés',
      qrcode: 'QR codes par zone · Signalements par scan · Statistiques · Génération groupée · Signalement par les copropriétaires',
      dashCond: 'État en temps réel · Avancement des interventions · Finances · Communication · Activité',
      chatbot: "Chatbot IA autonome · Réponse automatique · Classement des demandes · Création d'incidents",
      votacaoOnline: 'Vote par correspondance · Art. 17-1 A loi de 1965 · Suivi des pouvoirs (art. 22)',
      pagDigitais: 'Prélèvement SEPA · Virement · Carte bancaire · Rapprochement automatique',
      carregamentoVE: 'Bornes de recharge (IRVE) · Droit à la prise · Prime ADVENIR',
      atasIA: 'Rédaction automatique des PV · Calcul des majorités · Signature électronique',
      mapaQuotas: 'Calcul des quotes-parts · Tantièmes · Simulateur · Appels de fonds trimestriels',
      orc3: "Mise en concurrence au-delà du seuil fixé par l'AG · Art. 21 loi de 1965 · Notation IA",
      cobrJud: 'Suivi du recouvrement · Mise en demeure · Procédure accélérée au fond (art. 19-2 loi de 1965) · Prescription de 5 ans',
      monitorizacao: 'Eau · Électricité · Gaz · Alertes de consommation anormale',
      arquivoDig: 'Archivage certifié · SHA-256 · Recherche · Conservation légale',
      relGestao: 'Rapport annuel · Reddition des comptes · Approbation des comptes en AG · Décret n° 2005-240',
      prepAss: "Convocation au moins 21 jours avant l'AG (art. 9 décret de 1967) · Ordre du jour · Majorités · Pouvoirs",
      planoMan: 'Plan pluriannuel de travaux sur 10 ans · Art. 14-2 loi de 1965 · Planification des travaux',
      vistoria: 'Contrôles périodiques (ascenseurs tous les 5 ans) · Checklist · Rapport PDF',
      pontuacao: 'Score IA de 0 à 100 par immeuble · État technique · Finances · Conformité · Énergie',
      seguros: "Contrats par immeuble · Garanties · Alertes d'échéance · Sinistres · Art. 9-1 loi de 1965",
      marketplace: 'Recherche de prestataires qualifiés · Demandes de devis · Avis · Comparaison · Favoris',
      compEnergia: "Comparaison des offres de fourniture d'énergie · Simulation d'économies · Historique des consommations · Classe énergétique",
      assinaturaCMD: 'Signature des PV et des contrats · Vérification · Règlement eIDAS · Art. 1367 Code civil',
      multiImoveis: "Vue d'ensemble · Comparaison des immeubles · Classement · Indicateurs agrégés · Score de santé",
      efatura: "Transmission des factures à l'administration fiscale portugaise — sans objet en France",
      infracoes: "Manquements au règlement de copropriété · Du signalement à l'action en justice · Preuves · Historique · Modèles de lettres",
      benchmarking: 'Comparaison des indicateurs entre immeubles · Classements · Percentiles · Alertes sur les valeurs atypiques · Export',
      orcIA: 'Élaboration automatique à partir des 3 derniers exercices · Tendances · Inflation · Art. 14-1 loi de 1965',
      contacto: 'Communication automatique avec les copropriétaires · Relances · Avis · Comptes rendus · Multicanal',
      ocClassif: "Création automatique à partir d'un texte ou d'une photo · Classement · Priorisation · Localisation",
      checklists: "Listes intelligentes · Visite périodique · Préparation de l'AG · Mutation de lot · Sécurité incendie",
      procLote: "Appels de fonds · Relances automatiques · Clôture de l'exercice · Reçus · Planification",
      agLive: "Séance d'AG en temps réel · Vote instantané · Feuille de présence · Décompte des voix · PV automatique",
      predicao: 'Apprentissage automatique prédictif · Score de risque des équipements · Chronologie des interventions · Alertes · Facteurs de risque',
      fixy: "Assistant d'action — secrétaire IA",
      lea: 'Comptabilité de copropriété',
      alfredo: 'Agent e-mails IA',
    },
    ordre: {
      titre: 'Ordre du menu',
      sousTitre: 'Glissez-déposez ou utilisez ▲▼ — la barre latérale se met à jour en temps réel',
      reinitialiser: '↻ Réinitialiser',
      reinitialiserToast: "Réinitialiser l'ordre",
      section: sectionFr,
      nomLigne: libelleFr,
      fixe: 'fixe',
      monterAria: "Monter dans l'ordre",
      monter: 'Monter',
      descendreAria: "Descendre dans l'ordre",
      descendre: 'Descendre',
      reordonnerToast: 'Réordonner les modules',
    },
    astuce: {
      titre: 'Astuce',
      texte: 'Les modules désactivés disparaissent de la barre latérale mais restent accessibles à tout moment. Vos données ne sont jamais supprimées.',
    },
  },
})
