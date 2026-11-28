# Phase 3 SEO PT : données réelles à fournir (et comment les extraire de la base)

Référence : `docs/seo/instructions-seo-pt-2026-10-13.md`, section « Phase 3 » (3.1 à 3.5). Règle 0.2 : aucune donnée inventée ; si une donnée manque, le bloc reste absent. Le code de la phase 3 (lot 0, PR `feat/seo-pt-phase-3-lot-0`) lit **un seul fichier**, `data/seo/local-proof.json`, et n'affiche un bloc sur une page `/pt/servicos/{metier}-{ville}/` que si la donnée existe pour ce couple. Tant que le fichier est vide, rien ne change sur les pages. Exemple de format complet : `data/seo/local-proof.example.json`.

## 1. Ce qu'il faut, par ordre d'importance

| Donnée | Minimum pour qu'un bloc s'affiche | Source possible | Ce que ce n'est pas |
|---|---|---|---|
| **Chantiers** (`chantiers[]`) | `cidade` (slug du concelho), `metier` (slug), `tipo` (ce qui a été fait), `mes` (`AAAA-MM`) ; `quantidade`, `freguesia`, `foto` optionnels ; jamais de nom de client sans `consentimento_nome: true` | réservations terminées, devis signés, factures, documents fiscaux PT | pas de photos obligatoires, pas de texte long |
| **Délais** (`prazos[]`) | `cidade`, `visita_dias` (délai réel de première visite), `fonte` (ex. « últimos 10 pedidos ») ; `intervencao_dias`, `metiers` optionnels | dates de création et de fin des réservations | pas une promesse (« 24h ») : une mesure |
| **Prix** (`precos[]`) | `metier`, `min`, `max`, `unite` (`m²`, `hora`, `unidade`…), `fonte` ; `exemplos[]` (mois, quantité, montant) optionnels | devis émis ; les fourchettes de `/pt/precos/` si elles sont réelles | pas de variation par ville inventée |
| **Méthode** (`metodos{}`) | un texte par métier (slug → texte de 10 à 20 lignes) : méthode, matériaux, normes, garanties réellement appliquées | rédigé ou dicté une fois par le propriétaire | pas un texte par ville ; pas généré |
| **Avis** (`avis[]`) | `cidade`, `nota` (1 à 5), `texto`, `mes`, `autorizacao: true` ; `metier`, `autor` optionnels | `booking_reviews` avec accord écrit du client | pas d'avis repris de Google Maps ou d'un autre site |

Slugs attendus : métiers et concelhos de `lib/seo/pt-grelha.ts` (ex. `canalizador`, `marco-de-canaveses`).

## 2. Requêtes à exécuter dans Supabase (SQL Editor, lecture seule)

Les tables et colonnes viennent des migrations du dépôt (`supabase/migrations/052_baseline_missing_tables.sql`, `040_portugal_fiscal.sql`, `038_audit_complete_fix.sql`). À adapter si la base de production diffère. Les résultats sont à relire avant d'entrer dans le fichier : une ligne de test (ex. l'artisan « Carlos Mendes Jardins ») n'est pas une donnée réelle.

### 2.1 Professionnels PT réellement actifs par concelho et métier

```sql
select coalesce(company_city, city) as concelho, unnest(categories) as metier, count(*) as profissionais
from profiles_artisan
where country = 'PT' and active = true
group by 1, 2
order by 1, 3 desc;
```

### 2.2 Chantiers : réservations terminées (la ville est dans l'adresse libre ou chez l'artisan)

```sql
select b.completed_at::date as fim, to_char(b.completed_at, 'YYYY-MM') as mes,
       coalesce(p.company_city, p.city) as concelho_artisan, b.address, b.price_ttc, b.service_id
from bookings b
join profiles_artisan p on p.id = b.artisan_id
where b.status = 'completed' and p.country = 'PT' and b.completed_at >= now() - interval '12 months'
order by b.completed_at desc;
```

### 2.3 Chantiers et prix : documents fiscaux PT (seule table avec une ville structurée)

```sql
select to_char(issue_date, 'YYYY-MM') as mes, client_city, doc_type, status, total_amount
from pt_fiscal_documents
where client_country = 'PT' and status <> 'A' and issue_date >= now() - interval '12 months'
order by issue_date desc;
```

