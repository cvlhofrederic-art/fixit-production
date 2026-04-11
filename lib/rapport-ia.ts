// ══════════════════════════════════════════════════════════════════════════════
// lib/rapport-ia.ts — Génération IA du texte de rapport d'intervention
// Utilise Groq API (Llama 3.3 70B) via lib/groq.ts existant
// Fallback structurel intégré — ne plante jamais
// ══════════════════════════════════════════════════════════════════════════════

import { callGroqWithRetry } from '@/lib/groq'

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface DonneesChantier {
  // Données garanties présentes
  motif_nom: string
  artisan_prenom: string
  artisan_nom: string
  client_prenom: string
  client_civilite?: string
  adresse_chantier: string
  date_intervention: Date
  duree_heures?: number
  // Données optionnelles — enrichissent le rapport si présentes
  description_devis?: string
  texte_dictee?: string
  notes_artisan?: string
  materiaux_utilises?: string[]
}

export interface ContenuRapportIA {
  introduction: string
  travaux_realises: string
  observations: string
  conclusion: string
  source: 'groq' | 'fallback_structurel'
  genere_par_ia: boolean
}

// ── Fonction principale exportée ─────────────────────────────────────────────

export async function genererTexteRapport(
  donnees: DonneesChantier
): Promise<ContenuRapportIA> {
  // Feature flag — si désactivé, toujours le fallback
  if (process.env.RAPPORT_IA_ACTIF !== 'true') {
    return genererFallbackStructurel(donnees)
  }

  // Tenter la génération IA
  try {
    return await genererAvecGroq(donnees)
  } catch (err) {
    console.error('[rapport-ia] Groq indisponible, fallback:', err)
    return genererFallbackStructurel(donnees)
  }
}

// ── Génération via Groq ──────────────────────────────────────────────────────

async function genererAvecGroq(
  donnees: DonneesChantier
): Promise<ContenuRapportIA> {
  const dateStr = donnees.date_intervention.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Construire le contexte depuis les données disponibles
  const lignesContexte: string[] = [
    `Type d'intervention : ${donnees.motif_nom}`,
    `Date : ${dateStr}`,
    `Adresse : ${donnees.adresse_chantier}`,
    `Client : ${donnees.client_civilite || ''} ${donnees.client_prenom}`.trim(),
    `Artisan : ${donnees.artisan_prenom} ${donnees.artisan_nom}`,
  ]

  if (donnees.duree_heures) {
    lignesContexte.push(`Durée : ${donnees.duree_heures}h`)
  }
  if (donnees.description_devis) {
    lignesContexte.push(`Description des travaux prévus : ${donnees.description_devis}`)
  }
  if (donnees.texte_dictee) {
    lignesContexte.push(`Notes de l'artisan (dictée vocale) : "${donnees.texte_dictee}"`)
  }
  if (donnees.notes_artisan) {
    lignesContexte.push(`Notes complémentaires : ${donnees.notes_artisan}`)
  }
  if (donnees.materiaux_utilises?.length) {
    lignesContexte.push(`Matériaux utilisés : ${donnees.materiaux_utilises.join(', ')}`)
  }

  const prompt = `Tu es un assistant pour artisans professionnels en France et au Portugal. Génère un rapport d'intervention professionnel, concis et factuel en français.

DONNÉES DU CHANTIER :
${lignesContexte.join('\n')}

INSTRUCTIONS STRICTES :
- Rédige à la première personne ("J'ai effectué...", "L'intervention a consisté...")
- Phrases courtes, claires et professionnelles
- Maximum 2-3 phrases par section
- N'invente AUCUN détail non fourni dans les données
- Si une information manque, formule de façon générique
- Langue : français standard, ton professionnel mais accessible
- Pas de formatage markdown, pas de titres, texte brut uniquement

Réponds UNIQUEMENT en JSON valide avec cette structure :
{
  "introduction": "...",
  "travaux_realises": "...",
  "observations": "...",
  "conclusion": "..."
}`

  const groqResponse = await callGroqWithRetry({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  })

  const raw = groqResponse.choices[0]?.message?.content
  if (!raw) throw new Error('Réponse Groq vide')

  let contenu
  try { contenu = JSON.parse(raw) } catch (e) { throw new Error(`Réponse Groq JSON invalide: ${e instanceof Error ? e.message : String(e)}`) }

  // Validation : tous les champs requis présents et non vides
  const champsRequis = ['introduction', 'travaux_realises', 'observations', 'conclusion'] as const
  for (const champ of champsRequis) {
    if (!contenu[champ] || typeof contenu[champ] !== 'string') {
      throw new Error(`Champ manquant dans réponse Groq : ${champ}`)
    }
    if (contenu[champ].trim().length < 10) {
      throw new Error(`Champ trop court dans réponse Groq : ${champ}`)
    }
  }

  return {
    introduction: contenu.introduction.trim(),
    travaux_realises: contenu.travaux_realises.trim(),
    observations: contenu.observations.trim(),
    conclusion: contenu.conclusion.trim(),
    source: 'groq',
    genere_par_ia: true,
  }
}

// ── Fallback structurel ──────────────────────────────────────────────────────
// Toujours fonctionnel même sans IA ni internet
// Génère un rapport correct depuis les données seules

export function genererFallbackStructurel(
  donnees: DonneesChantier
): ContenuRapportIA {
  const dateStr = donnees.date_intervention.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const civilite = donnees.client_civilite ? `${donnees.client_civilite} ` : ''

  return {
    introduction:
      `Intervention réalisée le ${dateStr} au domicile de ` +
      `${civilite}${donnees.client_prenom}, ` +
      `${donnees.adresse_chantier}.`,

    travaux_realises:
      donnees.texte_dictee ||
      donnees.description_devis ||
      `Prestation de type "${donnees.motif_nom}" réalisée conformément au devis signé.` +
        (donnees.duree_heures ? ` Durée d'intervention : ${donnees.duree_heures}h.` : ''),

    observations:
      donnees.notes_artisan ||
      "Intervention réalisée dans les règles de l'art. Chantier nettoyé et matériaux évacués.",

    conclusion:
      `Intervention terminée et validée. — ${donnees.artisan_prenom} ${donnees.artisan_nom}`,

    source: 'fallback_structurel',
    genere_par_ia: false,
  }
}
