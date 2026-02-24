import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Max IA — Assistant Expert Syndic VitFix Pro ────────────────────────────────
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

function buildSystemPrompt(ctx: any, userRole: string): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']

  // Sérialisation données cabinet
  const immeublesStr = (ctx.immeubles || []).map((i: any) =>
    `  • ${i.nom} (${i.ville}) — ${i.nbLots} lots — Budget: ${i.budgetAnnuel?.toLocaleString('fr-FR')}€ — Dépensé: ${i.depensesAnnee?.toLocaleString('fr-FR')}€ (${i.pctBudget}%)`
  ).join('\n')

  const artisansStr = (ctx.artisans || []).map((a: any) =>
    `  • ${a.nom} [${a.metier}] — Statut: ${a.statut} — RC Pro: ${a.rcProValide ? `✅ valide jusqu'au ${a.rcProExpiration}` : '❌ EXPIRÉE'} — Note: ${a.note}/5${a.vitfixCertifie ? ' — ⭐ VitFix Certifié' : ''}`
  ).join('\n')

  const missionsStr = (ctx.missions || []).map((m: any) =>
    `  • [${m.priorite?.toUpperCase()}] ${m.immeuble} → ${m.artisan} — ${m.type}: ${m.description} — Statut: ${m.statut}${m.dateIntervention ? ` — Intervention: ${m.dateIntervention}` : ''}${m.montantDevis ? ` — Devis: ${m.montantDevis?.toLocaleString('fr-FR')}€` : ''}`
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
  const actionsSection = `
## Tes capacités d'action (exécutables directement)
Tu peux agir dans l'application en incluant une balise ACTION dans ta réponse.
**N'inclus une ACTION que si l'utilisateur te demande explicitement de faire quelque chose.**

${roleConfig.actions.includes('create_mission') ? `**Créer une mission ou assigner une tâche à un artisan** :
Pour créer une mission simple (sans artisan précis) :
##ACTION##{"type":"create_mission","immeuble":"nom exact","artisan":"nom artisan","description":"description précise","priorite":"urgente|normale|planifiee","type_travaux":"type"}##

Pour ASSIGNER DIRECTEMENT une mission sur l'agenda d'un artisan (avec date et email artisan connus) :
##ACTION##{"type":"assign_mission","artisan":"nom complet artisan","artisan_email":"email@artisan.fr","description":"description précise","type_travaux":"Élagage|Plomberie|etc","date_intervention":"2026-03-10","immeuble":"nom lieu","lieu":"lieu alternatif","priorite":"normale","notes":"infos supplémentaires"}##

IMPORTANT pour les dictées vocales — si l'utilisateur dit par exemple :
"Lepore Sebastien intervention élagage 10 mars parc corot" → extrais :
- artisan = "Sebastien Lepore" (ou tel que prononcé)
- type_travaux = "Élagage"
- date_intervention = "2026-03-10" (convertir la date orale en ISO)
- lieu/immeuble = "Parc Corot"
- Cherche l'email de l'artisan dans la liste des artisans du cabinet ci-dessous

Liste des artisans avec emails disponibles dans le cabinet :
${(ctx.artisans || []).map((a: any) => `  • ${a.nom} [${a.metier}] — email: ${a.email || 'non renseigné'}${a.artisan_user_id ? ' ✅ compte VitFix lié' : ''}`).join('\n') || '  (aucun artisan enregistré)'}
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

  return `Tu es **Max ${roleConfig.emoji}**, l'assistant IA VitFix Pro pour ${roleConfig.name}.

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
- ${ctx.immeubles?.length || 0} immeuble(s) — ${stats.totalBudget?.toLocaleString('fr-FR')}€ budget total — ${stats.totalDepenses?.toLocaleString('fr-FR')}€ dépensé
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
function generateFallback(message: string, ctx: any, userRole: string): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}
  const roleConfig = ROLE_CONFIGS[userRole] || ROLE_CONFIGS['syndic']

  if (msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes || []).filter((a: any) => a.urgence === 'haute')
    if (alerts.length === 0) return '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} alerte(s) urgente(s) :**\n\n${alerts.map((a: any) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget') || msg.includes('dépense') || msg.includes('finance')) {
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    return `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString('fr-FR')}€ / ${stats.totalBudget?.toLocaleString('fr-FR')}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission')) {
    return `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions || []).slice(0, 3).map((m: any) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('rc pro')) {
    const expired = (ctx.artisans || []).filter((a: any) => !a.rcProValide)
    return expired.length > 0
      ? `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a: any) => `- **${a.nom}** (${a.metier})`).join('\n')}\n\n📌 Action requise : suspendre jusqu'au renouvellement.`
      : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  return `🤖 **Max ${roleConfig.emoji} — ${roleConfig.name}**\n\nJe suis votre assistant IA VitFix Pro. Configurez la clé GROQ_API_KEY pour activer l'IA complète.\n\nJe peux vous aider sur :\n- Vos missions et artisans\n- Vos budgets et alertes\n- La rédaction de courriers\n- La réglementation copropriété`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(ip, 40, 60_000)) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = user.user_metadata?.role || 'syndic'

    const body = await request.json()
    const { message, syndic_context = {}, conversation_history = [] } = body

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
        response: generateFallback(message, syndic_context, userRole),
        fallback: true,
      })
    }

    const systemPrompt = buildSystemPrompt(syndic_context, userRole)

    const historyMessages = limitedHistory
      .filter((m: any) => m.role && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).substring(0, 3000) }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.25,   // Plus précis pour les données réelles
        max_tokens: 3000,    // Plus de tokens pour les documents longs
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq Max error:', groqRes.status, errText)
      return NextResponse.json({
        response: generateFallback(message, syndic_context, userRole),
        fallback: true,
      })
    }

    const groqData = await groqRes.json()
    let response: string = groqData.choices?.[0]?.message?.content || 'Je n\'ai pas pu générer une réponse. Réessayez.'

    // Extraire l'action si présente
    let action: any = null
    const actionMatch = response.match(/##ACTION##([\s\S]*?)##/)
    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1])
        response = response.replace(/##ACTION##[\s\S]*?##/g, '').trim()
      } catch {
        // Ignore les actions malformées
      }
    }

    return NextResponse.json({ response, action, role: userRole })

  } catch (err: any) {
    console.error('Max AI error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
