# Prompt — Scraping Profissionais Construção Portugal
# Para executar em Claude Code com extensão web (Claude in Chrome)
# Versão 2.0 — 18 março 2026
# ZERO ERROS PERMITIDOS — cada registo importado deve ser um profissional real

---

Lê o CLAUDE.md, MEMORY.md e product/bugs.md antes de começar.

O scraping anterior de profissionais em Portugal falhou.
Recolheu lojas de materiais em vez de profissionais de construção.
Esta versão corrige esse problema com regras de filtragem rigorosas.

---

## OBJECTIVO

Popular a base de dados `profiles_artisan` com profissionais
**individuais ou empresas que EXECUTAM obras** —
NÃO distribuidores, NÃO lojas, NÃO armazéns, NÃO fabricantes.

**Resultado esperado:** ~2.000-4.000 profissionais verificáveis, distribuídos
pelas 16 profissões e 12 cidades definidas abaixo.

---

## ZONAS GEOGRÁFICAS — ordem ESTRITA de execução

Processar cada zona por completo (todas as profissões) antes de avançar para a seguinte.

```
PRIORIDADE 1 — Tâmega e Sousa (zero concorrência digital)
  1. Marco de Canaveses    (pop. 53 450)
  2. Penafiel              (pop. 72 265)
  3. Amarante              (pop. 56 264)
  4. Paredes               (pop. 86 854)
  5. Lousada               (pop. 47 387)
  6. Felgueiras            (pop. 58 065)
  7. Baião                 (pop. 20 522)
  8. Paços de Ferreira     (pop. 56 340)

PRIORIDADE 2 — AMP núcleo (volume alto)
  9.  Porto                (pop. 231 800) — pesquisar por freguesia: Bonfim, Campanhã, Paranhos, Ramalde, Aldoar, Cedofeita
  10. Vila Nova de Gaia    (pop. 302 295)
  11. Maia                 (pop. 135 306)
  12. Braga                (pop. 193 333)

PRIORIDADE 3 — AMP complementar (ajouter a la BD existante)
  13. Gondomar + Rio Tinto
  14. Matosinhos
  15. Valongo
  16. Castelo de Paiva

PRIORIDADE 4 — AMP periférica (só se temps disponível)
  17. Espinho
  18. Trofa
  19. Santo Tirso
  20. Vila do Conde
  21. Póvoa de Varzim
  22. Santa Maria da Feira
  23. Oliveira de Azeméis
```

---

## 16 PROFISSÕES A RECOLHER — lista EXACTA e COMPLÈTE

Cada profissão correspond exactement a um slug du site vitfix.io.
Utiliser ces termes de recherche pour chaque profissão.

```
SLUG VITFIX             | PROFISSÃO                    | TERMOS DE PESQUISA (usar TODOS)
========================|==============================|==========================================
eletricista             | Eletricista                  | eletricista, técnico eletricidade, instalações elétricas, DGEG
canalizador             | Canalizador                  | canalizador, picheleiro, canalização, fugas água
pintor                  | Pintor                       | pintor construção civil, pintor obras, pintura interior exterior
pladur                  | Pladur e Tetos Falsos        | pladur, gesso cartonado, tetos falsos, divisórias
obras-remodelacao       | Obras e Remodelação          | empreiteiro, remodelação, renovação, construção civil, obras
isolamento-termico      | Isolamento Térmico e Capoto  | isolamento térmico, capoto, ETICS, eficiência energética
impermeabilizacao       | Impermeabilização            | impermeabilização, infiltrações, humidade, terraços
desentupimento          | Desentupimento               | desentupimento, desobstrução, esgotos, fossas
faz-tudo                | Faz Tudo                     | faz tudo, bricolage, pequenas reparações, manutenção
serralheiro             | Serralheiro                  | serralheiro, serralharia, gradeamentos, portões, estruturas metálicas
telhador                | Telhado e Cobertura          | telhados, coberturas, telhas, reparação telhado, caleiras
vidraceiro              | Vidraceiro                   | vidraceiro, vidros, espelhos, montras, caixilharia alumínio
azulejador              | Azulejador e Ladrilhador     | azulejador, ladrilhador, azulejos, pavimentos, cerâmica
pedreiro                | Pedreiro e Alvenaria         | pedreiro, alvenaria, muros, pedra, construção muros
ar-condicionado         | Ar Condicionado              | ar condicionado, climatização, AVAC, instalação AC
carpinteiro             | Carpinteiro                  | carpinteiro, marceneiro, carpintaria, madeira, mobiliário
```

