# CLAUDE.md — SEO Portugal 🇵🇹
# Vitfix.io — Plataforma de ligação entre profissionais de construção e clientes

> **Lê este ficheiro no início de cada sessão.**
> Contém todo o contexto necessário para produzir conteúdo SEO eficaz para o mercado português.

---

## ⚡ Instruções automáticas — executar SEM ser pedido

**No início de cada sessão, fazer SEMPRE e AUTOMATICAMENTE:**

1. Lê este ficheiro (CLAUDE.md)
2. Lê MEMORY.md — resume internamente o estado do projecto e o que ficou por fazer
3. Lê product/roadmap.md, product/bugs.md e product/decisions.md
4. Informa o utilizador em 2-3 linhas do estado actual e aguarda instrução

**Após CADA acção executada, fazer SEMPRE e AUTOMATICAMENTE:**

1. Actualiza MEMORY.md com o formato definido nesse ficheiro
   — data/hora, acção, ficheiros tocados, resultado
2. Se foi corrigido um bug → actualiza também product/bugs.md
3. Se foi tomada uma decisão técnica → actualiza também product/decisions.md
4. Se foi concluída uma funcionalidade → actualiza product/roadmap.md
5. Se foi criado conteúdo novo → actualiza /reports/conteudo-existente.md

**Nunca é preciso pedir estas actualizações — fazem parte do fluxo normal.**

---

## 🏢 O Produto

Somos uma **plataforma digital de ligação no setor da construção** que conecta:

- **Profissionais de construção** (canalizadores, eletricistas, pintores, carpinteiros, empreiteiros, etc.)
- **Particulares** que precisam de obras ou reparações em casa (B2C)
- **Administradores de condomínios, empresas de gestão imobiliária e organismos profissionais do setor** (B2B)

**Nome da plataforma:** Vitfix.io
**Mercados ativos:** Portugal (foco atual) e França.
**Língua de conteúdo:** Português europeu — NUNCA português do Brasil.

### URLs da plataforma
| Ambiente | URL |
|---|---|
| Produção PT | https://vitfix.io/pt/ |
| Produção FR | https://vitfix.io/fr/ |
| Vercel (provisório) | https://fixit-production.vercel.app/ |

> Em todo o conteúdo criado, usar sempre o URL definitivo **https://vitfix.io/pt/** nos links internos e chamadas para ação — nunca o URL do Vercel.
> **NOTA:** O domínio é `vitfix.io` — nunca `vitfix.pt`.

### Rotas Next.js implementadas — Portugal (App Router)

| Rota | Ficheiro | Páginas geradas | Estado |
|---|---|---|---|
| `/pt/servicos/[slug]/` | `app/pt/servicos/[slug]/page.tsx` | ~168 (14 serviços × 12 cidades) | ✅ Live |
| `/pt/blog/` | `app/pt/blog/page.tsx` | 1 (listing) | ✅ Live |
| `/pt/blog/[slug]/` | `app/pt/blog/[slug]/page.tsx` | Dinâmico (por artigo) | ✅ Live |
| `/pt/cidade/[slug]/` | `app/pt/cidade/[slug]/page.tsx` | 12 (1 por cidade) | ✅ Live |
| `/pt/urgencia/` | `app/pt/urgencia/page.tsx` | 1 (hub) | ✅ Live |
| `/pt/urgencia/[slug]/` | `app/pt/urgencia/[slug]/page.tsx` | ~168 (serviço × cidade) | ✅ Live |

> **NOTA:** As URLs usam `/pt/servicos/` (português correto), não `/pt/services/`.
> Formato slug: `{servico}-{cidade}` (ex: `canalizador-marco-de-canaveses`)

### GEO — Generative Engine Optimization (IA-Friendly SEO)

Ficheiros para aparecer nas respostas de IAs (ChatGPT, Claude, Gemini, Perplexity):

| Ficheiro | Caminho | Função |
|---|---|---|
| `llms.txt` | `/public/llms.txt` | Descrição da plataforma para crawlers IA — serviços, preços, vocabulário regional, URLs |
| `robots.ts` | `app/robots.ts` | Autorização explícita para GPTBot, ClaudeBot, PerplexityBot, GoogleOther, anthropic-ai, cohere-ai |

### Dados SEO — ficheiro principal

Ficheiro: `lib/data/seo-pages-data.ts`

**Cidades (12):** Marco de Canaveses, Penafiel, Amarante, Baião, Felgueiras, Lousada, Paços de Ferreira, Paredes, Porto, Vila Nova de Gaia, Braga, Maia

**Serviços (14):** eletricista, canalizador, pintor, pladur, obras-remodelacao, isolamento-termico, impermeabilizacao, desentupimento, faz-tudo, serralheiro, telhador, vidraceiro, pedreiro, carpinteiro

Cada serviço inclui: metaTitle, metaDesc, heroTitle, heroSubtitle, features, problemsWeSolve, FAQs com preços, urgency data.

**Funções helper:** `getAllPageCombos()`, `getPageCombo(slug)`, `getAllUrgencyCombos()`, `getUrgencyCombo(slug)`, `getCityBySlug(slug)`, `getBlogArticle(slug)`

**Schema.org em cada página:** HomeAndConstructionBusiness, AggregateRating, BreadcrumbList, FAQPage, EmergencyService (urgência), Article (blog)

### Vocabulário regional — integrado nos dados e no llms.txt

| Termo standard | Termo regional Norte | Integrado em |
|---|---|---|
| Canalizador | **Picheleiro** | FAQs do serviço canalizador, llms.txt |
| Carpinteiro | **Marceneiro** | FAQs do serviço carpinteiro, llms.txt |
| Profissional de construção | **Empreiteiro** | Todas as páginas, llms.txt |

