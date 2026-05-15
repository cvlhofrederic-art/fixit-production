-- Migration : bucket cabinet-backups pour les exports JSON du handler backup_docs.
-- Le bucket est privé. Les policies permettent :
--   - SELECT : seul l'utilisateur dont l'uid = premier segment du chemin (cabinet_id)
--   - INSERT : même condition, + service_role (pour le cron Tempo)

INSERT INTO storage.buckets (id, name, public)
VALUES ('cabinet-backups', 'cabinet-backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY cabinet_backups_select ON storage.objects FOR SELECT USING (
  bucket_id = 'cabinet-backups'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY cabinet_backups_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'cabinet-backups'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR auth.role() = 'service_role'
  )
);
