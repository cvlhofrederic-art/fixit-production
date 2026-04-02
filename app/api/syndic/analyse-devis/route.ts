import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { calculateScores, type AnalyseScores } from '@/lib/analyse-devis-scoring'
import { logger } from '@/lib/logger'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Analyseur Devis/Factures Syndic — Expert Juridique & Prix du Marché ──────
// Pipeline : Analyse + Extraction + SIRET + Scoring (4 étapes)

const SYSTEM_PROMPT = `Tu es un expert en marchés publics, droit de la copropriété et prix du marché des travaux du bâtiment en France. Tu travailles pour un cabinet de syndic professionnel.

Ton rôle est d'analyser des devis et factures de travaux pour :

**1. CONFORMITÉ JURIDIQUE & LÉGALE**
Vérifier la présence des mentions obligatoires selon la loi française :
- Raison sociale complète et adresse de l'entreprise
- Numéro SIRET ou SIREN
- Numéro RCS (Registre du Commerce)
- Numéro TVA intracommunautaire (si assujetti)
- RC Pro (Responsabilité Civile Professionnelle) : numéro de contrat, assureur, validité
- Garantie décennale (pour travaux de construction/rénovation importants) : numéro, assureur
- Date d'émission du document
- Numéro unique du devis/facture
- Désignation précise des travaux (nature, quantité, unité)
- Prix unitaires HT, taux de TVA (5.5%, 10% ou 20% selon les travaux), prix TTC
- Délai d'exécution des travaux
- Conditions de paiement et d'escompte
- Durée de validité du devis (si devis)
- Pénalités de retard (si facture)
- Délai de rétractation (14 jours pour particuliers, non applicable en copropriété mais à signaler)
- Pour copropriété : référence au mandat syndic si demandé par le syndic

**2. ANALYSE DES PRIX & BENCHMARK MARCHÉ 2024-2025**

PLOMBERIE :
- Débouchage simple : 80-200€ HT, Fuite robinet : 60-150€ HT
- Remplacement ballon eau chaude 100L : 800-1500€ HT
- Colonne montante : 200-500€ HT/ml, Pose sanitaires complets : 400-900€ HT

ÉLECTRICITÉ :
- Tableau électrique mono : 600-1200€ HT, Triphasé : 1000-2500€ HT
- Mise aux normes NF C 15-100 : 2000-5000€ HT
- Interphone/visiophone : 200-800€ HT, Éclairage parties communes : 800-2000€ HT

PEINTURE :
- Intérieur (préparation + 2 couches) : 20-50€ HT/m²
- Ravalement façade enduit : 40-100€ HT/m², peinture : 30-70€ HT/m²

MENUISERIE :
- Porte entrée immeuble : 2000-6000€ HT, Porte palière : 800-2500€ HT
- Fenêtre double vitrage : 400-1200€ HT/u, Portail automatique : 2000-6000€ HT

SERRURERIE / SÉCURITÉ :
- Serrure : 150-400€ HT, Digicode : 300-800€ HT, Visiophone immeuble : 500-2000€ HT

ASCENSEUR :
- Maintenance annuel : 1500-5000€ HT/an, Révision : 3000-8000€ HT

TOITURE :
- Réfection tuiles : 80-150€ HT/m², Étanchéité terrasse : 50-120€ HT/m²

ESPACES VERTS :
- Taille haie : 30-80€ HT/h, Élagage arbre : 200-800€ HT/u
- Entretien espaces verts mensuel : 200-800€ HT/mois

NETTOYAGE :
- Parties communes quotidien : 300-800€ HT/mois, Vitrerie : 2-8€ HT/m²

MAÇONNERIE :
- Fissuration façade : 50-150€ HT/m², Ragréage sol : 10-30€ HT/m²

**3. DÉTECTION DE RISQUES JURIDIQUES**
- Prix excessif (> 30%) → facturation abusive
- Mentions manquantes → devis non valide juridiquement
- Pas de RC Pro → risque en cas de sinistre
- Garantie décennale absente pour gros travaux → risque majeur
- TVA incorrecte → sur-facturation
- Conditions abusives (acompte > 30%)

**FORMAT DE RÉPONSE OBLIGATOIRE**

## 🔍 ANALYSE DU DOCUMENT

**Type de document** : [Devis / Facture / Avoir / Pro-forma]
**Entreprise** : [Nom entreprise]
**Nature des travaux** : [Description courte]
**Montant** : [Montant HT] HT / [Montant TTC] TTC

---

## ✅ MENTIONS LÉGALES PRÉSENTES
[Liste avec ✅]

## ❌ MENTIONS MANQUANTES / NON CONFORMES
[Liste avec ❌]

---

## 💰 ANALYSE DES PRIX

| Prestation | Prix demandé | Prix marché | Écart | Verdict |
|-----------|-------------|------------|-------|---------|

**Conclusion prix** : [Analyse globale]

---

## ⚠️ RISQUES JURIDIQUES DÉTECTÉS
[Liste numérotée avec niveau : 🔴 ÉLEVÉ / 🟡 MOYEN / 🟢 FAIBLE]

---

## 📋 RECOMMANDATIONS SYNDIC
[3-5 recommandations actionnables]

---

## 🏷️ VERDICT GLOBAL

**Score de conformité** : X/10
**Statut** : [✅ CONFORME / ⚠️ PARTIELLEMENT CONFORME / ❌ NON CONFORME]
**Action recommandée** : [VALIDER / DEMANDER CORRECTIONS / REFUSER]

---
Réponds toujours en français, avec un ton professionnel et précis.`

