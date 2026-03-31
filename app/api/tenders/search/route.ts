import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { searchTenders } from '@/lib/tenders/search'
import { scoreTender } from '@/lib/tenders/scorer'
import type { SearchParams } from '@/lib/tenders/types'

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`tenders_search_${ip}`, 30, 60_000))) return rateLimitResponse()

  const url = new URL(request.url)
  const params: SearchParams = {
    city: url.searchParams.get('city') || undefined,
    trade: url.searchParams.get('trade') || undefined,
    keyword: url.searchParams.get('keyword') || undefined,
    max_days_old: url.searchParams.get('max_days_old') ? parseInt(url.searchParams.get('max_days_old')!) : 30,
    min_budget: url.searchParams.get('min_budget') ? parseInt(url.searchParams.get('min_budget')!) : undefined,
    max_budget: url.searchParams.get('max_budget') ? parseInt(url.searchParams.get('max_budget')!) : undefined,
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
    offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
  }

  try {
    const { tenders, total } = await searchTenders(params)

    // Score tenders if artisan context provided
    const artisanCity = url.searchParams.get('artisan_city') || undefined
    const artisanTrades = url.searchParams.get('artisan_trades')?.split(',').filter(Boolean) || undefined

    const scored = tenders.map(t => ({
      ...t,
      score: scoreTender(t, { artisan_city: artisanCity, artisan_trades: artisanTrades, artisan_dept: '13' }),
    }))

    // Sort by score desc
    scored.sort((a, b) => b.score.score - a.score.score)

    const response = NextResponse.json({ tenders: scored, total })
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
