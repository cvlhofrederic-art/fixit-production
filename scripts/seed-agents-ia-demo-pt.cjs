// ════════════════════════════════════════════════════════════════════════════
// Seed démo agents IA Syndic PT
// ════════════════════════════════════════════════════════════════════════════
// Pour admincvlho@gmail.com (super_admin, uid 389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4)
//
// Crée :
//   - 3 conversations Léa (contabilidade/legal) cohérentes avec les 4 immeubles
//   - 7 emails Alfredo (boîte mail réaliste) avec brouillons de réponse
//
// Usage :
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-agents-ia-demo-pt.cjs
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Load .env.local if env vars not set
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const i = line.indexOf('=')
        const k = line.slice(0, i).trim()
        const v = line.slice(i + 1).trim()
        if (!process.env[k]) process.env[k] = v
      }
    })
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const USER_ID = process.env.TARGET_USER_ID || '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const LOCALE = 'pt'
const NOW = new Date()
const isoDaysAgo = (d) => new Date(NOW.getTime() - d * 86400000).toISOString()
const isoHoursAgo = (h) => new Date(NOW.getTime() - h * 3600000).toISOString()

// ── Données contextuelles cohérentes avec le dashboard PT ───────────────────
const IMMEUBLES = [
  { nom: 'Edifício Atlântico', adresse: 'Avenida da Boavista 1247, Porto', fracoes: 12 },
  { nom: 'Condomínio Boavista Center', adresse: 'Avenida da Boavista 3265, Porto', fracoes: 8 },
  { nom: 'Residencial Cedofeita', adresse: 'Rua de Cedofeita 421, Porto', fracoes: 10 },
  { nom: 'Edifício Foz Douro', adresse: 'Rua do Passeio Alegre 78, Porto', fracoes: 10 },
]