const EXTRACT_PROMPT = `Tu es un extracteur de données. À partir d'un devis ou d'une facture, extrais les informations clés au format JSON strict.

⚠️ DISTINCTION PRESTATIONS vs DESCRIPTIONS vs ÉTAPES :
- Une ligne avec QTÉ + PRIX = PRESTATION (type: "prestation")
- Une ligne sans prix, sous un titre = DESCRIPTION (type: "description")
- Des lignes numérotées (1. 2. 3...) sans prix = ÉTAPES (type: "etape")

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown, sans backticks.

Champs à extraire :
{
  "artisan_nom": "nom complet de l'entreprise/artisan (string, '' si non trouvé)",
  "artisan_siret": "numéro SIRET (string, '' si non trouvé)",
  "artisan_metier": "corps de métier (string, ex: 'Plomberie', 'Électricité', '' si non trouvé)",
  "type_document": "devis ou facture ou autre",
  "description_travaux": "description courte des travaux (string, max 100 chars)",
  "immeuble": "nom ou adresse du lieu d'intervention (string, '' si non trouvé)",
  "prestations": [
    { "designation": "nom prestation", "type": "prestation|description|etape", "quantite": 1, "unite": "u/m²/h/ml/forfait", "prix_unitaire_ht": 0, "total_ht": 0 }
  ],
  "montant_ht": 0,
  "montant_ttc": 0,
  "tva_taux": 0,
  "tva_montant": 0,
  "date_intervention": "YYYY-MM-DD (string, '' si non trouvé)",
  "artisan_email": "email (string, '' si non trouvé)",
  "artisan_telephone": "téléphone (string, '' si non trouvé)",
  "priorite": "urgente|normale|planifiee",
  "mentions_presentes": ["SIRET", "TVA", "RC Pro", ...],
  "mentions_manquantes": ["Garantie décennale", ...],
  "numero_document": "numéro du devis/facture (string, '' si non trouvé)",
  "date_document": "date au format YYYY-MM-DD (string, '' si non trouvé)",
  "statut_juridique": ""
}`

