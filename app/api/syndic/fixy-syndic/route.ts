import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, type GroqResponse } from '@/lib/groq'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Fixy — Assistant Expert Syndic Vitfix Pro ────────────────────────────────
// Modèle : llama-3.3-70b-versatile (Groq)
// Capacités : contexte complet cabinet + actions directes + mémoire + multi-rôles

// Labels et contexte par rôle
const ROLE_CONFIGS: Record<string, { name: string; emoji: string; expertise: string; pages: string[]; actions: string[] }> = {
  syndic: {
    name: 'Administrateur Cabinet',
    emoji: '🏢',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    pages: ['missions', 'alertes', 'coproprios', 'reglementaire', 'rapport', 'immeubles', 'artisans', 'planning', 'documents', 'emails', 'parametres', 'facturation', 'equipe', 'comptabilite_tech'],
    actions: ['create_mission', 'navigate', 'create_alert', 'update_mission', 'send_message', 'create_document'],
  },
  syndic_admin: {
    name: 'Administrateur Cabinet',
    emoji: '👑',
    expertise: 'Administration complète du cabinet, gestion financière, juridique, équipe, artisans, copropriétaires',
    pages: ['missions', 'alertes', 'coproprios', 'reglementaire', 'rapport', 'immeubles', 'artisans', 'planning', 'documents', 'emails', 'parametres', 'facturation', 'equipe'],
    actions: ['create_mission', 'navigate', 'create_alert', 'update_mission', 'send_message', 'create_document'],
  },
  syndic_tech: {
    name: 'Gestionnaire Technique',
    emoji: '🔧',
    expertise: 'Interventions techniques, artisans, missions, suivi travaux, comptabilité technique, analyse devis/factures, facturation, copropriétaires, immeubles, emails, proof of work',
    pages: ['accueil', 'immeubles', 'coproprios', 'artisans', 'missions', 'docs_interventions', 'comptabilite_tech', 'analyse_devis', 'facturation', 'planning', 'alertes', 'emails'],
    actions: ['create_mission', 'navigate', 'update_mission', 'send_message', 'create_alert'],
  },
  syndic_secretaire: {
    name: 'Secrétaire',
    emoji: '📋',
    expertise: 'Correspondances, emails, copropriétaires, convocations AG, documents administratifs, accueil',
    pages: ['coproprios', 'emails', 'documents', 'planning', 'alertes', 'missions'],
    actions: ['navigate', 'create_document', 'send_message', 'create_alert'],
  },
  syndic_gestionnaire: {
    name: 'Gestionnaire Copropriété',
    emoji: '🏘️',
    expertise: 'Gestion copropriétés, immeubles, réglementaire, assemblées générales, contentieux, artisans, facturation, emails copropriétaires',
    pages: ['immeubles', 'coproprios', 'artisans', 'missions', 'planning', 'reglementaire', 'alertes', 'documents', 'facturation', 'emails'],
    actions: ['create_mission', 'navigate', 'create_alert', 'create_document', 'send_message'],
  },
  syndic_comptable: {
    name: 'Comptable',
    emoji: '💶',
    expertise: 'Comptabilité syndic, budgets prévisionnels, appels de charges, factures, rapports financiers, impayés',
    pages: ['facturation', 'rapport', 'documents', 'immeubles'],
    actions: ['navigate', 'create_document'],
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function buildSystemPrompt(ctx: Record<string, any>, userRole: string, locale?: string): string {
  const now = new Date()
  const fmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const today = now.toLocaleDateString(fmtLocale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
  const todayISO = now.toISOString().split('T')[0]

  // Pré-calculer les dates relatives pour éviter les erreurs du LLM
  const joursNoms = locale === 'pt'
    ? ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
    : ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const dateMapping: string[] = []
  // "aujourd'hui" / "hoje" et "demain" / "amanhã"
  if (locale === 'pt') {
    dateMapping.push(`  - "hoje" = ${todayISO} (${joursNoms[now.getDay()]})`)
    const amanha = new Date(now); amanha.setDate(amanha.getDate() + 1)
    dateMapping.push(`  - "amanhã" = ${amanha.toISOString().split('T')[0]} (${joursNoms[amanha.getDay()]})`)
  } else {
    dateMapping.push(`  - "aujourd'hui" = ${todayISO} (${joursNoms[now.getDay()]})`)
    const demain = new Date(now); demain.setDate(demain.getDate() + 1)
    dateMapping.push(`  - "demain" = ${demain.toISOString().split('T')[0]} (${joursNoms[demain.getDay()]})`)
  }
  // Prochains 7 jours par nom de jour
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i)
    const jourNom = joursNoms[d.getDay()]
    const iso = d.toISOString().split('T')[0]
    dateMapping.push(`  - "${jourNom}" = ${iso}`)
  }
  // "la semaine prochaine" / "próxima semana" versions
  const nextWeekMonday = new Date(now)
  const dayOfWeek = nextWeekMonday.getDay()
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek
  nextWeekMonday.setDate(nextWeekMonday.getDate() + daysUntilNextMonday)
  if (locale === 'pt') {
    dateMapping.push(`  - "próxima semana" = segunda-feira ${nextWeekMonday.toISOString().split('T')[0]}`)
  } else {
    dateMapping.push(`  - "semaine prochaine" = lundi ${nextWeekMonday.toISOString().split('T')[0]}`)
  }

  const dateMappingStr = dateMapping.join('\n')

  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']

  // Sérialisation données cabinet
  const immeublesStr = (ctx.immeubles || []).map((i: any) =>
    `  • ${i.nom} (${i.ville}) — ${i.nbLots} lots — Budget: ${i.budgetAnnuel?.toLocaleString(fmtLocale)}€ — ${locale === 'pt' ? 'Gasto' : 'Dépensé'}: ${i.depensesAnnee?.toLocaleString(fmtLocale)}€ (${i.pctBudget}%)`
  ).join('\n')

  const artisansStr = (ctx.artisans || []).map((a: any) =>
    `  • ${a.nom} [${a.metier}] — ${locale === 'pt' ? 'Estado' : 'Statut'}: ${a.statut} — RC Pro: ${a.rcProValide ? `✅ ${locale === 'pt' ? 'válido até' : 'valide jusqu\'au'} ${a.rcProExpiration}` : `❌ ${locale === 'pt' ? 'EXPIRADO' : 'EXPIRÉE'}`} — ${locale === 'pt' ? 'Nota' : 'Note'}: ${a.note}/5${a.vitfixCertifie ? ' — ⭐ Vitfix Certifié' : ''}`
  ).join('\n')

  const missionsStr = (ctx.missions || []).map((m: any) =>
    `  • [${m.priorite?.toUpperCase()}] ${m.immeuble} → ${m.artisan} — ${m.type}: ${m.description} — ${locale === 'pt' ? 'Estado' : 'Statut'}: ${m.statut}${m.dateIntervention ? ` — ${locale === 'pt' ? 'Intervenção' : 'Intervention'}: ${m.dateIntervention}` : ''}${m.montantDevis ? ` — ${locale === 'pt' ? 'Orçamento' : 'Devis'}: ${m.montantDevis?.toLocaleString(fmtLocale)}€` : ''}`
  ).join('\n')

  const alertesStr = (ctx.alertes || []).map((a: any) =>
    `  • [${a.urgence?.toUpperCase()}] ${a.message}`
  ).join('\n')

  const echeancesStr = (ctx.echeances || []).slice(0, 10).map((e: any) =>
    `  • ${e.immeuble} — ${e.label}: ${e.dateEcheance}`
  ).join('\n')

  const documentsStr = (ctx.documents || []).slice(0, 10).map((d: any) =>
    `  • [${d.type}] ${d.nom} — ${d.immeuble || 'Cabinet'} — ${d.date}`
  ).join('\n')

  const stats = ctx.stats || {}
  const pagesDisponibles = roleConfig.pages.join(', ')
  const actionsDisponibles = roleConfig.actions.join(', ')

  // Actions disponibles selon le rôle
  const artisanListForLLM = (ctx.artisans || []).map((a: any) => `  • ${a.nom} — email: ${a.email || 'non renseigné'} — métier: ${a.metier || '?'}${a.artisan_user_id ? ' ✅ lié' : ''}`).join('\n') || '  (aucun artisan enregistré)'

  const actionsSection = `
## Tes capacités d'action (exécutables directement)
Tu peux agir dans l'application en incluant une balise ACTION dans ta réponse.
**N'inclus une ACTION que si l'utilisateur te demande explicitement de faire quelque chose.**

${roleConfig.actions.includes('create_mission') ? `**🔴 RÈGLE ABSOLUE POUR LES MISSIONS :**
- Si l'utilisateur mentionne un NOM D'ARTISAN → utilise TOUJOURS type "assign_mission" (JAMAIS "create_mission")
- Utilise "create_mission" UNIQUEMENT quand AUCUN artisan n'est mentionné
- Même si l'utilisateur dit "créer une mission pour X" → c'est un assign_mission car il y a un artisan

**Mission SANS artisan précis** (rare) :
##ACTION##{"type":"create_mission","immeuble":"nom exact","description":"description précise","priorite":"urgente|normale|planifiee","type_travaux":"type"}##

**Mission AVEC artisan (= assignation — cas le plus fréquent)** :
##ACTION##{"type":"assign_mission","artisan":"nom complet artisan","artisan_email":"email@artisan.fr","description":"description précise","type_travaux":"Élagage|Plomberie|etc","date_intervention":"YYYY-MM-DD","immeuble":"nom lieu","priorite":"normale","notes":"infos supplémentaires"}##

**Champs obligatoires pour assign_mission :**
- artisan : le nom tel que dicté par l'utilisateur
- artisan_email : CHERCHE dans la liste ci-dessous et COPIE l'email exact. Si introuvable, mets ""
- description : ce qui est demandé
- date_intervention : **UTILISE OBLIGATOIREMENT** la table de conversion ci-dessous. Si aucune date dite, utilise ${todayISO}

**📅 TABLE DE CONVERSION DES DATES (NE PAS CALCULER SOI-MÊME) :**
${dateMappingStr}
⚠️ UTILISE TOUJOURS les dates de cette table. Ne calcule JAMAIS une date toi-même.
- type_travaux : le type déduit de la description
- priorite : "normale" par défaut, "urgente" si mots-clés urgence/urgent/en urgence

**EXEMPLES de dictée vocale → action :**
"Lepore Sebastien élagage 10 mars parc corot" →
##ACTION##{"type":"assign_mission","artisan":"Lepore Sebastien","artisan_email":"(chercher dans liste)","description":"Élagage","type_travaux":"Élagage","date_intervention":"2026-03-10","immeuble":"Parc Corot","priorite":"normale"}##

"Créer une mission pour Dupont plomberie urgente" →
##ACTION##{"type":"assign_mission","artisan":"Dupont","artisan_email":"(chercher dans liste)","description":"Intervention plomberie","type_travaux":"Plomberie","date_intervention":"${new Date().toISOString().split('T')[0]}","priorite":"urgente"}##

**📋 LISTE DES ARTISANS DU CABINET (cherche l'email ici) :**
${artisanListForLLM}
` : ''}
${roleConfig.actions.includes('navigate') ? `**Naviguer vers une page** :
##ACTION##{"type":"navigate","page":"nom_page"}##
Pages disponibles : ${pagesDisponibles}
` : ''}
${roleConfig.actions.includes('create_alert') ? `**Créer une alerte** :
##ACTION##{"type":"create_alert","message":"texte alerte","urgence":"haute|moyenne|basse"}##
` : ''}
${roleConfig.actions.includes('update_mission') ? `**Mettre à jour une mission** :
##ACTION##{"type":"update_mission","mission_id":"id","statut":"en_cours|terminee|annulee"}##
` : ''}
${roleConfig.actions.includes('send_message') ? `**Envoyer un message à un artisan** :
##ACTION##{"type":"send_message","artisan":"nom artisan","content":"message"}##
` : ''}
${roleConfig.actions.includes('create_document') ? `**Créer un document** :
##ACTION##{"type":"create_document","type_doc":"convocation_ag|mise_en_demeure|courrier|rapport","destinataire":"nom ou copro","contenu":"texte complet"}##
` : ''}`

  if (locale === 'pt') {
    return `Tu és o **Fixy ${roleConfig.emoji}**, o assistente IA Vitfix Pro para ${roleConfig.name}.

LÍNGUA: Comunicas EXCLUSIVAMENTE em português europeu (PT-PT). Nunca uses português do Brasil. Usa sempre: "profissional" (nunca "artesão"), "orçamento", "obras", "remodelação", "casa de banho", "canalizador", "eletricista", "pedreiro", "condomínio", "fração", "administrador".

📅 Hoje: ${today}
👤 Função ativa: **${roleConfig.name}** — Gabinete "${ctx.cabinet?.nom || 'Gabinete'}"

## O teu perfil e especialização
${roleConfig.expertise}

És especialista em:
- **Direito do condomínio**: regulamento de condomínio, encargos, assembleia de condóminos, administração
- **Regulamentação técnica**: certificado energético, diagnósticos de amianto/chumbo, inspeções de elevadores/gás/eletricidade
- **Gestão de profissionais**: seguro de responsabilidade civil, certificações, ordens de serviço, receção de obras
- **Contabilidade de condomínio**: orçamento previsional, quotas, prestação de contas
- **Contencioso**: processos de dívida, notificações, cobranças, providências cautelares

## Compreensão vocal avançada
Compreendes e tratas perfeitamente:
- Ditados vocais (frases longas, com hesitações, reformulações)
- Abreviaturas orais e linguagem natural falada
- Termos técnicos pronunciados de forma aproximada
- Pedidos encadeados ("primeiro... e depois...")
- Responde sempre de forma fluida, natural, adaptada à leitura em voz alta
${actionsSection}

## Dados reais do gabinete "${ctx.cabinet?.nom || 'Gabinete'}" (${ctx.cabinet?.gestionnaire || 'Gestor'})

### 📊 Estatísticas globais
- ${ctx.immeubles?.length || 0} imóvel(eis) — ${stats.totalBudget?.toLocaleString(fmtLocale)}€ orçamento total — ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ gasto
- ${ctx.artisans?.length || 0} profissional(ais) — ${stats.artisansRcExpiree || 0} RC Pro expirado(s)
- ${ctx.missions?.length || 0} missão(ões) — ${stats.missionsUrgentes || 0} urgente(s)
- ${ctx.coproprios_count || 0} condómino(s)

### 🏢 Imóveis
${immeublesStr || '  (nenhum imóvel registado)'}

### 🔧 Profissionais
${artisansStr || '  (nenhum profissional registado)'}

### 📋 Missões
${missionsStr || '  (nenhuma missão)'}

### 🔔 Alertas
${alertesStr || '  (nenhum alerta)'}

### ⚖️ Prazos regulamentares
${echeancesStr || '  (nenhum prazo)'}

${documentsStr ? `### 📄 Documentos recentes\n${documentsStr}` : ''}

## Instruções de resposta
- Responde **sempre em português europeu (PT-PT)**
- Usa **markdown**: negrito, listas, tabelas para estruturar
- **Sê preciso e acionável**: números reais, prazos, artigos de lei
- Para **correspondência**: inclui cabeçalho completo, corpo, fórmula de cortesia, assinatura
- Para **análises**: conclui com recomendações numeradas e prioritárias
- Para **respostas vocais** (quando o utilizador fala): sê conciso, conversacional, evita listas demasiado longas
- Se detetares uma urgência nos dados, **sinaliza-a proativamente**
- Se o utilizador ditar um texto longo, trata-o como um pedido de criação de documento`
  }

  return `Tu es **Fixy ${roleConfig.emoji}**, l'assistant IA Vitfix Pro pour ${roleConfig.name}.

📅 Aujourd'hui : ${today}
👤 Rôle actif : **${roleConfig.name}** — Cabinet "${ctx.cabinet?.nom || 'Cabinet'}"

## Ton profil et expertise
${roleConfig.expertise}

Tu es expert en :
- **Droit de la copropriété** : loi ALUR, loi ELAN, règlement de copropriété, charges, AG, syndicat des copropriétaires
- **Réglementation technique** : DPE, diagnostics amiante/plomb, contrôles ascenseurs/gaz/électricité, ERP
- **Gestion des artisans** : RC Pro, qualifications RGE, Qualibat, ordres de mission, réception travaux
- **Comptabilité syndic** : budget prévisionnel, appels de charges, tantièmes, comptes rendus de gestion
- **Contentieux** : procédures impayés, mises en demeure, commandement de payer, référé-provision, PCSPE

## Compréhension vocale avancée
Tu comprendras et traiteras parfaitement :
- Les dictées vocales (phrases longues, avec hésitations, reformulations)
- Les abréviations orales et le langage naturel parlé
- Les termes techniques prononcés approximativement
- Les demandes enchaînées ("d'abord... et ensuite...")
- Toujours répondre de manière fluide, naturelle, adaptée à l'oral si la réponse sera lue à voix haute
${actionsSection}

## Données réelles du cabinet "${ctx.cabinet?.nom || 'Cabinet'}" (${ctx.cabinet?.gestionnaire || 'Gestionnaire'})

### 📊 Statistiques globales
- ${ctx.immeubles?.length || 0} immeuble(s) — ${stats.totalBudget?.toLocaleString(fmtLocale)}€ budget total — ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ dépensé
- ${ctx.artisans?.length || 0} artisan(s) — ${stats.artisansRcExpiree || 0} RC Pro expirée(s)
- ${ctx.missions?.length || 0} mission(s) — ${stats.missionsUrgentes || 0} urgente(s)
- ${ctx.coproprios_count || 0} copropriétaire(s)

### 🏢 Immeubles
${immeublesStr || '  (aucun immeuble enregistré)'}

### 🔧 Artisans
${artisansStr || '  (aucun artisan enregistré)'}

### 📋 Missions
${missionsStr || '  (aucune mission)'}

### 🔔 Alertes
${alertesStr || '  (aucune alerte)'}

### ⚖️ Échéances réglementaires
${echeancesStr || '  (aucune échéance)'}

${documentsStr ? `### 📄 Documents récents\n${documentsStr}` : ''}

## Instructions de réponse
- Réponds **toujours en français**
- Utilise le **markdown** : gras, listes, tableaux pour structurer
- **Sois précis et actionnable** : chiffres réels, délais, articles de loi
- Pour les **courriers** : inclus en-tête complet, corps, formule de politesse, signature
- Pour les **analyses** : conclus avec recommandations numérotées et prioritaires
- Pour les **réponses vocales** (quand l'utilisateur parle) : sois concis, conversationnel, évite les listes trop longues
- Si tu détectes une urgence dans les données, **signale-la proactivement**
- Si l'utilisateur dicte un long texte, traite-le comme une demande de création de document`
}

// ── Fallback sans API Groq ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Syndic context from frontend with dynamic shape
function generateFallback(message: string, ctx: Record<string, any>, userRole: string, locale?: string): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']
  const fmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  if (msg.includes('alerta') || msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes || []).filter((a: any) => a.urgence === 'haute')
    if (alerts.length === 0) return locale === 'pt' ? '✅ **Nenhum alerta urgente** neste momento.' : '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} alerta(s) urgente(s):**\n\n${alerts.map((a: any) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget') || msg.includes('orçamento') || msg.includes('dépense') || msg.includes('despesa') || msg.includes('finance') || msg.includes('finança')) {
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    if (locale === 'pt') {
      return `💶 **Orçamento global**: ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ / ${stats.totalBudget?.toLocaleString(fmtLocale)}€ (**${pct}% utilizado**)\n\n${pct > 80 ? '⚠️ Atenção: orçamento quase esgotado.' : '✅ Orçamento dentro dos limites.'}`
    }
    return `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString(fmtLocale)}€ / ${stats.totalBudget?.toLocaleString(fmtLocale)}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission') || msg.includes('missão') || msg.includes('missões')) {
    if (locale === 'pt') {
      return `📋 **Missões**: ${ctx.missions?.length || 0} no total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions || []).slice(0, 3).map((m: any) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan}: ${m.description}`).join('\n')}`
    }
    return `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions || []).slice(0, 3).map((m: any) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('profissional') || msg.includes('rc pro')) {
    const expired = (ctx.artisans || []).filter((a: any) => !a.rcProValide)
    if (locale === 'pt') {
      return expired.length > 0
        ? `⚠️ **${expired.length} profissional(ais) com RC Pro expirado:**\n\n${expired.map((a: any) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Ação necessária: suspender até renovação.`
        : `✅ Todos os profissionais têm **RC Pro válido**.`
    }
    return expired.length > 0
      ? `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a: any) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Action requise : suspendre jusqu'au renouvellement.`
      : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  if (locale === 'pt') {
    return `🤖 **Fixy ${roleConfig.emoji} — ${roleConfig.name}**\n\nSou o seu assistente IA Vitfix Pro. Configure a chave GROQ_API_KEY para ativar a IA completa.\n\nPosso ajudá-lo com:\n- As suas missões e profissionais\n- Os seus orçamentos e alertas\n- Redação de correspondência\n- Regulamentação de condomínio`
  }
  return `🤖 **Fixy ${roleConfig.emoji} — ${roleConfig.name}**\n\nJe suis votre assistant IA Vitfix Pro. Configurez la clé GROQ_API_KEY pour activer l'IA complète.\n\nJe peux vous aider sur :\n- Vos missions et artisans\n- Vos budgets et alertes\n- La rédaction de courriers\n- La réglementation copropriété`
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

    const body = await request.json()
    const { message, syndic_context = {}, conversation_history = [], locale } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message requis' }, { status: 400 })
    }

    // Ajouter le rôle dans le contexte
    syndic_context.user_role = userRole
    syndic_context.user_name = user.user_metadata?.full_name || user.email

    // Limiter l'historique (max 60 messages pour garder plus de contexte)
    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-60) : []

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, locale),
        fallback: true,
      })
    }

    const systemPrompt = buildSystemPrompt(syndic_context, userRole, locale)

    const historyMessages = limitedHistory
      .filter((m: any) => m.role && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).substring(0, 3000) }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    let groqData: GroqResponse
    try {
      groqData = await callGroqWithRetry({
        messages,
        temperature: 0.25,
        max_tokens: 4000,
      })
    } catch (err) {
      logger.error('Groq Fixy error:', err)
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole, locale),
        fallback: true,
      })
    }
    let response: string = groqData.choices?.[0]?.message?.content || (locale === 'pt' ? 'Não consegui gerar uma resposta. Tente novamente.' : 'Je n\'ai pas pu générer une réponse. Réessayez.')

    // Extraire l'action si présente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic AI action response
    let action: Record<string, any> | null = null
    const actionMatch = response.match(/##ACTION##([\s\S]*?)##/)
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1])
        response = response.replace(/##ACTION##[\s\S]*?##/g, '').trim()
        // Si le LLM n'a renvoyé que l'action sans texte, fournir un message par défaut
        if (!response && action) {
          const actionLabels: Record<string, string> = locale === 'pt' ? {
            create_mission: '📋 Missão preparada. Verifique os detalhes abaixo.',
            assign_mission: '📋 Missão atribuída preparada. Verifique os detalhes abaixo.',
            navigate: '🧭 A navegar...',
            create_alert: '🔔 Alerta preparado.',
            update_mission: '📝 Atualização de missão preparada.',
            send_message: '✉️ Mensagem preparada.',
            create_document: '📄 Documento preparado.',
          } : {
            create_mission: '📋 Mission préparée. Vérifiez les détails ci-dessous.',
            assign_mission: '📋 Mission assignée préparée. Vérifiez les détails ci-dessous.',
            navigate: '🧭 Navigation en cours...',
            create_alert: '🔔 Alerte préparée.',
            update_mission: '📝 Mise à jour de mission préparée.',
            send_message: '✉️ Message préparé.',
            create_document: '📄 Document préparé.',
          }
          response = actionLabels[action.type] || (locale === 'pt' ? '✅ Ação preparada. Verifique os detalhes abaixo.' : '✅ Action préparée. Vérifiez les détails ci-dessous.')
        }
      } catch {
        // Ignore les actions malformées
      }
    }

    return NextResponse.json({ response, action, role: userRole })

  } catch (err: unknown) {
    logger.error('[fixy-syndic] Error:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
