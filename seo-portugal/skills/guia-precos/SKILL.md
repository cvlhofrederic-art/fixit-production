---
name: guia-precos
description: Criar guias de preços detalhados para serviços de construção em Portugal. Usar quando o utilizador pede "quanto custa X", preços de serviços, ou guias de orçamento. É o formato de maior tráfego orgânico — inspirado no modelo francês.
---

# Skill — Guia de Preços Vitfix.io

## Antes de começar — verificação obrigatória

1. Lê o CLAUDE.md, context/about-platform.md e context/brand-voice.md
2. Verifica /reports/conteudo-existente.md — confirma que este guia não existe
3. Verifica se o serviço já está coberto noutro guia existente
4. Se existir → expande o existente com mais detalhe, não crias um novo

## Porquê os guias de preços são prioritários

Em França, artigos do tipo "Quanto custa X?" são os mais visitados em plataformas como Habitatpresto e Travaux.com. Em Portugal, este conteúdo quase não existe — posicionamos rapidamente com zero concorrência.

## Estrutura obrigatória do guia de preços

```
METADADOS:
---
title: Quanto Custa [Serviço] em Portugal em [Ano]?
description: Descubra os preços reais de [serviço] em Portugal em [ano]. 
Preços médios, factores que influenciam o custo e como obter 
orçamento grátis. Vitfix.io
keyword: quanto custa [serviço] Portugal
slug: quanto-custa-[servico]-portugal-[ano]
type: guia-precos
servico: [Tipo de serviço]
ano: [Ano atual]
---

ESTRUTURA DO GUIA:

# Quanto Custa [Serviço] em Portugal em [Ano]? Guia de Preços Real

[Introdução — 2 parágrafos]
- O preço é a primeira pergunta de qualquer proprietário
- Este guia apresenta preços reais praticados em Portugal em [ano]
- Foco no norte de Portugal (Porto, Tâmega e Sousa)

## Preços médios de [serviço] em Portugal

[Tabela de preços por tipo de trabalho]
| Tipo de trabalho | Preço mínimo | Preço médio | Preço máximo |
|---|---|---|---|
| [trabalho 1] | X€ | Y€ | Z€ |
| [trabalho 2] | X€ | Y€ | Z€ |

[Nota: preços incluem mão de obra. Materiais podem ser extra.]

## Preços por zona — norte de Portugal

[Comparação de preços entre zonas]
| Zona | Preço médio |
|---|---|
| Porto cidade | mais elevado |
| Gaia / Matosinhos | médio-alto |
| Marco de Canaveses / Penafiel | mais acessível |
| Interior (Amarante, Baião) | mais acessível |

[Explicar porquê existem diferenças regionais]

## O que está incluído no preço?

[Listar o que normalmente inclui]
- Mão de obra
- Deslocação (verificar se está incluída)
- Materiais (verificar se estão incluídos)
- IVA (6% para obras de conservação — explicar)

[Listar o que normalmente NÃO inclui]

## Factores que influenciam o preço

[5-7 factores com explicação breve]
1. Dimensão e complexidade da obra
2. Zona geográfica
3. Materiais escolhidos
4. Urgência da intervenção
5. Época do ano
6. Experiência e certificações do profissional

## Como poupar sem comprometer a qualidade

[3-5 dicas práticas e honestas]
- Pedir mínimo 3 orçamentos e comparar
- Usar o simulador de orçamento da Vitfix.io antes de contactar
- Evitar épocas de pico (verão para obras exteriores)
- Verificar se qualifica para IVA de 6%
- Verificar se há apoios do Estado disponíveis (ex: MaPrimeRénov equivalente PT)

## Como obter um orçamento fiável em [Cidade]

[Introdução natural à Vitfix.io]
- Usar o simulador para estimativa prévia
- Pedir orçamentos a profissionais verificados
- Comparar com o módulo de análise de orçamentos
[CTA → vitfix.io/pt/pesquisar/]

## Perguntas Frequentes sobre preços de [serviço]

[Mínimo 5 perguntas em linguagem natural]
Exemplos:
- "Qual o preço médio de [serviço] no Porto?"
- "O preço inclui materiais?"
- "Posso ter IVA reduzido de 6% nesta obra?"
- "Quanto tempo demora e afecta o preço?"
- "Como sei se o orçamento é justo?"
```

## Regras específicas dos guias de preços

- Mínimo 1500 palavras — guias de preços devem ser completos
- **Preços realistas** — não inventar, usar referências reais do mercado PT
- Sempre mencionar que os preços são estimativas e variam
- Sempre recomendar pedir vários orçamentos
- Mencionar o IVA de 6% para obras de conservação em habitação — é um diferencial importante
- Sempre comparar preços Porto vs interior norte PT
- Incluir tabela de preços — facilita a leitura e o Google destaca em rich results

## Onde guardar

```
/content/blog/quanto-custa-[servico]-portugal-[ano].md
```

## Actualizar após criação

```
/reports/conteudo-existente.md → adicionar nova linha
```

## Exemplo de uso

```
Prompt: "Cria guia de preços para pintura de casa"
Resultado: /content/blog/quanto-custa-pintura-casa-portugal-2026.md
```
