import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Langfuse instrumentation (anti-régression)', () => {
  const ROOT = process.cwd()
  it.each([
    'app/api/syndic/fixy-syndic/route.ts',
    'app/api/syndic/max-ai/route.ts',
    'app/api/syndic/lea-comptable/route.ts',
    'app/api/syndic/alfredo-chat/route.ts',
  ])('%s importe et utilise traceAgent', (path) => {
    const src = readFileSync(join(ROOT, path), 'utf-8')
    expect(src).toMatch(/from\s+['"]@\/lib\/langfuse['"]/)
    expect(src).toMatch(/traceAgent/)
  })
})
