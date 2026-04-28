import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { resolveExperimentArm, computeBucket, BUCKET_COOKIE, OVERRIDE_COOKIE } from '@/app/api/simulateur-travaux/feature-flag'

function makeReq(cookies: Record<string, string> = {}) {
  const headers = new Headers()
  const cookieStr = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ')
  if (cookieStr) headers.set('cookie', cookieStr)
  return new NextRequest('https://vitfix.io/api/simulateur-travaux', { method: 'POST', headers })
}

describe('computeBucket', () => {
  it('hash stable pour même seed', () => {
    expect(computeBucket('user-abc')).toBe(computeBucket('user-abc'))
  })

  it('hash diffère pour seeds différents', () => {
    expect(computeBucket('user-abc')).not.toBe(computeBucket('user-xyz'))
  })

  it('renvoie int 0..99', () => {
    for (const seed of ['a', 'b', 'c', 'long-user-id-12345']) {
      const b = computeBucket(seed)
      const n = parseInt(b, 16) % 100
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(100)
    }
  })
})

describe('resolveExperimentArm — overrides & kill-switch', () => {
  const ORIG_ENV = { ...process.env }
  beforeEach(() => {
    process.env.SIMULATEUR_V2_ROLLOUT = '0'
    process.env.SIMULATEUR_V2_FORCE_V1 = 'false'
  })
  afterEach(() => {
    process.env = { ...ORIG_ENV }
  })

  it('kill-switch SIMULATEUR_V2_FORCE_V1=true force v1', () => {
    process.env.SIMULATEUR_V2_FORCE_V1 = 'true'
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
    const req = makeReq()
    expect(resolveExperimentArm(req, 'user-1').arm).toBe('v1')
  })

  it('admin override on → v2 même si rollout=0', () => {
    const req = makeReq({ [OVERRIDE_COOKIE]: 'on' })
    expect(resolveExperimentArm(req, 'user-1').arm).toBe('v2')
  })

  it('admin override off → v1 même si rollout=100', () => {
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
    const req = makeReq({ [OVERRIDE_COOKIE]: 'off' })
    expect(resolveExperimentArm(req, 'user-1').arm).toBe('v1')
  })

  it('rollout=0 → v1', () => {
    expect(resolveExperimentArm(makeReq(), 'user-1').arm).toBe('v1')
  })

  it('rollout=100 → v2', () => {
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
    expect(resolveExperimentArm(makeReq(), 'user-1').arm).toBe('v2')
  })
})

describe('resolveExperimentArm — bucketing stable', () => {
  beforeEach(() => {
    process.env.SIMULATEUR_V2_ROLLOUT = '50'
    process.env.SIMULATEUR_V2_FORCE_V1 = 'false'
  })

  it('même userId → même arm sur 100 appels', () => {
    const userId = 'stable-user-42'
    const arms = new Set<string>()
    for (let i = 0; i < 100; i++) {
      arms.add(resolveExperimentArm(makeReq(), userId).arm)
    }
    expect(arms.size).toBe(1)
  })

  it('rollout=25 → ~250/1000 en v2 (tolérance ±50)', () => {
    process.env.SIMULATEUR_V2_ROLLOUT = '25'
    let v2Count = 0
    for (let i = 0; i < 1000; i++) {
      if (resolveExperimentArm(makeReq(), `user-${i}`).arm === 'v2') v2Count++
    }
    expect(v2Count).toBeGreaterThan(200)
    expect(v2Count).toBeLessThan(300)
  })

  it('cookie sticky utilisé si présent (priorité sur userId)', () => {
    process.env.SIMULATEUR_V2_ROLLOUT = '50'
    // Bucket déterministe : on choisit un hash dont parseInt(_, 16) % 100 < 50
    const stickyBucket = '00000000'  // → 0 % 100 = 0 < 50 → v2
    const req = makeReq({ [BUCKET_COOKIE]: stickyBucket })
    expect(resolveExperimentArm(req, 'any-user').arm).toBe('v2')
  })

  it('renvoie setCookie quand bucket régénéré', () => {
    const r = resolveExperimentArm(makeReq(), 'fresh-user')
    expect(r.setBucketCookie).toBeTruthy()
    expect(r.setBucketCookie?.value).toMatch(/^[0-9a-f]+$/)
  })

  it('userId manquant → fallback IP', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.42' })
    const req = new NextRequest('https://vitfix.io/api/simulateur-travaux', { method: 'POST', headers })
    const r1 = resolveExperimentArm(req, undefined)
    const r2 = resolveExperimentArm(req, undefined)
    expect(r1.arm).toBe(r2.arm)  // déterministe sur IP
  })
})
