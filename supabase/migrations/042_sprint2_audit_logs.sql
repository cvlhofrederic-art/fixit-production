-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 2 : Table audit_logs — Traçabilité réglementaire (RGPD Art. 30)
-- ══════════════════════════════════════════════════════════════════════════════
-- Enregistre toutes les opérations sensibles : CRUD, exports, suppressions,
-- connexions échouées, changements de rôle, etc.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                    -- CREATE, READ, UPDATE, DELETE, LOGIN_FAILED, EXPORT_DATA, DELETE_ACCOUNT, ROLE_CHANGE
  table_name TEXT,                         -- Table concernée (ou 'auth.users', 'all', etc.)
  record_id UUID,                          -- ID de l'enregistrement modifié (optionnel)
  details JSONB DEFAULT '{}',              -- Anciennes/nouvelles valeurs, contexte
  ip_address TEXT,                         -- IP source (x-forwarded-for)
  user_agent TEXT,                         -- Navigateur/device
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);

-- RLS : seuls les super_admin et service_role peuvent lire les logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy : le service_role (API routes via supabaseAdmin) peut tout faire
-- Les utilisateurs normaux NE PEUVENT PAS lire les audit logs
CREATE POLICY "audit_logs_service_role_all" ON audit_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Super admin peut lire (mais pas modifier/supprimer)
CREATE POLICY "audit_logs_super_admin_read" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND u.raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- F15: Cleanup automatique des logs > 1 an (RGPD proportionnalité)
-- Activé via pg_cron : tous les dimanches à 3h du matin
SELECT cron.schedule('audit_logs_cleanup', '0 3 * * 0', $$DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year'$$);

-- ══════════════════════════════════════════════════════════════════════════════
-- Stripe webhook event deduplication
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,               -- Stripe event ID (evt_xxx)
  event_type TEXT NOT NULL,                -- checkout.session.completed, etc.
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup vieux events (> 7 jours)
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_webhook_events(processed_at);
