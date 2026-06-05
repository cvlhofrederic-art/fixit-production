# Conformité eIDAS — niveau de signature actuel et roadmap

> Règlement (UE) 910/2014 sur l'identification électronique et les services de confiance (eIDAS).

## État actuel (FR-V1)

**Niveau effectif : Signature électronique simple (eIDAS art. 25).**

Ce qui est en place :
- Signature client par tracé sur canvas HTML, sérialisée en SVG + hash SHA-256 ([lib/devis-types.ts:6-13](../../lib/devis-types.ts) `SignatureData`)
- Hash de chaîne (FR-V1) sur le contenu canonique du document : `content_hash` SHA-256 + `chain_signature` HMAC-SHA256 ([lib/document-integrity.ts](../../lib/document-integrity.ts))
- Horodatage `signed_at` côté serveur

Ce qui MANQUE pour passer à un niveau supérieur eIDAS.

## Niveaux eIDAS et leur valeur juridique

| Niveau | Description | Valeur probatoire | Cas d'usage Vitfix |
|---|---|---|---|
| **Simple** | Tout signe associé à un document (tracé canvas, click bouton) | Faible — la partie qui invoque la signature doit prouver son intégrité et son authenticité | **Actuel** |
| **Avancée** (AdES) | Liée uniquement au signataire ; permet identification ; détection de toute modification post-signature | Forte — présomption d'intégrité ; nécessite un certificat numérique délivré par une autorité (PSCo) | **Cible court-terme** |
| **Qualifiée** (QES) | AdES + créée par dispositif qualifié (QSCD) ; certificat qualifié émis par PSCo qualifié (liste UE) | Équivalent à signature manuscrite (eIDAS art. 25 §2) | Non requis pour devis/facture artisan |

## Décision technique

Pour Vitfix.io, **niveau Avancée (AdES)** est le bon objectif :
- Suffit pour la valeur probatoire devant un juge (présomption renforcée)
- Évite le coût d'un QSCD (~50-200€/an par signataire)
- Compatible avec la signature client à distance (smartphone, tablette)

## Ce qu'il faudrait pour passer en Avancée

### Côté éditeur (Vitfix)
1. **Acquérir un certificat de signature de serveur** auprès d'un PSCo qualifié (Universign, Docusign, Yousign) — ~500-1500€/an
2. **Implémenter le scellement PAdES-B-LT** (PDF Advanced Electronic Signature, Long Term) :
   - Sceau visible en bas de page contenant : sceau de l'éditeur + horodatage RFC 3161 d'une TSA qualifiée
   - Signature numérique de tout le contenu PDF post-signature client
3. **Stocker la chaîne de certification** (LTV — Long Term Validation) dans le PDF pour vérification offline
4. **Intégration TSA** (Time Stamp Authority qualifiée) — UniversignTSA, FreeTSA, ou une équivalente PSCo

### Côté client artisan
- Acquisition de SON propre certificat de signature personnel (optionnel, sinon Vitfix signe en tant que tiers de confiance)
- Identification renforcée requise lors du onboarding artisan (KYC niveau Avancé)

### Stack technique recommandée

```
Pour le scellement PDF :
- node-signpdf ou pdf-lib + @signpdf/utils (signature PAdES)
- Connection à TSA via @signpdf/signer-p12 + axios

Pour la signature client (mobile-friendly) :
- Universign API (français, tarification ~0.50€/signature)
- Yousign API (concurrent FR, similaire)
- DocuSign Connect (international, plus cher)
```

## Estimation effort

| Item | Effort |
|---|---|
| Acquisition certificat éditeur PSCo qualifié | 1 semaine + 500-1500€/an |
| Setup TSA qualifiée | 0.5j |
| Implémentation PAdES-B-LT scellement | 3-5j |
| Workflow artisan : envoi devis → signature client → réception scellé | 5j |
| Tests + intégration UniversignTSA en sandbox | 3j |
| Documentation utilisateur + DPIA mise à jour | 1j |
| **Total** | **~3 semaines + ~1000-2000€ setup** |

## Verdict pour 2026

- **Court terme (T1 2026)** : rester en niveau **Simple** + hash chain FR-V1 = suffisant si pas de litige actif sur signatures
- **Moyen terme (Q3 2026)** : monter en **Avancée** (AdES) avant la réforme e-invoicing 2026/2027 où la signature scellée sera attendue par les PA partenaires
- **Pas QES** : surdimensionné pour le ticket moyen artisan

Actuellement, Vitfix peut commercialement défendre que sa signature est « Simple eIDAS, conforme art. 25 §1 (recevable mais sans présomption) » — c'est légal mais probatoirement faible en cas de litige. Le hash chain (FR-V1) compense partiellement en garantissant l'intégrité du document signé.
