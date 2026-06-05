import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// vitest.config a `isolate: false` (perf) et n'active pas `globals`, donc le
// cleanup automatique de React Testing Library n'est jamais enregistré : le DOM
// d'un fichier de test fuit vers le suivant dans le même worker. On démonte
// globalement après chaque test → fin de la pollution inter-fichiers qui faisait
// flaker certains tests syndic en CI (getByText « multiple elements » selon l'ordre).
afterEach(() => {
  cleanup()
})
