import { z } from 'zod'
import { callGroqWithRetry } from '@/lib/groq'
import { allRecipes } from '../recipes'
import type { EstimationInput, ChantierProfile, Recipe } from '../types'
import { EstimationInputSchema } from '../types'

/**
 * Extracteur IA (Groq / Llama 3.3 70B) pour le module Estimation matériaux.
 * Interprète une description en langage naturel et produit un EstimationInput
 * structuré, validé par Zod, prêt à être passé à estimateProject().
 */

const ExtractionResultSchema = z.object({
  items: z.array(z.object({
    recipeId: z.string(),
    geometry: z.object({
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      thickness: z.number().positive().optional(),
      area: z.number().positive().optional(),
      volume: z.number().positive().optional(),
      perimeter: z.number().positive().optional(),
      count: z.number().int().positive().optional(),
      coats: z.number().int().positive().optional(),
      openings: z.number().nonnegative().optional(),
    }),
    label: z.string().optional(),
  })),
  chantierProfile: z.object({
    difficulty: z.enum(['facile', 'standard', 'difficile']).optional(),
    size: z.enum(['petit', 'moyen', 'grand']).optional(),
    workforceLevel: z.enum(['experimente', 'mixte', 'apprenti']).optional(),
    complexShapes: z.boolean().optional(),
    isPistoletPainting: z.boolean().optional(),
  }).optional(),
  assumptions: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
})

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>

/**
 * Catalogue compact : `id | name (mode)` sur une ligne par recette, groupé par
 * trade. Évite le JSON lourd (×4 plus compact) et contient l'essentiel pour
 * que le LLM choisisse le bon recipeId. Économie : ~60 % de tokens sur le
 * prompt système (passe de ~30k à ~12k tokens pour le catalogue).
 */
function buildCatalog(scope?: { trades?: Recipe['trade'][]; country?: 'FR' | 'PT' }): string {
  const byTrade: Record<string, string[]> = {}
  for (const r of allRecipes) {
    if (scope?.country && r.country && r.country !== scope.country) continue
    if (scope?.trades && scope.trades.length > 0 && !scope.trades.includes(r.trade)) continue
    if (!byTrade[r.trade]) byTrade[r.trade] = []
    byTrade[r.trade].push(`  ${r.id} | ${r.name} (${r.geometryMode}→${r.baseUnit})`)
  }
  const parts: string[] = []
  for (const trade of Object.keys(byTrade).sort()) {
    parts.push(`[${trade}]`)
    parts.push(byTrade[trade].join('\n'))
  }
  return parts.join('\n')
}