// ── Vérification SIRET via API interne ──────────────────────────────────────
async function verifySiret(siret: string, req: NextRequest): Promise<{ verified: boolean; company?: Record<string, unknown> }> {
  if (!siret || siret.replace(/\s/g, '').length !== 14) return { verified: false }
  try {
    const cleanSiret = siret.replace(/\s/g, '')
    const origin = req.nextUrl.origin
    const res = await fetch(`${origin}/api/verify-siret?siret=${cleanSiret}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { verified: false }
    const data = await res.json()
    return { verified: data.verified === true, company: data.company }
  } catch {
    return { verified: false }
  }
}

// ── Sauvegarde en DB ────────────────────────────────────────────────────────
async function saveAnalysis(
  userId: string,
  data: {
    filename?: string; pdfText?: string; isVitfix: boolean
    artisanNom?: string; artisanSiret?: string; siretVerified: boolean
    scores: AnalyseScores; extracted: Record<string, unknown>
    analysisText: string; model?: string; tokens?: number
  }
) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    await supabaseAdmin.from('analyses_devis').insert({
      user_id: userId,
      user_type: 'syndic',
      filename: data.filename || null,
      pdf_text: data.pdfText?.substring(0, 10000) || null,
      is_vitfix: data.isVitfix,
      artisan_nom: data.artisanNom || null,
      artisan_siret: data.artisanSiret || null,
      siret_verified: data.siretVerified,
      score_conformite: data.scores.conformite.total,
      score_conformite_max: data.scores.conformite.max,
      score_prix_ecart: data.scores.prix.ecart_moyen_pct,
      score_confiance: data.scores.confiance,
      action_recommandee: data.scores.action_recommandee,
      extracted: data.extracted,
      scores_details: {
        conformite: data.scores.conformite.details,
        prix: data.scores.prix.details,
        messages_negociation: data.scores.messages_negociation,
      },
      messages_negociation: data.scores.messages_negociation,
      analysis_text: data.analysisText,
      model: data.model || null,
      tokens_used: data.tokens || null,
    })
  } catch (err) {
    logger.warn('[syndic/analyse-devis] Save to DB failed (non-bloquant):', err)
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rateOk = await checkRateLimit(`analyse-devis:${ip}`, 10, 60_000)
  if (!rateOk) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isSyndicRole(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { content, filename } = body

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu du document trop court ou vide' }, { status: 400 })
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'Clé API Groq manquante' }, { status: 500 })
  }

  const userPrompt = filename
    ? `Voici le contenu du document "${filename}" à analyser :\n\n${content}`
    : `Voici le contenu du document à analyser :\n\n${content}`

  const vitfix = content.includes('[VITFIX-DEVIS-METADATA]') || /DEV-\d{4}-\d{3,}/.test(content)

  try {
    const [analyseData, extractData] = await Promise.all([
      callGroqWithRetry({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 5000,
      }),
      callGroqWithRetry({
        messages: [
          { role: 'system', content: EXTRACT_PROMPT },
          { role: 'user', content: `Document à analyser :\n\n${content}` },
        ],
        temperature: 0,
        max_tokens: 1200,
      }).catch(err => { logger.error('[syndic/analyse-devis] Extraction failed:', err); return null }),
    ])

    const analysis = analyseData.choices?.[0]?.message?.content || ''

    let extracted: Record<string, unknown> = {}
    try {
      if (extractData) {
        const rawJson = extractData.choices?.[0]?.message?.content || '{}'
        const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extracted = JSON.parse(cleaned)
      }
    } catch (e) {
      logger.warn('Extraction JSON failed (non-bloquant):', e)
    }

    // ── SIRET + Scoring ──
    const siretResult = await verifySiret(extracted.artisan_siret as string || '', req)

    const scores = calculateScores(
      (extracted.mentions_presentes || []) as string[],
      (extracted.mentions_manquantes || []) as string[],
      extracted,
      siretResult.verified
    )

    const totalTokens = (analyseData.usage?.total_tokens || 0) + (extractData?.usage?.total_tokens || 0)

    // Sauvegarder en DB
    saveAnalysis(user.id, {
      filename, pdfText: content, isVitfix: vitfix,
      artisanNom: extracted.artisan_nom as string,
      artisanSiret: extracted.artisan_siret as string,
      siretVerified: siretResult.verified,
      scores, extracted, analysisText: analysis,
      model: analyseData.model, tokens: totalTokens,
    }).catch((err) => { logger.warn('saveAnalysis (syndic) failed silently:', err) })

    return NextResponse.json({
      success: true,
      analysis,
      extracted,
      scores,
      isVitfix: vitfix,
      siret: siretResult,
      model: analyseData.model,
      tokens: totalTokens,
    })
  } catch (err) {
    logger.error('Analyse devis error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
