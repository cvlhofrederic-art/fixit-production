import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config.ts uses isolate:false so React Testing Library's auto-cleanup
// hook (registered via process.env.VITEST_AUTO_CLEANUP) doesn't always fire.
// Explicit cleanup() after every test prevents DOM leakage across tests.
afterEach(() => {
  cleanup()
})
