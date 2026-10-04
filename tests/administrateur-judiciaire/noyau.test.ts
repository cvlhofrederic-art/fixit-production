import './fuseau-paris'
import { describe } from 'vitest'
import * as dates from '@/lib/administrateur-judiciaire/domain/dates'
import * as format from '@/lib/administrateur-judiciaire/domain/format'
import * as texte from '@/lib/administrateur-judiciaire/domain/texte'
import { rejouerOracle, type CasOracle } from './oracle'
import fixture from './fixtures/noyau.json'

const cas = fixture as CasOracle[]
const modules: Record<string, unknown> = { ...dates, ...format, ...texte }

describe('noyau (dates, formats, texte) — conformité à la maquette d’origine', () => {
  rejouerOracle(modules, cas)
})
