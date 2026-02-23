import { NextResponse, type NextRequest } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

export interface EmailClassification {
  urgence: 'haute' | 'moyenne' | 'basse'
  type: 'signalement_panne' | 'demande_devis' | 'reclamation' | 'ag' | 'facturation' | 'resiliation' | 'information' | 'autre'
  resume: string
  immeuble_detecte: string | null
  locataire_detecte: string | null
  actions_suggerees: string[]
  reponse_suggeree: string | null
}

const SYSTEM_PROMPT = `Tu es Max, assistant IA expert en gestion de copropriété pour VitFix Pro.
Analyse cet email reçu par un syndic/gestionnaire de copropriété et retourne UNIQUEMENT un objet JSON valide, sans markdown, sans texte avant ou après.

Format de réponse JSON strict :
{
  "urgence": "haute" | "moyenne" | "basse",
  "type": "signalement_panne" | "demande_devis" | "reclamation" | "ag" | "facturation" | "resiliation" | "information" | "autre",
  "resume": "Résumé clair en 1 phrase maximum (15 mots max)",
  "immeuble_detecte": "Nom de l'immeuble si mentionné dans l'email, sinon null",
  "locataire_detecte": "Prénom Nom de l'expéditeur ou du résident concerné, sinon null",
  "actions_suggerees": ["Action 1", "Action 2"],
  "reponse_suggeree": "Brouillon de réponse professionnelle et concise en 2-3 phrases, ou null si pas pertinent"
}

Règles classification urgence :
- "haute" : fuite d'eau, inondation, incendie, panne ascenseur bloqué, coupure électricité/gaz, odeur gaz, sécurité, effraction, dégât des eaux
- "moyenne" : réclamation, panne non bloquante, demande devis urgent, problème en cours non résolu, plainte copropriétaire
- "basse" : demande d'information, convocation AG planifiée, document administratif, devis futur, newsletter

Règles type :
- "signalement_panne" : problème technique, panne, dysfonctionnement, dégât
- "demande_devis" : demande de devis, estimation de travaux
- "reclamation" : plainte, réclamation, mécontentement, litige
- "ag" : assemblée générale, convocation, PV, vote
- "facturation" : facture, paiement, charges, relance, avis d'échéance
- "resiliation" : résiliation de contrat, départ locataire, fin de mandat
- "information" : information générale, documentation, actualité
- "autre" : ne correspond à aucune catégorie ci-dessus

Actions suggérées possibles :
- "Créer une mission d'urgence"
- "Créer une mission planifiée"
- "Contacter l'artisan"
- "Répondre à l'expéditeur"
- "Transmettre au gestionnaire"
- "Archiver"
- "Planifier en AG"
- "Envoyer un accusé de réception"`

export async function POST(request: NextRequest) {
  try {
    const { from, subject, body } = await request.json()

    if (!subject && !body) {
      return NextResponse.json({ error: 'Email vide' }, { status: 400 })
    }

    const emailContent = `De : ${from || 'Inconnu'}
Objet : ${subject || '(sans objet)'}
Corps du message :
${(body || '').substring(0, 800)}`

    if (!GROQ_API_KEY) {
      // Fallback heuristique sans IA
      return NextResponse.json({ classification: getFallbackClassification(subject || '', body || '') })
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // 8B : rapide et suffisant pour classification
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyse cet email et retourne uniquement le JSON :\n\n${emailContent}` },
        ],
        temperature: 0.1, // Très déterministe pour JSON structuré
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq classify error:', groqRes.status, errText)
      return NextResponse.json({ classification: getFallbackClassification(subject || '', body || '') })
    }

    const groqData = await groqRes.json()
    const rawContent = groqData.choices?.[0]?.message?.content || '{}'

    let classification: EmailClassification
    try {
      classification = JSON.parse(rawContent)
    } catch {
      classification = getFallbackClassification(subject || '', body || '')
    }

    // Validation et valeurs par défaut
    classification.urgence = ['haute', 'moyenne', 'basse'].includes(classification.urgence) ? classification.urgence : 'basse'
    classification.type = ['signalement_panne', 'demande_devis', 'reclamation', 'ag', 'facturation', 'resiliation', 'information', 'autre'].includes(classification.type) ? classification.type : 'autre'
    classification.resume = classification.resume || subject || 'Email sans résumé'
    classification.actions_suggerees = Array.isArray(classification.actions_suggerees) ? classification.actions_suggerees.slice(0, 3) : ['Répondre à l\'expéditeur', 'Archiver']

    return NextResponse.json({ classification })

  } catch (err: any) {
    console.error('Classify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Fallback heuristique sans appel IA ───────────────────────────────────────
function getFallbackClassification(subject: string, body: string): EmailClassification {
  const text = (subject + ' ' + body).toLowerCase()

  const urgentKeywords = ['fuite', 'inondation', 'incendie', 'panne', 'bloqué', 'coupure', 'gaz', 'odeur', 'urgent', 'urgence', 'dégât', 'effraction', 'ascenseur']
  const moyenKeywords = ['réclamation', 'plainte', 'problème', 'devis', 'panne', 'dysfonctionnement', 'réparer']
  const panneKeywords = ['fuite', 'panne', 'cassé', 'brisé', 'dégât', 'inondation', 'ascenseur', 'chauffage', 'électricité', 'interphone']
  const agKeywords = ['assemblée', 'ag', 'convocation', 'vote', 'pv', 'résolution']
  const factureKeywords = ['facture', 'paiement', 'charges', 'relance', 'règlement', 'avis d\'échéance']
  const devisKeywords = ['devis', 'estimation', 'travaux', 'chiffrage', 'proposition']

  let urgence: EmailClassification['urgence'] = 'basse'
  if (urgentKeywords.some(k => text.includes(k))) urgence = 'haute'
  else if (moyenKeywords.some(k => text.includes(k))) urgence = 'moyenne'

  let type: EmailClassification['type'] = 'autre'
  if (panneKeywords.some(k => text.includes(k))) type = 'signalement_panne'
  else if (agKeywords.some(k => text.includes(k))) type = 'ag'
  else if (factureKeywords.some(k => text.includes(k))) type = 'facturation'
  else if (devisKeywords.some(k => text.includes(k))) type = 'demande_devis'

  return {
    urgence,
    type,
    resume: subject.substring(0, 80) || 'Email reçu',
    immeuble_detecte: null,
    locataire_detecte: null,
    actions_suggerees: urgence === 'haute' ? ['Créer une mission d\'urgence', 'Répondre à l\'expéditeur'] : ['Répondre à l\'expéditeur', 'Archiver'],
    reponse_suggeree: null,
  }
}
