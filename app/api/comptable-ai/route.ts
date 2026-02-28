import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'

export const maxDuration = 30

// Agent Comptable Léa — Powered by Groq (Llama 3.3-70B)
// Expert-comptable senior BTP & artisanat — tous statuts juridiques — législation française 2026

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

function buildSystemPrompt(ctx: any): string {
  const currentYear = new Date().getFullYear()
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // ── Sérialisation de toutes les interventions terminées
  const bookingLines = (ctx.allBookings || [])
    .filter((b: any) => b.status === 'completed')
    .map((b: any) => {
      const client = b.clientName || 'Client'
      const service = b.serviceName || 'Intervention'
      const ht = b.price_ht ?? (b.price_ttc ? b.price_ttc / 1.2 : 0)
      const ttc = b.price_ttc ?? 0
      const tva = ttc - ht
      return `  ${b.booking_date} | ${service} | Client: ${client} | HT: ${fmt(ht)} | TVA: ${fmt(tva)} | TTC: ${fmt(ttc)} | Durée: ${b.duration_minutes ?? '?'}min | Adresse: ${b.address ?? '-'}`
    })
    .join('\n')

  // ── Sérialisation de toutes les charges
  const expenseLines = (ctx.allExpenses || [])
    .map((e: any) =>
      `  ${e.date} | ${e.category} | ${e.label} | ${fmt(parseFloat(e.amount ?? 0))}${e.notes ? ` | Note: ${e.notes}` : ''}`
    )
    .join('\n')

  // ── Calculs synthétiques de référence rapide
  const annualHT = ctx.annualCAHT ?? 0
  const annualCA = ctx.annualCA ?? 0
  const totalExpenses = ctx.totalExpenses ?? 0

  // Taux selon statut détecté (micro-entrepreneur par défaut)
  // URSSAF 2026 BTP : 21,2% CA HT (taux micro-entrepreneur artisan)
  const tauxURSSAF = 0.212
  // IR libératoire micro BIC : 1,7%
  const tauxIR = 0.017
  const urssaf = annualHT * tauxURSSAF
  const ir = annualHT * tauxIR
  const cfe = 200 // estimation forfaitaire minimale CFE
  const net = annualHT - urssaf - ir - totalExpenses - cfe
  // Plafonds 2026 micro-entrepreneur artisan (services & BTP) :
  // CA max : 77 700 € (prestation de services)
  // Franchise TVA : 37 500 € (seuil franchise en base)
  const plafondMicro = 77700
  const seuilTVA = 37500
  const plafondPct = annualHT > 0 ? ((annualHT / plafondMicro) * 100).toFixed(1) : '0'
  const tvaSeuil = annualHT > seuilTVA ? '⚠️ DÉPASSE le seuil franchise TVA (37 500 €) — TVA obligatoire' : `✅ Sous le seuil franchise TVA (${fmt(seuilTVA)})`

  // Déclarations trimestrielles
  const quarterLines = (ctx.quarterData || [0, 0, 0, 0])
    .map((ca: number, q: number) => {
      const u = ca * tauxURSSAF
      const i = ca * tauxIR
      const echeance = ['30 avril', '31 juillet', '31 octobre', '31 janvier N+1'][q]
      return `  T${q + 1} : CA HT ${fmt(ca)} → URSSAF ${fmt(u)} + IR ${fmt(i)} = ${fmt(u + i)} (échéance ${echeance})`
    })
    .join('\n')

  return `Tu es **Léa**, agent IA se comportant exactement comme un **expert-comptable senior** spécialisé dans toutes les sociétés du secteur du **bâtiment et de l'artisanat**, y compris les entreprises de construction, rénovation, dératisation, plomberie, électricité, menuiserie, peinture et autres métiers artisanaux en France.

📅 Aujourd'hui : ${today}

Tu gères et conseilles intégralement la comptabilité, la fiscalité, le suivi financier et les obligations légales, pour **tous types de statuts : auto-entrepreneurs, SARL, SAS, EURL, micro-entreprises ou sociétés classiques**, tout en restant pratique, clair et conforme à la **législation française 2026**.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DONNÉES FINANCIÈRES RÉELLES DE L'ENTREPRISE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CA TTC annuel ${currentYear}    : ${fmt(annualCA)}
CA HT annuel ${currentYear}     : ${fmt(annualHT)}
Charges totales         : ${fmt(totalExpenses)}
URSSAF estimé (21,2%)   : ${fmt(urssaf)}
IR libératoire (1,7%)   : ${fmt(ir)}
CFE (estimation)        : ${fmt(cfe)}
Résultat net estimé     : ${fmt(net)}
Plafond micro utilisé   : ${plafondPct}% / 77 700 €
Franchise TVA           : ${tvaSeuil}
${annualHT > 65000 ? '🚨 ALERTE : Proche du plafond micro (77 700 €) — anticiper passage au régime réel !' : ''}

Déclarations trimestrielles ${currentYear} :
${quarterLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TOUTES LES INTERVENTIONS TERMINÉES (brut, ligne par ligne)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format : Date | Service | Client | HT | TVA | TTC | Durée | Adresse
${bookingLines || '  (Aucune intervention terminée enregistrée)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 TOUTES LES CHARGES (brut, ligne par ligne)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Format : Date | Catégorie | Libellé | Montant | Notes
${expenseLines || '  (Aucune charge enregistrée)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ TES DOMAINES DE COMPÉTENCE (OBLIGATOIRES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1️⃣ Comptabilité quotidienne et gestion financière
- Classer et organiser toutes les factures clients et fournisseurs, y compris devis et bons de chantier.
- Vérifier la conformité des montants, dates, mentions légales et TVA sur les factures.
- Suivre les règlements clients et fournisseurs, relances si nécessaire.
- Gérer les notes de frais, justificatifs et avances sur chantier.
- Catégoriser toutes les transactions selon le plan comptable adapté à chaque type de société.
- Suivre les stocks, matériels ou consommables si applicables.

### 2️⃣ Déclarations fiscales et sociales
- Calculer les cotisations sociales pour tous types de statuts : URSSAF (21,2% BTP micro 2026), régime général, TNS.
- Préparer et simuler l'IR (micro : abattement 50% BIC services / 71% BIC ventes / versement libératoire 1,7%) ou l'IS selon structure.
- TVA : collecte (20% neuf, 10% rénovation logement >2 ans, 5,5% éco-travaux), récupération, franchise en base (seuil 37 500 €/2026), TVA intracommunautaire.
- Autres taxes BTP : CFE (cotisation foncière), CVAE (supprimée 2024), taxe foncière professionnelle.
- Déclarations mensuelles (CA12), trimestrielles (CA3), annuelles (2042C PRO, 2031, liasse fiscale).

### 3️⃣ Analyse financière et reporting
- Calculer CA, bénéfice net, marge par chantier ou activité.
- Trésorerie et prévisions financières mensuelles et annuelles.
- Identifier anomalies, risques fiscaux ou optimisations possibles.
- Tableaux de synthèse, graphiques et reporting pour dirigeants ou partenaires financiers.
- Seuil de rentabilité (point mort), délai de récupération, ROI chantier.

### 4️⃣ Conseil stratégique et optimisation
- Conseiller sur la meilleure structure juridique selon activité et CA (micro → EI → EURL → SASU → SARL).
- Optimiser charges sociales et fiscales : choix régime TVA, déductions, amortissements (régime réel).
- Aides et subventions : ACRE (exonération 1ère année), CEE (certificats éco-énergie), MaPrimeRénov (pour travaux clients), prêts BPI, crédit impôt formation.
- Gestion bancaire, assurances professionnelles obligatoires (RC Décennale, Biennale, RC Pro, PJ Pro).
- Impact fiscal et social d'une embauche (salarié vs sous-traitant vs gérant associé).
- Épargne retraite : contrat Madelin (régime réel uniquement), PER individuel.

### 5️⃣ Documentation et conformité légale
- Dossier complet prêt à transmettre aux administrations.
- Conformité mentions légales sur devis/factures (SIRET, RCS/RM, TVA, assurance décennale, délai paiement).
- Checklists mensuelles, trimestrielles et annuelles.
- Conservation des justificatifs : 10 ans pour les documents comptables (L.123-22 C.com).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️ RÉFÉRENTIEL TECHNIQUE BTP 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Taux URSSAF 2026 micro-entrepreneur artisan :** 21,2% CA HT
**Taux URSSAF 2026 micro-entrepreneur commerce :** 12,3% CA HT
**IR libératoire BIC services :** 1,7% | BIC ventes : 1,0% | BNC : 2,2%
**Plafond micro BIC services/BTP :** 77 700 € CA HT
**Plafond micro BIC ventes :** 188 700 € CA HT
**Franchise TVA :** 37 500 € (seuil 2026, majoré 41 250 € tolérance)
**TVA rénovation logement >2 ans :** 10% (art. 279-0 bis CGI)
**TVA éco-rénovation (isolation, PAC, fenêtres) :** 5,5% (art. 278-0 bis CGI)
**TVA travaux neufs / local professionnel :** 20%
**Barème km 2026 :** 0,541€/km (≤5CV) | 0,635€/km (6CV) | 0,679€/km (7CV+)
**CFE min nationale :** 227 € (2026, variable par commune)
**ACRE 2026 :** -50% cotisations URSSAF l'année de création
**Assurance décennale :** obligatoire art. L.241-1 Code des assurances
**Assurance RC Pro :** fortement recommandée, déductible à 100%
**Sous-traitance :** contrat obligatoire >600€, loi 75-1334 du 31/12/1975
**Délai paiement inter-entreprises :** 30 jours max (60 jours accord contractuel) — L.441-10 C.com
**Pénalités retard :** taux BCE + 10 points + indemnité forfaitaire 40€ — D.441-5 C.com
**Plan comptable BTP :** 601 (achats mat.), 604 (sous-traitance), 615 (entretien), 616 (assurance), 622 (honoraires comptable), 623 (pub), 625 (déplacements), 626 (télécom), 641 (salaires), 645 (charges sociales), 706 (prestation), 707 (vente marchandises)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 RÈGLES DE CALCUL SUR PÉRIODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quand l'artisan demande une analyse "du X au Y" ou "sur le mois de Z" :
1. Filtre les lignes dont la date est comprise dans la période demandée
2. Somme les montants par catégorie
3. Affiche le total ET la liste détaillée des lignes incluses
4. Calcule les implications fiscales si pertinent
5. Propose des optimisations concrètes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ FORMAT DE SORTIE RECOMMANDÉ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- **Explications claires et détaillées** pour chaque calcul et décision fiscale
- **Tableaux, checklists et synthèses** pour faciliter le suivi
- **Gras** pour tous les chiffres clés et montants
- Anticipe les erreurs possibles et propose des solutions concrètes
- Sois rigoureux, fiable, pédagogique et pratique comme un expert-comptable humain senior
- Reste **à jour avec la législation française 2026**
- Structure tes réponses avec des sections claires (emoji + titre)
- Fournis TOUJOURS le calcul détaillé quand un montant est demandé
- Si données insuffisantes : explique précisément ce qu'il faut saisir
- Conseils d'optimisation fiscale/sociale proactifs après chaque réponse
- NE te présente PAS à chaque message (seulement au premier)
- Adapte le niveau de détail : synthèse si question simple, analyse complète si question complexe`
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 20 req/min
    const ip = getClientIP(request)
    if (!checkRateLimit(ip, 20, 60_000)) return rateLimitResponse()

    // Auth
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { message, financialContext, conversationHistory, messages: directMessages, systemPrompt: customSystemPrompt } = body

    // ── Mode direct (agent copropriété) : messages + systemPrompt fournis directement ──
    if (directMessages && Array.isArray(directMessages)) {
      const systemPrompt = customSystemPrompt || buildSystemPrompt({})
      const messages = [
        { role: 'system', content: systemPrompt },
        ...directMessages.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
      ]

      if (!GROQ_API_KEY) {
        return NextResponse.json({ reply: '⚠️ Clé API Groq non configurée. Contactez l\'administrateur.' })
      }

      try {
        const groqData = await callGroqWithRetry({ messages, temperature: 0.15, max_tokens: 3500 })
        const reply = groqData.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.'
        return NextResponse.json({ reply })
      } catch (err) {
        console.error('Groq API error (direct mode):', err)
        return NextResponse.json({ reply: 'Erreur IA temporaire. Réessayez dans quelques instants.' }, { status: 500 })
      }
    }

    // ── Mode legacy (agent artisan) : message + financialContext ──
    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 })
    }

    const ctx = financialContext || {}
    const systemPrompt = buildSystemPrompt(ctx)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-10),
      { role: 'user', content: message },
    ]

    if (!GROQ_API_KEY) {
      return NextResponse.json({
        success: true,
        response: generateFallbackResponse(message, ctx),
        fallback: true,
      })
    }

    try {
      const groqData = await callGroqWithRetry({ messages, temperature: 0.2, max_tokens: 3000 })
      const response = groqData.choices?.[0]?.message?.content || 'Je n\'ai pas pu générer une réponse. Réessayez.'
      return NextResponse.json({ success: true, response })
    } catch {
      return NextResponse.json({
        success: true,
        response: generateFallbackResponse(message, ctx),
        fallback: true,
      })
    }

  } catch (error: any) {
    console.error('Comptable AI error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur', fallback: true })
  }
}

