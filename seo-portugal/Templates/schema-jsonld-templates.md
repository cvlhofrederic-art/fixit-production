# Schema JSON-LD Templates — Vitfix.io

**Purpose:** Developer resource. Copy-paste ready templates for all page types in the SEO strategy.
**Format:** Complete JSON-LD code + integration guidelines
**Language:** Portuguese (schema content)
**Last updated:** March 2026

---

## Quick Reference — Which Schemas to Use

| Page Type | Primary Schemas | Secondary Schemas | Notes |
|---|---|---|---|
| **Blog Article** | Article | FAQPage, BreadcrumbList | General educational content |
| **Local Service Page** | LocalBusiness, Service | FAQPage, BreadcrumbList | City + service combo (e.g., "Canalizador em Porto") |
| **Price Guide** | Article, HowTo | FAQPage, BreadcrumbList | "Quanto custa..." articles |
| **B2B Condomínios** | Article, Organization | FAQPage, BreadcrumbList | For administrative/business content |
| **Homepage** | Organization, WebSite | SearchAction | Main landing page |
| **Service Directory Page** | CollectionPage | LocalBusiness (multiple) | Listing all services in a city |

---

## Important: Combining Multiple Schemas

**Best Practice:** Include multiple `<script type="application/ld+json">` blocks on one page. Each schema serves a different purpose:

```html
<!-- Schema 1: Article info -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Article", ... }
</script>

<!-- Schema 2: FAQ markup -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage", ... }
</script>

<!-- Schema 3: Breadcrumb navigation -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "BreadcrumbList", ... }
</script>
```

**Testing:** Use Google's Rich Results Test after implementation: https://search.google.com/test/rich-results

---

# 1. Article Schema — Blog Articles & Guides

**Use for:** Educational articles, how-to guides, price guides, local tips

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[TITULO DO ARTIGO - ex: Como Encontrar um Empreiteiro de Confiança em Portugal]",
  "description": "[META DESCRIPTION - 150-160 caracteres com palavra-chave]",
  "image": {
    "@type": "ImageObject",
    "url": "https://vitfix.io/images/[filename].jpg",
    "width": 1200,
    "height": 630
  },
  "datePublished": "[DATA DE PUBLICAÇÃO - YYYY-MM-DD]",
  "dateModified": "[DATA DE ÚLTIMA ATUALIZAÇÃO - YYYY-MM-DD]",
  "author": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "url": "https://vitfix.io/pt/"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "logo": {
      "@type": "ImageObject",
      "url": "https://vitfix.io/pt/logo.png",
      "width": 250,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://vitfix.io/pt/blog/[SLUG-URL]/"
  },
  "articleBody": "[RESUMO do artigo ou primeiro parágrafo - 2-3 frases]",
  "wordCount": "[NÚMERO DE PALAVRAS - ex: 1250]",
  "articleSection": "Blog",
  "inLanguage": "pt-PT",
  "isAccessibleForFree": true
}
```

**Example (ready to use):**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Como Encontrar um Empreiteiro de Confiança em Portugal em 2026",
  "description": "Guia completo para encontrar e contratar um empreiteiro certificado em Portugal. Dicas de verificação, preços e evitar fraudes.",
  "image": {
    "@type": "ImageObject",
    "url": "https://vitfix.io/images/empreiteiro-confianca-portugal.jpg",
    "width": 1200,
    "height": 630
  },
  "datePublished": "2026-02-15",
  "dateModified": "2026-03-18",
  "author": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "url": "https://vitfix.io/pt/"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "logo": {
      "@type": "ImageObject",
      "url": "https://vitfix.io/pt/logo.png",
      "width": 250,
      "height": 60
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://vitfix.io/pt/blog/como-encontrar-empreiteiro-confianca/"
  },
  "articleBody": "Encontrar um empreiteiro de confiança é uma das maiores preocupações de proprietários em Portugal. Este guia explica como verificar certificações, comparar orçamentos e evitar fraudes.",
  "wordCount": 1350,
  "articleSection": "Blog",
  "inLanguage": "pt-PT",
  "isAccessibleForFree": true
}
```