function buildSystemPrompt(scope?: { trades?: Recipe['trade'][]; country?: 'FR' | 'PT' }): string {
  const scopeNote = scope?.trades && scope.trades.length > 0
    ? `\n⚠️ PÉRIMÈTRE RESTREINT : ne propose QUE des recettes des corps de métier suivants : ${scope.trades.join(', ')}. Si l'utilisateur demande un ouvrage hors périmètre, pose une question dans "questions" pour clarifier (ne choisis PAS de recipeId hors du catalogue ci-dessous).\n`
    : ''
  return `Tu es un CONDUCTEUR DE TRAVAUX EXPÉRIMENTÉ — tu ANALYSES, tu PROPOSES, tu QUESTIONNES.${scopeNote}
Tu ne devines pas au hasard : si une info manque, tu POSES UNE QUESTION précise.
Quand tu peux proposer une valeur calibrée par le contexte, tu la PROPOSES explicitement dans "assumptions".

MISSION : à partir d'une description libre, identifier les ouvrages nécessaires et produire un
EstimationInput structuré AVEC valeurs par défaut CALIBRÉES et QUESTIONS de précision.

=================================================================
CATALOGUE (recipeId | nom (mode_géométrie→unité_base)) — IDs autorisés UNIQUEMENT
=================================================================
${buildCatalog(scope)}

=================================================================
RÈGLE N°1 — TOUJOURS PROPOSER UNE VALEUR CALIBRÉE (jamais "je ne sais pas")
=================================================================
Si l'utilisateur ne précise pas une dimension, tu PROPOSES une valeur standard
adaptée au CONTEXTE (habitation / garage / tertiaire…) et tu l'annonces
explicitement dans "assumptions". L'utilisateur peut corriger, mais tu ne laisses
JAMAIS un calcul impossible.

VALEURS PAR DÉFAUT CALIBRÉES selon CONTEXTE :

DALLE BÉTON — épaisseur selon usage :
  • Habitation / pièces à vivre : 12 cm + ST25C
  • Garage véhicules légers : 15 cm + ST40C
  • Garage pro / atelier charges lourdes : 20 cm + ST40C ou ST60C
  • Terrasse extérieure piétonne : 10 cm + ST25C
  • Plage piscine : 12 cm + ST25C
  → Choisis la recette ET l'épaisseur ET annonce dans assumptions.

MUR — hauteur selon usage :
  • Habitation standard : 2,50 m
  • Garage simple : 2,40 m
  • Étage haut : 2,70 m
  • Mezzanine / combles : 1,80 m
  → Si non précisé, propose 2,50 m (habitation) dans assumptions.

CLOISON PLACO — choix selon hauteur :
  • H ≤ 2,60 m : cloison-placo-72-48 (standard)
  • H > 2,60 m : cloison-placo-98-48 (renforcée) si disponible catalogue
  → Si hauteur non précisée : suppose 2,50 m + cloison 72/48.

PEINTURE — couches selon finition :
  • Travaux courants (classe B DTU 59.1) : 2 couches + 1 sous-couche = standard
  • Finition soignée (classe A) : 3 couches
  • Rafraîchissement sur support peint non dégradé : 2 couches sans sous-couche
  → Par défaut : 2 couches + sous-couche (neuf) ou 2 couches sans (rénovation).

CARRELAGE SOL — format selon pièce :
  • Cuisine / salle d'eau : 45×45 cm (collage simple)
  • Séjour / grand volume : 60×60 ou 80×80 (grand format, double encollage)
  • Extérieur terrasse : 60×60 anti-dérapant R11
  → Propose le format par défaut selon pièce.

COUVERTURE — tuile selon région / style :
  • Sud / PACA : tuile canal OU TC à emboîtement
  • Nord / Picardie : ardoise ou tuile plate
  • Rénovation économique : tuile béton (moins chère, plus lourde)
  → Si non précisé, propose TC à emboîtement + mentionne alternatives en assumptions.

CHAUFFAGE — choix selon isolation :
  • Neuf RE2020 bien isolé : PAC air/eau + plancher chauffant
  • Rénovation passable : PAC + radiateurs chaleur douce
  • Gros débit chauffe ponctuel : poêle granulés (appoint)
  → Propose la recette cohérente avec l'isolation déclarée.

PLOMBERIE SANITAIRE — par équipement :
  • Cuisine : 1 évier + 1 lave-vaisselle + 1 robinet → distribution PER
  • SDB classique : 1 lavabo + 1 WC + 1 douche ou baignoire
  • SDB PMR : idem + barres + larges passages
  → Demande si logement neuf/rénovation/extension.

=================================================================
RÈGLE N°2 — POSER DES QUESTIONS SI CONTEXTE MANQUE (dans "questions")
=================================================================
Pose systématiquement une question quand :
  - Usage ambigu (habitation vs pro vs stockage) → change le choix de recette
  - Zone climatique (Sud/Nord) → change pente toit, isolant, enduit
  - Type support (neuf/ancien/humide) → change sous-couches, primaire
  - Accessibilité (PMR ?) → change aménagement SDB, ouvertures
  - Budget (premier prix / standard / haut de gamme) → change fabricant suggéré
  - Timeline (RE2020 obligatoire si permis post-2022) → change isolants

EXEMPLES DE QUESTIONS CONCRÈTES :
  • "Dalle en intérieur habitation ou garage véhicules ?" (change épaisseur ST25C↔ST40C)
  • "Zone climatique H1/H2/H3 ?" (change pente toit mini, isolant)
  • "Neuf ou rénovation ?" (change préparation supports)
  • "Classement P/U/E du local ?" (change choix carrelage)

=================================================================
RÈGLE N°3 — ANTICIPER LES OUVRAGES COMPLÉMENTAIRES (dans "assumptions")
=================================================================
Mentionne EXPLICITEMENT dans assumptions les ouvrages à ajouter au devis :
  - "mur parpaing extérieur" → semelle-filante-ba + enduit-ext-monocouche
  - "tuiles" → charpente-traditionnelle ou charpente-fermettes EN AMONT
  - "SDB" → membrane SPEC douche + faïence + plomberie + ventilation
  - "PAC" → émetteurs (plancher-chauffant-hydraulique OU radiateurs) + MALT
  - "piscine" → plage carrelage 1-2 m + dispositif sécurité L.128-1 + local technique

=================================================================
GÉOMÉTRIE & CONVERSIONS
=================================================================
- Dimensions en MÈTRES TOUJOURS (12 cm → 0.12 m ; 25 cm → 0.25 m)
- Modes :
  • "volume" : length+width+thickness OU surface+thickness OU volume direct
  • "area" : area OU length×width
  • "area_minus_openings" : length+height+openings
  • "length" : length OU perimeter
  • "count" : nombre entier (fenêtres, portes, WC, appareils…)
- Ouvertures standards :
  • Porte intérieure ≈ 1,5 m² (2,04×0,73)
  • Porte d'entrée ≈ 2,0 m² (2,15×0,93)
  • Fenêtre standard ≈ 1,25 m² (1,25×1,00)
  • Baie vitrée ≈ 3,0 m² (2,15×1,40)

=================================================================
EXEMPLES COMPLETS (à reproduire exactement ce style)
=================================================================

INPUT : "Dalle béton pour habitation 8×10m épaisseur à définir"
OUTPUT :
{
  "items": [
    { "recipeId": "dalle-ba-armee-st25c", "geometry": { "length": 8, "width": 10, "thickness": 0.12 }, "label": "Dalle habitation" }
  ],
  "assumptions": [
    "Usage habitation pressenti → choisi ST25C (charges courantes) + épaisseur standard 12 cm.",
    "Si l'usage change (garage véhicules / atelier charges lourdes), passer à ST40C + 15-20 cm.",
    "Hérisson 20 cm en concassé 20/40 inclus par défaut (à adapter selon portance sol).",
    "Isolant XPS sous dalle NON inclus par défaut — à ajouter pour conformité RE2020 (neuf)."
  ],
  "questions": [
    "Confirmez l'usage : habitation (pièces à vivre) ou sol technique type garage/atelier ?",
    "Construction neuve sous RE2020, ou rénovation existant ? (change l'isolant sous dalle)",
    "Plancher chauffant prévu ? (change l'épaisseur de la chape au-dessus)"
  ]
}

INPUT : "Je dois faire une dalle béton pour habitation, 8 x 10 épaisseur à toi de définir en fonction du contexte"
(MÊME INPUT que ci-dessus en français naturel — MÊME OUTPUT)

INPUT : "Je fais une dalle béton 8×5m en 12 cm pour un garage + mur parpaing 20m×2,5m"
OUTPUT :
{
  "items": [
    { "recipeId": "dalle-ba-armee-st40c", "geometry": { "length": 8, "width": 5, "thickness": 0.12 }, "label": "Dalle garage" },
    { "recipeId": "mur-parpaing-20", "geometry": { "length": 20, "height": 2.5, "openings": 0 }, "label": "Mur parpaing" }
  ],
  "assumptions": [
    "Garage → choisi ST40C (charges véhicules) plutôt que ST25C.",
    "Mur parpaing 20 m × 2,5 m : 0 ouverture supposée — ajoutez si porte/fenêtre.",
    "Fondations du mur NON incluses → ajouter recette 'semelle-filante-ba'.",
    "Enduit extérieur NON inclus → ajouter 'enduit-ext-monocouche' si finition prévue."
  ],
  "questions": [
    "Zone climatique (H1/H2/H3) pour dimensionner les fondations ?",
    "Enduit extérieur prévu (monocouche traditionnel / ETICS) ?"
  ]
}

INPUT : "je veux faire une cuisine"
OUTPUT :
{
  "items": [],
  "assumptions": ["Description trop vague pour un métré précis — besoin de cadrer les surfaces et systèmes."],
  "questions": [
    "Quelle surface au sol de la cuisine (m²) ?",
    "Hauteur sous plafond et surface de faïence murale (crédence seule ou pleine hauteur) ?",
    "Réaménagement complet ou rénovation partielle (carrelage seul / élec seule / plomberie) ?",
    "Hotte : conduit à créer ou existant déjà ?",
    "Budget fourchette : premier prix / standard / haut de gamme ?"
  ]
}

=================================================================
RÈGLES BLOQUANTES
=================================================================
- Ne JAMAIS inventer un recipeId. Utilise UNIQUEMENT ceux du catalogue.
- Si surface/quantité CRITIQUE absente ET non inférable : NE crée PAS l'item, pose question.
- Si description totalement vague : items=[] + 3-5 questions utiles.

FORMAT DE RÉPONSE — JSON VALIDE UNIQUEMENT (aucun texte autour) :
{
  "items": [{ "recipeId": "...", "geometry": { ... }, "label": "..." }],
  "chantierProfile": { "difficulty": "standard", "size": "moyen", "workforceLevel": "mixte" },
  "assumptions": ["..."],
  "questions": ["..."]
}`
}