// ════════════════════════════════════════════════════════════════════════════
// 1. CONVERSATIONS LÉA — Agent contabilística IA
// ════════════════════════════════════════════════════════════════════════════
const LEA_CONVERSATIONS = [
  {
    title: 'Análise dos encargos Q1 2026 — Edifício Atlântico',
    daysAgo: 2,
    messages: [
      { role: 'user', content: 'Olá Léa, podes analisar os encargos do primeiro trimestre 2026 do Edifício Atlântico ? Sinto que estão acima do orçamento.' },
      { role: 'assistant', content: 'Olá ! Analisei os lançamentos contabilísticos do Edifício Atlântico (Avenida da Boavista 1247) para Q1 2026.\n\n**Resumo da execução orçamental Q1 :**\n- Orçamento previsto Q1 : **12 000 €** (25% dos 48 000 € anuais)\n- Despesas reais Q1 : **14 320 €**\n- Desvio : **+19,3 %** (sobreconsumo de 2 320 €)\n\n**Principais desvios identificados :**\n1. **Eletricidade partes comuns** : 1 480 € (orçamento 900 €) — +64 %. Causa provável : iluminação corredor 2.º não-LED.\n2. **Manutenção elevador OTIS** : 720 € (orçamento 450 €) — +60 %. Causa : intervenção extraordinária dia 17/02.\n3. **Limpeza** : conforme orçamento.\n\n**Recomendação legal (art.º 1424.º CC) :** o orçamento previsional foi aprovado em AG 2025-03-15. Os encargos extraordinários > 10 % devem ser justificados no relatório anual de gestão (art.º 1436.º CC).' },
      { role: 'user', content: 'OK, e quanto à inspeção elevador, posso recuperar isso junto dos condóminos ?' },
      { role: 'assistant', content: 'A intervenção extraordinária da OTIS (720 €) é qualificada como **encargo corrente de conservação** (DL 320/2002 — manutenção elevadores). Não pode ser facturada separadamente aos condóminos : já está coberta pela quota mensal.\n\nNo entanto, se a intervenção estiver ligada a um **incidente específico** causado por um condómino identificado (ex : forçar a porta), pode aplicar o art.º 1428.º CC e imputar individualmente. Verifica o relatório técnico da OTIS antes de proceder.' },
    ],
  },
  {
    title: 'Inconsistências no diário contabilístico — Cedofeita',
    daysAgo: 5,
    messages: [
      { role: 'user', content: 'Léa, detectei lançamentos duplicados no diário de Residencial Cedofeita em abril. Podes verificar ?' },
      { role: 'assistant', content: 'Verifiquei o diário contabilístico de **Residencial Cedofeita** (Rua de Cedofeita 421) para abril 2026.\n\n**Inconsistências detectadas :**\n\n| Data | Descrição | Montante | Conta | Anomalia |\n|------|-----------|----------|-------|----------|\n| 12/04 | Fatura EDP — abril | 215,40 € | 6241 | Duplicada (também 14/04) |\n| 14/04 | Fatura EDP — abril | 215,40 € | 6241 | Duplicado |\n| 18/04 | Limpeza Limpax | 280,00 € | 6225 | OK |\n| 22/04 | Inspeção gás Galp | 145,00 € | 6233 | Falta nº fatura |\n\n**Recomendação :** anular o lançamento 14/04 (duplicado da fatura EDP) e completar o campo nº fatura para a Galp. Posso preparar os ajustes para a tua aprovação.' },
      { role: 'user', content: 'Sim, prepara o ajuste e gera-me também o resumo trimestral para a AG' },
      { role: 'assistant', content: 'Ajustes preparados :\n\n1. **Anulação lançamento 14/04** : EDP 215,40 € (motivo : duplicação)\n2. **Atualização lançamento 22/04** : completar nº fatura Galp\n\nPara aprovar : aceder ao **Diário Contabilístico → Ajustes → Aprovar (2)**.\n\n**Resumo Q2 para AG Cedofeita** (em preparação) :\n- Receitas quotas : 8 750 €\n- Despesas correntes : 7 920 € (sem duplicação)\n- Fundo comum reserva : +875 € (10 % obrigatórios DL 268/94)\n- Saldo conta gestão : 4 230 €\n\nO documento PDF pronto para AG estará disponível em **Relatórios → Q2 2026** dentro de 5 minutos.' },
    ],
  },
  {
    title: 'Chamada de quotas trimestral — Edifício Foz Douro',
    daysAgo: 8,
    messages: [
      { role: 'user', content: 'Preciso gerar a chamada de quotas trimestral do Foz Douro. Quanto fica para cada fração ?' },
      { role: 'assistant', content: 'Cálculo da **chamada de quotas Q2 2026 — Edifício Foz Douro** (Rua do Passeio Alegre 78) :\n\n**Base de cálculo :**\n- Orçamento anual aprovado em AG : **62 000 €**\n- Quota trimestral total : 15 500 €\n- 10 frações com permilagens diferenciadas\n\n**Detalhe por fração (regra : permilagem × 15 500 € / 1000) :**\n\n| Fração | Permilagem | Quota Q2 |\n|--------|-----------|----------|\n| A — R/C Esq | 95 ‰ | 1 472,50 € |\n| B — R/C Dto | 95 ‰ | 1 472,50 € |\n| C — 1.º Esq | 100 ‰ | 1 550,00 € |\n| D — 1.º Dto | 100 ‰ | 1 550,00 € |\n| E — 2.º Esq | 100 ‰ | 1 550,00 € |\n| F — 2.º Dto | 100 ‰ | 1 550,00 € |\n| G — 3.º Esq | 105 ‰ | 1 627,50 € |\n| H — 3.º Dto | 105 ‰ | 1 627,50 € |\n| I — 4.º Esq | 100 ‰ | 1 550,00 € |\n| J — 4.º Dto | 100 ‰ | 1 550,00 € |\n| **Total** | **1000 ‰** | **15 500 €** |\n\nPosso gerar agora os recibos individuais (PDF) para envio por email aos 10 condóminos. Prazo legal de pagamento : 30 dias (art.º 6.º DL 268/94).' },
      { role: 'user', content: 'Sim, gera os recibos e prepara as cartas de cobrança automática para 30 dias depois caso não paguem' },
      { role: 'assistant', content: 'Pronto !\n\n✅ **10 recibos PDF** gerados (numeração FR-2026-FOZ-Q2-001 a 010) — disponíveis em Documentos (GED) → Foz Douro → Q2 2026.\n\n✅ **Cron de cobrança automática** configurado :\n- D+30 dias (sem pagamento) : envio carta amigável (DL 268/94 art.º 6.º)\n- D+45 dias : segundo aviso + cálculo de juros legais (8 % anual)\n- D+90 dias : preparação dossier contencioso (Lei 8/2022)\n\nPara enviar imediatamente os recibos por email : **Quotas → Chamadas → Enviar (10)**. O envio gera assinatura digital qualificada CMD para fins fiscais (e-Fatura AT).' },
    ],
  },
]