### Termos regionais OBRIGATÓRIOS (Norte de Portugal)
```
canalizador → pesquisar TAMBÉM "picheleiro" (termo regional Norte PT)
carpinteiro → pesquisar TAMBÉM "marceneiro" (termo regional)
empreiteiro → pesquisar TAMBÉM "construtor civil" e "mestre de obras"
pedreiro    → pesquisar TAMBÉM "pedreiro trolha" (termo informal mas usado)
```

### Correspondência categories[] para a BD
Cada profissional peut avoir PLUSIEURS catégories. Mapper ainsi :
```
- Se faz obras gerais → categories: ['obras-remodelacao']
- Se é canalizador + desentupimento → categories: ['canalizador', 'desentupimento']
- Se é empreiteiro + pladur → categories: ['obras-remodelacao', 'pladur']
- Se faz pintura + impermeabilização → categories: ['pintor', 'impermeabilizacao']
- TOUJOURS utiliser les slugs exactos listés ci-dessus
```

---

## FONTES A USAR — par ordre de fiabilité

### FONTE 1 — Páginas Amarelas (paginasamarelas.pt) ⭐⭐⭐⭐⭐
```
URL: https://www.paginasamarelas.pt/pesquisa?q=[profissão]&where=[cidade]
Données: nome, morada, telefone, NIF (parfois), site web
Qualité: EXCELLENTE — listing profissional vérifié
Méthode: Claude in Chrome → naviguer vers l'URL → extraire chaque résultat
```

### FONTE 2 — Google Maps (recherche directe) ⭐⭐⭐⭐
```
Query: "[profissão] [cidade] Portugal"
Méthode: Claude in Chrome → google.com/maps → rechercher → extraire fiches
Filtres: ignorer catégories "Loja", "Armazém", "Material de construção"
Données: nome, morada, telefone, avaliação Google, horário, site
ATTENTION: Google Maps mélange lojas et profissionais — filtrer rigoureusement
```

### FONTE 3 — Zaask (zaask.pt) ⭐⭐⭐⭐
```
URL: https://www.zaask.pt/[profissao]/[distrito-porto]/[cidade]
Données: nome, avaliações, descrição, localização, especialidades
Qualité: BONNE — profissionais actifs sur la plateforme
```

### FONTE 4 — Fixando (fixando.pt) ⭐⭐⭐⭐
```
URL: https://fixando.pt/[profissao]/[cidade]
Données: nome, avaliação, anos experiência, tipos de trabalho
Qualité: BONNE — profissionais vérifiés
```

### FONTE 5 — Habitissimo (habitissimo.pt) ⭐⭐⭐
```
URL: https://www.habitissimo.pt/profissionais/[profissao]/[cidade]
Données: nome, especialidades, avaliações
Qualité: MOYENNE — moins de profissionais PT
```

### FONTE 6 — OLX Portugal (olx.pt) ⭐⭐
```
UNIQUEMENT si les sources précédentes donnent < 3 résultats pour une combinaison
Qualité: FAIBLE — beaucoup d'annonces expirées, données incomplètes
```

### Règle de progression entre sources
```
Pour chaque [profissão × cidade]:
  1. Chercher dans FONTE 1 (Páginas Amarelas)
  2. Chercher dans FONTE 2 (Google Maps)
  3. Dédupliquer les résultats des 2 sources
  4. Si total < 5 résultats valides → chercher aussi FONTE 3 et 4
  5. Si total < 3 résultats valides → chercher FONTE 5
  6. FONTE 6 en dernier recours uniquement
  7. JAMAIS avancer à la ville suivante avant d'avoir traité toutes les professions de la ville en cours
```

---

## REGRAS DE FILTRAGEM — TOLÉRANCE ZÉRO

### ✅ INCLUIR — le profissional DOIT avoir AU MINIMUM 3 de ces signaux :

```
□ Descrição menciona: obras, remodelação, instalação, reparação,
  construção, serviço ao domicílio, orçamento, intervenção,
  manutenção, reabilitação, montagem, substituição
□ Tem telefone de contacto (telemóvel 9XX = forte sinal de profissional individuel)
□ Tem morada no distrito do Porto, Braga ou concelhos Tâmega e Sousa
□ Tem avaliações de clientes sobre trabalhos realizados
□ Nome contém: "obras", "serviços", "remodelações", "construções",
  "instalações", [nome próprio + profissão], "lda", "unipessoal",
  "reparações", "manutenção"
□ CAE/actividade declarada: secção F (construção) da CAE rev.3
  Códigos válidos: 41.xxx, 42.xxx, 43.xxx
□ Fotos de trabalhos realizados (chantiers, avant/après)
□ Horário de funcionamento type "seg-sex 8h-18h" (pas "seg-sab 9h-21h" = loja)
```

