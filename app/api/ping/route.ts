import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { status: 'ok', ts: Date.now() },
    { headers: { 'cache-control': 'no-store' } },
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'cache-control': 'no-store' } })
}