> **REGRA:** Nunca usar "artesão" para profissionais de construção — em Portugal refere-se ao artesanato tradicional (cerâmica, bordados).

---

## 💡 Lições do Mercado Francês Adaptadas a Portugal

O mercado francês de ligação entre profissionais e clientes é muito mais maduro. Aprendemos com ele para não repetir os seus erros e acelerar o crescimento em Portugal.

### O que funciona em França e se aplica diretamente a Portugal

- **Conteúdo local por cidade é decisivo** — Em França, páginas como "Canalizador em Lyon" ou "Empreiteiro em Marselha" geram a maioria do tráfego qualificado. Em Portugal, o mesmo modelo funciona mas com uma vantagem: nas zonas de arranque da Vitfix.io (Marco de Canaveses, Penafiel, Amarante, Rio Tinto), a concorrência é próxima de zero — algo que nunca aconteceu em França.
- **O segmento condomínios é o mais rentável e menos competitivo** — Plataformas como ChouetteCopro e Syment em França capturam clientes B2B com muito menos concorrência do que no B2C. Em Portugal, este segmento está praticamente sem concorrência digital — é a nossa maior oportunidade.
- **A verificação dos profissionais é o argumento principal** — Plataformas como Travaux.com e Habitatpresto cresceram em França por garantir profissionais verificados (seguros, certificações, referências). Em Portugal, a desconfiança é ainda maior — este argumento deve estar em destaque em todo o conteúdo.
- **Os guias de preços geram enorme tráfego** — Artigos do tipo "Quanto custa reparar um telhado?" são dos mais visitados em França. Em Portugal, este tipo de conteúdo existe muito pouco — oportunidade imediata de posicionamento.
- **A mensalidade para profissionais funciona melhor do que a comissão por obra** — Em França, o Habitatpresto Pro provou que os profissionais preferem uma mensalidade previsível. Comunicar este modelo claramente no SEO atrai profissionais mais sérios.

### O que NÃO funciona em França e devemos evitar em Portugal

- **Ser demasiado genérico** — As grandes plataformas generalistas francesas perdem em nichos para plataformas especializadas. Em Portugal, devemos destacar sempre o foco em condomínios e gestão profissional — não ser só mais uma plataforma de obras.
- **Ignorar o telemóvel** — As plataformas francesas que não otimizaram para telemóvel perderam terreno rapidamente. Em Portugal, a maioria das pesquisas é feita no telemóvel — o conteúdo tem de ser legível, rápido e com chamadas para ação visíveis.
- **Conteúdo longo sem estrutura** — O utilizador português, tal como o francês, abandona rapidamente páginas sem subtítulos claros, listas e respostas diretas. Estruturar sempre o conteúdo para leitura rápida.
- **Não explorar as pesquisas de urgência** — Em França, termos como "canalizador urgência" ou "eletricista urgente" têm volumes significativos. Em Portugal, este grupo de palavras-chave está por explorar.

### Adaptações específicas ao contexto português

- **O boca-a-boca tem muito mais peso em Portugal** — A confiança digital ainda está a desenvolver-se. O conteúdo deve focar-se em provas sociais, avaliações e casos reais, mais do que em França.
- **O mercado de condomínios é regulado de forma diferente** — Em Portugal, a legislação de condomínios (Código Civil, Decreto-Lei 268/94) é diferente da francesa. Todo o conteúdo B2B deve referenciar a legislação portuguesa.
- **O interior norte tem dinâmica própria** — Zonas como Tâmega e Sousa têm muitas moradias antigas e cultura de autoconstrução. O conteúdo deve valorizar a confiança e a proximidade local, não a eficiência digital — que é o argumento que funciona em Lisboa ou no Algarve.
- **Menor digitalização dos profissionais** — Em França, os profissionais já estão habituados às plataformas digitais. Em Portugal, o conteúdo dirigido a profissionais deve ser mais educativo — explicar como funciona a plataforma, quais os benefícios, como se registar.

---

## 🗺️ Zona Geográfica de Arranque

**Fase 1 — Foco exclusivo nestas zonas (norte de Portugal)**

---

### 🔴 Prioridade 1 — Tâmega e Sousa (concorrência digital quase zero)

| Concelho | População | Oportunidade SEO |
|---|---|---|
| **Marco de Canaveses** | ~53 000 hab. | Prioridade máxima — zero conteúdo local existente |
| **Penafiel** | ~71 000 hab. | Muito alta — nenhum concorrente tem páginas locais |
| **Amarante** | ~56 000 hab. | Muito alta — zero concorrência |
| **Paredes** | ~87 000 hab. | Alta — zona industrial, muitas moradias |
| **Lousada** | ~47 000 hab. | Alta — pouco explorado digitalmente |
| **Felgueiras** | ~58 000 hab. | Alta — zona têxtil e habitação antiga |
| **Baião** | ~20 000 hab. | Média — menor volume mas zero concorrência |
| **Castelo de Paiva** | ~16 000 hab. | Média — adjacente a Penafiel e Gondomar |

> **Porquê começar aqui?** Fixando, Zaask, Habitissimo e Oscar não têm praticamente nenhum conteúdo local para estes concelhos. Qualquer página criada com "empreiteiro Marco de Canaveses" ou "canalizador Penafiel" posiciona no top 3 do Google em semanas.

---

### 🟠 Prioridade 2 — Área Metropolitana do Porto (17 concelhos oficiais)

**Núcleo central (maior volume de pesquisa, mais competitivo):**