### ❌ EXCLUIR — rejeitar IMEDIATAMENTE si UN SEUL de ces signaux :

```
LOJAS ET DISTRIBUIDORES (erreur principale du scraping précédent):
- Nome contém: "materiais", "armazém", "depósito", "loja", "store",
  "shop", "comércio", "distribuição", "grossista", "revendedor",
  "fornecedor", "centro", "market", "mega", "super", "cash"
- Descrição menciona: "venda", "stock", "catálogo", "encomenda",
  "entrega ao domicílio", "loja física", "showroom", "exposição",
  "tabela de preços de produtos", "disponível em loja"
- Présence de prix de produits listés (€/unité, €/m², €/saco)
- URL de la source contient: /produtos/, /catalogo/, /loja/, /shop/
- Horário type commerce: "seg-sab 9h-20h" ou "dom aberto"

ENSEIGNES NATIONALES/INTERNATIONALES (JAMAIS inclure):
- Leroy Merlin, AKI, Bricomarché, Maxmat, Mr. Bricolage,
  Brico Dépôt, Castorama, OBI, Bauhaus, IKEA, Worten,
  Staples, Wurth, Hilti, Drogaria, Tintas CIN (showrooms)
- Qualquer nome terminant en: "Center", "Store", "Market",
  "Depot", "Warehouse", "Cash & Carry"

AUTRES EXCLUSIONS:
- Fabricantes (produzem mas NÃO instalam — ex: fábricas de alumínio)
- Arquitectos et engenheiros (consultoria, sem execução directa)
- Empresas de aluguer de equipamentos (andaimes, gruas, etc.)
- Escolas e centros de formação profissional
- Associações, sindicatos, ordens profissionais
- Agências de emprego temporário do sector
- Imobiliárias (même si font obras de valorisation)
- Empresas de limpeza (sauf si aussi manutenção)
- Perfis sem telefone E sem morada (dados insuficientes)
- Perfis claramente duplicados (mesmo NIF ou mesmo telefone)
- Profissionais basés hors du district de Porto/Braga/Tâmega
- Résultats en portugais du Brésil (entreprises BR listées au PT)
```

### ⚠️ CAS LIMITES — décision à prendre
```
- Empresa que vend ET installe → INCLURE si la description mentionne
  "instalação", "montagem" ou "serviço" — mettre note: "vente+installation"
- Empresa de nettoyage qui fait aussi manutenção → INCLURE uniquement
  si manutenção est mentionné explicitement
- Profissional sans site web ni email → INCLURE si score ≥ 3
- Profissional avec adresse dans une zone limitrophe → INCLURE si
  la zone est adjacente aux zones prioritaires
```

---

## ESTRUTURA DE DADOS — champs à collecter

```typescript
interface ScrapedProfissional {
  // ═══ OBRIGATÓRIOS — rejeitar si absent ═══
  company_name: string;          // Nome da empresa ou profissional
  phone: string;                 // Format: +351XXXXXXXXX (9 chiffres après +351)
  city: string;                  // Concelho (ex: "Marco de Canaveses")
  categories: string[];          // Slugs EXACTOS: ['canalizador', 'desentupimento']
  country: 'PT';
  language: 'pt';
  source_name: string;           // 'paginasamarelas' | 'google_maps' | 'zaask' | 'fixando' | 'habitissimo' | 'olx'
  source_url: string;            // URL exacte où le profissional a été trouvé

  // ═══ RECOLHER SI DISPONIBLE ═══
  company_address: string;       // Morada completa
  email: string;                 // Si public
  nif: string;                   // NIF/NIPC (9 chiffres)
  website: string;               // URL du site
  rating_avg: number;            // Avaliação média (0.0-5.0)
  rating_count: number;          // Número de avaliações
  bio: string;                   // Descrição (max 500 chars, couper si plus long)
  specialites: string[];         // Especialidades spécifiques
  freguesia: string;             // Freguesia si connue (utile pour Porto, Gaia)

  // ═══ CALCULÉ AUTOMATIQUEMENT ═══
  quality_score: number;         // 0-5 (voir grille ci-dessous)
  duplicado_suspeito: boolean;   // true si ressemble à un doublon
  motivo_rejeicao: string | null; // Si rejeté, pourquoi

  // ═══ NE PAS REMPLIR — défaut ═══
  profile_photo_url: null;
  rc_pro_url: null;
  active: false;                 // TOUJOURS false — activation manuelle uniquement
  verified: false;               // TOUJOURS false — vérification manuelle uniquement
}
```

