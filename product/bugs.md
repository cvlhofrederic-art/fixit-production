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

### 🟡 Dialogues natifs `window.prompt()` / `window.confirm()` à remplacer
**Descrição:** Anti-pattern UX 2026 + bloquant pour automation/tests/MCP. Les dialogues natifs JS gèlent le thread, sont non stylables, non accessibles et impossibles à interagir via Playwright/MCP.

**Inventaire** (audit 3 mai 2026) :

`prompt()` natif — **3 occurrences restantes** (1 corrigée dans PR du 3/5) :
- `components/pro-mobile/pages/MobileDocumentsSection.tsx:557` — sélection chantier (UX critique mobile)
- `components/syndic-dashboard/financial/FacturationPageWithTransferts.tsx:195` — raison de refus
- `components/syndic-dashboard/legal/SeguroCondominioSection.tsx:490` — valeur indemnité

`confirm()` natif — **~20 occurrences** dans :
- `DevisFactureForm.tsx:1842` (convert devis)
- `DevisSection.tsx:297, 497` (suppression devis)
- `FacturesSection.tsx:239, 433` (suppression facture)
- `ClientsSection.tsx:288` (suppression client)
- `EquipesBTPV2.tsx:234, 257` (suppression membre/équipe)
- `CompteUtilisateursSection.tsx:191`
- `CalendarSection.tsx:706`
- `RapportsSection.tsx:537`
- `PhotosChantierSection.tsx:149`
- 8 autres dans `syndic-dashboard/`

**Solution proposée:** Créer un composant `<Dialog>` réutilisable (avec `prompt`/`confirm` modes) à mettre dans `components/ui/Dialog.tsx`, puis remplacer chaque appel natif. Pattern existe déjà partiellement dans `DevisFactureFormBTP.tsx` (classe CSS `dvbtp-modal-ov`).

**Estimativa:** 3-4h pour tout migrer (1h composant + 30min/fichier).

**Origem:** Découvert lors du test MCP du formulaire BTP — `prompt()` ligne 2386 de DevisFactureFormBTP.tsx bloquait l'automation.
**Descoberto:** 3 mai 2026 | **Resolvido:** ⏳ partiel (1/24)

---

### 🟠 Violations WCAG 2.1 AA — conformidade EAA 2025
**Descrição:** Axe-core (workflow `tests.yml`) reporta 2 tipos de violações *serious* em 8 páginas públicas após PR #87 (rapport idêntico em PRs anteriores → dette pré-existante, não introduzida pela PR PDF).

**Violations détectées:**
1. **`color-contrast` (serious)** — ~430 elementos no total. Ratio texto/fundo abaixo de WCAG AA (4.5:1 normal, 3:1 grande). Páginas afetadas: `/`, `/fr/`, `/pt/`, `/fr/services/`, `/pt/servicos/`, `/contact/`, `/auth/login/`, `/pro/register/`. Pior caso: `/pro/register/` com 325 elementos.
2. **`link-in-text-block` (serious)** — 6 elementos. Links em parágrafos distinguidos *apenas pela cor* (sem `text-decoration: underline`). Páginas afetadas: `/`, `/fr/`, `/pt/`.

**Impacto:**
- Acessibilidade: utilizadores com deficiência visual / daltonismo não conseguem ler ou identificar links
- Legal: **European Accessibility Act (EAA)** em vigor desde 28 jun 2025, aplica-se a Vitfix.io (B2C/B2B). Sanção potencial: multa administrativa + obrigação de remediação. Enforcement em França ainda baixo, mas risco real.

**Solução proposta:**
- Auditar pares de cores no `tailwind.config.ts` / tokens CSS, escurecer `text-text-muted` e variantes (~10 pares problemáticos)
- Adicionar `underline` aos links em blocos de texto (componentes `<p><a>...</a></p>`)
- Re-rodar Axe-core após fix para verificar zero serious

**Estimativa:** 1-2h de trabalho focado. Mudanças visuais subtis (textos um pouco mais escuros).

**Origem do report:** GitHub Actions email PR #87 (3 mai 2026), workflow `tests.yml` Axe-core (`wcag2a + wcag2aa + wcag21aa`).
**Descoberto:** 3 mai 2026 | **Resolvido:** ⏳ pendente

---

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