// ════════════════════════════════════════════════════════════════════════════
// 2. EMAILS ALFREDO — Boîte mail réaliste avec brouillons de réponse
// ════════════════════════════════════════════════════════════════════════════
const ALFREDO_EMAILS = [
  {
    from_email: 'ana.silva@mail.pt',
    subject: 'Fuga de água no apartamento — URGENTE',
    body_preview: 'Bom dia,\n\nSou a Ana Silva, condómina da fração A do Edifício Atlântico (R/C Esq). Esta manhã, ao acordar, tinha o chão da cozinha completamente alagado. Parece haver uma fuga de água por trás dos armários, possivelmente vinda do apartamento de cima.\n\nJá fechei a torneira de segurança mas a situação é urgente — a água começa a infiltrar-se no parquet. Podem enviar alguém o mais rápido possível ? Estou em casa todo o dia.\n\nObrigada,\nAna Silva\n912 300 40 50',
    received_at: isoHoursAgo(3),
    type_demande: 'incident',
    urgence: 'urgente',
    resume_court: 'Fuga de água apartamento R/C Esq, Edifício Atlântico. Condómina pede intervenção urgente.',
    immeuble_detecte: 'Edifício Atlântico',
    locataire_detecte: 'Ana Silva',
    draft_subject: 'Re: Fuga de água no apartamento — URGENTE',
    draft_body_text: 'Boa tarde Sra. Silva,\n\nObrigado pelo seu contacto. Tomei conhecimento da fuga de água na sua fração (R/C Esq, Edifício Atlântico) e a situação foi classificada como **urgente**.\n\nAcabo de criar uma intervenção prioritária e contactei o nosso canalizador de plantão, **Bruno Tavares (Silva Canalizações)**, que estará na sua casa entre as **15h00 e 16h00** de hoje.\n\nPara nossa segurança, peço-lhe :\n1. Mantenha a torneira de segurança fechada\n2. Tire fotografias dos danos (parquet, armários) para o seguro Fidelidade — apólice nº MR-2025-178\n3. Não desloque o mobiliário antes da peritagem\n\nUma vez identificada a origem (fração A do 1.º Esq aparentemente), accionarei o seguro multirriscos. O senhor síndico será informado dos próximos passos no relatório de intervenção.\n\nFico à sua disposição.\n\nCumprimentos,\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.92, suggested_next_actions: ['criar_missao_urgente', 'contactar_seguro', 'agendar_peritagem'] },
  },
  {
    from_email: 'pedro.ferreira@gmail.com',
    subject: 'Pedido cópia ata Assembleia Geral 2025',
    body_preview: 'Bom dia,\n\nSou o Pedro Ferreira, proprietário da fração D (1.º Direito) do Edifício Foz Douro. Não consegui estar presente na última AG (15 abril 2025) e gostaria de receber uma cópia da ata para consulta.\n\nPreciso especialmente da deliberação sobre a renovação da cobertura, pois quero perceber em que termos foi aprovada (montante, prazos, contributo extraordinário, etc.).\n\nObrigado pela atenção,\nPedro Ferreira',
    received_at: isoHoursAgo(8),
    type_demande: 'pedido_documento',
    urgence: 'normale',
    resume_court: 'Pedido cópia ata AG 2025 — Edifício Foz Douro, fração D. Foco na deliberação renovação cobertura.',
    immeuble_detecte: 'Edifício Foz Douro',
    locataire_detecte: 'Pedro Ferreira',
    draft_subject: 'Re: Pedido cópia ata Assembleia Geral 2025',
    draft_body_text: 'Bom dia Sr. Ferreira,\n\nObrigado pelo seu contacto. Em conformidade com o art.º 1432.º CC (acesso aos documentos do condomínio), envio em anexo a ata da Assembleia Geral Ordinária de **15 de abril de 2025** do Edifício Foz Douro.\n\nSobre a **deliberação cobertura** (ponto 7 da ordem de trabalhos), resumo os termos aprovados :\n- **Empresa contratada** : TelhaViva Lda (3 orçamentos comparados, escolha mais económica)\n- **Montante aprovado** : 18 500 € (IVA incluído)\n- **Financiamento** : Fundo comum reserva 50 % + chamada extraordinária 50 % proporcional permilagem\n- **Prazo execução** : Início 15/09/2025, conclusão prevista 30/11/2025\n- **Maioria obtida** : 78 % das permilagens (art.º 1432.º-A CC — maioria qualificada para obras na cobertura)\n\nA sua quota-parte da chamada extraordinária (fração D, 100 ‰) é de **925 €**, exigível em 3 prestações trimestrais a partir de 01/07/2025. Pode consultar o seu saldo atualizado no Portal do Condómino.\n\nFico à disposição para qualquer esclarecimento adicional.\n\nCumprimentos,\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.88, suggested_next_actions: ['enviar_ata_pdf', 'enviar_extrato_conta'] },
  },
  {
    from_email: 'carlos.mendes@hotmail.com',
    subject: 'Quotas em atraso — pedido parcelamento',
    body_preview: 'Olá,\n\nSou o Carlos Mendes, fração B (1.º Direito) do Edifício Atlântico. Sei que tenho 3 prestações de quotas em atraso (cerca de 540 €) e peço desculpa pela situação. Atravesso uma fase financeira difícil temporariamente.\n\nGostaria de saber se é possível negociar um plano de pagamento em 6 prestações mensais. Quero regularizar isto sem entrar em contencioso. Posso comprometer-me a pagar 90 € por mês a partir de junho.\n\nObrigado pela compreensão,\nCarlos Mendes\n914 526 871',
    received_at: isoHoursAgo(18),
    type_demande: 'questao_financeira',
    urgence: 'haute',
    resume_court: 'Pedido parcelamento de quotas em atraso (540 €) em 6 prestações de 90 €. Edifício Atlântico, fração B.',
    immeuble_detecte: 'Edifício Atlântico',
    locataire_detecte: 'Carlos Mendes',
    draft_subject: 'Re: Quotas em atraso — pedido parcelamento',
    draft_body_text: 'Bom dia Sr. Mendes,\n\nAgradeço a sua transparência e o gesto de querer regularizar a situação fora do âmbito contencioso. Confirmo o saldo em dívida :\n\n- Quota Q4 2025 : 185 € (em atraso desde 31/12/2025)\n- Quota Q1 2026 : 185 € (em atraso desde 31/03/2026)\n- Quota Q2 2026 : 170 € (em atraso desde 30/06/2026)\n- Juros legais acumulados (8 % anual) : ~ 22 €\n- **Total : 562 €**\n\n**Proposta de plano de pagamento (acordo escrito ao abrigo do art.º 1424.º CC) :**\n- 6 prestações mensais de **93,70 €**\n- Primeira prestação : 30/06/2026 (PRT0626)\n- Última prestação : 30/11/2026\n- Suspensão da escalada contencioso enquanto plano cumprido\n- Em caso de incumprimento de uma prestação : reativação automática do processo (art.º 6.º DL 268/94)\n\nVou anexar o contrato de acordo de pagamento em PDF para a sua assinatura. Pode assinar digitalmente via Chave Móvel Digital (assinatura qualificada eIDAS).\n\nObrigado pela sua honestidade — é assim que mantemos a comunidade saudável.\n\nCumprimentos,\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.85, suggested_next_actions: ['gerar_acordo_pagamento_pdf', 'suspender_cobranca_judicial', 'agendar_lembrete_primeira_prestacao'] },
  },
  {
    from_email: 'bruno.tavares@silva-canalizacoes.pt',
    subject: 'Relatório intervenção 22/05 — Foz Douro + fatura',
    body_preview: 'Bom dia,\n\nEm anexo o relatório técnico da intervenção realizada no dia 22/05/2026 no Edifício Foz Douro (R/C — coluna principal de canalização).\n\nDetalhes :\n- Substituição de troço PEX 25mm (1,80m)\n- Vedação junta T parede WC partes comuns\n- Teste pressão : OK (10 bar, 30 min)\n- Tempo intervenção : 3h30\n- Material : 78,50 € (NIF fatura nº 2026/0418)\n- Mão de obra : 175 €\n- **Total fatura : 311,30 € (IVA incluído 23%)**\n\nFica disponível para qualquer dúvida.\n\nBruno Tavares\nSilva Canalizações Lda\nNIF 509 234 567',
    received_at: isoDaysAgo(1),
    type_demande: 'fatura_fornecedor',
    urgence: 'normale',
    resume_court: 'Relatório + fatura 311,30€ intervenção canalização R/C Foz Douro (22/05/2026).',
    immeuble_detecte: 'Edifício Foz Douro',
    locataire_detecte: null,
    draft_subject: 'Re: Relatório intervenção 22/05 — Foz Douro + fatura',
    draft_body_text: 'Bom dia Bruno,\n\nObrigado pelo relatório detalhado e pela rapidez na intervenção.\n\nA fatura nº 2026/0418 (311,30 €) foi recebida e classificada no nosso sistema. Vou proceder ao :\n\n1. **Submissão à AT via e-Fatura** (NIF condomínio + NIF Silva Canalizações)\n2. **Imputação contabilística** : conta 6233 — Manutenção corrente, Edifício Foz Douro\n3. **Pagamento programado** : transferência SEPA para 30 dias (data limite 22/06/2026)\n\nO relatório técnico será arquivado no GED do edifício (Documentos → Foz Douro → Intervenções → 2026-05) e fica disponível para os condóminos consultarem via Portal.\n\nAté à próxima intervenção,\n\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.94, suggested_next_actions: ['validar_fatura_efatura', 'agendar_pagamento_sepa', 'arquivar_relatorio_ged'] },
  },
  {
    from_email: 'agendamento@otis-portugal.pt',
    subject: 'Inspeção elevador obrigatória — Edifício Atlântico (DL 320/2002)',
    body_preview: 'Bom dia,\n\nConforme registo no nosso sistema, o elevador OTIS instalado no Edifício Atlântico (contrato 2018-PT-4421) tem inspeção periódica obrigatória prevista para 15/09/2026 (DL 320/2002 art.º 5.º — periodicidade 2 anos).\n\nPropomos as seguintes datas para agendamento :\n- 14/09/2026 (sexta-feira) — 9h00-12h00\n- 16/09/2026 (segunda-feira) — 14h00-17h00\n- 23/09/2026 (segunda-feira) — 9h00-12h00\n\nDuração estimada : 3 horas. Custo : 285 € + IVA (conforme contrato 2018-PT-4421).\n\nConfirme por favor a data preferida. O técnico responsável será o Eng.º João Almeida.\n\nCumprimentos,\nDepartamento Agendamentos\nOTIS Portugal',
    received_at: isoDaysAgo(2),
    type_demande: 'agendamento',
    urgence: 'normale',
    resume_court: 'OTIS propõe 3 datas para inspeção obrigatória elevador Edifício Atlântico (DL 320/2002).',
    immeuble_detecte: 'Edifício Atlântico',
    locataire_detecte: null,
    draft_subject: 'Re: Inspeção elevador obrigatória — Edifício Atlântico',
    draft_body_text: 'Bom dia,\n\nObrigado pela proposta de agendamento.\n\nConfirmo a inspeção periódica do elevador do Edifício Atlântico (contrato 2018-PT-4421) para a data :\n\n**16/09/2026 (segunda-feira), 14h00-17h00**\n\nO motivo da escolha : compatibilidade com a presença do nosso técnico interno e ausência de tráfego significativo no edifício (horário pós-laboral).\n\nVou notificar os condóminos com 7 dias de antecedência via Quadro de Avisos e WhatsApp/SMS, conforme prática habitual (acesso limitado nas escadas).\n\nA fatura prevista (285 € + IVA = 350,55 €) será imputada à conta 6244 — Inspeções regulamentares, Edifício Atlântico.\n\nPara qualquer eventualidade, deixo o contacto direto do nosso técnico responsável :\n- Bruno Tavares (Silva Canalizações) — 935 100 002\n\nFico a aguardar a confirmação final.\n\nCumprimentos,\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.96, suggested_next_actions: ['agendar_no_planeamento', 'criar_aviso_condominos', 'imputar_orcamento_2026'] },
  },
  {
    from_email: 'maria.costa.cedofeita@gmail.com',
    subject: 'Pintura corredor com humidade — quando reparam ?',
    body_preview: 'Boa tarde,\n\nSou a Maria Costa, fração C do Residencial Cedofeita (2.º Esq). Há semanas que noto manchas de humidade no corredor partes comuns do 2.º andar, especialmente perto da minha porta. A tinta começou a empolar.\n\nReportei isto já em 2 ocasiões à administração anterior mas nada foi feito. Posso esperar uma data para resolução ?\n\nObrigada,\nMaria Costa\n911 200 388',
    received_at: isoDaysAgo(3),
    type_demande: 'reclamacao',
    urgence: 'haute',
    resume_court: 'Reclamação humidade corredor 2.º andar Residencial Cedofeita. Já reportado anteriormente sem ação.',
    immeuble_detecte: 'Residencial Cedofeita',
    locataire_detecte: 'Maria Costa',
    draft_subject: 'Re: Pintura corredor com humidade — quando reparam ?',
    draft_body_text: 'Boa tarde Sra. Costa,\n\nLamento profundamente o atraso na resolução deste problema, e agradeço a sua paciência. Tomei conhecimento das duas reclamações anteriores e vou tratar pessoalmente o assunto.\n\n**Plano de ação aprovado :**\n\n1. **Vistoria técnica** : esta semana (24-28/05) — agendamento com o nosso pedreiro **Miguel Santos (Construsantos)** para identificar a origem da humidade (infiltração cobertura ? ruptura canalização parede ?)\n2. **Orçamento reparação** : preparação de 3 orçamentos comparativos (DL 268/94 art.º 6.º) numa semana\n3. **Decisão financiamento** : se < 1 500 €, autorização sem AG ; se > 1 500 €, convocação AG extraordinária\n4. **Execução** : prazo máximo 30 dias após decisão\n\nFico a confirmar consigo qual o dia/hora mais conveniente para a vistoria técnica (estará em casa esta semana ?). Em paralelo, vou solicitar ao Eng.º que examine também a humidade pela cobertura — pois sendo o 2.º andar, pode tratar-se de uma infiltração que afeta também a cobertura.\n\nO seguro multirriscos Fidelidade (apólice MR-CED-2025-089) será notificado caso a origem seja acidental.\n\nA partir de hoje, recebe-me notificações de cada passo no Portal do Condómino.\n\nCumprimentos sinceros,\nGabinete VitFix Portugal',
    draft_status: 'pending_review',
    draft_meta: { confidence: 0.91, suggested_next_actions: ['criar_missao_vistoria_humidade', 'solicitar_3_orcamentos', 'notificar_seguro', 'agendar_visita_tecnica'] },
  },
  {
    from_email: 'crypto.deals2026@suspeito-domain.xyz',
    subject: 'GANHE 50 000 € em 7 dias com criptos!!!',
    body_preview: 'OPORTUNIDADE ÚNICA !!! Investidores procurados para projeto bitcoin com retorno 800 % garantido. Clique aqui para receber código exclusivo de acesso à plataforma...',
    received_at: isoDaysAgo(4),
    type_demande: 'spam',
    urgence: 'baixa',
    resume_court: 'Spam — phishing crypto.',
    immeuble_detecte: null,
    locataire_detecte: null,
    draft_subject: null,
    draft_body_text: null,
    draft_status: 'none',
    draft_meta: { spam_confidence: 0.99 },
  },
]

