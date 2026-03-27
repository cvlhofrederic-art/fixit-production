import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, callGroqStreaming } from '@/lib/groq'
import { calculateScores, type AnalyseScores } from '@/lib/analyse-devis-scoring'
import { logger } from '@/lib/logger'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Analyseur Devis/Factures CLIENT — Pipeline 4 étapes ──────────────────────
// 1. Préprocessing IA (conditionnel) : nettoyer le texte brut PDF
// 2. Analyse experte 2025-2026 avec décomposition des coûts
// 3. Extraction structurée JSON (parallèle avec l'analyse)
// 4. Scoring : conformité /100, prix marché, confiance /100 + vérification SIRET

// ── Étape 1 : Préprocessing du texte brut PDF ──────────────────────────────
const PREPROCESS_PROMPT = `Tu es un expert en reconstruction de texte extrait de PDF de devis et factures du bâtiment en France.

Le texte brut extrait d'un PDF par OCR/parsing est souvent CASSÉ :
- Les colonnes de tableaux sont fusionnées sur une seule ligne
- Les headers de colonnes sont collés aux données
- Les descriptions de prestations sont mélangées avec les prix
- Les sous-items (1), 2), 3)...) d'une même prestation sont collés ensemble
- Les blocs émetteur/destinataire sont fusionnés

⚠️ DISTINCTION ÉMETTEUR vs DESTINATAIRE :
- ÉMETTEUR = artisan/entreprise qui a le SIRET, TVA, RC Pro. Il émet le devis.
- DESTINATAIRE = client/copropriété/syndic qui reçoit le devis. Après "Client :", "Destinataire :", "À l'attention de".
- NE CONFONDS JAMAIS les deux.

⚠️ RECONSTRUCTION DES TABLEAUX DE PRESTATIONS :
Le problème le plus courant : l'extraction PDF colle les colonnes ensemble.

EXEMPLE DE TEXTE CASSÉ :
"Type Description Prix unitaire HT Quantité Total HT Service Débouchage canalisation principale 350,00 € 1 350,00 € Service Remplacement joint 45,00 € 2 90,00 €"

DOIT DEVENIR :
| Type | Désignation | Prix unitaire HT | Quantité | Total HT |
|------|-------------|-----------------|----------|----------|
| Service | Débouchage canalisation principale | 350,00 € | 1 | 350,00 € |
| Service | Remplacement joint | 45,00 € | 2 | 90,00 € |

AUTRE CAS FRÉQUENT — Une prestation avec plusieurs sous-descriptions :
"Service 1) Sécurisation de la zone... 2) Abattage... 3) Rognage... 1 800,00 € 1 1 800,00 €"

DOIT DEVENIR :
| Type | Désignation | Prix unitaire HT | Quantité | Total HT |
|------|-------------|-----------------|----------|----------|
| Service | Prestation complète comprenant : | 1 800,00 € | 1 | 1 800,00 € |
|  | 1) Sécurisation de la zone... |  |  |  |
|  | 2) Abattage... |  |  |  |
|  | 3) Rognage... |  |  |  |

COMMENT ASSOCIER PRIX ET PRESTATIONS :
- Un prix au format "XXX,XX €" qui suit une description = le prix de CETTE prestation
- Si plusieurs sous-items (1), 2), 3)...) précèdent un seul prix = c'est UN forfait global pour tous les sous-items
- "Quantité" est souvent un chiffre seul (1, 2, 3...) entre le prix unitaire et le total
- Total HT = Prix unitaire × Quantité

STRUCTURE DE SORTIE :
1. **ÉMETTEUR (Artisan)** : nom/raison sociale, adresse, SIRET, TVA, téléphone, email
2. **DESTINATAIRE (Client)** : nom, adresse
3. **DOCUMENT** : type (devis/facture), numéro, date, validité
4. **PRESTATIONS** — TABLEAU RECONSTITUÉ :
| Désignation | Quantité | Prix unitaire HT | Total HT |
5. **TOTAUX** : Sous-total HT, TVA (taux + montant), Total TTC
6. **CONDITIONS** : paiement, validité, mentions légales

RÈGLES :
- Ne supprime AUCUNE information, AUCUN chiffre, AUCUN prix.
- Conserve TOUS les numéros (SIRET, TVA, téléphone) exactement tels quels.
- Si un prix ne peut pas être rattaché à une prestation → [prix non attribué : XX€]
- Réponds UNIQUEMENT avec le texte restructuré, aucun commentaire.`