// ─── Fallback sans Groq ───────────────────────────────────────────────────────
function generateFallbackResponse(message: string, ctx: any): string {
  const msgLower = message.toLowerCase()
  const ht = ctx.annualCAHT || 0
  const totalExpenses = ctx.totalExpenses || 0
  const tauxURSSAF = 0.212
  const tauxIR = 0.017
  const urssaf = ht * tauxURSSAF
  const ir = ht * tauxIR
  const net = ht - urssaf - ir - totalExpenses - 200

  if (msgLower.includes('matériau') || msgLower.includes('matériaux') || msgLower.includes('matière')) {
    const matLines = (ctx.allExpenses || []).filter((e: any) => e.category === 'materiel')
    const total = matLines.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0)
    const lines = matLines.map((e: any) => `- ${e.date} : ${e.label} → **${fmt(parseFloat(e.amount || 0))}**`).join('\n')
    return `🔧 **Dépenses matériaux**\n\n**Total : ${fmt(total)}**\n\n${lines || '(Aucune dépense matériaux enregistrée)'}\n\n💡 **Optimisation :** Ces charges sont déductibles à 100% (compte 601). Conservez toutes les factures fournisseurs (10 ans). En régime réel, la TVA est récupérable.`
  }

  if (msgLower.includes('transport') || msgLower.includes('carburant') || msgLower.includes('km')) {
    const lines = (ctx.allExpenses || []).filter((e: any) => e.category === 'transport')
    const total = lines.reduce((s: number, e: any) => s + parseFloat(e.amount || 0), 0)
    return `🚗 **Dépenses transport**\n\n**Total : ${fmt(total)}**\n\n${lines.map((e: any) => `- ${e.date} : ${e.label} → **${fmt(parseFloat(e.amount || 0))}**`).join('\n') || '(Aucune dépense transport)'}\n\n💡 **Barème km 2026 :** 0,541€/km (≤5CV) | 0,635€/km (6CV) | 0,679€/km (7CV+). Notez chaque trajet professionnel avec date, départ, arrivée et motif.`
  }

  if (msgLower.includes('urssaf') || msgLower.includes('cotisation')) {
    const quarters = ctx.quarterData || [0, 0, 0, 0]
    return `💳 **Cotisations URSSAF 2026**\n\nCA HT annuel : **${fmt(ht)}**\nTaux artisan BTP : **21,2%**\n\n**Total URSSAF : ${fmt(urssaf)}**\n\nDétail par trimestre :\n${quarters.map((ca: number, q: number) => `  T${q + 1} : CA ${fmt(ca)} → URSSAF **${fmt(ca * tauxURSSAF)}** + IR **${fmt(ca * tauxIR)}**`).join('\n')}\n\n💡 **Rappel :** Déclaration et paiement sur autoentrepreneur.urssaf.fr. ACRE = -50% l'année de création.`
  }

  if (msgLower.includes('bénéfice') || msgLower.includes('net') || msgLower.includes('résultat')) {
    return `📊 **Résultat net estimé ${new Date().getFullYear()}**\n\nCA HT : **${fmt(ht)}**\n− Charges déductibles : **${fmt(totalExpenses)}**\n− URSSAF (21,2%) : **${fmt(urssaf)}**\n− IR libératoire (1,7%) : **${fmt(ir)}**\n− CFE (estimation) : **200 €**\n\n**= Résultat net : ${fmt(net)}**\n\n💡 **Conseil :** Marge nette de ${ht > 0 ? ((net / ht) * 100).toFixed(1) : 0}%. Standard BTP artisan : 15-25%. En dessous de 15% → revoir tarifs ou charges.`
  }

  if (msgLower.includes('tva') || msgLower.includes('taxe')) {
    const seuilTVA = 37500
    const etat = ht > seuilTVA ? `⚠️ **DÉPASSEMENT** du seuil franchise TVA (${fmt(seuilTVA)}) — vous DEVEZ facturer la TVA` : `✅ Sous le seuil franchise TVA (${fmt(seuilTVA)}) — TVA non applicable (art. 293B CGI)`
    return `💶 **TVA BTP 2026**\n\n${etat}\n\nTaux applicables :\n- **10%** : Travaux rénovation logement >2 ans (art. 279-0 bis CGI)\n- **5,5%** : Éco-rénovation (isolation, PAC, fenêtres RE2020) — art. 278-0 bis CGI\n- **20%** : Construction neuve, locaux professionnels\n\n💡 Seuil franchise 2026 : **37 500 €** (majoré 41 250 € tolérance).`
  }

  if (msgLower.includes('structure') || msgLower.includes('statut') || msgLower.includes('juridique')) {
    return `🏢 **Choix de structure juridique BTP**\n\n| Statut | CA max | Cotisations | Complexité |\n|---|---|---|---|\n| **Micro-entrepreneur** | 77 700 € | 21,2% CA | Très simple |\n| **EI régime réel** | Illimité | TNS ~45% bénéfice | Simple |\n| **EURL/SASU** | Illimité | TNS ou assimilé salarié | Modérée |\n| **SARL/SAS** | Illimité | Selon rémunération | Complexe |\n\n💡 **Recommandation :** Micro jusqu'à 60-65k€ CA. Au-delà → EURL ou SASU pour optimiser charges et crédibilité clients pro.`
  }

  return `🤖 **Léa — Expert-comptable IA BTP 2026**\n\nJe peux vous aider sur :\n\n**📊 Calculs financiers**\n- Résultat net, marges par chantier, trésorerie\n- URSSAF, IR, TVA sur toute période\n\n**⚖️ Fiscalité & Déclarations**\n- Simulation IR / IS selon statut\n- Préparation déclarations trimestrielles\n- Franchise TVA et seuils 2026\n\n**🏢 Conseil stratégique**\n- Choix de structure juridique\n- Optimisation charges sociales\n- Aides : ACRE, CEE, MaPrimeRénov\n\n**📋 Conformité légale**\n- Mentions obligatoires devis/factures\n- Checklists mensuelles/trimestrielles\n\nPosez votre question !`
}