---

# 2. FAQPage Schema — FAQ Sections

**Use for:** Every article with a "Perguntas Frequentes" section. Improves visibility in Google Search results with FAQ snippet.

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[PERGUNTA 1 - em português]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[RESPOSTA 1 - 1-2 frases com informação útil]"
      }
    },
    {
      "@type": "Question",
      "name": "[PERGUNTA 2]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[RESPOSTA 2]"
      }
    },
    {
      "@type": "Question",
      "name": "[PERGUNTA 3]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[RESPOSTA 3]"
      }
    }
  ]
}
```

**Example (ready to use — 3 questions about hiring contractors):**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Como verificar se um empreiteiro tem seguro de responsabilidade civil?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Peça sempre ao profissional uma cópia do certificado de responsabilidade civil. A cobertura mínima deve ser de 100 mil euros. Contacte a seguradora para confirmar a validade."
      }
    },
    {
      "@type": "Question",
      "name": "Qual é o preço médio de uma obra de renovação em Portugal?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "O preço varia entre 300 a 800 euros por m² consoante a localização (Lisboa é mais cara que o Porto), tipo de obra (demolição, reconstrução, acabamentos) e qualidade dos materiais. Sempre peça 3 orçamentos antes de decidir."
      }
    },
    {
      "@type": "Question",
      "name": "O que devo incluir num contrato com um empreiteiro?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "O contrato deve incluir: descrição detalhada dos trabalhos, cronograma, valor total e forma de pagamento (recomendamos pagamentos parciais por etapa), materiais inclusos, garantia dos trabalhos (mínimo 1 ano), e identificação do profissional com número de contribuinte."
      }
    }
  ]
}
```

**Tips:**
- Keep answers to 2-3 sentences maximum for better snippet display
- Use natural language questions (como se alguém perguntasse verbalmente)
- Include 3-5 questions per page
- Update FAQPage when adding new content to the article

---

# 3. LocalBusiness Schema — Local Service Pages

**Use for:** Pages combining location + service (e.g., "Canalizador em Porto", "Empreiteiro em Marco de Canaveses")

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Vitfix.io — Profissionais de Construção em [CIDADE]",
  "description": "[DESCRIÇÃO DA PÁGINA - breve resumo sobre o serviço na cidade]",
  "url": "https://vitfix.io/pt/[cidade]/[servico]/",
  "telephone": "+351 [CONTACTO]",
  "email": "contacto@vitfix.io",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[Se aplicável: endereço físico]",
    "addressLocality": "[CIDADE]",
    "addressRegion": "PT",
    "postalCode": "[CÓDIGO POSTAL]",
    "addressCountry": "PT"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "[LATITUDE]",
    "longitude": "[LONGITUDE]"
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "[CIDADE PRINCIPAL]"
    },
    {
      "@type": "City",
      "name": "[CIDADE VIZINHA 1]"
    },
    {
      "@type": "City",
      "name": "[CIDADE VIZINHA 2]"
    }
  ],
  "serviceType": "[TIPO DE SERVIÇO - ex: Canalização, Eletricidade, Carpintaria]",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "[NOTA MÉDIA - ex: 4.8]",
    "ratingCount": "[NÚMERO DE AVALIAÇÕES - ex: 247]"
  }
}
```

**Example (Porto, Canalizador):**

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Vitfix.io — Canalizadores em Porto",
  "description": "Encontre canalizadores certificados e verificados no Porto. Resposta rápida, profissionais com seguro, orçamentos sem compromisso.",
  "url": "https://vitfix.io/pt/porto/canalizador/",
  "telephone": "+351 800 100 300",
  "email": "contacto@vitfix.io",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Porto",
    "addressRegion": "PT",
    "addressCountry": "PT"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 41.1579,
    "longitude": -8.6291
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "Porto"
    },
    {
      "@type": "City",
      "name": "Vila Nova de Gaia"
    },
    {
      "@type": "City",
      "name": "Matosinhos"
    },
    {
      "@type": "City",
      "name": "Gondomar"
    }
  ],
  "serviceType": "Canalização",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.8,
    "ratingCount": 247
  }
}
```