// ── Étape 2 : Analyse experte — prix marché 2025-2026 + décomposition coûts ─
const SYSTEM_PROMPT = `Tu es un expert en protection du consommateur et en économie des travaux du bâtiment en France. Tu aides les particuliers à comprendre et analyser des devis et factures d'artisans.

Ton rôle : analyser un devis ou facture et donner un avis clair, transparent et éducatif.

⚠️ RÈGLE CRITIQUE — IDENTIFICATION DES PARTIES :
- L'ARTISAN/ENTREPRISE = celui qui ÉMET le devis. C'est l'ÉMETTEUR. Il a le SIRET, le numéro de TVA, la RC Pro, le RCS. C'est LUI qui propose les travaux et les prix.
- Le CLIENT/DESTINATAIRE = celui qui REÇOIT le devis. Il peut être un particulier, un syndic, une copropriété. Il est souvent indiqué après "À l'attention de", "Client :", "Destinataire :".
- DANS TON RÉSUMÉ, l'artisan = l'émetteur du document. NE METS JAMAIS le nom du client/destinataire dans le champ "Artisan".

**1. VÉRIFICATION DU DOCUMENT**
- Mentions obligatoires : raison sociale DE L'ÉMETTEUR, adresse, SIRET, n° TVA, description précise des travaux, prix unitaires HT, taux TVA, durée de validité (devis), pénalités de retard (facture)
- RC Pro (Responsabilité Civile Professionnelle) mentionnée ?
- Garantie décennale (si travaux construction/rénovation) ?
- Taux de TVA correct : 20% (standard), 10% (rénovation résidence > 2 ans), 5.5% (amélioration énergétique)
- Numéro de devis/facture, date d'émission

**2. PRIX DU MARCHÉ 2025-2026 EN FRANCE (TTC)**

PLOMBERIE :
- Débouchage simple : 90-220€, Débouchage complexe (hydrocurage) : 200-500€
- Fuite robinet réparation : 70-170€, Remplacement robinet mitigeur : 150-350€
- Ballon ECS 100-200L (fourniture+pose) : 900-1800€
- Chauffe-eau thermodynamique : 2500-4500€
- WC complet (fourniture+pose) : 500-1200€
- Colonne d'évacuation : 200-500€/ml

ÉLECTRICITÉ :
- Tableau électrique mono : 700-1400€, Triphasé : 1100-2800€
- Mise aux normes NF C 15-100 appartement : 2200-5500€
- Prise électrique supplémentaire : 60-160€
- Point lumineux supplémentaire : 80-200€
- Interphone/visiophone : 250-900€

CHAUFFAGE / CLIMATISATION :
- Entretien chaudière annuel : 100-220€
- Remplacement chaudière gaz condensation : 3500-7500€
- Pompe à chaleur air/air : 3000-8000€
- Climatisation monosplit (fourniture+pose) : 1500-3500€
- Radiateur électrique (fourniture+pose) : 300-800€

SERRURERIE :
- Ouverture porte claquée (jour) : 80-200€, (nuit/weekend) : 150-350€
- Ouverture porte blindée : 150-400€
- Remplacement cylindre : 100-300€, Serrure complète : 200-500€

PEINTURE :
- Intérieur (préparation + 2 couches) : 25-55€/m²
- Plafond : 30-60€/m²
- Ravalement façade : 35-110€/m²

MENUISERIE :
- Fenêtre double vitrage PVC (fourniture+pose) : 450-1300€/unité
- Porte entrée (fourniture+pose) : 2200-6500€
- Porte intérieure : 300-800€
- Volet roulant motorisé : 400-1000€

CARRELAGE :
- Sol (fourniture+pose) : 35-90€/m²
- Faïence murale : 40-100€/m²

TOITURE :
- Réfection tuiles : 90-170€/m²
- Étanchéité terrasse : 55-130€/m²
- Nettoyage + traitement : 25-55€/m²

ESPACES VERTS :
- Tonte pelouse : 0.12-0.55€/m²
- Taille haie : 35-90€/heure
- Élagage arbre : 100-2000€/u selon hauteur
- Débroussaillage : 120-650€
- Abattage arbre : 300-3000€ selon taille

MAÇONNERIE :
- Réparation fissures : 55-170€/m²
- Carrelage sol/mur : 35-90€/m²
- Ragréage : 12-35€/m²
- Dalle béton : 50-120€/m²

Un prix > 30% au-dessus du marché = signal d'alerte 🔴

**3. DÉCOMPOSITION DES COÛTS — TRANSPARENCE TOTALE**

Structure type d'un prix artisan en France (2025-2026) :
- Matériaux / fournitures : 20-40% du prix TTC (dépend du type de travaux)
- Main d'œuvre brute : 25-35% du prix TTC (taux horaire moyen artisan : 35-55€/h brut)
- Charges sociales patronales (URSSAF, retraite, prévoyance ~45% du brut) : environ 12-16% du prix TTC
- Déplacement : forfait 25-50€ ou ~0.65€/km (carburant + usure véhicule + temps)
- Assurances professionnelles (RC Pro, décennale) : 1-3% du CA, répercuté sur chaque chantier
- Frais de structure (véhicule utilitaire, outillage, comptable, téléphone, atelier) : 10-15%
- Marge nette de l'artisan : 10-25% (c'est sa rémunération après toutes les charges)

Exemple concret — Remplacement mitigeur à 280€ TTC :
- Mitigeur fourniture : ~70€ (25%)
- Main d'œuvre 1h : ~45€ brut (16%)
- Charges sociales : ~20€ (7%)
- Déplacement A/R : ~35€ (12.5%)
- Frais structure : ~35€ (12.5%)
- Assurances : ~5€ (2%)
- Marge artisan : ~70€ (25%)

Pour chaque prestation du devis, DÉCOMPOSE le prix pour que le client comprenne.
Si un prix est justifié malgré qu'il paraît élevé, explique pourquoi.
Si un prix est réellement excessif, montre la décomposition réaliste pour que le client puisse négocier.

**4. POINTS DE VIGILANCE CLIENT**
- Acompte > 30% du total avant travaux ? → suspect
- Durée de validité du devis trop courte (< 1 mois) ? → pression
- Conditions de paiement floues ou abusives ?
- Description des travaux vague ("travaux divers", "forfait") ? → demander détail
- Pas de droit de rétractation 14 jours mentionné ? (obligatoire si démarchage)
- Frais de déplacement non mentionnés mais probablement inclus ?

**FORMAT DE RÉPONSE — Simple, clair, éducatif**

## 🔍 RÉSUMÉ DU DEVIS

**Artisan (émetteur)** : [Nom de l'entreprise/raison sociale qui ÉMET le devis — PAS le destinataire]
**Client (destinataire)** : [Nom du client/copropriété/syndic à qui le devis est adressé]
**Travaux** : [Description courte]
**Montant** : [Total TTC]
**Date** : [Date du devis]

---

## ✅ Ce qui est OK
[Points positifs — mentions présentes, prix corrects, document complet, etc.]

## ⚠️ Points d'attention
[Ce qui manque ou semble suspect — en langage simple, pas de jargon juridique]

---

## 💰 ANALYSE DES PRIX

| Prestation | Prix demandé | Prix marché 2025 | Verdict |
|-----------|-------------|-----------------|---------|
| ... | ...€ TTC | ...€ TTC | ✅ Correct / ⚠️ Élevé / 🔴 Excessif |

---

## 🔧 DÉCOMPOSITION DES COÛTS

Pour chaque prestation principale, décompose le prix :

**[Nom prestation] — [Prix demandé]€ TTC**

| Poste | Estimation | % |
|-------|-----------|---|
| Matériaux / fournitures | ~XX€ | XX% |
| Main d'œuvre | ~XX€ | XX% |
| Charges sociales (~45% du brut) | ~XX€ | XX% |
| Déplacement | ~XX€ | XX% |
| Frais de structure | ~XX€ | XX% |
| Assurances (RC Pro) | ~XX€ | XX% |
| Marge artisan | ~XX€ | XX% |
| **Total estimé** | **~XX€** | |

**→ Écart** : Prix demandé XX€ vs estimation ~XX€ → [✅ Cohérent / ⚠️ Marge élevée / 🔴 Excessif]

*Répète pour chaque prestation significative (> 100€)*

⚠️ *Ces estimations sont indicatives et basées sur les moyennes du marché français 2025-2026. Les prix réels varient selon la région, la complexité du chantier et l'accès.*

---

## 💡 MES CONSEILS

[3-5 conseils concrets et actionnables — ce que le client devrait demander, vérifier, ou négocier. Explique comment utiliser la décomposition pour négocier intelligemment.]

---

## 🏷️ MON AVIS

**Note** : ⭐ X/10
**Verdict** : [✅ BON DEVIS — prix justes / ⚠️ À NÉGOCIER — certains prix élevés / 🔴 À REFUSER — tarifs excessifs]
**Ce que je ferais** : [Conseil direct et honnête en une phrase]

---
Si le texte est illisible ou vide, demande poliment de coller le contenu du devis.
Tutoie le client. Sois direct, honnête, bienveillant et pédagogue. Pas de jargon juridique.`