### Validation du téléphone
```
Format valide: +351 9XX XXX XXX (telemóvel) ou +351 2XX XXX XXX (fixe)
- Telemóvel (9XX): forte probabilité profissional individuel ✅
- Fixe (2XX): peut être entreprise ou loja — vérifier plus attentivement
- Numéro non-PT: REJETER
- Numéro à 8 chiffres ou moins: REJETER
- Si le même numéro apparaît pour 5+ profils différents → c'est une plateforme/intermédiaire → REJETER TOUS
```

### Validation du NIF
```
Format valide: 9 chiffres, commence par 1, 2, 5, 6, 8 ou 9
- NIF commençant par 5: empresa (Lda, SA) → vérifier que c'est bien un prestataire
- NIF commençant par 1 ou 2: pessoa singular → profissional individuel ✅
- NIF = 999999990: consumidor final → IGNORER ce champ
- Même NIF que un autre profil déjà collecté → DOUBLON → garder le plus complet
```

---

## GRILLE DE QUALITÉ — score 0 à 5

```
+1 point : tem telefone validé (format correct)
+1 point : tem morada completa (rua + código postal + cidade)
+1 point : tem avaliações (rating_count > 0)
+1 point : tem bio avec plus de 50 caractères pertinents
+1 point : tem email OU website fonctionnel

DÉCISION:
  score 0-1 → REJETER automatiquement
  score 2-3 → IMPORTER avec flag review_needed: true
  score 4-5 → IMPORTER directement
```

---

## PROCESSUS D'EXÉCUTION — pas à pas

### Phase 0 — Préparation
```
1. Lê CLAUDE.md, MEMORY.md, product/bugs.md
2. Vérifie la connexion aux sources (Páginas Amarelas, Google Maps accessibles)
3. Créer le fichier de résultats: /reports/scraping-artisans-PT-[YYYY-MM-DD].md
4. Initialiser les compteurs: total_scrapé, total_rejeté, total_importé, total_doublon
```

### Phase 1 — Scraping ville par ville
```
POUR CHAQUE ville (dans l'ordre de priorité strict):
  POUR CHAQUE profissão (dans l'ordre de la liste des 16):
    1. Construire les URLs de recherche pour chaque source
    2. Naviguer vers FONTE 1 (Páginas Amarelas) via Claude in Chrome
    3. Extraire TOUS les résultats de la page (scroll si nécessaire)
    4. Pour chaque résultat:
       a. Appliquer les filtres ❌ EXCLUIR → si match → rejeter + log motif
       b. Appliquer les filtres ✅ INCLUIR → compter les signaux
       c. Si ≥ 3 signaux positifs → collecter toutes les données
       d. Calculer quality_score
       e. Ajouter au tableau de résultats
    5. Naviguer vers FONTE 2 (Google Maps)
    6. Répéter étapes 3-4
    7. Dédupliquer entre sources (même téléphone ou même NIF)
    8. Si total < 5 pour cette combinaison → sources 3-4-5
    9. Logger le résultat: "[ville] × [profissão]: X trouvés, Y rejetés, Z importés"
  FIN profissão
  10. Générer sous-total pour la ville
  11. Mettre à jour MEMORY.md
FIN ville
```

### Phase 2 — Déduplication globale
```
Après TOUTES les villes traitées:
1. Trier tous les résultats par téléphone
2. Identifier les doublons (même phone ou même NIF)
3. Pour chaque groupe de doublons:
   - Garder celui avec le score le plus élevé
   - Si scores égaux → garder celui avec le plus de données
   - Marquer les autres comme duplicado_suspeito: true
4. Logger: "Déduplication: X doublons trouvés sur Y total"
```

### Phase 3 — Validation finale
```
1. Vérifier qu'aucun résultat n'a categories: []  (vide)
2. Vérifier que tous les slugs de categories sont dans la liste des 16
3. Vérifier le format de tous les téléphones
4. Vérifier qu'aucun NIF n'est dupliqué dans les résultats finaux
5. Compter: total par ville × profissão
6. Alerter si une combinaison a 0 résultats
```

### Phase 4 — Import
```
1. Générer le script d'import basé sur scripts/import-artisans-porto.mjs
2. Chaque batch: maximum 50 profissionais à la fois
3. Vérifier après chaque batch que l'insertion Supabase a réussi
4. Si erreur → stopper, logger, ne pas continuer
5. Tous les registos: active: false, verified: false
6. Générer le rapport final
```