| Concelho | População | Notas SEO |
|---|---|---|
| **Porto** | ~232 000 hab. | Muito competitivo, mas volume enorme. Foco em bairros: Bonfim, Campanhã, Lordelo, Paranhos |
| **Vila Nova de Gaia** | ~304 000 hab. | Maior concelho da AMP — muitos apartamentos e condomínios |
| **Gondomar / Rio Tinto** | ~168 000 hab. | Rio Tinto é cidade dentro de Gondomar — pesquisas específicas |
| **Matosinhos** | ~175 000 hab. | Muita reabilitação urbana, bom mercado B2B condomínios |
| **Maia** | ~135 000 hab. | Zona industrial + habitação — bom perfil para profissionais |
| **Valongo** | ~93 000 hab. | Adjacente a Rio Tinto — pouco explorado digitalmente |

**AMP — concelhos com menos concorrência digital:**

| Concelho | População | Notas SEO |
|---|---|---|
| **Espinho** | ~31 000 hab. | Zona costeira, muita habitação antiga — baixa concorrência |
| **Santa Maria da Feira** | ~139 000 hab. | Grande concelho, bom potencial B2C |
| **Trofa** | ~38 000 hab. | Pouco explorado — oportunidade rápida |
| **Santo Tirso** | ~71 000 hab. | Zona industrial/habitação — pouca concorrência local |
| **Póvoa de Varzim** | ~63 000 hab. | Zona costeira, sazonalidade diferente |
| **Vila do Conde** | ~79 000 hab. | Bom potencial — pouca concorrência local |
| **Paredes** *(também Tâmega)* | ~87 000 hab. | Listado acima — prioridade 1 |
| **Arouca** | ~22 000 hab. | Interior, baixo volume mas zero concorrência |
| **Oliveira de Azeméis** | ~68 000 hab. | Zona industrial do sul da AMP |
| **São João da Madeira** | ~22 000 hab. | Pequeno mas concentrado — bom B2B |
| **Vale de Cambra** | ~22 000 hab. | Menor volume, interior |

---

### Contexto local — o que saber sobre cada zona

**Tâmega e Sousa (Marco, Penafiel, Amarante, Paredes, Lousada, Felgueiras):**
- Zona semi-rural/industrial com muitas moradias antigas a precisar de renovação — mercado natural para reabilitação
- Forte cultura de boca-a-boca e confiança pessoal — a plataforma deve posicionar-se como modernização desse modelo, não substituição
- Muitos profissionais locais sem qualquer presença online — grande oportunidade de captação pelo lado da oferta
- Profissionais destas zonas trabalham frequentemente também no Porto e arredores — bom para páginas que cobrem "zona do Tâmega e Sousa + Porto"
- Concorrência digital próxima de zero — qualquer artigo com estas referências geográficas posiciona em semanas
- Paredes tem forte tradição na indústria do mobiliário — perfil económico diferente, mais poder de compra

**Grande Porto (núcleo central):**
- Mercado maior e mais competitivo, mas com volume de pesquisa muito superior
- Forte mercado de condomínios e apartamentos em Gaia, Matosinhos e Porto cidade — ideal para B2B
- Muita renovação urbana em curso: centro histórico do Porto, Bonfim, Campanhã, Lordelo do Ouro, Paranhos
- Rio Tinto (dentro de Gondomar) tem pesquisas próprias — criar página específica para Rio Tinto
- Pesquisas de urgência frequentes: "canalizador urgente Porto", "eletricista urgente Gaia"
- Maior concentração de administradores de condomínio e gestoras imobiliárias — B2B prioritário aqui

---

## 🎯 Objetivos SEO — Portugal

### Prioridades gerais
1. Dominar as pesquisas locais nas zonas de arranque (Marco de Canaveses, Penafiel, Amarante e Porto)
2. Criar conteúdo de autoridade sobre o setor da construção nestas regiões específicas
3. Expandir progressivamente para outras zonas à medida que a plataforma cresce
4. Diferenciar da concorrência com foco no segmento B2B (condomínios e gestores imobiliários)
5. Capitalizar a ausência de concorrência digital nas zonas do interior — vantagem imediata

### Indicadores a acompanhar
- Volume de tráfego orgânico proveniente das zonas de arranque
- Posicionamento nos dez primeiros resultados nas palavras-chave locais prioritárias
- Taxa de conversão profissional/cliente via pesquisa orgânica
- Autoridade de domínio

---

## 👥 Perfis de Utilizador — Mercado Português

### Perfil 1 — O Profissional de Construção
- **Caracterização:** Homem, 30-55 anos, empresa individual ou pequena empresa até 10 pessoas
- **Dificuldades:** Dificuldade em encontrar clientes regulares, dependência do boca-a-boca, incerteza entre obras, pouca presença digital
- **Pesquisas típicas:** "como arranjar mais clientes construção", "plataforma obras Portugal", "encontrar obras perto de mim", "como angariar clientes empreiteiro"
- **Tom a usar:** Direto, prático, sem linguagem técnica desnecessária. Respeito pelo ofício. Mostrar que a plataforma é fácil de usar — menos digitalizado do que em França.

### Perfil 2 — O Particular / Proprietário
- **Caracterização:** Homem ou mulher, 35-65 anos, proprietário de casa ou apartamento
- **Dificuldades:** Receio de contratar um mau profissional, dificuldade em obter orçamentos, obras que ficam por acabar, desconfiança face a plataformas digitais
- **Pesquisas típicas:** "encontrar canalizador de confiança Porto", "orçamento obras casa Marco de Canaveses", "como contratar empreiteiro de confiança norte Portugal"
- **Tom a usar:** Tranquilizador, claro, centrado na confiança e segurança. Enfatizar a verificação dos profissionais.