// ── Étape 3 : Extraction structurée JSON ────────────────────────────────────
const EXTRACT_PROMPT = `Tu es un extracteur de données de devis/factures du bâtiment. À partir du texte d'un document, extrais les informations clés au format JSON strict.

⚠️ RÈGLE CRITIQUE — ÉMETTEUR vs DESTINATAIRE :
- "artisan_nom" = le nom de l'entreprise/artisan qui ÉMET le devis (celui qui a le SIRET, la TVA, la RC Pro). C'est L'ÉMETTEUR du document.
- "client_nom" = le nom du client/copropriété/syndic qui REÇOIT le devis. C'est le DESTINATAIRE.
- NE CONFONDS PAS les deux. Sur un devis, l'émetteur propose les travaux, le destinataire les reçoit.
- L'émetteur a souvent son nom en gros, en haut, avec ses coordonnées professionnelles (SIRET, RCS, TVA).
- Le destinataire est souvent après "À l'attention de", "Client :", "Destinataire :", ou dans un encadré séparé.

⚠️ DISTINCTION PRESTATIONS vs DESCRIPTIONS vs ÉTAPES :
- Une ligne avec QTÉ + PRIX = PRESTATION (type: "prestation")
- Une ligne sans prix, en petit, sous un titre = DESCRIPTION (type: "description")
- Des lignes numérotées (1. 2. 3...) sans prix = ÉTAPES (type: "etape")
- Un motif à 0€ ou "Sur devis" = PRESTATION FORFAITAIRE, pas une étape

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown, sans backticks.

Champs à extraire :
{
  "artisan_nom": "raison sociale de l'ÉMETTEUR du devis — celui qui a le SIRET (string, '' si non trouvé)",
  "artisan_siret": "numéro SIRET de l'émetteur (string, '' si non trouvé)",
  "artisan_telephone": "téléphone de l'émetteur (string, '' si non trouvé)",
  "artisan_email": "email de l'émetteur (string, '' si non trouvé)",
  "client_nom": "nom du DESTINATAIRE/client à qui le devis est adressé (string, '' si non trouvé)",
  "type_document": "devis ou facture ou autre",
  "numero_document": "numéro du devis/facture (string, '' si non trouvé)",
  "date_document": "date au format YYYY-MM-DD (string, '' si non trouvé)",
  "description_travaux": "description courte des travaux (string, max 120 chars)",
  "prestations": [
    { "designation": "nom prestation", "type": "prestation|description|etape", "quantite": 1, "unite": "u/m²/h/ml/forfait", "prix_unitaire_ht": 0, "total_ht": 0 }
  ],
  "montant_ht": 0,
  "tva_taux": 0,
  "tva_montant": 0,
  "montant_ttc": 0,
  "acompte": 0,
  "mentions_presentes": ["SIRET", "TVA", "RC Pro", ...],
  "mentions_manquantes": ["Garantie décennale", ...],
  "assurance_decennale": { "assureur": "", "numero": "", "couverture": "" },
  "rc_pro": { "assureur": "", "numero": "" },
  "conditions_paiement": "",
  "duree_validite": "",
  "penalites_retard": false,
  "droit_retractation": false,
  "mediateur": false,
  "statut_juridique": ""
}`

