# Lien « mot de passe oublié » envoyé par e-mail (Supabase)

Le lien de l'e-mail doit marcher sur n'importe quel appareil, pas seulement dans le navigateur qui a fait la demande,
sans jamais ouvrir de session à partir du seul lien.

## Pourquoi le lien par défaut ne suffit pas

Les clients Supabase du site (`@supabase/ssr` : `lib/supabase.ts` dans le navigateur, `createServerClient` dans les
routes) sont en flux PKCE. `POST /api/auth/reset-password` appelle `resetPasswordForEmail`, qui range le vérificateur
PKCE en cookie dans le navigateur de la demande. Le lien par défaut du modèle d'e-mail, `{{ .ConfirmationURL }}`,
passe par `https://<projet>.supabase.co/auth/v1/verify?token=pkce_…` : GoTrue consomme le jeton (et confirme le compte
s'il ne l'était pas), puis renvoie sur `/auth/update-password?code=…`. Ce code ne s'échange qu'avec le vérificateur :
dans un autre navigateur, le SDK ne reconnaît même pas l'adresse comme un retour d'authentification
(`_isPKCECallback` exige le vérificateur) et ignore le code ; aucune session, la page affiche « lien expiré » au bout
de 10 s. Constat en production du 09/11/2026 : demande faite sur le PC, lien ouvert sur le téléphone, compte confirmé
à ce moment, aucune connexion, aucun mot de passe choisi.

## Le parcours

1. Lien de l'e-mail : `GET /auth/confirm/?token_hash=…&type=recovery` (`app/(commun)/auth/confirm/route.ts`). La route
   n'appelle pas Supabase et ne consomme pas le jeton (une messagerie ou un antivirus qui ouvre le lien ne le grille
   pas). Elle le range dans le cookie `vitfix_reinit_mdp` (httpOnly, SameSite=Lax, chemin `/api/auth/`, 1 heure) et
   renvoie vers `/{fr|pt}/auth/update-password/?lien=1`.
2. La page affiche le formulaire sans attendre de session. À l'envoi, `POST /api/auth/update-password`
   (`app/api/auth/update-password/route.ts`) contrôle le mot de passe, puis vérifie le jeton (`verifyOtp`) et change le
   mot de passe dans un client Supabase sans stockage, révoque cette session de récupération et efface le cookie.
3. Message « Mot de passe mis à jour ! », puis la page de connexion : l'utilisateur se connecte avec son nouveau mot
   de passe.

Aucune session n'est jamais posée dans le navigateur par ce parcours. Une session ouverte par un simple GET
permettrait de connecter la victime d'un lien piégé (jeton d'un compte de l'attaquant) à ce compte, et `Providers`
remonterait alors le stockage local du navigateur (devis, factures, clients) vers ce compte. Avec ce parcours, un lien
piégé ne peut que faire changer le mot de passe du compte de l'attaquant.

Détails :

- langue de la page : celle du chemin (le middleware préfixe le lien sans langue par la langue du visiteur et la
  transmet par l'en-tête `x-locale`), puis le cookie `locale`, sinon fr ; en, nl et es → pt (pages communes seulement
  en fr et pt, règles `/:locale(en|nl|es)/auth/confirm` de `next.config.ts`) ;
- lien incomplet, malformé ou d'un autre `type` : `?erreur=lien-invalide` (« lien expiré » tout de suite) ou page de
  connexion ; la destination ne vient jamais du lien (`next`, `redirect_to` ignorés) ;
- `POST /api/auth/update-password` : refusé depuis une autre origine (middleware), cookie SameSite=Lax jamais envoyé par un POST venu d'un autre site ; 10
  essais par 5 minutes et par adresse IP (`lib/rate-limit.ts`) ; mot de passe contrôlé avant `verifyOtp`, qui consomme
  le jeton (règle du formulaire, 72 octets au plus comme GoTrue) ; GoTrue saturé ou injoignable → jeton gardé, l'utilisateur peut réessayer ; même mot de passe que l'actuel
  → « connectez-vous avec lui » ;
- ancien lien (`?code=…`) et utilisateur déjà connecté : page inchangée, `supabase.auth.updateUser` comme avant.

Tests : `tests/auth/lien-email-confirm.test.ts`, `tests/api/auth-update-password.test.ts` (vrai `supabase-js`,
GoTrue simulé), `tests/auth/update-password-lien.test.tsx`, `tests/auth/lien-email-middleware.test.ts`, cas
`/auth/confirm` de `tests/next-config-routage-opennext.test.ts`.

## Modèle d'e-mail (tableau de bord Supabase : Authentication, Emails, Templates)

État relevé le 09/11/2026 : « Reset password » est le texte livré par Supabase (anglais, sujet « Reset Your
Password »), Site URL `https://vitfix.io`, Redirect URLs `https://vitfix.io/**`, « Email OTP expiration » 3 600 s.

Corps à coller dans « Reset password » (sujet inchangé) :

```html
<h2>Reset Password</h2>

<p>Follow this link to reset the password for your user:</p>
<p><a href="https://vitfix.io/auth/confirm/?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

Domaine écrit en dur plutôt que `{{ .SiteURL }}` : le lien ne dépend ni du réglage Site URL ni de sa barre finale.
Barre finale après `confirm` : le site est en `trailingSlash`, elle évite un saut 308.

Les autres modèles ne changent pas. « Confirm sign up » en particulier garde `{{ .ConfirmationURL }}` : sur un autre
appareil, le compte est bien confirmé mais aucune session n'est ouverte et rien ne l'indique (retour sur l'accueil).
Le corriger sans ouvrir de session demande une page « Confirmer mon adresse » puis une connexion : changement de
parcours à décider à part.

## Ordre de bascule

1. Fusionner, attendre le déploiement, puis vérifier que `https://vitfix.io/fr/auth/confirm/` mène à la page de
   connexion (redirection 303 vers `/fr/auth/login/?erreur=lien-invalide`) et non à une page 404.
2. Modifier « Reset password ». Essai : demande depuis un navigateur, lien ouvert dans un autre (téléphone, ou fenêtre
   de navigation privée) → formulaire « Nouveau mot de passe » → « Mot de passe mis à jour ! » → connexion avec le
   nouveau mot de passe.

Un lien envoyé avant le changement garde l'ancien format (`…supabase.co/auth/v1/verify?…`) : il fonctionne comme
avant (dans le navigateur de la demande) jusqu'à son expiration (1 heure).

Retour arrière : d'abord remettre `{{ .ConfirmationURL }}` dans le modèle, ensuite seulement revenir sur le code. Dans
l'autre ordre, tous les liens envoyés entre-temps tomberaient sur une page 404.

## Limites connues

- Le jeton figure dans l'URL du lien (comme dans le lien GoTrue par défaut) : les journaux des Workers Cloudflare
  l'enregistrent, les traces Sentry échantillonnées peuvent le garder aussi, et il reste utilisable jusqu'à son
  expiration (1 heure) s'il n'a pas servi. Seuls les administrateurs de ces outils y ont accès.
- Chaque vérification part du Worker vers GoTrue : la limite « token verifications » de Supabase, comptée par adresse
  IP, voit l'adresse du Worker et non celle du visiteur. À surveiller dans les journaux Auth de Supabase après le
  premier essai.
