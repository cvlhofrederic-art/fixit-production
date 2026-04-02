import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqStreaming, type GroqResponse } from '@/lib/groq'
import { logger } from '@/lib/logger'
import { validateBody, syndicMaxAiSchema } from '@/lib/validation'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Max — Expert-Conseil IA Syndic (lecture seule, pas d'actions) ─────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Rôle : conseiller expert copropriété, réglementation, comptabilité, contentieux

const ROLE_CONFIGS: Record<string, { name: string; namePt: string; emoji: string; expertise: string; expertisePt: string }> = {
  syndic: {
    name: 'Administrateur Cabinet', namePt: 'Administrador do Gabinete',
    emoji: '🏢',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    expertisePt: 'Administração completa do gabinete, gestão financeira, jurídica, equipa, artesãos, condóminos',
  },
  syndic_admin: {
    name: 'Administrateur Cabinet', namePt: 'Administrador do Gabinete',
    emoji: '👑',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    expertisePt: 'Administração completa do gabinete, gestão financeira, jurídica, equipa, artesãos, condóminos',
  },
  syndic_tech: {
    name: 'Gestionnaire Technique', namePt: 'Gestor Técnico',
    emoji: '🔧',
    expertise: 'Interventions techniques, artisans, missions, suivi travaux, comptabilité technique, analyse devis/factures, réglementation BTP',
    expertisePt: 'Intervenções técnicas, artesãos, missões, acompanhamento de obras, contabilidade técnica, análise orçamentos/faturas, regulamentação construção',
  },
  syndic_secretaire: {
    name: 'Secrétaire', namePt: 'Secretário(a)',
    emoji: '📋',
    expertise: 'Correspondances, emails, copropriétaires, convocations AG, documents administratifs',
    expertisePt: 'Correspondências, emails, condóminos, convocatórias AG, documentos administrativos',
  },
  syndic_gestionnaire: {
    name: 'Gestionnaire Copropriété', namePt: 'Gestor de Condomínio',
    emoji: '🏘️',
    expertise: 'Gestion copropriétés, immeubles, réglementaire, assemblées générales, contentieux, facturation',
    expertisePt: 'Gestão de condomínios, edifícios, regulamentação, assembleias gerais, contencioso, faturação',
  },
  syndic_comptable: {
    name: 'Comptable', namePt: 'Contabilista',
    emoji: '💶',
    expertise: 'Comptabilité syndic, budgets prévisionnels, appels de charges, factures, rapports financiers, impayés',
    expertisePt: 'Contabilidade condomínio, orçamentos previsionais, quotas, faturas, relatórios financeiros, dívidas',
  },
}

interface ImmeubleSummary { nom: string; ville: string; nbLots: number; budgetAnnuel?: number; depensesAnnee?: number; pctBudget: number | string }
interface ArtisanSummary { nom: string; metier: string; statut: string; rcProValide: boolean; rcProExpiration?: string; note: number; vitfixCertifie?: boolean }
interface MissionSummary { priorite?: string; immeuble: string; artisan: string; type: string; description: string; statut: string; dateIntervention?: string; montantDevis?: number }
interface AlerteSummary { urgence?: string; message: string }
interface EcheanceSummary { immeuble: string; label: string; dateEcheance: string }
interface DocumentSummary { type: string; nom: string; immeuble?: string; date: string }
interface CopropriSummary { prenom?: string; nom?: string; immeuble: string; batiment?: string; etage?: string; porte?: string; email?: string; telephone?: string; locataire?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function buildContextBlock(ctx: Record<string, any>, userRole: string, isPt: boolean): string {
  const loc = isPt ? 'pt-PT' : 'fr-FR'
  const today = new Date().toLocaleDateString(loc, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
  const roleName = isPt ? roleConfig.namePt : roleConfig.name
  const roleExpertise = isPt ? roleConfig.expertisePt : roleConfig.expertise

  const fmtN = (n: number | undefined) => (n || 0).toLocaleString(loc)

  const immeublesStr = (ctx.immeubles as ImmeubleSummary[] || []).map((i) =>
    `  • ${i.nom} (${i.ville}) — ${i.nbLots} ${isPt ? 'frações' : 'lots'} — ${isPt ? 'Orçamento' : 'Budget'}: ${fmtN(i.budgetAnnuel)}€ — ${isPt ? 'Gasto' : 'Dépensé'}: ${fmtN(i.depensesAnnee)}€ (${i.pctBudget}%)`
  ).join('\n')

  const artisansStr = (ctx.artisans as ArtisanSummary[] || []).map((a) =>
    `  • ${a.nom} [${a.metier}] — ${isPt ? 'Estado' : 'Statut'}: ${a.statut} — RC Pro: ${a.rcProValide ? `✅ ${isPt ? 'válido até' : 'valide jusqu\'au'} ${a.rcProExpiration}` : `❌ ${isPt ? 'EXPIRADO' : 'EXPIRÉE'}`} — ${isPt ? 'Nota' : 'Note'}: ${a.note}/5${a.vitfixCertifie ? ' — ⭐ Vitfix Certifié' : ''}`
  ).join('\n')

  const missionsStr = (ctx.missions as MissionSummary[] || []).map((m) =>
    `  • [${m.priorite?.toUpperCase()}] ${m.immeuble} → ${m.artisan} — ${m.type}: ${m.description} — ${isPt ? 'Estado' : 'Statut'}: ${m.statut}${m.dateIntervention ? ` — ${isPt ? 'Intervenção' : 'Intervention'}: ${m.dateIntervention}` : ''}${m.montantDevis ? ` — ${isPt ? 'Orçamento' : 'Devis'}: ${fmtN(m.montantDevis)}€` : ''}`
  ).join('\n')

  const alertesStr = (ctx.alertes as AlerteSummary[] || []).map((a) =>
    `  • [${a.urgence?.toUpperCase()}] ${a.message}`
  ).join('\n')

  const echeancesStr = (ctx.echeances as EcheanceSummary[] || []).slice(0, 10).map((e) =>
    `  • ${e.immeuble} — ${e.label}: ${e.dateEcheance}`
  ).join('\n')

  const documentsStr = (ctx.documents as DocumentSummary[] || []).slice(0, 10).map((d) =>
    `  • [${d.type}] ${d.nom} — ${d.immeuble || (isPt ? 'Gabinete' : 'Cabinet')} — ${d.date}`
  ).join('\n')

  const copropriosStr = (ctx.coproprios as CopropriSummary[] || []).slice(0, 30).map((c) =>
    `  • ${c.prenom || ''} ${c.nom || ''} — ${c.immeuble}${c.batiment ? `, ${isPt ? 'Bloco' : 'Bât.'} ${c.batiment}` : ''}${c.etage ? `, ${c.etage}${isPt ? 'º andar' : 'e ét.'}` : ''}${c.porte ? `, ${isPt ? 'Porta' : 'Porte'} ${c.porte}` : ''}${c.email ? ` — ${c.email}` : ''}${c.telephone ? ` — ${c.telephone}` : ''}${c.locataire ? ` — ${isPt ? 'Inquilino' : 'Locataire'}: ${c.locataire}` : ''}`
  ).join('\n')

  const stats = ctx.stats || {}
  const coproCount = ctx.coproprios?.length || 0

  const noData = isPt ? '  (sem dados)' : '  (aucune donnée)'

  return `📅 ${isPt ? 'Hoje' : 'Aujourd\'hui'} : ${today}
👤 ${isPt ? 'Função ativa' : 'Rôle actif'} : **${roleName}** — ${isPt ? 'Gabinete' : 'Cabinet'} "${ctx.cabinet?.nom || (isPt ? 'Gabinete' : 'Cabinet')}"

## ${isPt ? 'Perfil e especialidade' : 'Profil et expertise'}
${roleExpertise}

## ${isPt ? 'Dados reais do gabinete' : 'Données réelles du cabinet'} "${ctx.cabinet?.nom || (isPt ? 'Gabinete' : 'Cabinet')}"

### 📊 ${isPt ? 'Estatísticas globais' : 'Statistiques globales'}
- ${ctx.immeubles?.length || 0} ${isPt ? 'edifício(s)' : 'immeuble(s)'} — ${fmtN(stats.totalBudget)}€ ${isPt ? 'orçamento total' : 'budget total'} — ${fmtN(stats.totalDepenses)}€ ${isPt ? 'gasto' : 'dépensé'}
- ${ctx.artisans?.length || 0} ${isPt ? 'artesão(s)' : 'artisan(s)'} — ${stats.artisansRcExpiree || 0} RC Pro ${isPt ? 'expirado(s)' : 'expirée(s)'}
- ${ctx.missions?.length || 0} ${isPt ? 'missão(ões)' : 'mission(s)'} — ${stats.missionsUrgentes || 0} ${isPt ? 'urgente(s)' : 'urgente(s)'}
- ${coproCount} ${isPt ? 'condómino(s)' : 'copropriétaire(s)'}

### 🏢 ${isPt ? 'Edifícios' : 'Immeubles'}
${immeublesStr || noData}

### 🔧 ${isPt ? 'Artesãos' : 'Artisans'}
${artisansStr || noData}

### 📋 ${isPt ? 'Missões' : 'Missions'}
${missionsStr || noData}

### 🔔 ${isPt ? 'Alertas' : 'Alertes'}
${alertesStr || noData}

### ⚖️ ${isPt ? 'Prazos regulamentares' : 'Échéances réglementaires'}
${echeancesStr || noData}

### 👥 ${isPt ? 'Condóminos' : 'Copropriétaires'}
${copropriosStr || noData}

${documentsStr ? `### 📄 ${isPt ? 'Documentos recentes' : 'Documents récents'}\n${documentsStr}` : ''}`
}

function buildFrSystemPrompt(ctx: Record<string, any>, userRole: string): string {
  return `Tu es **Max 🎓**, l'expert-conseil IA du cabinet pour ${(ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']).name}.

⚠️ IMPORTANT : Tu es un conseiller en LECTURE SEULE. Tu ne peux PAS exécuter d'actions (créer de mission, naviguer, etc.).
Si l'utilisateur te demande d'exécuter une action, oriente-le vers **Fixy** (le petit robot jaune en bas à droite du dashboard) qui est l'assistant d'action.

${buildContextBlock(ctx, userRole, false)}

## Ton expertise juridique française
- **Droit de la copropriété** : loi ALUR, loi ELAN, règlement de copropriété, charges, AG, syndicat des copropriétaires, tantièmes, parties communes/privatives
- **Réglementation technique** : DPE, diagnostics amiante/plomb, contrôles ascenseurs/gaz/électricité, ERP, normes DTU, accessibilité PMR
- **Gestion des artisans** : RC Pro, décennale, qualifications RGE, Qualibat, ordres de mission, réception travaux, garantie de parfait achèvement
- **Comptabilité syndic** : budget prévisionnel, appels de charges, tantièmes, comptes rendus de gestion, fonds travaux (loi ALUR art. 14-2)
- **Contentieux** : procédures impayés, mises en demeure, commandement de payer, référé-provision, PCSPE, délais de prescription
- **Assemblées générales** : convocations (art. 9 décret 1967), majorités art. 24/25/25-1/26, procurations, procès-verbaux
- **Assurances** : multirisque immeuble, dommages-ouvrage, RC copropriété, franchise, sinistres

## Instructions de réponse
- Réponds **toujours en français**
- Utilise le **markdown** : gras, listes, tableaux pour structurer
- **Sois précis et actionnable** : cite les articles de loi, les délais légaux, les montants
- Pour les **courriers** : inclus en-tête complet, corps, formule de politesse, signature
- Pour les **analyses juridiques** : conclus avec recommandations numérotées et prioritaires
- Si tu détectes une urgence ou anomalie dans les données, **signale-la proactivement**
- Ne propose JAMAIS de balise ##ACTION## — tu n'as pas cette capacité
- Si on te demande de faire une action, réponds : "Je suis Max, votre expert-conseil. Pour exécuter cette action, utilisez **Fixy** 🤖 (bulle jaune en bas à droite)."

## Génération de documents PDF officiels
Quand l'utilisateur demande de **créer, rédiger ou préparer un document officiel** (notification formelle, convocation AG, mise en demeure, courrier officiel, PV de constatation, autorisation de travaux, appel de charges, lettre de relance, etc.) :
1. Rédige d'abord le contenu complet du document en markdown dans ta réponse
2. **À LA FIN de ta réponse**, ajoute un bloc JSON entre les balises \`[DOC_PDF]\` et \`[/DOC_PDF]\` avec cette structure EXACTE :
\`\`\`
[DOC_PDF]{"type":"notification_formelle","title":"NOTIFICATION FORMELLE","objet":"Objet du document","destinataire":{"nom":"DUPONT","prenom":"Jean","immeuble":"Résidence Les Oliviers","batiment":"A","etage":"3","porte":"12"},"corps":["Madame, Monsieur,","Premier paragraphe du document.","Deuxième paragraphe avec les détails."],"references":["Art. 25 Loi 65-557","Art. 14-2 Loi ALUR"],"formule_politesse":"Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées."}[/DOC_PDF]
\`\`\`
3. **UTILISE les données réelles** des copropriétaires et immeubles du contexte ci-dessus
4. Si l'immeuble ou le destinataire n'est PAS clairement spécifié dans la demande, laisse les champs \`destinataire.immeuble\`, \`destinataire.nom\` et \`destinataire.prenom\` **VIDES** (chaînes vides "") — l'utilisateur les sélectionnera dans la fenêtre de confirmation avant la génération du PDF
5. Remplis **toujours** le champ \`objet\` avec un objet pertinent et descriptif
6. La date sera automatiquement la date du jour — ne la mets **PAS** dans le JSON
7. Types supportés : notification_formelle, convocation_ag, mise_en_demeure, courrier_officiel, pv_constatation, autorisation_travaux, appel_charges, lettre_relance
8. Le bloc [DOC_PDF] est INVISIBLE pour l'utilisateur — il sert uniquement à générer le PDF. N'explique PAS sa présence.`
}

function buildPtSystemPrompt(ctx: Record<string, any>, userRole: string): string {
  return `Tu és o **Max 🎓**, o consultor especialista IA do gabinete para ${(ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']).namePt}.

⚠️ IMPORTANTE: És um consultor de LEITURA APENAS. NÃO podes executar ações (criar missões, navegar, etc.).
Se o utilizador te pedir para executar uma ação, encaminha-o para o **Fixy** (o pequeno robô amarelo no canto inferior direito do dashboard) que é o assistente de ação.

${buildContextBlock(ctx, userRole, true)}

## A tua especialidade jurídica portuguesa
- **Direito do condomínio** : Código Civil Português Art.º 1414.º a 1438.º-A, Lei 8/2022 (regime do condomínio), regulamento do condomínio, quotas, assembleias, administrador, permilagem, partes comuns/frações autónomas
- **Regulamentação técnica** : SCE/Certificação Energética (DL 101-D/2020), amianto, inspeção elevadores (DL 320/2002), gás, eletricidade, SCIE (DL 220/2008), RGEU, RJUE (DL 555/99)
- **Gestão de artesãos** : seguro RC profissional, alvará InCI/IMPIC, qualificações, ordens de serviço, receção de obras
- **Contabilidade condomínio** : orçamento previsional, quotas ordinárias/extraordinárias, fundo comum de reserva (DL 268/94 art.4.º — mínimo 10%), declaração de encargos (Lei 8/2022)
- **Contencioso** : dívidas de quotas, notificações formais, injunção, ação executiva, prescrição 5 anos (Art.º 310.º CC)
- **Assembleias gerais** : convocatórias (Art.º 1432.º CC), maiorias Art.º 1432.º/1433.º, procurações, atas, videoconferência (Lei 8/2022)
- **Seguros** : seguro obrigatório contra incêndio (Art.º 1429.º CC), multirriscos, RC condomínio, sinistros
- **Fiscal** : IVA 23% standard / 13% intermédio / 6% reduzido, NIF obrigatório, IVA obras reabilitação 6%
- **Proteção de dados** : RGPD + Lei 58/2019, CNPD (NÃO CNIL)

## Instruções de resposta
- Responde **sempre em português europeu (PT-PT)**. NUNCA uses termos brasileiros.
- Usa **markdown** : negrito, listas, tabelas para estruturar
- **Sê preciso e acionável** : cita os artigos de lei, os prazos legais, os montantes
- Para **cartas/notificações** : inclui cabeçalho completo, corpo, fórmula de cortesia, assinatura
- Para **análises jurídicas** : conclui com recomendações numeradas e prioritárias
- Se detetares uma urgência ou anomalia nos dados, **sinaliza-a proativamente**
- NUNCA proponhas ações — não tens essa capacidade
- REGRA ABSOLUTA: NUNCA cites loi ALUR, Code civil français, CNIL, NF DTU, Qualibat, RGE, garantie décennale française, DPE collectif
- Se te pedirem para executar uma ação, responde: "Sou o Max, o vosso consultor especialista. Para executar essa ação, utilizem o **Fixy** 🤖 (bolha amarela no canto inferior direito)."

## Geração de documentos PDF oficiais
Quando o utilizador pedir para **criar, redigir ou preparar um documento oficial** (notificação formal, convocatória AG, intimação, carta oficial, auto de constatação, autorização de obras, chamada de quotas, carta de cobrança, etc.):
1. Redige primeiro o conteúdo completo do documento em markdown na tua resposta
2. **NO FINAL da tua resposta**, adiciona um bloco JSON entre as tags \`[DOC_PDF]\` e \`[/DOC_PDF]\` com esta estrutura EXATA:
\`\`\`
[DOC_PDF]{"type":"notificacao_formal","title":"NOTIFICAÇÃO FORMAL","objet":"Assunto do documento","destinataire":{"nom":"SILVA","prenom":"João","immeuble":"Edifício Oliveiras","batiment":"A","etage":"3","porte":"12"},"corps":["Exmo(a) Sr(a),","Primeiro parágrafo do documento.","Segundo parágrafo com os detalhes."],"references":["Art.º 1432.º CC","Lei 8/2022"],"formule_politesse":"Com os melhores cumprimentos,"}[/DOC_PDF]
\`\`\`
3. **UTILIZA os dados reais** dos condóminos e edifícios do contexto acima
4. Se o condomínio ou destinatário NÃO estiver claramente especificado no pedido, deixa os campos \`destinataire.immeuble\`, \`destinataire.nom\` e \`destinataire.prenom\` **VAZIOS** (strings vazias "") — o utilizador irá selecioná-los na janela de confirmação antes da geração do PDF
5. Preenche **sempre** o campo \`objet\` com um assunto pertinente e descritivo
6. A data será automaticamente a de hoje — NÃO a incluas no JSON
7. Tipos suportados: notificacao_formal, convocatoria_ag, intimacao, carta_oficial, auto_constatacao, autorizacao_obras, chamada_quotas, carta_cobranca
8. O bloco [DOC_PDF] é INVISÍVEL para o utilizador — serve apenas para gerar o PDF. NÃO expliques a sua presença.`
}

// ── Fallback sans API Groq ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function generateFallback(message: string, ctx: Record<string, any>, userRole: string, isPt: boolean): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
  const roleName = isPt ? roleConfig.namePt : roleConfig.name

  if (msg.includes('alerta') || msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes as AlerteSummary[] || []).filter((a) => a.urgence === 'haute')
    if (alerts.length === 0) return isPt ? '✅ **Nenhum alerta urgente** de momento.' : '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} ${isPt ? 'alerta(s) urgente(s)' : 'alerte(s) urgente(s)'} :**\n\n${alerts.map((a) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget') || msg.includes('orçamento') || msg.includes('dépense') || msg.includes('despesa') || msg.includes('finance') || msg.includes('finanç')) {
    const loc = isPt ? 'pt-PT' : 'fr-FR'
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    return isPt
      ? `💶 **Orçamento global** : ${stats.totalDepenses?.toLocaleString(loc)}€ / ${stats.totalBudget?.toLocaleString(loc)}€ (**${pct}% consumido**)\n\n${pct > 80 ? '⚠️ Atenção: orçamento próximo do limite.' : '✅ Orçamento dentro dos limites.'}`
      : `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString(loc)}€ / ${stats.totalBudget?.toLocaleString(loc)}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission') || msg.includes('missão') || msg.includes('intervenção')) {
    return isPt
      ? `📋 **Missões** : ${ctx.missions?.length || 0} no total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
      : `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions as MissionSummary[] || []).slice(0, 3).map((m) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('artesão') || msg.includes('rc pro')) {
    const expired = (ctx.artisans as ArtisanSummary[] || []).filter((a) => !a.rcProValide)
    return expired.length > 0
      ? isPt
        ? `⚠️ **${expired.length} artesão(s) com RC Pro expirado :**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Ação necessária: suspender até renovação.`
        : `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Action requise : suspendre jusqu'au renouvellement.`
      : isPt
        ? `✅ Todos os artesãos têm **RC Pro válido**.`
        : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  return isPt
    ? `🎓 **Max — Consultor Especialista ${roleName}**\n\nSou o vosso consultor especialista IA. Configure a chave GROQ_API_KEY para ativar a IA completa.\n\nPosso aconselhar-vos sobre:\n- Direito do condomínio (Código Civil, Lei 8/2022)\n- Regulamentação técnica (SCE, RGEU, SCIE)\n- Gestão de artesãos\n- Contabilidade condomínio\n- Contencioso e procedimentos`
    : `🎓 **Max — Expert-Conseil ${roleName}**\n\nJe suis votre expert-conseil IA. Configurez la clé GROQ_API_KEY pour activer l'IA complète.\n\nJe peux vous conseiller sur :\n- Le droit de la copropriété\n- La réglementation technique\n- La gestion des artisans\n- La comptabilité syndic\n- Les contentieux et procédures`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 40, 60_000))) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = user.user_metadata?.role || 'syndic'

    const rawBody = await request.json()
    const v = validateBody(syndicMaxAiSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- syndic_context has dynamic shape
    const syndic_context = (v.data.syndic_context || {}) as Record<string, any>
    const { message, conversation_history = [], locale, stream } = v.data

    const isPt = locale === 'pt'

    syndic_context.user_role = userRole
    syndic_context.user_name = user.user_metadata?.full_name || user.email

    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-40) : []

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, isPt),
        fallback: true,
      })
    }

    const systemPrompt = isPt
      ? buildPtSystemPrompt(syndic_context, userRole)
      : buildFrSystemPrompt(syndic_context, userRole)

    const historyMessages = limitedHistory
      .filter((m: { role?: string; content?: string }) => m.role && m.content)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: String(m.content).substring(0, 3000) }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    // ── Mode streaming SSE ──
    if (stream) {
      try {
        const sseStream = await callGroqStreaming({
          messages,
          temperature: 0.4,
          max_tokens: 4000,
        })
        return new Response(sseStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (err) {
        logger.error('[max-ai] Streaming error:', err)
        return NextResponse.json({
          response: generateFallback(message, syndic_context, userRole, isPt),
          fallback: true,
        })
      }
    }

    // ── Mode classique (rétrocompatibilité) ──
    let groqData: GroqResponse
    try {
      groqData = await callGroqWithRetry({
        messages,
        temperature: 0.4,
        max_tokens: 4000,
      })
    } catch (err) {
      logger.error('Groq Max error:', err)
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, isPt),
        fallback: true,
      })
    }

    const fallbackMsg = isPt
      ? 'Não consegui gerar uma resposta. Tente novamente.'
      : 'Je n\'ai pas pu générer une réponse. Réessayez.'

    const response: string = groqData.choices?.[0]?.message?.content || fallbackMsg

    return NextResponse.json({ response, role: userRole })

  } catch (err: unknown) {
    logger.error('[max-ai] Error:', err)
    const errMsg = 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
