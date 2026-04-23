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
  const countryNote = scope?.country === 'PT'
    ? `\n⚠️ PAYS : PORTUGAL. Réponds en PORTUGAIS EUROPÉEN. Utilise les normes NP (Normas Portuguesas) et LNEC au lieu de DTU/NF. Les "assumptions" et "questions" DOIVENT être en portugais.\n`
    : ''
  return `Tu es un CONDUCTEUR DE TRAVAUX EXPÉRIMENTÉ — tu ANALYSES, tu PROPOSES, tu QUESTIONNES.${scopeNote}${countryNote}
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
DÈS QUE tu rencontres une ambiguïté qui CHANGE un choix de recette, d'épaisseur,
de format, ou de matériau : tu POSES UNE QUESTION dans "questions".
Tu ne devines PAS au hasard. Tu proposes une valeur par défaut DANS assumptions
ET tu demandes confirmation DANS questions.

MINIMUM 1 QUESTION par ouvrage si l'utilisateur n'a pas précisé TOUS les
paramètres critiques. Objectif : affiner progressivement en 2-3 échanges.

CHECKLIST DES AMBIGUÏTÉS À QUESTIONNER (par corps de métier) :

MAÇONNERIE / BÉTON :
  - "Dalle : habitation, garage, terrasse, ou atelier pro ?" (change ST25C/ST40C/ST60C + épaisseur)
  - "Neuf sous RE2020 ou rénovation ?" (change isolant sous dalle obligatoire)
  - "Sol : dur rocheux, argileux, sableux, ou remblai ?" (change hérisson/géotextile)
  - "Mur : intérieur porteur, extérieur porteur, ou refend non-porteur ?"
  - "Exposé vent (zone côtière H3) ou abrité ?" (renforts chaînages)

PLACO / CLOISONS :
  - "Hauteur sous plafond exacte ? (>2,60 m = 98/48 obligatoire)"
  - "Zone humide (SDB, cuisine) → plaque hydrofuge ?"
  - "Contrainte acoustique spéciale (mitoyenneté, studio, hôtel) ?"

CARRELAGE :
  - "Format souhaité : 30×30 / 45×45 / 60×60 / grand format 80×80 ?" (change colle)
  - "Classement P/U/E du local ? (ex: résidentiel P3 / commerce P4+)"
  - "Sol ou mur ? (change peigne et collage)"
  - "Intérieur ou extérieur (gel) ? (change C2S1 vs C2T)"

PEINTURE :
  - "Neuf Placo ou rénovation sur support peint ?" (sous-couche ou pas)
  - "Finition : mate, velours, satinée, brillante ?"
  - "Classe DTU 59.1 : A (soigné) / B (courant) / C (ordinaire) ?"
  - "Humidité locale (SDB, cuisine) → peinture spéciale anti-condensation ?"

COUVERTURE :
  - "Zone climatique (H1 froid, H2 tempéré, H3 sud) ?" (change pente mini DTU 40.2x)
  - "Pente du toit (en %/° ou cm/m) ?"
  - "Matériau souhaité : tuile TC, tuile béton, ardoise naturelle, zinc, bac acier ?"
  - "Charpente existante adaptée au poids ? (tuile béton > TC > ardoise)"

MENUISERIES EXT :
  - "Matériau : PVC, alu, bois, mixte ?" (coût ×2-3)
  - "Norme thermique visée : Uw ≤ 1,4 standard ou ≤ 1,1 Passivhaus ?"
  - "Dormants à changer ou conserver ? (pose en rénovation ou dépose totale)"

PLOMBERIE :
  - "Logement neuf (distribution étoile PER) ou rénovation (cuivre/multicouche) ?"
  - "Nombre de points d'eau par type : évier, lavabo, WC, douche, baignoire ?"
  - "Évacuation gravitaire ou pompe de relevage ?"
  - "Production ECS : ballon électrique, thermodynamique, solaire, PAC, gaz ?"

CHAUFFAGE :
  - "Isolation du logement : passoire, moyenne, RT2012, RE2020 ?" (dimensionne kW)
  - "Source énergie préférée : élec, gaz, bois granulés, PAC air/eau, hybride ?"
  - "Émetteurs : radiateurs (chaleur rapide) ou plancher chauffant (inertie) ?"
  - "Obligation RE2020 / prime MaPrimeRénov' à capturer ?"

ÉLECTRICITÉ :
  - "T1/T2/T3/T4/T5 ? (dimensionne nb circuits + disjoncteurs)"
  - "Fourniture neuve avec Consuel ou rénovation partielle ?"
  - "IRVE (borne VE) prévue ? (change tableau + ajout circuit dédié)"
  - "Domotique / smart home prévue ?"

VENTILATION / CLIM :
  - "VMC simple flux hygro B (habitation standard) ou double flux (RE2020) ?"
  - "Clim mono-split (1 pièce) ou multi-split/gainable (plusieurs pièces) ?"

ISOLATION :
  - "Combles perdus (soufflage) ou combles aménageables (sous rampant) ?"
  - "ITI (intérieur, perd m² habitable) ou ITE (extérieur, meilleur mais + cher) ?"
  - "R visé ? (RE2020 = R≥6 combles, R≥4,4 murs)"

PISCINE :
  - "Coque polyester (rapide pose, limité 9×4 max), béton banché (sur mesure), ou bois kit ?"
  - "Accessible aux enfants < 5 ans ? (dispositif sécurité obligatoire L.128-1)"
  - "Traitement : chlore, brome, sel (électrolyseur), UV ?"

RÈGLE FORMELLE : chaque item de la réponse doit au moins avoir 1 hypothèse calibrée
ET (si le user n'a pas tout précisé) 1 question de relance concrète qui affine
la prochaine proposition. Mieux vaut 3 questions pertinentes que 1 devinette hasardeuse.

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

=================================================================
⚠️ RÈGLE FORMAT GEOMETRY (CRITIQUE)
=================================================================
Dans "geometry", N'INCLUS QUE les champs dont tu CONNAIS la valeur.
- Si tu ne connais PAS length/width (user a donné uniquement "surface"):
  OMETS length ET width du JSON. NE METS PAS length:0 ni width:0.
- Idem pour thickness, height, count, etc.
- Tout champ numérique DOIT être STRICTEMENT POSITIF (>0) ou ABSENT.
- Exemple CORRECT :  "geometry": { "area": 50, "thickness": 0.20 }
- Exemple INVALIDE : "geometry": { "length": 0, "width": 0, "area": 50, "thickness": 0.20 }
  (Le 0 fait crasher la validation, donne une erreur à l'utilisateur.)

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
      // 4000 tokens couvre sans troncation un chantier jusqu'à ~15 ouvrages
      // (chaque ouvrage ~200 tokens JSON + assumptions/questions). Au-delà,
      // la détection `finish_reason === 'length'` ci-dessous alerte l'artisan.
      max_tokens: 4000,
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

  const isPt = scope?.country === 'PT'

  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error(isPt ? 'Groq não devolveu conteúdo' : "Groq n'a pas renvoyé de contenu")

  const finishReason = response.choices?.[0]?.finish_reason
  const wasTruncated = finishReason === 'length'

  const raw = typeof content === 'string' ? content : String(content)
  // Nettoie d'éventuels blocs markdown que Llama pourrait retourner malgré json mode
  const clean = raw.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(isPt ? `JSON inválido da IA: ${clean.slice(0, 200)}` : `JSON invalide de l'IA : ${clean.slice(0, 200)}`)
  }

  // ════════════════════════════════════════════════════════════
  //  NORMALISATION PRÉ-ZOD — tolérance aux sorties LLM imparfaites
  // ════════════════════════════════════════════════════════════
  // Llama 3.3 peut retourner : champs numériques à 0 au lieu d'omettre, strings
  // au lieu de numbers ("50"), geometry null, items absents, etc.
  // On normalise AVANT la validation stricte Zod pour que l'UX marche à 100 %.
  const NUMERIC_GEO_KEYS = [
    'length', 'width', 'height', 'thickness',
    'area', 'volume', 'perimeter',
    'count', 'coats', 'openings',
  ]

  function toNumberOrUndef(v: unknown): number | undefined {
    if (typeof v === 'number') {
      return Number.isFinite(v) && v > 0 ? v : undefined
    }
    if (typeof v === 'string') {
      // Accepte "50", "50.5", "50,5" (virgule FR), " 50 " (espaces)
      const cleaned = v.trim().replace(',', '.').replace(/\s/g, '')
      if (cleaned === '') return undefined
      const n = Number(cleaned)
      return Number.isFinite(n) && n > 0 ? n : undefined
    }
    return undefined
  }

  function normalizeGeometry(geo: unknown): Record<string, number> {
    if (!geo || typeof geo !== 'object') return {}
    const out: Record<string, number> = {}
    const g = geo as Record<string, unknown>
    for (const k of NUMERIC_GEO_KEYS) {
      const n = toNumberOrUndef(g[k])
      if (n !== undefined) out[k] = n
    }
    return out
  }

  // Normalisation items : geometry toujours objet propre, label string
  if (parsed && typeof parsed === 'object') {
    const p = parsed as Record<string, unknown>
    // items doit être un array
    if (!Array.isArray(p.items)) p.items = []
    // Normalise chaque item
    p.items = (p.items as unknown[]).map(item => {
      if (!item || typeof item !== 'object') return null
      const it = item as Record<string, unknown>
      return {
        recipeId: typeof it.recipeId === 'string' ? it.recipeId : '',
        geometry: normalizeGeometry(it.geometry),
        label: typeof it.label === 'string' ? it.label : undefined,
      }
    }).filter((x: unknown) => x !== null && (x as { recipeId: string }).recipeId !== '')
    // Assumptions / questions : arrays de strings
    if (!Array.isArray(p.assumptions)) p.assumptions = []
    if (!Array.isArray(p.questions)) p.questions = []
    p.assumptions = (p.assumptions as unknown[]).filter((x): x is string => typeof x === 'string')
    p.questions = (p.questions as unknown[]).filter((x): x is string => typeof x === 'string')
    // chantierProfile : objet ou absent (Zod gère l'optionnel)
    if (p.chantierProfile !== undefined && (!p.chantierProfile || typeof p.chantierProfile !== 'object')) {
      delete p.chantierProfile
    }
  }

  let result: ExtractionResult
  try {
    result = ExtractionResultSchema.parse(parsed)
  } catch (zodErr) {
    // En cas d'échec de validation (cas rare après normalisation), on renvoie
    // une extraction vide avec message d'erreur explicite — pas un crash.
    const msg = zodErr instanceof Error ? zodErr.message.slice(0, 300) : String(zodErr).slice(0, 300)
    return {
      items: [],
      assumptions: isPt
        ? [
            `A IA devolveu uma resposta malformada (detalhe: ${msg}).`,
            'Tente novamente com uma descrição mais precisa (superfície, espessura, material).',
          ]
        : [
            `L'IA a retourné une réponse malformée (détail : ${msg}).`,
            'Réessayez avec une description plus précise (surface, épaisseur, matériau).',
          ],
      questions: isPt
        ? [
            'Pode precisar o tipo de obra (laje, parede, divisória, azulejo, pintura…)?',
            'Qual a superfície ou comprimento linear em metros?',
            'Qual a espessura / altura, se relevante?',
          ]
        : [
            'Pouvez-vous préciser le type d\'ouvrage (dalle, mur, cloison, carrelage, peinture…) ?',
            'Quelle surface ou linéaire en mètres ?',
            'Quelle épaisseur / hauteur si pertinente ?',
          ],
    }
  }

  if (wasTruncated) {
    result.assumptions.push(
      isPt
        ? '⚠️ Resposta da IA truncada (max_tokens atingido) — algumas obras podem estar em falta. Relance dividindo a obra em 2-3 descrições mais curtas.'
        : "⚠️ Réponse IA tronquée (max_tokens atteint) — certains ouvrages peuvent manquer. Relancez en décomposant le chantier en 2-3 descriptions plus courtes."
    )
  }

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
    const reason = isPt
      ? (scope?.trades && scope.trades.length > 0
          ? `fora do âmbito de especialidades autorizado (${scope.trades.join(', ')})`
          : 'desconhecidas')
      : (scope?.trades && scope.trades.length > 0
          ? `hors périmètre métier autorisé (${scope.trades.join(', ')})`
          : 'inconnues')
    result.assumptions.push(isPt
      ? `Receitas ${reason} ignoradas: ${unknownIds.join(', ')}`
      : `Recettes ${reason} ignorées : ${unknownIds.join(', ')}`)
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
        isPt
          ? `Qual a espessura (em cm) para "${recipe.name}"? Sem este valor, o cálculo dos materiais ligados ao volume (betão, cimento, água, brita, areia) é impossível.`
          : `Quelle épaisseur (en cm) pour "${recipe.name}" ? Sans cette valeur, le calcul des matériaux liés au volume (béton, ciment, eau, gravier, sable) est impossible.`
      )
    }
    if (needsHeight && item.geometry.height === undefined && !item.geometry.length) {
      result.questions.push(
        isPt
          ? `Qual a altura para "${recipe.name}"?`
          : `Quelle hauteur pour "${recipe.name}" ?`
      )
    }
    if (needsPerimeter && item.geometry.perimeter === undefined
        && !(item.geometry.length && item.geometry.width)) {
      result.assumptions.push(
        isPt
          ? `"${recipe.name}": perímetro não calculável — alguns acessórios (juntas, fitas, cintas periféricas) sairão a 0.`
          : `"${recipe.name}" : périmètre non calculable — certains accessoires (joints, bandes, chaînages périphériques) sortiront à 0.`
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