### Perfil 3 — O Administrador de Condomínio / Gestor Imobiliário (B2B)
- **Caracterização:** Profissional de gestão, 35-60 anos, gere vários edifícios ou condomínios em Portugal
- **Dificuldades:** Encontrar prestadores fiáveis e com documentação em dia rapidamente, gerir múltiplos fornecedores, controlar custos de manutenção, cumprir obrigações legais
- **Pesquisas típicas:** "plataforma prestadores condomínios Portugal", "gestão manutenção edifícios", "empresa serviços condomínios", "software administração condomínios"
- **Tom a usar:** Profissional, centrado na eficiência e no retorno, com vocabulário do setor imobiliário português. Referir sempre a conformidade legal.

---

## 🔑 Palavras-Chave Prioritárias — Portugal

### Grupo 1 — Profissionais de Construção (atrair o lado da oferta)

> Foco em termos realistas para um site novo — evitar termos nacionais genéricos com volume alto mas impossíveis de posicionar. Priorizar termos locais onde a concorrência é zero.

**Termos locais (posicionamento rápido — semanas):**
- empreiteiro Marco de Canaveses
- canalizador Marco de Canaveses
- eletricista Penafiel
- empreiteiro Penafiel
- obras Amarante empreiteiro
- profissional construção Paredes
- empreiteiro Lousada
- obras renovação Felgueiras
- canalizador Rio Tinto
- empreiteiro Gondomar

**Termos de captação de profissionais (médio prazo):**
- como conseguir mais obras norte Portugal
- como angariar clientes empreiteiro Porto
- plataforma para empreiteiros norte Portugal
- registar empresa obras plataforma digital Portugal
- como encontrar clientes construção civil Porto

### Grupo 2 — Particulares (atrair o lado da procura)

> Mesma lógica: começar pelos termos locais onde há zero concorrência, expandir depois para os termos com mais volume.

**Termos locais (posicionamento rápido — semanas):**
- empreiteiro Marco de Canaveses confiança
- canalizador Penafiel orçamento
- obras casa Amarante profissional
- empreiteiro Rio Tinto
- obras renovação Gondomar
- eletricista urgente Gaia
- canalizador urgente Porto
- empreiteiro Paredes obras
- profissional construção Matosinhos
- obras renovação apartamento Gaia

**Guias de preços — alto tráfego, pouca concorrência em PT (inspirado em França):**
- quanto custa canalizador Porto
- quanto custa empreiteiro norte Portugal
- preço obras renovação casa Porto
- quanto custa eletricista urgente Porto
- orçamento obras apartamento Vila Nova de Gaia

### Grupo 3 — Condomínios / B2B (principal diferenciador)
**Termos principais:**
- prestadores serviços condomínios Portugal
- gestão manutenção condomínios
- plataforma administração condomínios
- empresas serviços edifícios Portugal

**Termos específicos:**
- como encontrar prestadores certificados para condomínios
- plataforma ligação administrador condomínio profissional construção
- solução digital gestão obras condomínio
- gestão prestadores condomínios Portugal

### Grupo 4 — Localização (lista completa por prioridade)

**🔴 Prioridade 1 — Tâmega e Sousa (zero concorrência):**
- empreiteiro Marco de Canaveses
- canalizador Marco de Canaveses
- eletricista Marco de Canaveses
- obras renovação Marco de Canaveses
- empreiteiro Penafiel
- canalizador Penafiel
- obras casa Penafiel
- empreiteiro Amarante
- obras renovação Amarante
- eletricista Amarante
- empreiteiro Paredes
- obras Paredes renovação
- empreiteiro Lousada
- obras Felgueiras empreiteiro
- profissional construção Tâmega e Sousa
- obras casa interior norte Portugal
- empreiteiro Castelo de Paiva
- obras Baião

**🟠 Prioridade 2 — AMP núcleo (volume alto, mais competitivo):**
- empreiteiro Porto
- canalizador Porto
- eletricista Porto
- obras renovação Porto apartamento
- canalizador urgente Porto
- eletricista urgente Porto
- empreiteiro Vila Nova de Gaia
- canalizador Gaia urgente
- obras renovação apartamento Gaia
- empreiteiro Gondomar
- canalizador Rio Tinto
- empreiteiro Rio Tinto obras
- obras Matosinhos renovação
- empreiteiro Maia
- canalizador Valongo
- obras Valongo empreiteiro
- condomínios Porto prestadores serviços
- administrador condomínio Porto empreiteiro
- gestão prestadores condomínios Gaia

**🟡 Prioridade 3 — AMP periférica (menos concorrência):**
- empreiteiro Espinho
- obras renovação Santa Maria da Feira
- empreiteiro Trofa
- obras Santo Tirso empreiteiro
- canalizador Póvoa de Varzim
- empreiteiro Vila do Conde
- obras Oliveira de Azeméis
- empreiteiro São João da Madeira
- obras Arouca empreiteiro

### Palavras-chave a excluir (tráfego não qualificado)
- obras públicas (concursos do Estado)
- construção nova (foco em renovação e manutenção)
- autoconstrução

---

## 🏆 Concorrentes — Mercado Português

### Concorrentes diretos B2C (particulares ↔ profissionais)

| Concorrente | Modelo | Pontos Fortes | Fraqueza | Ameaça |
|---|---|---|---|---|
| **Fixando.pt** | Marketplace aberto | Maior tráfego PT (333k visitas/mês), generalista | Sem foco em condomínios, sem verificação séria | 🔴 Alta |
| **Zaask.pt** | Marketplace (comprado pela Worten 2021) | 120k profissionais, parceria Worten, presença nacional | Muitas reclamações, foco generalista (não só construção) | 🔴 Alta |
| **Oscar** | App serviços domésticos | Forte marketing PT, app mobile, muito conhecido | Inundado de reclamações, sem foco em obras grandes, sem B2B | 🟠 Média |
| **Habitissimo.pt** | Plataforma orçamentos | Guias de preços muito bem posicionados no Google | Generalista, sem B2B, fraca presença no norte PT | 🟠 Média |
| **StarOfService.pt** | Marketplace | Presente em PT, vários serviços | Pouca tração, fraca presença local | 🟡 Baixa |
| **YourHero.pt** | Marketplace | Presente em PT | Muito pequeno, pouco tráfego | 🟡 Baixa |