**Example (Marco de Canaveses, Empreiteiro):**

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Vitfix.io — Empreiteiros em Marco de Canaveses",
  "description": "Profissionais de construção e empreiteiros certificados em Marco de Canaveses. Obras de renovação, manutenção e reparação com garantia.",
  "url": "https://vitfix.io/pt/marco-de-canaveses/empreiteiro/",
  "telephone": "+351 800 100 300",
  "email": "contacto@vitfix.io",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 41.0667,
    "longitude": -8.1333
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "Marco de Canaveses"
    },
    {
      "@type": "City",
      "name": "Penafiel"
    },
    {
      "@type": "City",
      "name": "Amarante"
    }
  ],
  "serviceType": "Construção e Empreitadas",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.7,
    "ratingCount": 89
  }
}
```

**Coordinates for quick reference (Portugal):**
- Porto: 41.1579, -8.6291
- Vila Nova de Gaia: 41.1231, -8.6271
- Matosinhos: 41.1879, -8.6907
- Gondomar: 41.1026, -8.4628
- Marco de Canaveses: 41.0667, -8.1333
- Penafiel: 41.2114, -8.2831
- Amarante: 41.0753, -8.0717
- Lisboa: 38.7223, -9.1393
- Braga: 41.5454, -8.4263

---

# 4. Service Schema — Service Offerings

**Use for:** Service pages, offering details with pricing and service area.

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "[NOME DO SERVIÇO - ex: Canalização de Emergência]",
  "description": "[DESCRIÇÃO DO SERVIÇO]",
  "provider": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "url": "https://vitfix.io/pt/"
  },
  "areaServed": {
    "@type": "City",
    "name": "[CIDADE]"
  },
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://vitfix.io/pt/",
    "servicePhone": "+351 800 100 300"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": "[PREÇO MÍNIMO - ex: 80]",
    "pricingInfo": "[INFORMAÇÃO SOBRE PREÇOS - ex: A partir de €80 (chamada + deslocação)]",
    "availability": "Available",
    "validFrom": "[DATA DE VÁLIDADE - YYYY-MM-DD]"
  }
}
```

**Example (Emergency plumbing in Porto):**

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Canalizador de Emergência em Porto",
  "description": "Serviço de canalização de emergência disponível 24/7 em Porto. Profissionais certificados, diagnóstico gratuito, garantia de trabalho.",
  "provider": {
    "@type": "Organization",
    "name": "Vitfix.io",
    "url": "https://vitfix.io/pt/"
  },
  "areaServed": {
    "@type": "City",
    "name": "Porto"
  },
  "availableChannel": {
    "@type": "ServiceChannel",
    "serviceUrl": "https://vitfix.io/pt/porto/canalizador/",
    "servicePhone": "+351 800 100 300"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": 85,
    "pricingInfo": "A partir de €85 (chamada técnica + deslocação). Trabalho adicional orçamentado separadamente.",
    "availability": "Available",
    "validFrom": "2026-03-18"
  }
}
```

---

# 5. HowTo Schema — "Como Funciona" Sections

**Use for:** Steps explaining the platform process (describe project → receive quotes → choose professional)

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "[TÍTULO - ex: Como Encontrar um Profissional na Vitfix.io]",
  "description": "[DESCRIÇÃO BREVE]",
  "totalTime": "PT15M",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "[PASSO 1 - ex: Descreva o Seu Projeto]",
      "text": "[INSTRUÇÕES DO PASSO 1 - 1-2 frases]",
      "image": {
        "@type": "ImageObject",
        "url": "https://vitfix.io/images/step-1.jpg"
      }
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "[PASSO 2]",
      "text": "[INSTRUÇÕES DO PASSO 2]",
      "image": {
        "@type": "ImageObject",
        "url": "https://vitfix.io/images/step-2.jpg"
      }
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "[PASSO 3]",
      "text": "[INSTRUÇÕES DO PASSO 3]",
      "image": {
        "@type": "ImageObject",
        "url": "https://vitfix.io/images/step-3.jpg"
      }
    }
  ]
}
```

