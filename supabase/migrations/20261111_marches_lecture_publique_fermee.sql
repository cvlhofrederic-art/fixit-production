-- 20261111_marches_lecture_publique_fermee.sql
--
-- Bourse aux Marchés : la table `marches` n'est plus lisible directement ; la lecture publique passe par
-- /api/marches et sa liste blanche de colonnes (lib/marches-public.ts).
-- À relire et appliquer par Frédéric.
--
-- La politique « marches_public_read » (006_bourse_marches.sql) est retirée : une politique de sécurité au niveau
-- des lignes choisit des lignes, pas des colonnes, alors que la vue publique d'un marché se limite à la liste blanche.
--
-- Retrait seul, sans politique de remplacement. Rien dans le site ne lit cette table depuis le navigateur : toutes
-- les lectures passent par /api/marches (client « service role », qui ne renvoie que la liste blanche de
-- lib/marches-public.ts). Le publieur connecté garde « marches_publisher_read » (ses propres marchés) ; c'est elle,
-- et non la lecture publique, qu'interrogent les politiques voisines (candidatures_publisher_read,
-- marches_messages_select, evaluations_select, evaluations_insert, btp_msgs_read).
--
-- Ordre : cette migration ne dépend pas du code ; elle peut s'appliquer avant comme après son déploiement.
--
-- À appliquer seule. DROP POLICY prend un verrou exclusif sur la table, le temps de l'instruction : lock_timeout
-- évite d'attendre derrière une transaction longue ; en cas d'expiration, rien n'est appliqué, relancer.
--
-- Contrôle après exécution (lecture seule) :
--   select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'marches' order by 1;
--   → marches_insert, marches_publisher_read, marches_publisher_update ; plus de marches_public_read.
--
-- Rejouable.

set local lock_timeout = '5s';

drop policy if exists "marches_public_read" on public.marches;
