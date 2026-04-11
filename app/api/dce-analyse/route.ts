import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry } from '@/lib/groq'
import { logger } from '@/lib/logger'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// ── Types ────────────────────────────────────────────────────────────────────

interface Lot {
  numero: string
  intitule: string
  montantEstime?: number
  description?: string
}

interface CompanyData {
  raisonSociale?: string
  siret?: string
  nif?: string
  qualifications?: string[]
  effectif?: number
  caAnnuel?: number
  references?: string[]
  assuranceDecennale?: boolean
  alvaraClasse?: string
}

interface DCERequest {
  country: 'FR' | 'PT'
  projectType: string
  projectDescription: string
  lots: Lot[]
  budget: number
  deadline: string
  companyData?: CompanyData
  documents?: string[]
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateDCERequest(body: unknown): { success: true; data: DCERequest } | { success: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Corps de requête invalide' }
  }

  const b = body as Record<string, unknown>

  if (!b.country || !['FR', 'PT'].includes(b.country as string)) {
    return { success: false, error: 'country requis (FR ou PT)' }
  }
  if (!b.projectType || typeof b.projectType !== 'string') {
    return { success: false, error: 'projectType requis' }
  }
  if (!b.projectDescription || typeof b.projectDescription !== 'string') {
    return { success: false, error: 'projectDescription requis' }
  }
  if ((b.projectDescription as string).length > 5000) {
    return { success: false, error: 'projectDescription trop long (max 5000 caractères)' }
  }
  if (!Array.isArray(b.lots) || b.lots.length === 0) {
    return { success: false, error: 'lots requis (tableau non vide)' }
  }
  if (b.lots.length > 50) {
    return { success: false, error: 'Trop de lots (max 50)' }
  }
  if (typeof b.budget !== 'number' || b.budget <= 0) {
    return { success: false, error: 'budget requis (nombre positif)' }
  }
  if (!b.deadline || typeof b.deadline !== 'string') {
    return { success: false, error: 'deadline requis (date string)' }
  }

  return { success: true, data: b as unknown as DCERequest }
}

// ── System prompt ────────────────────────────────────────────────────────────

