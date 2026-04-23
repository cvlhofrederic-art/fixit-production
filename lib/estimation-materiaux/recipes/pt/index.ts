/**
 * Barrel d'exports des recettes PORTUGAL.
 *
 * Ces recettes sont écrites à la main en portugais européen (pt-PT) avec :
 *  - références normatives NP/LNEC datées
 *  - fabricants portugais réels (Secil, Preceram, Weber PT, Robbialac, Aleluia…)
 *  - ratios adaptés usages courants Portugal
 *  - hypothèses rédigées en pt-PT strict (canalizador, telemóvel, obras, casa de banho)
 *
 * Isolation stricte : ce dossier n'importe RIEN de `../fr/`.
 * Test d'isolation : `tests/estimation-materiaux-isolation.test.ts`.
 */

import type { Recipe } from '../../types'

import { alvenariaRecipes } from './alvenaria'
import { pladurRecipes } from './pladur'
import { pinturaRecipes } from './pintura'
import { revestimentoRecipes } from './revestimento'
import { extrasPtRecipes } from './extras'
import { saneamentoRecipes } from './saneamento'
import { jardimRecipes } from './jardim'
import { piscinaRecipes } from './piscina'
import { vedacoesRecipes } from './vedacoes'
import { terracoRecipes } from './terraco'
import { eletricidadeRecipes } from './eletricidade'
import { canalizacaoRecipes } from './canalizacao'
import { climatizacaoRecipes } from './climatizacao'

export const allPtRecipes: Recipe[] = [
  ...alvenariaRecipes,
  ...pladurRecipes,
  ...pinturaRecipes,
  ...revestimentoRecipes,
  ...extrasPtRecipes,
  ...saneamentoRecipes,
  ...jardimRecipes,
  ...piscinaRecipes,
  ...vedacoesRecipes,
  ...terracoRecipes,
  ...eletricidadeRecipes,
  ...canalizacaoRecipes,
  ...climatizacaoRecipes,
]

export {
  alvenariaRecipes,
  pladurRecipes,
  pinturaRecipes,
  revestimentoRecipes,
  extrasPtRecipes,
  saneamentoRecipes,
  jardimRecipes,
  piscinaRecipes,
  vedacoesRecipes,
  terracoRecipes,
  eletricidadeRecipes,
  canalizacaoRecipes,
  climatizacaoRecipes,
}