### Concorrentes B2B (condomínios / gestão imobiliária)

| Concorrente | Tipo | Pontos Fortes | Fraqueza | Ameaça |
|---|---|---|---|---|
| **PortalPRO** (Improxy) | B2B gestão condomínios | Integrado com Gecond, 62 mil edifícios | Não é marketplace aberto | 🟠 Média |
| **Gecond / Improxy** | Software de gestão | Dominante no mercado PT | Não conecta profissionais externos | 🟠 Média |
| **Flexdomus** | Software condomínios | Simples e económico | Sem plataforma de prestadores | 🟡 Baixa |
| **SolidSoft GC** | Software condomínios | Mais de 100 mil frações geridas | Sem ligação a profissionais | 🟡 Baixa |

### Diretórios e classificados

| Concorrente | Tipo | Relevância SEO |
|---|---|---|
| **OLX Portugal** | Classificados gerais | Alta audiência, sem verificação |
| **Páginas Amarelas (pai.pt)** | Diretório | Bem posicionado para buscas locais |
| **Homify.pt** | Inspiração + profissionais | Foco em design, não em construção |

### O que nos diferencia de TODOS eles

| Vitfix.io | Fixando / Zaask / Oscar | PortalPRO / Gecond |
|---|---|---|
| ✅ B2C + B2B numa só plataforma | ❌ Apenas B2C | ❌ Apenas B2B (software) |
| ✅ Foco em condomínios e gestores | ❌ Generalistas | ❌ Sem marketplace de profissionais |
| ✅ Profissionais verificados | ⚠️ Verificação superficial | — |
| ✅ Foco no norte de Portugal (Porto, Marco, Penafiel) | ❌ Foco em Lisboa e grandes cidades | ❌ Nacional mas sem localização |

### Fraquezas dos concorrentes a explorar no conteúdo SEO
- **Oscar e Zaask** têm muitas reclamações públicas — artigos sobre "como escolher uma plataforma segura" posicionam bem e convertem
- **Fixando e Habitissimo** não têm conteúdo local para Marco de Canaveses, Penafiel, Amarante — oportunidade imediata
- **Nenhum concorrente** tem conteúdo dedicado ao segmento condomínios + profissionais de construção em conjunto

---

## ✍️ Tom Editorial e Voz de Marca — Portugal

### Princípios
- **Português europeu apenas** — Nunca "você" ou expressões do português do Brasil
- **Confiança em primeiro lugar** — O mercado português é muito orientado para o boca-a-boca; a plataforma deve transmitir segurança ainda mais do que em França
- **Direto e prático** — Os portugueses valorizam clareza sem excessos
- **Proximidade local** — Usar referências das zonas de arranque (Marco de Canaveses, Penafiel, Amarante, Porto e arredores). Nunca usar exemplos de Lisboa ou Braga no conteúdo destas zonas.
- **Profissionalismo** — Especialmente para o segmento B2B
- **Educativo para profissionais** — Ao contrário de França, muitos profissionais portugueses nunca usaram uma plataforma digital. O conteúdo deve explicar e tranquilizar.

### Vocabulário a usar (português europeu)
| ✅ Usar | ❌ Evitar |
|---|---|
| profissional de construção | artesão (conotação errada) |
| empreiteiro | construtor (demasiado genérico) |
| canalizador | encanador (português do Brasil) |
| eletricista | |
| condomínio / administrador de condomínio | síndico (menos comum em Portugal) |
| obras de renovação | reforma (português do Brasil) |
| orçamento | |
| certificado / verificado | |
| frações / fração autónoma | apartamento/quarto (em contexto de condomínio) |
| APEGAC (associação do setor em Portugal) | |
| telemóvel | celular (português do Brasil) |

### Estrutura de conteúdo recomendada (artigos)
1. **Título H1** com palavra-chave principal + promessa clara
2. **Introdução** (2-3 parágrafos) — problema identificado + relevância para Portugal
3. **Subtítulos H2/H3** com palavras-chave secundárias
4. **Listas** para facilitar a leitura em telemóvel
5. **Chamada para ação** — direcionar sempre para a plataforma
6. **Perguntas frequentes** no final — capturar pesquisas por voz
7. **Descrição meta** de 150-160 caracteres com palavra-chave e chamada para ação

---

## 📋 Modelos de Conteúdo SEO

### Modelo — Artigo de Guia
```
Título: Como [ação] [resultado] em Portugal [ano]
Exemplo: "Como Encontrar um Empreiteiro de Confiança em Marco de Canaveses em 2026"

Descrição meta: Descubra como [ação] em Portugal. [Benefício principal]. [Chamada para ação].

H1: [= Título]
H2: O que procurar num bom empreiteiro em Portugal
H2: Como verificar se um profissional tem documentação em dia
H2: Quanto custa [serviço] em Portugal? (preços médios 2026)
H2: Como a Vitfix.io simplifica a escolha
H2: Perguntas Frequentes
```

### Modelo — Página de Serviço por Localização
```
Título: [Serviço] em [Cidade] | Vitfix.io
Exemplo: "Canalizador em Marco de Canaveses | Profissionais Verificados"

H1: Encontre um Canalizador de Confiança em Marco de Canaveses
H2: Profissionais verificados disponíveis em Marco de Canaveses e arredores
H2: Como funciona em 3 passos
H2: Porque escolher a Vitfix.io
H2: Concelhos cobertos (Marco de Canaveses, Penafiel, Amarante...)
Chamada para ação: Pedir Orçamento Grátis
```

