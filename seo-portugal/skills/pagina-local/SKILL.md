---
name: pagina-local
description: Criar páginas de serviço por localização para a Vitfix.io. Usar quando o utilizador pede uma página para uma cidade ou concelho específico — ex: "empreiteiro em Marco de Canaveses", "canalizador em Penafiel".
---

# Skill — Página Local Vitfix.io

## Antes de começar — verificação obrigatória

1. Lê o CLAUDE.md, context/about-platform.md e context/brand-voice.md
2. Consulta a secção "Zona Geográfica de Arranque" no CLAUDE.md
3. Verifica /reports/conteudo-existente.md — confirma que esta página cidade+serviço não existe
4. Se existir → melhora a existente, não crias uma nova
5. Respeita a ordem de prioridade: Tâmega e Sousa primeiro, depois AMP núcleo, depois AMP periférica

## Estrutura obrigatória da página local

```
METADADOS:
---
title: [Serviço] em [Cidade] | Vitfix.io
description: Encontre [profissional] verificado em [Cidade]. 
Seguro em dia, avaliações reais. Orçamento grátis em 2 cliques. 
Vitfix.io
keyword: [profissional] [cidade]
slug: [profissional]-[cidade-em-minusculas]
type: pagina-local
cidade: [Nome da Cidade]
servico: [Tipo de serviço]
---

ESTRUTURA DA PÁGINA:

# Encontre um [Profissional] de Confiança em [Cidade]

[Parágrafo introdutório — 2-3 frases]
- Mencionar a cidade pelo nome
- Mencionar o problema/necessidade típica da zona
- Mencionar que os profissionais são verificados

## Profissionais verificados em [Cidade] e arredores
[Descrever o que significa verificado na Vitfix.io]
[Wallet de conformidade — seguro, registo, avaliações]
[2-3 parágrafos]

## Como funciona em [Cidade]
[3 passos simples com ícone ou número]
1. Descreves o que precisas
2. Recebes propostas de profissionais locais verificados  
3. Escolhes e agenda em 2 cliques

## Quanto custa [serviço] em [Cidade]?
[Preços médios realistas para a zona]
[Factores que influenciam o preço]
[Mencionar o simulador de orçamento da Vitfix.io]

## Zonas cobertas perto de [Cidade]
[Listar 4-6 concelhos/zonas adjacentes]
[Ajuda o SEO local e cria ligações internas]

## Porque escolher a Vitfix.io em [Cidade]
[3-4 pontos diferenciadores — verificação, rapidez, estimativa]
[CTA: Pedir Orçamento Grátis → vitfix.io/pt/pesquisar/]

## Perguntas Frequentes sobre [serviço] em [Cidade]
[Mínimo 4 perguntas específicas à cidade]
Exemplos:
- "Há [profissional] disponível ao fim de semana em [Cidade]?"
- "Quanto tempo demora uma intervenção em [Cidade]?"
- "Os profissionais da Vitfix.io têm seguro em [Cidade]?"
- "Como posso pedir urgência em [Cidade]?"
```

## Contexto local — usar sempre

Consultar a secção "Contexto local" no CLAUDE.md para adaptar o tom:

- **Tâmega e Sousa** (Marco, Penafiel, Amarante, Paredes...): zona semi-rural, cultura de boca-a-boca, profissionais sem presença online, moradias antigas
- **Porto / AMP núcleo** (Porto, Gaia, Rio Tinto, Gondomar...): apartamentos, condomínios, reabilitação urbana, urgências frequentes
- **AMP periférica** (Espinho, Trofa, Santo Tirso...): misto, pouca concorrência digital

## Schema markup a incluir

```json
{
  "@type": "LocalBusiness",
  "name": "Vitfix.io — [Serviço] em [Cidade]",
  "description": "Plataforma de profissionais verificados em [Cidade]",
  "areaServed": "[Cidade] e arredores",
  "url": "https://vitfix.io/pt/[slug]/",
  "@type": "FAQPage"
}
```

## Regras

- Mínimo 800 palavras
- Português europeu — nunca português do Brasil
- Mencionar a cidade pelo menos 5-8 vezes de forma natural
- Nunca copiar de uma página de outra cidade e substituir apenas o nome
- Sempre personalizar com contexto real da zona (ver CLAUDE.md)
- CTA principal sempre para vitfix.io/pt/pesquisar/

## Onde guardar

```
/content/local/[profissional]-[cidade].md
```

## Actualizar após criação

```
/reports/conteudo-existente.md → adicionar nova linha
```

## Exemplo de uso

```
Prompt: "Cria página local para canalizador em Marco de Canaveses"
Resultado: /content/local/canalizador-marco-de-canaveses.md
```