---

## VOLUME ESPÉRÉ PAR ZONE

```
ZONE                    | PAR PROFISSÃO | TOTAL ESTIMÉ
========================|===============|=============
Marco de Canaveses      | 10-30         | 160-480
Penafiel                | 15-40         | 240-640
Amarante                | 10-30         | 160-480
Paredes                 | 15-40         | 240-640
Lousada                 | 8-20          | 128-320
Felgueiras              | 10-25         | 160-400
Baião                   | 5-15          | 80-240
Paços de Ferreira       | 10-25         | 160-400
Porto                   | 50-150        | 800-2400
Vila Nova de Gaia       | 40-120        | 640-1920
Maia                    | 20-60         | 320-960
Braga                   | 30-100        | 480-1600

TOTAL ESTIMÉ GLOBAL: 3.500-10.500 profissionais
(après déduplication et filtrage: ~2.000-4.000 résultats valides)
```

Si < minimum pour une combinaison → chercher sources additionnelles.
Si > maximum → appliquer score minimum 4 (au lieu de 2).

---

## RAPPORT FINAL — OBLIGATOIRE

Après le scraping complet, générer `/reports/scraping-artisans-PT-[YYYY-MM-DD].md` :

```markdown
## Relatório de Scraping — Profissionais Construção PT — [data]

### Resumo Global
- Total bruto recolhido: X
- Total rejeitado (filtros): X (Y%)
- Total doublons eliminados: X
- Total importado (score ≥ 4): X
- Total para revisão manual (score 2-3): X
- Total rejeité (score 0-1): X

### Por zona × profissão
| Zona | eletricista | canalizador | pintor | pladur | obras | isolamento | impermeab. | desentup. | faz-tudo | serralheiro | telhador | vidraceiro | azulejador | pedreiro | AC | carpinteiro | TOTAL |
|------|-------------|-------------|--------|--------|-------|------------|------------|-----------|----------|-------------|----------|------------|------------|----------|-----|-------------|-------|
| Marco de Canaveses | | | | | | | | | | | | | | | | | |
| Penafiel | | | | | | | | | | | | | | | | | |
| Amarante | | | | | | | | | | | | | | | | | |
| ... | | | | | | | | | | | | | | | | | |

### Par source
| Source | Total trouvé | Rejeté | Importé | Taux de conversion |
|--------|-------------|--------|---------|-------------------|
| Páginas Amarelas | | | | |
| Google Maps | | | | |
| Zaask | | | | |
| Fixando | | | | |
| Habitissimo | | | | |
| OLX | | | | |

### Top 5 motivos de rejeição
1. [motivo] — X ocorrências
2. ...

### Exemples de registos REJETÉS (les 10 plus fréquents)
| Nome | Cidade | Motivo |
|------|--------|--------|
| ... | ... | Loja de materiais |

### Exemples de registos IMPORTÉS (10 meilleurs scores)
| Nome | Profissão | Cidade | Score | Source |
|------|-----------|--------|-------|--------|
| ... | ... | ... | 5 | paginasamarelas |

### Problemas encontrados
- [lista de problèmes, sources inaccessibles, zones sans résultats]

### Combinações com 0 resultados (ALERTA)
- [liste des profissão × cidade sans aucun résultat — à traiter manuellement]
```

---

## RÈGLES ABSOLUES — NON NÉGOCIABLES

```
1.  JAMAIS importer une loja de materiais — c'est l'erreur #1 à éviter
2.  JAMAIS importer sans générer le rapport
3.  JAMAIS activer les registos (active: false OBLIGATOIRE)
4.  JAMAIS avancer à la ville suivante sans finir toutes les profissões de la ville en cours
5.  JAMAIS utiliser un slug de catégorie qui n'est pas dans la liste des 16
6.  JAMAIS insérer directement en BD sans passer par le script d'import
7.  TOUJOURS dédupliquer avant import (même téléphone = même profissional)
8.  TOUJOURS logger chaque rejet avec le motif
9.  TOUJOURS mettre à jour MEMORY.md après chaque ville complétée
10. EN CAS DE DOUTE sur un registo → REJETER et mentionner dans le rapport
11. Si une source est inaccessible → passer à la suivante, NE PAS abandonner
12. Si le scraping est interrompu → sauvegarder l'état et reprendre où on s'est arrêté
```

---

*Prompt v2.0 — Claude Code + Claude in Chrome — Vitfix.io*
*16 profissões × 12+ cidades = ~192 combinaisons à traiter*
*Correction bug v1: filtrage strict anti-lojas*
*18 mars 2026*
