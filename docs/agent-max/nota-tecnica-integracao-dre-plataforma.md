# Nota técnica — Alimentar a base de conhecimento jurídica a partir de fontes oficiais

> Destinatário: equipa de desenvolvimento da plataforma SaaS.
> Objetivo: substituir o ficheiro estático copiado à mão por uma base que se atualiza a partir da fonte oficial, eliminando o risco de conteúdo obsoleto.
> Data: maio de 2026.

---

## 1. O problema a resolver

O ficheiro `regime-juridico-condominio-portugal-2026.md` é fiável **à data em que foi compilado**. Mas uma base de conhecimento jurídica estática tem três fragilidades estruturais:

1. **Obsolescência silenciosa** — uma lei muda e o ficheiro continua a afirmar o contrário, sem aviso.
2. **Verificação manual não escalável** — confrontar artigo a artigo com o Diário da República (DRE) é trabalho humano, repetível a cada alteração.
3. **Ausência de prova de vigência** — sem data e origem por artigo, não há valor probatório.

A solução profissional não é «copiar melhor», é **ligar a plataforma à fonte oficial** e tratar a lei como um *feed* e não como um documento.

---

## 2. Porque é que o `web_fetch` simples falha no DRE

O portal `diariodarepublica.pt` serve uma página que é **construída no navegador por JavaScript**. Um pedido HTTP simples (curl, fetch do lado do servidor, bibliotecas tipo `requests`) recebe uma casca de HTML sem o texto legal. É por isso que a extração simples devolve páginas vazias.

Há três formas de contornar isto, da mais robusta à mais frágil.

---

## 3. Opção A (recomendada) — Dados estruturados / ELI

O DRE publica os diplomas em formato **ELI** (*European Legislation Identifier*), um padrão europeu de identificação e estruturação de legislação. Os identificadores ELI são URL estáveis e previsíveis, e o portal disponibiliza representações estruturadas dos atos.

**Padrão do identificador ELI (exemplo):**
```
https://data.dre.pt/eli/dec-lei/268/1994/...
```

**Vantagens:**
- Identificador **estável** por diploma — não quebra quando o site muda de layout.
- Permite distinguir versão originária de versão consolidada.
- Pensado para consumo por máquina.

**Implementação sugerida:**
1. Para cada diploma do núcleo (Código Civil cap. VI, DL 268/94, DL 269/94, CPC, DL 93/2025, etc.), registar o identificador ELI numa tabela de referência da plataforma.
2. Um *job* periódico (ex.: diário ou semanal) consulta cada ELI e deteta se a versão consolidada mudou (data da última alteração / número de versão).
3. Se mudou: o sistema **assinala o diploma como "carece de revisão"** e notifica o administrador — não atualiza o texto automaticamente sem revisão humana.

> Nota importante: confirmar junto da documentação atual do DRE/INCM o formato exato de resposta (HTML estruturado, XML, JSON) e eventuais condições de uso. O padrão ELI é estável; os detalhes de servição podem evoluir, pelo que a integração deve isolar essa camada (ver secção 6).

---

## 4. Opção B — Exportação em PDF oficial

O DRE permite **descarregar a versão consolidada de cada diploma em PDF**. O PDF é texto fixo, extraível por bibliotecas correntes (`pdfplumber`, `pdfminer`, `PyMuPDF`).

**Fluxo:**
1. Descarregar o PDF consolidado de cada diploma a partir do respetivo URL no DRE.
2. Extrair o texto e segmentá-lo por artigo (expressão regular sobre `Artigo \d+\.º(?:-[A-Z])?`).
3. Comparar (*diff*) com a versão guardada na base.
4. Sinalizar divergências para revisão humana.

**Quando usar:** como mecanismo de verificação periódica e como prova arquivável (o PDF datado é evidência da vigência naquele momento). Menos elegante que o ELI, mas muito robusto.

---

## 5. Opção C — Navegador *headless*