// ════════════════════════════════════════════════════════════════════════════
// MAIN — Insertion
// ════════════════════════════════════════════════════════════════════════════
;(async () => {
  console.log(`\n══ Seeding démo agents IA pour user ${USER_ID} ══\n`)

  // ── 1. Vérifier que l'user existe et est syndic_role ─────────────────────
  const { data: userInfo, error: userErr } = await supabase.auth.admin.getUserById(USER_ID)
  if (userErr || !userInfo?.user) {
    console.error('User introuvable :', userErr?.message)
    process.exit(1)
  }
  const role = userInfo.user.app_metadata?.role || ''
  if (!['syndic', 'super_admin'].includes(role) && !role.startsWith('syndic_')) {
    console.error(`User n'a pas le rôle syndic (current: "${role}"). Promouvoir d'abord via scripts/setup-admin-accounts.cjs`)
    process.exit(1)
  }
  console.log(`✓ User ${userInfo.user.email} (role: ${role})\n`)

  // ── 2. Insertion conversations Léa ────────────────────────────────────────
  if (process.env.SKIP_LEA === '1') {
    console.log('── Conversations Léa : SKIPPED (SKIP_LEA=1) ──')
  } else {
  console.log('── Insertion conversations Léa ──')
  for (const conv of LEA_CONVERSATIONS) {
    const createdAt = isoDaysAgo(conv.daysAgo)
    const { data: convRow, error: convErr } = await supabase
      .from('syndic_ai_conversations')
      .insert({
        syndic_id: USER_ID,
        agent_id: 'lea',
        locale: LOCALE,
        title: conv.title,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select()
      .single()

    if (convErr) {
      console.error(`✗ Conv "${conv.title}" :`, convErr.message)
      continue
    }
    console.log(`✓ Conv créée : "${conv.title}" (${convRow.id})`)

    // Insertion messages
    const msgRows = conv.messages.map((m, i) => ({
      conversation_id: convRow.id,
      role: m.role,
      content: m.content,
      created_at: new Date(new Date(createdAt).getTime() + i * 60_000).toISOString(),
    }))
    const { error: msgErr } = await supabase.from('syndic_ai_messages').insert(msgRows)
    if (msgErr) console.error(`  ✗ Messages :`, msgErr.message)
    else console.log(`  ✓ ${msgRows.length} messages insérés`)
  }
  }

  // ── 3. Insertion emails Alfredo ───────────────────────────────────────────
  console.log('\n── Insertion emails Alfredo ──')
  for (const email of ALFREDO_EMAILS) {
    const { error: emailErr } = await supabase
      .from('syndic_emails_analysed')
      .insert({
        syndic_id: USER_ID,
        from_email: email.from_email,
        subject: email.subject,
        body_preview: email.body_preview,
        gmail_message_id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        received_at: email.received_at,
        type_demande: email.type_demande,
        urgence: email.urgence,
        resume_ia: email.resume_court,
        immeuble_detecte: email.immeuble_detecte,
        locataire_detecte: email.locataire_detecte,
        draft_subject: email.draft_subject,
        draft_body_text: email.draft_body_text,
        draft_body_html: email.draft_body_text ? `<div>${email.draft_body_text.replace(/\n/g, '<br>')}</div>` : null,
        draft_status: email.draft_status,
        draft_generated_at: email.draft_status === 'pending_review' ? email.received_at : null,
        draft_meta: email.draft_meta,
      })

    if (emailErr) console.error(`✗ Email "${email.subject}" :`, emailErr.message)
    else console.log(`✓ Email "${email.subject.slice(0, 60)}…"`)
  }

  console.log('\n══ Terminé ══\n')
})().catch(err => { console.error('FATAL :', err); process.exit(1) })
