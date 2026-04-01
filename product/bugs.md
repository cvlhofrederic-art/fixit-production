# bugs.md — Vitfix.io
# Registo de bugs conhecidos e estado de resolução

> Atualizar este ficheiro sempre que um bug for descoberto ou resolvido.
> O Claude Code lê este ficheiro para saber o que está partido
> antes de trabalhar no código.

---

## Como usar este ficheiro

- **🔴 Crítico** — quebra funcionalidade principal, resolver imediatamente
- **🟠 Alto** — afeta experiência do utilizador, resolver esta semana
- **🟡 Médio** — incómodo mas não bloqueia, resolver este mês
- **🟢 Baixo** — cosmético ou menor, resolver quando houver tempo
- **✅ Resolvido** — concluído, manter registo por 30 dias

---

## Bugs ativos

### 🟡 URL da homepage PT inconsistente
**Descrição:** A homepage redireciona para /pt sem o trailing slash em alguns casos
**Impacto:** Possível conteúdo duplicado para o Google (/pt vs /pt/)
**Ficheiro:** next.config.ts (`trailingSlash: true` já ativo), canonical tags corretas em cada layout PT
**Resolução:** `trailingSlash: true` já está configurado e os canonicals nos layouts PT estão corretos. Monitorizar no Google Search Console após launch para confirmar.
**Descoberto:** Março 2026

---

## Bugs resolvidos ✅

### ✅ Número de telefone placeholder no schema FR
**Descrição:** O schema markup da versão francesa tinha o número +33600000000 como placeholder
**Impacto:** Schema inválido poderia afetar rich results no Google FR
**Resolução:** `lib/constants.ts` — `PHONE_FR = '+33634468897'` (número real). Nunca chegou a ser deployado com o placeholder.
**Descoberto:** Março 2026 | **Resolvido:** Março 2026

---

### ✅ Menu de navegação com mistura PT/FR
**Descrição:** Utilizadores com cookie `locale=fr` a visitar páginas `/pt/` viam traduções francesas. O root layout (`app/layout.tsx`) lia o cookie da REQUEST, que podia estar desatualizado quando o middleware atualizava o locale na RESPONSE.
**Impacto:** Má experiência para utilizadores PT
**Resolução:** Middleware injeta header `x-locale` nos requestHeaders (derivado do prefixo da URL). Root layout lê este header em prioridade sobre o cookie. Default alterado de `'fr'` para `'pt'` (consistente com `DEFAULT_LOCALE` em `lib/i18n/config.ts`). Hreflang `x-default` corrigido para `https://vitfix.io/` em vez de `/fr/`.
**Ficheiros alterados:** `middleware.ts`, `app/layout.tsx`
**Descoberto:** Março 2026 | **Resolvido:** Abril 2026

---

## Como reportar um novo bug

Adiciona um bloco neste formato:

```
### 🔴/🟠/🟡/🟢 [Nome do bug]
**Descrição:** O que acontece
**Impacto:** O que isso quebra ou afeta
**Ficheiro:** Onde está o problema (se soubers)
**Resolução:** Como foi/será resolvido
**Descoberto:** Data
```

---

*Última atualização: Abril 2026*