### 2.4 Prix réels par métier : devis signés

```sql
select d.created_at::date, d.total_ht_cents / 100.0 as total_ht, d.items
from devis d
where d.country = 'PT' and d.status = 'signed' and d.created_at >= now() - interval '12 months'
order by d.created_at desc;
```

### 2.5 Délais constatés : de la demande à la fin, par concelho de l'artisan

```sql
select coalesce(p.company_city, p.city) as concelho,
       count(*) as pedidos,
       round(avg(extract(epoch from (b.booking_date - b.created_at::date)) / 86400)::numeric, 1) as visita_dias_media,
       round(avg(extract(epoch from (b.completed_at - b.created_at)) / 86400)::numeric, 1) as intervencao_dias_media
from bookings b
join profiles_artisan p on p.id = b.artisan_id
where b.status = 'completed' and p.country = 'PT' and b.completed_at >= now() - interval '12 months'
group by 1
having count(*) >= 5
order by 2 desc;
```

### 2.6 Avis réels (à publier seulement avec l'accord écrit du client)

```sql
select r.created_at::date, r.rating, r.comment, coalesce(p.company_city, p.city) as concelho
from booking_reviews r
join bookings b on b.id = r.booking_id
join profiles_artisan p on p.id = b.artisan_id
where p.country = 'PT' and r.comment is not null
order by r.created_at desc;
```

## 3. Comment remplir `data/seo/local-proof.json`

1. Partir de `data/seo/local-proof.example.json`, garder uniquement des lignes vraies.
2. Un chantier sans `mes` ou sans `tipo` est ignoré par le code ; un avis sans `autorizacao: true` aussi.
3. Commencer par les concelhos où il y a eu de l'activité ces douze derniers mois, même deux ou trois : ce sont les pages du lot A.
4. Pour les couples métier x ville sans aucune donnée après extraction : règle du plan (section 9), redirection vers la page ville ou le hub métier, pas de remplissage. Décision à prendre lot par lot (`DECISION PROPRIETAIRE`).

## 3 bis. Pages de district (gel A0 levé le 20/10/2026)