**Example (ready to use):**

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Como Encontrar um Profissional de Construção na Vitfix.io",
  "description": "3 passos simples para contratar um profissional verificado e certificado.",
  "totalTime": "PT10M",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": "Descreva o Seu Projeto",
      "text": "Preencha um formulário rápido com o tipo de obra, localização e descrição. Pode adicionar fotos para que os profissionais entendam melhor o que precisa.",
      "image": {
        "@type": "ImageObject",
        "url": "https://vitfix.io/images/step-1-descrever.jpg"
      }
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": "Receba Orçamentos de Profissionais Certificados",
      "text": "Todos os profissionais na Vitfix.io são verificados, têm seguro e certificações. Receberá orçamentos sem compromisso em até 24 horas.",
      "image": {
        "@type": "ImageObject",
        "url": "https://vitfix.io/images/step-2-orcamentos.jpg"
      }
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": "Escolha e Contrate",
      "text": "Compare os orçamentos, veja as avaliações de clientes anteriores e escolha o profissional que melhor se adequa ao seu projeto. Negocie directamente através da plataforma."
    }
  ]
}
```

---

# 6. BreadcrumbList Schema — Navigation & Site Structure

**Use for:** All pages (helps Google understand site hierarchy + shows breadcrumbs in search results)

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Vitfix.io",
      "@id": "https://vitfix.io/pt/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "[SECÇÃO PRINCIPAL - ex: Blog]",
      "@id": "https://vitfix.io/pt/blog/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "[TÍTULO DA PÁGINA ATUAL]",
      "@id": "https://vitfix.io/pt/[url-atual]/"
    }
  ]
}
```

**Example 1 (Blog article):**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Vitfix.io",
      "@id": "https://vitfix.io/pt/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "@id": "https://vitfix.io/pt/blog/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Como Encontrar um Empreiteiro de Confiança em Portugal",
      "@id": "https://vitfix.io/pt/blog/como-encontrar-empreiteiro-confianca/"
    }
  ]
}
```

**Example 2 (Local service page):**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Vitfix.io",
      "@id": "https://vitfix.io/pt/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Porto",
      "@id": "https://vitfix.io/pt/porto/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Canalizador",
      "@id": "https://vitfix.io/pt/porto/canalizador/"
    }
  ]
}
```

---

# 7. Organization Schema — Company Information

**Use for:** Homepage + any corporate/B2B page. Tells Google who you are, contact info, social presence.

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Vitfix.io",
  "alternateName": "Vitfix",
  "url": "https://vitfix.io/pt/",
  "description": "Plataforma digital que liga profissionais de construção certificados com particulares e administradores de condomínios em Portugal.",
  "email": "contacto@vitfix.io",
  "telephone": "+351 800 100 300",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "PT"
  },
  "logo": {
    "@type": "ImageObject",
    "url": "https://vitfix.io/pt/logo.png",
    "width": 250,
    "height": 60
  },
  "sameAs": [
    "https://www.linkedin.com/company/vitfix-io",
    "https://www.facebook.com/vitfix.io",
    "https://www.instagram.com/vitfix.io"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Support",
    "email": "contacto@vitfix.io",
    "telephone": "+351 800 100 300"
  }
}
```

**Example (ready to use):**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Vitfix.io",
  "alternateName": "Vitfix",
  "url": "https://vitfix.io/pt/",
  "description": "Plataforma digital de ligação entre profissionais de construção certificados, particulares e administradores de condomínios em Portugal. Encontre profissionais verificados e de confiança para qualquer tipo de obra ou reparação.",
  "email": "contacto@vitfix.io",
  "telephone": "+351 800 100 300",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "PT"
  },
  "logo": {
    "@type": "ImageObject",
    "url": "https://vitfix.io/pt/logo.png",
    "width": 250,
    "height": 60
  },
  "sameAs": [
    "https://www.linkedin.com/company/vitfix-io",
    "https://www.facebook.com/vitfix.io",
    "https://www.instagram.com/vitfix.io"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Support",
    "email": "contacto@vitfix.io",
    "telephone": "+351 800 100 300",
    "availableLanguage": "pt-PT"
  }
}
```

