# Rapport IA — Scénarios de test manuels

4 scénarios couvrant la génération IA, le fallback, et l'édition.

---

## Scénario A — Chantier avec description (happy path)

1. Ouvrir l'app mobile `/pro/mobile`
2. Démarrer un ProofOfWork sur un booking existant
3. Remplir la description : "J'ai élagué 3 arbres dans le jardin, nettoyage effectué, branches évacuées"
4. Prendre les photos avant/après + signature
5. Valider le ProofOfWork

**Vérifications :**
- ✅ Le booking passe à `completed`
- ✅ Un appel non-bloquant à `/api/rapport-ia` est déclenché
- ✅ En DB : `rapport_ia_source` = `'groq'`, `rapport_ia_genere_le` rempli, `rapport_ia_texte_brut` contient le JSON structuré
- ✅ Le bandeau vert "✨ Texte rédigé automatiquement" s'affiche dans la section proof
- ✅ Cliquer "Générer rapport PDF" → le PDF contient les 4 sections (Contexte, Travaux, Observations, Conclusion)
- ✅ Le footer du PDF indique "Rapport généré automatiquement le [date]"
- ✅ Le texte est cohérent avec la description fournie, sans détails inventés

---

## Scénario B — Chantier sans description (données minimales)

1. Créer un booking avec un service (ex: "Plomberie")
2. Démarrer un ProofOfWork sans remplir de description
3. Photos + signature → valider

**Vérifications :**
- ✅ `/api/rapport-ia` est appelé avec les données minimales (motif, artisan, adresse, date)
- ✅ `rapport_ia_source` = `'groq'` — le texte est généré depuis les données disponibles
- ✅ Le PDF est professionnel malgré le manque de détails
- ✅ Aucune information inventée dans le texte

---

## Scénario C — Groq indisponible (fallback)

1. Mettre une fausse valeur dans `GROQ_API_KEY` (ex: `gsk_FAKE`)
2. OU mettre `RAPPORT_IA_ACTIF=false` dans `.env.local`
3. Démarrer un ProofOfWork → valider

**Vérifications :**
- ✅ La clôture du chantier fonctionne normalement (pas d'erreur)
- ✅ `rapport_ia_source` = `'fallback_structurel'`
- ✅ `rapport_ia_texte_brut` contient le texte structurel (template rempli avec les données)
- ✅ Le PDF est généré correctement avec le texte structurel
- ✅ Le bandeau affiche "Texte rédigé automatiquement" (même le fallback)
- ✅ Aucune erreur visible pour l'artisan

---

## Scénario D — Modification du texte IA (édition inline)

1. Compléter le Scénario A
2. Dans la section proof du booking complété, voir le bandeau vert
3. Cliquer "Modifier"
4. Les 4 champs s'ouvrent en édition (introduction, travaux, observations, conclusion)
5. Modifier le texte des travaux réalisés
6. Cliquer "Sauvegarder les modifications"

**Vérifications :**
- ✅ Les modifications sont sauvegardées en DB (`rapport_ia_texte_brut` mis à jour)
- ✅ `rapport_ia_source` passe à `'manuel'` (l'artisan a modifié)
- ✅ Cliquer "Générer rapport PDF" → le PDF contient le texte modifié
- ✅ Le bandeau reste visible après la sauvegarde

---

## Notes pour les tests

- **GROQ_API_KEY** : déjà configurée dans `.env.local` (utilisée par Fixy et Léa)
- **RAPPORT_IA_ACTIF** : ajouter `RAPPORT_IA_ACTIF=true` dans `.env.local` pour activer
- **Logs** : surveiller les logs serveur pour `[rapport-ia]` en cas d'erreur Groq
- **Temps de réponse** : Groq Llama 3.3 70B répond en 1-3 secondes, le rapport est dispo quasi immédiatement
- **Rétrocompatibilité** : si `rapport_ia_texte_brut` est null, le PDF utilise `p.description` comme avant
