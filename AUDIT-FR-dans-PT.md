# AUDIT — Traces de français côté PT

**Projet :** Fixit Production (vitfix.io)
**Date :** 18 mars 2026
**Scope :** Toutes les pages, composants, routes, API et fichiers de traduction destinés au marché portugais

---

## Résumé exécutif

| Catégorie | Nb problèmes | Sévérité | Impact utilisateur |
|-----------|:------------:|----------|-------------------|
| Routes FR à la racine (visibles par les users PT) | 11 | CRITIQUE | URLs en français visibles dans le navigateur |
| Texte FR hardcodé dans des pages PT | 30+ | CRITIQUE | Contenu français affiché aux utilisateurs PT |
| Composants dashboard avec strings FR hardcodées | 50+ | HAUTE | Sections du dashboard en français pour users PT |
| DEFAULT_LOCALE = "fr" dans middleware | 1 | HAUTE | Users sans locale détectée voient le FR |
| Composants syndic FR sans équivalent PT | 7 | HAUTE | Fonctionnalités syndic entièrement en FR |
| Clés pt.json identiques à fr.json (non traduites) | ~35 utiles | HAUTE | Labels/textes non traduits dans l'interface |
| Noms de composants en français | 15+ | MOYENNE | Code interne, pas visible par les users |
| Routes API en français | 13+ | MOYENNE | Backend, pas visible mais incohérent |
| Données/presets FR (matériaux, BTP, etc.) | 20+ | MOYENNE | Données métier en français |

---

## 1. Routes & URLs en français (visibles par les utilisateurs PT)

### Pages légales et info — CRITIQUE

| Route actuelle (FR) | Route PT suggérée | Fichier | Notes |
|---------------------|-------------------|---------|-------|
| `/confidentialite` | `/privacidade` | `app/confidentialite/` | Route racine FR, visible par users PT |
| `/confidentialite/mes-donnees` | `/privacidade/meus-dados` | `app/confidentialite/mes-donnees/` | "mes-donnees" = FR |
| `/cgu` | `/termos` | `app/cgu/` | CGU = terme juridique FR |
| `/mentions-legales` | `/avisos-legais` | `app/mentions-legales/` | Entièrement FR |
| `/a-propos` | `/sobre` | `app/a-propos/` | **Doublon : `/sobre` existe déjà** |
| `/tarifs` | `/precos` | `app/tarifs/` | **Doublon : `/precos` existe déjà** |
| `/reserver` | `/reservar` | `app/reserver/` | **Page 100% en FR, zéro traduction** |
| `/recherche` | `/pesquisar` | `app/recherche/` | **Doublon : `/pesquisar` existe déjà** |
| `/avis` | `/avaliacoes` | `app/avis/` | "avis" = FR |

### Marketplace — HAUTE

| Route actuelle (FR) | Route PT suggérée | Fichier | Notes |
|---------------------|-------------------|---------|-------|
| `/marches/publier` | `/mercados/publicar` | `app/marches/publier/` | Doublon : `/mercados/publicar` existe |
| `/marches/gerer` | `/mercados/gerir` | `app/marches/gerer/` | Route FR encore active |

### Pages SEO locales Porto — CRITIQUE

| Route actuelle (FR) | Route PT suggérée | Fichier | Notes |
|---------------------|-------------------|---------|-------|
| `/electricien-porto` | `/eletricista-porto` | `app/electricien-porto/` | Mot FR dans URL Porto ! |
| `/plombier-porto` | `/canalizador-porto` | `app/plombier-porto/` | Mot FR dans URL Porto ! |
| `/entretien-appartement-porto` | `/manutencao-apartamento-porto` | `app/entretien-appartement-porto/` | Phrase entière en FR |
| `/travaux-appartement-porto` | `/obras-apartamento-porto` | `app/travaux-appartement-porto/` | Phrase entière en FR |

### Routes API en français — MOYENNE

| Route API (FR) | Suggestion PT | Notes |
|----------------|---------------|-------|
| `/api/syndic/lea-comptable` | `/api/syndic/contabilista` | Nom FR |
| `/api/comptable-ai` | `/api/contabilista-ai` | Nom FR |
| `/api/client/analyse-devis` | `/api/client/analise-orcamento` | Nom FR |
| `/api/devis-sign` | `/api/orcamento-sign` | Nom FR |
| `/api/simulateur-artisans` | `/api/simulador-profissionais` | Nom FR |
| `/api/marches` | `/api/mercados` | Nom FR |
| `/api/pro/messagerie` | `/api/pro/mensagens` | Nom FR |
| `/api/copro-ai` | `/api/condominio-ai` | Nom FR |
| `/api/materiaux-ai` | `/api/materiais-ai` | Nom FR |
| `/api/artisan-marches-prefs` | `/api/artisan-mercados-prefs` | Nom FR |
| `/api/syndic/assemblees` | `/api/syndic/assembleias` | Nom FR |
| `/api/syndic/canal-interne` | `/api/syndic/canal-interno` | Nom FR |
| `/api/coproprietaire/signalement` | `/api/condomino/ocorrencia` | Nom FR |