export async function extractEstimationWithGroq(
  userDescription: string,
  apiKey?: string,
  scope?: { trades?: Recipe['trade'][]; country?: 'FR' | 'PT' }
): Promise<ExtractionResult> {
  const systemPrompt = buildSystemPrompt(scope)

  const response = await callGroqWithRetry(
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userDescription },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    },
    {
      apiKey,
      // Désactive le fallback Llama 3.1 8B : son context effective (~7k) ne
      // suffit pas pour le catalogue 162 recettes + règles calibrées (→ 413).
      // On garde le 70B uniquement, avec retries sur 429.
      fallbackModel: 'llama-3.3-70b-versatile',
      maxRetries: 3,
    }
  )

  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error("Groq n'a pas renvoyé de contenu")

  const raw = typeof content === 'string' ? content : String(content)
  // Nettoie d'éventuels blocs markdown que Llama pourrait retourner malgré json mode
  const clean = raw.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`JSON invalide de l'IA : ${clean.slice(0, 200)}`)
  }

  const result = ExtractionResultSchema.parse(parsed)

  // Filtrer les recipeId inconnus (safety) + scope pays/trades si fourni.
  // Ceinture + bretelles : même si le LLM a triché en proposant une recette
  // hors périmètre, on la rejette ici (anti-abus multi-tenant).
  const scopedRecipes = allRecipes.filter(r => {
    if (scope?.country && r.country && r.country !== scope.country) return false
    if (scope?.trades && scope.trades.length > 0 && !scope.trades.includes(r.trade)) return false
    return true
  })
  const validIds = new Set(scopedRecipes.map(r => r.id))
  const unknownIds = result.items.filter(i => !validIds.has(i.recipeId)).map(i => i.recipeId)
  if (unknownIds.length > 0) {
    const reason = scope?.trades && scope.trades.length > 0
      ? `hors périmètre métier autorisé (${scope.trades.join(', ')})`
      : 'inconnues'
    result.assumptions.push(`Recettes ${reason} ignorées : ${unknownIds.join(', ')}`)
    result.items = result.items.filter(i => validIds.has(i.recipeId))
  }

  // Post-validation : pour chaque item, vérifier que la géométrie contient
  // les dimensions requises par les matériaux (thickness, height, perimeter).
  // Si une dimension critique manque, ajoute une question de relance pour que
  // l'utilisateur la renseigne AVANT calcul (évite résultats à 0 surprises).
  for (const item of result.items) {
    const recipe = allRecipes.find(r => r.id === item.recipeId)
    if (!recipe) continue

    const needsThickness = recipe.materials.some(m => m.geometryMultiplier === 'thickness')
    const needsHeight = recipe.materials.some(m => m.geometryMultiplier === 'height')
    const needsPerimeter = recipe.materials.some(m => m.geometryMultiplier === 'perimeter')

    if (needsThickness && item.geometry.thickness === undefined) {
      result.questions.push(
        `Quelle épaisseur (en cm) pour "${recipe.name}" ? Sans cette valeur, `
        + `le calcul des matériaux liés au volume (béton, ciment, eau, gravier, sable) est impossible.`
      )
    }
    if (needsHeight && item.geometry.height === undefined && !item.geometry.length) {
      result.questions.push(
        `Quelle hauteur pour "${recipe.name}" ?`
      )
    }
    if (needsPerimeter && item.geometry.perimeter === undefined
        && !(item.geometry.length && item.geometry.width)) {
      result.assumptions.push(
        `"${recipe.name}" : périmètre non calculable — certains accessoires `
        + `(joints, bandes, chaînages périphériques) sortiront à 0.`
      )
    }
  }

  return result
}

export function extractionToEstimationInput(
  extraction: ExtractionResult,
  projectName?: string,
  profileFallback?: ChantierProfile
): EstimationInput {
  const input: EstimationInput = {
    projectName,
    items: extraction.items,
    chantierProfile: (extraction.chantierProfile as ChantierProfile | undefined) ?? profileFallback,
  }
  return EstimationInputSchema.parse(input)
}