Les pages `/pt/servicos/{slug}/` de `lib/data/pt-servicos-distrito.ts` (aujourd'hui `limpeza-de-telhados`) lisent le même fichier, avec le slug de la page à la place du métier. Le propriétaire a confirmé le 20/10/2026 avoir des prix et des délais réels pour la limpeza de telhados ; tant qu'ils ne sont pas saisis, les blocs `#precos` et `#prazos` restent absents.

- Prix : une ligne par prestation, `servico` facultatif mais conseillé. Exemple de forme (valeurs à remplacer par les vraies) : `{ "metier": "limpeza-de-telhados", "servico": "Lavagem e tratamento anti-musgo", "min": 0, "max": 0, "unite": "m2", "fonte": "orçamentos de 2026" }`. Une ligne à `max` nul est ignorée.
- Délais : une seule ligne pour toute la zone des pages de district, clé `distritos` (les distritos où le délai vaut, valeurs de `CityData.distrito`) à la place de `cidade`, `metiers` obligatoire : `{ "distritos": ["Porto", "Braga", "Aveiro"], "metiers": ["limpeza-de-telhados"], "visita_dias": 0, "intervencao_dias": 0, "fonte": "últimos 10 pedidos" }`. Une page de district n'affiche le délai que si la ligne couvre tous ses distritos (`prazoDistritoPara`). L'ancienne clé `cidade: "distrito-porto"` n'est plus lue depuis le 28/10/2026. `visita_horas_max` (facultatif) affiche « Visita em N horas, no máximo » et le reprend dans le bandeau sous le titre (`visita_dias` reste obligatoire pour la validité).
- Saisi le 21/10/2026 sur indication du propriétaire : limpeza e impermeabilização do telhado 20 à 30 € par m² ; visite en 48 heures au plus. Le 28/10/2026, le propriétaire confirme la visite en 48 heures au plus dans tous les concelhos des distritos do Porto, de Braga et de Aveiro, pour les trois pages de district et pour le capoto neuf (clé `capoto`, lue par aucune page aujourd'hui : les pages isolamento-termico couvrent aussi d'autres travaux), et les mêmes prix partout.
- Chantiers : `metier` = `limpeza-de-telhados`, `cidade` = slug d'une des villes de la grille situées dans les distritos de la page (depuis le 28/10/2026 : les 18 concelhos du distrito do Porto, Braga, Aveiro, Ovar et Águeda), et **`publicado`** = jour de la **mise en production** (AAAA-MM-JJ, à aligner à la fusion), obligatoire pour qu'un chantier compte ; `atualizado` pour une modification visible ultérieure. Champs de contenu : `freguesia` (ou lieu-dit), `problema` (ce que l'équipe a trouvé), `solucao` (ce qu'elle a fait), `acesso` (`andaime` ou `corda`), `foto` (chemin sous `public/`, métadonnées GPS retirées, ou URL Supabase) avec `foto_alt` (ce que montre la photo). Les six plus récents s'affichent sur la page du district, avec problème, solution et accès.
- **Pages concelho** (`/pt/servicos/limpeza-de-telhados-{concelho}/`, route `app/pt/servicos/[slug]/`) : elles ne s'ouvrent que si les trois conditions de la section 4.4 du guide Google sont réunies (`concelhoDocumentado` et `revisaoConcelhoPara`, `lib/data/pt-servicos-distrito.ts`) : (1) un chantier complet (photo décrite, freguesia, problème, solution, date) ; (2) une particularité locale (`notas_concelho`) ou un deuxième chantier détaillé ; (3) une relecture humaine datée dans `revisoes_concelho` (`{ "metier": "limpeza-de-telhados", "cidade": "…", "revisto": "AAAA-MM-JJ" }`, les 7 tests de la section 2.4, jour de la mise en production). Elles sont alors ajoutées au sitemap (lastmod = dernier élément publié) et liées depuis une carte de chantier de la page du district, la page ville et les pages telhador et impermeabilizacao du concelho, qui prennent la date d'ouverture (`revisto`). Sans cela : aucune page, jamais de page par freguesia. Fiche d'envoi pour le propriétaire : `docs/seo/porto-palavras-chave/saisie-chantiers.md`.
- Particularités locales : `notas_concelho`, `{ "metier": "limpeza-de-telhados", "cidade": "…", "texto": "…", "publicado": "AAAA-MM-JJ" }`, une phrase complète de plus de 20 caractères (sinon ignorée), seulement ce que le propriétaire a constaté sur place ; affichées sur la page concelho.
- Dates : champ `dataModificacao` de chaque service (`lib/data/pt-servicos-distrito.ts`, constantes de `lib/seo/pt-datas.ts`, aujourd'hui `DATA_ZONA_DISTRITOS`) = contenu des pages de district et concelho (textes, **prix, délais**). `DATA_ZONA_DISTRITOS` n'est à reporter qu'au jour réel de la fusion du lot de la zone, puis ne bouge plus : elle date aussi les liens, la grille de Braga et d'Aveiro, `/pt/precos/pintor/`, la FAQ du capoto et deux articles (78 URL). Pour toute modification ultérieure d'une page de district, y compris un changement d'une ligne `precos` ou `prazos`, créer une nouvelle constante datée et la mettre dans `dataModificacao` des seuls services touchés (`DATA_PAGINAS_DISTRITO` et `DATA_PAGINAS_FACHADAS_TV` sont historiques, plus lues par le code) ; `dataLigacoes` = liens et textes des liens sur les hubs, les pages ville, `/pt/servicos/` et le plan du site ; `dataLigacoesGrelha` = ajout des liens sur les pages de la grille, par distrito. Un test refuse toute date future ou inexistante dans `local-proof.json`.

## 4. Porte de qualité (test T10)

`data/seo/porte-qualite.example.json` donne la configuration prévue : sections obligatoires `#chantiers`, `#prazos`, `#metodo` sur les pages servicos, 30 % de séquences propres, moins de 8 villes citées dans le texte. Elle sera copiée en `data/seo/porte-qualite.json` au démarrage du lot A, avec la liste des URL du lot (`--lot`), pour que `scripts/seo/pt-tests.mjs` l'applique.
