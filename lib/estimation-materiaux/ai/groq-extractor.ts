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
  // Catalogue groupé par trade pour lisibilité + mention des ouvrages "obligatoirement complémentaires"
  const byTrade: Record<string, Array<{ id: string; name: string; baseUnit: string; geometryMode: string; description?: string }>> = {}
  for (const r of allRecipes) {
    if (!byTrade[r.trade]) byTrade[r.trade] = []
    byTrade[r.trade].push({
      id: r.id,
      name: r.name,
      baseUnit: r.baseUnit,
      geometryMode: r.geometryMode,
      description: r.description?.slice(0, 80),
    })
  }
  return byTrade
}

function buildSystemPrompt(): string {
  const catalog = buildCatalog()
  return `Tu es un CONDUCTEUR DE TRAVAUX EXPÉRIMENTÉ — pas un simple extracteur.

MISSION : à partir d'une description libre d'artisan, identifier TOUS les ouvrages nécessaires
(pas seulement ceux explicitement cités) et produire un EstimationInput structuré.

=================================================================
CATALOGUE DES RECETTES (par corps de métier) — UTILISE UNIQUEMENT CES IDs
=================================================================
${JSON.stringify(catalog, null, 2)}

=================================================================
CHAQUE OUVRAGE EST AUTONOME
=================================================================
Sa recette inclut déjà tous ses matériaux décomposés en 5 strates :
- Préparation (hérisson, polyane, primaire, ragréage, arase…)
- Principal (béton, plaques, carreaux, peinture…)
- Accessoires (joints, croisillons, vis, cure, cales…)
- Finitions (silicone, bande, enduit, durcisseur, hydrofuge…)
- Options conditionnelles (isolant RE2020, hydrofuge, plinthes, sécurité…)

Tu n'as PAS à détailler les matériaux. Identifie le bon recipeId et la géométrie.
Le moteur expanse automatiquement.

=================================================================
RÈGLES D'EXTRACTION
=================================================================

1. SÉLECTION DE RECETTE CONTEXTUELLE (ne pas choisir "par défaut") :
   - "dalle garage" → dalle-ba-armee-st40c (charges lourdes) PAS ST25C habitation
   - "dalle maison" → dalle-ba-armee-st25c (charges courantes)
   - "mur extérieur porteur" → mur-parpaing-20 OU mur-monomur-30 OU mur-beton-cellulaire-30
   - "cloison" → cloison-placo-72-48 (standard) ou 98/48 si H>2,6m
   - "fenêtre PVC" → menuiserie-fenetre-pvc (par unité)
   - "carrelage sol" → carrelage-sol-colle-45 (standard) ou 60 (grand format)
   - "tuile" → couv-tuile-tc-emboitement OU couv-tuile-beton selon matériau

2. UNITÉS ET GÉOMÉTRIE :
   - Dimensions en MÈTRES (converti cm→m : 12 cm = 0.12 m)
   - Selon le geometryMode de la recette :
     • "volume" : length + width + thickness (ou volume direct)
     • "area" : area, ou length + width
     • "area_minus_openings" : length + height + openings (si ouvertures)
     • "length" : length (ou perimeter)
     • "count" : count entier (par unité — fenêtres, portes, WC, luminaires…)

3. CONVERSION OUVERTURES :
   - porte intérieure ≈ 1.5 m² (2,04 × 0,73)
   - porte d'entrée ≈ 2.0 m² (2,15 × 0,93)
   - fenêtre standard ≈ 1.25 m² (1,25 × 1,00)
   - baie vitrée ≈ 3.0 m² (2,15 × 1,40)

4. PROFIL CHANTIER : déduis-le SI mentionné ("petit", "difficile", "apprenti", "pistolet",
   "formes complexes"). Sinon, omets.

=================================================================
RÈGLES CRITIQUES D'ANTICIPATION (PENSE CONDUCTEUR DE TRAVAUX)
=================================================================

5. AJOUTE LES OUVRAGES COMPLÉMENTAIRES ÉVIDENTS (dans "assumptions") :
   - "mur parpaing extérieur" → sous-entendu : fondations + enduit extérieur
     → liste-les dans assumptions, le devis devrait inclure "semelle-filante-ba" ET
        "enduit-ext-monocouche" en plus du mur
   - "tuiles" → sous-entendu : CHARPENTE préalable
     → signale dans assumptions qu'il faut "charpente-traditionnelle" en amont
   - "carrelage SDB" → sous-entendu : SPEC douche, faïence mur, plomberie sanitaires
   - "PAC" → sous-entendu : circuit chauffage (radiateurs OU PCBT) + éventuellement ballon ECS

6. HYPOTHÈSES OBLIGATOIRES ("assumptions") — TOUJOURS REMPLIR :
   - Dimensions inférées (ex: "hauteur mur supposée 2,5 m")
   - Choix de recette si ambigu (ex: "choisi ST25C habitation plutôt que ST40C")
   - Contexte RE2020 / acoustique / humidité (ex: "isolant XPS sous dalle optionnel")
   - Préparation/accessoires INCLUS par recette (ne pas re-lister)
   - Ouvrages complémentaires attendus (fondations, enduit, charpente, sécurité piscine…)

7. QUESTIONS DE RELANCE ("questions") — quand infos bloquantes manquent :
   - Dimension critique introuvable (hauteur mur, nb ouvertures, surface…)
   - Choix de système ambigu (PCBT ou radiateurs ? PVC ou cuivre plomberie ?)
   - Zone climatique pour couverture (pente mini dépend)
   - Nb d'étages, accessibilité PMR, classement P/U/E du local
   - Typologie usage (résidentiel / tertiaire / industriel)

=================================================================
RÈGLES BLOQUANTES
=================================================================

8. Si un ouvrage nécessite une dimension CRITIQUE et elle est absente ET non inférable :
   → NE crée PAS l'item (sortie incomplète = faux devis)
   → À la place, pose une question précise dans "questions"
   Exemple : "dalle béton" sans surface → question : "Quelle surface pour la dalle en m² ?"

9. Si la description est trop vague pour extraire quoi que ce soit :
   → items vide
   → questions avec 3-5 relances utiles pour cadrer le projet

10. Ne JAMAIS inventer de recipeId. Tu peux UNIQUEMENT utiliser les IDs du catalogue ci-dessus.

=================================================================
EXEMPLES DE BONNES EXTRACTIONS
=================================================================

INPUT : "Je fais une dalle béton 8×5m en 12 cm pour un garage + un mur parpaing 20m sur 2,5m"
OUTPUT :
{
  "items": [
    { "recipeId": "dalle-ba-armee-st40c", "geometry": { "length": 8, "width": 5, "thickness": 0.12 }, "label": "Dalle garage" },
    { "recipeId": "mur-parpaing-20", "geometry": { "length": 20, "height": 2.5, "openings": 0 }, "label": "Mur parpaing" }
  ],
  "assumptions": [
    "Choisi ST40C (garage = charges véhicules) plutôt que ST25C habitation",
    "Aucune ouverture mentionnée pour le mur — supposé 0 m²",
    "Préparation (hérisson, polyane, joints) + accessoires + cure inclus dans les recettes",
    "Fondations du mur parpaing NON incluses — à ajouter avec recette 'semelle-filante-ba'",
    "Enduit extérieur NON inclus — à ajouter avec 'enduit-ext-monocouche' si finition prévue"
  ],
  "questions": []
}

INPUT : "je veux faire une cuisine"
OUTPUT :
{
  "items": [],
  "assumptions": ["Description trop vague pour un métré précis"],
  "questions": [
    "Quelle surface de carrelage sol ?",
    "Quelle surface de faïence mur (crédence ou pleine hauteur) ?",
    "Nombre de prises électriques supplémentaires prévues ?",
    "Nouvelle arrivée d'eau / évacuations nécessaires ou existantes ?",
    "Hotte : conduit à créer ou existant ?"
  ]
}

=================================================================
FORMAT DE RÉPONSE
=================================================================

RÉPONDS UNIQUEMENT EN JSON VALIDE, sans texte autour :

{
  "items": [{ "recipeId": "...", "geometry": { ... }, "label": "..." }],
  "chantierProfile": { "difficulty": "standard", "size": "moyen", "workforceLevel": "mixte" },
  "assumptions": ["..."],
  "questions": ["..."]
}`
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
