import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { calculateScores, type AnalyseScores } from '@/lib/analyse-devis-scoring'
import { logger } from '@/lib/logger'
import { getSecret } from '@/lib/env'

// ── Analyseur Devis/Factures Syndic — Expert Juridique & Prix du Marché ──────
// Pipeline : Analyse + Extraction + Vérification entreprise + Scoring (4 étapes)
// FR et PT ont des cadres juridiques + prix + obligations totalement distincts.

const SYSTEM_PROMPT_FR = `Tu es un expert en marchés publics, droit de la copropriété et prix du marché des travaux du bâtiment EN FRANCE. Tu travailles pour un cabinet de syndic professionnel français.

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

**2. ANALYSE DES PRIX & BENCHMARK MARCHÉ FRANCE 2024-2025**

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
- Garantie décennale absente pour gros travaux → risque majeur (loi Spinetta 1978)
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

| Prestation | Prix demandé | Prix marché FR | Écart | Verdict |
|-----------|-------------|---------------|-------|---------|

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
Réponds toujours en français, avec un ton professionnel et précis. Le cadre légal est exclusivement français — ne JAMAIS mentionner NIF, IVA portugais, Lei 8/2022, alvará ou ATCUD.`

const SYSTEM_PROMPT_PT = `És um especialista em contratação pública, direito do condomínio e preços de mercado de obras de construção EM PORTUGAL. Trabalhas para um gabinete de administração de condomínios profissional português.

A tua função é analisar orçamentos e faturas de obras para :

**1. CONFORMIDADE JURÍDICA E LEGAL (PORTUGAL)**
Verificar a presença das menções obrigatórias segundo a legislação portuguesa :
- Designação social completa e morada da empresa
- Número de NIPC (Pessoa Coletiva) ou NIF (Empresário em Nome Individual)
- Número de matrícula na Conservatória do Registo Comercial
- Código de Atividade Económica (CAE) adequado às obras
- Alvará de construção (Lei 41/2015) — obrigatório para obras > 16.750 € ou trabalhos especializados
- Seguro de responsabilidade civil profissional (recomendado, não obrigatório por lei mas exigível pelo condomínio)
- Garantia legal de 5 anos para obras de construção/reabilitação (DL 67/2003, art. 5º) — equivalente português da garantia décennale
- Garantia de bom funcionamento de 2 anos para equipamentos (DL 67/2003)
- Data de emissão do documento
- Número sequencial único do orçamento/fatura
- Para faturas: ATCUD (Código Único de Documento, Portaria 195/2020), exportação SAF-T PT (DL 28/2019)
- Designação precisa dos trabalhos (natureza, quantidade, unidade)
- Preços unitários (com indicação se com ou sem IVA), taxa de IVA aplicável
- IVA Portugal 2024-2025 :
  - 23% (taxa normal continente, 22% Açores, 18% Madeira)
  - 13% (taxa intermédia)
  - 6% (taxa reduzida — obras de reabilitação em prédios > 30 anos ou em ARU/Áreas de Reabilitação Urbana — Lei 8/2022)
- Prazo de execução das obras
- Condições de pagamento (entrada/sinal, prestações)
- Validade do orçamento (Código Civil art. 224º)
- Penalizações por atraso (se fatura)
- Para condomínio : referência à deliberação da assembleia e ao mandato do administrador

**2. ANÁLISE DOS PREÇOS & BENCHMARK MERCADO PORTUGAL 2024-2025**

CANALIZAÇÃO :
- Desentupimento simples : 60-150€, Fuga de torneira : 50-100€
- Substituição de cilindro/termoacumulador 100L : 600-1200€
- Coluna montante : 150-400€/ml, Instalação sanitários completa : 350-800€

ELETRICIDADE :
- Quadro elétrico monofásico : 500-1000€, Trifásico : 800-2000€
- Adaptação a regras técnicas (Portaria 949-A/2006) : 1500-4000€
- Intercomunicador/videoporteiro : 150-700€, Iluminação áreas comuns : 600-1800€

PINTURA :
- Interior (preparação + 2 demãos) : 15-40€/m²
- Reabilitação fachada com reboco : 30-80€/m², só pintura : 20-60€/m²

CARPINTARIA/SERRALHARIA :
- Porta de entrada de prédio : 1500-5000€, Porta de patamar : 600-2000€
- Janela vidro duplo : 350-1000€/u, Portão automático : 1500-5000€

FECHADURAS / SEGURANÇA :
- Fechadura : 120-350€, Código de acesso : 250-700€, Videoporteiro de prédio : 400-1700€

ELEVADORES :
- Manutenção anual obrigatória (DL 320/2002) : 1200-4000€/ano, Revisão : 2500-6500€

COBERTURAS :
- Substituição de telhas : 60-130€/m², Impermeabilização de terraço : 40-100€/m²

ESPAÇOS VERDES :
- Corte de sebes : 25-70€/h, Poda de árvore : 150-700€/un
- Manutenção mensal espaços verdes : 150-700€/mês

LIMPEZA :
- Áreas comuns diária : 250-700€/mês, Limpeza de vidros : 1,5-7€/m²

ALVENARIA :
- Fissuração em fachada : 40-130€/m², Regularização de pavimento : 8-25€/m²

**3. DETEÇÃO DE RISCOS JURÍDICOS (PORTUGAL)**
- Preço excessivo (> 30%) → faturação abusiva
- Menções obrigatórias em falta → orçamento juridicamente inválido
- Sem alvará para obras > 16.750 € → trabalho ilegal (Lei 41/2015) — risco MAIOR
- Sem garantia de 5 anos (DL 67/2003) → risco em caso de defeito de construção
- IVA incorreto (23% aplicado em vez de 6% para reabilitação em ARU) → sobrefaturação
- Condições abusivas (sinal > 30%) → DL 67/2003 art. 4º
- Sem ATCUD numa fatura emitida em 2024+ → não conformidade fiscal (Portaria 195/2020)

**FORMATO DE RESPOSTA OBRIGATÓRIO**

## 🔍 ANÁLISE DO DOCUMENTO

**Tipo de documento** : [Orçamento / Fatura / Nota de crédito / Pró-forma]
**Empresa** : [Nome da empresa]
**Natureza das obras** : [Descrição curta]
**Montante** : [Montante sem IVA] s/ IVA / [Montante c/ IVA] c/ IVA

---

## ✅ MENÇÕES LEGAIS PRESENTES
[Lista com ✅]

## ❌ MENÇÕES EM FALTA / NÃO CONFORMES
[Lista com ❌]

---

## 💰 ANÁLISE DOS PREÇOS

| Prestação | Preço pedido | Preço mercado PT | Variação | Veredicto |
|-----------|-------------|------------------|----------|-----------|

**Conclusão preço** : [Análise global]

---

## ⚠️ RISCOS JURÍDICOS DETETADOS
[Lista numerada com nível : 🔴 ELEVADO / 🟡 MÉDIO / 🟢 BAIXO]

---

## 📋 RECOMENDAÇÕES ADMINISTRADOR
[3-5 recomendações acionáveis]

---

## 🏷️ VEREDICTO GLOBAL

**Pontuação de conformidade** : X/10
**Estado** : [✅ CONFORME / ⚠️ PARCIALMENTE CONFORME / ❌ NÃO CONFORME]
**Ação recomendada** : [VALIDAR / PEDIR CORREÇÕES / RECUSAR]

---
Responde sempre em português europeu (PT-PT), com tom profissional e preciso. O enquadramento legal é exclusivamente português — NUNCA mencionar SIRET, RC Pro, garantie décennale, TVA 5,5%/10%/20% ou outras noções francesas.`

