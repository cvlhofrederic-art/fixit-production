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

## 4. Porte de qualité (test T10)

`data/seo/porte-qualite.example.json` donne la configuration prévue : sections obligatoires `#chantiers`, `#prazos`, `#metodo` sur les pages servicos, 30 % de séquences propres, moins de 8 villes citées dans le texte. Elle sera copiée en `data/seo/porte-qualite.json` au démarrage du lot A, avec la liste des URL du lot (`--lot`), pour que `scripts/seo/pt-tests.mjs` l'applique.