// ── Détection PDF Vitfix (calque texte structuré) ──────────────────────────
function isVitfixPdf(text: string): boolean {
  return text.includes('[VITFIX-DEVIS-METADATA]') || /DEV-\d{4}-\d{3,}/.test(text)
}

// ── Heuristique : le texte PDF a-t-il besoin de préprocessing ? ─────────────
function needsPreprocessing(text: string): boolean {
  if (isVitfixPdf(text)) return false
  const pricePatterns = (text.match(/\d[\d\s]*[.,]\d{2}\s*€/g) || []).length
  const lines = text.split('\n').filter(l => l.trim().length > 0).length
  const avgLineLen = text.length / Math.max(lines, 1)
  const hasTableHeaders = /prix\s*unitaire|total\s*ht|montant\s*ttc|quantit/i.test(text)
  if (hasTableHeaders && avgLineLen > 100) return true
  if (pricePatterns >= 3 && avgLineLen < 80 && lines > 10) return false
  if (text.length < 500 && pricePatterns >= 1 && lines > 3) return false
  return true
}

// ── Appel Groq helper with retry ─────────────────────────────────────────────
async function callGroq(systemPrompt: string, userContent: string, opts: { temperature?: number; max_tokens?: number } = {}) {
  return callGroqWithRetry({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.max_tokens ?? 4000,
  })
}

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
    filename?: string
    pdfText?: string
    isVitfix: boolean
    artisanNom?: string
    artisanSiret?: string
    siretVerified: boolean
    scores: AnalyseScores
    extracted: Record<string, unknown>
    analysisText: string
    model?: string
    tokens?: number
  }
) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    await supabaseAdmin.from('analyses_devis').insert({
      user_id: userId,
      user_type: 'client',
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
    logger.warn('[analyse-devis] Save to DB failed (non-bloquant):', err)
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const rateOk = await checkRateLimit(`analyse-devis-client:${ip}`, 8, 60_000)
  if (!rateOk) return rateLimitResponse()

  const user = await getAuthUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const { content, filename: rawFilename, stream } = body

  // Sanitise filename to prevent prompt injection
  const INJECTION_KEYWORDS = /ignore|instruction|override|system|prompt|oublie|précéden/i
  let filename: string | undefined
  if (typeof rawFilename === 'string') {
    const cleaned = rawFilename.replace(/[^\w\sàâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ._\-()]/g, '').slice(0, 200)
    filename = INJECTION_KEYWORDS.test(cleaned) ? 'document.pdf' : cleaned
  }

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Contenu du document trop court ou vide' }, { status: 400 })
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
  }

  try {
    let processedContent = content.trim()
    let preprocessed = false
    const vitfix = isVitfixPdf(processedContent)

    // ── Étape 1 : Préprocessing conditionnel ──
    if (needsPreprocessing(processedContent)) {
      try {
        const ppData = await callGroq(
          PREPROCESS_PROMPT,
          `Texte brut extrait du PDF :\n\n${processedContent}`,
          { temperature: 0, max_tokens: 3000 }
        )
        const cleaned = ppData.choices?.[0]?.message?.content
        if (cleaned && cleaned.trim().length > processedContent.length * 0.3) {
          processedContent = cleaned.trim()
          preprocessed = true
        }
      } catch (ppErr) {
        logger.warn('Preprocessing failed (non-bloquant):', ppErr)
      }
    }

    // ── Étape 2+3 : Appels parallèles — Analyse + Extraction + SIRET ──
    const userPrompt = filename
      ? `Voici le devis/facture "${filename}" que j'ai reçu d'un artisan :\n\n${processedContent}`
      : `Voici le devis/facture que j'ai reçu d'un artisan :\n\n${processedContent}`

    // Si streaming demandé, on fait d'abord l'extraction pour les scores, puis on streame l'analyse
    if (stream) {
      // Extraction d'abord (rapide, ~2s)
      const extractData = await callGroq(EXTRACT_PROMPT, `Document à analyser :\n\n${processedContent}`, { temperature: 0, max_tokens: 1200 })

      let extracted: Record<string, unknown> = {}
      try {
        const rawJson = extractData.choices?.[0]?.message?.content || '{}'
        const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        extracted = JSON.parse(cleaned)
      } catch { /* */ }

      // SIRET vérification en parallèle
      const siretResult = await verifySiret(extracted.artisan_siret as string || '', req)

      // Calcul des scores (instantané)
      const scores = calculateScores(
        (extracted.mentions_presentes || []) as string[],
        (extracted.mentions_manquantes || []) as string[],
        extracted,
        siretResult.verified
      )

      // Streamer la réponse : scores d'abord, puis analyse narrative
      const analyseStream = await callGroqStreaming({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 5000,
      })

      const encoder = new TextEncoder()
      const transformStream = new TransformStream({
        start(controller) {
          // Envoyer les scores en premier chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'scores',
            scores,
            extracted,
            isVitfix: vitfix,
            siret: siretResult,
            preprocessed,
          })}\n\n`))
        },
        transform(chunk, controller) {
          controller.enqueue(chunk)
        },
        async flush(controller) {
          // Sauvegarder en DB de manière asynchrone (ne bloque pas le stream)
          saveAnalysis(user.id, {
            filename, pdfText: content, isVitfix: vitfix,
            artisanNom: extracted.artisan_nom as string,
            artisanSiret: extracted.artisan_siret as string,
            siretVerified: siretResult.verified,
            scores, extracted, analysisText: '[streamed]',
            model: 'llama-3.3-70b-versatile',
          }).catch(() => {})
        },
      })

      analyseStream.pipeTo(transformStream.writable).catch(() => {})

      return new Response(transformStream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── Mode non-streaming (rétrocompatible) ──
    const [analyseData, extractData] = await Promise.all([
      callGroq(SYSTEM_PROMPT, userPrompt, { temperature: 0.1, max_tokens: 5000 }),
      callGroq(EXTRACT_PROMPT, `Document à analyser :\n\n${processedContent}`, { temperature: 0, max_tokens: 1200 }),
    ])

    const analysis = analyseData.choices?.[0]?.message?.content || ''

    let extracted: Record<string, unknown> = {}
    try {
      const rawJson = extractData.choices?.[0]?.message?.content || '{}'
      const cleaned = rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch (e) {
      logger.warn('Extraction JSON failed (non-bloquant):', e)
    }

    // ── Étape 4 : SIRET + Scoring ──
    const siretResult = await verifySiret(extracted.artisan_siret as string || '', req)

    const scores = calculateScores(
      (extracted.mentions_presentes || []) as string[],
      (extracted.mentions_manquantes || []) as string[],
      extracted,
      siretResult.verified
    )

    const totalTokens = (analyseData.usage?.total_tokens || 0) + (extractData.usage?.total_tokens || 0)

    // Sauvegarder en DB
    saveAnalysis(user.id, {
      filename, pdfText: content, isVitfix: vitfix,
      artisanNom: extracted.artisan_nom as string,
      artisanSiret: extracted.artisan_siret as string,
      siretVerified: siretResult.verified,
      scores, extracted, analysisText: analysis,
      model: analyseData.model, tokens: totalTokens,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      analysis,
      extracted,
      scores,
      isVitfix: vitfix,
      siret: siretResult,
      preprocessed,
      model: analyseData.model,
      tokens: totalTokens,
    })
  } catch (err) {
    logger.error('Analyse devis client error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
