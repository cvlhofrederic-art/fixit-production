/**
 * En-têtes que Next et OpenNext posent d'eux-mêmes, hors headers() de next.config.ts : « x-powered-by: Next.js »
 * (pages HTML, next/dist/server/send-payload.js) et « x-opennext: 1 » (@opennextjs/aws core/routing/util.js) dépendent
 * tous deux de poweredByHeader. On vérifie la configuration réellement exportée, après withSentryConfig.
 */
import { describe, expect, it } from 'vitest'
import configurationNext from '@/next.config'

describe('next.config.ts : en-têtes du framework', () => {
  it('désactive poweredByHeader, y compris après withSentryConfig', () => {
    expect(configurationNext.poweredByHeader).toBe(false)
  })
})
