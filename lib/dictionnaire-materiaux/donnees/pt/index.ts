// Dictionnaire matériaux — PT — assemblage.
// Écrit par scripts/dictionnaire-materiaux/generer-donnees.mjs à partir du catalogue relu. Données en JSON, une
// famille ou un domaine par fichier : types de produits génériques, ni marque, ni prix, ni quantité. Preuves en
// magasin : preuves.json. Forme et contenu contrôlés par tests/dictionnaire-materiaux/donnees.test.ts.

import { enseignesDuPays } from '../../enseignes'
import type { Dictionnaire, DomaineSituations, FamilleMateriaux, Materiau, Situation } from '../../types'
import siliconesMastiques from './familles/silicones-mastiques.json'
import espatulasTalochas from './familles/espatulas-talochas.json'
import ferramentasPintura from './familles/ferramentas-pintura.json'
import cimentosArgamassas from './familles/cimentos-argamassas.json'
import massasReparacao from './familles/massas-reparacao.json'
import impermeabilizacao from './familles/impermeabilizacao.json'
import primariosTratamentos from './familles/primarios-tratamentos.json'
import tintasVernizes from './familles/tintas-vernizes.json'
import abrasivosLimpeza from './familles/abrasivos-limpeza.json'
import ceramicaColasJuntas from './familles/ceramica-colas-juntas.json'
import pavimentosAcessorios from './familles/pavimentos-acessorios.json'
import canalizacao from './familles/canalizacao.json'
import eletricidade from './familles/eletricidade.json'
import fixacoes from './familles/fixacoes.json'
import pladurIsolamento from './familles/pladur-isolamento.json'
import coberturasCaleiras from './familles/coberturas-caleiras.json'
import colasAdesivos from './familles/colas-adesivos.json'
import protecaoEpi from './familles/protecao-epi.json'
import ferramentasGerais from './familles/ferramentas-gerais.json'
import situationsFachadas from './situations/fachadas.json'
import situationsCoberturas from './situations/coberturas.json'
import situationsHumidadeInterior from './situations/humidade-interior.json'
import situationsCasasDeBanhoCozinhas from './situations/casas-de-banho-cozinhas.json'
import situationsCanalizacao from './situations/canalizacao.json'
import situationsParedesTetos from './situations/paredes-tetos.json'
import situationsPavimentos from './situations/pavimentos.json'
import situationsJanelasPortas from './situations/janelas-portas.json'
import situationsAlvenaria from './situations/alvenaria.json'
import situationsMadeiraMetal from './situations/madeira-metal.json'
import situationsEletricidade from './situations/eletricidade.json'
import situationsPladurIsolamento from './situations/pladur-isolamento.json'

interface FichierFamille { famille: FamilleMateriaux; materiaux: Materiau[] }
interface FichierDomaine { domaine: DomaineSituations; situations: Situation[] }

// TypeScript type le JSON au plus large (une enseigne y est une chaîne quelconque) : la forme exacte est vérifiée
// par les tests des données.
const FAMILLES = [siliconesMastiques, espatulasTalochas, ferramentasPintura, cimentosArgamassas, massasReparacao, impermeabilizacao, primariosTratamentos, tintasVernizes, abrasivosLimpeza, ceramicaColasJuntas, pavimentosAcessorios, canalizacao, eletricidade, fixacoes, pladurIsolamento, coberturasCaleiras, colasAdesivos, protecaoEpi, ferramentasGerais] as unknown as FichierFamille[]
const DOMAINES = [situationsFachadas, situationsCoberturas, situationsHumidadeInterior, situationsCasasDeBanhoCozinhas, situationsCanalizacao, situationsParedesTetos, situationsPavimentos, situationsJanelasPortas, situationsAlvenaria, situationsMadeiraMetal, situationsEletricidade, situationsPladurIsolamento] as unknown as FichierDomaine[]

export const DICTIONNAIRE_PT: Dictionnaire = {
  pays: 'PT',
  langue: 'pt',
  verifieLe: '2026-11-15',
  enseignes: enseignesDuPays('PT'),
  familles: FAMILLES.map((f) => f.famille),
  materiaux: FAMILLES.flatMap((f) => f.materiaux),
  domaines: DOMAINES.map((d) => d.domaine),
  situations: DOMAINES.flatMap((d) => d.situations),
}