### Modelo — Página B2B (Condomínios)
```
Título: Gestão de Prestadores para Condomínios | Vitfix.io

H1: A Plataforma que Liga Administradores de Condomínio a Profissionais Certificados
H2: O problema: encontrar prestadores fiáveis é difícil em Portugal
H2: A solução: Vitfix.io para gestores de condomínio
H2: Funcionalidades para administradores
H2: Casos práticos: tipos de obras mais comuns em condomínios portugueses
H2: Planos e preços para empresas de gestão
H2: Compatibilidade com software de condomínio (Gecond, Flexdomus, SolidSoft)
Chamada para ação: Pedir Demonstração Gratuita
```

### Modelo — Guia de Preços (alto tráfego, comprovado em França)
```
Título: Quanto Custa [Serviço] em Portugal em [ano]?

H1: Quanto Custa [Serviço] em Portugal? Preços e Orçamentos em [ano]
H2: Preços médios por tipo de trabalho
H2: Fatores que influenciam o preço em Portugal
H2: Como obter orçamentos fiáveis
H2: O que está incluído no preço (materiais, mão de obra, deslocação)
H2: Como poupar sem comprometer a qualidade
H2: Perguntas Frequentes sobre preços
```

---

## 🗓️ Calendário de Conteúdo — Portugal

### Conteúdo permanente (prioridade máxima)
- [ ] "Guia completo: como contratar um empreiteiro em Portugal"
- [ ] "Quanto custam obras de renovação em Portugal? (preços 2026)"
- [ ] "O que é a responsabilidade civil decenária e porque é importante"
- [ ] "Como gerir prestadores de serviços num condomínio em Portugal"
- [ ] "APEGAC: o que é e o que significa para os condomínios"
- [ ] "Quanto custa um canalizador em Portugal?" (guia de preços)
- [ ] "Quanto custa um eletricista em Portugal?" (guia de preços)
- [ ] "Como encontrar um profissional de construção urgente no Porto"

### Conteúdo sazonal
- Janeiro/Fevereiro: "Obras de inverno: o que fazer antes do verão"
- Março/Abril: "Preparar a casa para o verão: obras prioritárias"
- Setembro/Outubro: "Temporada de obras: como planear renovações de outono"
- Outubro/Novembro: "Obras no interior norte fora de época: o momento ideal para renovar em Tâmega e Sousa"

### Conteúdo local — Fase 1 (começar aqui — zero concorrência)

**Tâmega e Sousa — artigos a criar primeiro:**
- "Empreiteiro em Marco de Canaveses: como encontrar e contratar"
- "Canalizador em Marco de Canaveses: guia para proprietários"
- "Obras de renovação em Penafiel: profissionais de confiança"
- "Empreiteiro em Amarante: o que saber antes de contratar"
- "Eletricista em Penafiel: encontrar profissional certificado"
- "Obras em Paredes: empreiteiros verificados perto de si"
- "Empreiteiro em Lousada: obras e renovações"
- "Profissionais de construção no Tâmega e Sousa: guia completo"
- "Quanto custa um empreiteiro no Tâmega e Sousa?" (guia de preços)

**Grande Porto — artigos núcleo:**
- "Empreiteiro no Porto: guia completo para proprietários"
- "Canalizador urgente no Porto: como encontrar rapidamente"
- "Obras de renovação de apartamento no Porto: preços e dicas"
- "Empreiteiro em Rio Tinto: profissionais verificados"
- "Canalizador em Gondomar: encontrar e contratar"
- "Obras em Vila Nova de Gaia: empreiteiros de confiança"
- "Condomínios no Porto: como gerir prestadores de serviços"
- "Empreiteiro em Matosinhos: guia para proprietários"
- "Obras em Valongo: profissionais de construção"

**Grande Porto — concelhos periféricos (fase seguinte):**
- "Empreiteiro em Espinho: obras e renovações"
- "Obras em Santa Maria da Feira: encontrar profissional"
- "Empreiteiro em Trofa: guia para proprietários"
- "Obras em Santo Tirso: profissionais certificados"
- "Empreiteiro na Póvoa de Varzim: obras e renovações"
- "Obras em Vila do Conde: encontrar empreiteiro de confiança"

---

## 📋 Registo de Conteúdo Existente no Site

**IMPORTANTE:** Antes de criar qualquer conteúdo, verifica o que já existe online — não só na pasta local.

### Site atual (Vercel provisório)
URL base: https://fixit-production.vercel.app/

```
Antes de cada sessão de criação de conteúdo, faz isto:
1. Acede a https://fixit-production.vercel.app/ com o Claude in Chrome
2. Mapeia todas as páginas e artigos já publicados
3. Regista em /reports/conteudo-existente.md com: URL, título, palavra-chave
4. Nunca criar conteúdo que já exista online, mesmo que não esteja na pasta local
```

### Quando o domínio definitivo estiver ativo
Substituir por: https://vitfix.io/pt/
Atualizar este ficheiro com a lista de URLs definitivos.

### Ficheiro de registo — atualizar manualmente
Criar e manter o ficheiro `/reports/conteudo-existente.md` com:
```
| URL | Título | Palavra-chave principal | Data criação |
|---|---|---|---|
| /pt/... | ... | ... | ... |
```

---

## ⚙️ Regras Técnicas SEO — Aplicar Sempre

