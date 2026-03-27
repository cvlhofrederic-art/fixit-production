# Resumo do scraping — Portugal — 2026-03-18

## Source

**Habitissimo.pt** — única fonte viável nesta sessão.

Sources tentadas:
- ❌ **Páginas Amarelas** — erro SSL / bloqueio de privacidade no Chrome
- ❌ **Zaask** — erro #10007, site inacessível
- ❌ **Fixando.pt** — plataforma de pedidos (cliente → profissional), sem listagem de profissionais
- ✅ **Habitissimo.pt** — scraping via JSON-LD `LocalBusiness` em páginas de listagem
- (OLX não foi necessário)

---

## Totais

| Etapa | Quantidade |
|-------|-----------|
| Combinações scrapeadas (16 serviços × 12 cidades) | 192 |
| Páginas "not found" (profissão inexistente nessa cidade) | 24 |
| Perfis brutos extraídos | 1 626 |
| Perfis únicos após merge (mesmo profissional, várias cidades/serviços) | 221 |
| Excluídos manualmente (verificação Chrome) | 4 |
| Total validado | 217 |
| Rejeitados automaticamente (score < 2) | 68 |
| **Importados para Supabase (score ≥ 2)** | **149** |
| Score ≥ 4 (import direto) | 0 |
| Score 2-3 (para revisão) | 149 |
| Duplicados detectados | 0 (merge por profile_url) |

> **Nota sobre scores:** todos os perfis têm score máximo 2 (morada + bio encontradas).
> Score 3-5 requer número de telefone e/ou email — dados ocultos por autenticação no Habitissimo.

---

## Por zona geográfica

| Zona | Perfis importados |
|------|-----------------|
| Marco de Canaveses | 59 |
| Braga | 56 |
| Porto | 22 |
| Paços de Ferreira | 6 |
| Amarante | 5 |
| Felgueiras | 1 |
| Penafiel | 0 |
| Paredes | 0 |
| Baião | 0 |
| Lousada | 0 |
| Vila Nova de Gaia | 0 |
| Maia | 0 |

---

## Por profissão (perfis importados)

| Profissão | Quantidade |
|-----------|-----------|
| pedreiro | 20 |
| serralheiro | 19 |
| ar-condicionado | 19 |
| canalizador | 18 |
| obras-remodelacao | 18 |
| desentupimento | 18 |
| faz-tudo | 18 |
| pladur | 18 |
| pintor | 22 |
| eletricista | 17 |
| isolamento-termico | 15 |
| telhador | 13 |
| carpinteiro | 10 |
| vidraceiro | 6 |
| impermeabilizacao | 0 (não encontrado no Habitissimo) |
| azulejador | 0 (não encontrado no Habitissimo) |

---

## Problemas encontrados

1. **impermeabilizacao e azulejador**: 24 páginas "not found" no Habitissimo — estas profissões ou não existem sob este slug, ou não têm profissionais cadastrados nas cidades alvo. Necessita fonte alternativa.

2. **Números de telefone ausentes**: o Habitissimo oculta os contactos por detrás de autenticação. Todos os 149 perfis têm `phone: null`. Sugestão: completar com Páginas Amarelas (quando SSL resolvido) ou verificação manual.

3. **Cobertura geográfica limitada**: apenas 6 das 12 cidades têm resultados. Penafiel, Paredes, Baião, Lousada, Gaia e Maia não retornaram profissionais nas categorias consultadas.

4. **Fontes alternativas inacessíveis**: 3 das 6 fontes planeadas estavam inacessíveis nesta sessão (ver secção Source acima).

---

## Exclusões manuais — verificação Chrome (5 mais comuns)

| Nome | Motivo de rejeição |
|------|--------------------|
| Mylene Costa | Engenheira Civil + interior designer brasileira — não executa obras |
| ConstruPro HS | Agência imobiliária (home staging, mediação) — não é empresa de construção |
| Sg Indústria De Mobiliario | Fábrica de mobiliário — não instala, só produz |
| Restauro De Madeiras E Moveis | Restauro de móveis antigos — não é carpintaria de construção |

---

## Exemplos de registos IMPORTADOS (5 exemplos de qualidade)

| Nome | Profissão | Cidade | Score |
|------|-----------|--------|-------|
| Carlos Daniel | eletricista | Marco de Canaveses | 2 |
| Pedro Dourado Unipessoal Lda | eletricista | Marco de Canaveses | 2 |
| Fabio Garcia Eletricista | eletricista | Marco de Canaveses | 2 |
| Multivieira, unipessoal lda | serralheiro | Braga | 2 |
| Construções Teles | pintor | Braga | 2 |

---

## Estado no Supabase

- Todos os perfis importados com `active: false` e `verified: false`
- Campo `company_city` preenchido (morada de Habitissimo)
- Campo `bio` preenchido (extraído de página individual do profissional)
- Activação manual necessária após revisão de cada perfil

---

## Próximas etapas

1. **Completar telefones**: usar Páginas Amarelas ou pesquisa manual Google por empresa+cidade
2. **Cobrir profissões em falta**: impermeabilizacao e azulejador — tentar Zaask ou OLX
3. **Cobrir cidades sem resultados**: Penafiel, Paredes, Gaia, Maia — tentar outras categorias ou slugs
4. **Activar perfis verificados**: após validação manual (telefone funciona, empresa ativa), definir `active: true`
5. **Adicionar zonas Prioridade 2 e 3**: Gondomar, Matosinhos, Valongo, Trofa, etc.

---

*Gerado automaticamente — Vitfix.io — Scraping PT Habitissimo — Março 2026*