---

## 2. Texte français hardcodé dans les pages PT

### `app/reserver/page.tsx` — CRITIQUE (page entière en FR, 26+ strings)

| Texte FR trouvé | Traduction PT suggérée | Contexte |
|-----------------|----------------------|----------|
| Réserver un service | Reservar um serviço | Titre de page |
| Réservation envoyée ! | Reserva enviada! | Message succès |
| Vos informations | As suas informações | Section formulaire |
| Nom complet | Nome completo | Label formulaire |
| Téléphone | Telefone | Label formulaire |
| Date souhaitée | Data pretendida | Label formulaire |
| Heure souhaitée | Hora pretendida | Label formulaire |
| Choisir une heure | Escolher uma hora | Placeholder |
| Adresse d'intervention | Morada de intervenção | Label formulaire |
| Notes (optionnel) | Notas (opcional) | Label formulaire |
| Confirmer la réservation | Confirmar a reserva | Bouton CTA |
| Récapitulatif | Resumo | Section |
| Total TTC | Total c/ IVA | Label prix |
| Erreur lors de la réservation… | Erro ao efetuar a reserva… | Message erreur |
| Jean Dupont *(placeholder)* | João Silva | Placeholder nom FR |
| 06 12 34 56 78 | +351 912 345 678 | Placeholder tel FR |
| 123 rue de la Paix, 75001 Paris | Rua da Liberdade 123, Porto | Placeholder adresse FR |

### `components/dashboard/MateriauxSection.tsx` — HAUTE

| Texte FR | Traduction PT | Contexte |
|----------|--------------|----------|
| Chauffe-eau | Aquecedor | Preset matériaux |
| Carrelage 20m² | Azulejo 20m² | Preset matériaux |
| Tableau électrique | Quadro elétrico | Preset matériaux |
| Salle de bain | Casa de banho | Preset matériaux |
| Robinetterie | Torneiras | Preset matériaux |
| Isolation combles | Isolamento sótão | Preset matériaux |
| Échafaudage | Andaime | Preset outils |
| Voici les matériaux identifiés… | Aqui estão os materiais identificados… | Texte fallback |

### `components/dashboard/BTPSections.tsx` — HAUTE

| Texte FR | Traduction PT |
|----------|--------------|
| Maçonnerie | Alvenaria |
| Plomberie | Canalização |
| Électricité | Eletricidade |
| Peinture | Pintura |
| Menuiserie | Carpintaria |
| *(+ ~10 autres métiers BTP)* | *(à traduire)* |

### `components/dashboard/ComptabiliteSection.tsx` — HAUTE

| Texte FR | Traduction PT | Contexte |
|----------|--------------|----------|
| Matériaux & fournitures chantier | Materiais e fornecimentos de obra | Catégorie dépenses |
| Assurance (RC Pro, décennale…) | Seguro (RC Pro, decenal…) | Catégorie dépenses |
| Téléphone & internet | Telefone e internet | Catégorie dépenses |
| Publicité & marketing | Publicidade e marketing | Catégorie dépenses |

### `components/dashboard/MessagerieArtisan.tsx` — HAUTE

| Texte FR | Traduction PT | Contexte |
|----------|--------------|----------|
| En attente, Accepté, Refusé, En cours, Terminé | Pendente, Aceite, Recusado, Em curso, Terminado | Statuts commande |
| Basse, Normale, Haute, Urgente | Baixa, Normal, Alta, Urgente | Niveaux priorité |

### `components/dashboard/ConciergerieSections.tsx` — HAUTE

| Texte FR | Traduction PT |
|----------|--------------|
| Chambres | Quartos |
| Salle de bain | Casa de banho |
| Cuisine | Cozinha |
| *(+ ~5 items checklist)* | *(à traduire)* |

### `components/common/Header.tsx` — HAUTE

| Texte FR | Traduction PT | Contexte |
|----------|--------------|----------|
| Se connecter | Iniciar sessão | Fallback bouton |
| Trouver un artisan | Encontrar um profissional | Fallback CTA |

### `components/chat/FixyChatGeneric.tsx` — HAUTE

