-- 20260608000001_reconcile_doc_sequences.sql
--
-- Réaligne le compteur serveur `doc_sequences` sur le DERNIER numéro réellement
-- émis, par (artisan_user_id, série, année). Idempotent : `GREATEST` ne baisse
-- jamais un compteur, donc rejouable sans risque.
--
-- Contexte (bug numérotation cross-device) : le fallback client (localStorage)
-- attribuait des numéros SANS incrémenter la séquence serveur → dérive (ex.
-- devis émis jusqu'à 004 alors que last_seq=1). Couplé au mauvais id passé au
-- RPC next_doc_number (corrigé en parallèle : on passe désormais l'auth.uid, pas
-- l'id profil), la séquence redevient la source autoritaire. Cette réconciliation
-- purge la dérive existante pour que le prochain numéro serveur ne collisionne
-- plus avec un document déjà émis (sur N'IMPORTE quel appareil).
--
-- La série est dérivée du préfixe du numéro : DEV→devis, FACT→facture,
-- AC→acompte, AV→avoir (les acomptes/avoirs vivent dans la table `factures`).

INSERT INTO doc_sequences (artisan_user_id, doc_type, year, last_seq)
SELECT artisan_user_id,
  CASE split_part(numero, '-', 1)
    WHEN 'DEV'  THEN 'devis'
    WHEN 'FACT' THEN 'facture'
    WHEN 'AV'   THEN 'avoir'
    WHEN 'AC'   THEN 'acompte'
  END AS doc_type,
  split_part(numero, '-', 2)::int AS year,
  max(split_part(numero, '-', 3)::int) AS last_seq
FROM (
  SELECT numero, artisan_user_id FROM factures
   WHERE numero ~ '^(DEV|FACT|AV|AC)-[0-9]{4}-[0-9]+$' AND artisan_user_id IS NOT NULL
  UNION ALL
  SELECT numero, artisan_user_id FROM devis
   WHERE numero ~ '^(DEV|FACT|AV|AC)-[0-9]{4}-[0-9]+$' AND artisan_user_id IS NOT NULL
) u
GROUP BY artisan_user_id, 2, 3
ON CONFLICT (artisan_user_id, doc_type, year)
  DO UPDATE SET last_seq = GREATEST(doc_sequences.last_seq, EXCLUDED.last_seq);
