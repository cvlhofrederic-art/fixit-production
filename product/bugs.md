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

### 🟠 Número de telefone placeholder no schema FR
**Descrição:** O schema markup da versão francesa tem o número +33600000000 como placeholder
**Impacto:** Schema inválido pode afetar rich results no Google FR
**Ficheiro:** layout.tsx (schema do lado FR)
**Resolução:** Substituir pelo número real da Vitfix.io França
**Descoberto:** Março 2026

---

### 🟡 Menu de navegação com mistura PT/FR
**Descrição:** Alguns itens do menu aparecem em francês na versão portuguesa
**Impacto:** Má experiência para utilizadores PT, possível penalização SEO
**Ficheiro:** A identificar
**Resolução:** Verificar todos os componentes de navegação e separar as traduções
**Descoberto:** Março 2026

---

### 🟡 URL da homepage PT inconsistente
**Descrição:** A homepage redireciona para /pt sem o trailing slash em alguns casos
**Impacto:** Possível conteúdo duplicado para o Google (/pt vs /pt/)
**Ficheiro:** next.config.js ou middleware
**Resolução:** Forçar canonical com trailing slash em todas as páginas PT
**Descoberto:** Março 2026

---

## Bugs resolvidos ✅

*(Mover bugs resolvidos para aqui com a data de resolução)*

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

*Última atualização: Março 2026*