Um navegador automatizado (Playwright, Puppeteer, Selenium) carrega a página, executa o JavaScript e devolve o DOM final, do qual se extrai o texto.

**Inconvenientes:** frágil (qualquer mudança de layout do portal parte o *scraper*), mais pesado, e sujeito às condições de uso do portal quanto a acesso automatizado. **Usar apenas se A e B não forem viáveis.** É, na prática, o que faz o agente «Claude para Chrome» — útil para verificações pontuais, não como infraestrutura permanente.

---

## 6. Arquitetura recomendada

```
┌─────────────────────┐     job periódico      ┌──────────────────────┐
│  Fonte oficial DRE   │ ◄───────────────────── │  Serviço de Sincroniz.│
│  (ELI / PDF)         │                        │  (isola a fonte)      │
└─────────────────────┘                        └──────────┬───────────┘
                                                           │ deteta alteração
                                                           ▼
                                              ┌────────────────────────┐
                                              │  Fila de revisão        │
                                              │  "diploma X mudou"      │
                                              └──────────┬─────────────┘
                                                         │ validação humana (jurista)
                                                         ▼
┌──────────────────────┐   indexação (RAG)   ┌────────────────────────┐
│  Agente de IA         │ ◄────────────────── │  Base de conhecimento   │
│  (responde a perguntas)│                    │  versionada por artigo  │
└──────────────────────┘                     └────────────────────────┘
```

**Princípios:**

- **A fonte é isolada numa só camada.** Se o DRE mudar de formato, altera-se um módulo, não toda a plataforma.
- **Atualização nunca é automática até ao fim.** O *job* deteta a mudança; um **jurista valida** antes de o novo texto entrar na base. A automatização serve para *detetar*, não para *decidir*.
- **Cada artigo é versionado** com: texto, diploma de origem, data da última alteração, data de verificação, e ligação ELI. É isto que dá valor probatório e permite ao agente de IA citar com rigor.
- **O agente de IA indica sempre a data de vigência** do artigo que cita e o respetivo estado de verificação.

---

## 7. Metadados mínimos por artigo

Para cada artigo guardado na base, registar:

| Campo | Exemplo |
|---|---|
| `diploma` | Código Civil |
| `artigo` | 1424.º |
| `texto` | (texto integral) |
| `eli` | identificador ELI do diploma |
| `ultima_alteracao` | 2022-01-10 (Lei n.º 8/2022) |
| `data_verificacao` | 2026-05-17 |
| `estado` | verificado / carece de revisão |
| `fonte_url` | URL da versão consolidada no DRE |

---

## 8. Plano de migração sugerido

1. **Curto prazo** — manter o ficheiro `regime-juridico-condominio-portugal-2026.md` como base inicial, depois de o jurista validar os artigos ainda assinalados `◆`.
2. **Médio prazo** — implementar a Opção A (ELI) como serviço de sincronização que apenas *deteta* alterações e abre tarefas de revisão.
3. **Verificação cruzada** — usar a Opção B (PDF) como segunda fonte e como arquivo probatório datado.
4. **Governação** — definir um responsável jurídico pela validação das alterações detetadas e um calendário de revisão (ex.: trimestral, ou imediato quando o *job* deteta mudança).

---

## 9. Limites honestos

- Nenhuma automatização dispensa a validação jurídica. O sistema deteta que «algo mudou»; só um jurista determina o que isso significa.
- As condições de uso do DRE/INCM quanto a acesso automatizado e reutilização de conteúdos devem ser confirmadas antes de pôr a sincronização em produção.
- A jurisprudência não tem um *feed* equivalente tão limpo; a sua atualização continuará a exigir pesquisa periódica em dgsi.pt / juris.stj.pt.

---

*Documento de orientação técnica. Não substitui a consulta da documentação atual do DRE/INCM nem o aconselhamento jurídico sobre reutilização de conteúdos oficiais.*