const EXTRACT_PROMPT_FR = `Tu es un extracteur de données. À partir d'un devis ou d'une facture FRANÇAIS, extrais les informations clés au format JSON strict.

⚠️ DISTINCTION PRESTATIONS vs DESCRIPTIONS vs ÉTAPES :
- Une ligne avec QTÉ + PRIX = PRESTATION (type: "prestation")
- Une ligne sans prix, sous un titre = DESCRIPTION (type: "description")
- Des lignes numérotées (1. 2. 3...) sans prix = ÉTAPES (type: "etape")

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans markdown, sans backticks.

Champs à extraire :
{
  "artisan_nom": "nom complet de l'entreprise/artisan (string, '' si non trouvé)",
  "artisan_siret": "numéro SIRET français à 14 chiffres (string, '' si non trouvé)",
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
  "mentions_presentes": ["SIRET", "TVA", "RC Pro", "Garantie décennale", ...],
  "mentions_manquantes": ["RC Pro", "Garantie décennale", ...],
  "numero_document": "numéro du devis/facture (string, '' si non trouvé)",
  "date_document": "date au format YYYY-MM-DD (string, '' si non trouvé)",
  "statut_juridique": ""
}`

const EXTRACT_PROMPT_PT = `És um extrator de dados. A partir de um orçamento ou fatura PORTUGUÊS, extrai a informação chave em formato JSON estrito.

⚠️ DISTINÇÃO PRESTAÇÕES vs DESCRIÇÕES vs ETAPAS — REGRA ABSOLUTA :
- Uma linha que TEM AO MESMO TEMPO quantidade + unidade (Serviço, m², h…) + preço (€) = PRESTAÇÃO (type: "prestation"). É a ÚNICA categoria com prix_unitaire_ht > 0.
- Uma linha entre parênteses ou sob um título de prestação = DESCRIÇÃO (type: "description"). prix_unitaire_ht = 0.
- Uma linha numerada (1. 2. 3…) que detalha um sub-passo = ETAPA (type: "etape"). prix_unitaire_ht = 0.

EXEMPLO PRÁTICO — bloco típico de um orçamento PT :
\`\`\`
Inspeção prévia do sistema elétrico
(Diagnóstico técnico prévio)
1. Verificação do quadro e ponto de alimentação 230 V
2. Avaliação das folhas e pilares
3. Dimensionamento e elaboração do orçamento
1 Serviço 80,00 € 80,00 €
\`\`\`
DEVE produzir EXATAMENTE :
\`\`\`
{ "designation": "Inspeção prévia do sistema elétrico", "type": "prestation", "quantite": 1, "unite": "Serviço", "prix_unitaire_ht": 80, "total_ht": 80 },
{ "designation": "(Diagnóstico técnico prévio)", "type": "description", "quantite": 0, "unite": "", "prix_unitaire_ht": 0, "total_ht": 0 },
{ "designation": "1. Verificação do quadro e ponto de alimentação 230 V", "type": "etape", "quantite": 0, "unite": "", "prix_unitaire_ht": 0, "total_ht": 0 },
{ "designation": "2. Avaliação das folhas e pilares", "type": "etape", "quantite": 0, "unite": "", "prix_unitaire_ht": 0, "total_ht": 0 },
{ "designation": "3. Dimensionamento e elaboração do orçamento", "type": "etape", "quantite": 0, "unite": "", "prix_unitaire_ht": 0, "total_ht": 0 }
\`\`\`

NUNCA atribuas o preço de uma prestação a uma das suas etapas/descrições. NUNCA marques uma etapa ou descrição como type "prestation". Se hesitares, marca como "description" — é melhor não-contar do que contar errado.

Responde APENAS com um objeto JSON válido, sem texto antes ou depois, sem markdown, sem backticks.

⚠️ As chaves do JSON ficam em francês (artisan_nom, artisan_siret, etc.) por compatibilidade com a base de dados — mas o conteúdo vem do documento PT :
- "artisan_siret" → o NIF/NIPC português (9 dígitos) se presente, '' caso contrário
- "tva_taux" → a taxa de IVA aplicada (23, 13, 6 para continente, ou 22, 13, 5 Açores, ou 18, 9, 4 Madeira)
- "montant_ht" → o montante sem IVA (em PT diz-se "valor sem IVA")
- "montant_ttc" → o montante com IVA
- "mentions_presentes" / "mentions_manquantes" devem usar os termos portugueses : "NIPC", "IVA", "Alvará", "ATCUD", "Garantia 5 anos DL 67/2003", "Seguro RC", "CAE"

Campos a extrair :
{
  "artisan_nom": "nome completo da empresa/profissional (string, '' se não encontrado)",
  "artisan_siret": "NIF/NIPC português 9 dígitos (string, '' se não encontrado)",
  "artisan_metier": "área de atividade (string, ex: 'Canalização', 'Eletricidade', '' se não encontrado)",
  "type_document": "devis ou facture ou autre",
  "description_travaux": "descrição curta das obras (string, max 100 chars)",
  "immeuble": "nome ou morada do local de intervenção (string, '' se não encontrado)",
  "prestations": [
    { "designation": "nome da prestação", "type": "prestation|description|etape", "quantite": 1, "unite": "u/m²/h/ml/forfait", "prix_unitaire_ht": 0, "total_ht": 0 }
  ],
  "montant_ht": 0,
  "montant_ttc": 0,
  "tva_taux": 0,
  "tva_montant": 0,
  "date_intervention": "YYYY-MM-DD (string, '' se não encontrado)",
  "artisan_email": "email (string, '' se não encontrado)",
  "artisan_telephone": "telefone (string, '' se não encontrado)",
  "priorite": "urgente|normale|planifiee",
  "mentions_presentes": ["NIPC", "IVA", "Alvará", "ATCUD", ...],
  "mentions_manquantes": ["Alvará", "ATCUD", "Garantia 5 anos", ...],
  "numero_document": "número do orçamento/fatura (string, '' se não encontrado)",
  "date_document": "data formato YYYY-MM-DD (string, '' se não encontrado)",
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
  const GROQ_API_KEY = await getSecret('GROQ_API_KEY')
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
  const { content, filename, locale: rawLocale } = body
  const locale: 'fr' | 'pt' = rawLocale === 'pt' ? 'pt' : 'fr'
  const isPt = locale === 'pt'

  if (!content || content.trim().length < 10) {
    return NextResponse.json(
      { error: isPt ? 'Conteúdo do documento muito curto ou vazio' : 'Contenu du document trop court ou vide' },
      { status: 400 },
    )
  }

  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: isPt ? 'Chave API Groq em falta' : 'Clé API Groq manquante' },
      { status: 500 },
    )
  }

  const userPrompt = filename
    ? (isPt
      ? `Eis o conteúdo do documento "${filename}" para analisar :\n\n${content}`
      : `Voici le contenu du document "${filename}" à analyser :\n\n${content}`)
    : (isPt
      ? `Eis o conteúdo do documento para analisar :\n\n${content}`
      : `Voici le contenu du document à analyser :\n\n${content}`)

  const vitfix = content.includes('[VITFIX-DEVIS-METADATA]') || /DEV-\d{4}-\d{3,}/.test(content)
  const systemPrompt = isPt ? SYSTEM_PROMPT_PT : SYSTEM_PROMPT_FR
  const extractPrompt = isPt ? EXTRACT_PROMPT_PT : EXTRACT_PROMPT_FR

  try {
    const [analyseData, extractData] = await Promise.all([
      callGroqWithRetry({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 5000,
      }, { apiKey: GROQ_API_KEY }),
      callGroqWithRetry({
        messages: [
          { role: 'system', content: extractPrompt },
          { role: 'user', content: isPt
            ? `Documento para analisar :\n\n${content}`
            : `Document à analyser :\n\n${content}` },
        ],
        temperature: 0,
        max_tokens: 1200,
      }, { apiKey: GROQ_API_KEY }).catch(err => { logger.error('[syndic/analyse-devis] Extraction failed:', err); return null }),
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

    // ── Vérification entreprise + Scoring (dispatch FR/PT) ──
    // FR : SIRET via API verify-siret (Sirene).
    // PT : NIF checksum local (algorithme AT modulo 11), pas d'API externe.
    let scores: AnalyseScores
    let siretResult: { verified: boolean; company?: Record<string, unknown> }

    if (isPt) {
      const { validateNif, extractNif } = await import('@/lib/nif-pt')
      const { calculateScoresPt } = await import('@/lib/analyse-devis-scoring-pt')
      // Fallback déterministe : si le LLM JSON extractor a laissé artisan_siret
      // vide ou invalide, on scanne le texte brut nous-mêmes.
      let nifRaw = (extracted.artisan_siret as string) || ''
      if (!nifRaw || !validateNif(nifRaw)) {
        const fromText = extractNif(content)
        if (fromText) {
          nifRaw = fromText
          extracted.artisan_siret = fromText
        }
      }
      const nifVerified = validateNif(nifRaw)
      siretResult = { verified: nifVerified }
      scores = calculateScoresPt(extracted, content, { nifVerified })
    } else {
      siretResult = await verifySiret((extracted.artisan_siret as string) || '', req)
      scores = calculateScores(
        (extracted.mentions_presentes || []) as string[],
        (extracted.mentions_manquantes || []) as string[],
        extracted,
        siretResult.verified,
      )
    }

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
    return NextResponse.json(
      { error: isPt ? 'Erro do servidor' : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