### Em cada página ou artigo criado:
```
✅ Etiqueta de título: 50-60 caracteres, palavra-chave no início
✅ Descrição meta: 150-160 caracteres, com chamada para ação
✅ H1: único por página, contém a palavra-chave principal
✅ H2/H3: incluem palavras-chave secundárias de forma natural
✅ Texto alternativo em todas as imagens: descritivo + palavra-chave se relevante
✅ Endereço URL: curto, em minúsculas, separado por hífens, em português
✅ Ligações internas: mínimo 2-3 por artigo
✅ Ligação externa de autoridade: 1 por artigo (APEGAC, Portal da Habitação, INE, etc.)
✅ Marcação Schema: Article, FAQPage, LocalBusiness conforme o tipo de página
✅ Comprimento mínimo: 1.200 palavras para artigos
✅ Palavra-chave principal: presente no primeiro parágrafo
```

### Antes de criar qualquer conteúdo — verificação obrigatória

**REGRA ABSOLUTA: Antes de criar uma página ou artigo, verifica sempre se já existe.**

```
1. Lista todos os ficheiros em /content/blog/ e /content/local/
2. Verifica se já existe uma página com a mesma palavra-chave ou tema
3. Verifica se já existe uma página para a mesma cidade/concelho
4. Só avança se não houver duplicado — caso contrário, otimiza o existente
```

Exemplos de duplicados a evitar:
- ❌ Criar "empreiteiro-porto.md" se já existe "empreiteiro-no-porto.md"
- ❌ Criar dois artigos sobre "quanto custa canalizador" com palavras-chave semelhantes
- ❌ Criar páginas para Marco de Canaveses e "Marco Canaveses" (mesma localidade)
- ❌ Criar um guia de preços para eletricista se já existe guia de preços geral que o inclui

Se o conteúdo já existir → melhora e expande o ficheiro existente, não crias um novo.

### Nunca fazer:
```
❌ Criar uma página sem verificar primeiro se já existe conteúdo sobre esse tema
❌ Duas páginas com a mesma palavra-chave principal — canibalização de SEO
❌ Duas páginas para a mesma cidade e mesmo serviço
❌ Copiar e adaptar levemente uma página de uma cidade para outra — o Google penaliza
❌ Repetição excessiva de palavras-chave — máximo 1-2% de densidade
❌ Conteúdo duplicado entre páginas de Portugal e de França
❌ Tradução automática sem revisão editorial
❌ Títulos genéricos sem palavra-chave
❌ Artigos abaixo de 800 palavras para temas competitivos
❌ Copiar estruturas do mercado francês sem adaptar ao contexto português
```

---

## 📁 Estrutura de Pastas do Projeto

```
fixit-production/                        ← Projeto Next.js principal
├── app/pt/                              ← Rotas PT (App Router)
│   ├── servicos/[slug]/page.tsx         ← Páginas serviço×cidade (~168 páginas)
│   ├── blog/page.tsx                    ← Listing blog
│   ├── blog/[slug]/page.tsx             ← Artigos individuais
│   ├── cidade/[slug]/page.tsx           ← Páginas por cidade (12)
│   ├── urgencia/page.tsx                ← Hub urgência
│   ├── urgencia/[slug]/page.tsx         ← Urgência por serviço×cidade
│   ├── layout.tsx                       ← Layout PT com hreflang
│   └── page.tsx                         ← Homepage PT
├── lib/data/
│   ├── seo-pages-data.ts               ← Dados PT: 12 cidades, 14 serviços, artigos, helpers
│   ├── fr-seo-pages-data.ts            ← Dados FR: Marseille/PACA
│   └── fr-blog-data.ts                 ← Blog FR
├── lib/constants.ts                     ← PHONE_PT, PHONE_FR, SITE_URL
├── public/llms.txt                      ← Ficheiro GEO para crawlers IA
├── app/robots.ts                        ← Robots com crawlers IA autorizados
├── app/sitemap.ts                       ← Sitemap dinâmico (todas as rotas)
└── components/ArtisansCatalogueSection.tsx ← Catálogo de profissionais

seo-portugal/                            ← Conteúdo e estratégia SEO
├── CLAUDE.md                            ← Este ficheiro (lê primeiro)
├── context/
│   ├── about-platform.md                ← Detalhes técnicos da plataforma
│   └── brand-voice.md                   ← Exemplos de escrita aprovados
├── Content/
│   ├── Blog/                            ← Artigos produzidos (markdown)
│   ├── Pages/                           ← Páginas do site
│   └── Local/                           ← Conteúdo por cidade (canalizador, eletricista, pedreiro, pintor, etc.)
├── keywords/
│   └── competitor-analysis.md           ← Análise da concorrência
├── templates/                           ← Modelos de conteúdo
└── Reports/                             ← Relatórios SEO e auditorias
```

---

## 🚀 Instruções para o Cowork — Prontas a Usar

Copia e cola estas instruções diretamente no Cowork:

### Auditoria inicial + concorrência (prompt completo)
```
Lê o CLAUDE.md.

PASSO 1 — Auditoria do site Vitfix.io
Acede a https://fixit-production.vercel.app/ com o Claude in Chrome.
Mapeia todas as páginas publicadas (URLs, títulos, conteúdo visível).
Guarda a lista em /reports/conteudo-existente.md

PASSO 2 — Análise da concorrência
Acede a cada um destes sites com o Claude in Chrome e lista
todos os artigos e páginas publicados, com título e tema:
  - fixando.pt/blog (ou secção de conteúdo)
  - habitissimo.pt/orcamentos (guias de preços)
  - zaask.pt (categorias de serviços)
Foca nas categorias: obras, empreiteiros, canalizadores, eletricistas.
Guarda em /reports/concorrencia-conteudo.md

PASSO 3 — Identificar oportunidades
Cruza o conteúdo da Vitfix.io com o dos concorrentes.
Lista os temas que os concorrentes cobrem e a Vitfix.io não tem ainda.
Prioriza os que mencionam: Marco de Canaveses, Penafiel, Amarante, Porto.
(Os concorrentes quase não têm conteúdo local para estas zonas — é a nossa vantagem.)

PASSO 4 — Relatório PDF final
Cria um relatório PDF profissional em /reports/auditoria-seo-vitfix.pdf com:
  - Resumo executivo (1 página)
  - Lista de páginas existentes no site com estado SEO (✅ / ⚠️ / ❌)
  - Top 10 oportunidades de conteúdo por prioridade
  - Top 5 palavras-chave locais sem concorrência (Marco, Penafiel, Amarante)
  - Próximos passos recomendados
```