---

# 8. WebSite Schema with SearchAction — Homepage

**Use for:** Homepage only. Enables Google Sitelinks Search Box.

**Copy-paste this template:**

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Vitfix.io",
  "url": "https://vitfix.io/pt/",
  "description": "Encontre profissionais de construção certificados em Portugal",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://vitfix.io/pt/search/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

**Example (ready to use):**

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Vitfix.io",
  "url": "https://vitfix.io/pt/",
  "description": "Encontre profissionais de construção certificados em Portugal. Ligação directa entre empreiteiros, eletricistas, canalizadores e clientes de confiança.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://vitfix.io/pt/search/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

---

# Implementation Guide for Developers

## Step 1: Choose Your Page Type
Identify which page type you're implementing (blog, local service, etc.) and select schemas from the quick reference table above.

## Step 2: Copy-Paste the JSON-LD
Copy the complete JSON template. Replace placeholders in UPPERCASE with your actual data.

## Step 3: Add to Your HTML
Insert into the `<head>` section of your page:

```html
<script type="application/ld+json">
{JSON-LD CODE HERE}
</script>
```

## Step 4: Combine Multiple Schemas
For most pages, use 2-4 schemas. Example: Blog article uses Article + FAQPage + BreadcrumbList + (optionally) Organization.

```html
<!-- In <head> section -->

<!-- Schema 1: Article -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Article", ... }
</script>

<!-- Schema 2: FAQPage -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "FAQPage", ... }
</script>

<!-- Schema 3: BreadcrumbList -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "BreadcrumbList", ... }
</script>
```

## Step 5: Validate
Test with Google Rich Results Test: https://search.google.com/test/rich-results

---

# Common Pitfalls & Solutions

| Issue | Solution |
|---|---|
| Invalid JSON syntax | Use a JSON validator before deploying. No trailing commas. |
| Missing required fields | Refer to template comments. `@context`, `@type`, core properties are mandatory. |
| Inconsistent URLs | Use absolute URLs (https://...). Never relative paths. |
| Duplicate schemas | OK to have multiple `<script>` blocks, each with different schema. |
| Wrong date format | Always use YYYY-MM-DD (ISO 8601). No other formats. |
| Hardcoded old dates | Update `dateModified` when page content changes. Use today's date. |
| Mismatched coordinates | Verify with Google Maps. Small errors won't hurt but accuracy is better. |

---

# Maintenance Checklist

- [ ] Schema valid (no JSON errors)
- [ ] All URLs are absolute (https://...)
- [ ] Dates in YYYY-MM-DD format
- [ ] Organization schema matches company info in footer
- [ ] BreadcrumbList matches page navigation
- [ ] LocalBusiness areaServed includes all relevant cities
- [ ] Test with Rich Results Tool before pushing to production

---

**Notes for Dev Team:**

- All templates use Portuguese content as per CLAUDE.md brand guidelines
- Coordinates provided for common Portuguese cities
- Logo URL needs to point to actual logo file
- Email and phone should match contact info in footer/header
- Keep schemas DRY: reference Organization schema data (name, logo, contact) across all pages
- Monitor Google Search Console for rich results performance

**Last updated:** March 2026
**Format:** Copy-paste ready (valid JSON-LD)
**Testing tool:** https://search.google.com/test/rich-results