| Texte FR | Traduction PT | Contexte |
|----------|--------------|----------|
| Préparer une AG | Preparar uma AG | Prompt chat IA |
| Urgence technique | Urgência técnica | Prompt chat IA |
| *(+ 4 autres prompts)* | *(à traduire)* | Suggestions IA |

### `components/chat/AiChatBot.tsx` — HAUTE

| Texte FR | Traduction PT |
|----------|--------------|
| Nouveau RDV | Nova marcação |
| Mes dispos | As minhas disponibilidades |

### `app/auth/login/page.tsx` — HAUTE

| Texte FR | Traduction PT |
|----------|--------------|
| Mentions légales | Avisos legais |
| Confidentialité | Privacidade |

---

## 3. Composants syndic — Doublons FR/PT et composants FR sans équivalent

### Doublons FR/PT (7 paires) — à fusionner

| Composant FR | Composant PT existant | Recommandation |
|-------------|----------------------|----------------|
| `SuiviEnergetiqueFRSection.tsx` | `MonitorizacaoConsumosSection.tsx` | Fusionner avec version PT |
| `SignalementsFRSection.tsx` | `OcorrenciasSection.tsx` | Fusionner avec version PT |
| `CommunicationDematFRSection.tsx` | `QuadroAvisosSection.tsx` | Fusionner avec version PT |
| `RecouvrementEnrichiFRSection.tsx` | `CobrancaJudicialSection.tsx` | Fusionner avec version PT |
| `GEDCertifieeFRSection.tsx` | `GEDSection.tsx` / `ArquivoDigitalSection.tsx` | Utiliser version PT |
| `ReservationEspacesFRSection.tsx` | `ReservaEspacosSection.tsx` | Utiliser version PT |
| `PreparateurAGSection.tsx` | `PreparadorAssembleiaSection.tsx` | Utiliser version PT |

### Composants FR sans équivalent PT — à traduire/internationaliser

| Composant FR | Nom PT suggéré | Sévérité |
|-------------|---------------|----------|
| `SaisieIAFacturesSection.tsx` | `RegistoIAFaturasSection.tsx` | HAUTE |
| `ComptaCoproSection.tsx` | `ContabilidadeCondominioSection.tsx` | HAUTE |
| `ComptabiliteTechSection.tsx` | `ContabilidadeTecnicaSection.tsx` | HAUTE |
| `AppelsFondsSection.tsx` | `ChamadaDeFundosSection.tsx` | HAUTE |
| `ImpayesSection.tsx` | `DividasSection.tsx` | HAUTE |
| `RecouvrementSection.tsx` | `CobrancaSection.tsx` | HAUTE |
| `MiseEnConcurrenceSection.tsx` | `ConcursoSection.tsx` | HAUTE |
| `AnalyseDevisSection.tsx` | `AnaliseOrcamentoSection.tsx` | HAUTE |
| `ModalNouveilleMission.tsx` | `ModalNovaMissao.tsx` | MOYENNE |
| `FacturationPageWithTransferts.tsx` | `FaturacaoComTransferencias.tsx` | MOYENNE |
| `EnquetesSection.tsx` | `InqueritosSection.tsx` | MOYENNE |
| `EquipeSection.tsx` | `EquipaSection.tsx` | MOYENNE |
| `PointageSection.tsx` | `RegistoPresencaSection.tsx` | MOYENNE |
| `DocsInterventionsSection.tsx` | `DocsIntervençõesSection.tsx` | MOYENNE |
| `EcheancesSection.tsx` | `PrazosSection.tsx` | MOYENNE |
| `PanneauAffichageSection.tsx` | `QuadroAvisosSection.tsx` | MOYENNE |
| `DashboardMultiImmeublesSection.tsx` | `DashboardMultiEdificiosSection.tsx` | MOYENNE |
| `HistoriqueImmeubleSection.tsx` | `HistoricoEdificioSection.tsx` | MOYENNE |
| `RapportMensuelSection.tsx` | `RelatorioMensalSection.tsx` | MOYENNE |
| `CarnetEntretienSection.tsx` | `CadernoManutencaoSection.tsx` | MOYENNE |
| `VisiteTechniqueSection.tsx` | `VistoriaTecnicaSection.tsx` | MOYENNE |
| `DPECollectifSection.tsx` | `CertificacaoEnergeticaSection.tsx` | MOYENNE |
| `IRVESection.tsx` | `CarregamentoVESection.tsx` | MOYENNE |
| `VoteCorrespondanceSection.tsx` | `VotoCorrespondenciaSection.tsx` | MOYENNE |
| `PVAssembleeIASection.tsx` | `AtasAssembleiaIASection.tsx` | MOYENNE |

---

## 4. Middleware — DEFAULT_LOCALE

