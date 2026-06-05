/**
 * Exportação das receitas PORTUGAL.
 *
 * Receitas escritas em português europeu (pt-PT) com:
 *  - referências normativas NP/LNEC datadas
 *  - fabricantes portugueses reais (Secil, Preceram, Weber PT, Robbialac, Aleluia…)
 *  - rácios adaptados ao uso corrente em Portugal
 *  - hipóteses redigidas em pt-PT (canalizador, telemóvel, obras, casa de banho)
 *
 * Isolamento estrito: esta pasta NÃO importa nada de `../fr/`.
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
import { coberturaRecipes } from './cobertura'
import { impermeabilizacaoRecipes } from './impermeabilizacao'
import { isolamentoRecipes } from './isolamento'
import { fachadaRecipes } from './fachada'
import { carpintariaRecipes } from './carpintaria'
import { serralhariaRecipes } from './serralharia'
import { pavimentosRecipes } from './pavimentos'
import { azulejoRecipes } from './azulejo'

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
  ...coberturaRecipes,
  ...impermeabilizacaoRecipes,
  ...isolamentoRecipes,
  ...fachadaRecipes,
  ...carpintariaRecipes,
  ...serralhariaRecipes,
  ...pavimentosRecipes,
  ...azulejoRecipes,
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
  coberturaRecipes,
  impermeabilizacaoRecipes,
  isolamentoRecipes,
  fachadaRecipes,
  carpintariaRecipes,
  serralhariaRecipes,
  pavimentosRecipes,
  azulejoRecipes,
}
