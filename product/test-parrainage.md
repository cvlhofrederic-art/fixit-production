# Parrainage — Scénarios de test manuels

5 scénarios couvrant le happy path, la fraude, et les cas limites.

---

## 1. Happy path complet

**Objectif :** Un parrain invite un filleul qui s'inscrit, souscrit un abonnement, et les deux reçoivent leur récompense après J+7.

**Étapes :**
1. Artisan A (parrain) copie son lien depuis Dashboard > Parrainage
2. Artisan B ouvre `/rejoindre?ref=CODEA` — vérifie : page affiche nom du parrain, cookie `vitfix_ref` posé (30j)
3. Artisan B clique "Rejoindre" → redirigé vers `/pro/register?ref=CODEA`
4. Artisan B complète l'inscription — vérifie : badge "Parrainé par A" sur la page succès
5. Vérifier en DB : `referrals` row créée (statut = `inscrit`), `profiles_artisan.referral_parrain_id` = A.id
6. Vérifier emails : filleul reçoit "🎁 Votre 1er mois offert", parrain reçoit "🎉 B a rejoint VITFIX"
7. Artisan B souscrit un abonnement Pro via Stripe Checkout
8. Webhook `checkout.session.completed` → vérifie : referral passe à `paiement_valide`, `date_fin_periode_verification` = now + 7j
9. Simuler J+7 : appeler `GET /api/cron/referral` (header `Authorization: Bearer CRON_SECRET`)
10. Vérifier : referral passe à `recompense_distribuee`, crédits Stripe -4900 cts sur les deux customers
11. Vérifier emails : parrain reçoit "🎉 Parrainage validé — 1 mois offert"
12. Dashboard parrain : stats mises à jour (total_parrainages +1, credit_mois_gratuits +1)

**Résultat attendu :** Les deux artisans ont un crédit Stripe de 49€, le referral est en statut final `recompense_distribuee`.

---

## 2. Auto-parrainage (même personne)

**Objectif :** Vérifier que `checkAutoParrainage()` bloque silencieusement un artisan qui tente de se parrainer lui-même.

**Étapes :**
1. Artisan A copie son lien de parrainage
2. Se déconnecte, crée un nouveau compte via `/rejoindre?ref=CODEA`
3. Utilise la même adresse email ou le même user_id Supabase

**Vérifications :**
- L'API `/api/referral/signup` retourne `{ success: true, referral: false }` — pas d'erreur visible
- Aucun `referrals` row créé
- `referral_risk_log` contient une entrée `auto_parrainage_bloque`
- Le filleul ne voit aucun message d'erreur (blocage silencieux)

**Variante :** Tester aussi avec le même domaine email + la même IP pour vérifier le scoring (score = 3 + 1 = 4, pas bloqué mais contribue au score).

---

## 3. Fraude même carte bancaire

**Objectif :** Vérifier que deux comptes utilisant la même carte sont flaggés.

**Étapes :**
1. Artisan A parraine Artisan B (happy path jusqu'à `inscrit`)
2. Artisan B souscrit avec la même carte Visa que A (même fingerprint Stripe)
3. Webhook `checkout.session.completed` → `handleReferralPaymentVerification()`

**Vérifications :**
- `meme_moyen_paiement_que_parrain` = true en DB
- Risk score recalculé avec +5 (meme_moyen_paiement)
- Si score total >= 8 : referral passe à `bloque`, log `fraude_bloquee_paiement`
- Si score total >= 5 mais < 8 : `en_revue_manuelle` = true
- Dashboard parrain : le filleul apparaît comme "Inactif" (jamais "Bloqué")

---

## 4. Filleul inactif — rappel J+7

**Objectif :** Un filleul s'inscrit mais ne souscrit pas d'abonnement. Le parrain reçoit un rappel à J+7.

**Étapes :**
1. Artisan A parraine Artisan B
2. B s'inscrit (referral passe à `inscrit`)
3. B ne souscrit aucun abonnement pendant 7 jours
4. Simuler J+7 : appeler `GET /api/cron/referral`

**Vérifications :**
- Le cron détecte le referral `inscrit` avec `created_at` > 7j
- Email envoyé au parrain : "⏳ B n'a pas encore activé son abonnement"
- `rappel_envoye` passe à `true` en DB
- Un deuxième appel du cron ne renvoie PAS l'email (vérifier `rappel_envoye`)

---

## 5. Spam parrainages (> 5 en 7 jours)

**Objectif :** Un parrain qui génère plus de 5 parrainages en 7 jours voit son score augmenter.

**Étapes :**
1. Artisan A parraine 6 filleuls en moins de 7 jours (6 inscriptions via son lien)
2. Le 6ème filleul s'inscrit

**Vérifications :**
- `computeRiskScore()` détecte `parrain_depasse_5_parrainages_7j` (+2 au score)
- Combiné avec d'autres facteurs (même IP, inscription rapide), le score peut atteindre le seuil de review (>= 5) ou de blocage (>= 8)
- Les 5 premiers parrainages ne sont pas affectés rétroactivement
- Le parrain ne reçoit aucune indication que ses parrainages sont surveillés

---

## Notes pour les tests

- **Stripe test mode** : utiliser les cartes de test Stripe (`4242 4242 4242 4242`) pour simuler les paiements
- **Fingerprint carte** : en mode test, toutes les cartes `4242...` ont le même fingerprint. Utiliser `4000 0000 0000 0002` (decline) pour une carte différente
- **Cron manuel** : `curl -H "Authorization: Bearer $CRON_SECRET" https://vitfix.io/api/cron/referral`
- **Reset pour re-test** : supprimer les rows `referrals` + `referral_risk_log` + reset `profiles_artisan.referral_parrain_id` à null
- **Emails en dev** : vérifier sur le dashboard Resend (resend.com/emails) en mode test