### Criação de artigo
```
Lê o CLAUDE.md e o ficheiro templates/article-template.md.
ANTES DE ESCREVER:
  1. Lista os ficheiros em /content/blog/
  2. Confirma que não existe já um artigo sobre [TEMA] ou [PALAVRA-CHAVE]
  3. Se existir → melhora o existente em vez de criar um novo
SE NÃO EXISTIR → escreve o artigo:
  Palavra-chave principal: [PALAVRA-CHAVE]
  Perfil de utilizador alvo: [Particular / Profissional de construção / Administrador de condomínio]
  URL da plataforma nos CTAs: https://vitfix.io/pt/
  Guarda em /content/blog/[endereço-do-artigo].md
```

### Páginas locais em série
```
Lê o CLAUDE.md e o ficheiro keywords/keywords-master-PT.csv.
ANTES DE CRIAR:
  1. Lista os ficheiros em /content/local/
  2. Para cada cidade, confirma que não existe já uma página para esse serviço + cidade
  3. Salta as combinações que já existem
PARA AS QUE NÃO EXISTEM → cria a página:
  Modelo: templates/service-page-template.md
  Tipo de serviço: [TIPO DE SERVIÇO]
  Ordem de prioridade: (1) Marco de Canaveses, Penafiel, Amarante, Paredes, Lousada, Felgueiras (zero concorrência) → (2) Porto, Rio Tinto, Gondomar, Gaia, Matosinhos, Maia, Valongo → (3) Espinho, Santa Maria da Feira, Trofa, Santo Tirso, Póvoa de Varzim, Vila do Conde
  URL da plataforma nos CTAs: https://vitfix.io/pt/
  Guarda em /content/local/[cidade]-[servico].md
```

### Guias de preços
```
Lê o CLAUDE.md e o ficheiro templates/price-guide-template.md.
ANTES DE CRIAR:
  1. Verifica se já existe /content/blog/quanto-custa-[servico]-portugal.md
  2. Verifica se o serviço já está coberto noutro guia de preços existente
  3. Se existir → expande o existente com mais detalhe
SE NÃO EXISTIR → cria o guia:
  Serviço: [SERVIÇO]
  Inclui preços médios em Portugal (norte), fatores que influenciam o custo,
  comparação Porto vs Marco de Canaveses vs Penafiel, e perguntas frequentes.
  URL da plataforma nos CTAs: https://vitfix.io/pt/
  Guarda em /content/blog/quanto-custa-[servico]-portugal.md
```

### Pesquisa de conteúdos da concorrência (versão completa)
```
Lê o CLAUDE.md e o ficheiro /reports/conteudo-existente.md.
Usa o Claude in Chrome para analisar os conteúdos de:
  B2C (principais ameaças):
  - fixando.pt
  - habitissimo.pt
  - zaask.pt
  - oscar.pt
  B2B (gestão condomínios):
  - portalpro.pt
  - gecond.com
  - flexdomus.pt

Para cada site:
  1. Lista os artigos e páginas de conteúdo publicados
  2. Identifica as palavras-chave que usam
  3. Verifica se têm conteúdo para Marco de Canaveses, Penafiel, Amarante
     (muito provável que não — confirma e regista)

Cruza com /reports/conteudo-existente.md — não sugerir temas já cobertos.
Ordena os gaps por: (1) zonas locais sem concorrência, (2) guias de preços em falta,
(3) segmento condomínios não explorado.
Guarda em /keywords/competitor-content-gaps.md
```

---

## 📌 Notas Importantes — Contexto Português

- **Legislação PT:** Referir sempre a legislação portuguesa — Código Civil (artigos 1420.º a 1438.º para condomínios), Decreto-Lei 268/94, Portal da Habitação
- **Sazonalidade norte de Portugal:** No Tâmega e Sousa e Grande Porto, o período mais ativo para obras é primavera (março-junho) e outono (setembro-novembro) — evitar julho/agosto e dezembro/janeiro nos temas de conteúdo sazonal
- **Telemóvel em primeiro lugar:** A grande maioria das pesquisas em Portugal é feita no telemóvel — o conteúdo deve ser rápido, legível e com chamadas para ação visíveis
- **Pesquisas por voz:** Em crescimento em Portugal — incluir sempre secção de perguntas frequentes em linguagem natural
- **Digitalização em curso:** Portugal está a recuperar atraso face a França neste setor — o conteúdo educativo tem mais peso do que em França

---

*Última atualização: 18 março 2026*
*Mercado: Portugal 🇵🇹*
*Plataforma: Vitfix.io — https://vitfix.io/pt/ (domínio: vitfix.io, NUNCA vitfix.pt)*
*URL provisório: https://fixit-production.vercel.app/*
*Para o mercado francês, consultar CLAUDE-FR.md*
*Rotas PT implementadas: /pt/servicos/, /pt/blog/, /pt/cidade/, /pt/urgencia/*
*GEO: llms.txt + robots.ts com crawlers IA autorizados*
*Serviços: 14 | Cidades: 12 | ~350+ páginas estáticas geradas ao build*
