# Intégration PT — Fournisseurs de facturation certifiés AT

> **Contexte** : depuis 2026-05-05 (PT-V1), Vitfix émet uniquement des **pró-forma** non-fiscales en PT. Toute fatura légale doit transiter par un logiciel certifié AT (Autoridade Tributária) tiers. Ce document cartographie les options d'intégration.

## Pourquoi pas Vitfix directement ?

Vitfix.io n'a pas (encore) sa **certificação AT** au titre du Decreto-Lei 28/2019 (anciennement Portaria 363/2010). L'émission de fatura avec un cert non-attribué = délit fiscal :

- Peines : 1 500 € à 150 000 € + interdiction d'exercer
- Sanctions distinctes pour chaque doc émis
- Risque pour l'éditeur ET pour l'artisan utilisateur

**Voie 1 — Certification directe** : 6 mois, 5-10k€, audit AT initial + audits annuels. Process documenté dans [pt-fatura-reactivation.md](pt-fatura-reactivation.md).

**Voie 2 — Délégation à un tiers certifié** : intégration API. Plus rapide. C'est l'option recommandée actuellement.

## Comparaison des fournisseurs

| Critère | Moloni | InvoiceXpress | Cegid Vendus |
|---|---|---|---|
| Certificação AT | ✅ n.º 1455 | ✅ n.º 0935 | ✅ n.º 1284 |
| API REST | ✅ OAuth2 | ✅ API key + account-name | ⚠️ SOAP/limité |
| Tarif min (€/mois) | ~30€ | ~25€ | ~50€ |
| Limite documents | Illimité | Selon plan | Selon plan |
| ATCUD + QR auto | ✅ | ✅ | ✅ |
| SAF-T export auto | ✅ | ✅ | ✅ |
| Webhook événements | ✅ | ✅ | ❌ |
| Sandbox dev | ✅ | ✅ | ⚠️ contact commercial |
| Support FR/EN | EN/PT | EN/PT | PT |

**Recommandation** : **Moloni** (meilleure DX API, sandbox immédiat, prix). InvoiceXpress en alternative si UI portail simplifiée souhaitée par l'artisan.

## Mapping Vitfix → Moloni

### Auth
```typescript
POST https://api.moloni.pt/v1/grant
{
  client_id: $MOLONI_CLIENT_ID,
  client_secret: $MOLONI_CLIENT_SECRET,
  grant_type: 'password',
  username: $MOLONI_USERNAME,
  password: $MOLONI_PASSWORD,
}
→ { access_token, refresh_token, expires_in }
```

### Émission facture
```typescript
POST https://api.moloni.pt/v1/invoices/insert/?access_token={token}
{
  company_id: number,           // de Moloni (artisan PT)
  customer_id: number,           // mappé via NIF → Moloni customer (auto-create si absent)
  date: 'YYYY-MM-DD',
  expiration_date: 'YYYY-MM-DD',
  document_set_id: number,       // série autorisée
  status: 1,                     // 1 = clos, 0 = brouillon
  products: [
    {
      product_id: number,        // ou name + price + summary pour creation à la volée
      qty: number,
      price: number,             // unitaire HT
      taxes: [{ tax_id, value }],
      discount: number,
      summary: string,           // description ligne
    }
  ],
  payments: [{ payment_method_id, value, date }],
  notes: string,
}
→ { document_id, document_set_id, ATCUD, hash, qr_code }
```

### Mapping champs Vitfix → Moloni

| Vitfix field | Moloni field | Notes |
|---|---|---|
| `clientName` | `customer.name` | match par NIF si fourni, sinon create |
| `clientNIF` | `customer.vat_number` | obligatoire pour client business |
| `clientAddress` | `customer.address` | |
| `lines[].description` | `products[].summary` | UTF-8 jusqu'à 250 chars |
| `lines[].qty` | `products[].qty` | |
| `lines[].priceHT` | `products[].price` | |
| `lines[].tvaRate` | `products[].taxes[0].value` | 23 / 13 / 6 / 0 |
| `lines[].totalHT` | (calculé Moloni) | |
| `paymentMode` | `payments[].payment_method_id` | mapping fixe (1=cash, 2=virement...) |
| `paymentDue` | `expiration_date` | |
| `notes` | `notes` | |

### Récupération PDF + ATCUD
```typescript
GET https://api.moloni.pt/v1/documents/getPDFLink/?access_token={token}&document_id={id}
→ { url } // PDF certifié AT, signé, avec ATCUD + QR
```

