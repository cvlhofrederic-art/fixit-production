---
name: artigo-seo
description: Criar artigos de blog SEO optimizados para a Vitfix.io em português europeu. Usar quando o utilizador pede um artigo, guia ou conteúdo informativo para o blog da Vitfix.io.
---

# Skill — Artigo SEO Vitfix.io

## Antes de começar — verificação obrigatória

1. Lê o CLAUDE.md, context/about-platform.md e context/brand-voice.md
2. Verifica /reports/conteudo-existente.md — confirma que este tema não existe já
3. Se existir → melhora o existente, não crias um novo
4. Só avança se o tema for novo

## Estrutura obrigatória do artigo

```
METADADOS (no topo do ficheiro):
---
title: [Título H1 completo]
description: [Meta description 150-160 caracteres com keyword + CTA]
keyword: [Palavra-chave principal]
slug: [url-do-artigo-em-minusculas-com-hifens]
date: [Data de criação]
category: [Categoria: Obras / Canalização / Eletricidade / Condomínios / etc.]
---

ESTRUTURA DO ARTIGO:

# [H1 — idêntico ao title, com keyword no início]

[Introdução — 2-3 parágrafos]
- Parágrafo 1: O problema real que o leitor tem
- Parágrafo 2: Porque é relevante em Portugal / na zona específica
- Parágrafo 3: O que este artigo vai responder
- Keyword principal presente neste bloco

## [H2 — com keyword secundária]
[Conteúdo genuinamente útil — não apenas publicidade à Vitfix.io]

## [H2 — com keyword secundária]
[Continuar com informação de valor]

## [H2 — Quanto custa? / Preços médios em Portugal]
[Sempre incluir secção de preços quando relevante — gera muito tráfego]

## Como a Vitfix.io pode ajudar
[CTA integrado de forma natural — não forçado]
[Mencionar 1-2 funcionalidades relevantes da plataforma]
[Link para vitfix.io/pt/pesquisar/]

## Perguntas Frequentes
[Mínimo 5 perguntas em linguagem natural — para pesquisas por voz]
[Formato: **P:** pergunta / **R:** resposta curta e directa]
```

## Regras de escrita

- Mínimo 1200 palavras
- Português europeu — nunca português do Brasil
- "tu" para particulares, "si" em contexto mais formal
- Frases curtas — máximo 20 palavras
- Parágrafos curtos — máximo 3 linhas
- Keyword principal no H1, no primeiro parágrafo e em 2-3 H2
- Densidade de keyword: máximo 1-2%
- Sempre incluir link interno para outra página da Vitfix.io
- Sempre incluir link externo de autoridade (APEGAC, Portal da Habitação, INE)
- Tom: ver brand-voice.md — próximo, direto, respeitoso

## Onde guardar

```
/content/blog/[slug-do-artigo].md
```

## Actualizar após criação

Adicionar ao ficheiro /reports/conteudo-existente.md:
```
| /pt/blog/[slug]/ | [Título] | [Keyword] | [Data] |
```

## Exemplo de uso

```
Prompt: "Cria um artigo SEO sobre fugas de água em casa"
Resultado: artigo completo em /content/blog/fuga-agua-casa-como-resolver.md
```
