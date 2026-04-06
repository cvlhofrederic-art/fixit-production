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

### ✅ URL da homepage PT inconsistente
**Descrição:** 6 páginas tinham canonical URLs sem trailing slash (`/pt`, `/fr`, `/simulateur`, etc.) enquanto `trailingSlash: true` estava ativo no next.config.ts — criando mismatch entre URL servido e canonical declarado.
**Impacto:** Conteúdo duplicado potencial para o Google
**Ficheiros corrigidos:** `app/pt/page.tsx`, `app/fr/page.tsx`, `app/simulateur/page.tsx`, `app/pt/pesquisar/page.tsx`, `app/pt/sobre/page.tsx`, `app/fr/mentions-legales/page.tsx`
**Resolução:** Trailing slash adicionado a todos os canonical URLs para corresponder ao `trailingSlash: true` do next.config.ts.
**Descoberto:** Março 2026 | **Resolvido:** Abril 2026

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
