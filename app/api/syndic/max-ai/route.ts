import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Max IA — Assistant Expert Syndic VitFix Pro ────────────────────────────────
// Modèle : llama-3.3-70b-versatile (Groq, gratuit)
// Capacités : contexte complet cabinet + actions directes + markdown + mémoire complète

function buildSystemPrompt(ctx: any): string {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

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

  const stats = ctx.stats || {}

  return `Tu es **Max**, l'assistant IA expert VitFix Pro pour gestionnaires de copropriété et syndics professionnels.

📅 Aujourd'hui : ${today}

## Ton expertise
Tu es spécialisé en :
- **Droit de la copropriété** : loi ALUR, loi ELAN, règlement de copropriété, charges, AG
- **Réglementation technique** : DPE, diagnostics amiante/plomb, contrôles ascenseurs, ERP
- **Gestion artisans** : RC Pro, qualifications RGE, contentieux, ordres de mission
- **Comptabilité syndic** : budget prévisionnel, appels de charges, comptes rendus
- **Contentieux** : procédures impayés, mises en demeure, référé-provision

## Tes capacités d'action
Tu peux exécuter des actions directement dans l'application en incluant une balise spéciale dans ta réponse :

Pour **créer une mission** :
##ACTION##{"type":"create_mission","immeuble":"nom exact","artisan":"nom exact","description":"description précise","priorite":"urgente"}##

Pour **naviguer** vers une page :
##ACTION##{"type":"navigate","page":"missions"}##
Pages disponibles : missions, alertes, coproprios, reglementaire, rapport, immeubles, artisans, planning, documents, emails, parametres

Pour **créer une alerte** :
##ACTION##{"type":"create_alert","message":"texte alerte","urgence":"haute"}##

N'inclus la balise ACTION que si l'utilisateur te demande explicitement de faire une action.

## Données réelles du cabinet "${ctx.cabinet?.nom || 'Cabinet'}" (${ctx.cabinet?.gestionnaire || 'Gestionnaire'})

### 📊 Statistiques globales
- ${ctx.immeubles?.length || 0} immeuble(s) géré(s) — ${ctx.stats?.totalBudget?.toLocaleString('fr-FR')}€ budget total — ${ctx.stats?.totalDepenses?.toLocaleString('fr-FR')}€ dépensé
- ${ctx.artisans?.length || 0} artisan(s) — ${ctx.stats?.artisansRcExpiree || 0} RC Pro expirée(s)
- ${ctx.missions?.length || 0} mission(s) — ${ctx.stats?.missionsUrgentes || 0} urgente(s)
- ${ctx.coproprios_count || 0} copropriétaire(s) enregistré(s)

### 🏢 Immeubles
${immeublesStr || '  (aucun immeuble)'}

### 🔧 Artisans
${artisansStr || '  (aucun artisan)'}

### 📋 Missions en cours
${missionsStr || '  (aucune mission)'}

### 🔔 Alertes actives
${alertesStr || '  (aucune alerte)'}

### ⚖️ Prochaines échéances réglementaires
${echeancesStr || '  (aucune échéance)'}

## Instructions de réponse
- Réponds **toujours en français**
- Utilise le **markdown** : gras, listes, tableaux pour structurer les réponses longues
- Sois **précis et actionnable** : donne des chiffres réels, des délais, des articles de loi
- Pour les courriers : inclus l'en-tête, le corps et la formule de politesse complète
- Pour les analyses : donne une conclusion avec recommandations numérotées
- Si tu détectes une urgence dans les données (RC Pro expirée, budget dépassé, échéance imminente), mentionne-la proactivement`
}

// ── Fallback sans API Groq ────────────────────────────────────────────────────
function generateFallback(message: string, ctx: any): string {
  const msg = message.toLowerCase()
  const stats = ctx.stats || {}

  if (msg.includes('alerte') || msg.includes('urgent')) {
    const alerts = (ctx.alertes || []).filter((a: any) => a.urgence === 'haute')
    if (alerts.length === 0) return '✅ **Aucune alerte urgente** en ce moment.'
    return `🔴 **${alerts.length} alerte(s) urgente(s) :**\n\n${alerts.map((a: any) => `- ${a.message}`).join('\n')}`
  }

  if (msg.includes('budget')) {
    const pct = stats.totalBudget > 0 ? Math.round(stats.totalDepenses / stats.totalBudget * 100) : 0
    return `💶 **Budget global** : ${stats.totalDepenses?.toLocaleString('fr-FR')}€ / ${stats.totalBudget?.toLocaleString('fr-FR')}€ (**${pct}% consommé**)\n\n${pct > 80 ? '⚠️ Attention : budget proche de l\'épuisement.' : '✅ Budget dans les limites.'}`
  }

  if (msg.includes('mission')) {
    return `📋 **Missions** : ${ctx.missions?.length || 0} au total — ${stats.missionsUrgentes || 0} urgentes.\n\n${(ctx.missions || []).slice(0, 3).map((m: any) => `- **${m.priorite?.toUpperCase()}** — ${m.immeuble} → ${m.artisan} : ${m.description}`).join('\n')}`
  }

  if (msg.includes('artisan') || msg.includes('rc pro')) {
    const expired = (ctx.artisans || []).filter((a: any) => !a.rcProValide)
    return expired.length > 0
      ? `⚠️ **${expired.length} artisan(s) avec RC Pro expirée :**\n\n${expired.map((a: any) => `- **${a.nom}** (${a.metier}) — RC Pro expirée le ${a.rcProExpiration}`).join('\n')}\n\n📌 Action requise : suspendre ces artisans jusqu'au renouvellement.`
      : `✅ Tous les artisans ont une **RC Pro valide**.`
  }

  return `🤖 **Max — Assistant VitFix Pro**\n\nJe peux vous aider sur :\n\n**Vos données :**\n- Analyse budgets et dépenses par immeuble\n- État des missions et artisans\n- Alertes urgentes et échéances réglementaires\n\n**Actions :**\n- Créer des ordres de mission\n- Rédiger des courriers aux copropriétaires\n- Analyser vos risques juridiques\n\n*Configurer la clé GROQ_API_KEY pour activer l'IA complète.*`
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 30 req/min par IP
    const ip = getClientIP(request)
    if (!checkRateLimit(ip, 30, 60_000)) {
      return rateLimitResponse()
    }

    // Authentification — doit être un compte syndic
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, syndic_context = {}, conversation_history = [] } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message requis' }, { status: 400 })
    }

    // Limiter la taille de l'historique pour éviter les abus (max 50 messages)
    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-50) : []

    // Fallback sans clé API
    if (!GROQ_API_KEY) {
      return NextResponse.json({
        response: generateFallback(message, syndic_context),
        fallback: true,
      })
    }

    const systemPrompt = buildSystemPrompt(syndic_context)

    // Historique complet (toute la session, limité à 50)
    const historyMessages = (limitedHistory || [])
      .filter((m: any) => m.role && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).substring(0, 2000) }))

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
        temperature: 0.3,
        max_tokens: 2500,
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq Max error:', groqRes.status, errText)
      return NextResponse.json({
        response: generateFallback(message, syndic_context),
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
        // Nettoyer la balise de la réponse visible
        response = response.replace(/##ACTION##[\s\S]*?##/g, '').trim()
      } catch {
        // Ignore les actions malformées
      }
    }

    return NextResponse.json({ response, action })

  } catch (err: any) {
    console.error('Max AI error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