**Fichier :** `middleware.ts` (ligne 6)

```
DEFAULT_LOCALE = 'fr'
```

**Problème :** Tout utilisateur dont la locale n'est pas détectée (VPN, navigateur neutre, etc.) sera redirigé vers le contenu français au lieu du portugais.

**Fix :** Changer en `'pt'` si le marché principal est le Portugal.

---

## 5. Clés pt.json identiques à fr.json

Sur ~96 clés identiques entre `locales/pt.json` et `locales/fr.json`, environ 35 nécessitent une vraie traduction. Les ~60 restantes sont des termes universels (Email, Blog, Total, Menu, etc.).

**Clés à traduire en priorité :**

| Clé | Valeur actuelle (= FR) | Traduction PT |
|-----|----------------------|---------------|
| `proDash.motifs.forfait` | Forfait | Pacote / Avença |
| `proDash.btp.sousTraitance.colDC4` | DC4 | Adapter au cadre PT |
| `clientDash.cilDetail.cilCompliant` | CIL conforme | CIL em conformidade |
| `devis.sendModalValidateTitle` | conforme | em conformidade |

---

## 6. Plan d'action — par priorité

### CRITIQUE (à faire immédiatement)

| # | Action | Fichiers | Effort |
|:-:|--------|----------|:------:|
| 1 | Changer `DEFAULT_LOCALE` de `"fr"` à `"pt"` dans middleware.ts | `middleware.ts` | 5 min |
| 2 | Traduire entièrement `/reserver/page.tsx` (26+ strings FR) | `app/reserver/page.tsx` | 1h |
| 3 | Créer redirects des routes FR racine vers routes PT | `next.config.ts` + `middleware.ts` | 2h |
| 4 | Traduire les 4 pages SEO Porto (electricien, plombier, etc.) | `app/*-porto/` (4 fichiers) | 3h |

### HAUTE (dans la semaine)

| # | Action | Fichiers | Effort |
|:-:|--------|----------|:------:|
| 5 | Migrer textes hardcodés du Header vers `t()` | `components/common/Header.tsx` | 30 min |
| 6 | Internationaliser `MateriauxSection.tsx` (presets FR) | `components/dashboard/MateriauxSection.tsx` | 1h |
| 7 | Internationaliser `BTPSections.tsx` (15 métiers FR) | `components/dashboard/BTPSections.tsx` | 1h |
| 8 | Internationaliser `ComptabiliteSection.tsx` (catégories FR) | `components/dashboard/ComptabiliteSection.tsx` | 1h |
| 9 | Internationaliser `MessagerieArtisan.tsx` (statuts/priorités FR) | `components/dashboard/MessagerieArtisan.tsx` | 30 min |
| 10 | Traduire les prompts FR de `FixyChatGeneric.tsx` | `components/chat/FixyChatGeneric.tsx` | 30 min |
| 11 | Fusionner composants syndic FR/PT doublons (7 paires) | ~14 fichiers `syndic-dashboard/` | 1 jour |
| 12 | Internationaliser composants syndic FR sans équivalent PT | ~20 fichiers `syndic-dashboard/` | 2 jours |
| 13 | Compléter les ~35 clés `pt.json` nécessitant traduction | `locales/pt.json` | 1h |
| 14 | Supprimer ou rediriger les routes FR doublons (`/a-propos`, `/tarifs`, `/recherche`) | 3 dossiers `app/` | 1h |

### MOYENNE (dans le mois)

| # | Action | Fichiers | Effort |
|:-:|--------|----------|:------:|
| 15 | Internationaliser `ConciergerieSections.tsx` checklist | `components/dashboard/ConciergerieSections.tsx` | 30 min |
| 16 | Renommer composants FR (`ModalNouveilleMission`, etc.) | Multiples fichiers | 2h |
| 17 | Harmoniser noms API routes (optionnel, backend only) | `app/api/*/` | 1 jour |
| 18 | Ajouter des tests de non-régression i18n | `tests/` | 1 jour |

---

## Cause racine

L'application a été construite initialement pour le marché français (Marseille/PACA) et le portugais a été ajouté en second. Les traces observées sont le résultat d'une **localisation incomplète** plutôt que d'un design multilingue dès le départ :

- La structure de routes FR prédate celle du PT
- `/pesquisar` existe comme alias de `/recherche` (pas comme route primaire)
- `/mercados` existe mais `/marches` est toujours actif
- `/app/reserver/page.tsx` n'a aucune infrastructure de traduction
- Les pages SEO Porto chargent des données depuis `FR_INVESTOR_PAGES`
- Les commentaires et nommages internes sont majoritairement en français

---

*Audit réalisé le 18 mars 2026*
