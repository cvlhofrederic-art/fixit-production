// app/api/simulateur-travaux/tools.ts
//
// Schémas tool-calling format OpenAI/Groq compatible + dispatcher serveur.
// Validation Zod sur les args pour rejeter les hallucinations d'arguments.

import { z } from 'zod'
import { lookupVariants } from '@/lib/prix-travaux-2026/lookup'
import { computeQuote } from '@/lib/prix-travaux-2026/compute'

export type ToolSchema = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'lookupVariants',
      description: "Recherche les variantes de prix pertinentes dans le catalogue 2026. À appeler en premier dès qu'on a une description de travaux.",
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Description en langage naturel des travaux' },
          metierHint: {
            type: 'string',
            enum: ['plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage', 'maconnerie', 'couverture', 'menuiserie', 'chauffage', 'paysagisme'],
          },
          surface: { type: 'number', description: 'Surface en m² si pertinent' },
          keywords: { type: 'array', items: { type: 'string' } },
          region: { type: 'string', description: 'Code département INSEE OU code zone (passe-le si tu le connais déjà, pour préparer le mode out-of-catalog)' },
          postalCode: { type: 'string', description: 'Code postal client si connu' },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computeQuote',
      description: "Calcule un devis déterministe à partir d'items et paramètres. Items vides → mode out-of-catalog. Appeler après lookupVariants.",
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                qty: { type: 'number' },
              },
              required: ['taskId', 'qty'],
            },
          },
          region: { type: 'string', description: 'Code département INSEE OU code zone' },
          postalCode: { type: 'string' },
          gamme: { type: 'string', enum: ['economique', 'standard', 'premium'] },
          etat: { type: 'string', enum: ['bon', 'use', 'tres-degrade'] },
          aidesContext: {
            type: 'object',
            properties: {
              foyerTaille: { type: 'number' },
              revenusFiscaux: { type: 'number' },
              typeLogement: { type: 'string', enum: ['principal', 'locatif'] },
              ageLogement: { type: 'number' },
            },
          },
        },
        required: ['items', 'gamme', 'etat'],
      },
    },
  },
]

const lookupArgsSchema = z.object({
  description: z.string().min(1),
  metierHint: z.enum(['plomberie', 'electricite', 'peinture', 'plaquiste', 'carrelage', 'maconnerie', 'couverture', 'menuiserie', 'chauffage', 'paysagisme']).optional(),
  surface: z.number().positive().optional(),
  keywords: z.array(z.string()).optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
})

const computeArgsSchema = z.object({
  items: z.array(z.object({ taskId: z.string(), qty: z.number().positive() })),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  gamme: z.enum(['economique', 'standard', 'premium']),
  etat: z.enum(['bon', 'use', 'tres-degrade']),
  aidesContext: z.object({
    foyerTaille: z.number().int().positive().optional(),
    revenusFiscaux: z.number().nonnegative().optional(),
    typeLogement: z.enum(['principal', 'locatif']).optional(),
    ageLogement: z.number().nonnegative().optional(),
  }).optional(),
})

export type ToolExecutionResult = {
  result?: unknown
  error?: string
}

export function executeTool(name: string, rawArgs: unknown): ToolExecutionResult {
  if (name === 'lookupVariants') {
    const parsed = lookupArgsSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return { error: `invalid_args(lookupVariants): ${parsed.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; ')}` }
    }
    return { result: lookupVariants(parsed.data) }
  }
  if (name === 'computeQuote') {
    const parsed = computeArgsSchema.safeParse(rawArgs)
    if (!parsed.success) {
      return { error: `invalid_args(computeQuote): ${parsed.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; ')}` }
    }
    try {
      return { result: computeQuote(parsed.data) }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: msg }
    }
  }
  return { error: `unknown_tool: ${name}` }
}