function buildDCESystemPrompt(data: DCERequest): string {
  const isFR = data.country === 'FR'
  const fmt = (v: number) =>
    new Intl.NumberFormat(isFR ? 'fr-FR' : 'pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

  const lotsDescription = data.lots
    .map((l) => `  - Lot ${l.numero} : ${l.intitule}${l.montantEstime ? ` (estimé ${fmt(l.montantEstime)})` : ''}${l.description ? ` — ${l.description}` : ''}`)
    .join('\n')

  const companyBlock = data.companyData
    ? `
DONNÉES DE L'ENTREPRISE CANDIDATE :
- Raison sociale : ${data.companyData.raisonSociale || 'Non renseigné'}
- ${isFR ? 'SIRET' : 'NIF'} : ${(isFR ? data.companyData.siret : data.companyData.nif) || 'Non renseigné'}
- Qualifications : ${data.companyData.qualifications?.join(', ') || 'Non renseignées'}
- Effectif : ${data.companyData.effectif || 'Non renseigné'}
- CA annuel : ${data.companyData.caAnnuel ? fmt(data.companyData.caAnnuel) : 'Non renseigné'}
- Références : ${data.companyData.references?.join(', ') || 'Aucune'}
- Assurance décennale : ${data.companyData.assuranceDecennale ? 'Oui' : 'Non renseigné'}
${!isFR && data.companyData.alvaraClasse ? `- Alvará classe : ${data.companyData.alvaraClasse}` : ''}`
    : ''

  const docsBlock = data.documents?.length
    ? `\nDOCUMENTS DCE FOURNIS : ${data.documents.join(', ')}`
    : ''

  const reglementationFR = `
RÉGLEMENTATION MARCHÉS PUBLICS FRANCE :
- Code de la commande publique (CCP) 2019 + décrets 2024-2025
- Seuils MAPA : travaux < 100 000 € HT (sans publicité ni mise en concurrence possible < 40 000 €)
- Seuils formalisés : travaux ≥ 5 538 000 € HT (appel d'offres obligatoire)
- Pièces administratives : DC1 (lettre de candidature), DC2 (capacités du candidat), DC4 (sous-traitance)
- Mémoire technique : pièce maîtresse de notation (40-60% de la note habituellement)
- Retenue de garantie : 5% max (art. R2191-32 CCP), libérée à réception + 1 an
- Garantie à première demande : substituable à la retenue de garantie
- Sous-traitance : déclaration obligatoire DC4, paiement direct obligatoire > seuil
- Délai global de paiement : 30 jours (collectivités), 60 jours (EP santé)
- Avance forfaitaire : 20% si marché > 50 000 € HT et durée > 2 mois
- Variation prix : clause obligatoire si marché > 3 mois (actualisation ou révision)
- Assurances obligatoires : décennale + RC professionnelle
- Qualibat / OPQIBI / RGE selon nature des travaux`

  const reglementationPT = `
REGULAMENTAÇÃO CONTRATAÇÃO PÚBLICA PORTUGAL :
- Código dos Contratos Públicos (CCP) — DL 18/2008, revisão 2023
- Ajuste direto : < 30 000 € (regime simplificado < 5 000 €)
- Consulta prévia : < 150 000 € (obras)
- Concurso público : ≥ 150 000 € (obras), ≥ 75 000 € (bens/serviços)
- Concurso limitado por prévia qualificação : obras complexas
- Habilitação : certidão permanente, declaração IRS/IRC, certidão SS e AT
- Alvará IMPIC : obrigatório por classe e subcategoria (1ª a 9ª classe)
  Classes: 1 (≤166k€), 2 (≤332k€), 3 (≤664k€), 4 (≤1.328M€), 5 (≤2.656M€)...
- Caução : 5% do preço contratual (garantia bancária, seguro-caução, depósito)
- Prazo de pagamento : 30 dias (entidades públicas), 60 dias (saúde)
- Adiantamento : possível até 30% do preço contratual
- Revisão de preços : cláusula obrigatória se prazo > 12 meses
- Seguro de responsabilidade civil profissional obrigatório
- Declaração de subcontratação obrigatória`

  return `Tu es un expert senior en analyse de DCE (Dossiers de Consultation des Entreprises) pour le secteur BTP. Tu maîtrises parfaitement la réglementation des marchés publics et privés ${isFR ? 'en France' : 'au Portugal'}.

CONTEXTE DU MARCHÉ À ANALYSER :
- Pays : ${isFR ? 'France' : 'Portugal'}
- Type de projet : ${data.projectType}
- Description : ${data.projectDescription}
- Budget estimé : ${fmt(data.budget)}
- Date limite de remise : ${data.deadline}
- Lots :
${lotsDescription}
${companyBlock}${docsBlock}

${isFR ? reglementationFR : reglementationPT}

INSTRUCTIONS — Analyse complète en 8 sections :

Tu dois produire une réponse JSON strictement structurée avec ces 8 clés :

1. "analyseMarche" : {
   "nature" : string (type de marché : travaux, fournitures, services, mixte),
   "localisation" : string,
   "complexite" : "faible" | "moyenne" | "élevée" | "très élevée",
   "risquesPrincipaux" : string[] (5 risques identifiés),
   "criteresProbables" : [{ "critere": string, "ponderationEstimee": string }],
   "analyse" : string (synthèse 3-5 phrases)
}

2. "exigencesAdministratives" : {
   "documentsObligatoires" : string[] (${isFR ? 'DC1, DC2, DC4, attestations, etc.' : 'habilitação, certidões, alvará, etc.'}),
   "certifications" : string[] (qualifications requises ou recommandées),
   "delais" : { "remise": string, "validiteOffre": string, "executionEstimee": string },
   "garanties" : { "type": string, "montant": string, "duree": string },
   "pointsVigilance" : string[] (pièges fréquents dans la constitution du dossier)
}

3. "strategieReponse" : {
   "axeTechnique" : string (différenciation technique proposée),
   "axePrix" : string (positionnement tarifaire recommandé),
   "axeDelais" : string (optimisation planning proposée),
   "recommandations" : string[] (5-8 recommandations concrètes)
}

4. "memoireTechnique" : {
   "sections" : [
     { "titre": string, "contenu": string, "pointsCles": string[] }
   ] (8 sections : présentation entreprise, compréhension du besoin, méthodologie, moyens humains, moyens matériels, planning, qualité/sécurité/environnement, références similaires)
}

5. "analyseFinanciere" : {
   "coherenceBPU" : string (analyse de cohérence du Bordereau de Prix Unitaires),
   "anomaliesPrix" : string[] (prix anormalement bas ou hauts identifiés),
   "margeRecommandee" : string,
   "optimisations" : string[] (leviers de réduction de coûts sans dégrader la qualité),
   "risquesFinanciers" : string[]
}

6. "sousTraitance" : {
   "lotsAExternaliser" : string[] (lots ou parties recommandées en sous-traitance),
   "justification" : string,
   "documentRequis" : string (${isFR ? 'DC4 + acte spécial' : 'declaração de subcontratação'}),
   "precautions" : string[]
}

7. "scoring" : {
   "noteGlobale" : number (score de compétitivité /100),
   "probabiliteGain" : string (pourcentage estimé de chances de gagner),
   "forces" : string[],
   "faiblesses" : string[],
   "actionsAmelioratrices" : string[] (actions pour gagner 10-15 points)
}

8. "checklistPreDepot" : {
   "items" : [
     { "categorie": string, "element": string, "obligatoire": boolean, "statut": "à_vérifier" }
   ] (liste exhaustive des vérifications avant dépôt)
}

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, pas de texte avant ou après.
- Sois précis et actionnable. Chaque recommandation doit être directement applicable.
- Adapte le vocabulaire réglementaire au pays (${isFR ? 'France — CCP' : 'Portugal — CCP/DL 18/2008'}).
- Si des informations manquent, indique-le dans les sections concernées et fournis des valeurs par défaut raisonnables.
- Les montants doivent être en euros, formatés selon la locale ${isFR ? 'fr-FR' : 'pt-PT'}.`
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limiting — 5 req/min (analyse lourde)
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 5, 60_000))) return rateLimitResponse()

    // Auth
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await request.json()
    const v = validateDCERequest(rawBody)
    if (!v.success) {
      return NextResponse.json({ error: v.error }, { status: 400 })
    }
    const data = v.data

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API Groq non configurée. Contactez l\'administrateur.' },
        { status: 503 }
      )
    }

    const systemPrompt = buildDCESystemPrompt(data)

    const userMessage = `Analyse ce DCE et produis le JSON structuré avec les 8 sections demandées.

Projet : ${data.projectType} — ${data.projectDescription}
Budget : ${data.budget} €
Deadline : ${data.deadline}
Pays : ${data.country}
Nombre de lots : ${data.lots.length}
${data.companyData?.raisonSociale ? `Entreprise candidate : ${data.companyData.raisonSociale}` : 'Aucune donnée entreprise fournie — utilise des valeurs génériques.'}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]

    const groqData = await callGroqWithRetry(
      {
        messages,
        temperature: 0.15,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      },
      { maxRetries: 2 }
    )

    const rawContent = groqData.choices?.[0]?.message?.content
    if (!rawContent) {
      logger.error('[dce-analyse] Empty response from Groq')
      return NextResponse.json(
        { error: 'Réponse vide du modèle IA. Réessayez.' },
        { status: 502 }
      )
    }

    // Parse and validate JSON structure
    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(rawContent)
    } catch {
      logger.error('[dce-analyse] Invalid JSON from Groq:', rawContent.substring(0, 200))
      return NextResponse.json(
        { error: 'Réponse IA mal formatée. Réessayez.' },
        { status: 502 }
      )
    }

    const expectedSections = [
      'analyseMarche',
      'exigencesAdministratives',
      'strategieReponse',
      'memoireTechnique',
      'analyseFinanciere',
      'sousTraitance',
      'scoring',
      'checklistPreDepot',
    ]

    const missingSections = expectedSections.filter((s) => !(s in analysis))
    if (missingSections.length > 0) {
      logger.warn('[dce-analyse] Missing sections:', missingSections.join(', '))
    }

    return NextResponse.json({
      analysis,
      meta: {
        country: data.country,
        projectType: data.projectType,
        budget: data.budget,
        lotsCount: data.lots.length,
        model: groqData.model || 'llama-3.3-70b-versatile',
        tokens: groqData.usage?.total_tokens || 0,
        missingSections: missingSections.length > 0 ? missingSections : undefined,
      },
    })
  } catch (err) {
    logger.error('[dce-analyse] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Erreur interne. Réessayez dans quelques instants.' },
      { status: 500 }
    )
  }
}
