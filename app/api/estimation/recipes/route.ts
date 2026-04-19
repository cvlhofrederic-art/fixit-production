import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { allRecipes, getRecipesByTrade } from '@/lib/estimation-materiaux'
import type { Recipe } from '@/lib/estimation-materiaux'

export const runtime = 'nodejs'

/**
 * GET /api/estimation/recipes?trade=maconnerie
 * Retourne la liste des recettes disponibles (catalogue).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`estim_recipes_${ip}`, 60, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const trade = searchParams.get('trade') as Recipe['trade'] | null

  const recipes = trade ? getRecipesByTrade(trade) : allRecipes
  const response = NextResponse.json({ recipes })
  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  return response
}