→ on peut soit afficher le PDF Moloni dans Vitfix, soit re-générer notre propre PDF en y intégrant l'ATCUD/hash retournés par Moloni.

## Mapping Vitfix → InvoiceXpress

### Auth
```typescript
// Header sur toutes les requêtes
X-Api-Key: $INVOICEXPRESS_API_KEY
// URL incluant le subdomain
https://{account}.app.invoicexpress.com/...
```

### Émission facture
```typescript
POST https://{account}.app.invoicexpress.com/invoices.json
{
  invoice: {
    date: 'DD/MM/YYYY',
    due_date: 'DD/MM/YYYY',
    reference: 'string',
    observations: 'string',
    retention: 0,
    tax_exemption: '',
    sequence_id: number,
    manual_sequence_number: '',
    client: { name, code, fiscal_id, address, ... },
    items: [
      {
        name, description, unit_price, quantity, unit, tax: { name },
      },
    ],
    mb_payment_method: 'wired_transfer'|'cash'|...,
    payable: 'YYYY-MM-DD',
  }
}
→ { invoice: { id, sequence_number, date, ATCUD, public_url, ... } }
```

→ pattern similaire, payload nesté différemment.

## Architecture d'intégration recommandée

```
[Vitfix UI]
   │ artisan crée son orçamento
   │
   ▼
[Vitfix API : POST /api/devis/sync]    (ne change pas)
   │
   ▼
[DB: devis (orçamento) status=sent]    (notre data, pas fiscale)
   │
   │ artisan accepte conversion en fatura
   ▼
[Vitfix API : POST /api/pt-fatura/issue]  (nouveau, à créer)
   │
   ▼
[Moloni API : POST /v1/invoices/insert]
   │
   ▼
[DB: pt_fatura_external table]    (nouvelle, stocke document_id Moloni + ATCUD)
   │
   ▼
[Vitfix UI affiche lien PDF Moloni + ATCUD]
```

### Nouveau modèle de données

```sql
CREATE TABLE pt_fatura_external (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_user_id UUID NOT NULL REFERENCES auth.users(id),
  devis_id UUID REFERENCES devis(id),  -- orçamento source
  provider TEXT NOT NULL CHECK (provider IN ('moloni', 'invoicexpress')),
  external_id TEXT NOT NULL,            -- Moloni document_id ou InvoiceXpress id
  atcud TEXT NOT NULL,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_response JSONB,
  UNIQUE(provider, external_id)
);
```

### Configuration artisan

Chaque artisan PT connecte SON propre compte Moloni/InvoiceXpress. Vitfix ne facture pas en son nom — Vitfix est juste un proxy UX.

```sql
ALTER TABLE profiles_artisan ADD COLUMN pt_provider TEXT
  CHECK (pt_provider IN ('moloni', 'invoicexpress'));
ALTER TABLE profiles_artisan ADD COLUMN pt_provider_oauth JSONB;  -- encrypted
ALTER TABLE profiles_artisan ADD COLUMN pt_provider_company_id TEXT;
```

## Tarification artisan

L'artisan paie Moloni/InvoiceXpress directement (~25-30€/mois). Vitfix peut soit :
- (A) **Pass-through** : artisan crée son compte, configure dans Vitfix → 0€ marge
- (B) **Reseller** : Vitfix crée sous-comptes Moloni en gros + facture artisan + marge ~5€

Voie A recommandée pour démarrer (moins de risque commercial).

## Estimation effort

| Tâche | Effort |
|---|---|
| Setup OAuth/API key Moloni + sandbox | 0.5j |
| Schema DB + migration | 0.5j |
| Endpoint `/api/pt-fatura/issue` (Moloni) | 2j |
| UI artisan : connect provider + emit fatura | 2j |
| Webhooks Moloni (paid, cancelled) | 1j |
| Tests + smoke | 1j |
| **Total Moloni MVP** | **~7j** |
| Ajout InvoiceXpress | +3j |

## Décision à prendre

1. Quel provider démarrer ? **Moloni recommandé.**
2. Voie A (pass-through) ou B (reseller) ? **A recommandée.**
3. Quel timing pour démarrer le développement ? Dépend du volume d'utilisateurs PT actuels.

Si PT = marché secondaire (< 100 artisans actifs) → garder pro-forma actuel + délai de mise en place 6 mois.
Si PT = marché core → démarrer intégration Moloni immédiatement (~10j de dev).
