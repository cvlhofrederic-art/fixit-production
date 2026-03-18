# roadmap.md — Vitfix.io
# Mapa de produto, funcionalidades e prioridades de desenvolvimento

> Este ficheiro é lido pelo Claude Code no início de cada sessão.
> Contém o estado atual da plataforma, o que está em desenvolvimento
> e o que está planeado — para que o Claude Code nunca trabalhe 
> numa direção errada.

---

## Estado atual da plataforma

**Versão:** Beta / Produção
**URL provisório:** https://fixit-production.vercel.app/
**URL definitivo:** https://vitfix.io/pt/ (Portugal) | https://vitfix.io/fr/ (França)
**Stack técnica:** Next.js + Vercel
**Mercados ativos:** Portugal (PT) e França (FR)

---

## O que já está construído e funciona ✅

### Core da plataforma
- [ ] Homepage PT com apresentação da plataforma
- [ ] Homepage FR com apresentação da plataforma
- [ ] Sistema de registo de profissionais
- [ ] Sistema de login (profissional e cliente)
- [ ] Pesquisa de profissionais por categoria e localização
- [ ] Perfil de profissional com avaliações
- [ ] Sistema de reservas online
- [ ] Blog PT com 24+ artigos SEO publicados
- [ ] Páginas de serviço por categoria (canalização, eletricidade, pintura, etc.)
- [ ] Sitemap com 380+ páginas
- [ ] Estrutura SEO programática (serviço × cidade × especialidade)
- [ ] Schema markup em páginas de serviço
- [ ] Página de preços (Starter gratuito, Pro 49€/mês, Business personalizado)
- [ ] Página de avaliações
- [ ] Páginas legais (CGU, privacidade, aviso legal, cookies)
- [ ] Livro de Reclamações Eletrónico (PT)
- [ ] Integração WhatsApp para contacto

### Espaço profissional
- [ ] Dashboard do profissional
- [ ] Agenda online com horários disponíveis
- [ ] Geração de orçamentos e faturas PDF
- [ ] Proof of Work (fotos antes/depois + assinatura geolocalizada)
- [ ] Contabilidade IA com declarações de IVA automatizadas
- [ ] Aplicação móvel iOS & Android

---

## Em desenvolvimento 🔄

*(Preencher com o que está atualmente em desenvolvimento)*

- [ ] Comando vocal para criação de orçamentos
- [ ] Marketplace de materiais e ferramentas com comparação de preços por geolocalização
- [ ] Wallet de conformidade (documentação verificada no perfil)
- [ ] Módulo de análise de orçamentos para clientes
- [ ] Módulo de estimação de preço de obras
- [ ] Marketplace B2B para gestores de condomínio
- [ ] Bolsa de trabalhos (profissionais fazem propostas a projetos publicados)

---

## Planeado — Próximas funcionalidades 📋

### Prioridade Alta
1. **Páginas locais SEO** — criar páginas para cada cidade/concelho das zonas de arranque (Marco de Canaveses, Penafiel, Amarante, Porto, Rio Tinto, Gondomar, Gaia, Matosinhos...)
2. **Página B2B condomínios** — landing page dedicada para gestores de condomínio
3. **Schema LocalBusiness** — adicionar a todas as páginas de cidade
4. **Google Search Console** — integrar e monitorizar posições

### Prioridade Média
5. **Assistente vocal** — interface de comando por voz para profissionais
6. **Comparador de materiais** — integração com lojas por geolocalização
7. **Sistema de notificações** — alertas por SMS e email automáticos
8. **Painel de análise para clientes** — comparação de orçamentos recebidos

### Prioridade Baixa / Futuro
9. **API pública** — para integrações externas (plano Business)
10. **Multi-profissionais** — gestão de equipas e agências
11. **Expansão geográfica** — novas zonas em PT e FR

---

## Decisões técnicas importantes

### O que NUNCA alterar sem discussão prévia
- A estrutura de URLs `/pt/` e `/fr/` — é fundamental para o SEO multilingue
- O sitemap — tem 380+ páginas indexadas, qualquer alteração pode afetar rankings
- As meta tags das páginas existentes — já indexadas pelo Google
- O schema markup existente — já a gerar rich results

### Padrões a seguir sempre
- **URLs:** sempre em minúsculas, separadas por hífens, em português para PT e francês para FR
- **Imagens:** sempre com atributo alt descritivo
- **Páginas novas:** sempre com H1, meta description, e schema markup adequado
- **Componentes:** reutilizar os existentes antes de criar novos

---

## Bugs conhecidos

*(Atualizar à medida que são descobertos e resolvidos)*

- [ ] Número de telefone placeholder +33600000000 no schema FR — substituir pelo número real
- [ ] Menu de navegação com mistura de PT e FR em alguns pontos
- [ ] *(adicionar outros bugs conhecidos aqui)*

---

## Contexto de negócio para o Claude Code

### Modelo de negócio
- **Freemium:** plano Starter gratuito (até 5 reservas/mês)
- **Pro:** 49€/mês — reservas ilimitadas + todas as ferramentas
- **Business:** preço personalizado — multi-profissionais + API

### Mercados
- **Portugal Fase 1:** Marco de Canaveses, Penafiel, Amarante, Porto e AMP
- **França:** mercado paralelo em desenvolvimento

### Prioridade máxima atual
O SEO local é a prioridade número 1 — criar páginas para as zonas de arranque em Portugal onde a concorrência digital é próxima de zero. Cada página criada pode posicionar no top 3 do Google em semanas.

---

## Como usar este ficheiro com o Claude Code

Quando deres uma instrução ao Claude Code, ele lê este ficheiro primeiro e:
- Sabe o que já existe — não recria o que já está feito
- Sabe o que está em desenvolvimento — não quebra trabalho em curso
- Sabe o que nunca alterar — protege o SEO e a estrutura existente
- Sabe a prioridade — foca no que tem mais impacto primeiro

### Exemplos de prompts que funcionam com este ficheiro:
```
"Cria a página local para empreiteiros em Marco de Canaveses"
"Adiciona schema LocalBusiness à página de canalização no Porto"  
"Verifica se há bugs no menu de navegação PT/FR"
"Implementa a próxima funcionalidade de alta prioridade do roadmap"
```

---

*Última atualização: Março 2026*
*Atualizar este ficheiro sempre que uma funcionalidade for concluída ou prioridades mudarem*
