# decisions.md — Vitfix.io
# Registo de decisões técnicas e de produto

> Este ficheiro evita que o Claude Code desfaça decisões já tomadas.
> Antes de propor uma alteração estrutural, o Claude Code lê este ficheiro.

---

## Decisões de arquitetura

### Estrutura de URLs multilingue
**Decisão:** `/pt/` para Portugal, `/fr/` para França
**Porquê:** SEO multilingue — o Google indexa cada versão separadamente
**Data:** 2026
**NUNCA alterar** — afetaria todos os URLs já indexados

---

### Framework: Next.js + Vercel
**Decisão:** Next.js com deployment na Vercel
**Porquê:** Performance, SSR para SEO, deployment simplificado
**Data:** 2026
**Implicação:** Novas páginas devem seguir o padrão Next.js existente

---

### Estratégia de SEO programático
**Decisão:** Sitemap com 380+ páginas geradas programaticamente (serviço × cidade)
**Porquê:** Escalar para todas as cidades PT e FR sem criar cada página manualmente
**Data:** 2026
**NUNCA alterar a estrutura do sitemap** sem avaliar impacto SEO

---

### Modelo de preços Freemium
**Decisão:** Starter gratuito (5 reservas) + Pro 49€/mês + Business personalizado
**Porquê:** Baixa barreira de entrada para profissionais, monetização pelo Pro
**Data:** 2026
**Qualquer alteração de preços** deve ser refletida em todas as páginas de preços PT e FR

---

### Schema markup
**Decisão:** Implementar LocalBusiness + Service + FAQPage em páginas de serviço
**Porquê:** Rich results no Google aumentam CTR
**Data:** 2026
**Sempre verificar** com Google Rich Results Test após alterações

---

### Língua do conteúdo
**Decisão:** Português europeu para PT, Francês para FR — nunca misturar
**Porquê:** SEO e credibilidade local
**Data:** 2026
**Sempre separar** os ficheiros de tradução — nunca reutilizar strings entre PT e FR

---

## Decisões de produto

### Verificação de profissionais
**Decisão:** Todos os profissionais devem ter seguro + registo de empresa verificados
**Porquê:** Diferenciação vs Fixando e Zaask — a confiança é o argumento principal
**Data:** 2026
**Nunca comprometer** este requisito para aumentar o número de profissionais

### Wallet de conformidade
**Decisão:** Documentação do profissional visível no perfil público
**Porquê:** O cliente precisa de ver os documentos antes de contratar
**Data:** 2026

### Proof of Work
**Decisão:** Fotos antes/depois + assinatura do cliente geolocalizada
**Porquê:** Proteção para ambos os lados — profissional e cliente
**Data:** 2026

---

## Como adicionar uma decisão

```
### [Nome da decisão]
**Decisão:** O que foi decidido
**Porquê:** A razão
**Data:** Quando foi decidido
**Implicação/Restrição:** O que isso implica para o código
```

---

*Última atualização: Março 2026*
