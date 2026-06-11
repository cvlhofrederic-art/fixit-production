import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    pool: 'forks',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // isolate:true (mode standard vitest) : chaque fichier de test tourne dans
    // un environnement frais (globalThis/modules réinitialisés). Indispensable
    // car plusieurs tests mutent l'état global (monkey-patch localStorage de
    // storage-sync, spies globalThis.fetch des modules syndic-v54) ; sous
    // isolate:false ces mutations fuyaient entre fichiers du même fork et
    // polluaient leurs assertions (échecs CI intermittents, order-dependent).
    isolate: true,
    testTimeout: 30000,
    coverage: {
      // lcov requis par SonarCloud (sonar.typescript.lcov.reportPaths) ;
      // périmètre aligné sur sonar.sources (app, lib, components, hooks) —
      // sinon la couverture Sonar de components/ et hooks/ est structurellement
      // nulle (audit P1, CFG-12).
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['lib/**', 'app/api/**', 'components/**', 'hooks/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
