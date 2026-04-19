import { z } from 'zod'
import { callGroqWithRetry } from '@/lib/groq'
import { allRecipes } from '../recipes'
import type { EstimationInput, ChantierProfile } from '../types'
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

function buildCatalog() {
  return allRecipes.map(r => ({
    id: r.id,
    name: r.name,
    trade: r.trade,
    baseUnit: r.baseUnit,
    geometryMode: r.geometryMode,
    description: r.description?.slice(0, 100),
  }))
}

function buildSystemPrompt(): string {
  const catalog = buildCatalog()
  return `Tu es un expert en métré BTP français. Ton rôle : extraire des ouvrages structurés depuis la description libre d'un artisan.

CATALOGUE des recettes disponibles (n'UTILISE QUE ces IDs exactement) :
${JSON.stringify(catalog, null, 2)}

CHAQUE OUVRAGE DU CATALOGUE EST AUTONOME — sa recette inclut déjà :
- Préparation (hérisson, polyane, primaire, ragréage, ponçage, masquage…)
- Ouvrage principal (béton, plaques, carreaux, peinture…)
- Accessoires (joints, croisillons, vis, cure, cales…)
- Finitions (silicone, bande, enduit…)
- Options conditionnelles (isolant RE2020, hydrofuge, plinthes…)

Tu n'as PAS à détailler les matériaux : identifie le bon recipeId et la géométrie.
Le moteur expanse automatiquement les matériaux par phase.

RÈGLES D'EXTRACTION :
1. Chaque ouvrage mentionné → un item avec l'ID le plus proche du catalogue.
   Si incertain, choisis l'ID le plus courant + note-le dans "assumptions".
2. Dimensions numériques en MÈTRES (converti cm→m : 12 cm = 0.12 m).
3. Selon le geometryMode de la recette :
   - "volume" : length + width + thickness (ou volume direct)
   - "area_minus_openings" : length + height + openings (si portes/fenêtres)
   - "area" : area, ou length + width
   - "length" : length (ou perimeter)
   - "count" : count entier
4. Ouvertures (portes/fenêtres) → convertis en m² :
   - porte intérieure ≈ 1.5 m² (2,04 × 0,73 m)
   - porte d'entrée ≈ 2.0 m²
   - fenêtre standard ≈ 1.25 m² (1,25 × 1,00 m)
5. Profil chantier : déduis-le SI mentionné explicitement ("petit", "difficile", "apprenti", "pistolet", "formes complexes"). Sinon, omets.

RÈGLES CRITIQUES D'HYPOTHÈSES :
6. Dans "assumptions", EXPLICITE TOUJOURS :
   - Les dimensions que tu as inférées (ex: "hauteur supposée 2,5m" si non précisée)
   - Le choix de recette si ambigü (ex: "choisi ST25C habitation plutôt que ST40C garage")
   - Les choix RE2020 / acoustique / humidité (l'utilisateur a dit "garage" → signaler isolant sous dalle optionnel)
   - Le fait que les accessoires/préparation sont INCLUS par la recette (pas besoin de re-lister)
7. Dans "questions", remonte UNIQUEMENT les infos bloquantes manquantes
   (dimension critique introuvable empêchant le calcul).

RÉPONDS UNIQUEMENT EN JSON VALIDE, sans texte autour, selon ce schéma :

{
  "items": [
    { "recipeId": "...", "geometry": { ... }, "label": "..." }
  ],
  "chantierProfile": { "difficulty": "standard", "size": "moyen", "workforceLevel": "mixte" },
  "assumptions": ["..."],
  "questions": ["..."]
}

Si rien n'est extractible, renvoie items vide et explique dans "questions".`
}

export async function extractEstimationWithGroq(
  userDescription: string,
  apiKey?: string
): Promise<ExtractionResult> {
  const systemPrompt = buildSystemPrompt()

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
    { apiKey }
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

  // Filtrer les recipeId inconnus (safety)
  const validIds = new Set(allRecipes.map(r => r.id))
  const unknownIds = result.items.filter(i => !validIds.has(i.recipeId)).map(i => i.recipeId)
  if (unknownIds.length > 0) {
    result.assumptions.push(`Recettes inconnues ignorées : ${unknownIds.join(', ')}`)
    result.items = result.items.filter(i => validIds.has(i.recipeId))
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
